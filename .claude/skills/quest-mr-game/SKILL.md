---
name: quest-mr-game
description: Add-on to quest-hands-first-webxr for games with an opponent or NPC: rules simulation and balance, controllable dice/physics, readable NPC state machines, a realistic rigged character (MakeHuman/MPFB pipeline, procedural animation), table dressing, juice, and LLM-driven characters.
---

# Game add-on: an opponent at the user's real table

Load `quest-hands-first-webxr` first; it owns setup, hands, placement, UI, lighting, testing and submission. This add-on covers games with rules, an opponent or NPC, and controllable physics. Provenance: built and emulator-verified in `chausar/` (a dice board game against a realistic NPC, IWSDK 1.1.0); its `src/game/` is the full reference implementation.

## References and toolkit
| File | Contents |
|---|---|
| [references/game-design.md](references/game-design.md) | Loop, NPC state machine, rules sim, controllable physics, table dressing, room transformation, juice, LLM characters |
| [references/character-pipeline.md](references/character-pipeline.md) | MakeHuman/MPFB → glTF → procedural animation; export traps; QA checklist |
| `scripts/test/rules-sim.example.ts` | Thousands of AI-vs-AI games plus regression asserts (template) |
| `scripts/test/headless-physics-test.example.ts` | Headless physics checks via an esbuild alias (template) |
| `scripts/character/build_human.example.py` + `costume.example.py` | Rigged, dressed GLB plus a preview render (templates) |
| `reference/runtime/*.ts` | Modules that compile on their own against `@iwsdk/core`: `hands.ts` (pinch hysteresis, release velocity, tracking grace), `human.ts` (IK, look, face, gestures), `text.ts` + `ui.ts` (fit-to-card labels, subtitles, hints), `tablecloth.ts` (dress the real table from the plane outline), `palace.ts` (head-centred dome), `props.ts` (normalise and clone), `lighting.ts` (room IBL, tight shadow camera) |

Not copied because they depend on game-specific modules: `dice.ts` (custom rigid-body dice with forced faces) and `juice.ts` (hops, squash, reward waves, outlines). Read them in `chausar/src/game/`.

## Workflow additions
1. **Rules sim before any 3D** (pure TypeScript, `node file.ts`): thousands of AI-vs-AI games. Gate: a session lasts 2–4 minutes and is balanced; regression asserts for edge cases (seat 0 winning must not pass the turn).
2. **An opponent with a readable state machine and telegraphs** (watching / away / turning back with a ~0.75 s warning). Script the first encounter so every player meets each mechanic in the first minute, with one-time contextual hints.
3. **A secret or advanced verb that uses the real room** (e.g. hide your hand below the real table edge): it makes passthrough purposeful.
4. **Decide the visual pillars on day one:** character (realistic rigged, or a deliberately stylised hero), environment (the room, or a wall-replacing dome), table dressing, lighting. Never copy a real actor's face.
5. **Outcomes you control:** a custom sim with forced results, verified headlessly (100% settle, 100% forced faces, landing-zone share).
6. **Bring objects to the character:** a seated NPC can't reach the far side of the table; let the dice or pieces slide to him.
7. **Persistent progress:** a versioned localStorage ledger with escalating stakes, as the reason to come back.
8. **Review every pose in close-up** with dev review cameras before showing anyone (character-pipeline.md §6).

## Tests to add to the core matrix
Core loop; each secret mechanic seen and unseen; correct and wrong accusation or challenge; win, lose and restart; dev keys for rare states (NPC looks away, near-win, the awe moment). The reference project runs 19 emulated-hand XR checks plus the rules and physics sims.

## Pitfalls
| Symptom | Cause | Fix |
|---|---|---|
| Eyes slide out of sockets on head turns | proxies exported unskinned | Armature modifier + rigid head weights before export |
| Lashes or brows displaced | Draco on small skinned meshes | no Draco on characters |
| Hands look severed | full-length sleeves with a hard trim, or only the wrist aimed | sleeves end mid-forearm; aim the wrist so the knuckles point at the target |
| Character cut at the tabletop | clipping-plane hack | full seated body + seat + `DepthOccludable` |
| Free GPU quota gone mid-build | ~1–3 image-to-3D models a day | hero assets first; procedural fallback for every asset |
| Two agents broke the same file | no ownership | each agent gets a no-touch list and an integration note |
