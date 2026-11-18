---
name: quest-hands-first-webxr
description: Build, test and ship a hands-only, seated, mixed-reality WebXR app for Meta Quest 3/3S with IWSDK, to competition quality. Use when starting or extending any IWSDK/Quest project: design, pinch/poke/grab input, real-table placement, spatial text and UIKit panels, lighting and performance budgets, free/CC0 or AI-generated assets and licensing, emulator end-to-end tests, and Meta VR Start submission (judging, trailer, deploy). For tutors or games, also load quest-mr-tutor or quest-mr-game.
---

# Hands-first mixed reality on Quest with IWSDK

The competition layer on top of Meta's official `iwsdk-*` skills: what to build, which numbers to use, how to test without a headset, and how to submit. It was distilled from two full build-and-rebuild cycles:
- a hands-on tutor (calligraphy and piano with a ghost master hand): `hands-of-a-master/`;
- a board game against a realistic NPC on the user's real table: `chausar/`.

Both first versions "worked" and were still called *dummy* by the user. Everything below moves the later lessons to the first hour.

## Routing: which skill owns what
- **`iwsdk-dev` first** for any build, extend, fix or polish request. It routes to the narrow specialists: `iwsdk-ui` (UIKitML panels), `iwsdk-build-model` (one model), `iwsdk-compose-scene` (scene JSON, lighting, environment), `iwsdk-grab`, `iwsdk-ray`, `iwsdk-physics`, `iwsdk-depth-occlusion`, `iwsdk-debug`, `iwsdk-hosting`, `iwsdk-pwa-packaging`; and `iwsdk-native-xr-test` for a Quest over USB. Use those for *how the SDK does it*; use this skill for *what good looks like here* and the competition process.
- **Genre add-ons:** `quest-mr-tutor` (demonstrate-then-practise, ghost hand, surface contact, lessons, user content) and `quest-mr-game` (rules sim, controllable physics, NPC and realistic character, juice).
- **Meta's design skills** (`meta-quest/agentic-tools`, Apache-2.0): copy `hz-immersive-designer`, `hz-iwsdk-webxr`, `hz-vr-debug`, `hz-perfetto-debug` into `.claude/skills/` with the licence.

## References (load when the phase needs them)
| File | Contents |
|---|---|
| [references/build-path.md](references/build-path.md) | WebXR/IWSDK vs Unity/Unreal/Android: what each gives visually and technically, decision guide |
| [references/process.md](references/process.md) | Working with the user, iteration loop, parallel agents, lessons from past winners |
| [references/architecture.md](references/architecture.md) | One system + state machine, content as data, lifecycle, saves, dev presets, LLM contract |
| [references/hands-input.md](references/hands-input.md) | Joints, smoothing, active hand, both pinch tiers, grab point, gestures, microgestures |
| [references/placement.md](references/placement.md) | Plane search, fallback chain, anchors, plane outline, room scan, occlusion |
| [references/ui-text.md](references/ui-text.md) | Design numbers, UIKit panels, fingertip poke, text regions, fit-to-card, onboarding, fonts |
| [references/visual-quality.md](references/visual-quality.md) | Lighting, shadows, materials, grounding, places and domes, juice, performance budget |
| [references/audio.md](references/audio.md) | Web Audio synthesis, samples, music per place, variation, TTS |
| [references/assets-and-licensing.md](references/assets-and-licensing.md) | Free sources, Blender pipeline, AI generation on free quota, cleanup, what not to ship |
| [references/testing.md](references/testing.md) | Test layers, emulator harness contract, CLI table, test matrix, headset-only checks |
| [references/submission.md](references/submission.md) | Judging map, Meta's takeaways as the pitch, docs, trailer, deploy, write-up |
| [references/meta-resources.md](references/meta-resources.md) | Meta's hands-first success stories and docs, with links: what each means for a WebXR entry, what has no web equivalent |

Scripts: [scripts/xr_e2e_lib.py](scripts/xr_e2e_lib.py) (emulator end-to-end library), [scripts/goto_preset.mjs](scripts/goto_preset.mjs) (jump to a `?state=` preset in the emulator), [scripts/blender_preview_glb.py](scripts/blender_preview_glb.py) (render any GLB), `scripts/assets/` (free asset generation and cleanup; see assets-and-licensing.md).

## Ten rules
1. **Set the visual bar on day one.** Plan art direction, lighting, text system and the hero object or character before gameplay code. A grey box that passes tests gets rejected wholesale.
2. **Build the smallest complete journey first** (enter, place, do, succeed, finish), test it end to end, then polish. Every later change is then regression-tested.
3. **Never show work you haven't inspected.** Look at every runtime screenshot after a visual change; add dev review cameras and state presets so you can.
4. **Bisect before patching.** When something looks wrong, A/B each pipeline stage (source render vs engine, rest vs posed, compressed vs not). One A/B finds the stage; tuning symptoms wastes rounds.
5. **Ask constraints early, in one go:** budget (free only?), accounts (Hugging Face, Sketchfab), GPU, deadline, who submits, whether you may commit and deploy. Don't build a paid path before asking.
6. **One dev port per project** (`vite.config.ts` `server.port`, and the README). Check `ss -ltnp | grep 808` before starting.
7. **Never edit `src/` while an emulator test runs.** Hot reload ends the XR session; restart the run if you slipped.
8. **Every pipeline is a script in the repo** (`tools/…`): model build, asset generation, cleanup, previews. You will re-run it ten times.
9. **Treat feedback as a design rule,** and write the rule into this skill after the project.
10. **Report honestly and briefly:** done and verified, not done, what the user must do (exact steps, links). Decisions that are the user's (spend, accounts, style, publishing) get 2–4 options and a recommendation.

## Workflow

### Phase 0: Orient and set up (Linux first; the Meta VR CLI records and casts from Linux)
1. Read `AGENTS.md`, `.claude/rules/*`, `iwsdk.config.json`, `src/*.ts`, the scene JSON in one bounded pass. For a new project, decide the build path first (WebXR vs Unity/Unreal): [references/build-path.md](references/build-path.md).
2. **Scaffold:** `npx @iwsdk/create` (AR target, TypeScript, scene understanding). Pin `@iwsdk/core` exactly, 1.1.0 or later (fixes missing textures under multiview).
3. **`.npmrc`:** `onnxruntime-node-install-cuda=skip`, or `npm ci` fails on Linux.
4. **Install:** `npm ci`, then `npm run setup` (the scaffold's script is `iwsdk adapter sync && iwsdk reference warmup`). Gitignore `.mcp.json` and `opencode.json` (absolute paths).
5. **Repo:** `.gitattributes` with `* text=auto eol=lf`; one git repo per project.
6. **Dev server:** `npx @iwsdk/cli dev up --ai-mode agent` (headless) or `--ai-mode collaborate` (headed, the user watches). Ask the user once which; announce any change. Add `--allow-browser-automation` if you will use `browser run` (presets, see testing.md). Wait for `dev status` → `browserCommandReady: true`.
7. **Tools:** Blender (`blender -b --python`), `ffmpeg`, `curl` (works where Python TLS resets), `node_modules/.bin/esbuild`, `gltf-transform`.
8. **Background research** (one agent, narrow brief): domain rules for a 2–4 minute session, CC0 assets with URLs and licences, tricks for the riskiest mechanic, prior art for the novelty claim, how past winners made things look alive. Output to `docs/RESEARCH.md`.

### Phase 1: Design the first five minutes
- **One verb a stranger gets in 2 seconds**, at most two more, and **one awe moment within 60–90 s**.
- **The real room must matter:** content on the user's real table (the surface gives the touch hand tracking lacks); an advanced verb that uses the room (e.g. hide your hand below the real table edge). Purposeful passthrough is judged.
- **Defaults first, choices later.** No settings screen in the first minute; offer choices (language, music, scene) after the first success.
- **Teach in context:** one-time hints at the moment each mechanic becomes possible; captions so it works without sound.
- **A reason to come back:** persistent progress (versioned localStorage).
- **Design numbers** (ui-text.md): text ≥1° of view, targets 43–64 mm, nothing closer than 0.5 m, one hand enough, left-handed support, break reminder in long sessions.
- **Write `docs/JUDGING.md` now:** Innovation, Experience Design, Technical, Polish (25% each), plus the special award you target.

### Phase 2: Architecture and build
- One `createSystem` director with an explicit phase enum (architecture.md); small pure modules; content as data; entities from code with `world.createTransformEntity(obj, { parent, persistent: true })`; scene JSON for the environment only.
- Delete the scaffold demo content in one pass. Import three.js only from `@iwsdk/core`. Never allocate in `update()`.
- Feedback in place of haptics on every interaction: hover cue, sound, visual state change, caption.

### Phase 3: Hands and placement
Read hands-input.md and placement.md. The short version:
- **Pinch has two tiers:** precise select 8 mm start / 15 mm release; grab-and-throw 22 mm / 40 mm. IWSDK's built-in select is a single 8 mm threshold with a 200 ms cooldown.
- **Never do what the player didn't mean:** tracking lost while holding → a fast hand throws, a slow one leaves the object waiting (glide back or cancel); choices commit by pinch or a 0.3 s dwell, never a passing fingertip; a short take-back window. hands-input.md, "Intent guardrails".
- **Placement chain:** labelled table/desk plane in front → hand-follow + pinch → virtual table (plus a "Scan room" button). Anchor it; keep the plane outline.

### Phase 4: Testable from day one
Dev-only structured logs (`[tag] #page.seq event key=value layout={json}`), a dev reset key, named `?state=` presets, feature-detected Quest-only APIs, unit tests for pure modules. Details: testing.md and architecture.md.

### Phase 5: End-to-end in the emulator (not optional)
Copy `scripts/xr_e2e_lib.py`, write the journey, give each feature a flag, run the whole matrix in one command (`npm run test:xr`). Every bug that would have cost points was found by running the journey. Quick run after each change; full run before each commit. Run long suites in the background; don't poll.

### Phase 6: Make it production-grade (in order of impact)
1. Lighting and grounding (baked AO first); 2. the hero object or character; 3. environment (place or dome); 4. materials that glint (clear coat); 5. juice; 6. text; 7. sound, positioned in 3D (HRTF). See visual-quality.md, audio.md, assets-and-licensing.md.

### Phase 7: Measure and optimise
Target **72 fps; 60 fps is the hard floor.** Budget: ≤100 draw calls per eye, aim ≤150k triangles (300k ceiling), one shadow map, no full-screen post-processing. The emulator renders each eye separately: halve its counts. Desktop frame time does not predict Quest; capture on the device (`metavr perf capture`, testing.md; `hz-perfetto-debug`). With headroom, step up to 90 Hz (visual-quality.md).

### Phase 8: Judge yourself, then document
Score the four criteria honestly. List what only a headset can prove (testing.md). Write README, `docs/JUDGING.md`, `docs/TESTING.md`, `docs/SUBMISSION.md`, CREDITS, in-app credits (submission.md). Update docs in the same commit as the feature.

### Phase 9: Ship
- Typecheck, build, grep `dist/` for dev logs and handles.
- Deploying creates a public URL: ask first. `npx vercel --prod`, keep `Permissions-Policy: xr-spatial-tracking=*`, test the production URL logged out on a headset, and give judges a second tested mirror.
- Reserve the last ~30 hours for headset QA, a 15-minute playtest with someone new to XR, trailer and forms.
- **Commit after green runs once the user has approved commits;** otherwise leave changes for review and say so.
- Save a memory note: status, port, pending headset checks, the user's quality bar.
- After the project, fold generalised lessons back into the canonical skill (`meta-vr/skills/`), then run `meta-vr/skills/sync.sh`.

## Defaults where the two builds differed (pick by context)
| Topic | Use this | When |
|---|---|---|
| Pinch thresholds | 8 mm start / 15 mm release | selecting, UI, precise picks |
| | 22 mm / 40 mm, 150 ms tracking-loss grace | grabbing, carrying and throwing objects |
| World mode | One world at a time: passthrough, or a full place with a dissolve | default; any task that fills the view |
| | Wall-replacing dome faded out below −15° | the real table, hands and floor are the play surface |
| Image lighting | `IBLGradient` ~0.25 + one directional light | matte content (paper, wood, cloth) |
| | `IBLTexture {src:'room'}` ~0.8 | metal, gold, lacquer, glass (needs reflections) |
| Shadows | One 1024² map, tight camera, `autoUpdate=false`, refresh on motion | one play area, occasional moves |
| | Static 512² map refreshed on settle + 128² follower on moving objects | objects that move continuously |
| Foveation | 0.4 | text-heavy views |
| | 0.5 | scenes with more fill, little small text |
| Subtitles | World-anchored near the speaker | at a table, looking down |
| | Head-stabilised lazy follow | open scenes; never for panels with buttons |
| Draco | Never on skinned meshes; avoid in general (Blender's libdraco may be missing). No meshopt (IWSDK can't decode it) | always |

## Pitfalls (each cost an iteration)
| Symptom | Cause | Fix |
|---|---|---|
| `npm ci` EPROTO/TLS from onnxruntime-node | CUDA download on Linux | `.npmrc` skip line |
| Test waits forever or false PASS | stale lines (buffer survives reloads), `browser logs` count >200 | `--since <ms>` + page id/seq pinning (testing.md) |
| `run-sequence` fails on long paths | IWER gives up 28 s after dispatch (30 s bridge) | chunks of about 18 s |
| The other hand crosses your surface | during `run-sequence` the idle hand drops to the hip | park it first; check contacts by hand id |
| `?state=` ignored in the emulator | the managed browser drops URL queries | `scripts/goto_preset.mjs` via `browser run` |
| XR session ends mid-test | hot reload from editing `src/` | edit only between runs |
| Panel invisible | UIKit units are cm, or panel faces away (+Z) | scale ≈ width_m / (units/100); yaw to viewer |
| Poke doesn't click UIKit buttons (emulator) | touch pointer doesn't click | own press test (ui-text.md) |
| `fillPoses` type error | missing from WebXR TS types | cast the frame |
| Second placement of a model steals the first | `AssetManager.loadGLTF` caches by URL | `gltf.scene.clone(true)` per placement |
| Bone or node lookup fails | GLTFLoader sanitises names (`wrist.R` → `wristR`) | look up raw and sanitised |
| Subtitle bar behind the camera | `getWorldDirection` is −Z for cameras, +Z for objects | forward = `(0,0,-1)` rotated by world quaternion |
| Shadows never appear | materials compiled before `shadowMap.enabled` flipped | force one recompile |
| Frame hitch when a light is added | adding/removing lights recompiles every lit shader | create all lights in `init` |
| Text clipped on all sides | canvas wrap fits width only | fit width *and* height |
| Room capture wipes anchors | `initiateRoomCapture` (IWSDK 1.1.0 disabled its auto-call) | only behind a "Scan room" button |
| Draw calls doubled or spiking | emulator renders each eye; old log lines | halve; compare by timestamp |
| `!state.winner` wrong | seat or index 0 is falsy | compare with `=== undefined` |
| `pkill -f <pattern>` kills your shell | the pattern matches your own command | narrower pattern or PID |
| A test of tracking loss can't resume the hold | IWER reconnects a hand open (pinch 0) | `xr set-device-state` with `connected`, `position` and `pinchValue` in one call |
| A take-back or flip window test is flaky | each CLI call costs ~1 s | pre-position the hand before the window opens |
| A skinned hand or character draws nothing (or sits at the origin) after `clone(true)` | `Object3D.clone` keeps a SkinnedMesh bound to the *original* bones | use the loaded scene once, or `SkeletonUtils.clone` |
| Only the last of two narrator lines appears | a subtitle system that replaces queued lines of the same voice | send a multi-sentence passage as one call (it pages itself) |
| `metavr asset search` "Invalid API response" | server-side gate (Nov 2026) | Poly Haven, ambientCG, Commons, Blender scripts |
