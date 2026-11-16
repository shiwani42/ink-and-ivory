# Choosing the build path: WebXR (IWSDK) or a native engine

Meta VR Start allows Unity, Unreal, Godot, native Android (including Spatial SDK) or IWSDK/WebXR, with no effect on prize eligibility (FAQ: "Am I required to use a specific build path or engine?"). Meta Portal devices are not Quest headsets and do not apply. Decide at the start of a project. Switching mid-competition means a rebuild.

## What a native engine adds, and what WebXR can match
Every option renders on the same Quest 3/3S mobile GPU; that sets the ceiling. Most of "looks better" is art, lighting and materials, not the engine.

| Native (Unity/Unreal) gives you | WebXR / IWSDK equivalent |
|---|---|
| Baked lightmaps and ambient occlusion | **Yes:** bake in Blender, export as glTF occlusion (`bake_ao` in visual-quality.md) |
| ASTC texture compression | **Yes:** KTX2 / Basis (IWSDK bundles three's `KTX2Loader`) |
| MSAA | IWSDK creates the renderer with `antialias: true`; check on the headset |
| Application SpaceWarp | No in practice (needs a `chrome://flags` switch on the judge's headset) |
| Meta Interaction SDK hand visuals, gaze interactions (ISDK v207+), MRUK room model | Partly: IWSDK hands, planes, meshes and anchors. The Technical criterion names "gaze interactions (Unity/Unreal ISDK v207+)" and MRUK explicitly, which favours native for that criterion |
| Asset Store, Meta Asset Library inside the editor | Free CC0 sources plus Blender scripts; the Meta Asset Library is reachable only from Unity or Meta Spatial Editor (Windows/macOS) or the `metavr` CLI |
| Lumen, Nanite (Unreal) | Not on standalone Quest in any engine |

## What WebXR gives that native doesn't
- **Judges open a link.** Native needs an APK in a "Competition" release channel (Developer Center organisation, app, release channel setup).
- **Iteration in seconds** with hot reload and an emulator (IWER) that runs anywhere, including Linux. Unity's editor runs on Linux, but Meta XR Simulator and Quest Link are Windows/macOS only.
- **Automated end-to-end tests of hand journeys** through the IWSDK CLI.
- **Precedent:** IWSDK entries win (2025: an IWSDK prize category; HandCraft XR took a Judges' Choice award).

## Decision guide
- **WebXR/IWSDK** when the deadline is short, the team develops on Linux, instant access matters, or the experience is UI, teaching or tabletop-scale.
- **Unity** when the project needs a rich room model (MRUK: walls, furniture, scene mesh), gaze interactions, heavy realistic art, Passthrough Camera Access, or Asset Store content, *and* there are weeks, not days, plus Windows or Mac and a headset.
- **Unreal** only with an experienced Unreal team; its mobile path drops its headline features.
- **Spatial SDK (Kotlin)** for apps that mix 2D Android panels with 3D; not a visual upgrade over Unity.
