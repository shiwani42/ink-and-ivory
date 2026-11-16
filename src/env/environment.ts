import {
  AssetManager,
  BackSide,
  Color,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
} from '@iwsdk/core';

/**
 * Immersive surroundings: a real 360-degree photograph on an inside-out sphere
 * that follows the head, so it reads as infinitely far away with no parallax.
 *
 * One world at a time: you are either in your own room (passthrough) or fully
 * in the place. Switching between them is an ink-bleed dissolve: blots of
 * the new world appear and spread until they join, like ink soaking into
 * washi.
 */

export interface SceneDef {
  id: string;
  name: string;
  panorama: string; // public path, 4096x2048 equirect JPG
  light: string; // public path used for image-based lighting (HDR or the panorama itself)
  credit: string;
  tracks: string[]; // public paths, may be empty
  yaw: number; // radians, rotates the panorama around the user
  /**
   * How far the place recedes so the paper stays the focus: 0 = crisp photo,
   * 1 = soft focus, muted colour and a warm washi haze (calm).
   */
  calm: number;
}

export const SCENES: Record<string, SceneDef> = {
  japan: {
    // The veranda of Kennin-ji's moss garden, Kyoto's oldest Zen temple, with
    // a calligraphy scroll on the wall: where shodo is practised.
    id: 'japan',
    name: 'Kennin-ji, Kyoto',
    panorama: 'env/kenninji.jpg',
    light: 'env/kenninji.jpg',
    credit: 'Kennin-ji 360 by AsPJT, CC0, via Wikimedia Commons',
    tracks: ['audio/practice-somber.mp3', 'audio/practice-yoiyami.mp3'],
    yaw: Math.PI * 0.5 - 1.05, // face the moss garden, not the corridor
    calm: 1,
  },
  china: {
    id: 'china',
    name: 'Classical Chinese garden',
    panorama: 'env/china_garden.jpg',
    light: 'env/china_garden.hdr',
    credit: 'Chinese Garden HDRI, Poly Haven, CC0',
    tracks: ['audio/zh-asianoriental1.mp3', 'audio/zh-asianoriental2.mp3'],
    yaw: Math.PI * 0.5,
    calm: 1,
  },
  music: {
    id: 'music',
    name: 'Music room',
    panorama: 'env/music_room.jpg',
    light: 'env/music_room.hdr',
    credit: 'Ballroom HDRI, Poly Haven, CC0',
    tracks: [],
    yaw: Math.PI,
    calm: 0,
  },
};

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform float uOpacity; // 0 = your room, 1 = the place (dissolve progress)
  uniform float uYaw;
  uniform float uCalm;
  uniform vec3 uHaze;
  // Value noise on the sphere, for ink blots.
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise3(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float lon = atan(d.z, d.x) + uYaw;
    vec2 uv = vec2(fract(lon * 0.15915494 + 0.5), asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
    // Soft focus via a mip bias (cheap blur), then muted colour and warm haze.
    vec3 c = texture2D(uMap, uv, uCalm * 3.2).rgb;
    float luma = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(luma), uCalm * 0.5);
    c = mix(c, uHaze, uCalm * 0.32);
    c *= 1.0 - uCalm * 0.08;
    // Ink-bleed dissolve: blots (two octaves of noise) open first, then join.
    float n = noise3(d * 3.0) * 0.65 + noise3(d * 9.0) * 0.35;
    float edge = uOpacity * 1.25 - 0.12;
    float a = smoothstep(n - 0.05, n + 0.05, edge);
    // A dark ink rim at the spreading edge.
    float rim = smoothstep(0.07, 0.0, abs(edge - n)) * (1.0 - step(0.999, uOpacity));
    c = mix(c, vec3(0.08, 0.07, 0.06), rim * 0.65);
    gl_FragColor = vec4(c, a);
    #include <colorspace_fragment>
  }
`;

export class Environment {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private current?: SceneDef;
  private target = 1;
  private loading = 0;

  constructor() {
    this.material = new ShaderMaterial({
      uniforms: {
        uMap: { value: null },
        uOpacity: { value: 0 },
        uYaw: { value: 0 },
        uCalm: { value: 0 },
        uHaze: { value: new Color('#efe5d3') },
      },
      vertexShader,
      fragmentShader,
      side: BackSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new Mesh(new SphereGeometry(40, 64, 32), this.material);
    this.mesh.renderOrder = -100;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get scene(): SceneDef | undefined {
    return this.current;
  }

  /** Switch scenes with a short fade through passthrough. Returns once loaded. */
  async show(scene: SceneDef, baseUrl: string): Promise<void> {
    if (this.current?.id === scene.id && this.material.uniforms.uMap.value) {
      this.target = 1;
      return;
    }
    this.current = scene;
    const ticket = ++this.loading;
    // Dissolve the old place away before the new one bleeds in.
    if (this.material.uniforms.uMap.value) {
      this.target = 0;
      await new Promise((r) => setTimeout(r, Math.min(2400, this.amount * 2400) + 50));
      if (ticket !== this.loading) return;
    }
    let tex: Texture | null = null;
    try {
      tex = await AssetManager.loadTexture(`${baseUrl}${scene.panorama}`, `pano-${scene.id}`);
    } catch (error) {
      console.warn('[hands-of-a-master] panorama failed to load', error);
    }
    if (ticket !== this.loading || !tex) return;
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    this.material.uniforms.uMap.value = tex;
    this.material.uniforms.uYaw.value = scene.yaw;
    this.material.uniforms.uCalm.value = scene.calm;
    tex.wrapS = RepeatWrapping; // no seam where the panorama wraps
    tex.generateMipmaps = true;
    tex.minFilter = LinearMipmapLinearFilter;
    this.mesh.visible = true;
    this.target = 1;
  }

  hide(): void {
    this.target = 0;
  }

  /** Jump straight to your own room (no dissolve), e.g. on entering the headset. */
  snapToRoom(): void {
    this.target = 0;
    this.material.uniforms.uOpacity.value = 0;
    this.mesh.visible = false;
  }

  /** 0 = your room, 1 = fully in the place. */
  get amount(): number {
    return this.material.uniforms.uOpacity.value as number;
  }

  /** Follow the head (no parallax) and run the dissolve (about 2.4 s). */
  update(dt: number, headX: number, headY: number, headZ: number): void {
    this.mesh.position.set(headX, headY, headZ);
    const u = this.material.uniforms;
    const step = dt / 2.4;
    u.uOpacity.value = this.target > u.uOpacity.value
      ? Math.min(this.target, u.uOpacity.value + step)
      : Math.max(this.target, u.uOpacity.value - step);
    this.mesh.visible = u.uOpacity.value > 0.001 && !!u.uMap.value;
  }
}
