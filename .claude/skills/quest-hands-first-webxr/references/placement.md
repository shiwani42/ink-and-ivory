# Placing content on the user's real table

## Fallback chain
1. **Plane search, up to ~2.5 s** (planes arrive late; run it every frame). Candidate: `orientation === 'horizontal'`, not `floor`/`ceiling`, height 0.12–0.95 m below the head (seated), within ~70° of gaze, prefer `semanticLabel` `table`/`desk`; unlabelled planes 0.45–1.1 m high count as tables. Score by horizontal distance to a target point (head + forward × 0.4 at the plane's height), −0.3 m bonus for a table/desk label; reject beyond 0.6 m (auto) or 2.2 m (user turns toward it).
2. **Hand-follow:** when content needs a real surface and no plane qualifies, the preview follows the hand; pinch at table height to drop it.
3. **Virtual table after ~6 s** with no placement: head − 0.42 m, 0.38 m forward. Show a tabletop mesh and say so in the caption. Offer **"Scan room"** next to it (below).
- Always show a preview (an outline at the target) and confirm with a pinch. A two-hand pinch held 1.5 s re-places later.

## Fitting the footprint
```ts
// planes: query { required: [XRPlane] }; plane = entity.getValue(XRPlane, '_plane') as XRPlane; obj = entity.object3D
const local = obj.worldToLocal(target);
// clamp into the polygon AABB (minus half the footprint), then while(!footprintInside) slide 15% toward the centroid
// yaw toward the user: Math.atan2(head.x - p.x, head.z - p.z)  (local +Z faces the user)
```
- Point-in-polygon uses plane-local `polygon[i].x/.z`; AABB-only clamping hangs content off round tables.
- **Keep the plane outline** (plane-local bbox → world corners). You need it to dress the table or draw a virtual tabletop at the real plane when a place is showing.

## Anchoring and moving
- After placing, `entity.addComponent(XRAnchor)`. IWSDK re-parents it under a stabilised anchor group (world pose preserved).
- To move it later: world matrix, premultiply by `inverse(parent.matrixWorld)`, decompose.
- Do all content maths in the anchored group's local space.

## No planes at all: offer a room scan
If `session.initiateRoomCapture` exists and no horizontal planes arrive within a few seconds, show a "Scan room" button next to the virtual-table fallback. Call it **only on that press**: IWSDK 1.1.0 disabled its own automatic call because it wiped anchors. Fall back to the virtual table if it rejects. Log whether the API exists.

## Bodies and the real table
- **Never clip virtual bodies at the tabletop** with clipping planes. Give characters a full body and seat; add `DepthOccludable` (depth sensing enabled with `required: false`) so the real table hides what is behind it. See `iwsdk-depth-occlusion`.
- Real fingers vanish under virtual paper without depth occlusion: accept IWSDK's hand outline or test `DepthOccludable` on the device.

## Test placement three ways
No table nearby; seated at a table; a round table. The emulator room has about 15 labelled planes, so test both "seated at a table" and "standing in the middle".

## Remembering placement across sessions
IWSDK 1.1.0 already restores a persistent anchor at the reference-space origin through `localStorage` (`scene-understanding/scene-understanding-system.js`, about lines 538–630). Store the content's pose relative to it to bring the desk or board back next session. Limits: 8 anchors per site, nothing persists in private browsing, and it needs a headset to verify. Judges may only see one session, so it's a nice-to-have, worth one line in the write-up if it works.

## Depth occlusion and opaque worlds
`DepthOccludable` on UI or props is right in passthrough, but **wrong once an opaque world covers the room**: real objects nobody can see (a laptop on the table, a sofa in the emulator room) punch holes in cards that show the virtual world behind. Under a full place, rely on the hand window (hands-input.md) for hands-over-UI and leave UI non-occludable. Never put it on the world itself either: the real walls cut the street, and it forces materials transparent.

## Lessons from Mario 64 MR (Unity, studied Nov 2026; ideas only, see reference-winners/mario64mr-REPORT.md)
- *Room geometry chain:* scene mesh → Space Setup anchors/planes → floor → virtual surface. Test on a headset with no scan (Quest 2, or a Quest 3 user who skipped the scan): Mario 64 MR v1.0 broke there.
- *Leaving known geometry is never a failure:* return the object or character to its last safe place and keep a "bring it back" item in the menu.
- *Reloading the room mid-session:* keep the previous geometry alive until the next reload so references stay valid; reload on an interval and after a settle time.
- *Use the original engine's own collision for real surfaces* when porting a game: convert the room into its native format and swap partitions around the character's step, rather than writing a second physics.
