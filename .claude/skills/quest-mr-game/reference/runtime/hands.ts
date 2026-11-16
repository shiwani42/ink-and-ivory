import { Matrix4, Quaternion, Vector3 } from '@iwsdk/core';

/**
 * Raw WebXR hand joints → the few signals the game needs:
 *  - pinch with hysteresis (separate start/release distances, so it never
 *    flickers),
 *  - pinch point, index fingertip, palm position/orientation in world space,
 *  - release velocity from a ~120 ms ring buffer with a least-squares fit
 *    (one noisy frame can't ruin a throw),
 *  - tracking-loss grace: hold the last good pose ~150 ms; if tracking drops
 *    mid-throw the dice are released with the last good velocity.
 * Controllers fall back to grip pose + select (trigger) as "pinch".
 */

const PINCH_START = 0.022;
const PINCH_END = 0.04;
const BUFFER_MS = 140;
/** Ignore the last few frames: fingers opening make the release jittery. */
const SKIP_RECENT_MS = 40;
const LOST_GRACE_MS = 150;

interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
}

export class HandState {
  readonly side: 'left' | 'right';
  tracked = false;
  isHand = false;
  pinching = false;
  pinchStarted = false;
  pinchEnded = false;
  pinchDist = 1;
  readonly pinchPoint = new Vector3();
  readonly indexTip = new Vector3();
  readonly palm = new Vector3();
  readonly palmQuat = new Quaternion();
  readonly velocity = new Vector3();
  /** Seconds the hand has been continuously tracked. */
  trackedFor = 0;

  private lastSeen = -1e9;
  private buf: Sample[] = [];
  private bufHead = 0;
  private readonly m = new Matrix4();
  private readonly v = new Vector3();
  private readonly q = new Quaternion();
  private readonly s = new Vector3();

  constructor(side: 'left' | 'right') {
    this.side = side;
    for (let i = 0; i < 24; i++) this.buf.push({ t: -1e9, x: 0, y: 0, z: 0 });
  }

  private toWorld(pose: XRPose | undefined | null, origin: Matrix4, out: Vector3, quat?: Quaternion): boolean {
    if (!pose) return false;
    this.m.fromArray(pose.transform.matrix as unknown as number[]);
    this.m.premultiply(origin);
    this.m.decompose(out, quat ?? this.q, this.s);
    return true;
  }

  update(
    frame: XRFrame | undefined,
    ref: XRReferenceSpace | null,
    src: XRInputSource | undefined,
    origin: Matrix4,
    selectActive: boolean,
    nowMs: number,
    dt: number,
  ): void {
    this.pinchStarted = false;
    this.pinchEnded = false;
    let ok = false;

    if (frame && ref && src) {
      if (src.hand) {
        this.isHand = true;
        const hand = src.hand;
        const get = (name: XRHandJoint) => {
          const space = hand.get(name);
          return space ? frame.getJointPose?.(space, ref) : undefined;
        };
        const thumb = get('thumb-tip');
        const index = get('index-finger-tip');
        const wrist = get('wrist');
        const midMeta = get('middle-finger-metacarpal');
        if (thumb && index && wrist) {
          const tp = this.v;
          this.toWorld(thumb, origin, tp);
          const tx = tp.x, ty = tp.y, tz = tp.z;
          this.toWorld(index, origin, this.indexTip);
          this.pinchDist = Math.hypot(
            this.indexTip.x - tx,
            this.indexTip.y - ty,
            this.indexTip.z - tz,
          );
          this.pinchPoint.set(
            (this.indexTip.x + tx) / 2,
            (this.indexTip.y + ty) / 2,
            (this.indexTip.z + tz) / 2,
          );
          this.toWorld(midMeta ?? wrist, origin, this.palm, this.palmQuat);
          const want = this.pinching
            ? this.pinchDist < PINCH_END
            : this.pinchDist < PINCH_START;
          this.setPinch(want);
          ok = true;
        }
      } else if (src.gripSpace) {
        this.isHand = false;
        const pose = frame.getPose(src.gripSpace, ref);
        if (this.toWorld(pose, origin, this.palm, this.palmQuat)) {
          // a point ~6 cm ahead of the grip stands in for the pinch point
          this.v.set(0, -0.01, -0.06).applyQuaternion(this.palmQuat);
          this.pinchPoint.copy(this.palm).add(this.v);
          this.indexTip.copy(this.pinchPoint);
          this.pinchDist = selectActive ? 0 : 0.1;
          this.setPinch(selectActive);
          ok = true;
        }
      }
    }

    if (ok) {
      this.lastSeen = nowMs;
      this.tracked = true;
      this.trackedFor += dt;
      const s = this.buf[this.bufHead];
      s.t = nowMs;
      s.x = this.pinchPoint.x;
      s.y = this.pinchPoint.y;
      s.z = this.pinchPoint.z;
      this.bufHead = (this.bufHead + 1) % this.buf.length;
      this.fitVelocity(nowMs);
    } else if (this.tracked && nowMs - this.lastSeen > LOST_GRACE_MS) {
      // Tracking really lost: release whatever we hold with the last velocity.
      this.tracked = false;
      this.trackedFor = 0;
      if (this.pinching) this.setPinch(false);
    }
  }

  private setPinch(on: boolean): void {
    if (on && !this.pinching) this.pinchStarted = true;
    if (!on && this.pinching) this.pinchEnded = true;
    this.pinching = on;
  }

  /** Least-squares slope of position over 140–40 ms ago. */
  private fitVelocity(now: number): void {
    let n = 0, st = 0, stt = 0, sx = 0, sy = 0, sz = 0, stx = 0, sty = 0, stz = 0;
    for (const s of this.buf) {
      const age = now - s.t;
      if (age > BUFFER_MS || age < SKIP_RECENT_MS) continue;
      const t = -age / 1000;
      n++;
      st += t;
      stt += t * t;
      sx += s.x; sy += s.y; sz += s.z;
      stx += t * s.x; sty += t * s.y; stz += t * s.z;
    }
    const den = n * stt - st * st;
    if (n < 3 || Math.abs(den) < 1e-9) return;
    this.velocity.set(
      (n * stx - st * sx) / den,
      (n * sty - st * sy) / den,
      (n * stz - st * sz) / den,
    );
  }
}

export class Hands {
  readonly left = new HandState('left');
  readonly right = new HandState('right');
  readonly both = [this.left, this.right] as const;
}
