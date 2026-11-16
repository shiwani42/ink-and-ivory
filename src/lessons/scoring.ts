import type { StrokePath } from './master-path.js';
import { CHAR_SIZE } from './master-path.js';

/**
 * Per-stroke scoring. Everything is measured in character units (the box is
 * 1 x 1) so the same thresholds work at any paper size. Tolerances are
 * deliberately lenient: Quest hand tracking jitters by a few millimetres and
 * judges should feel encouraged, not punished.
 */

const N = 24;

export interface StrokeAttempt {
  xs: number[]; // paper-local metres
  zs: number[];
  duration: number; // seconds
}

export interface StrokeScore {
  total: number; // 0..100
  path: number; // 0..100
  speed: number; // 0..100
  sync: number; // 0..1, fraction of the stroke spent in step with the master
  pass: boolean;
  gold: boolean;
  verdict: string;
  hint: string;
}

function resample(xs: ArrayLike<number>, zs: ArrayLike<number>): Float32Array {
  const n = xs.length;
  const out = new Float32Array(N * 2);
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
  }
  const total = cum[n - 1] || 1;
  let j = 1;
  for (let k = 0; k < N; k++) {
    const target = (k / (N - 1)) * total;
    while (j < n - 1 && cum[j] < target) j++;
    const a = cum[j - 1];
    const span = cum[j] - a || 1;
    const t = Math.min(1, Math.max(0, (target - a) / span));
    out[k * 2] = (xs[j - 1] + (xs[j] - xs[j - 1]) * t) / CHAR_SIZE;
    out[k * 2 + 1] = (zs[j - 1] + (zs[j] - zs[j - 1]) * t) / CHAR_SIZE;
  }
  return out;
}

function meanDistance(a: Float32Array, b: Float32Array, reverse: boolean): number {
  let sum = 0;
  for (let k = 0; k < N; k++) {
    const m = reverse ? N - 1 - k : k;
    sum += Math.hypot(a[k * 2] - b[m * 2], a[k * 2 + 1] - b[m * 2 + 1]);
  }
  return sum / N;
}

function polyLength(xs: number[], zs: number[]): number {
  let l = 0;
  for (let i = 1; i < xs.length; i++) l += Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
  return l;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export const PASS_SCORE = 55;

export function scoreStroke(
  attempt: StrokeAttempt,
  target: StrokePath,
  others: StrokePath[],
  tempo: number,
  syncFraction: number,
): StrokeScore {
  const user = resample(attempt.xs, attempt.zs);
  const master = resample(target.xs, target.zs);
  const forward = meanDistance(user, master, false);
  const backward = meanDistance(user, master, true);

  const lengthRatio = polyLength(attempt.xs, attempt.zs) / (target.length || 1);
  let path = clamp01(1 - forward / 0.16);
  if (lengthRatio < 0.5) path *= 0.6 + 0.8 * lengthRatio;

  const expected = target.duration(tempo);
  const ratio = attempt.duration / expected;
  const speed = clamp01(1 - Math.abs(Math.log2(Math.max(ratio, 0.05))) / 2);

  const reversed = backward < forward * 0.6 && forward > 0.08;
  let wrongOrder = false;
  for (const other of others) {
    const d = meanDistance(user, resample(other.xs, other.zs), false);
    if (d < forward * 0.6 && d < 0.08) {
      wrongOrder = true;
      break;
    }
  }

  let total = 100 * (0.72 * path + 0.14 * speed + 0.14 * clamp01(syncFraction));
  if (reversed) total = Math.min(total, 35);
  if (wrongOrder) total = Math.min(total, 30);
  total = Math.round(total);

  const pass = total >= PASS_SCORE;
  const gold = pass && syncFraction >= 0.55 && path >= 0.7;

  let hint = '';
  if (wrongOrder) hint = 'Not this stroke yet. Begin at the glowing point.';
  else if (reversed) hint = 'Other direction. Watch where the master begins.';
  else if (lengthRatio < 0.5) hint = 'Carry the stroke all the way to its end.';
  else if (path < 0.55) hint = "Stay closer to the master's path.";
  else if (ratio < 0.6) hint = 'Slower. Let the brush travel with the master.';
  else if (ratio > 2.2) hint = 'A little more flow. Do not hesitate.';

  let verdict: string;
  if (!pass) verdict = 'Try again';
  else if (gold) verdict = 'In unison with the master';
  else if (total >= 85) verdict = 'Beautiful';
  else if (total >= 70) verdict = 'Good stroke';
  else verdict = 'Accepted';

  return {
    total,
    path: Math.round(path * 100),
    speed: Math.round(speed * 100),
    sync: syncFraction,
    pass,
    gold,
    verdict,
    hint,
  };
}
