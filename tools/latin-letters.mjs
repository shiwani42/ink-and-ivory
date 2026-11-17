// Lowercase italic letters for English calligraphy, drawn for this project
// (original work, same licence as the app). Each letter is a list of pen
// strokes in writing order, as SVG paths (M L C only) in a 100 x 100 box,
// y down: x-height 40..70, ascenders from 16, descenders to 88.
// tools/build-data.mjs slants them (italic), resamples and normalises them.
//
// Ductus follows the italic hand: stems and arches in one stroke, branching
// from inside the stem (n m h r b p), bowls written counter-clockwise from the
// top right (a d g q c e o), small exit hooks at the baseline.

const exit = (x) => `C${x} 70 ${x + 3} 71 ${x + 7} 67`; // baseline exit hook from (x, 66)

export const LETTERS = {
  i: { strokes: [{ type: 'stem', d: `M50 40 L50 66 ${exit(50)}` }, { type: 'dot', d: 'M50 29 L51 31.5' }] },
  l: { strokes: [{ type: 'stem', d: `M50 16 L50 66 ${exit(50)}` }] },
  t: { strokes: [{ type: 'stem', d: `M50 26 L50 66 ${exit(50)}` }, { type: 'crossbar', d: 'M42 40 L59 40' }] },
  j: { strokes: [{ type: 'stem', d: 'M53 40 L53 80 C53 89 45 91 39 86' }, { type: 'dot', d: 'M53 29 L54 31.5' }] },
  o: { strokes: [{ type: 'bowl', d: 'M56 41 C45 37 40 49 40 57 C40 66 45 71 51 70 C58 69 61 60 60 51 C59 45 58 42 56 41' }] },
  c: { strokes: [{ type: 'bowl', d: 'M59 43 C55 38 43 39 41 51 C39 63 45 71 52 70 C56 70 59 67 61 64' }] },
  e: { strokes: [{ type: 'bowl', d: 'M42 57 C49 56 56 53 59 49 C61 43 53 38 47 41 C41 45 40 57 42 63 C45 71 55 71 61 65' }] },
  a: {
    strokes: [
      { type: 'bowl', d: 'M58 44 C53 38 43 41 41 53 C40 63 45 70 50 69 C55 68 58 60 59 50' },
      { type: 'stem', d: `M59 40 L59 66 ${exit(59)}` },
    ],
  },
  d: {
    strokes: [
      { type: 'bowl', d: 'M57 44 C52 38 42 41 40 53 C39 63 44 70 49 69 C54 68 57 60 58 50' },
      { type: 'stem', d: `M59 16 L59 66 ${exit(59)}` },
    ],
  },
  g: {
    strokes: [
      { type: 'bowl', d: 'M57 44 C52 38 42 41 40 53 C39 63 44 70 49 69 C54 68 57 60 58 50' },
      { type: 'tail', d: 'M59 40 L59 80 C59 89 50 92 42 86' },
    ],
  },
  q: {
    strokes: [
      { type: 'bowl', d: 'M57 44 C52 38 42 41 40 53 C39 63 44 70 49 69 C54 68 57 60 58 50' },
      { type: 'tail', d: 'M59 40 L59 88 L63 85' },
    ],
  },
  n: { strokes: [{ type: 'arch', d: `M43 40 L43 70 L43 53 C46 43 57 39 58 50 L58 66 ${exit(58)}` }] },
  m: {
    strokes: [{ type: 'arch', d: `M36 40 L36 70 L36 53 C38 43 47 40 48 50 L48 70 L48 53 C50 43 59 40 60 50 L60 66 ${exit(60)}` }],
  },
  h: { strokes: [{ type: 'arch', d: `M43 16 L43 70 L43 53 C46 43 57 39 58 50 L58 66 ${exit(58)}` }] },
  r: { strokes: [{ type: 'arch', d: 'M46 40 L46 70 L46 53 C48 44 54 40 60 43' }] },
  u: { strokes: [{ type: 'arch', d: `M43 40 L43 60 C43 70 55 72 57 58 L57 40 L57 66 ${exit(57)}` }] },
  y: {
    strokes: [
      { type: 'arch', d: 'M43 40 L43 59 C43 69 55 71 57 58' },
      { type: 'tail', d: 'M57 40 L57 80 C57 89 48 92 41 86' },
    ],
  },
  v: { strokes: [{ type: 'diagonal', d: 'M41 40 L50 70 L59 40' }] },
  w: { strokes: [{ type: 'diagonal', d: 'M35 40 L42 70 L49 47 L56 70 L64 40' }] },
  x: { strokes: [{ type: 'diagonal', d: 'M42 40 L58 70' }, { type: 'diagonal', d: 'M58 40 L42 70' }] },
  z: { strokes: [{ type: 'diagonal', d: 'M42 41 L58 41 L42 69 L59 69' }] },
  k: { strokes: [{ type: 'stem', d: 'M44 16 L44 70' }, { type: 'diagonal', d: `M57 41 L45 56 L56 66 ${exit(56)}` }] },
  b: { strokes: [{ type: 'bowl', d: 'M44 16 L44 68 C49 72 59 69 59 56 C59 45 50 39 44 49' }] },
  p: {
    strokes: [
      { type: 'stem', d: 'M44 40 L44 88' },
      { type: 'bowl', d: 'M44 51 C47 42 58 39 59 51 C60 63 52 72 44 66' },
    ],
  },
  f: {
    strokes: [
      { type: 'stem', d: 'M60 20 C55 14 48 16 48 26 L48 80 C48 88 44 91 39 88' },
      { type: 'crossbar', d: 'M40 41 L57 41' },
    ],
  },
  s: { strokes: [{ type: 'curve', d: 'M58 43 C54 38 44 39 44 46 C44 53 58 54 58 62 C58 70 47 72 41 66' }] },
};

/** Letter widths for word layout, in box units (each letter is centred on x = 50). */
export const ADVANCE = {
  i: 14, l: 14, t: 18, j: 18, f: 20, r: 18,
  m: 30, w: 32,
};
export const DEFAULT_ADVANCE = 24;
