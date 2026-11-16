/**
 * Piano lessons: short public-domain melodies within one keyboard (A3 to C5),
 * right hand, played one note at a time. Beats are quarter notes.
 */

export interface PianoNote {
  note: string; // key id, e.g. 'C4', 'Fs4'
  beats: number;
}

export interface PianoSong {
  id: string;
  name: string;
  teaching: string;
  bpm: number;
  notes: PianoNote[];
}

const seq = (spec: string): PianoNote[] =>
  spec
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [note, beats] = tok.split(':');
      return { note, beats: beats ? Number(beats) : 1 };
    });

export const SONGS: PianoSong[] = [
  {
    id: 'piano-five',
    name: 'Five fingers',
    teaching: 'Up five keys from C and back down. One key at a time.',
    bpm: 72,
    notes: seq('C4 D4 E4 F4 G4 F4 E4 D4 C4:2'),
  },
  {
    id: 'piano-twinkle',
    name: 'Twinkle',
    teaching: 'A French folk tune the whole world knows.',
    bpm: 84,
    notes: seq('C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2'),
  },
  {
    id: 'piano-ode',
    name: 'Ode to Joy',
    teaching: 'Beethoven, 1824. Mostly neighbouring keys.',
    bpm: 88,
    notes: seq('E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2'),
  },
  {
    id: 'piano-sakura',
    name: 'Sakura',
    teaching: 'Sakura Sakura, a Japanese folk song about cherry blossom.',
    bpm: 66,
    notes: seq('A4 A4 B4:2 A4 A4 B4:2 A4 B4 C5 B4 A4 B4:0.5 A4:0.5 F4:2 E4 C4 E4 F4 E4 E4:0.5 C4:0.5 B3:2'),
  },
];

const NOTE_INDEX: Record<string, number> = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };

/** MIDI number for ids like 'C4', 'Fs4', 'As3'. */
export function midiOf(id: string): number {
  const m = /^([A-G]s?)(\d)$/.exec(id);
  if (!m) throw new Error(`bad note ${id}`);
  return 12 * (Number(m[2]) + 1) + NOTE_INDEX[m[1]];
}
