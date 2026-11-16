import {
  DirectionalLight,
  Mesh,
  Object3D,
  Quaternion,
  Vector3,
  type World,
} from '@iwsdk/core';

/**
 * Board-sized, on-demand shadows (the HandCraft XR recipe).
 *
 * The scene authors one shadow-casting DirectionalLight on node "key-light"
 * with a tight ortho shadow camera (≈1 m) and near/far bracketing
 * AIM_DISTANCE. The board lives under a runtime Group, so every frame we slide
 * the light node along its own direction until the shadow camera is centred
 * on the board. The light's direction (and so the lighting) never changes.
 *
 * The shadow map re-renders only when something watched moves (pieces, dice,
 * gong, board placement) or when requestShadowUpdate() is called, instead of
 * every frame.
 */

/** Distance from the board to the light along the light direction (m). */
export const AIM_DISTANCE = 1.5;

const FWD = new Vector3(0, 0, -1);
const tmpV = new Vector3();
const tmpQ = new Quaternion();

/** Find the three.js DirectionalLight that IWSDK created for a scene node. */
export function findSceneLight(world: World, nodeId = 'key-light'): DirectionalLight | null {
  const node = world.getSceneObject?.(nodeId);
  if (!node) return null;
  let found: DirectionalLight | null = null;
  node.traverse((o) => {
    if (!found && (o as DirectionalLight).isDirectionalLight) found = o as DirectionalLight;
  });
  return found;
}

/**
 * Slide the light's scene node so the shadow camera is centred on `worldPos`.
 * Returns true when the node actually moved (> 0.5 mm).
 */
export function aimShadowAt(light: DirectionalLight, worldPos: Vector3, distance = AIM_DISTANCE): boolean {
  const node = light.parent;
  if (!node) return false;
  node.updateWorldMatrix(true, false);
  node.getWorldQuaternion(tmpQ);
  tmpV.copy(FWD).applyQuaternion(tmpQ).multiplyScalar(-distance).add(worldPos);
  if (node.parent) node.parent.worldToLocal(tmpV);
  if (tmpV.distanceToSquared(node.position) < 2.5e-7) return false;
  node.position.copy(tmpV);
  node.updateMatrixWorld(true);
  return true;
}

/**
 * three.js never recompiles a material when renderer.shadowMap.enabled flips,
 * and the level (scene JSON `environment.shadows`) turns it on after the game
 * may already have rendered its first frames. Mark every shadow-relevant
 * material under `root` for recompile (one-time hitch).
 */
export function refreshShadowMaterials(root: Object3D): void {
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || !(m.castShadow || m.receiveShadow)) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) mat.needsUpdate = true;
  });
}

export class ShadowRig {
  light: DirectionalLight | null = null;
  private readonly world: World;
  private readonly nodeId: string;
  private pending = 2;
  private readonly watched: Object3D[] = [];
  private lastPos: Float32Array = new Float32Array(0);
  private readonly target = new Vector3();
  private shadowsOn = false;

  constructor(world: World, nodeId = 'key-light') {
    this.world = world;
    this.nodeId = nodeId;
  }

  /** Objects whose motion should refresh the shadow map (pieces, dice, gong disc…). */
  watch(...objs: Object3D[]): void {
    this.watched.push(...objs);
    this.lastPos = new Float32Array(this.watched.length * 8);
  }

  /** Re-render the shadow map for the next `frames` frames. */
  requestShadowUpdate(frames = 2): void {
    this.pending = Math.max(this.pending, frames);
  }

  /** Call once per frame with the board's root (or anchor). */
  update(board: Object3D): void {
    const enabled = this.world.renderer.shadowMap.enabled;
    if (enabled !== this.shadowsOn) {
      this.shadowsOn = enabled;
      refreshShadowMaterials(this.world.scene);
      this.pending = Math.max(this.pending, 3);
    }
    if (!this.light) {
      this.light = findSceneLight(this.world, this.nodeId);
      if (!this.light) return;
      this.light.shadow.autoUpdate = false;
      refreshShadowMaterials(this.world.scene);
      this.pending = 3;
    }
    board.getWorldPosition(this.target);
    if (aimShadowAt(this.light, this.target)) this.pending = Math.max(this.pending, 2);
    if (!board.visible) return;
    // motion detection on watched objects (local pose; cheap, no allocation)
    const lp = this.lastPos;
    for (let i = 0; i < this.watched.length; i++) {
      const o = this.watched[i];
      const p = o.position;
      const q = o.quaternion;
      const k = i * 8;
      if (
        Math.abs(lp[k] - p.x) + Math.abs(lp[k + 1] - p.y) + Math.abs(lp[k + 2] - p.z) > 2e-4 ||
        Math.abs(lp[k + 3] - q.x) + Math.abs(lp[k + 4] - q.y) + Math.abs(lp[k + 5] - q.z) + Math.abs(lp[k + 6] - q.w) > 1e-3 ||
        Math.abs(lp[k + 7] - o.scale.y) > 1e-3
      ) {
        lp[k] = p.x; lp[k + 1] = p.y; lp[k + 2] = p.z;
        lp[k + 3] = q.x; lp[k + 4] = q.y; lp[k + 5] = q.z; lp[k + 6] = q.w;
        lp[k + 7] = o.scale.y;
        this.pending = Math.max(this.pending, 2);
      }
    }
    if (this.pending > 0) {
      this.light.shadow.needsUpdate = true;
      this.pending--;
    }
  }
}
