import { Matrix4, type Object3D, SceneUnderstandingSystem, type World } from '@iwsdk/core';

/**
 * Remembers where the desk sat on the real table, so next session it comes
 * back to the same spot in the room.
 *
 * IWSDK 1.1.0 already keeps one persistent anchor: SceneUnderstandingSystem
 * creates an XRAnchor at the reference-space origin, stores its persistent
 * handle (`requestPersistentHandle`) in localStorage under
 * `iwsdk_scene_anchor_uuid`, and restores it next session
 * (`restorePersistentAnchor`). Everything with an XRAnchor component is
 * re-parented under that anchor's group. So the desk's pose *relative to that
 * group* is a pose in the real room. We save that, and only trust it again when
 * the very same anchor came back (same UUID, anchor live).
 *
 * Limits (Quest Browser): persistence needs the `anchors` feature, survives
 * only in the same browser profile (not private browsing), and a room
 * re-scan can drop saved anchors.
 */

const KEY = 'hoam-desk-spot';
const IWSDK_ANCHOR_KEY = 'iwsdk_scene_anchor_uuid';
/** How long the first placement waits for IWSDK to restore its anchor, seconds. */
export const RESTORE_WAIT = 1.5;

interface Saved {
  v: 1;
  uuid: string;
  m: number[];
  kind: string;
  at: number;
}

type AnchorInternals = { anchoredGroup?: Object3D; xrAnchor?: unknown };

export type Recall =
  | { state: 'none' } // nothing saved, or not armed this session
  | { state: 'pending' } // saved, waiting for the anchor to be restored
  | { state: 'lost'; why: string } // the anchor did not come back, or the spot is out of reach
  | { state: 'ready'; x: number; y: number; z: number; yaw: number; kind: string };

function read(): Saved | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const s = JSON.parse(raw) as Saved;
    return s && s.v === 1 && Array.isArray(s.m) && s.m.length === 16 && typeof s.uuid === 'string' ? s : undefined;
  } catch {
    return undefined;
  }
}

function anchorUuid(): string | null {
  try {
    return localStorage.getItem(IWSDK_ANCHOR_KEY);
  } catch {
    return null;
  }
}

export class DeskMemory {
  private armed = false;
  private waited = 0;
  private pendingSave?: { kind: string; until: number };
  private clock = 0;
  private group = new Matrix4();
  private local = new Matrix4();
  private world = new Matrix4();

  constructor(private readonly w: World) {}

  private internals(): AnchorInternals | undefined {
    return this.w.getSystem(SceneUnderstandingSystem) as unknown as AnchorInternals | undefined;
  }

  /** Call once per XR session: the first placement may use the saved spot. */
  arm(): void {
    this.armed = true;
    this.waited = 0;
  }

  /** The first placement ends (whatever won): later re-placements never jump back. */
  disarm(): void {
    this.armed = false;
  }

  /**
   * During the first placement of a session: where the desk was last time, if
   * the persistent anchor is back and that spot is within reach of the head.
   */
  recall(dt: number, head: { x: number; y: number; z: number }): Recall {
    if (!this.armed) return { state: 'none' };
    const saved = read();
    if (!saved) return { state: 'none' };
    this.waited += dt;
    const su = this.internals();
    const uuid = anchorUuid();
    const live = !!su?.xrAnchor && !!su.anchoredGroup;
    if (!live || uuid === null) {
      return this.waited < RESTORE_WAIT ? { state: 'pending' } : { state: 'lost', why: su ? 'anchor not restored' : 'no scene understanding' };
    }
    if (uuid !== saved.uuid) return { state: 'lost', why: 'a different anchor (the saved one was not restored)' };
    const group = su.anchoredGroup!;
    group.updateWorldMatrix(true, false);
    this.world.multiplyMatrices(group.matrixWorld, this.local.fromArray(saved.m));
    const e = this.world.elements;
    const x = e[12], y = e[13], z = e[14];
    const reach = Math.hypot(x - head.x, z - head.z);
    if (reach > 1.0 || y > head.y - 0.1 || y < head.y - 1.0) {
      return { state: 'lost', why: `out of reach (${reach.toFixed(2)} m away, ${(head.y - y).toFixed(2)} m below the eyes)` };
    }
    return { state: 'ready', x, y, z, yaw: Math.atan2(e[8], e[10]), kind: saved.kind };
  }

  /** After a placement on a real table. Retries for a few seconds while IWSDK's anchor is still being created. */
  remember(desk: Object3D, kind: string): void {
    void desk; // saved by the next tick(), which reports the result for the log
    this.pendingSave = { kind, until: this.clock + 5 };
  }

  /** Per frame; returns at once unless a save is waiting for the anchor. */
  tick(dt: number, desk: Object3D): string | undefined {
    this.clock += dt;
    const p = this.pendingSave;
    if (!p) return undefined;
    if (this.clock > p.until) {
      this.pendingSave = undefined;
      return 'desk spot not saved (no persistent anchor)';
    }
    const su = this.internals();
    const uuid = anchorUuid();
    if (!su?.xrAnchor || !su.anchoredGroup || !uuid) return undefined;
    su.anchoredGroup.updateWorldMatrix(true, false);
    desk.updateWorldMatrix(true, false);
    this.local.copy(this.group.copy(su.anchoredGroup.matrixWorld).invert()).multiply(desk.matrixWorld);
    const saved: Saved = { v: 1, uuid, m: Array.from(this.local.elements), kind: p.kind, at: Date.now() };
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // private browsing or storage full: placement simply is not remembered
    }
    this.pendingSave = undefined;
    return `desk spot saved (${p.kind}, anchor ${uuid.slice(0, 8)})`;
  }

  forget(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
}
