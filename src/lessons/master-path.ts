import type { Point2, Stroke } from './lessons.js';

/** Side of the character box on paper, in metres. */
export const CHAR_SIZE = 0.2;

/**
 * One stroke laid out on the paper (paper-local metres: x right, z toward the
 * writer) with cumulative arc length, so the master's hand can be sampled at
 * any moment of the stroke.
 */
export class StrokePath {
  readonly xs: Float32Array;
  readonly zs: Float32Array;
  readonly cum: Float32Array;
  readonly length: number;

  constructor(readonly stroke: Stroke) {
    const n = stroke.points.length;
    this.xs = new Float32Array(n);
    this.zs = new Float32Array(n);
    this.cum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [u, v] = stroke.points[i];
      this.xs[i] = (u - 0.5) * CHAR_SIZE;
      this.zs[i] = (v - 0.5) * CHAR_SIZE;
      if (i > 0) {
        this.cum[i] =
          this.cum[i - 1] +
          Math.hypot(this.xs[i] - this.xs[i - 1], this.zs[i] - this.zs[i - 1]);
      }
    }
    this.length = this.cum[n - 1];
  }

  /** Stroke duration in seconds at the given tempo (1 = master speed). */
  duration(tempo: number): number {
    return (0.35 + this.length / 0.1) / tempo;
  }

  /**
   * Position at normalised time t (0..1). Calligraphy timing: a short press
   * at the start, a steady travel, and a settle at the end.
   */
  sampleAtTime(t: number, out: { x: number; z: number }): void {
    const c = Math.min(1, Math.max(0, t));
    const eased = c < 0.1 ? 0 : 0.5 - 0.5 * Math.cos(Math.PI * ((c - 0.1) / 0.9));
    this.sampleAtFraction(eased, out);
  }

  /** Position at a fraction (0..1) of the arc length. */
  sampleAtFraction(f: number, out: { x: number; z: number }): void {
    const target = Math.min(1, Math.max(0, f)) * this.length;
    const n = this.cum.length;
    let i = 1;
    while (i < n - 1 && this.cum[i] < target) i++;
    const a = this.cum[i - 1];
    const span = this.cum[i] - a || 1;
    const k = Math.min(1, Math.max(0, (target - a) / span));
    out.x = this.xs[i - 1] + (this.xs[i] - this.xs[i - 1]) * k;
    out.z = this.zs[i - 1] + (this.zs[i] - this.zs[i - 1]) * k;
  }

  get startX(): number {
    return this.xs[0];
  }
  get startZ(): number {
    return this.zs[0];
  }
  get endX(): number {
    return this.xs[this.xs.length - 1];
  }
  get endZ(): number {
    return this.zs[this.zs.length - 1];
  }
}

export const toPaper = ([u, v]: Point2): Point2 => [
  (u - 0.5) * CHAR_SIZE,
  (v - 0.5) * CHAR_SIZE,
];
