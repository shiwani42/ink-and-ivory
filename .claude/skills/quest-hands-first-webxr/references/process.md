# Working with the user and iterating

## The bar
"A great designer would ship this", not "the tests pass". Expect visual critique ("dummy", "naive", "unpolished", "too busy") and treat it as the spec. Before showing anything, inspect it yourself in close-up and from the player's real viewpoint.

## The loop
1. **Smallest complete journey first:** enter, place, do, succeed, finish. Test end to end and show screenshots. A complete rough loop beats a polished fragment.
2. **Show, then ask one focused question.** Send screenshots (`artifacts/*.png`) each round; users react to pictures far better than to descriptions.
3. **Treat feedback as a design rule, not a one-off fix.** "Too busy" became "places are softened behind the task"; "don't mix the house and the world" became "one world at a time". Write the rule into the skill.
4. **Status in a sentence or two at each milestone,** then keep working. When asked "what's the status of X", answer X first. Say plainly when the running build is old ("what you see is the old build").
5. **Regression cadence:** a quick run after each change, the full suite before each commit. **Commit after green runs once the user has approved commits;** never leave a large uncommitted pile without saying so.
6. **Delegate side quests** (tool research, licence checks, self-contained subsystems such as lighting or ambience) to background agents with a narrow brief, a list of files they must not touch, and an integration note (`docs/INTEGRATION-*.md`) you wire in. Never let two agents edit the same file.

## Talking with the user
- **Ask, with options, only when it's theirs to decide:** spending, accounts, style direction, publishing, committing. 2–4 concrete options, trade-offs, a recommendation.
- **"How do I…?"** gets numbered steps, exact commands and direct links. Secrets (API tokens) go into a gitignored file (`.env.local`) **from their own terminal**, never through chat; scripts read them and never print them.
- **"Did you try alternatives?"** gets a tried / not-tried list, then try the untried ones.
- **Research they hand you** gets a short table against the constraints (GPU, budget, licence): use, backup, not applicable and why. Act on the useful parts at once.
- **Explain causes in user terms** ("the eyes weren't attached to the head bone"), so the fix reads as real.
- **Honest limits:** what is good, what is not yet production-grade, what only a headset or more quota can fix. Never claim a fix you haven't verified with a screenshot or a test.
- **Respect "don't spend":** exhaust free paths and say when a free quota is the bottleneck and when it resets.

## Lessons from past winners (`reference-winners/REPORT.md` in the workspace)
- **Polish one loop, not many features.** Winners won with one loop done well.
- **Spread thin, lose all.** With several projects and little time, finish the strongest and park the rest.
- **Playtest with someone new to XR** for 15 minutes before recording the trailer; fix only what confuses them.
- **Record on the headset, standalone,** real gameplay, hook in the first 20 s.
- **Ship two URLs** and test both logged out.
- **Study winners' code safely:** shallow clone into a separate folder, read `package.json` first, install with `--ignore-scripts`, never copy code without checking its licence (assets-and-licensing.md).

## Process anti-patterns we hit
- Editing a comment in `src/` while the emulator test ran (the run was invalid).
- Measuring draw calls from a log that still held the previous run's lines.
- Long labels overflowing fixed UI sizes, found only in screenshots.
- Writing a credit from memory instead of from the source page.
- Assuming a hosted asset API works because it is documented.
- A first version that passed every functional test and was rejected on looks: the visual bar came too late.
- Five rounds tuning a symptom (squint values, alpha cutoffs) before bisecting the pipeline found the real cause.

## Parallel agents in a git worktree (worked well for a world or art subsystem)
- Freeze the interface first: a `types.ts` contract plus a grey-box stub that implements it, committed before the agent starts. The director is built and fully emulator-tested against the stub while the agent builds the real thing; the merge then needed only layout tweaks.
- Give the agent its own preview page and **its own port**, never the main dev port. If its `node_modules` is a symlink to the main checkout, also give it its **own Vite `cacheDir`** (e.g. `.tmp/vite`): otherwise its optimizer overwrites the shared `node_modules/.vite` and the main server serves stale deps.
- Ask for screenshots from the player's real seat plus close-ups, perf numbers (`renderer.info` after one frame), and an integration note. Review the screenshots yourself before merging.
- After merging: copy its artifacts, then `git worktree remove --force` and delete the branch. Gitignore `.claude/worktrees/` and `__pycache__/` so a commit never embeds them.

## Porting an existing game: the original is the spec
- Before designing anything, have a read-only agent map the original's player-facing flow with file:line citations: screens and strings, task order and selection, the dialogue/turn loop and its pass rule, rewards and HUD, transitions (rides, cutscenes), audio events, and what is legacy or unreachable. Build to that spec.
- Keep its order, content, UI copy, loop, rewards, finale, look and audio. Add VR on top (hands paths, physical verbs, MR placement, seated rides) and label those as additions in JUDGING.md. Don't swap its mechanics for invented ones; one user rejected a quiz-card flow at once with "follow everything exactly as in real <game> code".
- Port data verbatim with a provenance header (e.g. lesson files, level tables), and unit-test the port against the source's numbers (order, totals, step counts per level).
- Show motion where the original moves the player: rides, vehicles arriving, a new place for each task. A static set with only the text changing reads as a slideshow.
- **If the original is three.js, run its world code; don't rebuild it.** A rebuilt city looked close but was not "exactly as in the repo" (the user asked twice). The fix that stuck:
  - Vendor the original's engine folder unmodified, with a README naming the commit. Copy only the import closure: bundle the entry points with `esbuild --bundle --metafile --external:three` and copy the files listed in `inputs`.
  - Resolve its path aliases (`@/lib` → the vendored folder) in both `vite.config.ts` and `tsconfig.json` `paths`. Stub type-only imports, and `define` `process.env.NODE_ENV`.
  - `three` stays a single instance when the project's `three` is the same `super-three` that `@iwsdk/core` uses (`resolve.dedupe`).
  - Call its builder the way its own engine does (its scene setup, lights, sky, material conversion). Keep every VR change in one adapter file, never in the vendored files, so a fresh copy can drop in.
  - Its stated look (post-processing) won't run per eye on a Quest. Move the grade and haze into each material with `onBeforeCompile` (chain any existing hook and extend `customProgramCacheKey`). Do ink as inverted hulls that share the geometry, drawn only near the user.
  - A desktop city will blow the Quest budget: in our case 3M triangles and 560 draw calls, from a whole-map crowd, traffic and clutter. See visual-quality.md, "Culling a vendored world".
  - Verify the port with an inventory probe: every group the builder adds, landmarks by name, and the original's own console warnings (a missing webfont, a missing preset).
