import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  type Texture,
} from '@iwsdk/core';

/**
 * A brush stroke as a flat ribbon lying on the paper (paper-local x/z).
 * Width follows a pressure proxy (slower = wetter, wider), with a tapered
 * entry and exit, and a dry-brush alpha texture along its length.
 * Geometry is preallocated; adding points never allocates.
 */

const MAX_POINTS = 700;
const MIN_STEP = 0.0012; // metres between samples

let brushTexture: Texture | undefined;

function getBrushTexture(): Texture {
  if (brushTexture) return brushTexture;
  const w = 256;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  // Dry-brush streaks: thin gaps that run along the stroke, denser at the edges.
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * h;
    const edge = Math.abs(y / h - 0.5) * 2;
    const alpha = 0.15 + 0.6 * edge * edge * Math.random();
    ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
    const x = Math.random() * w;
    ctx.fillRect(x, y, 30 + Math.random() * 140, 0.6 + Math.random() * 1.4);
  }
  // Soft edges across the width.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.12, 'rgba(0,0,0,0)');
  g.addColorStop(0.88, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.needsUpdate = true;
  brushTexture = tex;
  return tex;
}

export const INK_COLOR = new Color('#15110d');
export const VERMILION = new Color('#d8402a');
export const GOLD = new Color('#f2bf4a');
export const GUIDE_COLOR = new Color('#9a8f86');

export class InkRibbon {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  private readonly positions: Float32Array;
  private readonly uvs: Float32Array;
  private readonly geometry: BufferGeometry;
  private readonly xs = new Float32Array(MAX_POINTS);
  private readonly zs = new Float32Array(MAX_POINTS);
  private readonly ws = new Float32Array(MAX_POINTS);
  private readonly along = new Float32Array(MAX_POINTS);
  count = 0;
  private height: number;

  constructor(color: Color, height = 0.0006, textured = true) {
    this.height = height;
    this.geometry = new BufferGeometry();
    this.positions = new Float32Array(MAX_POINTS * 2 * 3);
    this.uvs = new Float32Array(MAX_POINTS * 2 * 2);
    const index = new Uint16Array((MAX_POINTS - 1) * 6);
    for (let i = 0; i < MAX_POINTS - 1; i++) {
      const a = i * 2;
      index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6);
    }
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('uv', new BufferAttribute(this.uvs, 2));
    this.geometry.setIndex(new BufferAttribute(index, 1));
    this.geometry.setDrawRange(0, 0);
    this.material = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      side: DoubleSide,
      depthWrite: false,
      alphaMap: textured ? getBrushTexture() : null,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      toneMapped: false,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  clear(): void {
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }

  get lastX(): number {
    return this.xs[this.count - 1];
  }
  get lastZ(): number {
    return this.zs[this.count - 1];
  }

  /** Append a point; returns false if it was too close to the previous one. */
  add(x: number, z: number, width: number): boolean {
    if (this.count >= MAX_POINTS) return false;
    if (this.count > 0) {
      const d = Math.hypot(x - this.lastX, z - this.lastZ);
      if (d < MIN_STEP) return false;
      this.along[this.count] = this.along[this.count - 1] + d;
    } else {
      this.along[0] = 0;
    }
    const i = this.count++;
    this.xs[i] = x;
    this.zs[i] = z;
    // Entry taper: the brush lands thin and swells over the first ~8 mm.
    this.ws[i] = width * Math.min(1, 0.45 + this.along[i] / 0.008);
    this.rebuild(Math.max(0, i - 1), i);
    return true;
  }

  /** Exit taper over the last ~1 cm, then refresh those vertices. */
  finish(): void {
    if (this.count < 2) return;
    const end = this.along[this.count - 1];
    let first = this.count - 1;
    for (let i = this.count - 1; i >= 0 && end - this.along[i] < 0.012; i--) {
      const k = (end - this.along[i]) / 0.012;
      this.ws[i] *= 0.35 + 0.65 * k;
      first = i;
    }
    this.rebuild(Math.max(0, first - 1), this.count - 1);
  }

  private rebuild(from: number, to: number): void {
    const n = this.count;
    for (let i = from; i <= to; i++) {
      const prev = Math.max(0, i - 1);
      const next = Math.min(n - 1, i + 1);
      let tx = this.xs[next] - this.xs[prev];
      let tz = this.zs[next] - this.zs[prev];
      const len = Math.hypot(tx, tz) || 1;
      tx /= len;
      tz /= len;
      const half = this.ws[i] * 0.5;
      const nx = -tz * half;
      const nz = tx * half;
      const p = i * 6;
      this.positions[p] = this.xs[i] + nx;
      this.positions[p + 1] = this.height;
      this.positions[p + 2] = this.zs[i] + nz;
      this.positions[p + 3] = this.xs[i] - nx;
      this.positions[p + 4] = this.height;
      this.positions[p + 5] = this.zs[i] - nz;
      const u = this.along[i] * 9;
      const q = i * 4;
      this.uvs[q] = u;
      this.uvs[q + 1] = 0;
      this.uvs[q + 2] = u;
      this.uvs[q + 3] = 1;
    }
    const pos = this.geometry.getAttribute('position') as BufferAttribute;
    const uv = this.geometry.getAttribute('uv') as BufferAttribute;
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    this.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
  }

  /** Fill from a whole polyline at uniform width (used for the tracing guide). */
  setPolyline(xs: ArrayLike<number>, zs: ArrayLike<number>, width: number): void {
    this.clear();
    for (let i = 0; i < xs.length; i++) this.add(xs[i], zs[i], width);
    this.finish();
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
