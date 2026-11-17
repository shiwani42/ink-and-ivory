# Hand tracking: Meta's guidance against HOAM (18 Nov 2026)

Two sources, read for what carries over to WebXR / IWSDK 1.1.0:
- Meta's [Unity hand-tracking overview](https://developers.meta.com/vr/documentation/unity/unity-handtracking-overview/) and its design pages: [hands](https://developers.meta.com/horizon/design/hands/), [best practices](https://developers.meta.com/horizon/design/hands-best-practices/), [limitations and mitigations](https://developers.meta.com/horizon/design/hands-limitations-mitigations/), [gesture design](https://developers.meta.com/horizon/design/hands-gesture-design/), [touch](https://developers.meta.com/horizon/design/touch_usage/), [microgestures](https://developers.meta.com/horizon/documentation/unity/unity-microgestures).
- The [Table Troopers success story](https://developers.meta.com/vr/discover/success-stories/table-troopers/) (a tabletop mixed-reality game, hands-first).

What WebXR gives us: 25 joint poses per hand (`getJointPose`, `fillPoses`), a pinch as `select`, the hand's `gamepad` (pinch is button 0), and IWSDK's Ray/Poke/Grab components. It has **no confidence value, no pose recorder, no Fast or Wide Motion Mode, no Capsense and no eye tracking** on Quest 3/3S.

**Microgestures, checked today:** Meta still documents them only for Unity (Meta XR Core SDK v74+) and native OpenXR. The [WebXR hands page](https://developers.meta.com/horizon/documentation/web/webxr-hands/) mentions only pinch on the hand's gamepad and the reserved palm pinch. IWSDK 1.1.0 and its emulator (IWER) do map them onto the hand's xr-standard gamepad (buttons 5 swipe left, 6 swipe right, 7 forward, 8 backward, 9 tap). We read that mapping as an optional shortcut, but whether Quest Browser sends these buttons is **unconfirmed**. Only a headset can tell.

**Headline:** HOAM already follows most of the guidance: hands only, poke near and ray far, one core interaction, kind pacing, one-handed play, and placement on the real table. The gaps were feedback and robustness: a poke had no hover or press state; tracking loss could score a cut-off stroke or let a piano song run on without you; and there was no gesture shortcut. Those four items are now built.

## Gap table
Legend: ✅ have it · 🔨 built now · ⛔ not possible in WebXR · ⏭ after the deadline

| Recommendation or feature (source) | Status | HOAM / WebXR equivalent |
|---|---|---|
| Hands as primary input, controllers optional (overview, best practices) | ✅ | Hands only; the whole course completes without a controller (E2E). |
| Poke when near, ray when far (best practices, touch) | ✅ | Fingertip poke on the menu within reach, IWSDK pinch-ray as well; one debounced trigger. |
| Index finger only for poke (touch) | ✅ | The poke test reads `index-finger-tip` only; the piano is the "surface keyboard" exception Meta names. |
| **Highlight targets; visual and audio feedback at the point of interaction** (best practices) | 🔨 | Poke hover: the button under a fingertip (within 7 cm) turns gold; a press flashes gold or vermilion; a wood-block sound plays. The ray already had UIKit `:hover` and `:active`. |
| **Communicate touch z-distance for floating UI** (touch) | 🔨 | A poke cursor ring on the panel under the fingertip, shrinking and darkening as the finger nears the surface: the same language as the paper's hover ring. |
| Touch limiting (stop the virtual hand at the panel) | ⛔ | In passthrough you see your real hand, so it can't be stopped. The cursor and press flash stand in for it. |
| **Tracking loss / hands outside the tracking volume** (limitations) | 🔨 | WebXR has no confidence value; a lost hand stops resolving joints or drops its input source. Mid-stroke: a 150 ms grace period, then the stroke is called off (ink fades, "That stroke does not count"), never scored. Piano: the song pauses at once (its clock runs only on frame time). A body-locked card says "Bring your hands back" (after 0.3 s while playing, 2.5 s while waiting, since resting your hands is allowed). |
| Warn before hands leave tracking (Table Troopers tints hands red) | ⏭ | Needs a prediction of the camera volume's edge, which only a headset can tune. The card covers the loss itself. |
| Low-confidence hand display | ⛔ | Not exposed; Quest Browser hides the hand itself. Handled as tracking loss above. |
| **Poses (Pose Detection) with gating, lenient recognition, few gestures** (gesture design) | 🔨 | Thumbs up = "Next lesson", only while that button is offered. Confidence (0 to 1) comes from 25 joints: four fingers curled, thumb clear of the fist, thumb pointing up. It must be held 0.6 s at 0.7 or more (dips under 120 ms are forgiven). A ring beside the thumb fills, then it latches. A thumbs up already shown when the button appears must be let go first. The button carries a thumbs-up icon to teach it visually; the caption names it. |
| Gesture detection (sequences over time) | ⏭ | No need yet; one pose is enough (Meta: keep the set small). |
| Microgestures (tap, swipes) | 🔨 optional | Read from the gamepad mapping above: tap = Next lesson (when offered), swipe left/right = previous/next unit. Harmless if Quest Browser never sends them. |
| Palm-up hand menu / summon gesture | ⛔ by design | A palm pinch at eye level is **reserved by the system** in WebXR (left hand = menu, which exits the session). A palm-up summon invites that gesture. The menu already lives at desk height on the off-hand side, within reach and always visible. |
| Hand Grab, Distance Grab, Throw, custom grab poses | ⏭ / n.a. | Nothing to pick up in the lessons. IWSDK's `OneHandGrabbable` would serve the paperweight or seal later. |
| Fast Motion Mode, Wide Motion Mode, Multimodal, Capsense | ⛔ | Runtime features, not exposed to WebXR. Slow, deliberate strokes don't need FMM. |
| OpenXR hand skeleton | ✅ | WebXR's 25 joints are the same skeleton; the ghost hand is driven by it. |
| Custom hand models | ✅ | The master's ghost hand is a skinned WebXR generic hand with our own Fresnel shader. |
| Neutral posture, minimal reach, no hands above heart level (best practices) | ✅ | Everything sits on the desk in front of you; the menu is at seated reach, 0.2 m above the desk. |
| Avoid one hand occluding the other (limitations) | ✅ | One-handed writing; the piano uses one hand or two side by side. |
| Rest periods, don't penalise breaks, avoid reflex-heavy timing | ✅ | The master waits at the start point; a 25-minute break reminder; rhythm is 35% of a piano score; the new tracking card says "The master waits for you". |
| Hide or show virtual hands by context | ✅ | Real hands in passthrough; the ghost appears only while it teaches and fades as you improve. |
| Lighting note at launch (limitations) | ✅ partly | "Sit at a table in good light" while finding the desk; the tracking card repeats "in good light". |
| Gaze interactions | ⛔ | Quest 3/3S have no eye tracking; IWSDK's GazeSystem needs a `gaze` input source. |
| Test on device early with new users (Table Troopers) | ⏭ | No headset run yet; see TESTING.md. |

## Table Troopers' lessons, and HOAM
| Lesson | HOAM |
|---|---|
| A design that only works on this headset, on your real table | ✅ The paper or keyboard lands on a detected table plane, anchored; you touch the real desk. |
| Hands-first from day one; "all you need is pinch" onboarding in one screen | ✅ One action per step (watch, touch the seal, write). The menu works by poke or pinch. |
| Simplify the mechanic rather than complicate the input | ✅ Writing is one fingertip; piano is "press with any extended fingertip". |
| One-hand play for either hand | ✅ Left-handed writers are detected automatically; the ghost and menu mirror. |
| Reliability target "99.9%", not 90% | 🔨 Closer now: tracking loss no longer produces a bad score. Still needs on-device tuning of the contact thresholds. |
| Correct intent at release (they aim with the pose from about 0.5 s earlier) | ✅ analogous: strokes are scored on the captured path, the One Euro filter smooths jitter, and accidental touches (under 0.2 s, plunging, under 12 mm) are discarded. |
| Warn before hands leave tracking (red tint) | ⏭ See the gap table; the loss itself is now handled. |
| No artificial locomotion, short sessions, high replay | ✅ Seated, 1 to 2 minute lessons, a course of about 180 lessons, streak and Review. |
| UI that fades away | ✅ partly: the master fades; the menu stays (by design, for a course). |
| Colourblind options | ⏭ Gold versus vermilion carries meaning; add a shape cue (a check) to the gold. |

## What only a headset can confirm
- Whether Quest Browser exposes microgestures on the hand gamepad (buttons 5 to 9).
- How Quest Browser reports a lost hand: the input source drops, or joints stop resolving. Both paths are handled.
- Thumbs-up thresholds on real hands. IWER's `thumbs-up` pose passes, and a pointing or resting hand scores 0. Watch the `thumbs-up confidence` dev log; loosen the 0.55 "thumb up" ramp if people tilt their thumb.
- Whether the 150 ms stroke grace swallows real single-frame dropouts without cancelling good strokes.
- Whether the poke cursor ring reads clearly against the cream panel in passthrough, and whether a 7 cm hover range feels right.

## Proposed additions to the shared skill (`quest-hands-first-webxr`, not edited here)
For `references/hands-input.md`:
1. **Poke hover and press on UIKit without a pointer:** add a class object with the `important` conditional (`el.classList.add({ important: { backgroundColor } })`) and remove it later. The `important` layer outranks inline `setProperties` and `:hover`, and comes off cleanly. It suits poke, gesture and microgesture feedback alike.
2. **A poke cursor:** a ring on the panel plane under the fingertip (tip minus normal times depth), scaled by depth over a 7 cm range, `depthTest:false`, `renderOrder` high. It answers Meta's "communicate touch z-distance".
3. **A pose detector from 25 joints:** a soft ramp per cue (curl = tip-to-knuckle under 4 to 6 cm; thumb clear of the index knuckle; thumb direction · world up over 0.55 to 0.8), confidence = the minimum. Then a `HoldGate`: hold 0.6 s at 0.7 or more, forgive 120 ms dips, latch until 0.3 s below 0.35, and start latched so a pose already showing when the gate opens can't fire. Only enable it while its action is on screen. IWER test: `run-sequence` step `{poseId:"thumbs-up", anchor:"wrist", orientation:{fingers:"forward", thumb:"up"}, position:{relativeTo:"head", ...}}`.
4. **Tracking loss has no confidence API in WebXR:** treat "no joint pose" as lost. Grace period about 150 ms; then cancel, don't score. Pause anything clocked (advance it only on `dt` and skip the update). Show a body-locked card (after 0.3 s if timed, about 2.5 s if waiting). Emulator: `xr set-connected {device, connected:false}`.
5. **Palm-up hand menus collide with the reserved system palm pinch** in WebXR (the left one exits the session): prefer a world-anchored menu within reach.
6. **"Require a lift" must be cleared by an observed lift**, never by the hand vanishing, and a change of active hand re-arms it (see the bug below).
7. **Emulator test tips:** hover a button with `run-sequence` `{target, anchor:"index-tip", offset:{normal:0.03}}`. `approach` ends on the surface and presses. Withdraw with `depart` first: dropping a hand to the lap can sweep through a tilted panel. A `browser screenshot` takes about 3 s, so catch sub-second states with a `browser run` script that loops `page.screenshot` (this includes the emulator's panels).
8. **Microgestures in WebXR:** IWSDK and IWER map them to hand gamepad buttons 5 to 9, but Meta doesn't document them for Quest Browser. Wire them only as optional shortcuts (rising edge, only when the target is live), and test with `xr microgesture`.

## A bug the new test found
A hand that came back from tracking loss already touching the paper started a new stroke mid-page, which was then scored 0 ("Try again"). Two causes. First, "require a lift" (`needLift`) was cleared by a hand simply disappearing. Second, the other hand briefly took over as the writing hand. Now only a lift that is actually seen clears it, and any change of writing hand requires a lift. Shared-skill rule: **"lifted" must be observed, never inferred from absence.**

## Tests (18 Nov 2026, emulator, final code)
- `python3 tools/e2e_hands.py` (new): **7/7 PASS**. It drives each feature in the emulator: hands out of view while waiting (caption, plus a body-locked card when looking away); tracking lost mid-stroke (not scored); poke hover on "Next lesson"; thumbs up = next lesson; thumbs up ignored mid-lesson; microgesture swipes page units; the piano pauses when hands are lost. Screenshots: `artifacts/hands-*.png`. `tools/snap.mjs` takes a burst of page shots, to catch the 0.6 s hold ring.
- `python3 tools/e2e.py --lessons 2 --piano 1 --compose`: **PASS** (86, 86, 83, 79).
- `python3 tools/e2e.py --lessons 1 --lang english`: **PASS** (85, 89).
