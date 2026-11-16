# Submission pack: Hands of a Master

Everything needed for the Devpost entry.

- **Deadline:** Wed 18 Nov 2026, 12:00 PM PST (Thu 19 Nov, 1:30 AM IST).
- **No changes are allowed after the deadline,** so submit hours early.

## Form fields
- **Project name:** Hands of a Master
- **Tagline (under 200 characters):** Learn calligraphy inside a master's hands. A ghost hand writes beside yours on your real desk. Move in unison and your hands lock in gold. Hands only, Quest 3.
- **Track:** Productivity
- **Division:** New Experience
- **Project link:** the Vercel production URL (`https://<project>.vercel.app`). Paste the alias, not a hashed per-deploy URL.
- **Video:** a public YouTube or Vimeo link, under 3:00.
- **Built with:** Immersive Web SDK (IWSDK) 1.1.0, WebXR, three.js (super-three), TypeScript, Vite, Web Audio, KanjiVG stroke data, Vercel.

## Description (paste into Devpost)

### Inspiration
Calligraphy is learned by watching a master's hand, then copying it thousands of times. Video can't show you the hand's motion from your own point of view, and books can't correct you mid-stroke. Mixed reality can put the master's hand on your own desk, at your scale, moving where your hand should move. Research on "skill-adaptive ghost instructors" (CHI '26) found that a ghost hand that fades as you improve teaches better than one that is always there. It names calligraphy as a natural next domain. So we built it.

### What it does
- **The paper arrives.** Sit at any table and put on your Quest. A writing set unrolls onto your real desk: felt mat, washi paper with a practice grid, a paperweight and an inkstone.
- **Watch the master.** A translucent hand writes the character in vermilion ink.
- **Your turn, stroke by stroke.** The master waits at a glowing start point, then leads the stroke at your tempo. You follow with your index fingertip and touch the real desk to put ink down. A ring under your fingertip shows where the ink will land.
- **Lock-in.** Stay in step and the master's hand slides onto yours and turns gold, a bell rings, and your ink turns gold.
- **Feedback.** Each stroke is scored on path, direction, order, speed and sync, with a plain-language correction when it misses.
- **Completion.** Finish a character and the master's seal is stamped on your page.

There are six characters, ending with 永 ("eternity"), whose five strokes contain the Eight Principles of the brush. Your best scores and daily streak are saved. As your best score rises, the master's hand and the tracing guide fade: the master lets go.

Everything works with hands alone, one hand is enough, and left-handed writers are detected automatically. Tempo and guide strength are adjustable, and every instruction has a caption.

### How we built it
- **Stack:** the Immersive Web SDK (IWSDK) on WebXR, running in Meta Quest Browser.
- **Placement:** scene understanding finds horizontal table planes. We fit the writing set inside the table's outline, including round tables, face it toward you, and anchor it. If no table is found, it uses a virtual desk.
- **The master's hand:** the WebXR generic hand mesh with a Fresnel "spirit" shader. A small solver places a 25-joint pointing pose so its fingertip follows each stroke, leaning into the direction of travel.
- **Lock-in:** we blend the master's joints onto your tracked joints.
- **Strokes:** shapes and order come from KanjiVG and are converted to timed paths with a press-travel-settle profile.
- **Ink:** preallocated ribbons, with width driven by fingertip speed as a stand-in for brush pressure, and a dry-brush texture.
- **Fingertip tracking:** One Euro smoothing, touch detection with hysteresis, and a one-touch calibration on the seal.
- **Sound:** synthesized with Web Audio. There are no audio files.
- **Testing:** we wrote an automated test that drives the IWSDK emulator's hands through every lesson, including wrong strokes that must get the right hint.

### Challenges we ran into
- **Touch without haptics.** We used the real desk as the surface, calibrated per desk, and added a hover ring and a paper-scratch sound.
- **Accidental ink.** A hand dropping to your lap passes through the paper. We discard very short or plunging touches, and ignore hands resting below the desk.
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
- Lessons on stroke variation (the Eight Principles one by one), a review mode that overlays your best attempt, and an optional real pen with a stylus-tracking fallback.
- **Target launch:** a public web release in Q1 2027, and a Meta Horizon Store PWA after that.

### Credits
- KanjiVG stroke data (CC BY-SA 3.0, Ulrich Apel and contributors).
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
| 1:05 to 1:35 | A mistake: a reversed stroke. "Other direction" hint, ink fades, try again, then gold | "Kind, precise corrections, stroke by stroke." |
| 1:35 to 2:05 | Progression: menu with stars and streak; the ghost visibly fainter on a mastered character; tempo and guide controls | "As you improve, the master lets go." |
| 2:05 to 2:35 | The full 永: five strokes, gold, the seal stamp, "Eternity complete" | "Eight principles of the brush, in five strokes." |
| 2:35 to 2:50 | Accessibility montage: left hand, slow tempo, captions | "One hand, either hand, any pace." |
| 2:50 to 2:58 | Title card: Hands of a Master. Quest 3 / 3S, open in your browser | (URL) |

## Screenshots to upload
Use `docs/media/` for now and replace them with headset captures later:
1. `02-real-table-watch.png`: the master writing on a real table (hero image).
2. `03-practice-gold-lock.png`: lock-in, gold ink.
3. `04-eternity-complete.png`: 永 finished in gold, seal stamped.
4. `01-browser-landing.png`: the landing page.

## Final checklist
- [ ] `npm run build` passes; deploy `dist/` to Vercel (`npx vercel --prod`). `vercel.json` keeps `Permissions-Policy: xr-spatial-tracking=*`.
- [ ] On a Quest 3 (and 3S if available), test the **production URL** in Quest Browser, logged out or incognito:
  - Enter, then the paper lands on a real desk.
  - Watch, calibrate, write 一, lock-in, seal.
  - "Next lesson" by poke.
  - Pinch-ray presses.
  - Left hand.
  - System menu pause and resume.
- [ ] Performance: a perf capture during practice holds 72 fps (60 minimum). See [TESTING.md](TESTING.md).
- [ ] Test in a second, different room (a different table shape, and with lights dimmed).
- [ ] Video under 3:00, public, real footage, hook in the first 30 seconds.
- [ ] Devpost: track, division, description, video, link, screenshots, credits.
- [ ] Submit before the deadline. Then **no redeploys** until winners are announced (about 11 Dec).
