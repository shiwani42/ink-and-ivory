import {
  AssetManager,
  CanvasTexture,
  CircleGeometry,
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  RepeatWrapping,
  RingGeometry,
  Shape,
  SRGBColorSpace,
  type Texture,
} from '@iwsdk/core';
import { CHAR_SIZE } from '../lessons/master-path.js';

/**
 * The writing set that sits on the learner's real desk, in paper-local
 * coordinates (origin at the paper centre on its surface, x right, y up,
 * z toward the writer).
 *
 * Models are built in Blender by tools/blender/build_assets.py (bamboo and
 * walnut textures: Poly Haven, CC0). Mat and paper use ambientCG CC0 maps.
 * - felt mat (shitajiki) with rounded corners
 * - washi with real fibre normals, a faint vermilion practice grid and a printed seal
 * - walnut paperweight with brass caps along the far edge
 * - inkstone with ink stick and a wet ink pool, a brush on a celadon rest,
 *   a porcelain water dropper
 * - the jade seal and its vermilion paste dish: the seal is stamped for real
 *   when a character is finished
 * Every object gets a soft contact shadow; nothing casts real-time shadows.
 */

export const PAPER_W = 0.26;
export const PAPER_D = 0.34;
export const MAT_W = 0.31;
export const MAT_D = 0.41;
export const SURFACE_Y = 0.0042; // paper top above the desk
export const SEAL_X = 0.088; // printed seal on the paper: the calibration target
export const SEAL_Z = 0.138;
export const STAMP_X = -0.088; // where the finished character is stamped
export const STAMP_Z = 0.138;
export const HANKO_HOME = { x: -0.205, z: 0.135 };

function paperTexture(grid = true): CanvasTexture {
  const w = 640;
  const h = Math.round((w * PAPER_D) / PAPER_W);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  // Warm washi base with a faint deckle tone toward the edges.
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);
  g.addColorStop(0, '#f6f1e6');
  g.addColorStop(1, '#ece3d1');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Long kozo fibres.
  for (let i = 0; i < 1400; i++) {
    ctx.strokeStyle = `rgba(150,128,96,${(0.025 + Math.random() * 0.06).toFixed(3)})`;
    ctx.lineWidth = 0.4 + Math.random() * 0.9;
    ctx.beginPath();
    const x = Math.random() * w;
    const y = Math.random() * h;
    const a = Math.random() * Math.PI * 2;
    const l = 6 + Math.random() * 26;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a + 0.7) * l * 0.5,
      y + Math.sin(a + 0.7) * l * 0.5,
      x + Math.cos(a) * l,
      y + Math.sin(a) * l,
    );
    ctx.stroke();
  }
  if (!grid) {
    // Lettering paper: the ruled lines are drawn per lesson (they depend on the letter size).
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  // Practice grid (mizige): box, centre cross and diagonals, faint vermilion.
  const px = w / PAPER_W;
  const box = CHAR_SIZE * px * 1.06;
  const cx = w / 2;
  const cy = h / 2;
  ctx.strokeStyle = 'rgba(196,72,44,0.55)';
  ctx.lineWidth = 2.2;
  ctx.strokeRect(cx - box / 2, cy - box / 2, box, box);
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(196,72,44,0.28)';
  ctx.beginPath();
  ctx.moveTo(cx - box / 2, cy);
  ctx.lineTo(cx + box / 2, cy);
  ctx.moveTo(cx, cy - box / 2);
  ctx.lineTo(cx, cy + box / 2);
  ctx.moveTo(cx - box / 2, cy - box / 2);
  ctx.lineTo(cx + box / 2, cy + box / 2);
  ctx.moveTo(cx + box / 2, cy - box / 2);
  ctx.lineTo(cx - box / 2, cy + box / 2);
  ctx.stroke();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The seal's imprint: an abstract carved mark (no text), vermilion on washi. */
export function sealTexture(): CanvasTexture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b3261a';
  ctx.beginPath();
  ctx.roundRect(8, 8, s - 16, s - 16, 26);
  ctx.fill();
  ctx.strokeStyle = '#f3e6d6';
  ctx.lineCap = 'round';
  ctx.lineWidth = 12;
  ctx.strokeRect(44, 44, s - 88, s - 88);
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(80, 92);
  ctx.lineTo(176, 92);
  ctx.moveTo(128, 92);
  ctx.lineTo(128, 180);
  ctx.moveTo(84, 136);
  ctx.lineTo(172, 136);
  ctx.moveTo(88, 180);
  ctx.lineTo(168, 180);
  ctx.stroke();
  // Speckle: real seals never print perfectly.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(0,0,0,${(0.2 + Math.random() * 0.6).toFixed(2)})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

let softDisc: CanvasTexture | undefined;
function softDiscTexture(): CanvasTexture {
  if (softDisc) return softDisc;
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.5, '#999');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  softDisc = new CanvasTexture(c);
  return softDisc;
}

/** A soft, contact-style shadow card under an object (w x d metres). */
function contactShadow(w: number, d: number, opacity = 0.35): Mesh {
  const m = new Mesh(
    new PlaneGeometry(w, d),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false, alphaMap: softDiscTexture() }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.0005;
  m.renderOrder = -1;
  return m;
}

function roundedRect(w: number, d: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function tex(id: string, repeat: number, color = false): Texture | null {
  const t = AssetManager.getTexture(id);
  if (!t) return null;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (color) t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function model(id: string): Object3D {
  const gltf = AssetManager.getGLTF(id);
  if (!gltf) throw new Error(`model ${id} not loaded`);
  return gltf.scene;
}

export interface DeskSet {
  root: Group; // positioned on the real desk; panels may be parented here
  body: Group; // the physical set (animated on arrival)
  paper: Group; // ink and guides go here, y = 0 is the paper surface
  seal: Mesh; // printed seal on the paper (calibration target)
  sealRing: Mesh; // pulsing ring: calibration target, then each stroke's start point
  stamp: Mesh; // the imprint left after a finished character
  hanko: Group; // the jade seal itself, animated to stamp the page
  cursor: Mesh; // where your fingertip will touch: shrinks and darkens as you approach
  callig: Group; // the calligraphy set (mat, paper, tools); hidden in piano mode
  brushSet: Group; // inkstone, brush on its rest, water dropper (Japanese, Chinese)
  penSet: Group; // ink bottle, dip pen on its rest (English)
  restingBrush: Object3D; // hidden while the brush is in your hand
  restingPen: Object3D;
  /** Brush paper with the practice grid, or plain lettering paper. */
  setPaper: (style: 'grid' | 'lined') => void;
  virtualTable: Object3D; // shown only when no real desk was found
}

export function createDeskSet(): DeskSet {
  const root = new Group();
  root.name = 'desk-root';
  const body = new Group();
  root.add(body);
  // Everything that belongs to calligraphy (hidden while the piano is out).
  const callig = new Group();
  callig.name = 'calligraphy-set';
  body.add(callig);

  // Felt mat: rounded, 3 mm thick, woven texture tinted deep indigo.
  const matGeo = new ExtrudeGeometry(roundedRect(MAT_W, MAT_D, 0.012), {
    depth: 0.003,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0008,
    bevelSegments: 2,
    curveSegments: 6,
  });
  matGeo.rotateX(-Math.PI / 2);
  // ExtrudeGeometry UVs are in shape units (metres): scale to a sensible repeat.
  const uv = matGeo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 6);
  const felt = new MeshStandardMaterial({
    color: new Color('#3b4258'),
    map: tex('felt-color', 1, true),
    normalMap: tex('felt-normal', 1),
    roughness: 0.96,
    metalness: 0,
  });
  felt.normalScale.set(0.7, 0.7);
  const mat = new Mesh(matGeo, felt);
  callig.add(mat);
  callig.add(contactShadow(MAT_W * 1.25, MAT_D * 1.2, 0.4));

  // Washi: painted colour + grid, real fibre normals and roughness.
  const gridTex = paperTexture(true);
  let plainTex: CanvasTexture | undefined;
  const paperMat = new MeshStandardMaterial({
    map: gridTex,
    normalMap: tex('paper-normal', 2),
    roughnessMap: tex('paper-rough', 2),
    roughness: 1,
    metalness: 0,
  });
  paperMat.normalScale.set(0.35, 0.35);
  const paperMesh = new Mesh(new PlaneGeometry(PAPER_W, PAPER_D), paperMat);
  paperMesh.rotation.x = -Math.PI / 2;
  paperMesh.position.y = SURFACE_Y - 0.0002;
  callig.add(paperMesh);

  const paper = new Group();
  paper.position.y = SURFACE_Y;
  callig.add(paper);

  // Paperweight along the far edge.
  const weight = model('model-paperweight');
  weight.position.set(0, SURFACE_Y - 0.0002, -PAPER_D / 2 + 0.012);
  callig.add(weight);

  // The brush set (Japanese, Chinese) and the pen set (English) share the right side of the mat.
  const brushSet = new Group();
  brushSet.name = 'brush-set';
  callig.add(brushSet);
  const penSet = new Group();
  penSet.name = 'pen-set';
  penSet.visible = false;
  callig.add(penSet);

  // Inkstone with stick and pool (long axis along z), right of the mat.
  const inkstone = model('model-inkstone');
  inkstone.position.set(MAT_W / 2 + 0.06, 0, -0.08);
  inkstone.rotation.y = 0.08;
  brushSet.add(inkstone);
  const sInk = contactShadow(0.11, 0.16, 0.45);
  sInk.position.set(inkstone.position.x, 0.0005, inkstone.position.z);
  brushSet.add(sInk);

  // Brush resting on its celadon rest, tip pointing away from the writer.
  const rest = model('model-brush-rest');
  rest.position.set(MAT_W / 2 + 0.05, 0, 0.1);
  rest.rotation.y = Math.PI / 2;
  brushSet.add(rest);
  const brush = model('model-brush');
  brush.position.set(MAT_W / 2 + 0.05, 0.011, 0.08);
  brush.rotation.y = Math.PI / 2;
  brushSet.add(brush);
  const sBrush = contactShadow(0.05, 0.12, 0.3);
  sBrush.position.set(rest.position.x, 0.0005, 0.09);
  brushSet.add(sBrush);

  // Water dropper, back right.
  const dropper = model('model-water-dropper');
  dropper.position.set(MAT_W / 2 + 0.07, 0, -0.205);
  brushSet.add(dropper);
  const sDrop = contactShadow(0.07, 0.07, 0.4);
  sDrop.position.set(dropper.position.x, 0.0005, dropper.position.z);
  brushSet.add(sDrop);

  // Pen set: a glass ink bottle where the inkstone is, the dip pen on a walnut rest.
  const bottle = model('model-ink-bottle');
  bottle.position.set(MAT_W / 2 + 0.06, 0, -0.07);
  penSet.add(bottle);
  const sBottle = contactShadow(0.07, 0.07, 0.45);
  sBottle.position.set(bottle.position.x, 0.0005, bottle.position.z);
  penSet.add(sBottle);
  const penRest = model('model-pen-rest');
  penRest.position.set(MAT_W / 2 + 0.05, 0, 0.1);
  penSet.add(penRest);
  const pen = model('model-dip-pen');
  pen.position.set(MAT_W / 2 + 0.05, 0.0085, 0.07);
  pen.rotation.y = Math.PI / 2;
  penSet.add(pen);
  const sPen = contactShadow(0.04, 0.13, 0.3);
  sPen.position.set(penRest.position.x, 0.0005, 0.08);
  penSet.add(sPen);

  // Seal and paste dish, left near corner. Split the jade seal out so it can stamp.
  const sealSet = model('model-seal-set');
  sealSet.position.set(HANKO_HOME.x - 0.04, 0, HANKO_HOME.z);
  callig.add(sealSet);
  const hanko = new Group();
  const parts: Object3D[] = [];
  sealSet.traverse((o) => {
    if (o.name === 'seal' || o.name === 'seal_face') parts.push(o);
  });
  for (const p of parts) hanko.add(p); // keep their local offsets inside the set
  hanko.position.set(HANKO_HOME.x - 0.04, 0, HANKO_HOME.z);
  callig.add(hanko);
  const sSeal = contactShadow(0.1, 0.06, 0.35);
  sSeal.position.set(HANKO_HOME.x - 0.02, 0.0005, HANKO_HOME.z);
  callig.add(sSeal);

  // Printed seal on the paper: the calibration target.
  const sealTex = sealTexture();
  const seal = new Mesh(
    new PlaneGeometry(0.026, 0.026),
    new MeshBasicMaterial({ map: sealTex, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }),
  );
  seal.rotation.x = -Math.PI / 2;
  seal.position.set(SEAL_X, SURFACE_Y + 0.0003, SEAL_Z);
  body.add(seal);
  const sealRing = new Mesh(
    new RingGeometry(0.0225, 0.026, 48),
    new MeshBasicMaterial({ color: new Color('#ff6a3d'), transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }),
  );
  sealRing.rotation.x = -Math.PI / 2;
  sealRing.position.set(SEAL_X, SURFACE_Y + 0.0006, SEAL_Z);
  body.add(sealRing);

  const stamp = new Mesh(
    new PlaneGeometry(0.03, 0.03),
    new MeshBasicMaterial({ map: sealTex, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
  );
  stamp.rotation.x = -Math.PI / 2;
  stamp.position.set(STAMP_X, SURFACE_Y + 0.0005, STAMP_Z);
  stamp.visible = false;
  callig.add(stamp);

  const cursor = new Mesh(
    new RingGeometry(0.0035, 0.0055, 32),
    new MeshBasicMaterial({ color: new Color('#3a2a20'), transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false }),
  );
  cursor.rotation.x = -Math.PI / 2;
  cursor.position.y = SURFACE_Y + 0.0012;
  cursor.visible = false;
  cursor.renderOrder = 6;
  body.add(cursor);

  // Fallback walnut table, for rooms where no desk plane is found (top surface at y = 0).
  const virtualTable = model('model-tabletop');
  virtualTable.position.set(0.06, 0, -0.03);
  virtualTable.visible = false;
  root.add(virtualTable);

  const setPaper = (style: 'grid' | 'lined') => {
    if (style === 'lined' && !plainTex) plainTex = paperTexture(false);
    const map = style === 'grid' ? gridTex : plainTex!;
    if (paperMat.map !== map) {
      paperMat.map = map;
      paperMat.needsUpdate = true;
    }
  };

  return {
    root, body, paper, seal, sealRing, stamp, hanko, cursor, callig, virtualTable,
    brushSet, penSet, restingBrush: brush, restingPen: pen, setPaper,
  };
}
