---
name: quest-hands-first-webxr
description: Build, test and ship a hands-first, seated, mixed-reality WebXR app for Meta Quest 3/3S with the Immersive Web SDK (IWSDK), up to competition quality. Use when starting or extending an IWSDK/WebXR Quest project; adding hand-tracking interactions (fingertip contact, poke buttons, pinch, joint poses), table placement with plane detection and anchors, spatial UIKit panels, ghost or skinned hands, or stroke/ink rendering; writing an automated emulator end-to-end test; checking performance; or preparing a hackathon submission (Meta VR Start style: hands-only, seated, 60 fps or more, purposeful passthrough).
---

# Hands-first mixed reality on Quest with IWSDK

This skill is the playbook proven while building *Hands of a Master* (the first of six competition projects): about 1,200 lines of TypeScript, built and fully tested in the emulator in one session on Linux.

- **Copy-ready code patterns:** [references/patterns.md](references/patterns.md).
- **Generic emulator test harness:** [scripts/iwsdk_e2e.py](scripts/iwsdk_e2e.py).
- **Reference implementation** (read it when a pattern needs full context): `hands-of-a-master/src/` in the same workspace.

## When to use
Any IWSDK (WebXR) app for Quest where hands are the only input and the real room matters. Typical asks:
- "start the next project";
- "add a button the user can poke";
- "put the board on the user's table";
- "make a ghost hand";
- "test it end to end";
- "is it ready to submit?".

## Workflow
Work through the phases in order. Do not skip phase 4: every bug that matters for judges was found there, not by reading code.

### Phase 0: Set up (Linux first; Windows only for casting and recording)
1. Start from the official scaffold, `npx @iwsdk/create` (target `ar`, TypeScript, scene understanding), or copy a verified starter. Pin `@iwsdk/core` exactly. 1.1.0 or later is needed: it fixes textures missing in multiview on the device.
2. Add `.npmrc` with `onnxruntime-node-install-cuda=skip`. Without it, `npm ci` fails on Linux trying to download CUDA binaries from GitHub.
3. Run `npm ci`, then `npx iwsdk adapter sync && npx iwsdk reference warmup`. Expose this as `npm run setup`.
   - It writes `.mcp.json` and agent configs with absolute paths. Keep `.mcp.json` and `opencode.json` gitignored and regenerate them per machine.
4. Add `.gitattributes` with `* text=auto eol=lf`. Give each project its own git repo.
5. Start the dev server with `npx iwsdk dev up --headless` (or `npm run dev`). The first run downloads about 330 MB of Chromium for Testing; wait for `browserCommandReady: true` (`npx iwsdk runtime wait`).

### Phase 1: Design for the judges before coding
- **One verb a stranger understands in 2 seconds.** Plus one awe moment, reachable within the first 60 to 90 seconds.
- **The real room must change the experience.** For example, a table becomes the play surface. A scene that plays the same with passthrough off loses Experience Design points.
- **Seated, within 2 ft, a complete session in 10 minutes or less.** Hands only, end to end, including menus.
- **Write the judging map up front:** Innovation, Experience Design, Technical, Polish (25% each), plus the special award you are aiming for. Use the `docs/JUDGING.md` template idea from the reference project.

### Phase 2: Build (one system, explicit modes)
- **One `createSystem` holds a small state machine.** Reference: `placing → watch → calibrate → practice → complete`, plus a 2D `demo` mode for the browser page.
- **Build everything from code; keep scene JSON for environment only.** Create entities with `world.createTransformEntity(obj, { parent, persistent: true })`.
- **Patterns** (see [references/patterns.md](references/patterns.md)):
  - **Table placement:** horizontal `XRPlane` at seated height, prefer the `table` label, fit inside the polygon (round tables), fall back to a virtual table after 2.5 s, add `XRAnchor`.
  - **Fingertip tracking:** `getJointPose` + One Euro filter; pick the active hand, ignoring hands resting in the lap.
  - **Surface contact:** a one-touch calibration, a down/up hysteresis, and discarding accidental touches (under 0.2 s, or plunging through the surface).
  - **Poke buttons on UIKit panels:** a custom press test plus a debounced `trigger(id)` shared with ray clicks. The built-in touch pointer did not click UIKit buttons in the emulator.
  - **Code-owned UIKit panels:** units are centimetres, so a 440-unit panel needs a scale of about 0.07 to 0.09.
  - **Skinned translucent hand:** WebXR generic-hand GLB, Fresnel shader with a depth pre-pass, driven by 25 world joint matrices. It can blend onto the user's real hand.
  - **Procedural hand pose:** IWER's built-in poses (left-hand data, mirror for the right), oriented so a chosen joint hits a target.
  - **Ribbon strokes:** preallocated, with width from speed.
  - **Synthesized sound:** Web Audio, no files.
  - **Session tuning:** 72 Hz, foveation about 0.4; pause on `VisibleBlurred`.
- **Feedback in place of haptics, on every interaction:** a hover cue (for example a ring that tightens as the fingertip approaches), a sound, a visual state change, and a caption.
- **Captions for every instruction.** One title line plus one sentence, ASCII only. UIKit's default font has no CJK glyphs and no Indic shaping; draw such text as geometry or with Canvas2D.

### Phase 3: Make it testable from the first day
- In dev builds only, log machine-readable lines: `console.info('[tag] layout {json}')`. Include world-space coordinates of every target the test must touch (start points, buttons, seal), and log every state transition and score.
  - Guard them with `import.meta.env.DEV` so production strips them.
- Add a dev-only reset (for example Shift+R clears localStorage and reloads) so every test run starts as a first-time user.

### Phase 4: End-to-end test in the emulator (IWER), hands only
Copy [scripts/iwsdk_e2e.py](scripts/iwsdk_e2e.py) to `tools/e2e.py` and write `main()` for the app's journey: reset, enter, wait for `layout`, drive the hands, assert on logged results, take screenshots. Verified CLI behaviour:

| Need | Command | Gotcha |
|---|---|---|
| Hands-only input | `xr set-input-mode {"mode":"hand"}`, `xr set-hand-pose {"device":"hand-right","poseId":"point"}` | Re-apply after `set-device-state` |
| Move a fingertip exactly | `xr animate-to {"device":"hand-right","anchor":"index-tip","position":{...},"duration":0.3}` | Positions are XR-origin metres |
| Trace a path in time | `xr run-sequence` with steps `{anchor:"index-tip", position, duration}` | The **other hand drops to the hip** during sequences and can cross your surfaces; the head also turns and the body may step toward targets |
| Press a UI button | `xr run-sequence {"steps":[{"target":"<element id>","press":{}}]}` | Targets come from `xr list-targets` (UIKit element ids). Press with the off hand |
| Read app state | `browser logs {"count":150}` | **count must be 200 or less**; filter by `timestamp`, never by line index (it is a sliding window) |
| Enter or exit XR | `xr enter`, `xr exit`, `xr status` | With `world.xr.offer: "always"` the session is re-offered after exit; `enter` again. Entering resets the headset pose, so place the head *after* entering |
| Look somewhere for a screenshot | `xr set-transform {"device":"headset",...}` then `xr look-at` | Default view looks straight ahead, so tabletop content sits at the bottom edge |
| Screenshot | `browser screenshot --output-file artifacts/x.png` | Only runtime screenshots prove system behaviour; the editor does not run systems |
| Draw calls and triangles | log `renderer.info.render.calls/triangles` every few seconds in dev | Desktop frame timing does not predict Quest performance |

**Do not edit `src/` while a test runs:** Vite hot-reloads the page and ends the XR session.

Minimum test matrix before calling it done:
1. Full journey, every level, the right hand writing or acting, with 4 to 6 mm of random fingertip error.
2. Negative cases: wrong direction, off target, too fast. Each must give the specific hint.
3. Left hand.
4. Placement three ways: no table nearby (virtual fallback), seated at a table, and a round or odd-shaped table.
5. Menu buttons pressed by poke and by pinch-ray.
6. Production build: `npm run build`, then `vite preview` serves the page, models, panels and scene. Dev logs must be absent from the bundle.

### Phase 5: Measure, document, ship
- **Budget:** 100 draw calls or fewer, 100 to 300k triangles, one light plus IBL, no shadow maps, no full-screen post-processing (it breaks in WebXR), Draco + KTX2 (IWSDK's loader has **no meshopt**), `highp` in custom shaders.
- **Docs per project:**
  - `README.md`: the experience, run, test, code map, credits.
  - `docs/JUDGING.md`: criteria to evidence, with gaps marked.
  - `docs/SUBMISSION.md`: Devpost text, under-3-minute shot list with the hook in the first 30 s, checklist.
  - `docs/TESTING.md`: harness, results, bugs found and fixed, on-device checklist.
- **Ship:** `npx vercel --prod`. Keep `vercel.json`'s `Permissions-Policy: xr-spatial-tracking=*`. Test the production alias logged out on the headset.
- **No redeploys after the deadline.**
- **On-device must-checks** that the emulator cannot prove:
  - text and hand models render (multiview);
  - real contact thresholds;
  - frame rate (perf capture);
  - hand-tracking permission prompt;
  - system-menu pause.

## Pitfalls (each one cost time once)
| Symptom | Cause | Fix |
|---|---|---|
| `npm ci` fails with EPROTO/TLS from onnxruntime-node | Downloads CUDA binaries on Linux | `.npmrc`: `onnxruntime-node-install-cuda=skip` |
| Panel invisible, no error | UIKit units are cm, so scale was 100× too small; or the panel faces away (panels face +Z) | scale ≈ width_m / (units/100); yaw toward the viewer |
| Poke does nothing on UIKit buttons (emulator) | Touch pointer does not click | Custom press test (patterns §3) |
| `fillPoses` type error | Missing from the WebXR TS types | Cast the frame type |
| Strokes or buttons fire on their own | A hand passing through a surface, or a resting hand chosen as active | Minimum duration, plunge detection, ignore hands far below, prefer the current hand |
| First action after calibration is garbage | The finger is still on the calibration target | Require a lift before the first action |
| Content hangs off round tables | Clamped to the polygon AABB only | Point-in-polygon footprint, slide toward the centroid |
| A translucent hand reads backwards | Seen end-on from the user's eyes | Angle it like a real arm (from the user's side), raise the body fill, add a tip glow |
| Test waits forever | `browser logs` count over 200 (error goes to stderr), or line-index bookkeeping | count ≤ 200, timestamp marks, capture stderr |
| XR session ends mid-test | Hot reload from editing `src/` | Edit only between runs |
| Real fingers vanish under virtual paper | No depth occlusion | Accept the IWSDK hand outline, or test `DepthOccludable` on device. Surfaces within mm of real ones flicker |
