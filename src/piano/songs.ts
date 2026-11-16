/**
 * Piano lessons: short public-domain melodies within one keyboard (A3 to E5),
 * right hand, played one note at a time. Beats are quarter notes.
 * The ladder opens with the song everyone knows (Happy Birthday), then
 * teaches the keyboard itself: the white keys, sharps and flats, before more
 * songs that use them. All public domain.
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
  /** Name black keys as flats (Bb) rather than sharps (A#). */
  flats?: boolean;
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
    // Mildred and Patty Hill's melody, public domain (US 2016, EU 2017).
    // In F, so it ends on the learner's first black key: B-flat.
    id: 'piano-birthday',
    name: 'Happy Birthday',
    teaching: 'The song everyone knows. Near the end comes your first black key, B-flat.',
    bpm: 84,
    flats: true,
    notes: seq('C4:0.5 C4:0.5 D4 C4 F4 E4:2 C4:0.5 C4:0.5 D4 C4 G4 F4:2 C4:0.5 C4:0.5 C5 A4 F4 E4 D4:2 As4:0.5 As4:0.5 A4 F4 G4 F4:2'),
  },
  {
    id: 'piano-white',
    name: 'The white keys',
    teaching: 'Every C sits just left of a pair of black keys. Walk up C D E F G A B to the next C, and back down.',
    bpm: 80,
    notes: seq('C4 D4 E4 F4 G4 A4 B4 C5:2 B4 A4 G4 F4 E4 D4 C4:2'),
  },
  {
    id: 'piano-sharps',
    name: 'Sharps',
    teaching: 'A sharp (#) is the very next key up, to the right: usually a black key. There is no black key between E and F.',
    bpm: 72,
    notes: seq('C4 Cs4 D4 Ds4 E4:2 F4 Fs4 G4 Gs4 A4 As4 B4 C5:2'),
  },
  {
    id: 'piano-flats',
    name: 'Flats',
    teaching: 'A flat (b) is the very next key down, to the left. The same black key has two names: A-sharp is B-flat.',
    bpm: 72,
    flats: true,
    notes: seq('B4 As4 A4:2 E4 Ds4 D4:2 A4 Gs4 G4:2 D4 Cs4 C4:2'),
  },
  {
    id: 'piano-twinkle',
    name: 'Twinkle',
    teaching: 'A French folk tune the whole world knows. White keys only.',
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
    // Beethoven, 1810 (public domain). The opening phrase with its second
    // ending, right hand, in its own key and octave.
    id: 'piano-elise',
    name: 'Für Elise',
    teaching: 'Beethoven, 1810. Rock between E and D-sharp, then walk down to A. Your sharps at work.',
    bpm: 60,
    notes: seq('E5:0.5 Ds5:0.5 E5:0.5 Ds5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1.5 C4:0.5 E4:0.5 A4:0.5 B4:1.5 E4:0.5 C5:0.5 B4:0.5 A4:2'),
  },
  {
    id: 'piano-sakura',
    name: 'Sakura',
    teaching: 'Sakura Sakura, a Japanese folk song about cherry blossom.',
    bpm: 66,
    notes: seq('A4 A4 B4:2 A4 A4 B4:2 A4 B4 C5 B4 A4 B4:0.5 A4:0.5 F4:2 E4 C4 E4 F4 E4 E4:0.5 C4:0.5 B3:2'),
  },
];

/** Playable range of the keyboard (MIDI). */
export const LOW_MIDI = 57; // A3
export const HIGH_MIDI = 76; // E5

const NOTE_NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];

/** Key id for a MIDI number, e.g. 61 -> 'Cs4'. */
export function idOf(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

const NOTE_INDEX: Record<string, number> = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };

/** MIDI number for ids like 'C4', 'Fs4', 'As3'. */
export function midiOf(id: string): number {
  const m = /^([A-G]s?)(\d)$/.exec(id);
  if (!m) throw new Error(`bad note ${id}`);
  return 12 * (Number(m[2]) + 1) + NOTE_INDEX[m[1]];
}

const FLAT_OF: Record<string, string> = { Cs: 'Db', Ds: 'Eb', Fs: 'Gb', Gs: 'Ab', As: 'Bb' };

/** Display name of a key id without the octave: 'Cs4' -> 'C#' (or 'Db' with flats). */
export function noteName(id: string, flats = false): string {
  const pitch = id.replace(/\d$/, '');
  if (pitch.endsWith('s')) return flats ? FLAT_OF[pitch] : `${pitch[0]}#`;
  return pitch;
}
