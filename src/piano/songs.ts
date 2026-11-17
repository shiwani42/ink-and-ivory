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

const song = (id: string, name: string, bpm: number, teaching: string, notes: string, flats = false): PianoSong => ({
  id,
  name,
  teaching,
  bpm,
  notes: seq(notes),
  ...(flats ? { flats } : {}),
});

/**
 * The piano course, unit by unit. Every melody is public domain (traditional,
 * or by composers who died long ago); the exercises are original.
 */
export const SONG_UNITS: { title: string; songs: PianoSong[] }[] = [
  {
    title: 'First songs',
    songs: [
      // Mildred and Patty Hill's melody, public domain (US 2016, EU 2017).
      // In F, so it ends on the learner's first black key: B-flat.
      song('piano-birthday', 'Happy Birthday', 84, 'The song everyone knows. Near the end comes your first black key, B-flat.',
        'C4:0.5 C4:0.5 D4 C4 F4 E4:2 C4:0.5 C4:0.5 D4 C4 G4 F4:2 C4:0.5 C4:0.5 C5 A4 F4 E4 D4:2 As4:0.5 As4:0.5 A4 F4 G4 F4:2', true),
      song('piano-buns', 'Hot Cross Buns', 84, 'Three keys, E D C, and your first quick notes.',
        'E4 D4 C4:2 E4 D4 C4:2 C4:0.5 C4:0.5 C4:0.5 C4:0.5 D4:0.5 D4:0.5 D4:0.5 D4:0.5 E4 D4 C4:2'),
      song('piano-mary', 'Mary Had a Lamb', 92, 'Four neighbouring keys and a steady pulse. Repeated notes: lift and tap again.',
        'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:2'),
      song('piano-lune', 'Au clair de la lune', 84, 'A French song from the 1700s. Five fingers, five keys.',
        'C4 C4 C4 D4 E4:2 D4:2 C4 E4 D4 D4 C4:2'),
    ],
  },
  {
    title: 'Find your way',
    songs: [
      song('piano-white', 'The white keys', 80, 'Every C sits just left of a pair of black keys. Walk up C D E F G A B to the next C, and back down.',
        'C4 D4 E4 F4 G4 A4 B4 C5:2 B4 A4 G4 F4 E4 D4 C4:2'),
      song('piano-twos', 'Twos and threes', 76, 'Black keys come in twos and threes. That pattern is your map: C is just left of the two.',
        'Cs4 Ds4:2 Fs4 Gs4 As4:2 Cs5 Ds5:2 As4 Gs4 Fs4:2 Ds4 Cs4:2'),
      song('piano-cpos', 'C position', 80, 'Thumb on C, one finger for each key up to G. Your hand stays still; only the fingers move.',
        'C4 D4 E4 F4 G4:2 F4 E4 D4 C4:2 E4 G4 E4 C4:2'),
      song('piano-skips', 'Steps and skips', 80, 'A step goes to the next key; a skip jumps over one.',
        'C4 E4 D4 F4 E4 G4:2 G4 E4 F4 D4 E4 C4:2'),
    ],
  },
  {
    title: 'Sharps and flats',
    songs: [
      song('piano-sharps', 'Sharps', 72, 'A sharp (#) is the very next key up, to the right: usually a black key. There is no black key between E and F.',
        'C4 Cs4 D4 Ds4 E4:2 F4 Fs4 G4 Gs4 A4 As4 B4 C5:2'),
      song('piano-flats', 'Flats', 72, 'A flat (b) is the very next key down, to the left. The same black key has two names: A-sharp is B-flat.',
        'B4 As4 A4:2 E4 Ds4 D4:2 A4 Gs4 G4:2 D4 Cs4 C4:2', true),
      song('piano-dpos', 'D position', 80, 'Start on D. The third finger reaches up to F-sharp, a black key.',
        'D4 E4 Fs4 G4 A4:2 G4 Fs4 E4 D4:2 Fs4 A4 Fs4 D4:2'),
      song('piano-fpos', 'F position', 80, 'Start on F. The fourth finger plays B-flat.',
        'F4 G4 A4 As4 C5:2 As4 A4 G4 F4:2 A4 C5 A4 F4:2', true),
    ],
  },
  {
    title: 'Scales and leaps',
    songs: [
      song('piano-aminor', 'A minor scale', 76, 'The same white keys as C major, starting on A. It sounds wistful.',
        'A3 B3 C4 D4 E4 F4 G4 A4:2 G4 F4 E4 D4 C4 B3 A3:2'),
      song('piano-dmajor', 'D major scale', 76, 'Two sharps: F-sharp and C-sharp. Every major scale has the same pattern of steps.',
        'D4 E4 Fs4 G4 A4 B4 Cs5 D5:2 Cs5 B4 A4 G4 Fs4 E4 D4:2'),
      song('piano-penta', 'Black-key tune', 80, 'Only black keys: five of them in a row sound good in any order. Try your own later.',
        'Cs4 Ds4 Fs4 Gs4 As4:2 Gs4 Fs4 Ds4 Cs4:2 Fs4 As4 Cs5:2 As4 Fs4:2'),
      song('piano-thirds', 'Thirds', 76, 'Skip one key each time: C to E, D to F. Thirds are the building blocks of chords.',
        'C4 E4 D4 F4 E4 G4 F4 A4 G4 B4 A4 C5:2'),
      song('piano-fifths', 'Fifths', 72, 'A wider reach: thumb to little finger.',
        'C4 G4 D4 A4 E4 B4 F4 C5:2 C5 F4 B4 E4 A4 D4 G4 C4:2'),
    ],
  },
  {
    title: 'Songs of the world',
    songs: [
      song('piano-twinkle', 'Twinkle', 84, 'A French folk tune the whole world knows. White keys only.',
        'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2'),
      song('piano-jacques', 'Frère Jacques', 92, 'A French round, sung in China as Two Tigers. It uses B-flat.',
        'F4 G4 A4 F4 F4 G4 A4 F4 A4 As4 C5:2 A4 As4 C5:2 C5:0.5 D5:0.5 C5:0.5 As4:0.5 A4 F4 C5:0.5 D5:0.5 C5:0.5 As4:0.5 A4 F4 F4 C4 F4:2', true),
      song('piano-london', 'London Bridge', 92, 'An English singing game, hundreds of years old.',
        'G4:1.5 A4:0.5 G4 F4 E4 F4 G4:2 D4 E4 F4:2 E4 F4 G4:2 G4:1.5 A4:0.5 G4 F4 E4 F4 G4:2 D4:2 G4:2 E4 C4:2'),
      song('piano-ode', 'Ode to Joy', 88, 'Beethoven, 1824. Mostly neighbouring keys.',
        'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2'),
      song('piano-jingle', 'Jingle Bells', 100, 'James Lord Pierpont, 1857. Repeated notes, then a run up.',
        'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:3 F4 F4 F4:1.5 F4:0.5 F4 E4 E4 E4:0.5 E4:0.5 E4 D4 D4 E4 D4:2 G4:2'),
      song('piano-saints', 'When the Saints', 100, 'A spiritual from New Orleans. Long notes: count them out.',
        'C4 E4 F4 G4:3 C4 E4 F4 G4:3 C4 E4 F4 G4:2 E4:2 C4:2 E4:2 D4:3'),
      song('piano-auld', 'Auld Lang Syne', 80, 'A Scottish song for the new year. A dotted rhythm: long, short.',
        'C4 F4:1.5 F4:0.5 F4 A4 G4:1.5 F4:0.5 G4 A4 F4:1.5 F4:0.5 A4 C5 D5:3 D5 C5:1.5 A4:0.5 A4 F4 G4:1.5 F4:0.5 G4 A4 F4:1.5 D4:0.5 D4 C4 F4:3'),
      song('piano-sakura', 'Sakura', 66, 'Sakura Sakura, a Japanese folk song about cherry blossom.',
        'A4 A4 B4:2 A4 A4 B4:2 A4 B4 C5 B4 A4 B4:0.5 A4:0.5 F4:2 E4 C4 E4 F4 E4 E4:0.5 C4:0.5 B3:2'),
      // Beethoven, 1810 (public domain). The opening phrase with its second
      // ending, right hand, in its own key and octave.
      song('piano-elise', 'Für Elise', 60, 'Beethoven, 1810. Rock between E and D-sharp, then walk down to A. Your sharps at work.',
        'E5:0.5 Ds5:0.5 E5:0.5 Ds5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1.5 C4:0.5 E4:0.5 A4:0.5 B4:1.5 E4:0.5 C5:0.5 B4:0.5 A4:2'),
    ],
  },
];

export const SONGS: PianoSong[] = SONG_UNITS.flatMap((u) => u.songs);

/**
 * Today's echo: a new short phrase every day in C position (C to G), the
 * same for everyone on the same date. Practice that is never the same twice.
 */
export function dailyEcho(date = new Date()): PianoSong {
  let seed = date.getFullYear() * 400 + (date.getMonth() + 1) * 32 + date.getDate();
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pool = ['C4', 'D4', 'E4', 'F4', 'G4'];
  let at = Math.floor(rand() * 3);
  const notes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const step = [-2, -1, -1, 1, 1, 2, 0][Math.floor(rand() * 7)];
    at = Math.max(0, Math.min(4, at + step));
    const last = i === 7;
    notes.push(`${last ? 'C4' : pool[at]}${last || i === 3 ? ':2' : ''}`);
  }
  return {
    id: 'piano-daily',
    name: "Today's echo",
    teaching: 'A new phrase every day, in C position. Listen, then echo the master.',
    bpm: 84,
    notes: seq(notes.join(' ')),
  };
}

/**
 * Phrases for teaching a song in parts: split after each long note (two beats
 * or more), keeping every phrase at least four notes. Short songs are one phrase.
 */
export function phrasesOf(song: PianoSong): [number, number][] {
  const n = song.notes.length;
  if (n <= 16) return [[0, n]]; // exercises and short songs: one piece
  const out: [number, number][] = [];
  let start = 0;
  song.notes.forEach((note, i) => {
    if (note.beats >= 2 && i + 1 - start >= 4 && n - (i + 1) >= 3) {
      out.push([start, i + 1]);
      start = i + 1;
    }
  });
  if (start < n) out.push([start, n]);
  // Join neighbours that are both short, so no phrase is a fragment.
  for (let k = out.length - 1; k > 0; k--) {
    if (out[k][1] - out[k][0] + out[k - 1][1] - out[k - 1][0] <= 7) {
      out[k - 1] = [out[k - 1][0], out[k][1]];
      out.splice(k, 1);
    }
  }
  return out;
}

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
