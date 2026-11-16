import strokeData from './strokes.json';

/**
 * Lesson ladder. Each character builds on the last and ends with 永 ("ei",
 * eternity), the classic teaching character whose five strokes contain the
 * Eight Principles of brushwork.
 *
 * Stroke geometry comes from KanjiVG (CC BY-SA 3.0); see strokes.json.
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
}

const STROKE_NAMES: Record<string, string> = {
  '㇐': 'horizontal',
  '㇑': 'vertical',
  '㇒': 'left sweep',
  '㇏': 'right fall',
  '㇔': 'dot',
  '㇆/㇚': 'turn and hook',
  '㇇': 'turn and sweep',
};

interface RawStroke {
  type: string;
  points: Point2[];
}

const characters = (
  strokeData as unknown as { characters: Record<string, { strokes: RawStroke[] }> }
).characters;

function strokesOf(glyph: string): Stroke[] {
  const c = characters[glyph];
  if (!c) throw new Error(`No stroke data for ${glyph}`);
  return c.strokes.map((s) => ({
    points: s.points,
    name: STROKE_NAMES[s.type] ?? 'stroke',
  }));
}

const def = (
  id: string,
  glyph: string,
  reading: string,
  meaning: string,
  teaching: string,
): Lesson => ({ id, glyph, reading, meaning, teaching, strokes: strokesOf(glyph) });

export type Language = 'japanese' | 'chinese';

export const LANGUAGES: Record<Language, { name: string; scene: string; note: string }> = {
  japanese: { name: 'Japanese', scene: 'japan', note: 'Shodo, the way of writing' },
  chinese: { name: 'Chinese', scene: 'china', note: 'Shufa, the art of the brush' },
};

export const LESSONS: Lesson[] = [
  def('one', '一', 'ichi', 'one', 'One horizontal line. Press in, travel, settle.'),
  def('two', '二', 'ni', 'two', 'Short above, long below. Top to bottom.'),
  def('ten', '十', 'ju', 'ten', 'Horizontal first, then the vertical through it.'),
  def('person', '人', 'hito', 'person', 'Sweep left, then fall right.'),
  def('big', '大', 'dai', 'big', 'A person with arms spread wide.'),
  def(
    'eternity',
    '永',
    'ei',
    'eternity',
    'Five strokes that hold all eight principles of the brush.',
  ),
];

/** Chinese uses the same characters and stroke order, with Mandarin readings. */
const CHINESE_READINGS: Record<string, [string, string]> = {
  one: ['yi', 'One horizontal line, the first lesson of every child in China.'],
  two: ['er', 'Short above, long below. Top to bottom.'],
  ten: ['shi', 'Horizontal first, then the vertical through it.'],
  person: ['ren', 'Two strokes leaning on each other: a person.'],
  big: ['da', 'A person with arms spread wide.'],
  eternity: ['yong', 'Yong: the eight principles of the brush in one character.'],
};

export const LESSON_SETS: Record<Language, Lesson[]> = {
  japanese: LESSONS,
  chinese: LESSONS.map((l) => ({
    ...l,
    id: `zh-${l.id}`,
    reading: CHINESE_READINGS[l.id][0],
    teaching: CHINESE_READINGS[l.id][1],
  })),
};
