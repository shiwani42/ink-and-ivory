// TEMPLATE: headless check of a custom dice/physics sim: where do throws land, do they settle,
// and do forced (loaded) faces come up? Adapt the imports to your own modules
// (this example imports DiceSet/rules/board from a board game's src/game/).
// Copy to <repo>/scripts/sim-dice.ts and add to package.json:
//   "test:dice": "esbuild scripts/sim-dice.ts --bundle --platform=node --format=esm --alias:@iwsdk/core=three --outfile=.tmp/sim-dice.mjs && node .tmp/sim-dice.mjs"
const noop = () => {};
const ctx = new Proxy({}, { get: () => noop, set: () => true });
(globalThis as any).document = { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) };

import { Vector3, Quaternion } from 'three';
import { DiceSet } from '../src/game/dice';
import { PASA_FACES } from '../src/game/rules';
import { HALF } from '../src/game/board';

const g = -9.81;
function ballistic(from: Vector3, to: Vector3, t: number) {
  return new Vector3((to.x - from.x) / t, (to.y + 0.015 - from.y - 0.5 * g * t * t) / t, (to.z - from.z) / t);
}
let ok = 0, forcedOk = 0, onCourt = 0;
const N = 300;
const ends: number[][] = [];
for (let k = 0; k < N; k++) {
  const ds = new DiceSet('t');
  const start = new Vector3(0.12 + (Math.random() - 0.5) * 0.1, 0.2 + Math.random() * 0.1, 0.3);
  ds.holdAt(start, new Quaternion(), 0, 0);
  const target = new Vector3(0.145, 0, 0.15);
  target.x += (start.x - target.x) * 0.15;
  target.z += (start.z - target.z) * 0.25;
  const forced = k % 2 ? [0, 1, 2].map(() => Math.floor(Math.random() * 4)) : null;
  ds.release(ballistic(start, target, 0.42), 14 + Math.random() * 6, forced);
  let t = 0;
  while (!ds.allRest && t < 6) { ds.update(1 / 72); t += 1 / 72; }
  if (ds.allRest) ok++;
  if (forced && ds.values.every((v, i) => v === PASA_FACES[forced[i]])) forcedOk++;
  const c = ds.dice.map((d) => d.pos);
  const inCourt = c.every((p) => p.x > 0.04 && p.z > 0.04 && p.x < HALF && p.z < HALF);
  if (inCourt) onCourt++;
  ends.push([t, ...c.flatMap((p) => [+p.x.toFixed(3), +p.z.toFixed(3)])]);
}
console.log(`settled ${ok}/${N}  forced faces honoured ${forcedOk}/${N / 2}  all 3 dice in court ${onCourt}/${N}`);
const ts = ends.map((e) => e[0]).sort((a, b) => a - b);
console.log(`settle time median ${ts[N >> 1].toFixed(2)}s  p90 ${ts[Math.floor(N * 0.9)].toFixed(2)}s`);
// distribution of natural (unforced) faces
const counts: Record<number, number> = { 1: 0, 2: 0, 5: 0, 6: 0 };
for (let k = 0; k < 400; k++) {
  const ds = new DiceSet('u');
  ds.holdAt(new Vector3(0.12, 0.25, 0.3), new Quaternion(), k, 1);
  ds.release(ballistic(new Vector3(0.12, 0.25, 0.3), new Vector3(0.14, 0, 0.17), 0.42), 14 + Math.random() * 6, null);
  for (let t = 0; t < 6 && !ds.allRest; t += 1 / 72) ds.update(1 / 72);
  ds.values.forEach((v) => counts[v]++);
}
console.log('natural face counts (1200 dice):', counts);
if (ok < N || forcedOk < N / 2 || onCourt < N * 0.9) process.exit(1);
