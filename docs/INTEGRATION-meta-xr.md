# Meta XR resources against HOAM: mixed reality, on-device testing, Platform SDK (18 Nov 2026)

This note checks HOAM against four Meta resources: the Meta XR SDK (Interaction SDK and Platform SDK), the hand-tracking documentation, the mixed-reality documentation and Meta Quest Developer Hub (MQDH). For each one it says what applies to a WebXR app in Quest Browser built with IWSDK 1.1.0.

- **Sources:** each resource, with links, is summarised in [META-XR-RESOURCES.md](META-XR-RESOURCES.md).
- **Hand tracking** was covered earlier in [INTEGRATION-handtracking.md](INTEGRATION-handtracking.md), which added poke feedback, thumbs-up, tracking loss and microgestures. It is not repeated here.

**Headline**

- **Already in HOAM:** HOAM already used the web side of Meta's scene understanding: planes with semantic labels, an anchor, and a room scan on request.
- **Gaps:**
  - Placement assumed a well-behaved room. A tilted plane or a couch seat could be accepted as a desk. A table too small for the writing set fell through to a virtual desk floating at a guessed height, even when a real surface was under your hands.
  - Nothing came back next session.
- **Built today:** room-aware placement, and the desk returning to the same real spot next session. Both are tested in the emulator across seven simulated rooms and fifteen synthetic cases.
- **Platform SDK:** not reachable from a page in Quest Browser, except in-app purchases inside a Store-installed PWA.

## Gap table
Legend: ✅ already in HOAM · 🔨 built now · ⛔ not available in WebXR (with the native name) · ⏭ after the deadline

### Mixed reality and scene understanding
| Feature (source) | Status | HOAM / WebXR equivalent |
|---|---|---|
| Passthrough MR session (MR overview) | ✅ | `immersive-ar` with passthrough. HOAM starts in your room, places the desk, then dissolves into a place; the Scene button returns to your room. |
| Plane detection with semantic labels (Scene, MRUK) | ✅ | IWSDK `XRPlane`. A table/desk label is preferred. |
| **Restrict placement by label** (MR scene design) | 🔨 | `src/mr/room-placement.ts` refuses `couch`, `bed`, `screen`, `lamp`, `plant`, `wall art` and frames as writing surfaces. Unlabelled and `other` surfaces at desk height still count, because many people never label furniture. Labels are normalised (`wall art` and `wall_art`), and both `table` (Quest/IWER) and `desk` (WebXR registry) are accepted. |
| **Don't assume a table exists; provide an alternative** (MR design guideline) | ✅ + 🔨 | Already: a virtual desk at seated height, plus "Scan my room". New: a **small table** (20 cm to about 44 cm across, too small for the 22 cm-radius set) is no longer thrown away. The set is centred on it so your fingertip still meets a real surface, and the caption says the paper overhangs a little. Surfaces under 20 cm a side (stools, noise) are still refused. |
| **Slanted or bad planes** (scene best practices: drift and imperfect scans) | 🔨 | A "horizontal" plane tilted more than 6° is refused. The desk is placed level, and 6° over the 22 cm footprint is already a 2.3 cm rise, which would break the fingertip contact test. |
| `FindSpawnPositions` / surface queries (MRUK) | ⛔ → 🔨 | MRUK is native only. Our own query is `findTableSpot()`: label, tilt, height window 0.12 to 0.95 m below the eyes, size, footprint in the polygon (slid toward the centroid for round tables), reach 0.6 m, and a score. It is pure maths, unit-tested on synthetic rooms. |
| Room scan prompt (`initiateRoomCapture`, web MR page) | ✅ | Only on the learner's press ("Scan my room"), shown only on the virtual desk. That matches Meta's "only if there are no planes" rule and avoids IWSDK's anchor wipe. |
| Spatial anchor (Scene, web MR) | ✅ | `XRAnchor` on the desk entity. |
| **Persistent anchors: content returns next session** (web MR page: `requestPersistentHandle`, `restorePersistentAnchor`) | 🔨 | `src/mr/desk-memory.ts`, explained in the next section. |
| Check that the loaded room is the one the user is in (scene best practices) | 🔨 partly | A remembered spot is used only if IWSDK restored the *same* anchor (same UUID) **and** the spot is within 1 m of your head, 0.1 to 1.0 m below your eyes. Otherwise detection runs as usual and the log says why. |
| Keep visible surface rendering minimal (MR scene design) | ✅ | Plane wireframes stay hidden; only the felt mat and paper appear. |
| Mesh detection (`XRMesh`, labelled volumes, global mesh) | ⏭ | Quest builds planes and volumes from the same Space Setup, so meshes add little for a tabletop. Meta's own advice is "use the table plane rather than the cluttered mesh". Enabling it costs memory for the global mesh, and only a headset can show whether it helps. |
| Environment raycast / WebXR hit test (needs no room scan) | ⏭ | The best next step for headsets **without** Space Setup: a ray down from 0.4 m in front of the eyes would find the real desk height, then put the virtual desk exactly there. It needs `hitTest` in the XR features and `EnvironmentRaycastTarget`. IWER supports it, but the result can only be tuned on a device. |
| **Depth occlusion** (Depth API; IWSDK `DepthOccludable`) | ⏭ (evaluated, not built) | Three reasons. (1) By default an opaque place covers your room after placement; occluding virtual keys there punches holes that show the place, not your hand (see our placement skill). (2) In "my room" the paper lies within millimetres of the real desk, where Meta says depth is unreliable (under about 0.2 m from the cameras, plus a noisy surface match), so it would flicker. (3) Depth sensing is a session feature: requesting it is decided at session start in `iwsdk.config.json`, and an "off by default" switch would need a session restart. Worth one device test of the keyboard in "my room" only, with `HardOcclusion`. |
| Passthrough Camera API (PCA) | ⛔ | Native only (Unity `PassthroughCameraAccess`, Android Camera2). Camera pixels are not readable in WebXR. |
| Shared Spatial Anchors, colocation, Space Sharing | ⛔ | Native only (MRUK, Shared Spatial Anchors). HOAM is single-player anyway. |
| World locking (MRUK) | ✅ in effect | IWSDK re-poses the anchored group from the anchor every frame. |
| Scene Debugger (MRUK) | 🔨 dev | A dev key, Shift+L, logs every plane (label, position, normal, size). After each placement a one-line summary logs why planes were passed over (`placement planes 15: fits 1, small 0, too far 1, ...`). Read it on a headset through `chrome://inspect`. |

### Meta XR SDK: Interaction SDK and Platform SDK
| Feature | Status | Notes |
|---|---|---|
| ISDK poke, ray, pose detection, microgestures | ✅ (IWSDK equivalents) | See INTEGRATION-handtracking.md. |
| ISDK hand grab, distance grab, throw | ⏭ / n.a. | Nothing to pick up in the lessons. IWSDK's `OneHandGrabbable` and `DistanceGrabbable` are the web equivalents. |
| ISDK gaze + pinch (v207) | ⛔ on Quest 3/3S | No eye tracking. IWSDK has a head-gaze fallback, but HOAM is touch-first. |
| **Platform SDK: entitlement, invites, Group Presence, Destinations, leaderboards, achievements, matchmaking, cloud storage** | ⛔ | **Not reachable from a page in Quest Browser.** Meta documents the Platform SDK for native, Unity, Unreal and Kotlin/Spatial SDK only, and the web pages document no JavaScript Platform API ([Unity intro](https://developers.meta.com/horizon/documentation/unity/ps-platform-intro/), [native intro](https://developers.meta.com/horizon/documentation/native/ps-platform-intro/)). Native names for later: `Entitlements.IsUserEntitledToApplication`, `GroupPresence.Set`, `Leaderboards.WriteEntry`, `Achievements.Unlock`, `IAP.LaunchCheckoutFlow`. |
| **Platform SDK: in-app purchases** | ⏭ (possible only as a Store PWA) | **The one web path.** An immersive WebXR **PWA installed from the Horizon Store** can sell durable or consumable items through the Digital Goods API plus Payment Request (`https://quest.meta.com/billing`). It also has `listPurchases()` (an ownership check), `getLoggedInUserId()` and `getUserAccountAgeCategory()`. It needs Bubblewrap packaging with Horizon Billing and a Data Use Checkup ([web IAP](https://developers.meta.com/horizon/documentation/web/ps-iap/), [PWA packaging](https://developers.meta.com/horizon/documentation/web/pwa-packaging/)). It does not work from a plain URL, which is how judges open HOAM. A future "master course" unlock could use it. |
| Invites and multiplayer, web substitutes | ✅ partly | Share links already work (`?tune=` opens a learner's tune on another headset). Leaderboards or co-presence would need our own backend. |

### Hand-tracking documentation
| | Status | Notes |
|---|---|---|
| Hands-first design | ✅ | Done in the earlier pass: poke hover and press, cursor ring, thumbs-up, tracking loss, microgestures. See INTEGRATION-handtracking.md. |

### Meta Quest Developer Hub (test, debug, optimise)
| MQDH feature | Status | Our Linux equivalent |
|---|---|---|
| Device manager, stay awake, proximity, boundary | ✅ documented | `metavr device configure-testing setup`, `metavr device proximity`, `metavr device boundary` |
| Casting | ✅ documented | `metavr casting start` / `stop` |
| Screenshot and video capture | ✅ documented | `metavr capture screenshot -o x.png`, `metavr capture video start` / `stop` |
| Performance Analyzer, Perfetto | ✅ documented; capture ⏭ | `metavr perf capture --app com.oculus.browser --mode vr --duration 10000 -o run1`, then `metavr perf analyze-trace` and `metavr perf open`. Not yet run on HOAM: no headset session yet. |
| Logs | ✅ | `metavr log`; for JavaScript, `chrome://inspect` after `metavr adb reverse tcp:8081 tcp:8081` |
| MQDH app itself | ⛔ on Linux | Windows and macOS only. `metavr` is the official cross-platform CLI. |
| Testing without a headset | ✅ + 🔨 | IWER. New: `tools/room.mjs` switches the simulated room at runtime (`window.IWER_DEVICE.sem.loadDefaultEnvironment`), including "none" (no Space Setup). |

## What was built

### 1. Room-aware placement (`src/mr/room-placement.ts`, `src/mr/plane-source.ts`)
- **The rule.** `tryPlaceOnPlane` in `calligraphy-system.ts` now calls `findTableSpot()`. It uses the same seated window and footprint fitting as before, plus three rules: label filtering, a 6° tilt limit and a small-table fallback. It also writes a per-placement report.
- **Allocation.** `gatherPlanes()` copies IWSDK's `XRPlane` entities into a reused pool, so placement doesn't allocate per frame.
- **Why this one.** The Technical criterion asks for content that "holds up in rooms the developer never tested". Real rooms have unlabelled desks, side tables, sofas at seat height and imperfect scans. The previous code accepted any horizontal non-floor plane at the right height, a couch included, and dropped small tables.

### 2. The desk returns to the same real spot (`src/mr/desk-memory.ts`)
- **What IWSDK already does.** IWSDK 1.1.0 keeps one persistent anchor at the reference-space origin. It creates it, saves its handle in `localStorage` (`iwsdk_scene_anchor_uuid`), restores it next session, and parents every `XRAnchor` entity under it.
- **What we save.** The desk's pose *relative to that anchor group*, together with the anchor's UUID.
- **What happens next session.** The first placement waits up to 1.5 s for the restore. If the same anchor is live and the spot is within reach, the paper goes back exactly there, with the caption "Welcome back: your paper is on the same spot of your table as last time". Otherwise the usual detection runs.
- **What it never does.** "Move paper here" never jumps back to the old spot.
- **Why this one.** Meta lists persistent anchors as the web equivalent of saved spatial anchors. A learner who comes back daily (HOAM has a streak) finds their desk set where they left it.
- **Limits:**
  - 8 anchors per site;
  - none in private browsing;
  - clearing site data deletes them;
  - a Space Setup re-scan can invalidate anchors.

## Tests (18 Nov 2026, emulator)
All on the final code, Linux, headless Chromium through the IWSDK CLI:
- `npm run typecheck`: **PASS**.
- `node tools/test-room-placement.mjs` (new): **PASS, 16 cases**. They cover:
  - a desk; a round table; a table rotated 37°;
  - a 35 cm side table (small-table spot); a 15 cm stool (refused);
  - a plane slanted 15° (refused) and one slanted 5° (accepted);
  - a couch seat (refused);
  - no tables, and no planes at all;
  - a table out of reach;
  - a labelled table beating an unlabelled shelf, and a fitting table beating a nearer small one;
  - a standing kitchen counter labelled `other`;
  - the `wall art` spelling.
- `python3 tools/e2e_room.py` (new): **PASS**.
  - **13 table-height surfaces in six IWER rooms** (sunlit living room, home office, kitchen, bedroom, conference room, music studio): 9 tables or desks and 4 small side tables or nightstands (0.44 m and 0.46 × 0.40 m). Before this change, those 4 would have fallen through to a floating virtual desk.
  - A room with no Space Setup gives the virtual desk.
  - **Remembered spot:** session 1 placed on the dining table. Session 2 sat 25 cm to the side and turned 25°: plain detection put the paper 7.5 cm away, while the remembered spot returned it **0.00 cm** from the session-1 position (IWER's anchors are exact; a headset will drift a little).
- `python3 tools/e2e.py --lessons 2 --piano 1 --compose`: **PASS** (87, 88; Happy Birthday 83; your tune learned exactly, 79).
- `python3 tools/e2e.py --lessons 1 --lang english`: **PASS** (90).
- `python3 tools/e2e_hands.py`: **PASS, 7/7**.

**Screenshots** from the learner's eyes, in your own room (passthrough), are in `artifacts/`:
- `room-home_office-1.png`: a small side table, with the caption "Your table is small";
- `room-kitchen-2.png`: a counter;
- `room-conference_room-0.png`;
- `room-none-virtual-desk.png`;
- `room-remembered-spot.png`: "Welcome back".

**Found while testing:** in the home office, the side table carries a potted plant. Quest's planes know nothing about clutter, so the paper lands over it. Table Troopers and Meta's guidance both assume a cleared table. This is now in the on-device checklist; a device could use depth or hit testing to spot clutter later.

## What only a headset can confirm
- Whether Quest Browser's `restorePersistentAnchor` brings the IWSDK origin anchor back across sessions and reboots, and how far the desk lands from the old spot (the emulator's anchors are exact).
- The semantic labels Quest Browser reports for real furniture (`table` versus `desk`, `other`, empty), and whether people's desks arrive unlabelled.
- The tilt of real table planes (we refuse more than 6°), and a real small side table: does the overhanging paper feel acceptable?
- Whether "Scan my room" (`initiateRoomCapture`) keeps or wipes the saved anchor. If it wipes it, the desk memory simply falls back to detection.
- Performance: one `metavr perf capture` during practice and during piano (72 fps target, 60 floor).
- Depth occlusion, if tried later: flicker at the paper, and the keyboard in "my room" mode.

## Proposed additions to our shared skills (not edited here)
For `quest-hands-first-webxr/references/placement.md`:
1. **Restrict by label, both vocabularies.** Refuse `couch`, `bed`, `screen`, `lamp`, `plant`, `wall art` and frames. Accept `table` (Quest/IWER) and `desk` (WebXR registry). Keep unlabelled and `other`. Normalise spaces and underscores.
2. **Tilt check.** Plane-local Y is the normal (`matrixWorld.elements[5]`). Refuse more than 6° if you place content level, and say why in a log.
3. **Small-table fallback.** Centre content on a real surface that is too small rather than float a virtual desk. Refuse under 20 cm a side.
4. **Keep placement maths pure** (plane matrix plus polygon in, spot out), so `node file.mjs` can test synthetic rooms (tiny, slanted, couch, rotated, round, out of reach, none) without a browser. HOAM: `tools/test-room-placement.mjs`.
5. **Remembering placement across sessions, concrete recipe.** Replace the "store the content's pose relative to it" paragraph with the `desk-memory.ts` pattern:
   - Save `inverse(anchoredGroup.matrixWorld) × content.matrixWorld` plus the UUID from `localStorage['iwsdk_scene_anchor_uuid']`.
   - On the first placement, wait up to 1.5 s for `xrAnchor`. Trust the saved pose only if the UUID matches and the spot is within reach.
   - Never use it for user-requested re-placements.
   - The private fields come from `world.getSystem(SceneUnderstandingSystem)`.
6. **Placement report line**, the web stand-in for MRUK's Scene Debugger: one log line per placement saying why each plane was passed over.

For `quest-hands-first-webxr/references/testing.md`:

7. **Switch IWER rooms at runtime:** in a `browser run` script, evaluate `window.IWER_DEVICE.sem.loadDefaultEnvironment(name)` (or `sem.deleteAll()` for no Space Setup) in every frame. The rooms are `sunlit_living_room`, `home_office`, `kitchen`, `bedroom`, `conference_room`, `music_studio`, `open_office` and `open_studio`. Then sit the emulated user at each table-height plane and re-place. HOAM: `tools/room.mjs`, `tools/e2e_room.py`.
8. **Entering XR resets the headset pose**, so `set-device-state` before `xr enter` doesn't seat the user. Seat after entering, then trigger placement again (a dev key).
9. **IWER persists anchors** in `localStorage` (`@immersive-web-emulation-runtime/persistent-anchors`), so a cross-session anchor test works in the emulator. Shift+R-style resets that clear `localStorage` wipe them as well.

For `metavr-cli` / testing:

10. The MQDH-to-`metavr` table in META-XR-RESOURCES.md §5. Note that `metavr tools list` 1.10 now lists `xrsim` and `spatial-editor` for Linux x64, but we have not tried them, and `build-path.md` still says that Meta XR Simulator is Windows/macOS only.

For `build-path.md`:

11. **Platform SDK on web = IAP only, and only as a Store PWA** (Digital Goods + Payment Request). If a project needs leaderboards, invites, Destinations or matchmaking from Meta, that is a reason to choose native.
