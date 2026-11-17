/**
 * Room-aware placement: choose where the writing set (or keyboard) lands among
 * the planes Quest reports, for rooms we never tested.
 *
 * Pure maths, no three.js and no allocation per call beyond the result object,
 * so `node tools/test-room-placement.mjs` can run it against synthetic rooms
 * (tiny table, slanted plane, couch, no table, round table).
 *
 * Plane conventions (WebXR plane detection): a plane's pose is a rigid
 * transform whose local Y is the surface normal; `polygon` lies in its local
 * XZ plane. `matrix` is that pose in world space (column-major, as three.js
 * `Matrix4.elements`).
 */

export interface PlaneInput {
  orientation: string; // 'horizontal' | 'vertical'
  label: string; // semanticLabel, '' when Quest gives none
  polygon: ReadonlyArray<{ x: number; z: number }>;
  matrix: ArrayLike<number>;
}

export type SpotKind = 'table' | 'small-table';

export interface Spot {
  kind: SpotKind;
  x: number;
  y: number;
  z: number;
  label: string;
  /** Plane size (bounding box in its own XZ), metres. */
  width: number;
  depth: number;
}

/** Why planes were passed over (for the dev log and the on-device report). */
export interface PlacementReport {
  planes: number;
  vertical: number;
  floorOrCeiling: number;
  softOrNotATable: number;
  slanted: number;
  wrongHeight: number;
  tiny: number;
  tooFar: number;
  small: number;
  fits: number;
}

/** A horizontal plane may tilt this much (cos of 6 degrees; over 22 cm that is a 2.3 cm rise) and still hold paper. */
export const MAX_TILT_COS = 0.9945;
/** Smallest surface worth using at all, metres per side (smaller is a stool or noise). */
export const MIN_SIDE = 0.2;
/** Radius of the writing set's footprint (mat, paper, inkstone), metres. */
export const FOOTPRINT_R = 0.22;
/** Furthest a spot may be from the ideal point in front of the learner, metres. */
export const MAX_REACH = 0.6;

/**
 * Labels that are never a writing surface. Quest's plane labels include table,
 * couch, bed, storage, screen, lamp, plant, wall_art, door_frame, window_frame,
 * other (and floor, ceiling, wall). Unlabelled or 'other' surfaces at desk
 * height are allowed: many people never label furniture in Space Setup.
 */
const NOT_A_DESK = new Set(['couch', 'bed', 'screen', 'lamp', 'plant', 'wall_art', 'wall', 'door_frame', 'window_frame']);
const DESK_LABELS = new Set(['table', 'desk']);

export function resetReport(r: PlacementReport): PlacementReport {
  r.planes = r.vertical = r.floorOrCeiling = r.softOrNotATable = r.slanted = r.wrongHeight = r.tiny = r.tooFar = r.small = r.fits = 0;
  return r;
}

export function emptyReport(): PlacementReport {
  return { planes: 0, vertical: 0, floorOrCeiling: 0, softOrNotATable: 0, slanted: 0, wrongHeight: 0, tiny: 0, tooFar: 0, small: 0, fits: 0 };
}

export function normaliseLabel(label: string | undefined): string {
  return (label ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

export function pointInPolygon(polygon: ReadonlyArray<{ x: number; z: number }>, x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function footprintInside(polygon: ReadonlyArray<{ x: number; z: number }>, x: number, z: number, r = FOOTPRINT_R): boolean {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (!pointInPolygon(polygon, x + Math.cos(a) * r, z + Math.sin(a) * r)) return false;
  }
  return pointInPolygon(polygon, x, z);
}

/**
 * The best spot for the writing set, or null (then the caller uses a virtual desk).
 *
 * - Only horizontal planes, tilted under 6 degrees, 0.12 to 0.95 m below
 *   the eyes (a seated or standing desk), at least 20 cm a side, and not a
 *   couch, bed or other non-desk label.
 * - The ideal point is 0.4 m in front of the eyes. It is clamped into the
 *   polygon, then slid toward the centroid until the whole footprint fits
 *   (round and irregular tables).
 * - A table too small for the footprint still beats a floating virtual desk:
 *   the set is centred on it as a 'small-table' spot (the paper overhangs a
 *   little, but the learner's fingertip still meets a real surface).
 * - Score: distance from the ideal point, minus 0.3 m for a table/desk label,
 *   plus 0.25 m for a small table.
 */
export function findTableSpot(
  planes: ReadonlyArray<PlaneInput>,
  head: { x: number; y: number; z: number },
  fwd: { x: number; z: number },
  report: PlacementReport = emptyReport(),
  count = planes.length,
): Spot | null {
  const tx = head.x + fwd.x * 0.4;
  const tz = head.z + fwd.z * 0.4;
  let best: Spot | null = null;
  let bestScore = Infinity;
  for (let i = 0; i < count; i++) {
    const plane = planes[i];
    report.planes++;
    if (plane.orientation !== 'horizontal') {
      report.vertical++;
      continue;
    }
    const label = normaliseLabel(plane.label);
    if (label === 'floor' || label === 'ceiling') {
      report.floorOrCeiling++;
      continue;
    }
    if (NOT_A_DESK.has(label)) {
      report.softOrNotATable++;
      continue;
    }
    const e = plane.matrix;
    // Local Y (column 1) is the surface normal; it must point up.
    if (e[5] < MAX_TILT_COS) {
      report.slanted++;
      continue;
    }
    const ox = e[12], oy = e[13], oz = e[14];
    if (oy < head.y - 0.95 || oy > head.y - 0.12) {
      report.wrongHeight++;
      continue;
    }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    let cx = 0, cz = 0;
    for (const p of plane.polygon) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      cx += p.x; cz += p.z;
    }
    const n = plane.polygon.length;
    if (!n || maxX - minX < MIN_SIDE || maxZ - minZ < MIN_SIDE) {
      report.tiny++;
      continue;
    }
    cx /= n; cz /= n;
    // Ideal point in plane-local XZ: project (target - origin) onto local X and Z axes.
    const dx = tx - ox, dz = tz - oz;
    let lx = dx * e[0] + dz * e[2];
    let lz = dx * e[8] + dz * e[10];
    const mx = Math.min(0.14, (maxX - minX) / 2);
    const mz = Math.min(0.17, (maxZ - minZ) / 2);
    lx = Math.min(maxX - mx, Math.max(minX + mx, lx));
    lz = Math.min(maxZ - mz, Math.max(minZ + mz, lz));
    let kind: SpotKind = 'table';
    if (!footprintInside(plane.polygon, lx, lz)) {
      for (let step = 0; step < 25 && !footprintInside(plane.polygon, lx, lz); step++) {
        lx += (cx - lx) * 0.15;
        lz += (cz - lz) * 0.15;
      }
      if (!footprintInside(plane.polygon, lx, lz)) {
        kind = 'small-table';
        lx = cx;
        lz = cz;
      }
    }
    const wx = ox + e[0] * lx + e[8] * lz;
    const wy = oy + e[1] * lx + e[9] * lz;
    const wz = oz + e[2] * lx + e[10] * lz;
    const dist = Math.hypot(wx - tx, wz - tz);
    if (dist > MAX_REACH + (kind === 'small-table' ? 0.15 : 0)) {
      report.tooFar++;
      continue;
    }
    if (kind === 'small-table') report.small++;
    else report.fits++;
    const score = dist - (DESK_LABELS.has(label) ? 0.3 : 0) + (kind === 'small-table' ? 0.25 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = { kind, x: wx, y: wy, z: wz, label, width: maxX - minX, depth: maxZ - minZ };
    }
  }
  return best;
}

export function describeReport(r: PlacementReport): string {
  return `planes ${r.planes}: fits ${r.fits}, small ${r.small}, too far ${r.tooFar}, tiny ${r.tiny}, wrong height ${r.wrongHeight}, slanted ${r.slanted}, not a desk ${r.softOrNotATable}, floor/ceiling ${r.floorOrCeiling}, vertical ${r.vertical}`;
}
