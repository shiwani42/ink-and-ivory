import { HIGH_MIDI, idOf, LOW_MIDI, type PianoNote, type PianoSong } from './songs.js';

/**
 * The learner's own song, in the last slot of the piano list. It comes from
 * one of two places:
 * - **Play your own tune:** the learner plays freely on the keyboard; when
 *   they stop, the master "learns" it (timing quantised to half beats) and
 *   teaches it back like any other song.
 * - **A MIDI file** added on the start page (for example a public-domain
 *   piece from the Mutopia Project). The melody is taken as the highest note
 *   of each chord, moved by octaves into the keyboard's range.
 * Saved in localStorage, so it is still there next time.
 */

export const CUSTOM_ID = 'piano-custom';
const STORAGE_KEY = 'hoam-custom-song-v1';
const MAX_NOTES = 40;

export function loadCustomSong(): PianoSong | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const song = JSON.parse(raw) as PianoSong;
    return song?.notes?.length ? { ...song, id: CUSTOM_ID } : undefined;
  } catch {
    return undefined;
  }
}

export function clearCustomSong(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

export function saveCustomSong(song: PianoSong): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(song));
  } catch {
    // Private mode or storage full: the song still works for this session.
  }
}

/** Keep names short and in the panel font. */
function cleanName(name: string): string {
  const n = name.replace(/\.(mid|midi)$/i, '').replace(/[_-]+/g, ' ').replace(/[^\x20-\x7EÀ-ÿ]/g, '').trim();
  return (n || 'Your song').slice(0, 18);
}

/** Round to half beats, between half a beat and three beats. */
function quantise(beats: number): number {
  return Math.min(3, Math.max(0.5, Math.round(beats * 2) / 2));
}

/** A tune the learner played: key ids with press times in seconds. */
export function songFromRecording(taps: { midi: number; t: number }[]): PianoSong | undefined {
  if (taps.length < 3) return undefined;
  const gaps: number[] = [];
  for (let i = 1; i < taps.length; i++) gaps.push(taps[i].t - taps[i - 1].t);
  // The most common gap is the beat: the median is robust to a long pause.
  const sorted = [...gaps].sort((a, b) => a - b);
  const beat = Math.min(1.2, Math.max(0.3, sorted[Math.floor(sorted.length / 2)]));
  const notes: PianoNote[] = taps.map((tap, i) => ({
    note: idOf(tap.midi),
    beats: i < gaps.length ? quantise(gaps[i] / beat) : 2,
  }));
  return {
    id: CUSTOM_ID,
    name: 'Your tune',
    teaching: 'The tune you played. The master learned it from you.',
    bpm: Math.round(60 / beat),
    notes,
  };
}

/** Move a melody by whole octaves so as many notes as possible fit the keyboard, then fold the rest in. */
function fitRange(midis: number[]): number[] {
  let bestShift = 0;
  let bestFit = -1;
  for (let k = -4; k <= 4; k++) {
    const fit = midis.filter((m) => m + 12 * k >= LOW_MIDI && m + 12 * k <= HIGH_MIDI).length;
    if (fit > bestFit || (fit === bestFit && Math.abs(k) < Math.abs(bestShift))) {
      bestFit = fit;
      bestShift = k;
    }
  }
  return midis.map((m) => {
    let x = m + 12 * bestShift;
    while (x < LOW_MIDI) x += 12;
    while (x > HIGH_MIDI) x -= 12;
    return x;
  });
}

/**
 * Standard MIDI file (format 0 or 1) to a single-line melody.
 * Returns an error message for files it cannot use.
 */
export function songFromMidi(data: ArrayBuffer, fileName: string): PianoSong | string {
  const b = new DataView(data);
  const u8 = new Uint8Array(data);
  const str = (o: number) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  if (u8.length < 14 || str(0) !== 'MThd') return 'That is not a MIDI file.';
  const tracks = b.getUint16(10);
  const division = b.getUint16(12);
  if (division & 0x8000) return 'This MIDI file uses SMPTE timing, which is not supported.';
  let usPerQuarter = 500000;
  let tempoSet = false;
  const onsets: { tick: number; midi: number }[] = [];
  let p = 8 + b.getUint32(4);
  for (let t = 0; t < tracks && p + 8 <= u8.length; t++) {
    if (str(p) !== 'MTrk') break;
    const end = p + 8 + b.getUint32(p + 4);
    p += 8;
    let tick = 0;
    let status = 0;
    const vlq = () => {
      let v = 0;
      for (let i = 0; i < 4 && p < end; i++) {
        const c = u8[p++];
        v = (v << 7) | (c & 0x7f);
        if (!(c & 0x80)) break;
      }
      return v;
    };
    while (p < end) {
      tick += vlq();
      let s = u8[p];
      if (s & 0x80) p++;
      else s = status; // running status
      if (s === 0xff) {
        const type = u8[p++];
        const len = vlq();
        if (type === 0x51 && len === 3 && !tempoSet) {
          usPerQuarter = (u8[p] << 16) | (u8[p + 1] << 8) | u8[p + 2];
          tempoSet = true;
        }
        p += len;
        continue;
      }
      if (s === 0xf0 || s === 0xf7) {
        p += vlq();
        continue;
      }
      status = s;
      const kind = s & 0xf0;
      const channel = s & 0x0f;
      if (kind === 0xc0 || kind === 0xd0) {
        p += 1;
      } else {
        const d1 = u8[p];
        const d2 = u8[p + 1];
        p += 2;
        if (kind === 0x90 && d2 > 0 && channel !== 9) onsets.push({ tick, midi: d1 });
      }
    }
    p = end;
  }
  if (onsets.length < 3) return 'No melody found in that file.';
  // Skyline: the highest note of each chord is the melody.
  onsets.sort((a, b2) => a.tick - b2.tick || b2.midi - a.midi);
  const together = Math.max(1, division / 16);
  const melody: { tick: number; midi: number }[] = [];
  for (const o of onsets) {
    const last = melody[melody.length - 1];
    if (last && o.tick - last.tick <= together) continue;
    melody.push(o);
    if (melody.length >= MAX_NOTES) break;
  }
  const midis = fitRange(melody.map((m) => m.midi));
  const notes: PianoNote[] = melody.map((m, i) => ({
    note: idOf(midis[i]),
    beats: i < melody.length - 1 ? Math.min(3, Math.max(0.25, Math.round(((melody[i + 1].tick - m.tick) / division) * 4) / 4)) : 2,
  }));
  return {
    id: CUSTOM_ID,
    name: cleanName(fileName),
    teaching: 'Your song, from a MIDI file. The melody line, one note at a time.',
    bpm: Math.round(Math.min(110, Math.max(40, 60000000 / usPerQuarter))),
    notes,
  };
}
