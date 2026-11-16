// TEMPLATE: play many AI-vs-AI games to sanity-check the rules and estimate match length.
// Adapt to your rules module (this example uses a race-board game's PATHS/HOME/isBoardCell).
// Copy to <repo>/scripts/sim-rules.ts; run with Node >= 22: node scripts/sim-rules.ts
import * as R from '../src/game/rules.ts';

const p = R.PATHS[0];
const uniq = new Set(p.map(([c, r]) => c * 100 + r));
console.log('path length', p.length, 'unique', uniq.size, 'HOME', R.HOME);
for (const [c, r] of p) if (!R.isBoardCell(c, r)) throw new Error(`off board ${c},${r}`);
for (let i = 1; i < p.length; i++) {
  const d = Math.max(Math.abs(p[i][0] - p[i - 1][0]), Math.abs(p[i][1] - p[i - 1][1]));
  if (d !== 1) throw new Error(`gap at ${i}`);
}
let throws = 0, wins = [0, 0], caps = 0;
const N = 2000;
for (let g = 0; g < N; g++) {
  const s = R.newGame();
  let guard = 0;
  while (s.winner === null && guard++ < 500) {
    const faces = R.honestThrow();
    throws++;
    const m = R.bestMove(s, s.turn, R.rollTotal(faces));
    caps += m.captures.length;
    R.applyMove(s, m, faces);
  }
  wins[s.winner!]++;
}
console.log('avg throws/game', (throws / N).toFixed(1), 'wins', wins, 'captures/game', (caps / N).toFixed(2));
const s = R.newGame();
console.log('loaded throw from start', R.loadedThrow(s, 0));

// Regression: the human (seat 0, falsy) winning must not pass the turn.
{
  const s = R.newGame();
  s.pos[0][0] = R.HOME - 3;
  const m = R.legalMoves(s, 0, 5).find((x) => x.piece === 0)!;
  const res = R.applyMove(s, m, [1, 2, 2]);
  if (res.winner !== 0 || s.turn !== 0 || res.extraTurn) throw new Error('seat-0 win passed the turn');
  console.log('seat-0 win keeps turn: ok');
}
