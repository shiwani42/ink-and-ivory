# Hands as the only input

## What IWSDK gives you (1.1.0, `@iwsdk/xr-input` hand adapter)
- Select (pinch) commits when thumb tip and index tip are **closer than 8 mm**, then holds for a **200 ms cooldown**. There is no release threshold, so edge cases can flicker; use your own hysteresis for anything custom.
- `getPinchStrength()` gives a continuous 0–1 from 50 mm (open) to 8 mm (closed): use it for pre-commit affordances.
- Microgestures arrive on the hand's xr-standard gamepad: buttons **5 swipe-left, 6 swipe-right, 7 swipe-forward, 8 swipe-backward, 9 tap**, pressed for ~35 ms, with no select events. Testable in the emulator: `xr microgesture {"device":"hand-right","gesture":"tap"}` (raise the hand side-on in view first). Still verify on a Quest; treat as an optional shortcut with a 200 ms refractory period.
- For grab and ray behaviour prefer the official components (`iwsdk-grab`, `iwsdk-ray` skills); the numbers below are for custom interactions.

## Reading joints
```ts
const frame = this.xrFrame, ref = this.renderer.xr.getReferenceSpace();
for (const source of this.renderer.xr.getSession()!.inputSources) {
  if (!source.hand) continue;
  const pose = frame.getJointPose!(source.hand.get('index-finger-tip')!, ref!);
  // world = pose position (× player.matrixWorld if the player moved), then into your object's local space
}
(frame as any).fillPoses(Array.from(source.hand.values()), ref, out /* Float32Array(25*16) */); // cast: missing from TS types
```
- Smooth with a One Euro filter per axis: `minCutoff 2`, `beta 20`, metres.
- Controllers: fall back to grip pose plus select as "pinch".

## Pinch: two tiers (both used in shipped builds; verify on a headset)
| Use | Start | Release | Extras |
|---|---|---|---|
| Precise select, UI, picking a small item | < 8 mm | > 15 mm | matches IWSDK's commit distance |
| Grab, carry and throw objects | < 22 mm | > 40 mm | tolerant of tracking noise during fast arm motion |

- **Grab point:** thumb–index midpoint, radius about 3 cm; freeze it while the pinch is held so jitter doesn't move the object. For hands, treat select as squeeze.
- **Tracking loss:** hold the last good pose for 150 ms, then release with the last velocity.
- **Release velocity:** least-squares fit over the window 140–40 ms before now (the last 40 ms is the hand opening).
- **Aim assist:** at most ±5 cm, landing short rather than long.
- **Hit tolerances:** poke 2.5 cm, pinch-select 3.5 cm around the target.
- **Holds:** deliberate gestures need ≥0.5 s; a two-hand pinch held 1.5 s can mean "re-place".

## Picking the active hand
The lowest hand over the work area wins, with three rules:
- ignore hands more than 10 cm *below* the surface (lap under a virtual desk);
- give the current hand a 2 cm bonus;
- switch handedness-dependent layout only when a hand is actually at the work area.

## Gestures and chords
- A chord (thumb + middle, thumb + ring) fires only when the other fingers are clearly apart, after a short hold, then latches until released.
- Keep each gesture distinct from the others and from resting hands; disable the ray near grabbable objects.

## False triggers
| Symptom | Cause | Fix |
|---|---|---|
| Actions fire on their own | hand passing through a surface; resting hand chosen; curled fingers dipping | minimum duration, plunge detection, ignore hands far below, prefer the current hand |
| First action after calibration is garbage | finger still on the calibration target | require a lift first |
| Pinch flickers at the edge | single threshold | hysteresis (table above) |

## Gaze on Quest 3/3S
The judging text names gaze interactions (Unity/Unreal ISDK v207+). Quest 3 and 3S have **no eye tracking**, and IWSDK's `GazeSystem` waits for an input source with `targetRayMode === 'gaze'`. On these headsets, use **head gaze**: a character that reacts when you look at it, or a panel that brightens when it's in the centre of view. Don't ask for dwell-to-select as the only input.

## Meta's hands guidance worth quoting in JUDGING.md
"Avoid time-based or reflex-heavy events" and "do not penalize users for taking their time" (design/hands-best-practices). Keep wait modes forgiving, and score rhythm only as a bonus.

## Real hands over an opaque virtual world
When a full place covers the room (a street, a hall), passthrough hands disappear and IWSDK's hand visual is only an outline. Its inner "stencil" skinned mesh writes `vec4(0,0,0,0)` with normal blending (invisible) plus depth. Set that material to `blending = NoBlending; transparent = false; needsUpdate = true`: it now writes alpha 0, and Quest composites passthrough there, so you see your **real hands** through a hand-shaped window, and its depth hides UI behind the hand. Find it by traversing the scene for a `SkinnedMesh` whose `ShaderMaterial.fragmentShader` contains `vec4(0,0,0,0)` (the material is shared, so do it once). The emulator overlays its own synthetic hand, so only a headset can confirm the look. Reference: `sadak-vr/src/game/director.ts` `punchHands`.

## IWSDK's stock interaction components (prefer them over custom poke/grab)
- `RayInteractable` + `PokeInteractable` on a mesh or panel entity: subscribe to `{required:[MyTag, Pressed]}` `qualify` for a press (poke-through or point + pinch) and `Hovered` for hover. Pressed `disqualify` gives you **hold-to-talk** for free (finger stays in, or pinch held on the ray).
- `OneHandGrabbable` + the GrabSystem (`features.grabbing: true`): subscribe to `{required:[MyTag, Grabbed]}` `qualify`/`disqualify` for pick-up/release; the system moves the object while held, your code handles the drop.
- **The near-grab sphere sits at the palm (grip space), not the fingertips.** It takes the object nearest the palm, so small items in a cluster (coins around a centre coin) get the wrong one. Lay small grabbables in a single row across the reach direction, about 7 cm apart.
- Toggle interaction components with game state (only live targets interactable) rather than leaving hidden objects raycastable.

## Feedback, gestures and tracking loss (Hands of a Master, 18 Nov 2026; source: Meta's hand-tracking guidance)
- **Poke hover and press on UIKit without a pointer:** add a class object with the `important` conditional (`el.classList.add({ important: { backgroundColor } })`) and remove it afterwards. It outranks inline `setProperties` and `:hover`, and comes off cleanly. Use the same for gesture and microgesture feedback.
- **Poke cursor:** a ring on the panel plane under the fingertip (tip minus normal × depth), scaled by depth over about 7 cm, `depthTest: false`, high `renderOrder`. This answers Meta's "communicate touch z-distance".
- **Pose detection from 25 joints:**
  - Use a soft ramp per cue: curled = tip-to-knuckle under 4–6 cm; thumb clear of the index knuckle; thumb direction · world up above 0.55–0.8. Confidence = the minimum across cues.
  - Gate it with a `HoldGate`: hold 0.6 s at ≥ 0.7, forgive 120 ms dips, and latch until 0.3 s below 0.35. Start latched, so a pose already showing when the gate opens can't fire.
  - Enable it only while its action is on screen, and show a filling ring while it's held.
- **Tracking loss:** WebXR has no confidence API, so "no joint pose" means lost.
  - Allow about 150 ms of grace, then cancel the stroke and don't score it.
  - Pause anything clocked: advance it only on `dt`, and skip the update while lost.
  - Show a body-locked card after 0.3 s if the activity is timed, or about 2.5 s if it's waiting.
  - Emulator: `xr set-connected {device, connected: false}`.
- **"Lifted" must be observed, never inferred from absence.** A hand that came back already touching the paper started a stroke mid-page. A change of active hand also re-arms the lift requirement.
- **No palm-up hand menu:** WebXR reserves the palm pinch for the system (the left one exits the session). Keep menus world-anchored within reach.
- **Microgestures:** IWSDK and IWER map them to hand-gamepad buttons 5–9, but Meta doesn't document them for Quest Browser. Use them only as optional shortcuts (rising edge, only while the target is live); test with `xr microgesture`.
- **Emulator tips:**
  - Hover with `run-sequence {target, anchor: "index-tip", offset: {normal: 0.03}}`.
  - `approach` ends on the surface and presses.
  - `depart` before dropping a hand, so it doesn't sweep through a tilted panel.
  - A `browser screenshot` takes about 3 s; catch sub-second states with a `browser run` loop over `page.screenshot`.

## A tool in the hand (brush, pen)
- **Keep the fingertip as the contact point,** so the real desk still gives the touch. Draw the tool with its tip where the ink lands and its shaft through the web between thumb and index (the midpoint of `thumb-phalanx-proximal` and `index-finger-phalanx-proximal`). Lean a brush toward vertical; a pen lies back along the hand.
- **Give the ghost master the same tool,** using its rendered joints.
- **Hide the resting copy** on the desk while the tool is in the hand.
- **Pivot the model once at load:** tip at the origin, shaft along +Y. Then each frame it's `position = tip`, `quaternion.setFromUnitVectors(up, dir)`.
