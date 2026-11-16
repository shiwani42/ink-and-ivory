import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Points,
  ShaderMaterial,
} from '@iwsdk/core';

/**
 * Gold sparks: one pooled Points draw call with additive blending, no
 * post-processing (which breaks in WebXR). Positions are in the parent's local
 * space (the paper group). Allocation-free after construction.
 */

const MAX = 160;

function glowTexture(): CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,240,200,0.85)');
  g.addColorStop(0.55, 'rgba(255,190,90,0.25)');
  g.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new CanvasTexture(c);
}

export class Sparks {
  readonly points: Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly life = new Float32Array(MAX); // remaining seconds
  private readonly total = new Float32Array(MAX);
  private readonly alpha = new Float32Array(MAX);
  private readonly size = new Float32Array(MAX);
  private next = 0;
  private readonly geometry = new BufferGeometry();

  constructor(color = new Color('#ffcf6a')) {
    this.geometry.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geometry.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1));
    this.geometry.setAttribute('aSize', new BufferAttribute(this.size, 1));
    const material = new ShaderMaterial({
      uniforms: { uMap: { value: glowTexture() }, uColor: { value: color }, uScale: { value: 900 } },
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        attribute float aSize;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uMap;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uColor * t.rgb, t.a * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 30;
  }

  /** Emit `count` sparks at (x, y, z) rising off the paper. */
  burst(x: number, y: number, z: number, count: number, speed = 0.12): void {
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * r * 0.6;
      this.vel[i * 3 + 1] = speed * (0.35 + Math.random() * 0.9);
      this.vel[i * 3 + 2] = Math.sin(a) * r * 0.6;
      const life = 0.6 + Math.random() * 0.7;
      this.life[i] = life;
      this.total[i] = life;
      this.size[i] = 0.004 + Math.random() * 0.006;
    }
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      any = true;
      this.life[i] -= dt;
      const k = 1 - Math.exp(-dt * 2.2); // air drag
      this.vel[i * 3] -= this.vel[i * 3] * k;
      this.vel[i * 3 + 1] -= this.vel[i * 3 + 1] * k + 0.05 * dt; // slow fall
      this.vel[i * 3 + 2] -= this.vel[i * 3 + 2] * k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = Math.max(0, this.life[i] / this.total[i]);
      this.alpha[i] = t * t * (0.75 + 0.25 * Math.sin(this.life[i] * 40)); // twinkle
    }
    this.points.visible = any;
    (this.geometry.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aAlpha') as BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('aSize') as BufferAttribute).needsUpdate = true;
  }
}
