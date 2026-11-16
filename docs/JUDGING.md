# Judging self-assessment: Hands of a Master

How the build meets the Meta VR Start Developer Competition 2026 rules and judging criteria (four criteria, 25% each).

- **Sources:** the kit's mirrored [judging page](../../meta-vr-start-2026-kit/resources/devpost/details_judging.md), [rules](../../meta-vr-start-2026-kit/resources/devpost/rules.md) and [special awards](../../meta-vr-start-2026-kit/resources/devpost/details_special-awards.md).
- **Evidence:** "E2E" means the automated emulator run in [TESTING.md](TESTING.md). Anything not yet verified on a physical Quest is marked ⚠.

## Entry choices
- **Track: Productivity.** The rules define it as "creative tools, or habits tied to a recurring context". This is a daily practice habit for a creative skill.
- **Division: New Experience.** It was built entirely in the competition window (16 Nov 2026), from the official IWSDK starter.
- **Special awards to name in the text:**
  - **Best Reason to Come Back**, the primary one: streak, best scores, and a master who visibly lets go as you improve.
  - **Boldest Original Concept.**
  - **Best Accessibility Forward Experience.**

## Hard requirements (Stage 1, pass/fail)
| Requirement | Status | Evidence |
|---|---|---|
| Hands-first: the whole experience completes without a controller | ✅ | E2E plays all 6 lessons using only emulated hands: entry, placement, watch, calibration, 15 strokes, menu pokes, "Next lesson". The emulator's input mode is set to `hand`. |
| Judged on Quest 3 / 3S at 60 fps or more | ✅ design / ⚠ device | Peak 64 draw calls and about 31k triangles in XR. Requests 72 Hz, foveation 0.4, no real-time shadows, no post-processing. Not yet captured on a headset. |
| English | ✅ | All UI and captions are in English. Characters appear only as ink on the paper. |
| No logos, brands or identifiable people | ✅ | Original procedural art. The seal is an abstract geometric mark. Credits are text only. |
| Original, not a wrapper ("take it away" test) | ✅ | No third-party service at all: scoring, choreography, ink and sound all run locally. |
| Hosted URL that works logged out | ⚠ to do | Deploy with Vercel. Test the production alias logged out and in incognito on the headset. |
| Public video under 3 minutes | ⚠ to do | Shot list in [SUBMISSION.md](SUBMISSION.md). |

## Guidelines
| Guideline | How |
|---|---|
| Seated, 2 ft radius ("airplane seat test") | Everything sits on the desk in front of you. The paper is about 0.4 m ahead, the menu about 0.33 m to the off-hand side. No locomotion. |
| Easy in and out ("one bus stop test") | One button to start. A first lesson (一) takes about 1 minute; a complete character set about 5 to 8 minutes. Progress saves automatically. Pausing for the Quest system menu freezes the lesson and resumes it. |
| Satisfying in 10 minutes or less | The first gold "lock-in" and the seal stamp happen within the first lesson, about 60 to 90 seconds in. |

## Criterion 1: Innovation & Creativity
- **Ghost-hand apprenticeship on your real desk.** The master's hand writes beside yours in your own room, and you learn by moving with it, not by reading instructions.
- **Lock-in moment.** Matching the master's timing and path blends the ghost onto your own tracked hand and turns it gold. This only works with tracked hands in passthrough.
- **Skill-adaptive guidance.** The ghost and the tracing guide fade as your best score rises. This follows the CHI '26 finding that skill-adaptive ghost instructors beat static ones for retention, which also names calligraphy as a target domain.
- **Lane check:** research of 2026 entries and prior art found no hands-only calligraphy tutor. Pen-based (MX Ink) and controller-based apps exist; see the kit's research notes.
- **Repeat usage:** a daily streak, best score per character, unlockable stars, and the adaptive guide, which makes the next session visibly different.

## Criterion 2: Experience Design
- **Purposeful passthrough.** The real table is the writing surface: you touch the real desk to put ink down, which gives physical feedback hand tracking can't. Turn passthrough off and the core interaction loses its tactile surface.
- **Onboarding without a wall of text.** Each step is demonstrated before you're asked to do it:
  1. The paper unrolls.
  2. The master demonstrates.
  3. One action: "Touch the red seal".
  4. The ghost waits at a glowing start point.

  Captions are one short line plus one sentence.
- **Feedback in place of haptics:**
  - a hover ring that tightens as your fingertip approaches the paper;
  - a paper "scratch" sound that follows brush speed;
  - a bell on lock-in, a wood block on UI presses, a low thud for the seal;
  - gold ink when you were in unison.
- **Specific, kind corrections:** "Other direction. Watch where the master begins.", "Stay closer to the master's path.", "Slower. Let the brush travel with the master." Accidental touches (a hand dropping to your lap through the paper) are discarded silently.
- **FoV-aware layout:**
  - The paper sits where you naturally look down.
  - The caption card is just beyond the far edge, tilted toward your eyes.
  - The menu is on the off-hand side, angled toward you.
  - Nothing is head-locked.
- **Accessibility:**
  - one hand is enough;
  - left-handed writers are detected automatically (ghost and menu mirror);
  - tempo from 30 to 100%;
  - guide modes (adaptive / always / off);
  - captions for every instruction and result, so it works without sound;
  - hit targets about 2.6 cm tall (the guideline is 2.2 cm or more);
  - light text on dark panels.

## Criterion 3: Technical Implementation
- **Hand tracking:**
  - 25-joint tracking per hand (`getJointPose`, `fillPoses`), with One Euro smoothing.
  - Contact detection with hysteresis plus a per-desk calibration.
  - Pressure-proxy brush width.
  - The writing hand is chosen by height over the paper. Hands resting below it are ignored.
  - Fingertip poke for UI, using a custom press test against each UIKit button's rectangle, alongside pinch-ray. The emulator's touch pointer didn't click UIKit buttons, so we added our own; both paths share one debounced trigger.
- **Scene understanding:**
  - Horizontal `XRPlane`s at seated height, preferring the `table` / `desk` label.
  - The writing set is clamped inside the plane polygon and slid toward the centroid until its whole footprint fits (handles round tables).
  - It faces the writer, with a virtual-desk fallback when no plane qualifies.
  - E2E covers three placements: a detected rectangular-bounds table, a round table, and no table nearby.
- **Spatial anchoring:** the desk is attached with `XRAnchor` so it stays put if tracking drifts.
- **Ghost hand:**
  - A skinned WebXR generic hand driven by a procedural 25-joint pose solver built from IWER's point pose.
  - A Fresnel shader with a depth pre-pass, and a fingertip glow.
  - Per-joint position and rotation blending onto the learner's real hand for lock-in.
- **Rendering budget:**
  - preallocated ribbon geometry (no per-frame allocation while writing);
  - shared materials;
  - canvas textures generated once;
  - no shadow maps or post-processing;
  - 72 Hz request;
  - foveation 0.4.
- **Robustness:**
  - The E2E injects 4 mm of random fingertip error and still passes every stroke on the first try.
  - Negative tests confirm that reversed, off-path and rushed strokes get the right feedback.
- ⚠ **Gaps:**
  - No depth occlusion yet. Your real fingers draw under the virtual paper, and the IWSDK hand outline stays on top. We left it out on purpose: the paper lies within millimetres of the real desk, so depth-based occlusion would flicker. This needs testing on a device.
  - No gaze interactions.
  - Real-device performance not yet captured.

## Criterion 4: Polish & Presentation
- **One coherent art direction:** a Japanese shodo desk. Dark felt mat, washi with fibres and a vermilion practice grid, a paperweight, an inkstone, vermilion teacher's ink, sumi-black learner's ink, and gold for unison.
- **Motion:**
  - The paper unrolls on arrival.
  - The master's strokes press, travel and settle with an ease-in-out profile.
  - The ghost "breathes" while waiting.
  - The seal lands with a scale-in and a thud.
- **Sound:** synthesized in code (Web Audio), so there are no licensing issues and no loading.
- **Submission material:** see [SUBMISSION.md](SUBMISSION.md).

## Special awards fit
| Award | Fit |
|---|---|
| Best Reason to Come Back | Daily streak, best score and stars per character, a ladder of six characters, and the master fading as you improve |
| Boldest Original Concept | Learning a physical craft by moving inside a master's hands on your own desk depends on hand tracking, passthrough and real-world scale |
| Best Accessibility Forward | One-handed play, auto left-handed mode, adjustable tempo, guide modes, full captions, large hit targets |
| Best First Five Minutes | Writing within about 30 seconds of entry, taught by demonstration rather than text, with gold and the seal stamp as payoff |
| Best Agentic Interaction | Not targeted: there is no AI |

## Highest-value next steps
1. Test on a Quest 3 / 3S:
   - performance capture;
   - contact thresholds on a real desk;
   - ghost readability;
   - check that text and hand models render (IWSDK multiview path).
2. Deploy to Vercel and test the URL logged out.
3. Record the trailer on the headset: MQDH casting on Windows, or the Quest's own recorder.
4. Optional: record a real master's hands. `GhostHand.setJoints` already accepts any 25-joint stream.
