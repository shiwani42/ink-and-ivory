import {
  CanvasTexture,
  CircleGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
} from '@iwsdk/core';
import strokeData from '../lessons/strokes.json';

/**
 * The Ink and Ivory seal: a round washi disc with a vermilion ring, the name
 * around it, and 永 ("eternity", the character that holds every brush stroke)
 * drawn from its real KanjiVG strokes (no font needed on the headset). Used
 * as the cap at the top of every 360 place, where a panorama pinches to a point.
 */
export function drawLogo(size = 1024): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = size / 2;
  g.translate(r, r);
  // Disc: warm washi.
  g.beginPath();
  g.arc(0, 0, r * 0.98, 0, Math.PI * 2);
  g.fillStyle = '#f4ede0';
  g.fill();
  // Vermilion rings.
  g.lineWidth = r * 0.035;
  g.strokeStyle = '#a8231a';
  g.beginPath();
  g.arc(0, 0, r * 0.93, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = r * 0.012;
  g.beginPath();
  g.arc(0, 0, r * 0.66, 0, Math.PI * 2);
  g.stroke();
  // Name around the ring.
  const text = 'INK AND IVORY  ·  CALLIGRAPHY AND PIANO  ·  ';
  g.fillStyle = '#1d1813';
  g.font = `700 ${Math.round(r * 0.105)}px Georgia, 'Times New Roman', serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const radius = r * 0.795;
  const step = (Math.PI * 2) / text.length;
  for (let i = 0; i < text.length; i++) {
    const a = -Math.PI / 2 + i * step;
    g.save();
    g.rotate(a + Math.PI / 2);
    g.translate(0, -radius);
    g.fillText(text[i], 0, 0);
    g.restore();
  }
  // 永 in brush ink, from KanjiVG stroke paths.
  const chars = (strokeData as unknown as { characters: Record<string, { strokes: { points: [number, number][] }[] }> }).characters;
  const ei = chars['永'];
  if (ei) {
    const box = r * 1.05;
    g.strokeStyle = '#a8231a';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = r * 0.075;
    for (const s of ei.strokes) {
      g.beginPath();
      s.points.forEach(([u, v], i) => {
        const x = (u - 0.5) * box;
        const y = (v - 0.5) * box;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();
    }
  }
  return c;
}

/** A disc at the top of the place's sphere (radius 40), facing down at the viewer. */
export function createLogoCap(): Mesh {
  const tex = new CanvasTexture(drawLogo());
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  const material = new MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: DoubleSide,
  });
  const cap = new Mesh(new CircleGeometry(7.5, 64), material);
  cap.position.y = 36; // inside the sphere, just under its top
  cap.rotation.x = Math.PI / 2; // face down
  cap.renderOrder = -99;
  cap.frustumCulled = false;
  return cap;
}
