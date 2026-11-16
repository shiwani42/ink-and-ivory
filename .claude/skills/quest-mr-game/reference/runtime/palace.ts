import {
  BackSide,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from '@iwsdk/core';

/**
 * The dice hall of Hastinapur, around the player: a 360° painted backdrop
 * (FLUX.1-schnell, Apache-2.0; see tools/freegen/palace.py) on an inside-out dome.
 *
 * In mixed reality the dome is opaque on the walls and fades out below ~15° under the
 * horizon, so the player's REAL table, hands and floor stay passthrough (the table edge
 * matters to the cheat). It is revealed as Shakuni materialises.
 */
export class Palace {
  readonly mesh: Mesh;
  private mat: ShaderMaterial;
  private reveal = 0;
  private target = 0;

  constructor(url: string, radius = 2.8) {
    this.mat = new ShaderMaterial({
      uniforms: {
        uMap: { value: null as Texture | null },
        uReveal: { value: 0 },
        uFloorFade: { value: 1 }, // 1 in MR (keep the real floor), 0 on desktop (full dome)
        uBright: { value: 0.95 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir; varying vec2 vUv;
        void main(){
          vUv = uv;
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uMap; uniform float uReveal; uniform float uFloorFade; uniform float uBright;
        varying vec3 vDir; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(uMap, vUv).rgb * uBright;
          float elev = asin(clamp(vDir.y, -1.0, 1.0));            // radians
          float walls = smoothstep(radians(-36.0), radians(-14.0), elev);
          float a = mix(1.0, walls, uFloorFade) * uReveal;
          // a little vignette toward the ceiling keeps the eye on the table
          c *= mix(0.55, 1.0, smoothstep(radians(70.0), radians(20.0), elev));
          gl_FragColor = vec4(c, a);
          #include <colorspace_fragment>
        }`,
      side: BackSide,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new Mesh(new SphereGeometry(radius, 64, 32), this.mat);
    this.mesh.name = 'palace';
    this.mesh.renderOrder = -60;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    new TextureLoader().load(url, (t) => {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
      this.mat.uniforms.uMap.value = t;
    });
  }

  /** 1 = palace, 0 = your room. */
  fadeTo(v: number): void {
    this.target = v;
  }

  setMixedReality(mr: boolean): void {
    this.mat.uniforms.uFloorFade.value = mr ? 1 : 0;
  }

  update(dt: number): void {
    this.reveal += (this.target - this.reveal) * (1 - Math.exp(-dt * 1.4));
    this.mat.uniforms.uReveal.value = this.reveal;
    this.mesh.visible = this.reveal > 0.01 && !!this.mat.uniforms.uMap.value;
  }
}
