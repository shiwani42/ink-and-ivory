# Hands of a Master

**Learn a craft inside a master's hands. Meta Quest, hands only.** A master's translucent "ghost" hand works beside yours on your real desk. Follow it with your own fingertip; stay in step and the two hands lock together in gold. As you improve, the master fades away and lets you work alone.

Two crafts and three places:
- **Calligraphy** in **Japanese** (on the veranda of Kennin-ji, Kyoto's oldest Zen temple) or **Chinese** (a classical garden). Each has its own characters, readings and music.
- **Piano** at a black concert grand in a music room, starting with **Happy Birthday**, then lessons on the keyboard itself (white keys, sharps, flats) and four more public-domain melodies, and **your own song**: play a tune to the master and it learns it, or add any MIDI file on the start page. No background music.

You start in your own room: the paper or keyboard lands on your real table. Then your room **dissolves into the place like ink soaking into washi**. A desk stands exactly where your real table is, so every touch is still real. The menu's **Scene** button dissolves back to your room.

![Writing on a real table](docs/media/02-real-table-watch.png)

| | |
|---|---|
| ![Lock-in: in unison with the master](docs/media/03-practice-gold-lock.png) | ![Lesson complete: the master's seal](docs/media/04-eternity-complete.png) |

- **Platform:** WebXR in Meta Quest Browser (Quest 3 / 3S), built with the Immersive Web SDK (IWSDK) 1.1.0. No install: judges open a URL.
- **Competition:** Meta VR Start Developer Competition 2026. Suggested track: Productivity (learning a skill). Division: New Experience.
- **Status (17 Nov 2026):** both crafts are built and pass an automated end-to-end test in the IWSDK emulator. It has not yet been run on a physical headset; see [docs/TESTING.md](docs/TESTING.md).

## The experience (about 5 to 10 minutes)
1. **Start at my desk.** In the browser page, press the button (or the browser's Enter XR). You stay seated, and passthrough shows your real room.
2. **The paper arrives on your real table.** The app finds a table among the detected planes and unrolls a felt mat, washi paper with a practice grid, a paperweight and an inkstone in front of you, anchored in place. Round tables are handled. If there is no table, it falls back to a virtual desk.
3. **Watch the master.** The ghost hand writes the character in vermilion ink, with a soft light at its fingertip.
4. **Touch the red seal** once. This calibrates contact height for your desk.
5. **Write stroke by stroke.**
   - The master waits at a glowing start point and leads at your chosen tempo.
   - A shrinking ring under your fingertip shows where the ink will land.
   - Touch the desk to put ink down and lift to finish. Ink width follows your speed, with a dry-brush texture.
   - Stay within about 2.4 cm of the master's fingertip and **your hands lock together**: the ghost slides onto your tracked hand, turns gold, a bell rings, and your ink turns gold.
   - Each stroke is scored on path, direction, order, speed and sync, with a specific hint when it misses ("Other direction", "Stay closer to the master's path", "Slower").
6. **Seal it.** The master's seal is stamped onto the page and your score and daily streak are saved. Then choose "Next lesson" or "Write it again".

**Piano.** Choose Piano on the menu. A small keyboard (A3 to E5, letters on the white keys) lands on your table and the room dissolves into a white music room with a black concert grand. A music sheet shows the song as note names. The master's hand plays each phrase, then waits on the next key, which glows. Press with any fingertip; a note floats up from each key, gold if you were on the beat. The piano ladder (all public domain), scored on accuracy (65%) and rhythm (35%):
1. **Happy Birthday**: the song everyone knows, in F, so it ends on your first black key (B-flat).
2. **The white keys**: find C, walk up to the next C and back.
3. **Sharps**: the next key up; no black key between E and F.
4. **Flats**: the next key down; one black key, two names (A-sharp is B-flat). The music sheet names black keys as flats in flat songs.
5. Twinkle, 6. Ode to Joy, 7. **Für Elise** (the opening phrase in its own key: sharps at work), 8. Sakura.
9. **Your tune** (below).

**Your own song** (tile 9):
- **Play your own tune** on the menu: play any keys, one at a time. Stop for three seconds and the master learns it (timing rounded to half beats), plays it back, then teaches it to you like any other song.
- **Add your own piano song (MIDI)** on the start page, or drag a `.mid` file onto it. The master takes the melody (the top note of each chord, up to 40 notes), moved by octaves to fit the keyboard. Free public-domain MIDI: [Mutopia Project](https://www.mutopiaproject.org).
- It is saved in the browser, so it is still there next time.

**Languages:** you start in Japanese. After your first character the master invites you to try the other language; the language chips are on the menu at any time.

**Lessons:** 一 one, 二 two, 十 ten, 人 person, 大 big, 永 eternity. 永 is the classic teaching character whose five strokes contain the Eight Principles of the brush.

**Coming back:** best score per character, stars, and a daily practice streak. Your best score also drives the **adaptive guide**: the ghost and tracing outline fade as you improve ("the master lets go").

**Controls (all hands):**
- Write with your index fingertip.
- **Poke** menu buttons with a fingertip, or **pinch** with the hand ray.
- Menu options:
  - lessons;
  - tempo (30 to 100%);
  - watch again;
  - guide mode (adaptive / always / off);
  - craft (Calligraphy / Piano) and language (Japanese / Chinese);
  - music on or off, larger text;
  - Scene: the place, or your own room;
  - "Move paper in front of me" (places the paper again).
- Left-handed writers are detected automatically. The ghost becomes a left hand and the menu moves to the right side.

## Run it
```bash
npm ci            # Node >= 20.19 (see .nvmrc). .npmrc skips onnxruntime's CUDA download (Linux).
npm run setup     # once per machine: AI-agent MCP configs + IWSDK reference index (optional)
npm run dev       # HTTPS dev server + IWER emulator at https://localhost:8081
npm run build     # static site in dist/ (deploy to Vercel; vercel.json is included)
```
- **On a Quest (Linux or Windows):** connect over USB, run `adb reverse tcp:8081 tcp:8081`, then open `https://localhost:8081` in Quest Browser. Alternatively, open the Network URL from the dev server on the same Wi-Fi.
- **Deploy:** `npx vercel --prod` from this folder. Use the production alias URL for judges and test it logged-out on the headset.

## Test it
- **Automated end-to-end:** `python3 tools/e2e.py --lessons 6 --negative` with the dev server running. It plays every lesson hands-only in the emulator, checks that the wrong strokes get the right hints, and saves screenshots.
- Results, the on-device checklist and known gaps are in **[docs/TESTING.md](docs/TESTING.md)**.

## Documents
| File | What |
|---|---|
| [docs/JUDGING.md](docs/JUDGING.md) | How the app meets each judging criterion, rule and special award, with evidence and known gaps |
| [docs/SUBMISSION.md](docs/SUBMISSION.md) | Devpost text, video shot list (under 3 min), screenshot list, final checklist |
| [docs/TESTING.md](docs/TESTING.md) | Automated and manual tests, latest results, performance numbers, on-device plan |
| [.claude/skills/quest-hands-first-webxr/SKILL.md](.claude/skills/quest-hands-first-webxr/SKILL.md) | Reusable playbook for the other projects: workflow, proven patterns, emulator test harness, pitfalls |
| [docs/IWSDK-STARTER.md](docs/IWSDK-STARTER.md) | Notes from the IWSDK starter this project began from |

## Code map
| File | Role |
|---|---|
| `src/calligraphy-system.ts` | The experience: placement, watch, calibrate, practice, complete; fingertip tracking; poke buttons; captions and menu |
| `src/ghost/ghost-pose.ts` | Builds the master's 25-joint hand pose for any fingertip target on the paper (from IWER's "point" pose) |
| `src/ghost/ghost-hand.ts` | Skinned ghost hand: Fresnel shader, depth pre-pass, fingertip glow; joint blending for lock-in |
| `src/ink/ink-ribbon.ts` | Preallocated brush-stroke ribbons: taper, speed-based width, dry-brush alpha |
| `src/lessons/` | Lessons, stroke timing (`master-path.ts`), scoring and hints (`scoring.ts`), generated `strokes.json` |
| `src/desk/desk.ts` | Writing set: mat, paper texture with practice grid, paperweight, inkstone, seal, hover cursor, virtual table |
| `src/common/` | One Euro filter, sound (music playlist, compressor bus, synthesized effects, sampled piano), 72 Hz + foveation |
| `src/env/environment.ts` | 360-degree places, ink-bleed dissolve between your room and the place, "calm" soft-focus treatment |
| `src/piano/` | Songs, keyboard and fingertip key detection, listening to your own tune, MIDI import (`custom-song.ts`), music sheet, floating notes |
| `src/fx/sparks.ts` | Pooled gold sparks (one draw call, additive) |
| `tools/blender/` | `build_assets.py` (all models), `preview.py` (still-life render for review) |
| `src/progress.ts` | localStorage progress: best scores, attempts, streak |
| `tools/build-data.mjs` | `npm run data`: KanjiVG SVGs to `strokes.json`; IWER point pose to `point-pose.json` |
| `tools/e2e.py` | Emulator end-to-end test (see docs/TESTING.md) |

To add a character, drop its KanjiVG SVG into `tools/kanjivg/`, run `npm run data`, and add a line to `LESSONS` in `src/lessons/lessons.ts`. The pipeline works for any stroke-ordered script.

## Credits
- **Places (360-degree photographs):**
  - Kennin-ji moss garden veranda, by AsPJT, **CC0**, via Wikimedia Commons.
  - Chinese Garden and Ballroom HDRIs, **Poly Haven**, CC0.
- **Music:**
  - "Yoiyami Core Theme" and "Oriental Somber" (opengameart.org/node/155193), both CC0.
  - "Asianoriental1" and "Asianoriental2" by Tozan, CC0.
  - All via OpenGameArt; re-encoded to 96 kbps MP3 with a 2 s fade-in.
- **Piano:** Salamander Grand Piano samples by Alexander Holm, **CC-BY 3.0** (via Tone.js).
- **Models:** writing set, keyboard and grand piano built in Blender by `tools/blender/build_assets.py`. Textures: Poly Haven and ambientCG, CC0.
- **Stroke order and shapes:** [KanjiVG](https://kanjivg.tagaini.net), CC BY-SA 3.0, (c) Ulrich Apel and contributors. The derived `src/lessons/strokes.json` is under the same license.
- **Hand mesh:** [WebXR Input Profiles](https://github.com/immersive-web/webxr-input-profiles) generic hand, MIT.
- **Base hand pose:** [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime) point pose, MIT, (c) Meta Platforms.
- **Built with:** the [Immersive Web SDK](https://github.com/facebook/immersive-web-sdk) (MIT) and three.js (super-three). Sound effects are synthesized in code.
- **Common plan for all six team projects:** `../meta-vr-start-2026-kit/research/common-build-plan.md`.
