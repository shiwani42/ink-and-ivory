import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from '@iwsdk/core';

/**
 * Dresses the player's REAL table as a royal one: a velvet cover cut to the detected
 * table outline, a wide gold zari border, a draped skirt with soft folds over every edge,
 * a gold hem and a tassel fringe. The real table stays the play surface (and its edge is
 * still where you hide the dice) — it just stops looking like modern furniture.
 * On desktop, where there is no real table, carved legs complete it.
 */

function topTexture(): CanvasTexture {
  const W = 1024;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#4a0c16';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    // velvet pile
    g.fillStyle = `rgba(${110 + Math.random() * 60},${16 + Math.random() * 14},${28 + Math.random() * 18},0.07)`;
    g.fillRect(Math.random() * W, Math.random() * H, 2, 5);
  }
  const gold = '#d4a24a';
  // wide zari border: two rules + a band of interlocking lozenges and dots
  const b = 70;
  g.strokeStyle = gold;
  g.lineWidth = 10;
  g.strokeRect(18, 18, W - 36, H - 36);
  g.lineWidth = 4;
  g.strokeRect(b + 18, b + 18, W - 2 * (b + 18), H - 2 * (b + 18));
  g.fillStyle = gold;
  const band = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.floor(len / 46);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.strokeRect(-11, -11, 22, 22);
      g.restore();
      g.beginPath();
      g.arc(x, y, 3.5, 0, Math.PI * 2);
      g.fill();
    }
  };
  const m = 18 + b / 2;
  band(m, m, W - m, m);
  band(m, H - m, W - m, H - m);
  band(m, m, m, H - m);
  band(W - m, m, W - m, H - m);
  // corner rosettes
  for (const [x, y] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) {
    for (let k = 0; k < 8; k++) {
      g.save();
      g.translate(x, y);
      g.rotate((k / 8) * Math.PI * 2);
      g.beginPath();
      g.ellipse(0, -16, 6, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  // scattered buta in the field
  g.globalAlpha = 0.55;
  for (let x = 200; x < W - 160; x += 120)
    for (let y = 200; y < H - 160; y += 120) {
      g.beginPath();
      g.ellipse(x + ((y / 120) % 2) * 60, y, 7, 12, 0.5, 0, Math.PI * 2);
      g.fill();
    }
  g.globalAlpha = 1;
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function skirtTexture(): CanvasTexture {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#560e1a');
  grd.addColorStop(1, '#3a0811');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#d4a24a';
  g.fillRect(0, 0, W, 10); // top piping
  g.fillRect(0, H - 46, W, 30); // hem band
  g.fillStyle = '#7a1420';
  for (let x = 0; x < W; x += 32) {
    g.beginPath();
    g.moveTo(x, H - 31);
    g.lineTo(x + 16, H - 46);
    g.lineTo(x + 32, H - 31);
    g.lineTo(x + 16, H - 16);
    g.closePath();
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  return t;
}

export class TableDressing {
  readonly group = new Group();
  private top: Mesh;
  private skirt: Mesh;
  private fringe: InstancedMesh;
  private legs = new Group();
  private readonly velvet: MeshPhysicalMaterial;
  private readonly skirtMat: MeshPhysicalMaterial;
  private readonly gold = new MeshStandardMaterial({ color: '#d6a347', metalness: 0.9, roughness: 0.32 });
  private readonly dummy = new Object3D();

  constructor() {
    this.group.name = 'table-dressing';
    // deep crimson velvet: darkened base + a muted sheen (a bright sheen read as salmon under warm light)
    this.velvet = new MeshPhysicalMaterial({ map: topTexture(), color: 0x8a5a5a, roughness: 0.9, sheen: 0.6, sheenRoughness: 0.6, sheenColor: 0x7a2030 });
    this.skirtMat = new MeshPhysicalMaterial({ map: skirtTexture(), color: 0x8a5a5a, roughness: 0.9, sheen: 0.6, sheenRoughness: 0.6, sheenColor: 0x7a2030, side: DoubleSide });
    this.top = new Mesh(new BufferGeometry(), this.velvet);
    this.skirt = new Mesh(new BufferGeometry(), this.skirtMat);
    this.fringe = new InstancedMesh(new ConeGeometry(0.006, 0.05, 8), this.gold, 260);
    this.fringe.count = 0;
    this.top.receiveShadow = true;
    this.skirt.receiveShadow = true;
    this.group.add(this.top, this.skirt, this.fringe, this.legs);
    // carved, turned legs (desktop only)
    const prof = [[0.0, 0], [0.035, 0], [0.04, 0.03], [0.028, 0.08], [0.045, 0.16], [0.03, 0.26], [0.022, 0.4], [0.04, 0.5], [0.03, 0.62], [0.045, 0.66], [0.0, 0.67]]
      .map(([r, y]) => new Vector2(r, y));
    const legGeo = new LatheGeometry(prof, 20);
    const wood = new MeshPhysicalMaterial({ color: '#3a1a0c', roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25 });
    for (let i = 0; i < 4; i++) this.legs.add(new Mesh(legGeo, wood));
    this.legs.visible = false;
  }

  /**
   * corners: the table-top outline in the parent's (board) space, 4 points at y≈0,
   * in order around the edge. drop: how far the skirt hangs.
   */
  build(corners: Vector3[], drop: number, withLegs: boolean, tableHeight = 0.72): void {
    // centroid → push the outline out 1 cm so the cloth overhangs the real edge
    const c = corners.reduce((a, p) => a.add(p), new Vector3()).multiplyScalar(1 / corners.length);
    const pts = corners.map((p) => p.clone().sub(c).multiplyScalar(1).add(c));
    pts.forEach((p) => {
      const d = p.clone().sub(c).setY(0);
      p.addScaledVector(d.normalize(), 0.012);
      p.y = 0.0015;
    });
    // top: two triangles, UVs on the rectangle's own axes
    const [a, b, cc, d] = pts;
    const top = new BufferGeometry();
    top.setAttribute('position', new BufferAttribute(new Float32Array([...a.toArray(), ...b.toArray(), ...cc.toArray(), ...d.toArray()]), 3));
    top.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    top.setIndex([0, 2, 1, 0, 3, 2]);
    top.computeVertexNormals();
    if (top.getAttribute('normal').getY(0) < 0) top.setIndex([0, 1, 2, 0, 2, 3]);
    top.computeVertexNormals();
    this.top.geometry.dispose();
    this.top.geometry = top;

    // skirt: each edge hangs `drop` metres with soft folds, flaring slightly outward
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let fringeCount = 0;
    const SEG = 48;
    for (let e = 0; e < 4; e++) {
      const p0 = pts[e];
      const p1 = pts[(e + 1) % 4];
      const edge = p1.clone().sub(p0);
      const len = edge.length();
      const out = new Vector3(edge.z, 0, -edge.x).normalize();
      if (out.dot(p0.clone().sub(c)) < 0) out.negate();
      const base = pos.length / 3;
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG;
        const fold = Math.sin(t * len * 38) * 0.006; // fabric folds
        const top = p0.clone().addScaledVector(edge, t);
        const bot = top.clone().addScaledVector(out, 0.018 + fold).setY(-drop);
        pos.push(...top.toArray(), ...bot.toArray());
        uv.push(t * len * 4, 1, t * len * 4, 0);
        if (i > 0) {
          const k = base + i * 2;
          idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
        }
      }
      // tassel fringe along the hem
      const n = Math.floor(len / 0.04);
      for (let i = 0; i <= n && fringeCount < 260; i++) {
        const t = i / n;
        const fold = Math.sin(t * len * 38) * 0.006;
        const p = p0.clone().addScaledVector(edge, t).addScaledVector(out, 0.018 + fold);
        this.dummy.position.set(p.x, -drop - 0.022, p.z);
        this.dummy.rotation.set(Math.PI, 0, 0);
        this.dummy.updateMatrix();
        this.fringe.setMatrixAt(fringeCount++, this.dummy.matrix);
      }
    }
    const skirt = new BufferGeometry();
    skirt.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    skirt.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    skirt.setIndex(idx);
    skirt.computeVertexNormals();
    this.skirt.geometry.dispose();
    this.skirt.geometry = skirt;
    this.fringe.count = fringeCount;
    this.fringe.instanceMatrix.needsUpdate = true;

    // legs at the corners (inset), from the floor up to the top
    this.legs.visible = withLegs;
    if (withLegs) {
      this.legs.children.forEach((leg, i) => {
        const p = pts[i].clone().lerp(c, 0.1);
        leg.position.set(p.x, -tableHeight, p.z);
        leg.scale.set(1, tableHeight / 0.67, 1);
      });
    }
    this.group.visible = true;
  }
}
