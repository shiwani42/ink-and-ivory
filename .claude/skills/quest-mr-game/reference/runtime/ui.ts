import { Group, Object3D, Quaternion, Vector3 } from '@iwsdk/core';
import { FONT_BODY, FONT_DISPLAY, Label } from './text.js';

/**
 * Text that follows Meta's comfort guidance (hz-immersive-designer):
 *  - ≥1.5° glyph height at the viewing distance, sans-serif body text, ≥4.5:1 contrast
 *  - dialogue as head-stabilised subtitles: ~1 m away, ~18° below gaze, lazy-follow
 *    (never head-locked), ≤2 lines × ~32 chars per page
 *  - instructions anchored in the world next to the thing they refer to
 */

const SUB_DIST = 1.0; // m
const SUB_DOWN = (18 * Math.PI) / 180;
const SUB_WIDTH = 0.46; // m → ~26° wide at 1 m
const PAGE_CHARS = 64; // ~2 lines

export type Voice = 'shakuni' | 'whisper' | 'narrator';

interface Page {
  text: string;
  voice: Voice;
  dur: number;
}

/** Split long lines into ≤2-line pages at sentence/comma boundaries. */
export function paginate(text: string, max = PAGE_CHARS): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const pages: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > max && cur) {
      pages.push(cur);
      cur = w;
    } else {
      cur = next;
      if (/[.!?…]$/.test(w) && cur.length > max * 0.55) {
        pages.push(cur);
        cur = '';
      }
    }
  }
  if (cur) pages.push(cur);
  return pages;
}

export class Subtitles {
  readonly group = new Group();
  private card: Label;
  private tag: Label;
  private queue: Page[] = [];
  private current: Page | null = null;
  private t = 0;
  private alpha = 0;
  private readonly target = new Vector3();
  private readonly tmp = new Vector3();
  private readonly fwd = new Vector3();
  private placed = false;
  private readonly q = new Quaternion();

  /**
   * @param parent  if given, subtitles sit at a fixed spot in that space (the board),
   *                facing the viewer — dialogue lives in its own region and can't collide
   *                with instructions over the near half of the board.
   * @param spot    position in parent space
   */
  constructor(private readonly parent?: Object3D, spot?: Vector3) {
    this.group.name = 'subtitles';
    if (parent) {
      parent.add(this.group);
      this.group.position.copy(spot ?? new Vector3(0, 0.2, -0.33));
      this.placed = true;
    }
    // 1024px ↔ 0.46 m → 1 px = 0.45 mm; 84 px font ≈ 2.7 cm glyphs ≈ 1.55° at 1 m
    this.card = new Label(SUB_WIDTH, 3.0, {
      font: FONT_BODY,
      weight: 600,
      size: 84,
      lineHeight: 1.18,
      color: '#fff6e2',
      background: 'rgba(22,9,5,0.9)',
      border: 'rgba(230,180,90,0.95)',
      padding: 44,
    });
    this.tag = new Label(0.13, 4.4, {
      font: FONT_DISPLAY,
      size: 150,
      color: '#ffd57a',
      background: null,
      border: null,
      align: 'left',
      padding: 0,
      tracking: 10,
    }, 512);
    this.tag.mesh.position.set(-SUB_WIDTH / 2 + 0.075, SUB_WIDTH / 3.0 / 2 + 0.014, 0.001);
    this.group.add(this.card.mesh, this.tag.mesh);
    this.card.opacity = 0;
    this.tag.opacity = 0;
  }

  /** Queue a line. A new Shakuni line replaces whatever he was saying. */
  say(text: string, voice: Voice = 'shakuni'): number {
    if (voice !== 'whisper') this.queue = this.queue.filter((p) => p.voice === 'whisper');
    if (voice === 'shakuni' && this.current?.voice === 'shakuni') this.current = null;
    let total = 0;
    for (const page of paginate(text)) {
      const dur = Math.max(1.9, 0.75 + page.length * 0.06);
      total += dur;
      this.queue.push({ text: page, voice, dur });
    }
    return total;
  }

  clear(): void {
    this.queue = [];
    this.current = null;
  }

  get speaking(): boolean {
    return !!this.current && this.current.voice === 'shakuni';
  }

  private show(p: Page): void {
    const whisper = p.voice === 'whisper';
    this.card.setText(p.text, {
      italic: whisper,
      color: whisper ? '#efe0ff' : '#fff6e2',
      background: whisper ? 'rgba(34,14,52,0.9)' : 'rgba(22,9,5,0.9)',
      border: whisper ? 'rgba(186,150,255,0.9)' : 'rgba(230,180,90,0.95)',
    });
    this.tag.setText(p.voice === 'shakuni' ? 'SHAKUNI' : whisper ? 'A WHISPER' : '', {
      color: whisper ? '#cdb6ff' : '#ffd57a',
    });
  }

  /** head: the viewer (XR head or desktop camera). */
  update(dt: number, head: Object3D): void {
    if (!this.current && this.queue.length) {
      this.current = this.queue.shift()!;
      this.t = 0;
      this.show(this.current);
    }
    if (this.current) {
      this.t += dt;
      if (this.t > this.current.dur) {
        this.current = this.queue.length ? null : this.current;
        if (!this.queue.length && this.t > this.current!.dur + 0.4) this.current = null;
      }
    }
    const want = this.current ? 1 : 0;
    this.alpha += (want - this.alpha) * (1 - Math.exp(-dt * 10));
    this.card.opacity = this.alpha;
    this.tag.opacity = this.alpha;

    head.getWorldPosition(this.tmp);
    if (this.parent) {
      this.group.lookAt(this.tmp); // anchored: just face the viewer
      return;
    }
    // lazy follow: a target 1 m ahead (yaw only), 18° below eye level
    // forward = the viewer's local -Z (true for the XR head and for cameras alike;
    // Object3D.getWorldDirection means +Z for objects but -Z for cameras)
    head.getWorldQuaternion(this.q);
    this.fwd.set(0, 0, -1).applyQuaternion(this.q);
    this.fwd.y = 0;
    if (this.fwd.lengthSq() < 1e-6) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.target
      .copy(this.tmp)
      .addScaledVector(this.fwd, SUB_DIST * Math.cos(SUB_DOWN))
      .add(this.fwd.set(0, -SUB_DIST * Math.sin(SUB_DOWN), 0));
    const g = this.group.position;
    if (!this.placed) {
      g.copy(this.target);
      this.placed = true;
    }
    const off = g.distanceTo(this.target);
    if (off > 0.18 || this.alpha < 0.05) g.lerp(this.target, 1 - Math.exp(-dt * (this.alpha < 0.05 ? 30 : 3)));
    this.group.lookAt(this.tmp);
  }
}

/** A world-anchored instruction card that floats above what it refers to. */
export class Hint {
  readonly label: Label;
  private anchor = new Vector3();
  private alpha = 0;
  private want = 0;
  private t = 0;
  private parent: Object3D;
  private q = new Quaternion();

  constructor(parent: Object3D) {
    this.parent = parent;
    // read at ~0.6–0.8 m: 0.26 m wide, 90 px font ≈ 1.6 cm glyphs ≈ 1.4°
    this.label = new Label(0.27, 2.5, {
      font: FONT_BODY,
      weight: 700,
      size: 92,
      lineHeight: 1.12,
      color: '#2a1407',
      background: 'rgba(246,234,206,0.97)',
      border: 'rgba(170,120,40,0.95)',
      variant: 'parchment',
      padding: 40,
      shadow: false,
    }, 768);
    this.label.mesh.renderOrder = 12;
    parent.add(this.label.mesh);
    this.label.opacity = 0;
  }

  /** Show `text` floating `lift` m above a board-local point. */
  show(text: string, at: Vector3, lift = 0.1): void {
    this.label.setText(text);
    this.anchor.copy(at);
    this.anchor.y += lift;
    this.want = 1;
  }

  hide(): void {
    this.want = 0;
  }

  update(dt: number, headLocal: Vector3): void {
    this.t += dt;
    this.alpha += (this.want - this.alpha) * (1 - Math.exp(-dt * 8));
    this.label.opacity = this.alpha;
    if (this.alpha < 0.01) return;
    const m = this.label.mesh;
    m.position.copy(this.anchor);
    m.position.y += Math.sin(this.t * 2.2) * 0.006; // gentle float
    m.lookAt(this.parent.localToWorld(this.q.set(0, 0, 0, 1) && headLocal.clone()));
  }
}
