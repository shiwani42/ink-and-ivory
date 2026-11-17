import { DoubleSide, Group, Mesh, MeshBasicMaterial, type Quaternion, RingGeometry, type Vector3 } from '@iwsdk/core';

/**
 * Small visual cues for hand input, in world space (allocated once):
 *
 * - a poke cursor per hand: a ring on a menu panel under the fingertip that
 *   tightens and darkens as the finger nears the surface, the same language as
 *   the hover ring on the paper (Meta: "touch z-distance must be clearly
 *   communicated" for floating UI, since real hands feel no surface);
 * - a hold ring beside the thumb that fills while a thumbs-up is held, so the
 *   learner sees the gesture recognised before it acts.
 */
const SEGMENTS = 40;

export class HandCues {
  readonly root = new Group();
  private poke: Mesh[] = [];
  private holdBack: Mesh;
  private holdFill: Mesh;
  private holdGeo: RingGeometry;

  constructor() {
    this.root.name = 'hand-cues';
    const pokeGeo = new RingGeometry(0.0045, 0.0062, 32);
    for (let i = 0; i < 2; i++) {
      const mat = new MeshBasicMaterial({ color: 0xa8231a, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false });
      const ring = new Mesh(pokeGeo, mat);
      ring.renderOrder = 1000;
      ring.visible = false;
      ring.name = `poke-cursor-${i}`;
      this.root.add(ring);
      this.poke.push(ring);
    }
    this.holdBack = new Mesh(
      new RingGeometry(0.013, 0.018, SEGMENTS, 1),
      new MeshBasicMaterial({ color: 0xf4ede0, transparent: true, opacity: 0.35, depthTest: false, depthWrite: false }),
    );
    // Fills clockwise from twelve o'clock: drawRange grows six indices per segment.
    this.holdGeo = new RingGeometry(0.013, 0.018, SEGMENTS, 1, Math.PI / 2, -Math.PI * 2);
    this.holdFill = new Mesh(
      this.holdGeo,
      new MeshBasicMaterial({ color: 0xd4a017, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, side: DoubleSide }),
    );
    this.holdBack.renderOrder = 1000;
    this.holdFill.renderOrder = 1001;
    this.holdBack.name = 'thumbs-up-hold';
    this.holdBack.add(this.holdFill);
    this.holdBack.visible = false;
    this.root.add(this.holdBack);
  }

  hidePoke(slot: number): void {
    this.poke[slot].visible = false;
  }

  /**
   * Put a hand's poke cursor on the panel surface under the fingertip.
   * `depth` is the fingertip's distance in front of the surface (metres).
   */
  showPoke(slot: number, x: number, y: number, z: number, panelQuat: Quaternion, depth: number, range: number): void {
    const ring = this.poke[slot];
    const k = Math.min(1, Math.max(0, depth / range));
    ring.visible = true;
    ring.position.set(x, y, z);
    ring.quaternion.copy(panelQuat);
    ring.scale.setScalar(1 + 2.6 * k);
    (ring.material as MeshBasicMaterial).opacity = 0.95 - 0.6 * k;
  }

  /** The thumbs-up hold ring at `at`, facing `eye`; progress 0 hides it. */
  setHold(progress: number, at: Vector3, eye: Vector3): void {
    if (progress <= 0.02) {
      this.holdBack.visible = false;
      return;
    }
    this.holdBack.visible = true;
    this.holdBack.position.copy(at);
    this.holdBack.lookAt(eye);
    this.holdGeo.setDrawRange(0, 6 * Math.max(1, Math.round(SEGMENTS * Math.min(1, progress))));
  }

  hideAll(): void {
    this.poke[0].visible = false;
    this.poke[1].visible = false;
    this.holdBack.visible = false;
  }
}
