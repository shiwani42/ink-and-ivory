import {
  AdditiveBlending,
  AssetManager,
  Bone,
  CanvasTexture,
  Sprite,
  SpriteMaterial,
  Color,
  Group,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  ShaderMaterial,
  SkinnedMesh,
  Vector3,
} from '@iwsdk/core';
import { JOINT_COUNT, type Handedness } from './ghost-pose.js';

/**
 * The master's translucent "ghost" hand.
 *
 * Uses the WebXR generic hand mesh (MIT, @webxr-input-profiles/assets), the same
 * model that draws your own tracked hands, re-skinned with a Fresnel "spirit"
 * shader: bright at the silhouette, nearly clear in the middle, so it reads as
 * a guide that your real hand can slide into. A depth-only pre-pass makes only
 * the front surface visible, avoiding the muddy look of overlapping fingers.
 *
 * `setJoints` takes 25 world-space joint matrices in WebXR joint order, so the
 * same hand can be driven by the procedural master, a recording, or a blend
 * toward the learner's own tracked hand (the "lock-in" moment).
 */

const JOINT_NAMES = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
];

const vertexShader = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    #include <skinbase_vertex>
    #include <beginnormal_vertex>
    #include <skinnormal_vertex>
    #include <defaultnormal_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    vNormalV = normalize(transformedNormal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uGold;
  uniform float uGoldMix;
  uniform float uOpacity;
  uniform float uTime;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    float facing = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);
    float rim = pow(1.0 - facing, 2.2);
    vec3 base = mix(uColor, uGold, uGoldMix);
    float shimmer = 0.92 + 0.08 * sin(uTime * 2.3);
    vec3 color = base * (0.75 + 0.85 * rim) * shimmer;
    float alpha = uOpacity * (0.3 + 0.7 * rim);
    gl_FragColor = vec4(color, alpha);
  }
`;

export class GhostHand {
  readonly root = new Group();
  private readonly models: Record<Handedness, { obj: Object3D; bones: (Bone | undefined)[] }>;
  private active: Handedness = 'right';
  private readonly material: ShaderMaterial;
  private readonly armatureInv = new Matrix4();
  private readonly tmp = new Matrix4();
  private visibleFlag = true;
  /** A soft light at the master's fingertip: where the brush is. */
  readonly tipGlow: Sprite;
  private readonly glowMaterial: SpriteMaterial;

  constructor() {
    this.material = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color(0.78, 0.9, 1.0) },
        uGold: { value: new Color(1.0, 0.78, 0.32) },
        uGoldMix: { value: 0 },
        uOpacity: { value: 0.7 },
        uTime: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    const depthOnly = new MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true });

    const build = (handedness: Handedness) => {
      const gltf = AssetManager.getGLTF(`hand-${handedness}`);
      if (!gltf) throw new Error(`Ghost hand model hand-${handedness} not loaded`);
      const obj = gltf.scene;
      const bones = JOINT_NAMES.map((n) => obj.getObjectByName(n) as Bone | undefined);
      obj.traverse((o) => {
        const sk = o as SkinnedMesh;
        if (sk.isSkinnedMesh) {
          sk.frustumCulled = false;
          sk.material = depthOnly;
          sk.renderOrder = 20;
          const front = sk.clone();
          front.material = this.material;
          front.renderOrder = 21;
          sk.parent?.add(front);
        }
      });
      bones.forEach((b) => b && (b.matrixAutoUpdate = true));
      obj.visible = handedness === this.active;
      this.root.add(obj);
      return { obj, bones };
    };
    this.models = { left: build('left'), right: build('right') };

    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    this.glowMaterial = new SpriteMaterial({
      map: new CanvasTexture(c),
      color: new Color(0.75, 0.9, 1),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    this.tipGlow = new Sprite(this.glowMaterial);
    this.tipGlow.scale.setScalar(0.03);
    this.tipGlow.renderOrder = 22;
    this.root.add(this.tipGlow);
  }

  get handedness(): Handedness {
    return this.active;
  }

  setHandedness(h: Handedness): void {
    if (h === this.active) return;
    this.active = h;
    this.models.left.obj.visible = this.visibleFlag && h === 'left';
    this.models.right.obj.visible = this.visibleFlag && h === 'right';
  }

  set visible(v: boolean) {
    this.visibleFlag = v;
    this.tipGlow.visible = v;
    this.models.left.obj.visible = v && this.active === 'left';
    this.models.right.obj.visible = v && this.active === 'right';
  }

  get visible(): boolean {
    return this.visibleFlag;
  }

  set opacity(v: number) {
    this.material.uniforms.uOpacity.value = v;
  }

  get opacity(): number {
    return this.material.uniforms.uOpacity.value as number;
  }

  /** 0 = pale spirit blue, 1 = gold (in unison with the learner). */
  set gold(v: number) {
    this.material.uniforms.uGoldMix.value = v;
    this.glowMaterial.color.setRGB(0.75 + 0.25 * v, 0.9 - 0.15 * v, 1 - 0.65 * v);
    this.tipGlow.scale.setScalar(0.03 + 0.025 * v);
  }

  tick(time: number): void {
    this.material.uniforms.uTime.value = time;
    this.glowMaterial.opacity = Math.min(1, this.opacity * 1.2) * (0.85 + 0.15 * Math.sin(time * 4));
  }

  /** Drive the active hand from 25 world joint matrices (WebXR joint order). */
  setJoints(world: Float32Array): void {
    const model = this.models[this.active];
    const armature = model.bones[0]?.parent;
    if (!armature) return;
    armature.updateWorldMatrix(true, false);
    this.armatureInv.copy(armature.matrixWorld).invert();
    for (let i = 0; i < JOINT_COUNT; i++) {
      const bone = model.bones[i];
      if (!bone) continue;
      this.tmp.fromArray(world, i * 16).premultiply(this.armatureInv);
      this.tmp.decompose(bone.position, bone.quaternion, bone.scale);
    }
    // Index fingertip (joint 9), in world space; root sits at the world origin.
    this.tipGlow.position.set(world[9 * 16 + 12], world[9 * 16 + 13], world[9 * 16 + 14]);
  }
}

/**
 * Blend two sets of world joint matrices: out = lerp(a, b, t) per joint
 * (positions linear, rotations spherical). Allocation-free after construction.
 */
export class JointBlender {
  private readonly pa = new Vector3();
  private readonly pb = new Vector3();
  private readonly qa = new Quaternion();
  private readonly qb = new Quaternion();
  private readonly sa = new Vector3();
  private readonly ma = new Matrix4();
  private readonly mb = new Matrix4();

  blend(a: Float32Array, b: Float32Array, t: number, out: Float32Array): void {
    for (let i = 0; i < JOINT_COUNT; i++) {
      this.ma.fromArray(a, i * 16).decompose(this.pa, this.qa, this.sa);
      this.mb.fromArray(b, i * 16).decompose(this.pb, this.qb, this.sa);
      this.pa.lerp(this.pb, t);
      this.qa.slerp(this.qb, t);
      this.sa.set(1, 1, 1);
      this.ma.compose(this.pa, this.qa, this.sa).toArray(out, i * 16);
    }
  }
}
