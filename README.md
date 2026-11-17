# Hands of a Master

**Learn a craft inside a master's hands. Meta Quest, hands only.** A master's translucent "ghost" hand works beside yours on your real desk. Follow it with your own fingertip; stay in step and the two hands lock together in gold. As you improve, the master fades away and lets you work alone.

Two crafts, four places, and a full course (about 180 short lessons in units, like a language app):
- **Calligraphy** in **Japanese** (on the veranda of Kennin-ji, Kyoto's oldest Zen temple: 75 lessons, kanji interleaved with hiragana), **Chinese** (a classical garden: 50 lessons) or **English italic** with a broad nib (a medieval cloister: 32 lessons, letter families, then words).
- **Piano** at a black concert grand in a music room: 26 songs and drills in 5 units, starting with **Happy Birthday**, plus **Today's echo** (a new phrase every day) and **your own music**: play a tune to the master and it learns it, add a MIDI file, or open a tune someone shared as a link.
- **Practice that adapts:** each pass of a lesson lowers the help (full guide, outline only, from memory), and within an attempt the master fades while you keep up and comes back after a slip. A daily goal, a streak and a Review button bring the weakest lesson back.

You start in your own room: the paper or keyboard lands on your real table. Then your room **dissolves into the place like ink soaking into washi**. A desk stands exactly where your real table is, so every touch is still real. The menu's **Scene** button dissolves back to your room.

![Writing on a real table](docs/media/02-real-table-watch.png)

| | |
|---|---|
| ![Lock-in: in unison with the master](docs/media/03-practice-gold-lock.png) | ![Lesson complete: the master's seal](docs/media/04-eternity-complete.png) |

- **Platform:** WebXR in Meta Quest Browser (Quest 3 / 3S), built with the Immersive Web SDK (IWSDK) 1.1.0. No install: judges open a URL.
- **Competition:** Meta VR Start Developer Competition 2026. Suggested track: Productivity (learning a skill). Division: New Experience.
- **Status (18 Nov 2026):** both crafts are built and pass an automated end-to-end test in the IWSDK emulator. It has not yet been run on a physical headset; see [docs/TESTING.md](docs/TESTING.md).

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

**Piano.** Choose Piano on the menu. A small keyboard (A3 to E5, letters on the white keys) lands on your table and the room dissolves into a white music room with a black concert grand. A music sheet shows the song as note names. Long songs are taught **phrase by phrase**: the master plays a phrase, you echo it, and so on, then you play the whole song. Each turn starts with a **four-beat count-in**, and the next key **pulses exactly when its note is due**. Press with any fingertip; a note floats up from each key, gold if you were on the beat. Scored on accuracy (65%) and rhythm (35%). The units (all melodies public domain):
1. **First songs:** Happy Birthday (in F, so it ends on your first black key), Hot Cross Buns, Mary Had a Little Lamb, Au clair de la lune.
2. **Find your way:** the white keys, twos and threes (the black-key map), C position, steps and skips.
3. **Sharps and flats:** sharps, flats, D position (F-sharp), F position (B-flat).
4. **Scales and leaps:** A minor, D major, a black-key tune, thirds, fifths.
5. **Songs of the world:** Twinkle, Frère Jacques, London Bridge, Ode to Joy, Jingle Bells, When the Saints, Auld Lang Syne, Sakura, Für Elise.
6. **Your music:** Today's echo, your saved tunes, and a New tune slot.

**Your own music** (up to six tunes, saved in the browser):
- **Play your own tune** on the menu: play any keys, one at a time. Stop for three seconds and the master learns it (timing rounded to half beats), plays it back, then teaches it to you like any other song.
- **Add your own piano song (MIDI)** on the start page, or drag a `.mid` file onto it. The master takes the melody (the top note of each chord, up to 40 notes), moved by octaves to fit the keyboard. Free public-domain MIDI: [Mutopia Project](https://www.mutopiaproject.org).
- **Share a tune:** on the start page, "Copy a link to your tune". Whoever opens the link (`?tune=...`) on a Quest goes straight to the piano, and the master already knows the tune.

**Languages:** you start in Japanese. After your first character the master invites you to try Chinese or English; the language chips are on the menu at any time.

**Calligraphy units:**
- **Japanese:** first strokes (一 二 十 人 大 永: 永 holds the Eight Principles of the brush), hiragana a to ke, numbers, hiragana ko to tsu, nature, hiragana te to no, people, places and sizes, sky and seasons.
- **Chinese:** the same kanji units with Mandarin readings.
- **English italic:** straight strokes (i l t j f), round letters (o c e s), bowls and stems (a d g q), arches (n m h r u y b p), diagonals (v w x z k), then words (hi, ink, art, moon, love, hand). The nib is held at 40 degrees, so downstrokes swell and hairlines thin, as with a real broad-edge pen.

**Coming back:** one star per pass, best score per lesson, a daily goal of three lessons and a streak. **Review** on the menu brings back the passed lesson you are weakest at, from memory. The menu shows one unit at a time; < and > page through them.

**Controls (all hands):**
- Write with your index fingertip.
- **Poke** menu buttons with a fingertip, or **pinch** with the hand ray. A button lights up as your fingertip nears it, and a small ring on the panel shows how close you are.
- **Thumbs up** (held for a moment, a gold ring fills beside your thumb) = "Next lesson", whenever that button is offered.
- If your hands leave the cameras' view, the lesson waits: a card asks you to bring them back, a stroke cut off by tracking loss doesn't count, and a piano song pauses.
- Menu options:
  - lessons;
  - tempo (30 to 100%);
  - watch again;
  - guide mode (adaptive / always / off);
  - craft (Calligraphy / Piano) and language (Japanese / Chinese / English);
  - units (< and >) and Review;
  - write with your fingertip, or a real pen or brush held in your hand (beta: rest its tip on the seal to teach the app where the tip is);
  - music on or off, larger text;
  - Scene: the place, or your own room;
  - "Move paper in front of me" (places the paper again).
- Left-handed writers are detected automatically. The ghost becomes a left hand and the menu moves to the right side.

## If something's off
| You see | Do this |
|---|---|
| "Put your controllers down" | Set the Touch controllers aside. If no hands appear: Settings, Movement tracking, Hand and body tracking on |
| The paper sits on a virtual desk | No table was found. Press "Scan my room" on the menu (Quest 3), or sit at a table and press "Move paper here" |
| Ink doesn't appear when you touch | Touch the red seal again (the menu's "Move paper here" re-places and re-calibrates); keep your hand in good light |
| No sound | Raise the headset volume; the browser starts sound on your first press |
| Writing with a real pen drifts | Hold the pen as you write, rest its tip on the seal, keep still, lift. Or switch back to "Write with: fingertip" |

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

To add a character, drop its KanjiVG SVG into `tools/kanjivg/`, run `npm run data`, and add a row to a unit in `src/lessons/lessons.ts`. English letters are SVG paths in `tools/latin-letters.mjs` (words are composed from them). Piano songs and units are in `src/piano/songs.ts`.

## Credits
- **Places (360-degree photographs):**
  - Kennin-ji moss garden veranda, by AsPJT, **CC0**, via Wikimedia Commons.
  - Chinese Garden and Ballroom HDRIs, **Poly Haven**, CC0.
  - Historic Cloister Passage HDRI by Elvis Posa, **Poly Haven**, CC0.
- **Music:**
  - "Yoiyami Core Theme" and "Oriental Somber" (opengameart.org/node/155193), both CC0.
  - "Asianoriental1" and "Asianoriental2" by Tozan, CC0.
  - All via OpenGameArt; re-encoded to 96 kbps MP3 with a 2 s fade-in.
- **Piano:** Salamander Grand Piano samples by Alexander Holm, **CC-BY 3.0** (via Tone.js).
- **Models:** writing set, keyboard and grand piano built in Blender by `tools/blender/build_assets.py`. Textures: Poly Haven and ambientCG, CC0.
- **Stroke order and shapes:** kanji and hiragana from [KanjiVG](https://kanjivg.tagaini.net), CC BY-SA 3.0, (c) Ulrich Apel and contributors. The derived `src/lessons/strokes.json` is under the same license. The English italic letters are original (`tools/latin-letters.mjs`).
- **Melodies:** all traditional or by composers who died long ago (public domain); Happy Birthday's melody is public domain since 2016. The note sequences, exercises and Today's echo generator are original.
- **Hand mesh:** [WebXR Input Profiles](https://github.com/immersive-web/webxr-input-profiles) generic hand, MIT.
- **Base hand pose:** [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime) point pose, MIT, (c) Meta Platforms.
- **Built with:** the [Immersive Web SDK](https://github.com/facebook/immersive-web-sdk) (MIT) and three.js (super-three). Sound effects are synthesized in code.
- **Common plan for all six team projects:** `../meta-vr-start-2026-kit/research/common-build-plan.md`.
