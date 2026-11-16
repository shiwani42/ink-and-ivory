import {
  AssetManager,
  Box3,
  Color,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Vector3,
} from '@iwsdk/core';
import { SURFACE_Y } from '../desk/desk.js';
import { FloatingNotes, keyLabel, MusicSheet } from './notation.js';
import { songFromRecording } from './custom-song.js';
import { midiOf, SONGS, type PianoSong } from './songs.js';

/**
 * Piano lessons on the learner's real desk.
 *
 * - The keyboard (A3 to E5, built in Blender) lies where the paper was. Keys
 *   are a little larger than a real piano's (30 mm whites) so hand tracking
 *   can tell neighbours apart.
 * - Every fingertip of both hands can play. A key goes down when a fingertip
 *   touches the real desk inside the key's footprint; separate press and
 *   release heights stop flicker, and each key ignores repeats for 120 ms.
 * - "Wait mode": the song waits for the right key. The master's hand hovers
 *   over it and plays it with you. Pressing on the beat (within a third of a
 *   beat of the master's timing) turns the key gold.
 *
 * Coordinates: keyboard-local = desk-body-local (y = 0 on the table).
 * Fingertips arrive in paper-local (y = 0 on the paper surface) and are
 * shifted by SURFACE_Y.
 */

export interface FingerTip {
  x: number;
  y: number; // paper-local
  z: number;
  valid: boolean;
  /** The finger is reaching out, not curled into the palm (tip far from its knuckle base). */
  extended: boolean;
}

interface Key {
  id: string;
  midi: number;
  mesh: Mesh;
  material: MeshStandardMaterial;
  baseColor: Color;
  black: boolean;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  top: number;
  restY: number;
  press: number; // 0..1 visual depression
  glow: number; // 0..1
  glowColor: Color;
  lastHit: number;
}

export type PianoEvent =
  | { type: 'none' }
  | { type: 'watch-done' }
  | { type: 'note'; correct: boolean; inTime: boolean; index: number }
  | { type: 'heard'; count: number }
  | { type: 'learned'; song: PianoSong }
  | { type: 'complete'; score: number; accuracy: number; rhythm: number };

const DOWN_H = 0.012; // fingertip joint height above the desk when "touching"
const UP_H = 0.019;
const VERMILION = new Color('#e0452c');
const GOLD = new Color('#ffc44d');
const MISS = new Color('#7a6f66');

export class PianoMode {
  readonly root: Object3D;
  readonly keys: Key[] = [];
  private readonly keyById = new Map<string, Key>();
  song: PianoSong = SONGS[0];
  songIndex = 0;
  phase: 'idle' | 'watch' | 'play' | 'listen' | 'complete' = 'idle';
  noteIndex = 0;
  tempo = 0.8;
  /** Where the master's fingertip should be (paper-local). */
  readonly ghostTip = new Vector3(0.12, 0.08, 0.1);
  /** 0..1 gold pulse for the ghost hand after an on-beat note. */
  gold = 0;

  private clock = 0;
  private watchTimes: number[] = [];
  private watchClock = 0;
  private lastPress = 0;
  private correct = 0;
  private wrong = 0;
  private inTime = 0;
  private fingerDown = new Array<boolean>(10).fill(false);
  private lowest = [-1, -1];
  private tapClock = 1; // seconds since the master last tapped
  private target = new Vector3();
  private tmp = new Vector3();
  private soundPos = new Vector3();
  private readonly sheet = new MusicSheet();
  private readonly floating = new FloatingNotes();
  private played: number[] = [];
  private legs?: Object3D;
  /** Listening to the learner's own tune: key presses and their times. */
  private taps: { midi: number; t: number }[] = [];
  private static readonly LISTEN_END = 3; // seconds of quiet that end a tune
  private static readonly LISTEN_MAX = 40; // notes

  constructor(
    private readonly hooks: {
      play: (midi: number, velocity: number, x: number, y: number, z: number) => void;
      sparks: (x: number, y: number, z: number, n: number) => void;
    },
  ) {
    const gltf = AssetManager.getGLTF('model-keyboard');
    if (!gltf) throw new Error('keyboard model not loaded');
    this.root = gltf.scene;
    this.root.updateMatrixWorld(true);
    const box = new Box3();
    this.root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || !o.name.startsWith('key_')) return;
      const id = o.name.slice(4);
      // Clone the material so each key can glow independently.
      const material = (m.material as MeshStandardMaterial).clone();
      m.material = material;
      box.setFromObject(m);
      const key: Key = {
        id,
        midi: midiOf(id),
        mesh: m,
        material,
        baseColor: material.color.clone(),
        black: id.includes('s'),
        x0: box.min.x,
        x1: box.max.x,
        z0: box.min.z,
        z1: box.max.z,
        top: box.max.y,
        restY: m.position.y,
        press: 0,
        glow: 0,
        glowColor: VERMILION.clone(),
        lastHit: -1,
      };
      this.keys.push(key);
      this.keyById.set(id, key);
    });
    this.keys.sort((a, b) => a.midi - b.midi);

    // Letter names on the white keys (they move with their key).
    for (const k of this.keys) {
      if (k.black) continue;
      const label = keyLabel(k.id);
      const p = k.mesh.worldToLocal(new Vector3((k.x0 + k.x1) / 2, k.top + 0.0006, k.z1 - 0.016));
      label.position.copy(p);
      k.mesh.add(label);
    }
    // The concert grand around the playable keys (decorative keys either side).
    const grand = AssetManager.getGLTF('model-grand-piano');
    if (grand) {
      this.root.add(grand.scene);
      this.legs = grand.scene.getObjectByName('legs') ?? undefined;
      // The keyboard's own walnut case sits inside the grand's lacquer case.
      this.root.traverse((o) => {
        if (o.name.startsWith('case_')) o.visible = false;
      });
    }
    // The score rests on the piano's music desk, tilted back.
    this.sheet.group.position.set(0, 0.175, -0.188);
    this.sheet.group.rotation.x = -0.24;
    this.sheet.group.scale.setScalar(1.7);
    this.root.add(this.sheet.group);
    this.root.add(this.floating.group);
  }

  private drawSheet(): void {
    const current = this.phase === 'play' || this.phase === 'watch' ? this.noteIndex : -1;
    this.sheet.draw(this.song, current < this.song.notes.length ? current : -1, this.played);
  }

  /** Stretch the piano's legs so they reach the floor (desk height in metres above it). */
  fitToFloor(deskHeight: number): void {
    if (!this.legs) return;
    // Legs are modelled 0.7 m long, starting 0.28 m below the keys.
    this.legs.scale.y = Math.max(0.2, (deskHeight - 0.28) / 0.7);
  }

  get beatSeconds(): number {
    return 60 / (this.song.bpm * this.tempo);
  }

  keyCentre(id: string, out: Vector3): Vector3 {
    const k = this.keyById.get(id)!;
    // Aim at the front third of black keys and the middle of white keys.
    const z = k.black ? k.z0 + (k.z1 - k.z0) * 0.65 : (k.z0 + k.z1) / 2 + 0.015;
    return out.set((k.x0 + k.x1) / 2, k.top - SURFACE_Y, z);
  }

  loadSong(index: number, song: PianoSong = SONGS[index]): void {
    this.songIndex = index;
    this.song = song;
    this.phase = 'idle';
    this.noteIndex = 0;
    this.played = this.song.notes.map(() => 0);
    for (const k of this.keys) {
      k.glow = 0;
      k.press = 0;
    }
    this.drawSheet();
  }

  /** The master plays the whole song once, in time. */
  startWatch(): void {
    this.phase = 'watch';
    this.watchClock = -0.8;
    this.watchTimes = [];
    let t = 0;
    for (const n of this.song.notes) {
      this.watchTimes.push(t);
      t += n.beats * this.beatSeconds;
    }
    this.noteIndex = 0;
    this.played = this.song.notes.map(() => 0);
    this.drawSheet();
  }

  startPlay(): void {
    this.phase = 'play';
    this.noteIndex = 0;
    this.correct = 0;
    this.wrong = 0;
    this.inTime = 0;
    this.lastPress = 0;
    this.fingerDown.fill(true); // require a lift before the first note
    this.played = this.song.notes.map(() => 0);
    this.drawSheet();
  }

  /** Listen to the learner play their own tune; the master learns it when they stop. */
  startListen(index: number): void {
    this.songIndex = index;
    this.phase = 'listen';
    this.taps = [];
    this.fingerDown.fill(true); // require a lift first
    for (const k of this.keys) k.glow = 0;
    // The master's hand rests above the middle of the keyboard, listening.
    this.keyCentre('E4', this.target);
  }

  /**
   * A new key press by any hand, or undefined. Songs are one note at a time,
   * so per hand only the lowest extended fingertip can play: curled
   * neighbours that dip near the desk as the hand comes down must not sound
   * the keys beside it.
   */
  private detectPress(tips: FingerTip[], surfaceOffset: number): Key | undefined {
    this.lowest[0] = this.lowest[1] = -1;
    for (let f = 0; f < tips.length; f++) {
      if (!tips[f].valid || !tips[f].extended || !this.keyAt(tips[f].x, tips[f].z)) continue;
      const hand = f < 5 ? 0 : 1;
      const best = this.lowest[hand];
      if (best < 0 || tips[f].y < tips[best].y) this.lowest[hand] = f;
    }
    for (let f = 0; f < tips.length; f++) {
      const tip = tips[f];
      if (!tip.valid) {
        this.fingerDown[f] = false;
        continue;
      }
      if (f !== this.lowest[0] && f !== this.lowest[1]) {
        if (tip.y - surfaceOffset > UP_H) this.fingerDown[f] = false;
        continue;
      }
      const h = tip.y - surfaceOffset;
      if (this.fingerDown[f]) {
        if (h > UP_H) this.fingerDown[f] = false;
        continue;
      }
      if (h >= DOWN_H || h < -0.06) continue;
      const key = this.keyAt(tip.x, tip.z);
      if (!key) continue;
      this.fingerDown[f] = true;
      if (this.clock - key.lastHit < 0.12) continue;
      return key;
    }
    return undefined;
  }

  private hit(k: Key, velocity: number, color: Color): void {
    // The note sounds from its own key (world position for spatial audio).
    this.soundPos.set((k.x0 + k.x1) / 2, k.top, (k.z0 + k.z1) / 2);
    this.root.localToWorld(this.soundPos);
    this.hooks.play(k.midi, velocity, this.soundPos.x, this.soundPos.y, this.soundPos.z);
    this.floating.emit((k.x0 + k.x1) / 2, k.top, (k.z0 + k.z1) / 2, color === GOLD);
    k.press = 1;
    k.glow = 1;
    k.glowColor.copy(color);
    k.lastHit = this.clock;
  }

  update(dt: number, tips: FingerTip[], surfaceOffset: number): PianoEvent {
    this.clock += dt;
    this.tapClock += dt;
    this.gold = Math.max(0, this.gold - dt * 1.6);
    let event: PianoEvent = { type: 'none' };

    if (this.phase === 'watch') {
      this.watchClock += dt;
      const i = this.noteIndex;
      if (i < this.song.notes.length) {
        const next = this.song.notes[i];
        this.keyCentre(next.note, this.target);
        if (this.watchClock >= this.watchTimes[i]) {
          this.hit(this.keyById.get(next.note)!, 0.75, VERMILION);
          this.tapClock = 0;
          this.played[i] = 1;
          this.noteIndex++;
          this.drawSheet();
        }
      } else if (this.watchClock > this.watchTimes[this.watchTimes.length - 1] + 1.4) {
        this.phase = 'idle';
        event = { type: 'watch-done' };
      }
    }

    if (this.phase === 'play') {
      const expected = this.song.notes[this.noteIndex];
      this.keyCentre(expected.note, this.target);
      const key = this.detectPress(tips, surfaceOffset);
      if (key) {
        const correct = key.id === expected.note;
        if (correct) {
          const beat = this.beatSeconds;
          const due = this.noteIndex === 0 ? this.clock : this.lastPress + this.song.notes[this.noteIndex - 1].beats * beat;
          const onBeat = this.noteIndex === 0 || Math.abs(this.clock - due) < beat * 0.34;
          this.hit(key, 0.85, onBeat ? GOLD : VERMILION);
          if (onBeat) {
            this.inTime++;
            this.gold = 1;
            this.hooks.sparks((key.x0 + key.x1) / 2, key.top - SURFACE_Y + 0.004, (key.z0 + key.z1) / 2, 8);
          }
          this.tapClock = 0; // the master plays it with you
          this.correct++;
          this.lastPress = this.clock;
          this.played[this.noteIndex] = onBeat ? 2 : 1;
          event = { type: 'note', correct: true, inTime: onBeat, index: this.noteIndex };
          this.noteIndex++;
          this.drawSheet();
          if (this.noteIndex >= this.song.notes.length) {
            const accuracy = this.correct / Math.max(1, this.correct + this.wrong);
            const rhythm = this.song.notes.length > 1 ? (this.inTime - 1) / (this.song.notes.length - 1) : 1;
            const score = Math.round(100 * (0.65 * accuracy + 0.35 * Math.max(0, rhythm)));
            this.phase = 'complete';
            return { type: 'complete', score, accuracy, rhythm: Math.max(0, rhythm) };
          }
        } else {
          this.hit(key, 0.35, MISS);
          this.wrong++;
          event = { type: 'note', correct: false, inTime: false, index: this.noteIndex };
        }
      }
      // The expected key breathes so the eye always finds it.
      const k = this.keyById.get(expected.note)!;
      if (k.glow < 0.45) {
        k.glowColor.copy(VERMILION);
        k.glow = Math.max(k.glow, 0.25 + 0.2 * Math.sin(this.clock * 5));
      }
    }

    if (this.phase === 'listen') {
      const key = this.detectPress(tips, surfaceOffset);
      if (key) {
        this.hit(key, 0.85, GOLD);
        this.taps.push({ midi: key.midi, t: this.clock });
        this.keyCentre(key.id, this.target); // the master's hand follows yours
        event = { type: 'heard', count: this.taps.length };
      }
      const last = this.taps[this.taps.length - 1];
      const done =
        this.taps.length >= PianoMode.LISTEN_MAX ||
        (this.taps.length >= 3 && last && this.clock - last.t > PianoMode.LISTEN_END);
      if (done) {
        const song = songFromRecording(this.taps);
        this.phase = 'idle';
        if (song) event = { type: 'learned', song };
      }
    }

    // The master's fingertip: hover over the target key, tap on each note.
    if (this.phase === 'watch' || this.phase === 'play' || this.phase === 'listen') {
      const tap = this.tapClock < 0.22 ? Math.sin((this.tapClock / 0.22) * Math.PI) : 0;
      const hover = 0.03 + Math.sin(this.clock * 2.4) * 0.003;
      this.tmp.set(this.target.x, this.target.y + 0.0085 + hover * (1 - tap), this.target.z);
      this.ghostTip.lerp(this.tmp, Math.min(1, dt * (this.phase === 'watch' ? 14 : 8)));
    }

    this.floating.update(dt);
    // Key animation: press down and release; glow toward the base colour.
    for (const k of this.keys) {
      k.press = Math.max(0, k.press - dt * 5);
      k.mesh.position.y = k.restY - 0.004 * k.press;
      k.glow = Math.max(0, k.glow - dt * 1.4);
      k.material.color.copy(k.baseColor).lerp(k.glowColor, Math.min(1, k.glow));
      k.material.emissive.copy(k.glowColor).multiplyScalar(0.55 * k.glow);
    }
    return event;
  }

  private keyAt(x: number, z: number): Key | undefined {
    // Black keys sit on top, so test them first.
    for (const k of this.keys) {
      if (k.black && x >= k.x0 && x <= k.x1 && z >= k.z0 && z <= k.z1) return k;
    }
    for (const k of this.keys) {
      if (!k.black && x >= k.x0 && x <= k.x1 && z >= k.z0 - 0.005 && z <= k.z1 + 0.01) return k;
    }
    return undefined;
  }

  /** World-space layout for the emulator test. */
  layout(toWorld: (x: number, y: number, z: number) => number[]): unknown {
    const keys: Record<string, number[]> = {};
    for (const k of this.keys) {
      this.keyCentre(k.id, this.tmp);
      keys[k.id] = toWorld(this.tmp.x, 0, this.tmp.z);
    }
    return {
      song: this.song.id,
      beat: +this.beatSeconds.toFixed(3),
      notes: this.song.notes.map((n) => [n.note, n.beats]),
      keys,
    };
  }
}
