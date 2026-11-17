// Unit test: room-aware placement against synthetic rooms we never tested.
//   node tools/test-room-placement.mjs
// Node 22.6+ strips the TypeScript types of the imported module (no build step).
import assert from 'node:assert/strict';
import { findTableSpot, emptyReport, footprintInside, pointInPolygon } from '../src/mr/room-placement.ts';

/** A plane pose: yaw about Y, then an optional tilt about local X (degrees). Column-major 4x4. */
function pose(x, y, z, yawDeg = 0, tiltDeg = 0) {
  const a = (yawDeg * Math.PI) / 180, t = (tiltDeg * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(t), st = Math.sin(t);
  // R = Ry(a) * Rx(t)
  const X = [ca, 0, -sa];
  const Y = [sa * st, ct, ca * st];
  const Z = [sa * ct, -st, ca * ct];
  return [...X, 0, ...Y, 0, ...Z, 0, x, y, z, 1];
}
const rect = (w, d) => [
  { x: -w / 2, z: -d / 2 }, { x: w / 2, z: -d / 2 }, { x: w / 2, z: d / 2 }, { x: -w / 2, z: d / 2 },
];
const circle = (r, n = 24) => Array.from({ length: n }, (_, k) => ({ x: r * Math.cos((k / n) * 2 * Math.PI), z: r * Math.sin((k / n) * 2 * Math.PI) }));
const plane = (label, polygon, matrix, orientation = 'horizontal') => ({ label, polygon, matrix, orientation });
const room = [
  plane('floor', rect(5, 5), pose(0, 0, 0)),
  plane('ceiling', rect(5, 5), pose(0, 2.6, 0)),
  plane('wall', rect(5, 2.6), pose(0, 1.3, -2.5), 'vertical'),
];

// Seated: eyes 1.2 m above the floor, looking along -Z.
const seated = { x: 0, y: 1.2, z: 0 };
const fwd = { x: 0, z: -1 };

/** The spot, if any, and checks that it lies on the plane polygon in plane-local space. */
function run(name, planes, head = seated, f = fwd) {
  const report = emptyReport();
  const spot = findTableSpot(planes, head, f, report);
  console.log(`  ${name.padEnd(46)} ${spot ? `${spot.kind} '${spot.label}' at [${spot.x.toFixed(2)}, ${spot.y.toFixed(2)}, ${spot.z.toFixed(2)}]` : 'none (virtual desk)'}`);
  return { spot, report };
}
let passed = 0;
function test(name, fn) {
  fn(name);
  passed++;
}

console.log('room placement');
test('desk in front, seated', (n) => {
  const { spot } = run(n, [...room, plane('table', rect(1.2, 0.6), pose(0, 0.73, -0.55))]);
  assert.equal(spot?.kind, 'table');
  assert.ok(Math.abs(spot.y - 0.73) < 1e-6);
  assert.ok(Math.hypot(spot.x, spot.z + 0.4) < 0.2, 'near the ideal point 0.4 m ahead');
});
test('round table 0.9 m: whole footprint on the top', (n) => {
  const { spot } = run(n, [...room, plane('table', circle(0.45), pose(0, 0.74, -0.75))]);
  assert.equal(spot?.kind, 'table');
  assert.ok(footprintInside(circle(0.45), spot.x - 0, spot.z + 0.75));
});
test('table rotated 37 degrees (plane-local maths)', (n) => {
  const m = pose(0.1, 0.72, -0.6, 37);
  const { spot } = run(n, [...room, plane('table', rect(1.0, 0.7), m)]);
  assert.equal(spot?.kind, 'table');
  // back to plane-local: inside the rectangle
  const dx = spot.x - m[12], dz = spot.z - m[14];
  const lx = dx * m[0] + dz * m[2], lz = dx * m[8] + dz * m[10];
  assert.ok(footprintInside(rect(1.0, 0.7), lx, lz));
});
test('tiny side table 35 cm: small-table spot at its centre', (n) => {
  const { spot, report } = run(n, [...room, plane('table', rect(0.35, 0.35), pose(0.05, 0.6, -0.45))]);
  assert.equal(spot?.kind, 'small-table');
  assert.ok(Math.abs(spot.x - 0.05) < 1e-6 && Math.abs(spot.z + 0.45) < 1e-6);
  assert.equal(report.small, 1);
});
test('stool top 15 cm: ignored (too small to be a desk)', (n) => {
  const { spot, report } = run(n, [...room, plane('', rect(0.15, 0.15), pose(0, 0.6, -0.4))]);
  assert.equal(spot, null);
  assert.equal(report.tiny, 1);
});
test('slanted plane, 15 degrees (drafting board, bad scan)', (n) => {
  const { spot, report } = run(n, [...room, plane('table', rect(1.0, 0.6), pose(0, 0.75, -0.5, 0, 15))]);
  assert.equal(spot, null);
  assert.equal(report.slanted, 1);
});
test('slight tilt, 5 degrees: still a table', (n) => {
  const { spot } = run(n, [...room, plane('table', rect(1.0, 0.6), pose(0, 0.75, -0.5, 0, 5))]);
  assert.equal(spot?.kind, 'table');
});
test('couch seat at desk height range: not a desk', (n) => {
  const { spot, report } = run(n, [...room, plane('couch', rect(1.8, 0.6), pose(0, 0.42, -0.6))]);
  assert.equal(spot, null);
  assert.equal(report.softOrNotATable, 1);
});
test('no table at all (floor, ceiling, walls only)', (n) => {
  const { spot, report } = run(n, room);
  assert.equal(spot, null);
  assert.equal(report.floorOrCeiling, 2);
  assert.equal(report.vertical, 1);
});
test('no planes at all (no Space Setup)', (n) => {
  assert.equal(run(n, []).spot, null);
});
test('table out of reach (1.6 m away)', (n) => {
  const { spot, report } = run(n, [...room, plane('table', rect(1.0, 0.6), pose(0, 0.73, -2.0))]);
  assert.equal(spot, null);
  assert.equal(report.tooFar, 1);
});
test('labelled table beats an unlabelled shelf at the same distance', (n) => {
  const { spot } = run(n, [
    ...room,
    plane('', rect(0.8, 0.5), pose(0.3, 0.8, -0.45)),
    plane('table', rect(0.8, 0.5), pose(-0.3, 0.73, -0.45)),
  ]);
  assert.equal(spot?.label, 'table');
});
test('a table that fits beats a nearer small one', (n) => {
  const { spot } = run(n, [
    ...room,
    plane('table', rect(0.3, 0.3), pose(0, 0.7, -0.4)),
    plane('table', rect(1.2, 0.7), pose(0.35, 0.73, -0.7)),
  ]);
  assert.equal(spot?.kind, 'table');
});
test('standing at a kitchen counter labelled other', (n) => {
  const { spot } = run(n, [...room, plane('other', rect(2.0, 0.6), pose(0, 0.92, -0.5))], { x: 0, y: 1.62, z: 0 });
  assert.equal(spot?.kind, 'table');
});
test('Quest label spelling "wall art" is normalised and refused', (n) => {
  assert.equal(run(n, [...room, plane('wall art', rect(0.6, 0.6), pose(0, 0.8, -0.4))]).spot, null);
});
test('pointInPolygon sanity', () => {
  assert.ok(pointInPolygon(rect(1, 1), 0, 0));
  assert.ok(!pointInPolygon(rect(1, 1), 0.6, 0));
});
console.log(`PASS ${passed} cases`);
