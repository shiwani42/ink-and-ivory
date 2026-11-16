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
