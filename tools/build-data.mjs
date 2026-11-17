#!/usr/bin/env node
// Builds the app's static data from third-party sources (run: npm run data).
//
// 1. KanjiVG stroke paths (tools/kanjivg/*.svg, CC BY-SA 3.0, (c) Ulrich Apel and
//    contributors, https://kanjivg.tagaini.net) -> src/lessons/strokes.json.
//    Each stroke becomes a polyline in normalised coordinates (0..1, y down),
//    resampled evenly along its length, in the original stroke order.
// 2. The "point" hand pose from IWER (MIT, (c) Meta Platforms) ->
//    src/ghost/point-pose.json: 25 joint matrices (left hand, column-major).

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIEWBOX = 109;

// ---------- SVG path parsing (M L H V C S Q T Z, absolute + relative) ----------
function tokenize(d) {
  const re = /([MmLlHhVvCcSsQqTtZz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;
  const out = [];
  let m;
  while ((m = re.exec(d))) out.push(m[1] ?? Number(m[2]));
  return out;
}

function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

function pathToPolyline(d) {
  const tk = tokenize(d);
  const pts = [];
  let i = 0;
  let cmd = '';
  let cur = [0, 0];
  let start = [0, 0];
  let lastCtrl = null;
  const num = () => tk[i++];
  const seg = (p0, c1, c2, p3) => {
    for (let s = 1; s <= 16; s++) pts.push(cubic(p0, c1, c2, p3, s / 16));
  };
  while (i < tk.length) {
    if (typeof tk[i] === 'string') cmd = tk[i++];
    const rel = cmd === cmd.toLowerCase();
    const o = rel ? cur : [0, 0];
    switch (cmd.toUpperCase()) {
      case 'M': {
        cur = [o[0] + num(), o[1] + num()];
        start = cur;
        pts.push(cur);
        cmd = rel ? 'l' : 'L';
        lastCtrl = null;
        break;
      }
      case 'L': {
        cur = [o[0] + num(), o[1] + num()];
        pts.push(cur);
        lastCtrl = null;
        break;
      }
      case 'H': {
        cur = [(rel ? cur[0] : 0) + num(), cur[1]];
        pts.push(cur);
        lastCtrl = null;
        break;
      }
      case 'V': {
        cur = [cur[0], (rel ? cur[1] : 0) + num()];
        pts.push(cur);
        lastCtrl = null;
        break;
      }
      case 'C': {
        const c1 = [o[0] + num(), o[1] + num()];
        const c2 = [o[0] + num(), o[1] + num()];
        const p = [o[0] + num(), o[1] + num()];
        seg(cur, c1, c2, p);
        lastCtrl = c2;
        cur = p;
        break;
      }
      case 'S': {
        const c1 = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
        const c2 = [o[0] + num(), o[1] + num()];
        const p = [o[0] + num(), o[1] + num()];
        seg(cur, c1, c2, p);
        lastCtrl = c2;
        cur = p;
        break;
      }
      case 'Q':
      case 'T':
        throw new Error(`Quadratic path commands are not used by KanjiVG: ${d}`);
      case 'Z': {
        cur = start;
        pts.push(cur);
        lastCtrl = null;
        break;
      }
      default:
        throw new Error(`Unsupported path command ${cmd}`);
    }
  }
  return pts;
}

function resample(pts, spacing) {
  const out = [pts[0]];
  let carry = 0;
  for (let k = 1; k < pts.length; k++) {
    let [ax, ay] = pts[k - 1];
    const [bx, by] = pts[k];
    let segLen = Math.hypot(bx - ax, by - ay);
    while (carry + segLen >= spacing) {
      const t = (spacing - carry) / segLen;
      ax += (bx - ax) * t;
      ay += (by - ay) * t;
      out.push([ax, ay]);
      segLen = Math.hypot(bx - ax, by - ay);
      carry = 0;
    }
    carry += segLen;
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > spacing * 0.25) out.push(last);
  return out;
}

const round = (v) => Math.round(v * 10000) / 10000;

const kanjiDir = join(root, 'tools/kanjivg');
const characters = {};
for (const file of readdirSync(kanjiDir).filter((f) => f.endsWith('.svg')).sort()) {
  const svg = readFileSync(join(kanjiDir, file), 'utf8');
  const glyph = /kvg:element="([^"]+)"/.exec(svg)[1];
  const strokes = [];
  // Kana have no kvg:type, so the type is optional.
  const re = /<path id="kvg:[0-9a-f]+-s(\d+)"(?: kvg:type="([^"]*)")? d="([^"]+)"/g;
  let m;
  while ((m = re.exec(svg))) {
    const poly = resample(pathToPolyline(m[3]), 1.5).map(([x, y]) => [
      round(x / VIEWBOX),
      round(y / VIEWBOX),
    ]);
    strokes.push({ order: Number(m[1]), type: m[2] ?? '', points: poly });
  }
  strokes.sort((a, b) => a.order - b.order);
  characters[glyph] = { codepoint: file.replace('.svg', ''), strokes };
}
// ---------- English italic letters and words (tools/latin-letters.mjs, original) ----------
const { LETTERS, ADVANCE, DEFAULT_ADVANCE } = await import(pathToFileURL(join(root, 'tools/latin-letters.mjs')).href);
const SLANT = 0.12; // italic lean, about 7 degrees
const WORDS = ['hi', 'ink', 'art', 'moon', 'love', 'hand'];
function latinStrokes(glyphs) {
  const adv = [...glyphs].map((g) => ADVANCE[g] ?? DEFAULT_ADVANCE);
  const total = adv.reduce((a, b) => a + b, 0);
  // Single letters a little larger than a word's letters, to fill the practice box.
  const scale = glyphs.length === 1 ? 1.3 : Math.min(1, 80 / total);
  const out = [];
  let offset = 0;
  [...glyphs].forEach((g, k) => {
    const letter = LETTERS[g];
    if (!letter) throw new Error(`No letter ${g}`);
    const cx = glyphs.length === 1 ? 50 : 50 + (offset + adv[k] / 2 - total / 2) * scale;
    offset += adv[k];
    for (const st of letter.strokes) {
      const pts = pathToPolyline(st.d).map(([x, y]) => [x + (55 - y) * SLANT, y]);
      const placed = pts.map(([x, y]) => [cx + (x - 50) * scale, 55 + (y - 55) * scale]);
      const poly = resample(placed, 1.3 * scale).map(([x, y]) => [round(x / 100), round(y / 100)]);
      out.push({ order: out.length + 1, type: st.type, points: poly });
    }
  });
  return out;
}
for (const g of Object.keys(LETTERS)) characters[g] = { codepoint: 'latin', strokes: latinStrokes(g) };
for (const w of WORDS) characters[w] = { codepoint: 'latin', strokes: latinStrokes(w) };

writeFileSync(
  join(root, 'src/lessons/strokes.json'),
  JSON.stringify(
    {
      source: 'CJK and kana: KanjiVG (https://kanjivg.tagaini.net), CC BY-SA 3.0, (c) Ulrich Apel and contributors. Latin letters: original (tools/latin-letters.mjs). Converted to polylines by tools/build-data.mjs.',
      characters,
    },
    null,
    0,
  ) + '\n',
);
console.log('strokes.json:', Object.entries(characters).map(([g, c]) => `${g}:${c.strokes.length}`).join(' '));

// ---------- IWER point pose ----------
const posePath = join(root, 'node_modules/iwer/lib/device/configs/hand/point.js');
const { pointHandPose } = await import(pathToFileURL(posePath).href);
const JOINTS = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
];
const matrices = JOINTS.map((j) => Array.from(pointHandPose.jointTransforms[j].offsetMatrix, (v) => Math.round(v * 1e6) / 1e6));
writeFileSync(
  join(root, 'src/ghost/point-pose.json'),
  JSON.stringify(
    {
      source: 'IWER point hand pose (MIT, (c) Meta Platforms, Inc.), left hand, column-major 4x4 per joint.',
      joints: JOINTS,
      matrices,
    },
    null,
    0,
  ) + '\n',
);
console.log('point-pose.json: joints', JOINTS.length);
