/**
 * One Euro filter (Casiez, Roussel & Vogel, CHI 2012): adaptive low-pass that
 * smooths jitter when the input is slow and stays responsive when it is fast.
 * Used for fingertip positions, which jitter by a few millimetres on Quest.
 */
class LowPass {
  private y = 0;
  private initialised = false;
  filter(x: number, alpha: number): number {
    if (!this.initialised) {
      this.y = x;
      this.initialised = true;
    } else {
      this.y = alpha * x + (1 - alpha) * this.y;
    }
    return this.y;
  }
  last(): number {
    return this.y;
  }
  reset(): void {
    this.initialised = false;
  }
}

const alphaFor = (cutoff: number, dt: number): number => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuroFilter {
  private x = new LowPass();
  private dx = new LowPass();
  private hasPrev = false;
  private prev = 0;

  constructor(
    private minCutoff = 2.0,
    private beta = 20,
    private dCutoff = 1.0,
  ) {}

  filter(value: number, dt: number): number {
    const safeDt = dt > 1e-4 ? dt : 1 / 72;
    const derivative = this.hasPrev ? (value - this.prev) / safeDt : 0;
    this.prev = value;
    this.hasPrev = true;
    const edx = this.dx.filter(derivative, alphaFor(this.dCutoff, safeDt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, alphaFor(cutoff, safeDt));
  }

  reset(): void {
    this.x.reset();
    this.dx.reset();
    this.hasPrev = false;
  }
}

/** Three One Euro filters for a 3D point. Writes into the provided target. */
export class OneEuroFilter3 {
  private fx = new OneEuroFilter();
  private fy = new OneEuroFilter();
  private fz = new OneEuroFilter();

  filter(
    x: number,
    y: number,
    z: number,
    dt: number,
    out: { x: number; y: number; z: number },
  ): void {
    out.x = this.fx.filter(x, dt);
    out.y = this.fy.filter(y, dt);
    out.z = this.fz.filter(z, dt);
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
    this.fz.reset();
  }
}
