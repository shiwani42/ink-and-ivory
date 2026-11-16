import { Matrix4, Vector3 } from '@iwsdk/core';
import poseData from './point-pose.json';

/**
 * Builds the master's hand pose for any fingertip position on the paper.
 *
 * The base shape is IWER's "point" hand pose (MIT, Meta): index finger
 * extended, the way you write with a fingertip "air brush". We orient that
 * shape so the finger leans down onto the paper and slightly into the stroke,
 * then translate it so the index fingertip lands exactly on the target.
 *
 * Coordinates: paper-local metres, x right, y up off the paper, z toward the
 * writer. Output: 25 world-space joint matrices (column-major), in WebXR joint
 * order, ready for GhostHand.
 */

export const JOINT_COUNT = 25;
const TIP = 9; // index-finger-tip
const INDEX_PROXIMAL = 6;
const WRIST = 0;

export type Handedness = 'left' | 'right';

// IWER stores left-hand data; the right hand is its mirror image (S·M·S, S = diag(-1,1,1)).
const MIRROR = [1, -1, -1, 0, -1, 1, 1, 0, -1, 1, 1, 0, -1, 1, 1, 1];

export class GhostPoseBuilder {
  private readonly base: Matrix4[] = [];
  private readonly tipLocal = new Vector3();
  private readonly poseBasisInv = new Matrix4();
  private readonly sign: number;

  // scratch
  private readonly f = new Vector3();
  private readonly d = new Vector3();
  private readonly s = new Vector3();
  private readonly world = new Matrix4();
  private readonly q = new Matrix4();
  private readonly h = new Matrix4();
  private readonly m = new Matrix4();
  private readonly v = new Vector3();
  private readonly up = new Vector3(0, 1, 0);

  constructor(readonly handedness: Handedness) {
    this.sign = handedness === 'right' ? 1 : -1;
    const data = poseData as { matrices: number[][] };
    for (const arr of data.matrices) {
      const values =
        handedness === 'right' ? arr.map((x, i) => x * MIRROR[i]) : arr.slice();
      this.base.push(new Matrix4().fromArray(values));
    }
    const tip = new Vector3().setFromMatrixPosition(this.base[TIP]);
    const proximal = new Vector3().setFromMatrixPosition(this.base[INDEX_PROXIMAL]);
    this.tipLocal.copy(tip);
    const f = tip.clone().sub(proximal).normalize();
    const d = new Vector3().setFromMatrixColumn(this.base[WRIST], 1); // back of hand
    d.addScaledVector(f, -d.dot(f)).normalize();
    const s = new Vector3().crossVectors(f, d);
    const basis = new Matrix4().makeBasis(f, d, s);
    this.poseBasisInv.copy(basis).transpose();
  }

  /**
   * @param paperWorld paper-local -> world matrix
   * @param tx,ty,tz fingertip target in paper-local metres
   * @param leanX,leanZ in-plane travel direction (unit or zero) to lean into
   * @param out 25*16 floats, world joint matrices
   */
  compose(
    paperWorld: Matrix4,
    tx: number,
    ty: number,
    tz: number,
    leanX: number,
    leanZ: number,
    out: Float32Array,
    steep = false,
  ): void {
    // Finger direction: down onto the paper, away from the writer, toward the
    // hand's own side, leaning a little into the current stroke.
    // The hand comes in from the writer's side (lower right for a right hand),
    // so from the writer's eyes it reads as a clear silhouette, not end-on.
    if (steep) this.f.set(-0.22 * this.sign, -0.82, -0.52).normalize(); // a pianist's arched finger
    else this.f.set(-0.5 * this.sign + 0.2 * leanX, -0.5, -0.7 + 0.2 * leanZ).normalize();
    // Back of the hand faces up and slightly outward.
    this.d.set(0.3 * this.sign, 1, 0.1);
    this.d.addScaledVector(this.f, -this.d.dot(this.f)).normalize();
    this.s.crossVectors(this.f, this.d);
    this.q.makeBasis(this.f, this.d, this.s).multiply(this.poseBasisInv);

    // Translate so the rotated fingertip lands on the target.
    this.v.copy(this.tipLocal).applyMatrix4(this.q);
    this.h.copy(this.q).setPosition(tx - this.v.x, ty - this.v.y, tz - this.v.z);

    this.world.multiplyMatrices(paperWorld, this.h);
    for (let i = 0; i < JOINT_COUNT; i++) {
      this.m.multiplyMatrices(this.world, this.base[i]);
      this.m.toArray(out, i * 16);
    }
  }

  /** Paper-local up vector, kept for callers that need it. */
  get upVector(): Vector3 {
    return this.up;
  }
}
