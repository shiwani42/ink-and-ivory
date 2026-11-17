---
name: quest-mr-tutor
description: Add-on to quest-hands-first-webxr for learning and tutor experiences, including language learning through errands with reply cards, coins and voice: a ghost or master hand that demonstrates, lesson ladders, fingertip contact with a real surface, piano-style key presses, ink ribbons, calm 360-degree places, music per place, and user-supplied content (perform-to-teach, MIDI import).
---

# Tutor add-on: demonstrate, then practise, on the real table

Load `quest-hands-first-webxr` first; it owns setup, placement, UI, testing and submission. This add-on covers what is specific to teaching a physical skill with the hands. Provenance: built and emulator-verified in `hands-of-a-master/` (calligraphy and piano, IWSDK 1.1.0); its `src/` is the reference implementation.

## References
| File | Contents |
|---|---|
| [references/patterns-tutor.md](references/patterns-tutor.md) | Surface contact and calibration, skinned ghost hand, procedural hand poses, ribbons, key presses, perform-to-teach and MIDI import |
| [references/content-design.md](references/content-design.md) | Lesson ladders, drills, feedback we got and the rule behind each fix, user content |
| [references/language-learning.md](references/language-learning.md) | Errand-based language learning: three-tier reply cards, hover-to-hear / push-to-say, distractors with specific hints, pay/pick/hail verbs, baked TTS + serverless STT, memory (Sadak VR) |

## Workflow additions
1. **One verb, one awe moment:** "follow the master's hand", and the awe moment is the hands locking together (e.g. in gold) on the first success, within 60–90 s.
2. **Teach by demonstration:** the master shows, waits at the start, then leads at the user's tempo. Captions: one title line plus one sentence.
3. **Ladder, then a course:** the most famous thing first (a recognisable song or character), then 2–4 fundamentals as short drills, then 3–5 real pieces, then the user's own. Each item 1–2 minutes. Content is data (an array with id, name, teaching line, notes or strokes); progress keyed by id. Then grow it into a course of units, with help that fades by pass and within the attempt, call and response, a daily goal and review (content-design.md, "From a ladder to a course").
4. **The real surface gives the touch:** calibrate once, use contact hysteresis, require a lift before the first action (patterns-tutor.md §1).
5. **Scoring:** score accuracy and rhythm separately (e.g. 65/35); mark on-the-beat notes in gold; specific hints for each failure (wrong direction, off target, too fast).
6. **Places for the craft:** use a real CC0 360° photo of where the craft is practised, softened behind the task, one world at a time (core visual-quality.md §4). Ask before using a generic landscape.
7. **Music per place**, with an on/off switch, and **none when the user makes the sound** (core audio.md).
8. **Let users bring their own:** a perform-to-teach mode and a file import on the 2D start page. It answers "can I do my song?" without shipping anyone's copyright.
9. **Copyright:** if the user asks for a famous pop or film song, explain, offer public-domain alternatives with the same feel, and point to bring-your-own (core assets-and-licensing.md).

## Tests to add to the core matrix
- Every lesson, right hand, with 3–6 mm fingertip jitter (`trace(..., jitter_m=0.005)` in `xr_e2e_lib.py`).
- Negative cases, each giving its specific hint.
- Left hand; left-handed layout switch.
- Perform-to-teach: play a tune with emulated presses and check the learned song matches exactly.
- Multi-part content: the harness loops over phrases (a `phrase-done` log), then the whole piece.
- Each language or script at least once (`--lang`).
- File import: parse a generated fixture (a MIDI written by a few lines of Python) in a node unit test.

## Pitfalls
| Symptom | Cause | Fix |
|---|---|---|
| A translucent hand reads backwards | seen end-on from the user's eyes | angle it like a real arm from the user's side; raise the body fill; add a tip glow |
| Strokes or keys fire on their own | resting or curled fingers, hands passing through to the lap | minimum duration, plunge detection, lowest *extended* fingertip only |
| A song doesn't fit the instrument | range too small | make the range a Blender-script parameter and rebuild |
| Users call the place "busy" | crisp photo competes with the task | calm shader; face the calmest view |
| Labels overflow (e.g. "D#") | fixed widths sized for one letter | size by label length; check screenshots |
| A button press does something else | a hidden menu element (`display: none`) keeps its old world matrix, so a custom fingertip poke still hits it | track hidden ids and skip them in the poke test (core ui-text.md) |
