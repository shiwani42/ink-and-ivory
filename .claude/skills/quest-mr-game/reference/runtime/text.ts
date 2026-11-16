import {
  CanvasTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';

/**
 * Text drawn with Canvas2D onto a texture. uikit/troika can't shape Indic
 * scripts, but the browser's canvas text can, so the Devanagari title and all
 * captions use this path.
 */

export const FONT_DISPLAY = `'Rozha One', 'Tiro Devanagari Hindi', Georgia, serif`;
/** Body/UI text: Mukta — a humanist sans (OFL) with Devanagari; legible at VR sizes (Meta: avoid thin/decorative). */
export const FONT_BODY = `'Mukta', 'Tiro Devanagari Hindi', system-ui, sans-serif`;
export const FONT_SERIF = `'Tiro Devanagari Hindi', Georgia, serif`;

let fontsReady: Promise<void> | null = null;

/** Load the OFL display font from Google Fonts once; resolves even offline. */
export function loadFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  fontsReady = (async () => {
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Mukta:wght@500;600;700&family=Rozha+One&family=Tiro+Devanagari+Hindi&display=swap';
      document.head.appendChild(link);
      await new Promise((r) => {
        link.onload = r;
        link.onerror = r;
        setTimeout(r, 2500);
      });
      await Promise.race([
        Promise.all([
          document.fonts.load(`64px 'Tiro Devanagari Hindi'`, 'चौसर Chausar'),
          document.fonts.load(`64px 'Rozha One'`, 'चौसर Chausar'),
          document.fonts.load(`600 64px 'Mukta'`, 'चौसर Chausar'),
          document.fonts.load(`700 64px 'Mukta'`, 'SHAKUNI'),
        ]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch {
      /* fall back to system serif */
    }
  })();
  return fontsReady;
}

export interface LabelStyle {
  font?: string;
  size?: number; // px on the canvas
  color?: string;
  background?: string | null;
  border?: string | null;
  align?: CanvasTextAlign;
  padding?: number;
  lineHeight?: number;
  shadow?: boolean;
  /** CSS font weight, e.g. 600 */
  weight?: number;
  italic?: boolean;
  /** letter spacing in px (canvas letterSpacing) */
  tracking?: number;
  /**
   * Card frame. 'ornate' (default whenever both background and border are set)
   * draws a lacquer/parchment card with gilded filigree corners; 'plain' is the
   * old rounded rectangle.
   */
  frame?: 'ornate' | 'plain';
  /** Card material: dark lacquer (default) or parchment (dark ink by default). */
  variant?: 'lacquer' | 'parchment';
}

export class Label {
  readonly mesh: Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: CanvasTexture;
  private material: MeshBasicMaterial;
  private current = '';
  private style: Required<LabelStyle>;

  /**
   * @param widthM  world width in metres
   * @param aspect  canvas width / height
   */
  constructor(
    widthM: number,
    aspect: number,
    style: LabelStyle = {},
    resolution = 1024,
  ) {
    const parchment = style.variant === 'parchment';
    this.style = {
      font: FONT_BODY,
      size: 64,
      color: parchment ? '#3b1d0b' : '#fff4dc',
      background: parchment ? 'rgba(236,218,176,0.96)' : 'rgba(26,9,5,0.84)',
      border: parchment ? 'rgba(150,96,28,0.95)' : 'rgba(232,188,98,0.95)',
      align: 'center',
      padding: 28,
      lineHeight: 1.25,
      shadow: !parchment,
      frame: 'ornate',
      variant: 'lacquer',
      weight: 500,
      italic: false,
      tracking: 0,
      ...style,
    } as Required<LabelStyle>;
    this.canvas = document.createElement('canvas');
    this.canvas.width = resolution;
    this.canvas.height = Math.round(resolution / aspect);
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new Mesh(
      new PlaneGeometry(widthM, widthM / aspect),
      this.material,
    );
    this.mesh.renderOrder = 10;
  }

  set opacity(v: number) {
    this.material.opacity = v;
    this.mesh.visible = v > 0.01;
  }

  get opacity(): number {
    return this.material.opacity;
  }

  /** Redraw only when the text actually changes. */
  setText(text: string, override: LabelStyle = {}): void {
    const k = text + JSON.stringify(override);
    if (k === this.current) return;
    this.current = k;
    const st = { ...this.style, ...override };
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!text) {
      this.texture.needsUpdate = true;
      return;
    }
    const ornate = !!st.background && !!st.border && st.frame === 'ornate';
    let pad = st.padding;
    if (ornate) {
      pad += drawOrnateCard(ctx, W, H, st.background!, st.border!, st.variant === 'parchment');
    } else if (st.background) {
      ctx.fillStyle = st.background;
      roundRect(ctx, 4, 4, W - 8, H - 8, Math.min(H * 0.2, 40));
      ctx.fill();
      if (st.border) {
        ctx.strokeStyle = st.border;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${st.tracking ?? 0}px`;
    ctx.fillStyle = st.color;
    ctx.textAlign = st.align;
    ctx.textBaseline = 'middle';
    // Fit-to-card: shrink the font until every line fits inside the frame — text is never
    // clipped by the canvas edge (wrapping alone only guarantees the width).
    let size = st.size;
    let lines: string[] = [];
    let lh = size * st.lineHeight;
    const padV = Math.max(pad * 0.75, H * 0.12);
    for (let i = 0; i < 14; i++) {
      ctx.font = `${st.italic ? 'italic ' : ''}${st.weight ?? ''} ${size}px ${st.font}`;
      lines = wrap(ctx, text, W - pad * 2);
      lh = size * st.lineHeight;
      const widest = Math.max(...lines.map((ln) => ctx.measureText(ln).width));
      const tall = (lines.length - 1) * lh + size * 1.15;
      if (tall <= H - padV * 2 && widest <= W - pad * 2) break;
      size *= 0.92;
    }
    const y0 = H / 2 - ((lines.length - 1) * lh) / 2;
    const x = st.align === 'center' ? W / 2 : st.align === 'left' ? pad : W - pad;
    if (st.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
    }
    lines.forEach((ln, i) => ctx.fillText(ln, x, y0 + i * lh));
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    this.texture.needsUpdate = true;
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > max && line) {
        out.push(line);
        line = w;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Lacquer (or parchment) card with a double gilded rule and filigree corners.
 * Returns the extra horizontal padding the corners need.
 */
function drawOrnateCard(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  background: string,
  border: string,
  parchment: boolean,
): number {
  const m = 5;
  const r = Math.min(H * 0.16, 30);
  // body
  roundRect(ctx, m, m, W - 2 * m, H - 2 * m, r);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // lacquer depth / parchment age: a soft vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.1, W / 2, H / 2, Math.max(W, H) * 0.62);
  if (parchment) {
    vg.addColorStop(0, 'rgba(255,250,232,0.35)');
    vg.addColorStop(1, 'rgba(120,72,24,0.35)');
  } else {
    vg.addColorStop(0, 'rgba(120,36,18,0.30)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  }
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // faint jaali trellis
  ctx.globalAlpha = parchment ? 0.06 : 0.07;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.2;
  const step = Math.max(18, H * 0.16);
  ctx.beginPath();
  for (let x = -H; x < W + H; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
    ctx.moveTo(x + H, 0);
    ctx.lineTo(x, H);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  const hi = parchment ? 'rgba(255,236,190,0.6)' : 'rgba(255,244,214,0.55)';
  // double rule
  roundRect(ctx, m + 2, m + 2, W - 2 * m - 4, H - 2 * m - 4, r);
  ctx.strokeStyle = border;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  const ins = Math.max(10, H * 0.07);
  roundRect(ctx, m + ins, m + ins, W - 2 * (m + ins), H - 2 * (m + ins), Math.max(4, r - ins * 0.6));
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // filigree corners
  const s = Math.min(H * 0.46, 120);
  const corners: [number, number, number, number][] = [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    drawFiligree(ctx, s, border, hi);
    ctx.restore();
  }
  // top and bottom centre ornaments
  for (const [y, d] of [[m + 2, 1], [H - m - 2, -1]] as const) {
    const w = Math.min(W * 0.1, s * 0.9);
    ctx.beginPath();
    ctx.moveTo(W / 2 - w, y);
    ctx.quadraticCurveTo(W / 2 - w * 0.3, y + d * s * 0.12, W / 2, y + d * s * 0.06);
    ctx.quadraticCurveTo(W / 2 + w * 0.3, y + d * s * 0.12, W / 2 + w, y);
    ctx.strokeStyle = border;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    diamond(ctx, W / 2, y + d * s * 0.02, s * 0.06, border, hi);
  }
  return s * 0.22;
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, hi: string) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = hi;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** One corner of filigree in local space: origin at the corner, +x/+y inward. */
function drawFiligree(ctx: CanvasRenderingContext2D, s: number, gold: string, hi: string) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const scroll = () => {
    // a tendril along the top edge ending in a curl
    ctx.moveTo(s * 0.2, s * 0.13);
    ctx.bezierCurveTo(s * 0.4, s * 0.02, s * 0.62, s * 0.26, s * 0.8, s * 0.13);
    ctx.bezierCurveTo(s * 0.9, s * 0.06, s * 0.96, s * 0.18, s * 0.88, s * 0.21);
    ctx.bezierCurveTo(s * 0.82, s * 0.23, s * 0.8, s * 0.16, s * 0.85, s * 0.155);
    // a leaf branching off
    ctx.moveTo(s * 0.48, s * 0.12);
    ctx.quadraticCurveTo(s * 0.55, s * 0.3, s * 0.42, s * 0.33);
    ctx.quadraticCurveTo(s * 0.4, s * 0.22, s * 0.48, s * 0.12);
  };
  for (const swap of [false, true]) {
    ctx.save();
    if (swap) ctx.transform(0, 1, 1, 0, 0, 0); // mirror across the diagonal
    ctx.beginPath();
    scroll();
    ctx.strokeStyle = gold;
    ctx.lineWidth = Math.max(2, s * 0.035);
    ctx.stroke();
    ctx.strokeStyle = hi;
    ctx.lineWidth = Math.max(0.8, s * 0.012);
    ctx.stroke();
    ctx.restore();
  }
  // quarter-round bracket and seed pearls on the diagonal
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.36, 0.18, Math.PI / 2 - 0.18);
  ctx.strokeStyle = gold;
  ctx.lineWidth = Math.max(1.5, s * 0.022);
  ctx.stroke();
  for (const k of [0.3, 0.4, 0.48]) {
    ctx.beginPath();
    ctx.arc(s * k * 0.75, s * k * 0.75, s * (0.035 - (k - 0.3) * 0.05), 0, Math.PI * 2);
    ctx.fillStyle = gold;
    ctx.fill();
  }
  diamond(ctx, s * 0.13, s * 0.13, s * 0.075, gold, hi);
}
