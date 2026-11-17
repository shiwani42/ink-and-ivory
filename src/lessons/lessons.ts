import strokeData from './strokes.json';

/**
 * The calligraphy course: short lessons grouped into units, like a language
 * course. Each unit builds on the last; practice is what teaches the hand.
 *
 * - Japanese and Chinese share the characters and stroke order (KanjiVG,
 *   CC BY-SA 3.0; see strokes.json) with their own readings. Japanese also
 *   learns hiragana, interleaved with the kanji units.
 * - English is italic lettering with a broad nib, from single letters by
 *   family (straight, round, bowls, arches, diagonals) to short words. The
 *   letter paths are original (tools/latin-letters.mjs).
 *
 * UI text stays in plain ASCII: the panel font has no CJK glyphs, and the
 * character itself is shown as ink on the paper.
 */

export type Point2 = [number, number];

export interface Stroke {
  /** Polyline in character space: 0..1, x right, y down (toward the writer). */
  points: Point2[];
  /** English name of the stroke type, for captions. */
  name: string;
}

export interface Lesson {
  id: string;
  glyph: string;
  reading: string;
  meaning: string;
  teaching: string;
  strokes: Stroke[];
  /** Lettering paper only: ruled lines (ascender, waist, baseline, descender), 0..1 down the box. */
  guides?: number[];
}

export interface Unit {
  title: string;
  /** Index of the unit's first lesson in the flat lesson list. */
  start: number;
  count: number;
}

/** KanjiVG stroke types (first part, before any variant letter) and the Latin pen strokes. */
const STROKE_NAMES: Record<string, string> = {
  '㇐': 'horizontal',
  '㇑': 'vertical',
  '㇒': 'left sweep',
  '㇓': 'left sweep',
  '㇏': 'right fall',
  '㇔': 'dot',
  '㇀': 'rising stroke',
  '㇕': 'horizontal turn',
  '㇆': 'turn and hook',
  '㇚': 'vertical hook',
  '㇖': 'horizontal hook',
  '㇇': 'turn and sweep',
  '㇙': 'vertical rise',
  '㇛': 'bent sweep',
  '㇜': 'bent sweep',
  '㇟': 'curved hook',
  '㇄': 'vertical turn',
  '㇗': 'vertical turn',
  '㇂': 'slanting hook',
  '㇃': 'hook',
  '㇈': 'turn and hook',
  '㇉': 'zigzag',
  '㇋': 'zigzag',
  '㇌': 'zigzag',
  '㇞': 'zigzag',
  stem: 'downstroke',
  dot: 'dot',
  crossbar: 'crossbar',
  bowl: 'bowl',
  tail: 'tail',
  arch: 'arch',
  diagonal: 'diagonal',
  curve: 'curve',
};

function strokeName(type: string): string {
  const head = type.split('/')[0].replace(/[a-z]$/, '');
  return STROKE_NAMES[head] ?? STROKE_NAMES[type] ?? 'stroke';
}

interface RawStroke {
  type: string;
  points: Point2[];
}

const characters = (
  strokeData as unknown as { characters: Record<string, { strokes: RawStroke[]; guides?: number[] }> }
).characters;

function strokesOf(glyph: string): Stroke[] {
  const c = characters[glyph];
  if (!c) throw new Error(`No stroke data for ${glyph}`);
  return c.strokes.map((s) => ({ points: s.points, name: strokeName(s.type) }));
}

export type Language = 'japanese' | 'chinese' | 'english';

export const LANGUAGES: Record<Language, { name: string; scene: string; note: string }> = {
  japanese: { name: 'Japanese', scene: 'japan', note: 'Shodo, the way of writing' },
  chinese: { name: 'Chinese', scene: 'china', note: 'Shufa, the art of the brush' },
  english: { name: 'English', scene: 'english', note: 'Italic lettering with a broad nib' },
};

// ---------------------------------------------------------------- CJK

/** [id, glyph, Japanese reading, Mandarin reading, meaning, teaching] */
type CjkRow = [string, string, string, string, string, string];

const FIRST: CjkRow[] = [
  ['one', '一', 'ichi', 'yi', 'one', 'One horizontal line. Press in, travel, settle.'],
  ['two', '二', 'ni', 'er', 'two', 'Short above, long below. Top to bottom.'],
  ['ten', '十', 'ju', 'shi', 'ten', 'Horizontal first, then the vertical through it.'],
  ['person', '人', 'hito', 'ren', 'person', 'Sweep left, then fall right.'],
  ['big', '大', 'dai', 'da', 'big', 'A person with arms spread wide.'],
  ['eternity', '永', 'ei', 'yong', 'eternity', 'Five strokes that hold all eight principles of the brush.'],
];

const NUMBERS: CjkRow[] = [
  ['three', '三', 'san', 'san', 'three', 'Three lines, the last the longest. Top to bottom.'],
  ['four', '四', 'yon', 'si', 'four', 'Left side, then the top and right in one turn, then inside, then close the box.'],
  ['five', '五', 'go', 'wu', 'five', 'Top line, the short vertical, the turn, then the long base.'],
  ['six', '六', 'roku', 'liu', 'six', 'The dot crowns it; the two legs open outward.'],
  ['seven', '七', 'nana', 'qi', 'seven', 'A rising line, then a vertical that turns and runs right.'],
  ['eight', '八', 'hachi', 'ba', 'eight', 'Two strokes that part like an open door.'],
  ['nine', '九', 'kyu', 'jiu', 'nine', 'The sweep first, then the turn and hook.'],
  ['hundred', '百', 'hyaku', 'bai', 'hundred', 'One line over a box with a line inside it.'],
  ['thousand', '千', 'sen', 'qian', 'thousand', 'A short sweep, a horizontal, then the vertical.'],
];

const NATURE: CjkRow[] = [
  ['sun', '日', 'hi', 'ri', 'sun', 'Left side, top and right, the middle line, then close the base.'],
  ['moon', '月', 'tsuki', 'yue', 'moon', 'A sweeping left side, the hooked right, then two lines inside.'],
  ['mountain', '山', 'yama', 'shan', 'mountain', 'The tall centre peak first, then the left, then the right.'],
  ['river', '川', 'kawa', 'chuan', 'river', 'Three currents, left to right; the first one bends.'],
  ['tree', '木', 'ki', 'mu', 'tree', 'Branch, trunk, then roots sweeping left and right.'],
  ['water', '水', 'mizu', 'shui', 'water', 'The hooked centre first, then the left, then the right fall.'],
  ['fire', '火', 'hi', 'huo', 'fire', 'Two sparks, then the flame sweeps out left and right.'],
  ['earth', '土', 'tsuchi', 'tu', 'earth', 'Short line, the vertical, then the long ground.'],
  ['stone', '石', 'ishi', 'shi', 'stone', 'A cliff edge and its sweep, then a stone below.'],
];

const PEOPLE: CjkRow[] = [
  ['child', '子', 'ko', 'zi', 'child', 'A turn, a hooked body, then the arms.'],
  ['woman', '女', 'onna', 'nu', 'woman', 'A bent sweep, a crossing sweep, then the long line.'],
  ['man', '男', 'otoko', 'nan', 'man', 'A rice field above, strength below.'],
  ['mouth', '口', 'kuchi', 'kou', 'mouth', 'Left side, top and right in one turn, then close the base.'],
  ['eye', '目', 'me', 'mu', 'eye', 'A tall box with two lines inside, closed last.'],
  ['hand', '手', 'te', 'shou', 'hand', 'A short sweep, two lines, then the hooked vertical.'],
  ['ear', '耳', 'mimi', 'er', 'ear', 'Lines first, then the long vertical through them.'],
  ['heart', '心', 'kokoro', 'xin', 'heart', 'A dot, the curved hook, then two more dots.'],
  ['strength', '力', 'chikara', 'li', 'strength', 'The turn and hook first, then the sweep across it.'],
];

const PLACES: CjkRow[] = [
  ['up', '上', 'ue', 'shang', 'up', 'The vertical, a short line, then the base.'],
  ['down', '下', 'shita', 'xia', 'down', 'The top line, the vertical, then the dot.'],
  ['middle', '中', 'naka', 'zhong', 'middle', 'A box, then the vertical straight through its middle.'],
  ['small', '小', 'chii', 'xiao', 'small', 'The hooked centre, then the dots left and right.'],
  ['left', '左', 'hidari', 'zuo', 'left', 'The line first, then the sweep, then the work below.'],
  ['right', '右', 'migi', 'you', 'right', 'The sweep first, then the line, then a mouth below.'],
  ['king', '王', 'o', 'wang', 'king', 'Three lines joined by one vertical: heaven, people, earth.'],
  ['field', '田', 'ta', 'tian', 'rice field', 'A frame, a cross inside, then close it.'],
  ['book', '本', 'hon', 'ben', 'book', 'A tree with a mark at its root: the origin.'],
];

const SKY: CjkRow[] = [
  ['sky', '天', 'ten', 'tian', 'heaven', 'Two lines, then a person spreading wide beneath.'],
  ['rain', '雨', 'ame', 'yu', 'rain', 'The sky, its frame, then four raindrops.'],
  ['empty-sky', '空', 'sora', 'kong', 'sky', 'A roof, eight below it, then work at the base.'],
  ['flower', '花', 'hana', 'hua', 'flower', 'Grass on top, then a person changing below.'],
  ['bamboo', '竹', 'take', 'zhu', 'bamboo', 'Two stalks side by side, each with its leaves.'],
  ['grove', '林', 'hayashi', 'lin', 'grove', 'Two trees; the left one gives way to the right.'],
  ['forest', '森', 'mori', 'sen', 'forest', 'Three trees: one above, two below.'],
  ['spring', '春', 'haru', 'chun', 'spring', 'Three lines and a person over the sun.'],
];

/** [romaji, glyph, teaching] for hiragana. */
const KANA: [string, string, string][][] = [
  [
    ['a', 'あ', 'The line, the long curve down, then one loop.'],
    ['i', 'い', 'Two strokes, the left one longer, with a small hook.'],
    ['u', 'う', 'A short dash, then a curve like an ear.'],
    ['e', 'え', 'A dash, then a zigzag that sweeps out.'],
    ['o', 'お', 'A line, a vertical with a loop, then a dot.'],
    ['ka', 'か', 'A hooked turn, a slanting line, then a dot.'],
    ['ki', 'き', 'Two lines, a slant, then a curve below.'],
    ['ku', 'く', 'One bent line, like an open beak.'],
    ['ke', 'け', 'A vertical, then a line and a long sweep.'],
  ],
  [
    ['ko', 'こ', 'Two short curves, one above the other.'],
    ['sa', 'さ', 'A line, a slant, then a curve below.'],
    ['shi', 'し', 'One stroke: down and curve up to the right.'],
    ['su', 'す', 'A line, then a vertical with one loop.'],
    ['se', 'せ', 'A line, a hooked vertical, then a turn.'],
    ['so', 'そ', 'One flowing zigzag.'],
    ['ta', 'た', 'A cross, then two short lines.'],
    ['chi', 'ち', 'A line, then a curve like the number 5.'],
    ['tsu', 'つ', 'One wide curve, like a wave.'],
  ],
  [
    ['te', 'て', 'A line that bends down and round.'],
    ['to', 'と', 'A short slant, then a curve.'],
    ['na', 'な', 'A cross, a dot, then a loop below.'],
    ['ni', 'に', 'A vertical, then two short curves.'],
    ['nu', 'ぬ', 'A slant, then a crossing loop.'],
    ['ne', 'ね', 'A vertical, then a zigzag with a loop.'],
    ['no', 'の', 'One stroke: a slant that circles round.'],
  ],
];

const cjk = (rows: CjkRow[], lang: 'japanese' | 'chinese'): Lesson[] =>
  rows.map(([id, glyph, ja, zh, meaning, teaching]) => ({
    id: lang === 'chinese' ? `zh-${id}` : id,
    glyph,
    reading: lang === 'chinese' ? zh : ja,
    meaning,
    teaching,
    strokes: strokesOf(glyph),
  }));

const kana = (rows: [string, string, string][]): Lesson[] =>
  rows.map(([romaji, glyph, teaching]) => ({
    id: `kana-${romaji}`,
    glyph,
    reading: 'hiragana',
    meaning: romaji,
    teaching,
    strokes: strokesOf(glyph),
  }));

// ---------------------------------------------------------------- English

/** [letters, teaching] for the italic units. */
const LATIN: [string, string, Record<string, string>][] = [
  [
    'Straight strokes',
    'Hold the nib at one angle the whole time: downstrokes come out thick.',
    {
      i: 'Pull the stem straight down, flick out at the baseline, then the dot.',
      l: 'A tall stem from the ascender line, with a small exit at the base.',
      t: 'A shorter stem, then the crossbar at the waist.',
      j: 'Down below the baseline and curl left, then the dot.',
      f: 'Over the top, down past the baseline, then the crossbar.',
    },
  ],
  [
    'Round letters',
    'Round letters start at the top right and travel left and down.',
    {
      o: 'One oval, counter-clockwise from the top. Close it gently.',
      c: 'An o that stays open on the right.',
      e: 'Start in the middle, loop up and over, then round the bottom.',
      s: 'A spine that curves left, then right.',
    },
  ],
  [
    'Bowls and stems',
    'A bowl, then a stem: two strokes that meet.',
    {
      a: 'The bowl from the top right, then the stem down the right side.',
      d: 'The same bowl, then a tall stem.',
      g: 'The bowl, then a stem that drops below and curls left.',
      q: 'The bowl, then a straight stem down with a small flick.',
    },
  ],
  [
    'Arches',
    'Arches spring out of the stem, two thirds of the way up.',
    {
      n: 'Down, back up the stem, then one arch.',
      m: 'Two arches, the same height and width.',
      h: 'A tall stem, then the arch of n.',
      r: 'Down, back up, and a short shoulder.',
      u: 'An upside-down arch, then the stem.',
      y: 'The cup of u, then a tail that drops and curls.',
      b: 'A tall stem that rounds into a bowl.',
      p: 'A long stem down, then the bowl from its top.',
    },
  ],
  [
    'Diagonals',
    'Diagonals change thickness as they turn: watch the nib do the work.',
    {
      v: 'Down to the baseline and up again.',
      w: 'Two v shapes joined.',
      x: 'Two crossing lines, the thick one first.',
      z: 'Across, down to the left, across again.',
      k: 'A tall stem, then the arm and leg.',
    },
  ],
];

const WORDS: [string, string][] = [
  ['hi', 'Your first word: two letters, five strokes.'],
  ['ink', 'Three letters. Keep them the same height.'],
  ['art', 'A bowl, an arch, a stem.'],
  ['moon', 'Arches and ovals in a row. Space them evenly.'],
  ['love', 'A stem, an oval, a diagonal, a loop.'],
  ['hand', 'Two arches and two bowls: the hand of a scribe.'],
];

function english(): { lessons: Lesson[]; units: [string, number][] } {
  const lessons: Lesson[] = [];
  const units: [string, number][] = [];
  for (const [title, intro, letters] of LATIN) {
    units.push([title, Object.keys(letters).length]);
    for (const [g, teaching] of Object.entries(letters)) {
      lessons.push({
        id: `en-${g}`,
        glyph: g,
        reading: 'italic',
        meaning: `letter ${g}`,
        teaching: lessons.length === 0 ? `${intro} ${teaching}` : teaching,
        strokes: strokesOf(g),
        guides: characters[g].guides,
      });
    }
  }
  units.push(['Words', WORDS.length]);
  for (const [w, teaching] of WORDS) {
    lessons.push({ id: `en-word-${w}`, glyph: w, reading: 'word', meaning: w, teaching, strokes: strokesOf(w), guides: characters[w].guides });
  }
  return { lessons, units };
}

// ---------------------------------------------------------------- courses

function course(parts: [string, Lesson[]][]): { lessons: Lesson[]; units: Unit[] } {
  const lessons: Lesson[] = [];
  const units: Unit[] = [];
  for (const [title, list] of parts) {
    units.push({ title, start: lessons.length, count: list.length });
    lessons.push(...list);
  }
  return { lessons, units };
}

const JA = course([
  ['First strokes', cjk(FIRST, 'japanese')],
  ['Hiragana: a to ke', kana(KANA[0])],
  ['Numbers', cjk(NUMBERS, 'japanese')],
  ['Hiragana: ko to tsu', kana(KANA[1])],
  ['Nature', cjk(NATURE, 'japanese')],
  ['Hiragana: te to no', kana(KANA[2])],
  ['People', cjk(PEOPLE, 'japanese')],
  ['Places and sizes', cjk(PLACES, 'japanese')],
  ['Sky and seasons', cjk(SKY, 'japanese')],
]);

const ZH = course([
  ['First strokes', cjk(FIRST, 'chinese')],
  ['Numbers', cjk(NUMBERS, 'chinese')],
  ['Nature', cjk(NATURE, 'chinese')],
  ['People', cjk(PEOPLE, 'chinese')],
  ['Places and sizes', cjk(PLACES, 'chinese')],
  ['Sky and seasons', cjk(SKY, 'chinese')],
]);

const EN = (() => {
  const { lessons, units } = english();
  let start = 0;
  return {
    lessons,
    units: units.map(([title, count]) => {
      const u = { title, start, count };
      start += count;
      return u;
    }),
  };
})();

/** The first unit (ends with 永): also the 2D page's looping demonstration. */
export const LESSONS: Lesson[] = JA.lessons.slice(0, FIRST.length);

export const LESSON_SETS: Record<Language, Lesson[]> = {
  japanese: JA.lessons,
  chinese: ZH.lessons,
  english: EN.lessons,
};

export const UNITS: Record<Language, Unit[]> = {
  japanese: JA.units,
  chinese: ZH.units,
  english: EN.units,
};
