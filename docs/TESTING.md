# Testing: Hands of a Master

## 1. Automated end-to-end test (emulator, hands only)
`tools/e2e.py` drives the IWSDK emulator (IWER, Meta Quest 3 profile, "sunlit living room") the way a judge would. It uses only emulated hands.

```bash
npm run dev                                   # or: npx iwsdk dev up --headless
python3 tools/e2e.py --lessons 6 --negative   # full run, about 6 minutes
python3 tools/e2e.py --lessons 2 --hand left  # left-handed writer
python3 tools/e2e.py --jitter 6               # noisier fingertip (mm)
python3 tools/e2e.py --lessons 6 --negative --piano 4 --jitter 3   # everything, about 15 minutes
python3 tools/e2e_hands.py                      # hand-input features: poke hover, thumbs up, tracking loss, microgestures
python3 tools/e2e_room.py                       # placement in 6 simulated rooms + no Space Setup + desk remembered across sessions
node tools/test-room-placement.mjs              # placement maths on 16 synthetic rooms (no browser)
```

**What it covers:**
1. **Reset.** A dev-only Shift+R clears saved progress and reloads, so every run starts as a first-time user.
2. **Entry.** Enters immersive AR with hand input. Placement must log `placed on ...`.
3. **Watch.** The master's demonstration runs, and the app logs the stroke layout in world coordinates.
4. **Calibration.** The fingertip rests on the red seal and the app logs the contact offset.
5. **Strokes.** For every stroke of every lesson: lift, touch down at the start point, trace the KanjiVG path in time with the master (with random fingertip error), lift. The score must reach the 55-point pass mark.
6. **Negative cases** (with `--negative`), each of which must produce the specific hint:
   - a **reversed** stroke: "Other direction";
   - a stroke **4.5 cm off** the path: "Stay closer to the master's path";
   - a **rushed** stroke: passes, with "Slower" advice.
7. **Menu.** "Next lesson" and "Write it again" are pressed with a **fingertip poke** by the other hand.
8. **Piano** (with `--piano N`; up to 8 lessons and songs, Happy Birthday first). Pokes the Piano craft chip, waits for the keyboard layout and the master's demonstration, then plays N songs note by note with the writing hand's index fingertip, in time with the song, from the key positions the app logs (`piano-layout {json}`). Each song must pass.
   **Your tune** (with `--compose`): presses "Play your own tune", plays C E G E D C, waits for the master to learn it, checks the learned notes match, then plays it back with the master.
9. **Screenshots** go to `artifacts/e2e-*.png`.

The app writes `[hoam] ...` lines to the console **in dev builds only**. The driver reads them through `iwsdk browser logs`; production builds strip them.

### Latest results (17 Nov 2026, Linux, Chromium via IWSDK CLI)
| Run | Result |
|---|---|
| **Piano ladder:** 1 lesson, `--piano 8 --compose`, 3 mm jitter | **PASS**. Happy Birthday 83, white keys 93, sharps 91, flats 78, Twinkle 92, Ode to Joy 93, Für Elise 89, Sakura 85; your tune learned exactly, 79. Every key right in every song; the lower scores are rhythm (the emulated hand travels slower to the black keys) |
| **Everything + new songs:** 6 lessons, `--negative`, 5 songs, `--compose`, 3 mm jitter (keyboard A3 to E5) | **PASS**. Lessons 87, 88, 90, 91, 90, 92. Songs: Für Elise 89, Five fingers 96, Twinkle 92, Ode to Joy 93, Sakura 85. Your tune: learned C E G E D C exactly, played back 79. Negative 3 of 3 |
| **Course update (18 Nov):** `--lessons 3 --lang english --piano 1 --compose`, then `--lessons 6 --negative` | **PASS**. English i 92, l 89, t 90; Happy Birthday taught in 4 phrases (86, 86, 88, 86) then whole, 84, every key right; your tune learned exactly, played back 79. Japanese 90, 89, 92, 92, 91, 93; negative 3 of 3. Found and fixed: hidden menu buttons took pokes at their old position |
| **Everything:** 6 lessons, `--negative`, 4 piano songs, 3 mm jitter, places and dissolve on (final code) | **PASS**. Lessons: one 88, two 88, ten 90, person 86, big 91, eternity 93. Songs: Five fingers 96, Twinkle 92, Ode to Joy 93, Sakura 85. Negative cases 3 of 3 |
| 1 lesson + 2 songs after merging the grand piano | PASS (88; 96, 92) |
| Right hand, 6 lessons, `--negative`, 4 mm jitter (final code) | **PASS**: all 15 strokes on the first try. Lesson averages: one 90, two 88, ten 90, person 88, big 91, eternity 92 |
| Right hand, 6 lessons, 2 mm jitter | PASS. Lesson averages: one 88, two 92, ten 92, person 91, big 94, eternity 94 |
| Right hand, 3 lessons, 5 mm jitter | PASS. All strokes 85 to 87 on the first try |
| Left hand, 2 lessons | PASS (90, 90). The ghost switched to a left hand; the menu moved right |
| Negative cases | 3 of 3 gave the expected hint |

### Placement scenarios tested in the emulator
| Scenario | Result |
|---|---|
| Standing in the middle of the room, nearest table 1.95 m away | Virtual desk at seated height in front of you (correct: no table within reach) |
| Seated at the round dining table (0.9 m across) | `placed on detected table`. The writing set is fully on the round top and faces the writer (`docs/media/02-real-table-watch.png`) |
| "Move paper in front of me" from the menu | Placement runs again, then the lesson restarts |

The emulated room reports 15 planes (floor, ceiling, walls, two tables, couches, door, window, art), and the app ignores everything except table-like horizontal planes at seated height.

### Rooms we never tested (`tools/e2e_room.py`, `tools/room.mjs`)
`tools/room.mjs` switches IWER's simulated room at runtime (`window.IWER_DEVICE.sem.loadDefaultEnvironment`, or "none" for a headset with no Space Setup). For each room, the test:
1. reads the planes (dev key Shift+L);
2. sits the learner at every table-height surface, eyes 0.45 m above it;
3. places the paper again (Shift+P);
4. checks that it lands on that surface (height within 2 cm, centre on the surface).

It then checks that the desk comes back across XR sessions. Session 2 sits 25 cm to the side and turned 25°; the first placement logic (Shift+M) must return the paper to the session-1 spot, while plain detection would have put it elsewhere. Results are in [INTEGRATION-meta-xr.md](INTEGRATION-meta-xr.md#tests-18-nov-2026-emulator). Screenshots: `artifacts/room-*.png`.

### Bugs found by testing and fixed
| Found | Fix |
|---|---|
| UI panels invisible | UIKit units are centimetres: panel scales were 100× too small |
| Menu jumped to the wrong side | The writing hand was guessed from whichever hand was lowest anywhere. It now switches only when a hand is actually at the paper |
| Garbage first stroke after calibration | The finger was still on the seal. Now a lift is required before the first stroke |
| Garbage stroke when the other hand moved to the lap through the paper | Touches shorter than 0.2 s, or that plunge below the surface, are discarded silently |
| Writing blocked under a virtual desk | A hand resting in the lap (below the paper) was chosen as the writing hand. Hands more than 10 cm below the surface are now ignored, and the current writing hand is preferred |
| Paper hanging off a round table | The writing set's footprint is checked against the table polygon and slid toward the centroid until it fits |
| Fingertip poke on UIKit buttons did not click (emulator touch pointer) | Custom fingertip press test against each button's rectangle, sharing one debounced trigger with ray clicks |
| Ghost hand read as end-on from the writer's eyes | Re-angled like a right-handed writer's hand, stronger body fill, fingertip glow |

### Shortcuts (`?state=`)
`src/presets.ts` jumps straight to a moment (see the table in SUBMISSION.md). The parser has a unit test (8 cases, including junk values that must be ignored). In the emulator the managed browser drops URL queries, so `tools/goto.mjs` passes the shortcut through sessionStorage (dev builds only); this needs `npx iwsdk dev restart --headed --open --allow-browser-automation`. Verified: piano practice of song 7, listen, Chinese 永 in your room, calligraphy practice of lesson 2.

## 2. Performance
| Measurement | Value |
|---|---|
| Draw calls in XR, calligraphy (watch / practice / complete) | 80 to 110 |
| Draw calls in XR, piano | 96 to 112 (was 280 before the grand piano's 93 parts were merged into 7) |
| Triangles in XR | 40 to 57k calligraphy, about 62k piano (the tracked hands, the ghost, the grand piano at 10k) |
| Note | The emulator renders each eye separately, so XR draw calls are counted twice. On Quest, IWSDK uses multiview and draws both eyes at once |
| Draw calls / triangles on the 2D page | 34 / 6.9k |
| Desktop emulator frame time | p50 16.7 ms, p95 16.8 ms, 0 dropped frames (vsync-bound) |
| Production bundle | 3.8 MB `dist/` (main JS 2.46 MB, about 676 kB gzip) |

**Design budget:** the plan targets 100 draw calls per eye or fewer and 100 to 300k triangles. The app requests 72 Hz and sets foveation to 0.4. It uses no shadow maps, no post-processing, preallocated ribbon geometry, and canvas textures generated once.

⚠ Desktop numbers do not predict Quest performance. Capture on the device: `metavr` perf trace, or the `hz-perfetto-debug` skill from Meta's agentic-tools plugin.

## 3. On-device checklist (Quest 3 / 3S)
Connect over USB from Linux: `adb reverse tcp:8081 tcp:8081`, then open `https://localhost:8081` in Quest Browser. For the final check, use the deployed production URL.

- [ ] **Text and hand models render in the headset.** IWSDK 1.1.0 includes the fix for multiview texture uploads (issue #55). The emulator does not use multiview, so only a device proves this.
- [ ] Hand tracking permission prompt appears, and both hands show.
- [ ] At a real desk: the paper lands flat on the table and stays put when you lean or look away (anchor).
- [ ] Seal calibration, then a finger resting on the desk lays ink, and hovering 2 cm or more above it does not.
- [ ] The hover ring is visible and tracks your fingertip.
- [ ] Lock-in triggers when following the ghost; ink turns gold.
- [ ] Poke "Next lesson", tempo and guide buttons with a fingertip; also try a pinch-ray.
- [ ] Left hand writes; the ghost mirrors.
- [ ] System menu (palm-up pinch, left hand) pauses; returning resumes.
- [ ] Room with no table, or in poor light: virtual desk fallback, and the tracking-light tip in the caption.
- [ ] Desk memory: place the paper on your table, exit, re-enter. The paper returns to the same spot with "Welcome back" (log `placed on remembered spot`). In a private window it can't, and detection runs as usual.
- [ ] Unusual surfaces: a small side table (the paper is centred on it), a sofa seat in reach (refused), an unlabelled desk (accepted). Read the `placement planes N: ...` log line for why planes were skipped. Also check a cluttered table: planes don't know about objects on the top (the emulator's side table has a plant under the paper).
- [ ] On the virtual desk, the menu shows **Scan my room** (the log says `room capture available`). Pressing it opens Quest's room scan; afterwards the paper moves onto the real table. Check that a saved anchor survives the scan.
- [ ] Poke feedback: a button lights as the fingertip nears it, and the vermilion ring on the panel shrinks as you approach; a press flashes.
- [ ] Thumbs up on the lesson-complete screen: the gold ring fills beside the thumb, then the next lesson starts. A thumbs up while writing does nothing. Watch the `thumbs-up confidence` log for real hands.
- [ ] Hands out of view: drop both hands to your lap during practice. After about 2.5 s the caption says "Bring your hands back"; look away and the body-locked card says it too. Mid-stroke, hide the hand behind the other: the stroke is called off, not scored. During a piano song: it pauses at once and resumes when the hands return.
- [ ] Microgestures (thumb tap or swipe on the index finger): check whether Quest Browser sends them at all (`microgesture` log lines). Swipes page the units; tap = Next lesson when offered.
- [ ] Performance capture during practice: 72 fps target, never below 60.
- [ ] Production URL loads logged out or in incognito.

## 4. Known gaps
- **No depth occlusion.** Real fingers draw under the virtual paper, and the IWSDK hand outline stays on top. Depth occlusion against a surface within millimetres of the real desk would likely flicker, so it is left off pending a device test.
- **Contact thresholds** (down at 12 mm, up at 24 mm, after calibration) are tuned for the emulator. Tune them on a real desk if needed: `DOWN_H` and `UP_H` in `src/calligraphy-system.ts`.
- **The master's motion is procedural** (a pointing pose that follows the stroke path), not a recording of a real calligrapher.
- **No gaze interactions.**

## Final regression (17 Nov 2026, final code)
```
$ python3 tools/e2e.py --lessons 6 --negative --piano 4 --jitter 3
  one       strokes [88]                  average 88
  two       strokes [85, 90]              average 88
  ten       strokes [86, 94]              average 90
  person    strokes [84, 88]              average 86
  big       strokes [86, 95, 91]          average 91
  eternity  strokes [89, 95, 93, 91, 95]  average 93
  piano-five    [96]   (accuracy 1.00)
  piano-twinkle [92]
  piano-ode     [93]   (accuracy 1.00, rhythm 0.79)
  piano-sakura  [85]
  negative cases: 3/3 gave the expected hint
PASS
```
```
$ python3 tools/e2e.py --lessons 2 --hand left --jitter 3
  one       strokes [88]       average 88
  two       strokes [91, 90]   average 90
PASS
```

Also passing:
- `npm run typecheck`;
- `npm run build`;
- `vite preview` serves the page, bundle, hand models, panels and scene (all 200), with dev logs stripped from the bundle.

## Emulator note: a locked screen stops the headed browser
Chromium stops drawing a headed window that can't be seen (screen locked or asleep). The app then logs one frame and freezes in "Finding your desk", with no errors. Run the emulator headless for unattended tests: `npx iwsdk dev restart --headless --open --allow-browser-automation`.

## Real pen mode and controllers (18 Nov)
- `python3 tools/e2e_pen.py`: **PASS**. A tripod grip with the pen tip 9.1 cm from the index knuckle; the app learned 9.1 cm; stroke 88. Calibration takes the lowest still pose over the seal and confirms it on lift, so a hovering hand can't calibrate. Only a headset can show how much a real wrist's rotation moves the tip (a 9 cm lever: 10 degrees is about 1.6 cm).
- Controllers instead of hands: the card says "Put your controllers down" and where to turn on hand tracking (checked in the emulator by switching the input mode).
- Regression after both: `e2e.py --lessons 2 --piano 1 --compose` PASS (85, 84, 86, 83, 86), `e2e_hands.py` 7/7 PASS.
