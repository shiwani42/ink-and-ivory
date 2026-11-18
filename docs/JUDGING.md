# Judging self-assessment: Hands of a Master

How the build meets the Meta VR Start Developer Competition 2026 rules and judging criteria (four criteria, 25% each).

- **Sources:** the kit's mirrored [judging page](../../meta-vr-start-2026-kit/resources/devpost/details_judging.md), [rules](../../meta-vr-start-2026-kit/resources/devpost/rules.md) and [special awards](../../meta-vr-start-2026-kit/resources/devpost/details_special-awards.md).
- **Evidence:** "E2E" means the automated emulator run in [TESTING.md](TESTING.md). Anything not yet verified on a physical Quest is marked ⚠.

## Entry choices
- **Track: Productivity.** The rules define it as "creative tools, or habits tied to a recurring context". This is a daily practice habit for two creative skills: calligraphy and piano.
- **Division: New Experience.** It was built entirely in the competition window (16 to 17 Nov 2026), from the official IWSDK starter.
- **Special awards to name in the text:**
  - **Best Reason to Come Back**, the primary one: streak, best scores, and a master who visibly lets go as you improve.
  - **Boldest Original Concept.**
  - **Best Accessibility Forward Experience.**

## Hard requirements (Stage 1, pass/fail)
| Requirement | Status | Evidence |
|---|---|---|
| Hands-first: the whole experience completes without a controller | ✅ | E2E plays all 6 calligraphy lessons and all 4 piano songs using only emulated hands: entry, placement, watch, calibration, 15 strokes, every song note, menu pokes, "Next lesson", switching craft. The emulator's input mode is set to `hand`. |
| Judged on Quest 3 / 3S at 60 fps or more | ✅ design / ⚠ device | At most 112 draw calls and 62k triangles in XR (emulator, counted over both eyes; Quest's multiview draws both eyes at once). The 93-part grand piano is merged into 7 meshes, one per material. Requests 72 Hz, foveation 0.4, no real-time shadows, no post-processing; the 360-degree place is one sphere draw. Not yet captured on a headset. |
| English | ✅ | All UI and captions are in English. Characters appear only as ink on the paper; readings are romanized (ichi, yi). |
| No logos, brands or identifiable people | ✅ | Models are built in Blender by our own script; the grand piano has no maker's name. The seal is an abstract mark. The 360-degree photographs contain no people and no signage brands. Credits are text only. |
| Original, not a wrapper ("take it away" test) | ✅ | No third-party service at all: scoring, choreography, ink, piano and sound all run locally. Photos, music and samples are bundled CC0 / CC-BY files. |
| Hosted URL that works logged out | ⚠ to do | Deploy with Vercel. Test the production alias logged out and in incognito on the headset. |
| Public video under 3 minutes | ⚠ to do | Shot list in [SUBMISSION.md](SUBMISSION.md). |

## Guidelines
| Guideline | How |
|---|---|
| Seated, 2 ft radius ("airplane seat test") | Everything sits on the desk in front of you. The paper is about 0.4 m ahead, the menu about 0.33 m to the off-hand side. No locomotion. |
| Easy in and out ("one bus stop test") | One button to start. A first lesson (一) takes about 1 minute, a song about 1 to 2 minutes; a complete character set about 5 to 8 minutes. Progress saves automatically. Pausing for the Quest system menu freezes the lesson and resumes it. |
| Satisfying in 10 minutes or less | The first gold "lock-in" and the seal stamp happen within the first lesson, about 60 to 90 seconds in. |

## Criterion 1: Innovation & Creativity
- **Ghost-hand apprenticeship on your real desk.** The master's hand writes beside yours in your own room, and you learn by moving with it, not by reading instructions.
- **Lock-in moment.** Matching the master's timing and path blends the ghost onto your own tracked hand and turns it gold. This only works with tracked hands in passthrough.
- **Skill-adaptive guidance, inside each attempt.** As in the CHI '26 study of skill-adaptive ghost instructors (Quest 3 hand tracking, a keyboard on a real desk; pitch retention 99.6% vs 87.8% for a fixed ghost), the ghost's opacity follows your recent error from moment to moment: it fades fast while you keep up and returns slowly after a slip. Between sessions each pass lowers the help further: full guide, outline only, then from memory (the guidance hypothesis: help that never fades harms retention). The study also names calligraphy as a target domain.
- **Two crafts, one idea.** The same apprenticeship works for the piano: the master plays a phrase on a keyboard on your real table and you echo it (call and response, as in Faber's first lessons and the CHI study's phrase-by-phrase structure), then you join the phrases into the whole song. A count-in and a key that pulses on the beat make rhythm visible. It starts with Happy Birthday, then teaches the keyboard (twos and threes, positions, sharps and flats, scales) before songs from around the world.
- **A course, not a demo.** About 180 short lessons in units (Japanese with hiragana, Chinese, English italic with a broad nib; 26 piano songs and drills), a daily goal, Review of the weakest lesson, and Today's echo, a new phrase every day.
- **The master learns from you.** Play your own tune and the master listens, learns it and teaches it back; or add any MIDI file and the master takes its melody.
- **You travel to where the craft lives.** After the paper lands on your real table, your room dissolves like ink soaking into washi into the place the craft belongs to: Kennin-ji's moss garden veranda for Japanese, a classical garden for Chinese, a white music room with a concert grand for piano. A desk stands exactly where your real table is, so your fingertip still touches something real.
- **Lane check:** research of 2026 entries and prior art found no hands-only calligraphy tutor. Pen-based (MX Ink) and controller-based apps exist; see the kit's research notes.
- **Repeat usage:** a daily goal and streak, one star per pass (and less help each pass), Review, Today's echo, saved and shareable tunes, and a course long enough to come back to for weeks.

## Criterion 2: Experience Design
- **Purposeful passthrough, then presence.** Placement happens in passthrough, so the paper or keyboard lands on your real table. Then the room dissolves into the place, and the virtual desk sits on your real table's surface: you still touch the real desk to put ink down or press a key, which gives physical feedback hand tracking can't. The Scene button dissolves back to your room at any time. Only one world shows at a time, never a mix.
- **The place stays quiet.** The panorama is softened (slight blur, muted colour, warm haze) so the paper stays the focus, and calligraphy is turned to face the moss garden rather than the busy corridor.
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
  - gold ink when you were in unison;
  - piano: a sampled grand piano note on every press, a glowing next key, a note that floats up from each key (gold on the beat), and a music sheet that marks each note as you play it.
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
  - a larger-text option and a music on/off switch;
  - a gentle break reminder after a long session;
  - hit targets about 2.6 cm tall (the guideline is 2.2 cm or more);
  - light text on dark panels.

## Criterion 3: Technical Implementation
- **Hand tracking:**
  - 25-joint tracking per hand (`getJointPose`, `fillPoses`), with One Euro smoothing.
  - Contact detection with hysteresis plus a per-desk calibration. The calibration touch also fixes stale room scans: if the real table is centimetres above or below the detected plane (a standing desk moved since Space Setup, reported by a Quest 3S tester), the lowest still touch, confirmed on lift, moves the whole set onto the real surface. At the piano the target is a glowing middle C.
  - Piano with several fingers and chords: each extended fingertip presses its own key; non-lowest fingers must clearly touch.
  - Optional real pen or brush (beta): the tool tip is calibrated relative to the index knuckle, so a real tip touches the real desk.
  - Pressure-proxy brush width.
  - The writing hand is chosen by height over the paper. Hands resting below it are ignored.
  - Fingertip poke for UI, using a custom press test against each UIKit button's rectangle, alongside pinch-ray. The emulator's touch pointer didn't click UIKit buttons, so we added our own; both paths share one debounced trigger.
  - Poke feedback per Meta's touch guidance: hover lights the button within 7 cm, a cursor ring on the panel shows the fingertip's distance, and a press flashes.
  - A thumbs-up pose detector from the 25 joints (confidence 0 to 1, held 0.6 s, latched, live only when "Next lesson" is offered), with a fill ring as feedback.
  - Tracking loss handled gently: a 150 ms grace mid-stroke, then the stroke is called off rather than scored; the piano pauses; a card asks for the hands back. See [INTEGRATION-handtracking.md](INTEGRATION-handtracking.md) for the full comparison with Meta's hand-tracking guidance.
- **Scene understanding:**
  - Horizontal `XRPlane`s at seated height, preferring the `table` / `desk` label.
  - The writing set is clamped inside the plane polygon and slid toward the centroid until its whole footprint fits (handles round tables).
  - It faces the writer, with a virtual-desk fallback when no plane qualifies.
  - E2E covers three placements: a detected rectangular-bounds table, a round table, and no table nearby.
  - **Rooms we never tested** (`src/mr/room-placement.ts`):
    - Placement is restricted by label: never a couch, bed, screen or wall art. Both `table` and `desk` labels are accepted, and unlabelled surfaces too.
    - Planes tilted more than 6° are refused.
    - A side table too small for the whole set still gets the paper centred on it, so your fingertip meets a real surface, instead of a floating virtual desk.
    - `tools/e2e_room.py` sits the emulated learner at every table-height surface in six simulated rooms, plus a room with no Space Setup. `tools/test-room-placement.mjs` covers 16 synthetic cases: tiny, slanted, rotated, round, couch, out of reach, no planes.
- **Spatial anchoring:**
  - The desk is attached with `XRAnchor`, so it stays put if tracking drifts.
  - **It comes back next session** (`src/mr/desk-memory.ts`). IWSDK's persistent anchor (`requestPersistentHandle` / `restorePersistentAnchor`) is restored. If it is the same anchor and the spot is within reach, the paper returns to the same place on your real table ("Welcome back").
  - See [INTEGRATION-meta-xr.md](INTEGRATION-meta-xr.md) for the comparison with Meta's mixed-reality docs, MRUK and the Platform SDK.
- **Ghost hand:**
  - A skinned WebXR generic hand driven by a procedural 25-joint pose solver built from IWER's point pose.
  - A Fresnel shader with a depth pre-pass, and a fingertip glow.
  - Per-joint position and rotation blending onto the learner's real hand for lock-in.
- **Piano key detection:** for each hand, the lowest extended fingertip over a key presses it (down at 12 mm above the key top, up at 19 mm, with 120 ms per-key debounce). Curled and tucked fingers are ignored, so a resting hand doesn't play. Rhythm is judged against the beat (gold within a third of a beat); the score is 65% accuracy, 35% rhythm.
- **Places:** a 4096 x 2048 panorama on a sphere that follows your head (no parallax). One shader does the soft-focus "calm" treatment with a mip bias, and the ink-bleed dissolve with two octaves of noise and an ink rim.
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
- **One coherent art direction:** a "washi" design system (Merriweather titles, Inter body, warm paper panels, vermilion and gold accents) across both crafts. Calligraphy: a dark felt mat, washi with fibres and a vermilion practice grid, a brush on its rest, an inkstone, a water dropper, a seal set, vermilion teacher's ink, sumi-black learner's ink, and gold for unison. Piano: a black concert grand with its lid up in a white music room.
- **Motion:**
  - The paper unrolls on arrival.
  - The master's strokes press, travel and settle with an ease-in-out profile.
  - The ghost "breathes" while waiting.
  - The seal lands with a scale-in and a thud.
- **Sound:** CC0 music chosen per place (koto, shamisen and shakuhachi plus a quiet ambient piano for Japanese; an Asian ensemble with koto and strings for Chinese; silence for piano so you hear your own playing), Salamander grand piano samples, and synthesized effects through one compressor.
- **Transitions:** the ink-bleed dissolve between your room and the place, about 2.4 s.
- **Submission material:** see [SUBMISSION.md](SUBMISSION.md).

## Special awards fit
| Award | Fit |
|---|---|
| Best Reason to Come Back | A course of about 180 lessons in units, daily goal and streak, Review, Today's echo, three languages and two crafts, your own tunes (played, MIDI, or shared by link), and the master helping less each time you pass |
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
