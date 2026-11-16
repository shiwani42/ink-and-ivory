import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import { CHAR_SIZE } from '../lessons/master-path.js';

/**
 * The writing set that sits on the learner's real desk, all in paper-local
 * coordinates (origin at the paper centre on its surface, x right, y up,
 * z toward the writer):
 * - a dark felt mat (shitajiki), which makes the paper read clearly against any table;
 * - washi paper with a faint vermilion practice grid around the character box;
 * - a paperweight bar (bunchin) along the far edge;
 * - an inkstone to the right;
 * - a red seal on the paper's near corner: touched once to calibrate contact
 *   height, then stamped when a character is complete.
 * Geometry is low-poly and shares materials; nothing casts real-time shadows.
 */

export const PAPER_W = 0.26;
export const PAPER_D = 0.34;
export const MAT_W = 0.31;
export const MAT_D = 0.41;
export const SURFACE_Y = 0.0042; // paper top above the desk
export const SEAL_X = 0.088;
export const SEAL_Z = 0.138;

function paperTexture(): CanvasTexture {
  const w = 520;
  const h = Math.round((w * PAPER_D) / PAPER_W);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f3ede1';
  ctx.fillRect(0, 0, w, h);
  // Washi fibres.
  for (let i = 0; i < 900; i++) {
    ctx.strokeStyle = `rgba(150,130,100,${(0.03 + Math.random() * 0.07).toFixed(3)})`;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath();
    const x = Math.random() * w;
    const y = Math.random() * h;
    const a = Math.random() * Math.PI * 2;
    const l = 4 + Math.random() * 18;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a + 0.6) * l * 0.5,
      y + Math.sin(a + 0.6) * l * 0.5,
      x + Math.cos(a) * l,
      y + Math.sin(a) * l,
    );
    ctx.stroke();
  }
  // Practice grid (mizige): box, centre cross and diagonals, faint vermilion.
  const px = w / PAPER_W;
  const box = CHAR_SIZE * px * 1.06;
  const cx = w / 2;
  const cy = h / 2;
  ctx.strokeStyle = 'rgba(200,70,45,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - box / 2, cy - box / 2, box, box);
  ctx.setLineDash([7, 7]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(200,70,45,0.3)';
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

function sealTexture(): CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b8281c';
  ctx.beginPath();
  ctx.roundRect(4, 4, s - 8, s - 8, 18);
  ctx.fill();
  // A carved, abstract seal mark (no text: a geometric "master's chop").
  ctx.strokeStyle = '#f3e6d6';
  ctx.lineWidth = 7;
  ctx.strokeRect(22, 22, s - 44, s - 44);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(40, 46);
  ctx.lineTo(88, 46);
  ctx.moveTo(64, 46);
  ctx.lineTo(64, 90);
  ctx.moveTo(42, 68);
  ctx.lineTo(86, 68);
  ctx.moveTo(44, 90);
  ctx.lineTo(84, 90);
  ctx.stroke();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function softDiscTexture(): CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.55, '#bbb');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new CanvasTexture(c);
}

export interface DeskSet {
  root: Group; // positioned on the real desk; panels may be parented here
  body: Group; // the physical set (animated on arrival)
  paper: Group; // ink and guides go here, y = 0 is the paper surface
  seal: Mesh;
  sealRing: Mesh;
  stamp: Mesh; // the imprint left after a finished character
  cursor: Mesh; // where your fingertip will touch: shrinks and darkens as you approach
  virtualTable: Mesh; // shown only when no real desk was found
}

export function createDeskSet(): DeskSet {
  const root = new Group();
  root.name = 'desk-root';
  const body = new Group();
  root.add(body);

  const felt = new MeshStandardMaterial({ color: new Color('#1b2130'), roughness: 1, metalness: 0 });
  const mat = new Mesh(new BoxGeometry(MAT_W, 0.003, MAT_D), felt);
  mat.position.y = 0.0015;
  body.add(mat);

  const paperMat = new MeshStandardMaterial({ map: paperTexture(), roughness: 0.95, metalness: 0 });
  const paperMesh = new Mesh(new PlaneGeometry(PAPER_W, PAPER_D), paperMat);
  paperMesh.rotation.x = -Math.PI / 2;
  paperMesh.position.y = SURFACE_Y - 0.0002;
  body.add(paperMesh);

  const paper = new Group();
  paper.position.y = SURFACE_Y;
  body.add(paper);

  // Paperweight bar along the far edge.
  const weightMat = new MeshStandardMaterial({ color: new Color('#2a2420'), roughness: 0.45, metalness: 0.3 });
  const weight = new Mesh(new BoxGeometry(PAPER_W * 0.86, 0.009, 0.013), weightMat);
  weight.position.set(0, SURFACE_Y + 0.0045, -PAPER_D / 2 + 0.012);
  body.add(weight);

  // Inkstone with a dark well, to the right of the mat.
  const stoneMat = new MeshStandardMaterial({ color: new Color('#33363a'), roughness: 0.6, metalness: 0.05 });
  const stone = new Mesh(new BoxGeometry(0.065, 0.016, 0.105), stoneMat);
  stone.position.set(MAT_W / 2 + 0.05, 0.008, -0.07);
  body.add(stone);
  const well = new Mesh(
    new CylinderGeometry(0.022, 0.022, 0.002, 24),
    new MeshStandardMaterial({ color: new Color('#050505'), roughness: 0.15, metalness: 0.2 }),
  );
  well.position.set(MAT_W / 2 + 0.05, 0.0162, -0.095);
  body.add(well);

  // Seal: calibration target, later the "finished" stamp.
  const seal = new Mesh(
    new PlaneGeometry(0.03, 0.03),
    new MeshBasicMaterial({ map: sealTexture(), transparent: true, toneMapped: false }),
  );
  seal.rotation.x = -Math.PI / 2;
  seal.position.set(SEAL_X, SURFACE_Y + 0.0004, SEAL_Z);
  body.add(seal);
  const sealRing = new Mesh(
    new RingGeometry(0.024, 0.028, 40),
    new MeshBasicMaterial({ color: new Color('#ff6a3d'), transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }),
  );
  sealRing.rotation.x = -Math.PI / 2;
  sealRing.position.set(SEAL_X, SURFACE_Y + 0.0006, SEAL_Z);
  body.add(sealRing);

  const stamp = new Mesh(
    new PlaneGeometry(0.034, 0.034),
    new MeshBasicMaterial({ map: (seal.material as MeshBasicMaterial).map, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
  );
  stamp.rotation.x = -Math.PI / 2;
  stamp.position.set(-0.085, SURFACE_Y + 0.0005, 0.135);
  stamp.visible = false;
  body.add(stamp);

  const cursor = new Mesh(
    new RingGeometry(0.0035, 0.0055, 32),
    new MeshBasicMaterial({ color: new Color('#3a2a20'), transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false }),
  );
  cursor.rotation.x = -Math.PI / 2;
  cursor.position.y = SURFACE_Y + 0.0012;
  cursor.visible = false;
  cursor.renderOrder = 6;
  body.add(cursor);

  // Fallback table, for rooms where no desk plane is found.
  const virtualTable = new Mesh(
    new BoxGeometry(0.8, 0.03, 0.55),
    new MeshStandardMaterial({ color: new Color('#6d4c33'), roughness: 0.7, metalness: 0 }),
  );
  virtualTable.position.set(0.05, -0.015, -0.02);
  virtualTable.visible = false;
  root.add(virtualTable);

  // Soft dark disc under the set (a cheap contact shadow that works on any surface).
  const shadow = new Mesh(
    new CircleGeometry(0.3, 40),
    new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      alphaMap: softDiscTexture(),
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.75, 0.9, 1);
  shadow.position.y = 0.0004;
  shadow.renderOrder = -1;
  body.add(shadow);

  return { root, body, paper, seal, sealRing, stamp, cursor, virtualTable };
}
