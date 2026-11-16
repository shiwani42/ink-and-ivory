/**
 * Shortcuts that jump straight to a moment, from the page URL. For testing,
 * screenshots and filming the trailer on the headset without replaying the
 * whole journey (an idea from The Nanauts' debug presets, our own code).
 *
 *   ?state=practice&lesson=6               write 永 now, calibration skipped
 *   ?state=watch&craft=piano&lesson=7      the master plays Für Elise
 *   ?state=practice&craft=piano&lesson=1   play Happy Birthday now
 *   ?state=listen                          "Play your own tune"
 *   ?state=watch&lang=chinese              Chinese calligraphy, lesson 1
 *   ?state=fresh                           forget all progress: a first-time visitor
 *   ...&scene=room                         stay in passthrough (no dissolve)
 *
 * The preset applies once, after the paper or keyboard is placed on a table.
 * Unknown values are ignored, so a stray parameter can never break the app.
 */

export type PresetState = 'watch' | 'practice' | 'listen' | 'fresh';

export interface Preset {
  state: PresetState;
  craft?: 'calligraphy' | 'piano';
  /** 0-based index into the lesson or song list. */
  lesson?: number;
  lang?: 'japanese' | 'chinese';
  scene?: 'room' | 'place';
}

const STATES: PresetState[] = ['watch', 'practice', 'listen', 'fresh'];

export function parsePreset(search: string): Preset | undefined {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    return undefined;
  }
  const state = q.get('state') as PresetState | null;
  if (!state || !STATES.includes(state)) return undefined;
  const preset: Preset = { state };
  const craft = q.get('craft');
  if (craft === 'calligraphy' || craft === 'piano') preset.craft = craft;
  if (state === 'listen') preset.craft = 'piano';
  const lesson = Number.parseInt(q.get('lesson') ?? '', 10);
  if (Number.isFinite(lesson) && lesson >= 1 && lesson <= 99) preset.lesson = lesson - 1;
  const lang = q.get('lang');
  if (lang === 'japanese' || lang === 'chinese') preset.lang = lang;
  const scene = q.get('scene');
  if (scene === 'room' || scene === 'place') preset.scene = scene;
  return preset;
}
