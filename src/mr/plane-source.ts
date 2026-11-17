import { type Entity, XRPlane } from '@iwsdk/core';
import type { PlaneInput } from './room-placement.js';

/**
 * Copies IWSDK's detected-plane entities into a reusable list for
 * `findTableSpot` (no allocation once the pool has grown). Returns the count.
 */
export function gatherPlanes(entities: Iterable<Entity>, pool: PlaneInput[]): number {
  let n = 0;
  for (const entity of entities) {
    const plane = entity.getValue(XRPlane, '_plane') as (XRPlane & { semanticLabel?: string }) | undefined;
    const obj = entity.object3D;
    if (!plane || !obj) continue;
    obj.updateWorldMatrix(true, false);
    const slot = pool[n] ?? (pool[n] = { orientation: '', label: '', polygon: [], matrix: [] });
    slot.orientation = plane.orientation;
    slot.label = plane.semanticLabel ?? '';
    slot.polygon = plane.polygon;
    slot.matrix = obj.matrixWorld.elements;
    n++;
  }
  return n;
}
