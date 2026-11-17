/**
 * Hand poses read from the 25 WebXR hand joints (no Interaction SDK in the
 * browser, so this is our own small pose detector), plus a hold gate that turns
 * a per-frame confidence into one deliberate action.
 *
 * Joint order (WebXR Hand Input): 0 wrist; thumb 1-4 (metacarpal, proximal,
 * distal, tip); then index 5-9, middle 10-14, ring 15-19, pinky 20-24, each
 * metacarpal, phalanx-proximal (the knuckle), intermediate, distal, tip.
 * Buffers are 25 column-major 4x4 matrices from `XRFrame.fillPoses`.
 */

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function dist(b: Float32Array, i: number, j: number): number {
  const a = i * 16 + 12;
  const c = j * 16 + 12;
  return Math.hypot(b[a] - b[c], b[a + 1] - b[c + 1], b[a + 2] - b[c + 2]);
}

/** Knuckle (phalanx-proximal) and tip joints of the four fingers. */
const KNUCKLES = [6, 11, 16, 21];
const TIPS = [9, 14, 19, 24];

/**
 * Thumbs up, 0..1: all four fingers curled into the palm, the thumb clear of
 * the fist and pointing up (world +Y). Each test is a soft ramp and the result
 * is the weakest of them, so a half-made pose scores low rather than passing on
 * one strong cue. A pointing hand (writing, playing) scores 0.
 */
export function thumbsUpConfidence(b: Float32Array): number {
  let c = 1;
  for (let f = 0; f < 4; f++) {
    // Extended fingers reach 7-9 cm from their knuckle; curled ones tuck to 3-4 cm.
    c = Math.min(c, clamp01((0.062 - dist(b, TIPS[f], KNUCKLES[f])) / 0.02));
  }
  // The thumb tip stands clear of the index knuckle (not tucked along the fist).
  c = Math.min(c, clamp01((dist(b, 4, 6) - 0.032) / 0.018));
  // And it points up: proximal joint to tip, world up component.
  const len = Math.max(1e-6, dist(b, 2, 4));
  const upY = (b[4 * 16 + 13] - b[2 * 16 + 13]) / len;
  c = Math.min(c, clamp01((upY - 0.55) / 0.25));
  return c;
}

/**
 * A pose has to be held, steadily, before it acts: it fills over `hold`
 * seconds while confidence stays above `on` (brief dips under `graceS` are
 * forgiven), fires once, then stays latched until the hand clearly leaves the
 * pose. That is the difference between a gesture and a hand that happens to
 * pass through the shape.
 */
export class HoldGate {
  progress = 0;
  private latched = false;
  private below = 0;

  constructor(
    private hold = 0.6,
    private on = 0.7,
    private off = 0.35,
    private graceS = 0.12,
  ) {}

  /** Returns true on the frame the gesture completes. */
  update(confidence: number, dt: number): boolean {
    if (this.latched) {
      this.progress = 0;
      this.below = confidence < this.off ? this.below + dt : 0;
      if (this.below > 0.3) {
        this.latched = false;
        this.below = 0;
      }
      return false;
    }
    if (confidence >= this.on) {
      this.below = 0;
      this.progress = Math.min(1, this.progress + dt / this.hold);
    } else {
      this.below += dt;
      if (this.below > this.graceS) this.progress = Math.max(0, this.progress - (dt * 2) / this.hold);
    }
    if (this.progress >= 1) {
      this.progress = 0;
      this.latched = true;
      this.below = 0;
      return true;
    }
    return false;
  }

  /** Start fresh; `latched` true means the hand must leave the pose first. */
  reset(latched = false): void {
    this.progress = 0;
    this.below = 0;
    this.latched = latched;
  }
}
