---
name: quest-hands-first-webxr
description: Build, iterate, test and ship a hands-first, seated, mixed-reality WebXR app for Meta Quest 3/3S with the Immersive Web SDK (IWSDK), to competition quality. Use when starting or extending an IWSDK/WebXR Quest project; designing the first five minutes, onboarding and a lesson or level ladder; adding hand interactions (fingertip contact, poke buttons, pinch, piano-style key presses, joint poses); table placement with planes and anchors; spatial UIKit panels; ghost or skinned hands; 360-degree places and transitions; models from Blender scripts; music and sound; letting users bring their own content; writing an automated emulator end-to-end test; checking performance; licensing assets; or preparing a hackathon submission (Meta VR Start style: hands only, seated, 60 fps or more, purposeful passthrough).
---

# Hands-first mixed reality on Quest with IWSDK

This is the playbook from building *Hands of a Master*, the first of six competition projects, over two days on Linux. It went through four rebuilds driven by user feedback:
1. a working calligraphy tutor;
2. a production visual pass;
3. a second craft (piano) with places, music and languages;
4. a lesson ladder plus the user's own songs.

Each rebuild was cheaper because of the habits below. Follow them from the first hour of a new project.

- **Workflow** (below): phases 0 to 6, in order.
- **How to iterate with the user**, and the feedback we got and what fixed it: [references/process.md](references/process.md).
- **Assets, music and licensing** (sources, Blender pipeline, AI generation, what not to ship): [references/assets-and-licensing.md](references/assets-and-licensing.md).
- **Copy-ready code patterns:** [references/patterns.md](references/patterns.md).
- **Emulator test harness:** [scripts/iwsdk_e2e.py](scripts/iwsdk_e2e.py). **GLB preview render:** [scripts/blender_preview_glb.py](scripts/blender_preview_glb.py).
- **Reference implementation:** `hands-of-a-master/` in the same workspace (`src/`, `tools/blender/build_assets.py`, `tools/e2e.py`, `docs/`).
- **What past winners did** (2025 Start competition and earlier; code study, techniques, licences): `reference-winners/REPORT.md` in the workspace. Read section 5 ("what judges see") before planning a new project.

## When to use
Any IWSDK (WebXR) app for Quest where hands are the only input and the real room matters. Typical asks:
- "start the next project";
- "make it look production grade";
- "add a button the user can poke";
- "put it on the user's table";
- "make a ghost hand";
- "add music" or "add a place";
- "let users bring their own";
- "test it end to end";
- "is it ready to submit?".

## Workflow
Phase 4 (the end-to-end test) is not optional. Every bug that would have cost points was found by running the journey, not by reading code.

### Phase 0: Set up (Linux first; Windows only for casting and recording)
1. **Scaffold:** start from `npx @iwsdk/create` (target `ar`, TypeScript, scene understanding) or a verified starter. Pin `@iwsdk/core` exactly, at 1.1.0 or later (that version fixes textures missing under multiview on the device).
2. **`.npmrc`:** add `onnxruntime-node-install-cuda=skip`, or `npm ci` fails on Linux.
3. **Setup script:** `npm ci`, then `npx iwsdk adapter sync && npx iwsdk reference warmup`, exposed as `npm run setup`. Gitignore `.mcp.json` and `opencode.json` (they contain absolute paths).
4. **Repo:** `.gitattributes` with `* text=auto eol=lf`, and one git repo per project. **Commit after every green regression** (see Phase 4).
5. **Dev server:** `npx iwsdk dev up`. Ask the user once whether they want it headed (they can watch the emulator) or headless, and announce any change. Wait for `browserCommandReady: true`.
6. **Tools to have ready:**
   - Blender for models (`blender -b --python`);
   - `ffmpeg` for audio;
   - `curl` for downloads (on flaky networks curl works where Python TLS and git to GitHub reset);
   - `node_modules/.bin/esbuild` for quick unit tests of pure TS modules.
7. **Meta's agent skills** (`meta-quest/agentic-tools`, Apache-2.0): copy `hz-immersive-designer`, `hz-iwsdk-webxr`, `hz-vr-debug` and `hz-perfetto-debug` into `.claude/skills/`, together with the licence. Apply their design numbers from the start (Phase 1).

### Phase 1: Design the first five minutes before coding
- **One verb a stranger understands in 2 seconds, and one awe moment within 60 to 90 s.** In the reference project: "follow the master's hand", then the hands lock together in gold.
- **The real room must matter.** Place the work on the user's real table in passthrough; the real surface gives the touch that hand tracking lacks.
- **One world at a time.** Either passthrough, or fully in a place, with a transition between them. Users disliked seeing both at once (see process.md).
- **Onboarding = the most famous thing first, then fundamentals, then depth, then the user's own.**
  1. Open with something everyone recognises (Happy Birthday for piano, 一 for calligraphy).
  2. Then teach the basics as short lessons (white keys, sharps, flats).
  3. Then songs or levels that use them.
  4. Last, a slot for the user's own content.
  Keep each item under about 1 to 2 minutes.
- **Teach by demonstration.** The master shows, waits at the start, then leads at the user's tempo. Captions: one title line plus one sentence.
- **Choices come later, not up front.** Start in a sensible default (for example Japanese). After the first success, invite the user to choose (language, music, scene); keep the choice on the menu.
- **Let users bring their own.** A "teach the master" mode (the user performs, the app learns it and teaches it back) and a file import (MIDI) on the 2D start page. It answers "can I do my song?" without shipping anyone's copyright.
- **Design numbers** (Meta's design skill): text at least 1 degree of view, targets 43 to 64 mm, nothing closer than 0.5 m, no thin fonts, a break reminder in long sessions, captions so it works without sound, one hand enough, left-handed detection.
- **Write the judging map up front** (`docs/JUDGING.md`): Innovation, Experience Design, Technical, Polish (25% each), plus the special award you are aiming for.

### Phase 2: Build (one system, explicit modes, data-driven content)
- **One `createSystem` with a small state machine.** For example `demo2d → placing → watch → calibrate → practice → complete`, plus a mode per craft. A second activity reuses placement, menu, captions and scoring: in the reference project, piano was a new mode, not a new app.
- **Content is data:** arrays of lessons and songs, each with an id, name, one-sentence teaching text and notes or strokes. Progress is keyed by id in localStorage. Adding a lesson is then a one-line change, and a menu with N tiles just hides unused ones.
- **Build everything from code.** Create entities with `world.createTransformEntity(obj, { parent, persistent: true })`; scene JSON is for the environment only.
- **Production look from day one.** The user called the first procedural look "dummy". Use real models from a Blender script, CC0 PBR textures, a coherent palette and type, and an arrival animation. Pipeline: assets-and-licensing.md.
- **Patterns** (see [references/patterns.md](references/patterns.md)):
  - table placement with fallback and anchor;
  - fingertip tracking with a One Euro filter and active-hand choice;
  - surface contact with calibration and hysteresis;
  - poke buttons on UIKit panels;
  - code-owned UIKit panels;
  - skinned ghost hand and procedural poses;
  - ribbons;
  - Web Audio sound;
  - session tuning;
  - 360-degree places with calm treatment and an ink-bleed dissolve (§13);
  - key presses with tracked fingertips (§14).
- **Feedback in place of haptics on every interaction:** a hover cue, a sound, a visual state change and a caption.
- **Sound design:** music chosen per place, with an on/off switch, and none when the user makes the sound (piano). Sampled instruments, effects through one compressor bus.
- **Text:** the UIKit fonts (Inter, Merriweather) cover Latin-1 (ü is fine), but have no CJK glyphs and no Indic shaping. Draw such text as geometry or with Canvas2D textures.

### Phase 3: Make it testable from the first day
- **Dev-only machine-readable logs:** `console.info('[tag] layout {json}')` with the world positions of every target the test must touch (start points, keys, buttons, seal). Also log every state transition, score and learned result. Guard them with `import.meta.env.DEV`.
- **A dev-only reset** (Shift+R clears localStorage and reloads), so every run starts as a first-time user.
- **Named state presets** in dev (`?state=lesson-complete`, `?state=piano-song-3`) that jump straight to a moment. They speed up testing, screenshots and filming the trailer.
- **Feature-detect and log Quest-only APIs** (`session.initiateRoomCapture`, persistent anchors, microgesture buttons) instead of assuming them. Never call `initiateRoomCapture` automatically: IWSDK 1.1.0 removed its own auto-call because it wiped anchors. Offer it behind a "Scan room" button.
- **Pure modules** (parsers, scoring, quantising) get a quick unit test: bundle with esbuild (`--platform=node --alias:@app=./src`) and run with node against generated fixtures (for example a MIDI file written by a Python script).

### Phase 4: End-to-end test in the emulator (IWER), hands only
Copy [scripts/iwsdk_e2e.py](scripts/iwsdk_e2e.py) to `tools/e2e.py` and write `main()` for the app's journey. Add a flag per feature (`--lessons N`, `--negative`, `--hand left`, `--jitter mm`, `--piano N`, `--compose`, `--watch`) so one command runs everything.

| Need | Command | Gotcha |
|---|---|---|
| Hands-only input | `xr set-input-mode {"mode":"hand"}`, `xr set-hand-pose {"device":"hand-right","poseId":"point"}` | Re-apply after `set-device-state` |
| Move a fingertip exactly | `xr animate-to {"device":"hand-right","anchor":"index-tip","position":{...},"duration":0.3}` | Positions are XR-origin metres |
| Trace a path or play notes in time | `xr run-sequence` steps `{anchor:"index-tip", position, duration}` | **Capped at 25 s**: send in chunks of about 18 s. The **other hand drops to the hip** and can cross surfaces |
| Press a UI button | `xr run-sequence {"steps":[{"target":"<element id>","press":{}}]}` | Targets come from `xr list-targets` (UIKit element ids). Press with the off hand |
| Read app state | `browser logs {"count":150}` | **count must be 200 or less**; mark by `timestamp`, never by line index |
| Enter or exit XR | `xr enter`, `xr exit`, `xr status` | With `offer: "always"` the session is re-offered after exit. Entering resets the head pose |
| Screenshot | `browser screenshot --output-file artifacts/x.png` | Only runtime screenshots prove system behaviour. **Look at every screenshot after a visual change**; most layout bugs (overlapping text, wrapped eyebrows, cramped labels) were caught that way |
| Reload the page | `browser reload` | Use after `xr exit` to see the 2D start page |
| Draw calls and triangles | log `renderer.info.render.calls/triangles` every few seconds in dev | The emulator renders each eye separately, so counts are about **double** what Quest's multiview draws. Old entries stay in the log buffer, so compare by timestamp |

**Rules that saved hours:**
- **Never edit `src/` while a test runs:** Vite hot-reloads and the XR session ends. This includes comments and doc comments in `src/`. Docs, the skill and `public/` assets outside the import graph are safe. If you slip, stop the run and restart it; don't trust the result.
- **Run long regressions in the background** and do docs or research meanwhile. Wait for the completion notice; don't poll.
- **Regression cadence:** a quick run (1 lesson + the changed feature) after each change, then a full run before each commit.

Minimum test matrix before calling it done:
1. The full journey (every lesson, level and song), right hand, with 3 to 6 mm of random fingertip error.
2. Negative cases (wrong direction, off target, too fast), each giving its specific hint.
3. Left hand.
4. Placement three ways: no table nearby, seated at a table, and a round table.
5. Menu buttons by poke and by pinch-ray, including switching activity.
6. User-content paths: perform a tune and check the app learned it exactly; parse a generated file fixture.
7. Production build: `npm run build`; `vite preview` serves everything; dev logs absent from the bundle.

### Phase 5: Measure and optimise
- **Budget:** 100 draw calls per eye or fewer, 100 to 300k triangles, one light plus IBL, no per-frame full shadow maps, no full-screen post-processing. If shadows matter (objects that move on a table), use two tiers: a static 512² map updated only when something settles, plus a small 128² shadow camera that follows only the moving objects (HandCraft XR's approach). No meshopt (IWSDK's loader lacks the decoder); Draco is optional (Blender's libdraco may be missing). Use `highp` in custom shaders.
- **Merge static models by material in Blender** before export. Keep only the nodes the code animates or names (keys, legs) separate. The grand piano went from 93 meshes to 7, and piano mode from 280 to 112 draw calls in the emulator.
- **Place panoramas cost one draw.** Use a 4096 x 2048 JPG on a sphere that follows the head.
- Desktop frame time does not predict Quest. Capture on the device (`hz-perfetto-debug`).

### Phase 6: Document, keep the skill current, ship
- **Docs per project, updated in the same commit as the feature:**
  - `README.md`: the experience, run, test, code map, credits;
  - `docs/JUDGING.md`: criteria to evidence, gaps marked;
  - `docs/SUBMISSION.md`: Devpost text, a shot list under 3 minutes with the hook in the first 30 s, the checklist;
  - `docs/TESTING.md`: harness, latest results, bugs fixed, on-device checklist.
- **Credits:** verify every author and licence from the source page before writing it. Don't attribute a track to an author you haven't confirmed; credit it by title and licence instead.
- **After each project, fold new lessons back into this skill** (generalised, not project-specific). Sync the copy into every project's `.claude/skills/`, and note them in the common plan.
- **Ship:** `npx vercel --prod` (keep `Permissions-Policy: xr-spatial-tracking=*`). Test the production alias logged out on a headset, and give judges a second tested mirror URL (winners did). Ask before deploying to the user's account, and make no redeploys after the deadline.
- **What judges see decides the score.** Every 2025 web winner had a live URL, a trailer recorded on a Quest in standalone mode, and evidence of on-device performance work. Reserve the last ~30 hours for headset QA, a 15-minute playtest with someone new to XR, deploy, trailer and forms; feature work stops there.
- **Write the Devpost text honestly:** name known issues and what is next, and link any SDK fork or patch you made (it reads as engineering depth).
- **On-device must-checks** the emulator cannot prove:
  - text and models render (multiview);
  - contact thresholds;
  - frame rate;
  - hand-tracking permission prompt;
  - system-menu pause;
  - the file picker in Quest Browser.

## Pitfalls (each one cost time once)
| Symptom | Cause | Fix |
|---|---|---|
| `npm ci` fails with EPROTO/TLS from onnxruntime-node | Downloads CUDA binaries on Linux | `.npmrc`: `onnxruntime-node-install-cuda=skip` |
| Panel invisible, no error | UIKit units are cm, so scale was 100× too small; or the panel faces away (panels face +Z) | scale ≈ width_m / (units/100); yaw toward the viewer |
| Poke does nothing on UIKit buttons (emulator) | Touch pointer does not click | Custom press test (patterns §3) |
| `fillPoses` type error | Missing from the WebXR TS types | Cast the frame type |
| Strokes, buttons or keys fire on their own | A hand passing through a surface, a resting hand chosen as active, or curled fingers dipping | Minimum duration, plunge detection, ignore hands far below, prefer the current hand; for keys, only the lowest extended fingertip per hand |
| First action after calibration is garbage | The finger is still on the calibration target | Require a lift before the first action |
| Content hangs off round tables | Clamped to the polygon AABB only | Point-in-polygon footprint, slide toward the centroid |
| A translucent hand reads backwards | Seen end-on from the user's eyes | Angle it like a real arm (from the user's side), raise the body fill, add a tip glow |
| Test waits forever | `browser logs` count over 200, or line-index bookkeeping | count ≤ 200, timestamp marks, capture stderr |
| XR session ends mid-test | Hot reload from editing anything in `src/` | Edit only between runs; restart the run if you slipped |
| Draw calls look doubled, or show impossible spikes | The emulator renders each eye separately; old log lines from an earlier run | Halve for Quest; compare entries by timestamp |
| Text in a bubble or tile overflows | Fixed widths sized for one letter ("D#" is two) | Size by label length; check screenshots |
| A 360-degree photo shows a vertical seam | Default clamp wrapping | `wrapS = RepeatWrapping` with mipmaps (patterns §13) |
| Users call the place "busy" or "distracting" | A crisp photo competes with the task | Calm shader and face the calmest view |
| Users dislike seeing the room and the place at once | A partial overlay | One world at a time with a dissolve |
| A song or melody doesn't fit the instrument | Range too small | Make the range a parameter in the Blender script (we extended A3–C5 to A3–E5) and rebuild |
| Wikimedia downloads fail with HTTP 429 | Rate limit | `curl`, 3 to 4 s apart, thumbnail URLs |
| `metavr asset search` returns "Invalid API response" | Server-side gate on Meta's asset API (Nov 2026) | Poly Haven, ambientCG, Commons and Blender scripts |
| Pinch flickers at the edge | IWSDK 1.1.0 uses one 8 mm threshold | Hysteresis for custom pinches: start at 8 mm, release at 15 mm (patterns §16) |
| Real fingers vanish under virtual paper | No depth occlusion | Accept the IWSDK hand outline, or test `DepthOccludable` on device |
