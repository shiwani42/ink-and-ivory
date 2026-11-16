import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
} from '@iwsdk/core';
import { noteName, type PianoSong } from './songs.js';

/**
 * What the learner sees of the music itself:
 * - a washi music sheet on a small stand behind the keyboard, showing the
 *   song as note names in sequence (wider bubbles for longer notes), with the
 *   current note in vermilion and played notes in ink or gold;
 * - a letter on each white key;
 * - a note symbol that floats up from every key you play.
 * All drawn into canvas textures (no font assets; notes are drawn as shapes).
 */

const LETTER = (id: string) => id.replace(/\d$/, '').replace('s', '#');

export function keyLabel(id: string): Mesh {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(60,48,40,0.75)';
  ctx.font = 'bold 40px Georgia, "Noto Serif", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(LETTER(id), 32, 34);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const m = new Mesh(
    new PlaneGeometry(0.016, 0.016),
    new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** An eighth note, drawn as shapes (no glyph needed). */
function noteSymbolTexture(color: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.save();
  ctx.translate(24, 46);
  ctx.rotate(-0.35);
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(33, 44);
  ctx.lineTo(33, 8);
  ctx.quadraticCurveTo(46, 16, 50, 30);
  ctx.stroke();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Note symbols that float up from played keys and fade. Pooled. */
export class FloatingNotes {
  readonly group = new Group();
  private readonly sprites: Sprite[] = [];
  private readonly life: number[] = [];
  private readonly vx: number[] = [];
  private next = 0;
  private readonly inkMat: SpriteMaterial;
  private readonly goldMat: SpriteMaterial;

  constructor(count = 14) {
    this.inkMat = new SpriteMaterial({ map: noteSymbolTexture('#2a221c'), transparent: true, depthWrite: false, toneMapped: false });
    this.goldMat = new SpriteMaterial({ map: noteSymbolTexture('#ffc44d'), transparent: true, depthWrite: false, toneMapped: false });
    for (let i = 0; i < count; i++) {
      const s = new Sprite(this.inkMat.clone());
      s.scale.setScalar(0.026);
      s.visible = false;
      this.group.add(s);
      this.sprites.push(s);
      this.life.push(0);
      this.vx.push(0);
    }
  }

  emit(x: number, y: number, z: number, gold: boolean): void {
    const i = this.next;
    this.next = (this.next + 1) % this.sprites.length;
    const s = this.sprites[i];
    const src = gold ? this.goldMat : this.inkMat;
    (s.material as SpriteMaterial).map = src.map;
    s.position.set(x, y + 0.02, z);
    s.visible = true;
    this.life[i] = 1;
    this.vx[i] = (Math.random() - 0.5) * 0.03;
  }

  update(dt: number): void {
    for (let i = 0; i < this.sprites.length; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt / 1.1;
      const s = this.sprites[i];
      s.position.y += dt * 0.09;
      s.position.x += this.vx[i] * dt;
      (s.material as SpriteMaterial).opacity = Math.max(0, this.life[i]);
      s.scale.setScalar(0.022 + 0.01 * (1 - this.life[i]));
      if (this.life[i] <= 0) s.visible = false;
    }
  }
}

/** The music sheet on its stand: the song as note names, current note highlighted. */
export class MusicSheet {
  readonly group = new Group();
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: CanvasTexture;

  constructor() {
    this.canvas.width = 1024;
    this.canvas.height = 300;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    const sheet = new Mesh(
      new PlaneGeometry(0.3, 0.088),
      new MeshBasicMaterial({ map: this.texture, side: DoubleSide, toneMapped: false }),
    );
    this.group.add(sheet);
  }

  /**
   * @param played per-note state: 0 = to come, 1 = played, 2 = played on the beat
   * @param current index of the note to play now (-1 when finished)
   */
  draw(song: PianoSong, current: number, played: number[]): void {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = '#f4ede0';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d8ccb4';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = '#a8231a';
    ctx.font = 'bold 30px Georgia, "Noto Serif", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(song.name.toUpperCase(), 34, 52);
    // A faint staff line for the eye to follow.
    ctx.strokeStyle = 'rgba(80,64,52,0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 175);
    ctx.lineTo(W - 30, 175);
    ctx.stroke();
    // Notes, scrolled so the current note stays in view.
    const unit = 70; // px per beat
    const gap = 10;
    // Every bubble fits its letter ("D#" too), however short the note.
    const widths = song.notes.map((n) => Math.max(noteName(n.note).length > 1 ? 76 : 60, n.beats * unit - gap));
    const starts: number[] = [];
    let x = 0;
    for (const w of widths) {
      starts.push(x);
      x += w + gap;
    }
    const focus = current >= 0 ? starts[current] : x;
    const offset = Math.max(0, Math.min(focus - 260, x - (W - 60)));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    song.notes.forEach((n, i) => {
      const px = 30 + starts[i] - offset;
      const w = widths[i];
      if (px + w < 20 || px > W - 20) return;
      const state = played[i] ?? 0;
      const isCurrent = i === current;
      ctx.fillStyle = isCurrent ? '#e0452c' : state === 2 ? '#f2c14e' : state === 1 ? '#3a2f25' : '#e6dccb';
      ctx.beginPath();
      ctx.roundRect(px, 125, w, 100, 22);
      ctx.fill();
      ctx.fillStyle = isCurrent || state === 1 ? '#f4ede0' : '#1d1813';
      const label = noteName(n.note, song.flats);
      ctx.font = `bold ${label.length > 1 ? 44 : 54}px Georgia, "Noto Serif", serif`;
      ctx.fillText(label, px + w / 2, 177);
    });
    this.texture.needsUpdate = true;
  }
}
