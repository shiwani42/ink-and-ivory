# Submission pack: Hands of a Master

Everything needed for the Devpost entry.

- **Deadline:** Wed 18 Nov 2026, 12:00 PM PST (Thu 19 Nov, 1:30 AM IST).
- **No changes are allowed after the deadline,** so submit hours early.

## Form fields
- **Project name:** Hands of a Master
- **Tagline (under 200 characters):** Learn calligraphy or piano inside a master's hands. A ghost hand works beside yours on your real desk; move in unison and your hands lock in gold. Hands only.
- **Track:** Productivity
- **Division:** New Experience
- **Project link:** the Vercel production URL (`https://<project>.vercel.app`). Paste the alias, not a hashed per-deploy URL.
- **Video:** a public YouTube or Vimeo link, under 3:00.
- **Built with:** Immersive Web SDK (IWSDK) 1.1.0, WebXR, three.js (super-three), TypeScript, Vite, Blender (Python), Web Audio, KanjiVG stroke data, Vercel.

## Description (paste into Devpost)

### Inspiration
Crafts of the hand, like calligraphy and the piano, are learned by watching a master's hand, then copying it thousands of times. Video can't show you the hand's motion from your own point of view, and books can't correct you mid-stroke. Mixed reality can put the master's hand on your own desk, at your scale, moving where your hand should move. Research on "skill-adaptive ghost instructors" (CHI '26) found that a ghost hand that fades as you improve teaches better than one that is always there. It names calligraphy as a natural next domain. So we built it.

### What it does
- **The paper arrives.** Sit at any table and put on your Quest. A writing set unrolls onto your real desk: felt mat, washi paper with a practice grid, a brush on its rest, an inkstone and a seal set.
- **You travel there.** Your room dissolves, like ink soaking into washi, into the place the craft belongs to: the veranda of Kennin-ji's moss garden in Kyoto for Japanese, a classical garden for Chinese. A desk stands exactly where your real table is, so you still touch something real. One tap on Scene brings your room back.
- **Watch the master.** A translucent hand writes the character in vermilion ink.
- **Your turn, stroke by stroke.** The master waits at a glowing start point, then leads the stroke at your tempo. You follow with your index fingertip and touch the real desk to put ink down. A ring under your fingertip shows where the ink will land.
- **Lock-in.** Stay in step and the master's hand slides onto yours and turns gold, a bell rings, and your ink turns gold.
- **Feedback.** Each stroke is scored on path, direction, order, speed and sync, with a plain-language correction when it misses.
- **Completion.** Finish a character and the master's seal is stamped on your page.

- **Piano.** Switch craft and a keyboard lands on your table, then you're in a white music room at a black concert grand. The master plays a phrase and you echo it, phrase by phrase, then the whole song. It counts you in, and the next key pulses exactly on the beat. Press with any fingertip and a note floats up, gold if you were on the beat. It starts with Happy Birthday, the song everyone knows, then teaches the keyboard itself (the black-key map, hand positions, sharps and flats, scales) before songs from around the world, from Frère Jacques to Für Elise. Every day brings a new phrase to echo. Or bring your own: play a tune to the master and it learns it and teaches it back, add a MIDI file, or send someone a link and their master already knows your tune.

Calligraphy comes in Japanese (with hiragana), Chinese and English italic, each with its own place: a Kyoto temple, a Chinese garden, a medieval cloister. English is written with a broad nib, so strokes swell and thin like a real pen. About 180 short lessons are grouped into units like a language course, from 永 ("eternity", the Eight Principles of the brush) to words. The master lets go as you learn: each time you pass a lesson it helps less (full guide, then the outline, then from memory), and within a stroke it fades while you keep up and returns if you slip. A daily goal, a streak and a Review button bring you back.

Everything works with hands alone, one hand is enough, and left-handed writers are detected automatically. Tempo and guide strength are adjustable, and every instruction has a caption.

### How we built it
- **Stack:** the Immersive Web SDK (IWSDK) on WebXR, running in Meta Quest Browser.
- **Placement:** scene understanding finds horizontal table planes. We fit the writing set inside the table's outline, including round tables, face it toward you, and anchor it. If no table is found, it uses a virtual desk.
- **The master's hand:** the WebXR generic hand mesh with a Fresnel "spirit" shader. A small solver places a 25-joint pointing pose so its fingertip follows each stroke, leaning into the direction of travel.
- **Lock-in:** we blend the master's joints onto your tracked joints.
- **Strokes:** shapes and order come from KanjiVG and are converted to timed paths with a press-travel-settle profile.
- **Ink:** preallocated ribbons, with width driven by fingertip speed as a stand-in for brush pressure, and a dry-brush texture.
- **Fingertip tracking:** One Euro smoothing, touch detection with hysteresis, and a one-touch calibration on the seal.
- **Places:** 360-degree photographs on a sphere that follows your head. One shader softens the place so the paper stays the focus, and runs the ink-bleed dissolve between your room and the place.
- **Piano:** for each hand, the lowest extended fingertip over a key presses it, with hysteresis and a debounce, so a resting hand doesn't play. Real sampled grand piano notes; rhythm judged against the beat.
- **Models:** every object, from the brush to the grand piano, is built by one Blender Python script and exported as glTF.
- **Sound:** CC0 music per place, sampled piano, and effects synthesized with Web Audio.
- **Testing:** we wrote an automated test that drives the IWSDK emulator's hands through every lesson, including wrong strokes that must get the right hint.

### Challenges we ran into
- **Touch without haptics.** We used the real desk as the surface, calibrated per desk, and added a hover ring and a paper-scratch sound.
- **Accidental ink.** A hand dropping to your lap passes through the paper. We discard very short or plunging touches, and ignore hands resting below the desk.
- **A place that doesn't steal the show.** A sharp, busy temple photo pulled the eye away from the paper. We soften it (blur, muted colour, warm haze) and face the quiet moss garden.
- **Two worlds at once felt wrong.** Showing the room and the place together was confusing, so it's one at a time with a dissolve between them.
- **Readability.** Seen from your own eyes, a hand pointing straight down is nearly end-on. We angled the master's hand like a real writer's and added a fingertip light.
- **Poking UI with a fingertip.** In the emulator, the built-in touch pointer didn't click the panel buttons. We added our own fingertip-press test for every button, which shares one debounced trigger with pinch-ray clicks.

### Accomplishments that we're proud of
- The lock-in moment: the first time your hand and the master's move as one and the ink turns gold.
- A complete, honest loop in a few minutes, with real scoring and real corrections.
- Works in rooms we never saw: detected tables of any shape, or a virtual desk.

### What we learned
Hands-first design is mostly about feedback and forgiveness. The real desk gives your fingertip something to press against. Clear visual and sound cues stand in for haptics. And the app has to quietly ignore the ways hands accidentally touch things.

### What's next
- Record real masters' hands. The ghost can already play any 25-joint recording.
- More scripts: Devanagari, Arabic and Latin copperplate, using the same stroke pipeline.
- More crafts that fit on a desk: pottery trimming, knots, sign language.
- Two-handed piano pieces, and the master learning a song from a recording of a real pianist's hands.
- Lessons on stroke variation (the Eight Principles one by one), a review mode that overlays your best attempt, and an optional real pen with a stylus-tracking fallback.
- **Target launch:** a public web release in Q1 2027, and a Meta Horizon Store PWA after that.

### Credits
- KanjiVG stroke data (CC BY-SA 3.0, Ulrich Apel and contributors).
- Kennin-ji 360 photograph by AsPJT (CC0, Wikimedia Commons); Chinese Garden, Ballroom and Historic Cloister Passage HDRIs (CC0, Poly Haven). English italic letters: original.
- Music: "Yoiyami Core Theme", "Oriental Somber", and "Asianoriental1" and "Asianoriental2" by Tozan (all CC0, OpenGameArt).
- Salamander Grand Piano samples by Alexander Holm (CC-BY 3.0).
- Textures from Poly Haven and ambientCG (CC0).
- WebXR Input Profiles generic hand (MIT).
- IWER point hand pose (MIT, Meta).
- Immersive Web SDK (MIT).

## Video (under 3:00): shot list
Record on the headset (Quest's built-in recorder, or MQDH casting on Windows) at a real desk in good light. The hands-first story must be clear in the first 30 seconds. Use real footage only, no AI-generated video.

| Time | Shot | On-screen text / voice-over |
|---|---|---|
| 0:00 to 0:08 | Close on your real desk. The paper unrolls; the ghost hand appears and writes 永 in vermilion | "What if a master's hands could sit at your desk?" |
| 0:08 to 0:20 | Your hand follows the ghost on the first stroke. **Lock-in: the hands merge and the ink turns gold, with a bell** | "Move with the master, and your hands become one." |
| 0:20 to 0:35 | Wide shot: a person seated, no controllers, writing with a fingertip on a real table | "Hands only. Any table. No controllers." |
| 0:35 to 1:05 | Onboarding: start, paper arrives, watch, touch the seal, the first stroke on 一 with the hover ring | "It teaches by showing, not telling." |
| 1:05 to 1:20 | **The room dissolves like ink into Kennin-ji's moss garden**; the desk stays under your hand | "Then go where the craft lives." |
| 1:20 to 1:35 | A mistake: a reversed stroke. "Other direction" hint, ink fades, try again, then gold | "Kind, precise corrections, stroke by stroke." |
| 1:35 to 1:55 | The full 永: five strokes, gold, the seal stamp | "Eight principles of the brush, in five strokes." |
| 1:55 to 2:25 | Switch to Piano: keyboard lands, the music room and grand appear, the master plays, you play Ode to Joy, gold notes float up | "The same apprenticeship, for any craft of the hand." |
| 2:25 to 2:45 | Progression and access: stars and streak, the ghost fainter on a mastered character, left hand, slow tempo, captions, Chinese | "As you improve, the master lets go." |
| 2:45 to 2:58 | Title card: Hands of a Master. Quest 3 / 3S, open in your browser | (URL) |

**Shortcuts for filming** (add to the URL on the headset; each one applies after the paper or keyboard lands):

| URL ending | Jumps to |
|---|---|
| `?state=fresh` | A first-time visitor (clears saved progress): film the onboarding |
| `?state=practice&lesson=6` | Writing 永 straight away (calibration skipped) |
| `?state=watch&lesson=6&scene=room` | The master writing 永 in your own room (no dissolve) |
| `?state=watch&lang=chinese` | Chinese calligraphy |
| `?state=watch&craft=piano&lesson=1` | The master plays Happy Birthday |
| `?state=practice&craft=piano&lesson=26` | Play Für Elise now |
| `?state=watch&lang=english&lesson=10` | The master writes an italic "a" with the broad nib |
| `?state=listen` | "Play your own tune" |

The dissolve starts right after placement. For the passthrough shots (0:00 to 1:05), press **Scene** on the menu to stay in your room, then press it again to film the dissolve.

## Screenshots to upload
Use `docs/media/` for now and replace them with headset captures later:
1. `02-real-table-watch.png`: the master writing on a real table (hero image).
2. `03-practice-gold-lock.png`: lock-in, gold ink.
3. `04-eternity-complete.png`: 永 finished in gold, seal stamped.
4. `01-browser-landing.png`: the landing page.

## Final checklist
- [ ] **Finishing touches** (see the skill's submission.md, "Finishing touches"): hero GIF of the gold lock-in at the top of the README and the Devpost description (from headset footage, or `artifacts/trailer/02-write-big.mp4` around 0:08–0:14); a soft shadow under the master's and your fingertip or tool tip; a slow-frame logger (`[hoam] perf ...`, `?perf=1`).
- [ ] `npm run build` passes; deploy `dist/` to Vercel (`npx vercel --prod`). `vercel.json` keeps `Permissions-Policy: xr-spatial-tracking=*`.
- [ ] On a Quest 3 (and 3S if available), test the **production URL** in Quest Browser, logged out or incognito:
  - Enter, then the paper lands on a real desk.
  - Watch, calibrate, write 一, lock-in, seal.
  - The room dissolves into the place, and back with Scene.
  - Piano: keyboard placement, every key presses (A3 to E5), a resting hand doesn't play, samples sound.
  - Happy Birthday first, then the white keys, sharps and flats lessons; "Play your own tune" and a MIDI file from the start page (Quest Browser's file picker).
  - "Next lesson" by poke.
  - Pinch-ray presses.
  - Left hand.
  - System menu pause and resume.
- [ ] Performance: a perf capture during practice holds 72 fps (60 minimum). See [TESTING.md](TESTING.md).
- [ ] Test in a second, different room (a different table shape, and with lights dimmed).
- [ ] Video under 3:00, public, real footage, hook in the first 30 seconds.
- [ ] Devpost: track, division, description, video, link, screenshots, credits.
- [ ] Submit before the deadline. Then **no redeploys** until winners are announced (about 11 Dec).
