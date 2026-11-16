import { createSystem, VisibilityState } from '@iwsdk/core';

/**
 * Session tuning for Quest (see the common build plan, section 2):
 * - ask for 72 Hz, which is the most forgiving refresh rate that passes the
 *   60 fps rule;
 * - lower fixed foveation from three.js's default of 1.0 (maximum), because
 *   this app is read up close (ink strokes, captions);
 * - pause the world while the system menu has focus.
 */
export class XrPerfSystem extends createSystem({}) {
  init(): void {
    this.cleanupFuncs.push(
      this.world.visibilityState.subscribe((state) => {
        if (state === VisibilityState.Visible) {
          const session = this.world.session as
            | (XRSession & { updateTargetFrameRate?: (r: number) => Promise<void> })
            | undefined;
          session?.updateTargetFrameRate?.(72).catch(() => undefined);
          this.renderer.xr.setFoveation(0.4);
        }
      }),
    );
  }
}
