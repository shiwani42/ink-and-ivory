# Meta XR resources: what a WebXR team can use, and what a native team would use

A short, sourced guide for future projects, written 18 Nov 2026 while building Hands of a Master (HOAM). HOAM is a WebXR app for Quest Browser built with IWSDK 1.1.0. The four resources are the Meta XR SDK (Interaction SDK and Platform SDK), the hand-tracking docs, the mixed-reality docs and Meta Quest Developer Hub.

Every link below is a developers.meta.com page fetched on 18 Nov 2026. Meta serves the same pages under `/horizon/` and `/vr/`; the `/horizon/` path is cited. HOAM's own comparison against these resources is in [INTEGRATION-meta-xr.md](INTEGRATION-meta-xr.md), and the hand-tracking one is in [INTEGRATION-handtracking.md](INTEGRATION-handtracking.md).

**Rule of thumb:** the Meta XR SDK packages (Interaction SDK, Platform SDK, MR Utility Kit, Depth API, Passthrough Camera API) are for Unity, Unreal, native code and, in part, Spatial SDK. A WebXR app gets the same *capabilities* through WebXR features in Quest Browser, which IWSDK wraps. The design guidance applies to every engine.

## 1. Meta XR SDK: Interaction SDK (ISDK)
| | |
|---|---|
| **What it gives** | Poke, ray, grab (with snap), hand grab, distance grab, throw, pose and gesture detection, microgestures (v74+, scroll in v207), locomotion, a ready-made interaction rig, and gaze plus pinch (an experimental Building Block in v207; hands only; falls back to rays without eye tracking). It works with hands and controllers. [Unity overview](https://developers.meta.com/horizon/documentation/unity/unity-isdk-interaction-sdk-overview/), [gaze](https://developers.meta.com/horizon/documentation/unity/unity-isdk-gaze-building-blocks/), [Unreal](https://developers.meta.com/horizon/documentation/unreal/unreal-isdk-overview/) (UE 5.4+) |
| **Engines** | Unity and Unreal. There is no WebXR or Spatial SDK version. |
| **WebXR team** | Use IWSDK's built-in interactions instead ([guide](https://developers.meta.com/horizon/documentation/iwsdk/guides/06-built-in-interactions/)): `RayInteractable` and `PokeInteractable` (with the transient `Hovered` and `Pressed` tags), `OneHandGrabbable`, `TwoHandsGrabbable`, `DistanceGrabbable`, gaze through the `gazeTracking` feature, and `LocomotionEnvironment`. Raw hands come from WebXR's 25 joints (`getJointPose`, `fillPoses`); a pinch arrives as `select` and as button 0 on the hand's gamepad ([WebXR hands](https://developers.meta.com/horizon/documentation/web/webxr-hands/)). Pose detection you write yourself from the joints (HOAM's thumbs-up detector: `src/hands/hand-gestures.ts`). |
| **Unity/native team** | Add the Meta XR Interaction SDK package and start from the Comprehensive Interaction Rig. Use `HandGrabInteractable` and `DistanceHandGrabInteractable` for objects, and `PokeInteractable` on canvases for UI. |

## 2. Meta XR SDK: Platform SDK
| | |
|---|---|
| **What it gives** | Entitlement check (required), user and friends, app invites, Group Presence and Destinations (deep links into a moment), leaderboards, achievements, challenges, in-app purchases (IAP) and DLC, matchmaking and rooms, cloud storage, and asset files. Every app must pass the entitlement check and a Data Use Checkup (DUC). [Unity intro](https://developers.meta.com/horizon/documentation/unity/ps-platform-intro/), [native intro](https://developers.meta.com/horizon/documentation/native/ps-platform-intro/), [Unity package v209](https://developers.meta.com/horizon/downloads/package/meta-xr-platform-sdk/), [Kotlin package](https://developers.meta.com/horizon/downloads/package/horizon-platform-sdk-kotlin/0.1.3), [Spatial SDK engagement](https://developers.meta.com/horizon/documentation/spatial-sdk/ps-user-engagement-overview/) |
| **Engines** | Native, Unity and Unreal ("on both Meta VR devices and PC VR"), plus a Kotlin package for Android and Spatial SDK. |
| **WebXR team, in Quest Browser** | **Nothing.** A page opened from a URL has no JavaScript Platform API. That means no invites, no leaderboards, no achievements, no destinations, no matchmaking, no cloud saves and no entitlement check. |
| **WebXR team, as a Store PWA** | **IAP only.** It works inside an immersive WebXR PWA installed from the Horizon Store (including the ALPHA and BETA channels), through the Digital Goods API (`window.getDigitalGoodsService('https://quest.meta.com/billing')`, `getDetails`, `listPurchases`) and the Payment Request API (`supportedMethods: 'https://quest.meta.com/billing'`). Durable and consumable items are supported; subscriptions are not. `listPurchases()` doubles as an ownership check. Meta adds `getLoggedInUserId()` (an app-scoped ID) and `getUserAccountAgeCategory()`, which Mixed Ages apps must call on every launch. Setup needs a DUC with IAP and "Horizon Billing" in the Bubblewrap packaging. Test a sideloaded build with the flag `#enable-debug-for-store-billing`. [Web IAP](https://developers.meta.com/horizon/documentation/web/ps-iap/), [PWA overview](https://developers.meta.com/horizon/documentation/web/pwa-overview/), [PWA packaging](https://developers.meta.com/horizon/documentation/web/pwa-packaging/) |
| **Web substitutes** | Multiplayer: your own WebSocket or WebRTC server. Invites: a share link (HOAM's `?tune=` links). Leaderboards: your own backend. Saves: `localStorage` or your own backend. |
| **Unity/native team** | Initialise the platform (`Core.AsyncInitialize`), check the entitlement, then call `Leaderboards`, `Achievements`, `GroupPresence`, `IAP` and so on. Configure each item in the Developer Dashboard. |

## 3. Hand-tracking documentation
- **Pages:** [Unity hand-tracking overview](https://developers.meta.com/horizon/documentation/unity/unity-handtracking-overview/), plus the design pages [hands](https://developers.meta.com/horizon/design/hands/), [best practices](https://developers.meta.com/horizon/design/hands-best-practices/), [limitations](https://developers.meta.com/horizon/design/hands-limitations-mitigations/), [gesture design](https://developers.meta.com/horizon/design/hands-gesture-design/) and [touch](https://developers.meta.com/horizon/design/touch_usage/).
- **Applies to every engine:** poke near and ray far; feedback at the point of contact; lenient gestures with gating; plan for tracking loss; rest periods; no hands above the heart.
- **Web-only facts:** a palm pinch is reserved by the system (on the left hand it opens the menu, which ends the session). There is no confidence value, no Fast or Wide Motion Mode and no Capsense. Microgestures are documented only for Unity and native code; IWSDK and IWER map them to hand-gamepad buttons 5 to 9, but whether Quest Browser sends them is unconfirmed.
- **HOAM's full table:** [INTEGRATION-handtracking.md](INTEGRATION-handtracking.md).

## 4. Mixed-reality documentation (scene understanding)
| Native feature | What it is | WebXR / IWSDK equivalent in Quest Browser |
|---|---|---|
| **Scene** and **MR Utility Kit (MRUK)** ([scene](https://developers.meta.com/horizon/documentation/unity/unity-scene-overview/), [MRUK](https://developers.meta.com/horizon/documentation/unity/unity-mr-utility-kit-overview/), [placement](https://developers.meta.com/horizon/documentation/unity/unity-mr-utility-kit-content-placement/)) | The room model from Space Setup: rooms, labelled anchors, EffectMesh, surface queries, `FindSpawnPositions`, `GetKeyWall`, environment raycast, world locking, Space Sharing, Scene Debugger | `plane-detection` (`XRPlane`: horizontal or vertical polygons from Space Setup, with `semanticLabel`) and `mesh-detection` (`XRMesh`: labelled 3D volumes and the global mesh). IWSDK: `planeDetection`, `meshDetection` and `sceneUnderstanding` ([guide](https://developers.meta.com/horizon/documentation/iwsdk/guides/11-scene-understanding/)). **There is no `FindSpawnPositions`, room object or key wall**: write the query over `XRPlane` and `XRMesh` yourself (HOAM's is `src/mr/room-placement.ts`) |
| Space Setup prompt | Ask the system to scan the room | `session.initiateRoomCapture()`: once per session, only after 2 to 3 s with no planes, and only on a user's press ([web MR](https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/)) |
| Environment raycast (depth based) | Place on any real surface instantly | WebXR hit test; IWSDK `EnvironmentRaycastTarget` with the `hitTest` feature. It needs no room scan but returns no labels ([guide](https://developers.meta.com/horizon/documentation/iwsdk/guides/14-environment-raycast/)) |
| Spatial anchors, persistence | Lock content to the room; bring it back next session | `createAnchor`, `requestPersistentHandle` and `restorePersistentAnchor`: up to 8 persistent anchors per site, none in private browsing, deleted when history is cleared ([web MR](https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/)). IWSDK keeps one persistent anchor and an `XRAnchor` component |
| Shared Spatial Anchors, colocation | Two headsets share one room frame | **Not in WebXR.** Native only ([SSA](https://developers.meta.com/horizon/documentation/unity/unity-shared-spatial-anchors/)) |
| **Depth API** | Occlusion and raycasts from real-time depth (Quest 3/3S; unreliable under about 0.2 m) ([Depth API](https://developers.meta.com/horizon/documentation/unity/unity-depthapi-overview/)) | WebXR `depth-sensing`; IWSDK `DepthSensingSystem` and `DepthOccludable` in Soft, Hard or MinMaxSoft mode ([guide](https://developers.meta.com/horizon/documentation/iwsdk/guides/15-depth-occlusion/)). Custom shaders may not occlude |
| **Passthrough Camera API** (PCA) | Camera pixels for computer vision (Quest 3/3S, OS v74+, a permission, up to 1728², 60 Hz) ([PCA](https://developers.meta.com/horizon/documentation/unity/unity-pca-overview/)) | **Not documented for WebXR.** Passthrough pixels can't be read in `immersive-ar` |
| Design guidance ([MR design](https://developers.meta.com/horizon/design/mr-design-guideline/), [scene design](https://developers.meta.com/horizon/design/mr-design-scene/), [scene best practices](https://developers.meta.com/horizon/documentation/native/scene-best-practices/)) | Don't assume a table, sofa or floor exists, and offer an alternative. About half of users sit. Restrict placement by label. Keep visible surface effects minimal. Plan for drift of a few cm. Prefer the table plane to the cluttered mesh for tabletop play. Check that the loaded room is the one the user is in | **Applies to WebXR in full.** |

**Semantic labels:** IWER and Quest report `table`, `couch`, `wall art`, `door`, `window`, `floor`, `ceiling`, `wall`, `other` and so on. The WebXR registry ([semantic-labels](https://github.com/immersive-web/semantic-labels)) names `desk` rather than `table`. Accept both, and normalise spaces and underscores.

## 5. Meta Quest Developer Hub (MQDH, renamed Meta VR Developer Hub)
- **What it does:** device manager, logs, screenshots and video, casting, app install, Store upload, proximity sensor and boundary switches, Performance Analyzer, Perfetto, File Manager. It runs on Windows and macOS; **there is no Linux build** ([MQDH](https://developers.meta.com/horizon/documentation/native/android/ts-mqdh/)).
- **On Linux, use the Meta VR CLI `metavr`** (formerly `hzdb`). It has a native Linux x86_64 installer ([overview](https://developers.meta.com/horizon/essentials/metavr-overview/), [install](https://developers.meta.com/horizon/install-cli/)). Our binary: `~/.metavr/npm/binaries/@meta-quest__metavr-linux-x64/1.10.0.30.10/metavr` (not on `PATH`; alias it to `metavr`).

| MQDH task | Linux (`metavr` 1.10) |
|---|---|
| Device list, info, battery | `metavr device list`, `metavr device info`, `metavr device battery` |
| Keep awake, no proximity sleep, no boundary while testing | `metavr device configure-testing setup` (later `... restore`), `metavr device proximity`, `metavr device boundary` |
| Wireless ADB | `metavr device wifi`, `metavr adb connect <ip>` |
| Serve the dev server to the headset (USB) | `metavr adb reverse tcp:8081 tcp:8081`, then `metavr device browser https://localhost:8081` |
| Screenshot | `metavr capture screenshot -o shot.png --width 1920 --height 1080` |
| Video capture | `metavr capture video start --width 1920 --height 1080` ... `metavr capture video stop -o clip.mp4` |
| Casting | `metavr casting start`, `metavr casting status`, `metavr casting stop` |
| Logs (logcat) | `metavr log -t chromium -n 200` (for console lines from Quest Browser, also use `chrome://inspect`) |
| Perf capture (Perfetto) | `metavr perf capture --app com.oculus.browser --mode vr --duration 10000 -o run1`, then `metavr perf analyze-trace`, `metavr perf open <trace>`, `metavr perf compare a b` |
| CPU or GPU bound? | `metavr perf monitor`; live counters: `metavr shell ovrgpuprofiler --realtime="29,30"` |
| OVR Metrics HUD | `metavr tools install ovrmetric` |
| Runtime overrides (foveation, CPU/GPU level) | `metavr device vrruntime get` / `set` / `reset` |
| Files | `metavr files ls|push|pull` |
| Store upload | `metavr tools install platform-utils` (the `ovr-platform-util` uploader) |

- **Web debugging on the device:**
  - Run `adb reverse`, then open `chrome://inspect/#devices` on the PC and inspect the Quest Browser tab ([remote debugging](https://developers.meta.com/horizon/documentation/web/browser-remote-debugging/)).
  - For frame timing, take a DevTools trace with the `xr.debug` category, use the OVR Metrics HUD, or use `ovrgpuprofiler` ([WebXR perf tools](https://developers.meta.com/horizon/documentation/web/webxr-perf-tools/), [WebXR perf](https://developers.meta.com/horizon/documentation/web/webxr-perf/)).
  - IWSDK can also pair a headset to its CLI: `npx iwsdk runtime pair-headset`; see the `iwsdk-native-xr-test` skill.
- **Without a headset:** use IWER (IWSDK's emulator). It simulates rooms (the built-in SEM rooms, switchable at runtime: `window.IWER_DEVICE.sem.loadDefaultEnvironment(name)`), planes, meshes, hit test, anchors (persistent through `localStorage`), hands, poses and microgestures.
- **Also listed for Linux x64** in `metavr tools list` (1.10): `xrsim` (Meta XR Simulator, an alpha) and `spatial-editor`. We have not tried either. Meta Spatial Simulator (`spatialsim`) runs Android apps and can't test WebXR.
