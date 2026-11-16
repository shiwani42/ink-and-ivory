import {
  Box3,
  Matrix4,
  Bone,
  DoubleSide,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Plane,
  Quaternion,
  SkinnedMesh,
  Vector3,
} from '@iwsdk/core';

/**
 * Drives the realistic Shakuni (public/models/shakuni.glb, built by
 * tools/shakuni/build_shakuni.py from MakeHuman CC0 + our costume) entirely
 * procedurally:
 *  - seated cross-legged on his gaddi (leg IK); the real table hides what's behind it
 *    through depth occlusion, not a clipping hack
 *  - analytic two-bone IK for both arms (reach, lift, dip under the table, throw, stroke beard)
 *  - leaning forward when a target is out of reach
 *  - head + neck look with eyes leading, clamped and spring-smoothed
 *  - breathing, idle sway, laugh bounce, angry lean
 *  - morph targets: blink (lashes/brows follow), squint, brows, smile, sneer, frown, mouth
 *  - jaw talk while a caption is being spoken
 *
 * All bone maths happens in world space with "rotate this bone so that this
 * world direction becomes that one", so it doesn't depend on the rig's local
 * bone axes.
 */

type Expr = Record<string, number>;

const EXPR_KEYS = [
  'blink_L', 'blink_R', 'squint_L', 'squint_R', 'brow_up_L', 'brow_up_R', 'brow_down_L', 'brow_down_R',
  'smile', 'sneer', 'mouth_open', 'purse', 'frown',
] as const;

export interface HumanDrive {
  /** board-local targets (the Shakuni group's parent space is converted by the caller) */
  lookAt: Vector3; // world
  rightHand: Vector3; // world
  leftHand: Vector3 | null; // world, null = rest on table
  watching: boolean;
  away: boolean;
  laugh: number; // 0..1
  anger: number; // 0..1
  suspicion: number; // 0..1
  grip: number; // 0..1
}

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();
const tmpD = new Vector3();
const tmpE = new Vector3();
const qA = new Quaternion();
const qB = new Quaternion();
const qC = new Quaternion();

export class ShakuniHuman {
  readonly root: Object3D;
  private bones = new Map<string, Bone>();
  private rest = new Map<Bone, Quaternion>();
  private morphMeshes: Mesh[] = [];
  private oldTurban: Mesh[] = [];
  private readonly turbanBox = new Box3();
  private readonly headRest = new Matrix4();
  private eyeMeshes: Mesh[] = [];
  private materials: Material[] = [];
  readonly clip = new Plane(new Vector3(0, 1, 0), 0);
  private expr: Expr = {};
  private exprTarget: Expr = {};
  private blinkT = 2;
  private blinkPhase = -1;
  private talkT = 0;
  private talkPhase = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private lookYawV = 0;
  private lookPitchV = 0;
  private lean = 0;
  private time = 0;
  private fade = 0;
  private armLen = { R: 0.5, L: 0.5 };

  constructor(scene: Object3D) {
    this.root = scene;
    scene.traverse((o) => {
      if ((o as Bone).isBone) this.bones.set(o.name, o as Bone);
      const m = o as Mesh;
      if (m.isMesh) {
        m.frustumCulled = false; // skinned bounds are unreliable
        if (/high-poly/i.test(m.name)) this.eyeMeshes.push(m);
        if (/tongue|teeth/i.test(m.name)) m.visible = false; // poke through closed lips; the mouth barely opens
        if (m.morphTargetDictionary && Object.keys(m.morphTargetDictionary).some((k) => k.startsWith('blink'))) {
          this.morphMeshes.push(m);
        }
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) this.prepareMaterial(mat, m);
      }
    });
    for (const b of this.bones.values()) this.rest.set(b, b.quaternion.clone());
    // remember where the code-built turban sits (model space, rest pose) so a generated
    // turban can be fitted to exactly the same place
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (/turban|sarpech/i.test(o.name) || /turban|sarpech/i.test(o.parent?.name ?? '')) {
        if ((o as Mesh).isMesh) {
          this.oldTurban.push(o as Mesh);
          this.turbanBox.expandByObject(o);
        }
      }
    });
    const hb = this.bone('head');
    if (hb) this.headRest.copy(hb.matrixWorld);
    if (import.meta.env.DEV) {
      scene.traverse((o) => {
        if ((o as Mesh).isMesh) console.info(`[chausar] mesh ${o.name} skinned=${(o as SkinnedMesh).isSkinnedMesh === true} parent=${o.parent?.name} bones=${(o as SkinnedMesh).skeleton?.bones.length ?? 0}`);
      });
      for (const m of this.morphMeshes) console.info(`[chausar] morph ${m.name}: ${Object.keys(m.morphTargetDictionary ?? {}).join(',')}`);
      (window as unknown as Record<string, unknown>).shakuniHuman = this;
    }
    for (const k of EXPR_KEYS) {
      this.expr[k] = 0;
      this.exprTarget[k] = 0;
    }
    // rest arm lengths
    for (const side of ['R', 'L'] as const) {
      const a = this.bone(`upperarm01.${side}`);
      const b = this.bone(`lowerarm01.${side}`);
      const c = this.bone(`wrist.${side}`);
      if (a && b && c) {
        scene.updateMatrixWorld(true);
        this.armLen[side] = a.getWorldPosition(tmpA).distanceTo(b.getWorldPosition(tmpB)) +
          b.getWorldPosition(tmpB).distanceTo(c.getWorldPosition(tmpC));
      }
    }
    this.setFade(0);
  }

  /**
   * Swap in a better turban (normalised: base at y=0, centred, front = +z). It is scaled to
   * the code-built turban's footprint, seated at its base and parented to the head bone.
   */
  wearTurban(obj: Object3D): boolean {
    const head = this.bone('head');
    if (!head || this.turbanBox.isEmpty()) return false;
    const size = this.turbanBox.getSize(new Vector3());
    const centre = this.turbanBox.getCenter(new Vector3());
    obj.updateMatrixWorld(true);
    const nb = new Box3().setFromObject(obj);
    const ns = nb.getSize(new Vector3());
    const s = Math.max(size.x / Math.max(1e-3, ns.x), size.z / Math.max(1e-3, ns.z)) * 1.03;
    obj.scale.multiplyScalar(s);
    // model-space placement: centred over the head, base just below the old turban's base
    const world = new Matrix4().compose(new Vector3(centre.x, this.turbanBox.min.y - 0.006, centre.z), new Quaternion(), obj.scale.clone());
    const local = new Matrix4().copy(this.headRest).invert().multiply(world);
    local.decompose(obj.position, obj.quaternion, obj.scale);
    head.add(obj);
    for (const m of this.oldTurban) m.visible = false;
    obj.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        const mat = m.material as MeshStandardMaterial;
        mat.transparent = false;
        mat.alphaTest = 0;
        this.materials.push(mat);
        mat.userData.baseTransparent = false;
        mat.userData.baseOpacity = 1;
      }
    });
    return true;
  }

  get ok(): boolean {
    return !!this.bone('head') && !!this.bone('wrist.R');
  }

  private bone(name: string): Bone | undefined {
    // three's GLTFLoader sanitises node names ("wrist.R" → "wristR")
    return this.bones.get(name) ?? this.bones.get(name.replace(/[[\].:/]/g, ''));
  }

  private prepareMaterial(mat: Material, mesh: Mesh): void {
    const m = mat as MeshStandardMaterial & { specularIntensity?: number; sheen?: number };
    const name = (m.name || '').toLowerCase() + ' ' + mesh.name.toLowerCase();
    if (/hair|beard|brow|lash/.test(name)) {
      // strand cards: alpha-tested, never blended (no sorting artifacts)
      m.transparent = false;
      m.alphaTest = 0.5;
      m.side = DoubleSide;
      m.depthWrite = true;
      if (/brow|lash/.test(name)) {
        // MPFB's transparency nodes don't survive glTF export: rebuild the cut-out from the
        // texture itself (dark strands on a light ground) and tint the strands near-black.
        m.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              vec4 strand = texture2D( map, vMapUv );
              float lum = dot( strand.rgb, vec3( 0.333 ) );
              diffuseColor.rgb *= mix( vec3( 0.03, 0.025, 0.02 ), strand.rgb, 0.15 );
              diffuseColor.a *= smoothstep( 0.25, 0.75, 1.0 - lum ) * strand.a;
            #endif`,
          );
        };
        m.customProgramCacheKey = () => 'strand-cutout';
      }
    } else {
      // MPFB exports skin/eyes/teeth as BLEND; blending a whole body causes per-object
      // sorting errors (eyes vanishing behind lids, limbs looking cut where cloth overlaps)
      m.transparent = false;
      m.alphaTest = 0;
      m.depthWrite = true;
    }
    if (/body/.test(name) && 'roughness' in m) m.roughness = 0.6;
    if (/turban|robe/.test(name)) {
      m.roughness = /turban/.test(name) ? 0.66 : 0.58;
      m.metalness = 0;
      if (m.specularIntensity !== undefined) m.specularIntensity = 0.35;
    }
    if (/high-poly/.test(name)) {
      // MakeHuman eyes = eyeball + a clear cornea shell (alpha 0 in the texture).
      // Alpha-TEST it: draw the eyeball, discard the cornea — no blending, no sorting.
      m.alphaTest = 0.5;
      m.roughness = 0.25;
    }
    m.userData.baseTransparent = m.transparent;
    m.userData.baseOpacity = m.opacity;
    this.materials.push(m);
  }

  setFade(v: number): void {
    if (Math.abs(v - this.fade) < 1e-3 && v !== 0 && v !== 1) return;
    this.fade = v;
    this.root.visible = v > 0.01;
    for (const m of this.materials) {
      const solid = v >= 0.999;
      m.transparent = solid ? (m.userData.baseTransparent as boolean) : true;
      m.opacity = (m.userData.baseOpacity as number) * v;
      m.depthWrite = solid || v > 0.6;
    }
  }

  /** Seconds of speech to animate the jaw for. */
  talk(text: string): void {
    this.talkT = Math.min(8, 0.6 + text.length * 0.062);
  }

  /** World-space clipping plane at the table top (normal pointing up). */
  setTablePlane(point: Vector3, normal: Vector3): void {
    this.clip.setFromNormalAndCoplanarPoint(normal, point);
  }

  // ── bone helpers ────────────────────────────────────────────────────────
  /** Rotate a bone by a world-space rotation q (pre-multiplied in world). */
  private rotateWorld(b: Bone, q: Quaternion): void {
    const parent = b.parent!;
    parent.getWorldQuaternion(qA);
    b.getWorldQuaternion(qB);
    qC.copy(q).multiply(qB); // new world rotation
    b.quaternion.copy(qA.invert().multiply(qC));
    b.updateMatrixWorld(true);
  }

  private rotateAxis(b: Bone | undefined, axisWorld: Vector3, angle: number): void {
    if (!b || Math.abs(angle) < 1e-5) return;
    this.rotateWorld(b, qC.setFromAxisAngle(axisWorld, angle).clone());
  }

  private aimSegment(b: Bone, childWorld: Vector3, targetWorld: Vector3): void {
    b.getWorldPosition(tmpD);
    tmpE.subVectors(childWorld, tmpD).normalize();
    const to = tmpA.subVectors(targetWorld, tmpD).normalize();
    if (tmpE.lengthSq() < 1e-8 || to.lengthSq() < 1e-8) return;
    this.rotateWorld(b, new Quaternion().setFromUnitVectors(tmpE, to));
  }

  /** Analytic two-bone IK: upperarm01 → lowerarm01 → wrist. */
  private solveArm(side: 'R' | 'L', target: Vector3, pole: Vector3): void {
    this.solveChain(`upperarm01.${side}`, `lowerarm01.${side}`, `wrist.${side}`, target, pole);
  }

  /** Analytic two-bone IK on any root → mid → end chain (world-space target + pole). */
  private solveChain(an: string, bn: string, cn: string, target: Vector3, pole: Vector3): void {
    const a = this.bone(an);
    const b = this.bone(bn);
    const c = this.bone(cn);
    if (!a || !b || !c) return;
    const A = a.getWorldPosition(new Vector3());
    const B = b.getWorldPosition(new Vector3());
    const C = c.getWorldPosition(new Vector3());
    const l1 = A.distanceTo(B);
    const l2 = B.distanceTo(C);
    const dir = new Vector3().subVectors(target, A);
    const d = Math.min(Math.max(dir.length(), 0.05), l1 + l2 - 1e-3);
    dir.normalize();
    const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const p = new Vector3().subVectors(pole, A);
    p.addScaledVector(dir, -p.dot(dir)).normalize();
    const elbow = A.clone().addScaledVector(dir, l1 * cosA).addScaledVector(p, l1 * sinA);
    const T = A.clone().addScaledVector(dir, d);
    this.aimSegment(a, B, elbow);
    b.getWorldPosition(B);
    c.getWorldPosition(C);
    this.aimSegment(b, C, T);
  }

  // ── per frame ───────────────────────────────────────────────────────────
  /** dev: freeze all expressions at zero to inspect the neutral face */
  neutral = false;

  update(dt: number, d: HumanDrive): void {
    if (!this.ok || !this.root.visible) return;
    this.time += dt;
    const t = this.time;
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    this.root.updateMatrixWorld(true);
    if (this.neutral) return; // dev: rest pose, no morphs — compare against the Blender render

    // model axes in world
    const rq = this.root.getWorldQuaternion(new Quaternion());
    const right = new Vector3(1, 0, 0).applyQuaternion(rq); // his left
    const up = new Vector3(0, 1, 0).applyQuaternion(rq);
    const fwd = new Vector3(0, 0, 1).applyQuaternion(rq); // toward the player

    // seated cross-legged (sukhasana) on the gaddi: feet tucked under the opposite knee
    const pelvis = this.bone('root')!.getWorldPosition(new Vector3());
    for (const [s, sg] of [['L', 1], ['R', -1]] as const) {
      const foot = new Vector3().copy(pelvis)
        .addScaledVector(right, -sg * 0.13)
        .addScaledVector(fwd, 0.2 + (s === 'L' ? 0.05 : 0))
        .addScaledVector(up, -0.06 + (s === 'L' ? 0.025 : 0));
      const knee = new Vector3().copy(pelvis).addScaledVector(right, sg * 0.7).addScaledVector(fwd, 0.55).addScaledVector(up, 0.05);
      this.solveChain(`upperleg01.${s}`, `lowerleg01.${s}`, `foot.${s}`, foot, knee);
    }

    // lean toward far targets, back when laughing, forward when angry
    const sh = this.bone('upperarm01.R')!.getWorldPosition(new Vector3());
    const reach = sh.distanceTo(d.rightHand) / this.armLen.R;
    const leanT = Math.min(0.42, Math.max(0, (reach - 0.82) * 1.4)) + d.anger * 0.18 - d.laugh * 0.08;
    this.lean += (leanT - this.lean) * (1 - Math.exp(-dt * 5));
    const breath = Math.sin(t * 1.55) * 0.012;
    const sway = Math.sin(t * 0.37) * 0.02 + (d.away ? 0.28 : 0);
    const bounce = d.laugh * Math.abs(Math.sin(t * 13)) * 0.05;
    this.rotateAxis(this.bone('spine03'), right, this.lean * 0.5 + breath + bounce);
    this.rotateAxis(this.bone('spine02'), right, this.lean * 0.5);
    this.rotateAxis(this.bone('spine03'), up, sway * 0.5);
    this.rotateAxis(this.bone('spine04'), up, sway * 0.5);
    this.rotateAxis(this.bone('clavicle.L'), fwd, breath * 1.5);
    this.rotateAxis(this.bone('clavicle.R'), fwd, -breath * 1.5);

    // head look: spring toward clamped yaw/pitch, eyes lead
    const head = this.bone('head')!;
    const hp = head.getWorldPosition(new Vector3());
    const to = tmpB.subVectors(d.lookAt, hp);
    const curFwd = new Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new Quaternion()).multiply(
      qB.copy(this.restWorld(head)).invert())).applyQuaternion(rq);
    void curFwd;
    const yawT = Math.max(-0.9, Math.min(0.9, Math.atan2(to.dot(right), to.dot(fwd)))) + (d.away ? 0.9 : 0);
    const pitchT = Math.max(-0.45, Math.min(0.35, Math.atan2(-to.dot(up), Math.hypot(to.dot(right), to.dot(fwd)))));
    const k = 120;
    const damp = 2 * Math.sqrt(k) * 0.82;
    this.lookYawV += ((yawT - this.lookYaw) * k - this.lookYawV * damp) * dt;
    this.lookPitchV += ((pitchT - this.lookPitch) * k - this.lookPitchV * damp) * dt;
    this.lookYaw += this.lookYawV * dt;
    this.lookPitch += this.lookPitchV * dt;
    const bodyYawShare = d.away ? sway : 0;
    const yaw = this.lookYaw - bodyYawShare;
    this.rotateAxis(this.bone('neck02'), up, yaw * 0.35);
    this.rotateAxis(head, up, yaw * 0.55);
    this.rotateAxis(this.bone('neck02'), right, this.lookPitch * 0.3);
    this.rotateAxis(head, right, this.lookPitch * 0.6);
    this.rotateAxis(head, fwd, Math.sin(t * 0.5) * 0.03 + (d.watching ? 0.06 : 0)); // sly head tilt
    // eyes take the remaining angle (they lead the head)
    const eyeYaw = Math.max(-0.35, Math.min(0.35, (yawT - this.lookYaw) * 0.9 + yaw * 0.1));
    const eyePitch = Math.max(-0.25, Math.min(0.25, (pitchT - this.lookPitch) * 0.9 + this.lookPitch * 0.1));
    // Eyes: rotate the eye meshes about their own centres (the rig's eye bones pivot
    // off-centre and roll the eyeball up). Small angles only.
    void eyeYaw;
    void eyePitch; // (eye rotation disabled while diagnosing)

    // jaw talk
    if (this.talkT > 0) {
      this.talkT -= dt;
      this.talkPhase += dt * (10 + 4 * Math.sin(t * 1.7));
    }
    const talking = this.talkT > 0 ? Math.max(0, Math.sin(this.talkPhase)) * (0.6 + 0.4 * Math.sin(t * 5.3)) : 0;
    const jawOpen = talking * 0.16 + d.laugh * (0.12 + 0.08 * Math.abs(Math.sin(t * 13)));
    this.rotateAxis(this.bone('jaw'), right, jawOpen);

    // arms
    const pole = (side: 1 | -1) => tmpC.copy(sh).addScaledVector(right, side * 0.45).addScaledVector(up, -0.5).addScaledVector(fwd, -0.25);
    this.solveArm('R', d.rightHand, pole(-1).clone());
    if (d.leftHand && this.leftIsFingertip) {
      // Beard stroke, staged like a real gesture: wrist well in front of the chest and
      // below the goatee, elbow out to the side (forearm visible), hand turned so the
      // fingers reach up and in to grip the beard.
      const hq = this.bone('head')!.getWorldQuaternion(qB);
      const hFwd = tmpA.set(0, 0, 1).applyQuaternion(hq).clone();
      const hUp = tmpA.set(0, 1, 0).applyQuaternion(hq).clone();
      const wristT = tmpD.copy(d.leftHand).addScaledVector(hFwd, 0.085).addScaledVector(hUp, -0.075).addScaledVector(right, 0.035);
      const shL = this.bone('upperarm01.L')!.getWorldPosition(new Vector3());
      const elbowPole = shL.clone().addScaledVector(right, 0.55).addScaledVector(fwd, 0.3).addScaledVector(up, -0.35);
      this.solveArm('L', wristT.clone(), elbowPole);
      const wristL = this.bone('wrist.L');
      const knuckle = this.bone('finger3-1.L');
      if (wristL && knuckle) this.aimSegment(wristL, knuckle.getWorldPosition(new Vector3()), d.leftHand);
    } else {
      this.solveArm('L', d.leftHand ?? this.leftRest(sh, right, up, fwd), pole(1).clone());
    }
    this.curlFingers('R', d.grip, right);
    this.curlFingers('L', d.leftHand ? 0.5 : 0.25, right);

    // expressions
    const e = this.exprTarget;
    for (const key of EXPR_KEYS) e[key] = 0;
    e.smile = 0.28 + d.laugh * 0.7 + (d.away ? 0.25 : 0);
    e.brow_up_L = 0.25 + (d.away ? 0.3 : 0) + d.suspicion * 0.2;
    const sq = 0.06 + (d.watching ? 0.2 : 0) + d.suspicion * 0.12 + d.laugh * 0.35;
    e.squint_L = sq;
    e.squint_R = sq * 0.9;
    e.brow_down_L = e.brow_down_R = d.anger * 0.8 + (d.watching ? 0.15 : 0);
    e.sneer = d.anger * 0.7;
    e.frown = d.anger * 0.45;
    e.mouth_open = talking * 0.25 + d.laugh * 0.3;
    // blink
    this.blinkT -= dt;
    if (this.blinkT <= 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.blinkT = 2 + Math.random() * 4;
    }
    let blink = 0;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.14;
      blink = Math.sin(Math.min(1, this.blinkPhase) * Math.PI);
      if (this.blinkPhase >= 1) this.blinkPhase = -1;
    }
    for (const key of EXPR_KEYS) this.expr[key] += (e[key] - this.expr[key]) * (1 - Math.exp(-dt * 8));
    this.expr.blink_L = Math.max(this.expr.blink_L, blink);
    this.expr.blink_R = Math.max(this.expr.blink_R, blink);
    for (const m of this.morphMeshes) {
      const dict = m.morphTargetDictionary!;
      const inf = m.morphTargetInfluences!;
      for (const key of EXPR_KEYS) {
        const i = dict[key];
        if (i !== undefined) inf[i] = this.neutral ? 0 : Math.min(1, Math.max(0, this.expr[key]));
      }
    }
  }

  /**
   * Where the FINGERTIPS should be while stroking the goatee, world space.
   * `stroke` 0..1 runs from the chin down to the beard's point.
   */
  beardPoint(out: Vector3, stroke = 0): Vector3 {
    const jaw = this.bone('jaw');
    if (!jaw) return out;
    const head = this.bone('head')!;
    const hq = head.getWorldQuaternion(qA);
    jaw.getWorldPosition(out);
    // in FRONT of the goatee (the strands stand ~2 cm proud of the chin)
    out.addScaledVector(tmpA.set(0, 0, 1).applyQuaternion(hq), 0.1 - 0.012 * stroke);
    out.addScaledVector(tmpA.set(0, 1, 0).applyQuaternion(hq), -0.075 - 0.07 * stroke);
    return out;
  }

  /** World offset wrist → middle fingertip, measured after last frame's solve. */
  private readonly fingerOffset = new Vector3(0, 0.09, 0.03);
  /** true when DriveInput.leftHand is a fingertip target (beard stroke) */
  leftIsFingertip = false;

  private restWorldCache = new Map<Bone, Quaternion>();
  private restWorld(b: Bone): Quaternion {
    let q = this.restWorldCache.get(b);
    if (!q) {
      q = b.getWorldQuaternion(new Quaternion());
      this.restWorldCache.set(b, q);
    }
    return q;
  }

  private leftRest(sh: Vector3, right: Vector3, up: Vector3, fwd: Vector3): Vector3 {
    // left forearm resting on the table edge, fingers drumming a little
    const t = this.time;
    return tmpE
      .copy(sh)
      .addScaledVector(right, 0.36 + 0.004 * Math.sin(t * 3))
      .addScaledVector(up, -0.24)
      .addScaledVector(fwd, 0.2 + 0.006 * Math.sin(t * 7));
  }

  private curlFingers(side: 'R' | 'L', amount: number, right: Vector3): void {
    for (let f = 1; f <= 5; f++) {
      for (let s = 1; s <= 3; s++) {
        const b = this.bone(`finger${f}-${s}.${side}`);
        if (!b) continue;
        // curl about the hand's lateral axis; thumb curls less
        this.rotateAxis(b, right, (f === 1 ? 0.25 : 0.55) * amount * (side === 'R' ? 1 : -1));
      }
    }
  }
}
