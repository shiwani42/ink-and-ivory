# Game design and systems for a hands-only MR game

## 1. One loop, one awe moment, one reason to come back
- One verb a stranger gets in 2 seconds (pinch and throw, pinch a piece), at most two more.
- The secret or advanced verb uses the real room (a hand hidden below the real table edge, a glance away). It is the purposeful-passthrough story.
- Session 2–4 minutes; a persistent ledger with escalating stakes.

## 2. The NPC: readable, telegraphed, staged
- **State machine** with visible telegraphs: watching → away → turning back with a ~0.75 s warning. The player must be able to read it from posture and gaze alone.
- **First encounter is scripted** so every player meets each mechanic in the first minute; one-time whispers or hints the first time each becomes possible.
- **Dialogue** sits in a fixed world spot below the speaker's face with a speaker tag (core ui-text.md). Lines are short; captions always on; TTS via `speechSynthesis` when present, jaw driven by line timing.
- **Expressions** follow game state: smug baseline, a modest squint when watching, laugh, anger, sneer (character-pipeline.md §5).
- **Bring the game to the NPC:** a seated character can't reach the far side of a real table; let objects slide or "obey" him.

## 3. Rules first, as pure code
- Pure TypeScript module, no three.js; run thousands of AI-vs-AI games with `node file.ts` (`scripts/test/rules-sim.example.ts`).
- Gate before 3D: session length and balance in range.
- Regression asserts for edge cases you hit (`!state.winner` is wrong when seat 0 can win; a capture on the last move; a forced pass).

## 4. Outcomes you control (loaded dice, rigged throws)
- A custom rigid-body sim instead of a physics engine when you need forced results: 8-corner contacts with impulse, friction and positional correction, rolling resistance on contact, and a settle that slerps onto the chosen face. Honest throws randomise the starting roll.
- Release from the hand with the core hands-input numbers (least-squares velocity over 140–40 ms, aim assist ≤ ±5 cm landing short).
- **Verify headlessly** (`scripts/test/headless-physics-test.example.ts`, esbuild `--alias:@iwsdk/core=three`, `document.createElement` stubbed): 100% settle, 100% forced faces, the share landing in the target zone, median settle time.
- For ordinary physics (stacking, knocking over) use the official `iwsdk-physics` skill instead.

## 5. Dress the real table
Use the detected plane's outline (core placement.md) to lay a themed cover cut to it: a velvet top, a wide border, corner ornaments, a skirt with folds (a sine offset along each edge), a hem, a tassel fringe (instanced cones). It turns any table into a period table while staying the real play surface. Default size with no plane; carved legs on desktop only. Reference: `reference/runtime/tablecloth.ts`.

## 6. Transform the room
- Wall-replacing dome faded out below about −15° so the table, hands and floor stay passthrough (core visual-quality.md §4); reveal with the NPC's entrance, dissolve back to the real room on the win ("your room, your kingdom"). Reference: `reference/runtime/palace.ts`.
- 3D pieces in front of the dome: an arch framing the NPC, symmetric pillars or lamps flanking the seat; nothing between the player and the play area.
- Real-world scale: chairs 0.9 m, standing lamps 1.1–1.2 m, pillars 2.6–2.9 m, arches ~2.7 m, table props ~0.1 m. Floor at −tableHeight in board space.

## 7. Juice (see `chausar/src/game/juice.ts`)
- Piece hops: anticipation squash → stretch → squash on landing → settle with overshoot; a landing dust puff and a pitched tap per step; a bigger thump and a ring on the last step.
- Reward waves (3–4 bursts ~0.28 s apart, rising sound) for captures, wins, correct accusations.
- Legal-move outline: inverted hull, easeOutBack pop-in, pulse.
- A room dimmer as the stakes rise; an awe moment without post-processing (progressive canvas crack → additive light pillars → sparks → cooling to gold).

## 8. Architecture
One director system and small modules, all maths in board-local space under one anchored group: `rules · dice/physics · hands · board · character · seat · dome · tablecloth · props · ui + text · lighting · ambience · juice · fx · audio · save · director`. Phase enum + `phaseT` + `once(key)` reset on phase change (core architecture.md).

## 9. LLM-driven characters (optional)
A scripted opponent is easier to test and was enough for a believable NPC. If an LLM drives one:
- It returns a JSON action contract (`{"action":"taunt","line":"…"}`, `{"action":"cheat","kind":"swap"}`) that the game validates against the rules before acting; the model never mutates state directly.
- Separate listen / think / speak modules; stream mic audio (`MediaRecorder` Opus) to a serverless endpoint; keep secrets server-side.
- Timeouts and a scripted fallback line for every call; the game must still stand without the model (the "take it away" test).
- Log every action in dev for the e2e harness, and stub the model in tests.
