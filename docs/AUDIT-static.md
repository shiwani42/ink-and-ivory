# Static audit: Ink and Ivory

- **When:** Wed 18 Nov 2026, about 21:45 IST (deadline 01:30 IST, so about 3 h 45 min left).
- **Scope:** read-only static audit. Nothing under `src/`, `public/` or `tools/` was changed. No emulator tests were run.
- **Code state:** `main` at `9e6480c`, plus uncommitted work in progress by another agent: `src/calligraphy-system.ts`, `src/env/environment.ts`, `src/progress.ts`, `public/ui/menu.uikitml`, `public/ui/welcome.uikitml`, new `src/env/own-pano.ts` (the "your own 360 background" feature).
  - Line numbers in `src/calligraphy-system.ts` refer to the file as it was during the audit and may drift.

**Severity key:**
- **BLOCKER:** fix before submitting.
- **TONIGHT:** worth fixing tonight; high value, low risk.
- **LATER:** after the deadline.

---

## 0. Blocker

### B1. The submitted URL is someone else's website (BLOCKER)
`https://hands-of-a-master.vercel.app` currently serves an **unrelated site**:
- the page title is "Ink and Ivory", with a navbar logo, "A Curated World of…", "Editor's Pick", "Best Seller", "Join Our Inner Circle", Font Awesome and Swiper;
- it sends **no `Permissions-Policy` header**;
- all of our files return 404: `ui/menu.uikitml`, `env/kenninji.jpg`, `audio/piano/C4.mp3`, `models/grand_piano.glb`.

Our app is actually live at **`https://hands-of-a-master.vercel.app`** (the Vercel project is `hands-of-a-master`, in `.vercel/project.json`):
- it returns 200 with `permissions-policy: xr-spatial-tracking=*`;
- every asset returns 200;
- its bundle `assets/index-Dh44vrJ4.js` matches the local build.

The `ink-and-ivory` subdomain appears to belong to another Vercel account. A `*.vercel.app` name that another project owns can't be re-aliased.

**Where the wrong URL appears:**
- `README.md:3`;
- `docs/DEVPOST.md:5`;
- the Devpost form, if it was pasted there;
- `docs/SUBMISSION.md:13` (a placeholder, `https://<project>.vercel.app`);
- the memory note.

**Fix:**
1. Run `npx vercel alias ls` / `npx vercel domains ls`.
2. Choose a name nobody owns, for example `npx vercel alias set <latest-deployment-url> ink-and-ivory-xr.vercel.app`, or keep `hands-of-a-master.vercel.app`.
3. Re-run `curl -I` and check for the `Permissions-Policy` header.
4. Update the three docs and the Devpost "Project link".
5. Open the new URL on the headset, logged out.

---

## 1. Build health

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** (exit 0) |
| `npm run build` | **PASS** (exit 0, 6.6 s, 2228 modules). Warnings: zod `@__PURE__` comments (harmless); chunks over 500 kB |
| `dist/` total | **27 MB** (assets 4.4 MB, audio 7.4 MB, env 12 MB, models 3.2 MB, textures 0.3 MB) |

### Bundle chunks (raw size; "wire" is what the live site actually sends, compressed)

| Chunk | Raw | Wire |
|---|---|---|
| `index-*.js` (app + IWSDK + three) | 2.81 MB | 809 kB |
| `merriweather-*.js` (MSDF font) | 507 kB | 354 kB |
| `msdf-worker-*.js` | 456 kB | 179 kB |
| `inter-*.js` (MSDF font) | 423 kB | 276 kB |
| `worker-*.js` | 202 kB | 66 kB |
| others (world-initializer, physics, workers) | about 120 kB | about 45 kB |
| **JS total** | **about 4.5 MB** | **about 1.73 MB** |

### Largest shipped files

| File | Size | When it loads |
|---|---|---|
| `audio/practice-yoiyami.mp3` | 2.87 MB | Japanese music, track 2 |
| `audio/practice-somber.mp3` | 1.96 MB | Japanese music, track 1 (first played) |
| `env/china_garden.hdr` / `.jpg` | 1.78 / 1.77 MB | Chinese place |
| `env/music_room.hdr`, `cloister.hdr`, `studio_1k.hdr` | 1.67 / 1.66 / 1.65 MB | IBL (image-based lighting) per place; `studio_1k` for "my room" |
| `env/kenninji.jpg` | 1.56 MB | **page load** (initial IBL, `calligraphy-system.ts` ~474) and the Japanese place |
| `audio/zh-asianoriental2.mp3` / `1.mp3` | 1.54 / 0.83 MB | Chinese music |
| `models/grand_piano.glb` | 1.07 MB | **page load** (`priority: 'critical'`, `src/assets.ts:27-36`) |
| `env/cloister.jpg`, `music_room.jpg` | 1.05 / 1.04 MB | English / piano place |
| `models/brush.glb`, `keyboard.glb`, `dip_pen.glb`, `paperweight.glb`, `tabletop.glb`, `pen_rest.glb` | 0.25 to 0.34 MB each | page load |
| piano samples (7 MP3s) | 0.48 MB | on entering XR (`calligraphy-system.ts` ~1255) |

### First visit: what downloads

**Before "Begin at my desk" is usable: about 6.8 MB.**
- 1.73 MB JS on the wire;
- 3.2 MB models (all 14 GLBs are marked critical, including the piano and keyboard);
- 1.56 MB `kenninji.jpg` as IBL;
- 0.3 MB textures;
- UI files.

**First calligraphy session: about 9 MB in total.**
- the 0.48 MB of piano samples;
- the first music track streaming (1.96 MB);
- the Kennin-ji panorama, which may be served from the HTTP cache.

**Visiting every place and every track** brings the total to about 27 MB.

**Note:** the "Production bundle" row in TESTING is stale: it says 3.8 MB dist and 2.46 MB / 676 kB gzip.

**LATER (performance):**
- Change `grand-piano` and `keyboard` to non-critical. That saves 1.4 MB before the first frame for calligraphy users.
- Halve the HDRs. 1k RGBE files at 1.6 MB each are large for IBL; 512 px would do.
- Don't load `kenninji.jpg` as IBL on the 2D page.

---

## 2. Licences and credits (rule 10)

### Inventory and where each item is credited
README = `README.md` "Credits" (lines 131-147); SUB = `docs/SUBMISSION.md` "Credits" (94-102); DEV = `docs/DEVPOST.md`; APP = `public/ui/menu.uikitml:106`.

| Asset (shipped) | Source / licence (verified where noted) | README | SUB | DEV | APP | Finding |
|---|---|---|---|---|---|---|
| `env/kenninji.jpg` (also the initial IBL) | Wikimedia Commons, AsPJT, CC0 | ✅ | ✅ | "Wikimedia Commons" | ❌ (APP says "Scenes…: Poly Haven") | APP credit line is inaccurate (TONIGHT, minor) |
| `env/china_garden.jpg/.hdr` | Poly Haven "Chinese Garden" by **Andreas Mischok**, CC0 (verified via the Poly Haven API) | ✅ (no author) | ✅ | ✅ | ✅ | Add author + URL as proof |
| `env/music_room.jpg/.hdr` | Poly Haven "Ballroom" by **Sergej Majboroda**, CC0 (verified) | ✅ | ✅ | ✅ | ✅ | File name differs from credit; add "music_room = Ballroom" |
| `env/cloister.jpg/.hdr` | Poly Haven "Historic Cloister Passage" by Elvis Posa, CC0 (verified) | ✅ | ✅ | ✅ | ✅ | OK |
| `env/studio_1k.hdr` (IBL in "my room" and own-photo modes: `calligraphy-system.ts` ~2377, ~782) | **Unknown.** The comment at ~456 says "studio HDRI (Poly Haven, CC0)", but no named asset | ❌ | ❌ | ❌ | (generic) | **Shipped but uncredited, no proof** (TONIGHT): identify the exact Poly Haven asset and credit it, or replace it with an HDR you can name |
| `models/*.glb` (12 models) | Own Blender script `tools/blender/build_assets.py`; baked textures Poly Haven "Bamboo Veneer" and "Black Walnut Veneer 01" by **Jenelle van Heerden**, CC0 (verified) | "Textures: Poly Haven and ambientCG" | same | ❌ | same | Name the two Poly Haven textures (TONIGHT) |
| `textures/paper_*.jpg`, `felt_*.jpg` | ambientCG, CC0 (`src/assets.ts:38`) | generic | generic | ❌ | generic | **Exact ambientCG asset IDs aren't recorded anywhere**; the files were renamed. Record the IDs (TONIGHT if known, else LATER) |
| `models/generic-hand-left/right.glb` | WebXR Input Profiles, MIT | ✅ | ✅ | ❌ | ✅ | MIT wants its notice kept with copies: add a `THIRD_PARTY_NOTICES` (LATER) |
| `src/ghost/point-pose.json` | IWER point pose, MIT, Meta | ✅ | ✅ | ❌ | ❌ | Same MIT note (LATER) |
| `audio/practice-somber.mp3` | "Oriental Somber" by **Tozan**, OpenGameArt node/155193, CC0 (verified) | ✅ (no author) | ✅ | ❌ | "Tozan" | Add author |
| `audio/practice-yoiyami.mp3` | "Yoiyami Core Theme – Deep Blue Ambient Piano" by **yoiyami**, CC0 (verified) | ✅ (no URL) | ✅ | ❌ | "Yoiyami" | Add URL |
| `audio/zh-asianoriental1/2.mp3` | "Asianoriental1/2" by Tozan, CC0 (verified) | ✅ | ✅ | ❌ | ✅ | Add URLs |
| `audio/piano/*.mp3` (7) | Salamander Grand Piano, Alexander Holm, **CC-BY 3.0** (via Tone.js) | ✅ | ✅ | ❌ | ✅ | **CC-BY needs the attribution wherever the work is presented.** It's in the app and README, but **missing from DEVPOST.md**. Also say they were re-encoded and pitch-shifted (CC-BY asks you to indicate changes) |
| `src/lessons/strokes.json`, `tools/kanjivg/*.svg` (76) | KanjiVG, Ulrich Apel and contributors, **CC BY-SA 3.0** (SVG headers keep the notice) | ✅ (+ states strokes.json is under the same licence) | ✅ | "KanjiVG" only, no licence | ✅ | **DEVPOST.md lacks the licence and author.** SA is otherwise met (README states the derivative's licence). No repo `LICENSE` file; add a line or notice in `tools/kanjivg/` (LATER) |
| English letters `tools/latin-letters.mjs` | Original | ✅ | ✅ | ✅ | ✅ | OK |
| Fonts: Inter, Merriweather (bundled MSDF chunks from `@pmndrs/uikit`) | Both SIL OFL 1.1 | ❌ | ❌ | ❌ | ❌ | Not credited. OFL only needs its licence kept with the font, which the npm package does; one credit line is good practice (LATER) |
| `public/scenes/main.iwsdk.scene.json`, UI panels | Own | n/a | | | | OK |

**Melodies** (`src/piano/songs.ts:46-128`; 26 songs + Today's echo + user tunes):
- **All public domain.** No doubtful ones.
  - Traditional: Hot Cross Buns, Au clair de la lune, Twinkle, Frère Jacques, London Bridge, When the Saints, Auld Lang Syne, Sakura.
  - 19th century or earlier: Mary Had a Little Lamb (Lowell Mason, 1830s), Jingle Bells (1857), Ode to Joy (1824), Für Elise (1810).
  - Happy Birthday: the melody ("Good Morning to All", 1893) has been PD for a long time; the 2015 US ruling (Marya v. Warner/Chappell) and EU expiry in 2017 cover the song. Only the melody is used, with no lyrics.
- The drills are original.
- The comment at `songs.ts:50` is accurate.

**Images: people and brands** (I looked at all four panoramas):
- No people in any of them.
- **Cloister:**
  - German signs on the door ("Bitte die Kirchentür zumachen!", "Vorsicht Stufe");
  - a parish logo plaque;
  - a memorial plaque listing names.

  `calm: 1` (mip bias 3.2) blurs these past legibility. LATER, low risk.
- **Music room** (`calm: 0`, crisp):
  - a white grand with a small maker's mark on the fallboard (about 30 px wide in the 4096 px source, illegible in the headset);
  - wall speakers;
  - paintings.

  LATER: if anyone worries, set `calm` to about 0.3 for `music` in `src/env/environment.ts:83`.
- The Kennin-ji scroll is calligraphy, which suits the theme.

---

## 3. Rule compliance

| Rule | Status | Evidence / issue |
|---|---|---|
| Hands-first, completable without controllers | ✅ | Everything is poke, pinch-ray or thumbs-up. With controllers held, a card says "Put your controllers down" (`controllersInUse`, `calligraphy-system.ts` ~2872). `iwsdk.config.json` turns on `handTracking`. MIDI, the share link and the own background are optional, on the 2D page |
| No logos, brands or identifiable people | ✅ (app) / ⚠ (URL) | Own models; the grand piano has no maker's name. See the panorama notes above. **The current submitted URL shows another site's logo and branding (B1)** |
| English throughout | ✅ | All UI, captions and hints are in English. CJK appears only as lesson content (ink on paper), romanised. Song titles in French/German are proper names. Cloister signage is blurred |
| Hosted URL works, `Permissions-Policy: xr-spatial-tracking` | ❌ **B1** for `hands-of-a-master.vercel.app`; ✅ for `hands-of-a-master.vercel.app` | `vercel.json:6-12` sets the header correctly |
| Original, not a wrapper | ✅ | Scoring, choreography and audio all run locally |

---

## 4. Code quality

### 4a. TODO / FIXME / console
- No TODO, FIXME, XXX or HACK in `src/`.
- `console.*` calls:
  - `calligraphy-system.ts:379`: `console.info` behind `import.meta.env.DEV`. OK.
  - `calligraphy-system.ts:564`: `console.error('[hands-of-a-master] panel load failed')`, not gated. Fine to ship, but uses the old name.
  - `src/env/environment.ts:181`: `console.warn('[hands-of-a-master] panorama failed…')`, not gated. Same.
  - `calligraphy-system.ts` ~763: `console.warn('[hoam] own background failed')` in the new own-pano code. Same.
- **LATER:** rename the prefixes to `[ink-and-ivory]`.

### 4b. Debug code in production
All dev aids are gated by `import.meta.env.DEV`:
- the Shift+R / P / M / L keys (~417);
- the `hoam-preset` sessionStorage shortcut (`devPresetQuery`, ~172);
- `logLayout` (~395), `logPlanes`, the pose and render-stat logs (~1850);
- `logPianoLayout`.

The production bundle contains no `[hoam]` strings.

**Ungated but harmless:**
- `this.log(\`...\`)` template strings are still *built* in production before `log()` checks DEV. For example:
  - thumbs-up confidence (~2973, every 0.5 s while live);
  - poke hover (~991);
  - piano notes (~2685).

  This is a tiny cost. LATER: guard the call sites, or pass a lambda.
- `?state=` presets (`src/presets.ts`) are deliberately available in production for filming. Unknown values are ignored. OK.

### 4c. Per-frame allocations (the IWSDK rule)
`update()` itself is clean: Float32Array joint buffers are preallocated, `jointSpaces` caches `Array.from(hand.values())`, and temporary vectors are reused. The exceptions:

| Where | What | Severity |
|---|---|---|
| `src/piano/piano-mode.ts:335` | `let event: PianoEvent = { type: 'none' };`: **one object every frame** in piano mode | TONIGHT (1 line): module-level `const NONE: PianoEvent = { type: 'none' };` then `let event: PianoEvent = NONE;` |
| `src/calligraphy-system.ts:2782` (`readAllTips`) | `[4, 9, 14, 19, 24].forEach((j, f) => {...})`: **a new array and closure per hand every frame** in piano mode | TONIGHT: module `const FINGER_TIPS = [4, 9, 14, 19, 24] as const;` and a plain `for (let f = 0; f < 5; f++) { const j = FINGER_TIPS[f]; ... }` |
| `src/calligraphy-system.ts:2823` (`updateHanko`) | `const lerp = (...) => ...` closure per frame, only during the 1-2 s seal animation | LATER (move it to a module function) |
| `for (const source of session.inputSources)` (~2771, ~2955, ~2875) | iterator object per frame | LATER (index loop) |
| `stepChoreo` ~1808, `penDownStart` ~2262 | `new InkRibbon(...)` per stroke (a geometry allocation on an event, not per frame) | LATER. The docs' claim "preallocated ribbon geometry" is true per ribbon, not across strokes |
| `src/piano/notation.ts` `drawSheet` | redraws the canvas texture per played note (event) | OK |

### 4d. Error handling

**localStorage:** every read and write is in try/catch:
- `progress.ts:46-73`;
- `desk-memory.ts:42-58`, `137-150`;
- `custom-song.ts:23-55`.

JSON shape checks are light: `loadProgress` only checks `lessons` and `streak`, so a corrupted `daily` field could throw later. LATER.

**IndexedDB** (`own-pano.ts`, new):
- open, get and put are guarded.
- No `onblocked` handler, and the DB is never closed. LATER.
- `makeOwnPano` relies on its caller's try/catch (`addPano` ~740 has one). OK.

**fetch / audio:**
- `sfx.loadPiano` (`sfx.ts:169`): no `res.ok` check. But `vercel.json`'s SPA rewrite turns a missing file into `index.html` (200), so `decodeAudioData` throws, the error is caught, and play falls back to a synth tone. OK.
- `startMusic` and `unlock` are in try/catch.
- The music `<audio>` element has no `error` listener: a failed track silently ends the playlist. LATER.

**MIDI import** (TONIGHT, small):
- `calligraphy-system.ts:806` `addMidi` has no try/catch. A truncated file makes `DataView.getUint16/32` throw `RangeError`, which becomes an unhandled rejection, and the page says nothing.
- `custom-song.ts:195` `const end = p + 8 + b.getUint32(p + 4);` isn't clamped to the file length. A corrupt header (length 0xFFFFFFFF) makes the parse loop run billions of iterations and **freezes the tab**.
- `custom-song.ts:187`: `division === 0` gives `NaN` beats.
- **Fix:**
  - `const end = Math.min(u8.length, p + 8 + b.getUint32(p + 4));`
  - `if (!division) return 'That MIDI file has no timing.';`
  - wrap the body of `addMidi` in try/catch with "That MIDI file could not be read.".

**Panoramas:** `environment.ts:177-183` catches load errors. **Textures are never disposed**, so the AssetManager cache keeps every place visited (about 45 MB of GPU memory each at 4096x2048 with mips). Each own-photo upload adds another (`pano-own-N`). LATER: dispose the previous texture after the dissolve.

---

## 5. Accessibility and comfort

### Text size
Computed from panel scale × font size; distances come from `layoutPanels` (`calligraphy-system.ts:1018-1046`):
- Menu: `MENU_SCALE = 0.056`, so 1 unit = 0.55 mm, at about 0.6 m from the eyes.
- Caption: `CAPTION_SCALE = 0.085`, so 1 unit = 0.85 mm, at about 0.9 m.

| Panel / text | Units | Height | Visual angle | With "Larger text" (×1.25) |
|---|---|---|---|---|
| Caption body | 25 | 21 mm | **1.34°** | 1.7° |
| Caption title | 38 | 32 mm | 2.1° | |
| Caption eyebrow | 17 | 14 mm | 0.92° | 1.15° |
| Status card body (0.075 at 0.85 m) | 25 | 19 mm | 1.26° | |
| Menu primary / craft labels | 19-20 | 11 mm | 1.0° | 1.3° |
| Menu button labels / meta | 17 | 9.4 mm | 0.89° | 1.1° |
| Menu tile names | 16 | 8.9 mm | 0.84° | 1.05° |
| Menu tile "best", eyebrow | 14 | 7.7 mm | 0.73° | 0.9° |
| Menu "UNIT 1 OF 9" | 12 | 6.6 mm | 0.63° | 0.8° |
| **Menu credits** | **11** | **6.1 mm** | **0.57°** | 0.72° |

**Assessment:**
- The caption panels meet the project's own target, from Meta's text guidance: body text at about 1° or more, medium or bold weights.
- The menu's secondary text (12-14 units) and the credits (11) are below that. They're readable up close, but small.
- **TONIGHT** (`public/ui/menu.uikitml:44`): credits `font-size: 12px; color: #6f6255`.
- LATER: `.unit-count` to 13.

### Contrast (WCAG ratio, computed)
- Ink on cream 15.1:1.
- Caption body 10.5:1.
- Menu meta 6.5:1.
- Vermilion eyebrow 6.2:1.
- Gold "best" 5.3:1.
- Cream on dark buttons 15.1:1.
- Hover and press states 6.9 to 11.8:1.
- **Exception: credits `#85776a` on `#f4ede0` = 3.7:1.** That fails 4.5:1 at the smallest size. `#6f6255` gives 5.1:1 (TONIGHT, same line as above).

### Targets
- Buttons are 76 units, which is **42 mm** (`calligraphy-system.ts:129` comment); tiles are 84 units (46 mm).
- That's well above Meta's guidance of about 22 mm or more for direct touch.
- Docs disagree: JUDGING:75 says "2.6 cm"; `menu.uikitml:5` says "47 mm".

### Seated reach
- The menu sits 0.39 m to the off-hand side, 0.2 m above the desk, angled to the eyes. Its centre is about 0.45 m from the shoulder on that side, which is within reach.
- **But the menu is tall:** about 1200 units, which is about **67 cm** (about 84 cm with Larger text).
- If the panel is centred at +0.2 m, its bottom rows ("Larger text / Music", "Write with", "Scene / Move paper here", credits) may sit at or below the table top.
- In the emulator shot `artifacts/e2e-01-watch.png`, the lower part runs off the bottom of the view.
- **Verify on the headset tonight** (TONIGHT, check only). If it's clipped, lift the menu (`+0.1` m y at ~1032), or drop the credits and divider.

### Options
| Option | Present | Notes |
|---|---|---|
| Tempo | ✅ 30 to 100% (`setTempo` ~1657) | At the piano the effective tempo is `max(0.5, tempo + 0.2)` (~2599), so "Tempo 30%" plays at 50%. Fine, but the docs say 30% |
| Larger text | ✅ ×1.25 (~1059) | |
| Left hand | ✅ auto-detected; the ghost and menu mirror | |
| Guide modes | ✅ adaptive / always / off | |
| Captions for everything | ✅ | |
| Music on/off | ✅ | |
| Break reminder | ✅ after 25 min (~2156) | |
| One hand | ✅ | |

**Comfort:**
- Seated, no locomotion.
- Body-locked status card (Follower, `maxAngle 25°`), never head-locked.
- The panorama follows head position only (no parallax), which is the standard approach for 360 photos.
- Requests 72 Hz, foveation 0.4.
- No real-time shadows: `scene.json` has `castShadow: true` on the key light but `environment.shadows: false`.

---

## 6. Docs and submission consistency

**Facts checked against the code:**
- Calligraphy: **75** Japanese (9 units), **50** Chinese (6), **32** English (6), so **157** lessons.
- Piano: **26 songs** in 5 units, plus Today's echo and up to 6 tunes.
- Total: 183, so "about 180" is right.
- DEVPOST's "about 160" refers to calligraphy only, which is also right.
- Lock distance 2.4 cm.
- Calligraphy contact: down 12 mm, up 24 mm. Piano contact: down 12 mm, up 19 mm.

| # | Where | Stale or inconsistent claim | Fix | Sev |
|---|---|---|---|---|
| 1 | README:3, DEVPOST:5, SUBMISSION:13 | URL `hands-of-a-master.vercel.app` (someone else's site) / placeholder `<project>` | the URL that works (B1) | **BLOCKER** |
| 2 | README, DEVPOST, SUBMISSION | The repo `github.com/shiwani42/ink-and-ivory` (public, 200) **is not mentioned in any doc** | add "Code: https://github.com/shiwani42/ink-and-ivory" to DEVPOST and the README top | TONIGHT |
| 3 | `docs/DEVPOST.md` (whole file) | **No Credits section**, although this is the text to paste. CC-BY (Salamander) and CC BY-SA (KanjiVG) attribution are missing from the submission text | copy SUBMISSION:94-102 (with the additions in section 2) to the end of DEVPOST.md | TONIGHT |
| 4 | `docs/media/01-04*.png`, used in README:18-23 and SUBMISSION:118-123 as Devpost screenshots | They show the **old name "Hands of a Master" / "HANDS OF A MASTER"**, the old dark UI, "Start at my desk", and the emulator's "Remote Control Active" badge | replace with headset captures, or fresh emulator shots of the current UI (crop out the badge) | TONIGHT |
| 5 | README:22 | "It has not yet been run on a physical headset". Contradicts TESTING:154 (Yosun's Quest 3S feedback), DEVPOST ("tested … by one headset tester") and SUBMISSION:68 | "Checked on a Quest 3S by one tester; full on-device pass pending" | TONIGHT |
| 6 | JUDGING:24 | "Hosted URL ⚠ to do" | update after B1 | TONIGHT |
| 7 | JUDGING:76 | "light text on dark panels". **Wrong:** the panels are dark ink on cream (15:1) | "dark ink on cream panels, 15:1 contrast" | TONIGHT |
| 8 | JUDGING:75; `menu.uikitml:5` | Hit targets "2.6 cm" / "47 mm"; the code gives 42 mm | "about 4.2 cm" | TONIGHT |
| 9 | JUDGING:10 | "built entirely in … 16 to 17 Nov"; commits run to 18 Nov | "16 to 18 Nov" | TONIGHT |
| 10 | JUDGING:19 | "all 6 calligraphy lessons and all 4 piano songs": the old course size | "the e2e runs 6 lessons, 8 songs, your tune, chords, rooms…" | LATER |
| 11 | JUDGING:108 | Piano: "the lowest extended fingertip … presses it": superseded by chords (`piano-mode.ts:287`) | "every extended fingertip plays its own key; non-lowest fingers must clearly touch" | LATER |
| 12 | JUDGING:23 | "No third-party service at all". IWSDK input visuals fetch profiles and meshes from `cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0` (`@iwsdk/xr-input/dist/gamepad/input-profiles.js`), at least for controllers | "no third-party *service*; hand and controller meshes from the WebXR profiles CDN" | LATER |
| 13 | TESTING:90 | Production bundle 3.8 MB / 2.46 MB / 676 kB | 27 MB dist (most of it places and music, loaded on demand); main JS 2.81 MB / 809 kB on the wire | LATER |
| 14 | README:74 | Menu item "Move paper in front of me"; the actual label is "Move paper here" / "Scan my room" | rename | LATER |
| 15 | README:16, DEVPOST "What it does", SUBMISSION "You travel there", JUDGING Criterion 2 | "Then your room dissolves into the place". The in-progress change sets the default to "Scene: my room" (`menu.uikitml:103`, `progress.scene`) and adds "your photo". **If that ships, update all four** | match the shipped default | TONIGHT if it ships |
| 16 | README:104, `docs/INTEGRATION-*.md`, `docs/META-XR-RESOURCES.md` (about 25 mentions) | "HOAM" (old name) | replace with "Ink and Ivory" | LATER |
| 17 | README:147; JUDGING:6 | Links to `../meta-vr-start-2026-kit/...`, which is outside the public repo, so the links are broken | remove, or point to a public copy | LATER |
| 18 | README:134 | "Chinese Garden and Ballroom HDRIs": file names `china_garden`, `music_room`; `studio_1k` missing | see section 2 | TONIGHT (with the credits) |
| 19 | SUBMISSION:3 vs DEVPOST:3 | Two different taglines | pick one | LATER |
| 20 | SUBMISSION:91 | "an optional real pen with a stylus-tracking fallback" as *next*. Real pen is already in beta | reword | LATER |
| 21 | SUBMISSION:143; TESTING:32 | `[hoam]` log prefix, `?perf=1` slow-frame logger. No `?perf` exists in `src/` | drop it from the checklist, or note it as not done | LATER |
| 22 | `index.html:11` | meta description "Mixed reality calligraphy…" leaves out the piano | "Learn calligraphy and piano from a master's hand on your real desk. Hands only, for Meta Quest." | TONIGHT |
| 23 | README:28 | "Start at my desk" (step 1); the button says "Begin at my desk" | rename | LATER |
| 24 | README song list | "Mary Had a Little Lamb"; the app shows "Mary Had a Lamb" (`songs.ts:56`) | either | LATER |

Product name "Ink and Ivory" is consistent in package.json (`ink-and-ivory`), `index.html` title, the panels and all user-facing docs. The old name survives in:
- the console prefixes;
- the localStorage keys (`hands-of-a-master.v1`, `hoam-*`), which is fine: renaming them would wipe saved progress;
- the Vercel project name;
- the folder name;
- the INTEGRATION docs.

---

## 7. Security and privacy

### Secrets
- `git log --all -p` scanned for Vercel OIDC tokens, JWTs (`eyJ…`), GitHub, OpenAI and Anthropic keys, AWS, Slack, Google API keys and private keys: **nothing found**.
- Nothing like `.env`, `.vercel` or `mcp.json` was ever committed.
- `.env.local` (holds a `VERCEL_OIDC_TOKEN`) is ignored by `.gitignore:54` (`.env*`) and isn't tracked.
- No personal emails or local absolute paths in tracked files.

### Stored locally (this browser only)

**localStorage:**
- `hands-of-a-master.v1`: progress, settings, streak, scene choice.
- `hoam-desk-spot`: desk pose relative to an anchor.
- `iwsdk_scene_anchor_uuid`: IWSDK's persistent anchor handle.
- `hoam-tunes-v1` / `hoam-custom-song-v1`: tunes.

**sessionStorage:**
- `hoam-preset`: dev builds only.

**IndexedDB:**
- `ink-and-ivory` / `files` / `own-pano`: the learner's own background photo, as a 4096x2048 JPEG.
- This is new and uncommitted. The photo never leaves the device.
- Worth one line in the README: "Your photo stays in this browser."

Nothing is sent to any server. There are no analytics, no accounts, no microphone and no camera.

### Tune share links (`src/piano/custom-song.ts:85-121`)
**`decodeTune` is robust:**
- `tuneCodeFromUrl` only accepts `[A-Za-z0-9_-]`.
- Parsing is in try/catch.
- At most 40 notes.
- Each note must match `^[A-G]s?\d$` and fall within A3 to E5. `Bs`/`Es` give NaN and are rejected.
- Beats are clamped to 0.25 to 3; bpm to 40 to 140.
- The name is stripped to printable Latin-1 and capped at 18 characters.
- It's rendered as UIKit text, not as DOM, so there's no injection path.

**Two caveats (LATER):**
- Opening a link **saves** the tune at once (`addTune` in `init`, ~452). With 6 tunes already saved, a link silently evicts the learner's oldest tune.
- There's no length cap before `atob`. URL length bounds it, so this is harmless.

**MIDI parsing:** the freeze and the unhandled error from section 4d. The input is a local file the user chose, so this is robustness, not security.

### Third-party requests at runtime
- **Possible: `cdn.jsdelivr.net`** (WebXR input-profile meshes, through IWSDK's input visuals). It's certain when controllers appear. It's unclear for hands, because the app ships its own copy of the generic hand. **Check in a headset network capture.**
- **Unused but present in the bundle:**
  - an `unpkg.com/three@0.185.0` Draco decoder URL (none of our GLBs uses Draco);
  - `api.dicebear.com` (the UIKit Horizon avatar default; not used).
- Fonts are bundled, with no Google Fonts.

---

## Fix tonight (highest value, lowest risk)

1. **Fix the URL (B1).**
   - Point the submission at a URL that serves this app: `https://hands-of-a-master.vercel.app` works now. Or alias a free name with `npx vercel alias set <deployment> ink-and-ivory-xr.vercel.app` (any name nobody owns).
   - Then update `README.md:3`, `docs/DEVPOST.md:5`, `docs/SUBMISSION.md:13` and the Devpost "Project link".
   - Confirm with `curl -sI <url> | grep -i permissions-policy`.
   - Open it on the headset, logged out.
2. **Credits in the Devpost text.** Append a "Credits" section to `docs/DEVPOST.md` (copy `docs/SUBMISSION.md:94-102`). It must include:
   - "Salamander Grand Piano samples by Alexander Holm, CC-BY 3.0 (re-encoded, pitch-shifted)";
   - "KanjiVG © Ulrich Apel and contributors, CC BY-SA 3.0; derived stroke data under the same licence".
   - Also add `Code: https://github.com/shiwani42/ink-and-ivory`.
3. **Name every shipped asset, with proof.** In `README.md:131-147` (and the DEVPOST credits):
   - Chinese Garden (Andreas Mischok), Ballroom = "music room" (Sergej Majboroda), Historic Cloister Passage (Elvis Posa), Bamboo Veneer and Black Walnut Veneer 01 (Jenelle van Heerden), all Poly Haven CC0;
   - "Oriental Somber" and "Asianoriental1/2" by Tozan, "Yoiyami Core Theme" by yoiyami, all OpenGameArt CC0, with URLs;
   - **identify `env/studio_1k.hdr`** and credit it. If you can't, stop shipping it: use `scene.light` / `env/kenninji.jpg` for the room IBL at `calligraphy-system.ts` ~2377 and ~782. That's the other agent's file, so coordinate.
   - Record the ambientCG IDs for paper and felt if known.
4. **Replace the screenshots** in `docs/media/` (README and Devpost). They show the old name "Hands of a Master" and the emulator's "Remote Control Active" badge.
5. **Stale doc lines:**
   - `README.md:22`: one Quest 3S tester checked it;
   - `docs/JUDGING.md:76`: dark ink on cream panels;
   - `docs/JUDGING.md:75`: targets about 4.2 cm;
   - `docs/JUDGING.md:10`: 16 to 18 Nov;
   - `docs/JUDGING.md:24`: hosted URL done;
   - `index.html:11`: description mentions piano.
   - If the "my room by default" change ships, also fix README:16 and the "dissolves into the place" lines in DEVPOST, SUBMISSION and JUDGING.
6. **MIDI robustness** (3 lines, no behaviour change for valid files):
   - `src/piano/custom-song.ts:195`: `const end = Math.min(u8.length, p + 8 + b.getUint32(p + 4));`
   - after line 187: `if (!division) return 'That MIDI file has no timing.';`
   - `src/calligraphy-system.ts:805-811`: wrap the body of `addMidi` in `try { … } catch { this.text(this.welcome, 'midi-note', 'That MIDI file could not be read.'); }`
7. **Per-frame allocations in the piano** (2 small edits, coordinate with the agent editing `src/`):
   - `src/piano/piano-mode.ts:335`: return a module-level `NONE` event instead of `{ type: 'none' }`;
   - `src/calligraphy-system.ts:2782`: a module `const FINGER_TIPS = [4, 9, 14, 19, 24]` and an index `for` loop in place of the array literal and `.forEach` closure.
8. **Credits line contrast and size:** `public/ui/menu.uikitml:44`, `.credits`: `color: #6f6255` (5.1:1, was 3.7:1), `font-size: 12px; line-height: 16px`. In `menu.uikitml:106`, change "Scenes, light and textures: Poly Haven, ambientCG" to "Places: Wikimedia Commons (AsPJT), Poly Haven. Textures: Poly Haven, ambientCG".
9. **Headset check (no code):**
   - confirm the bottom rows of the menu (Scene, Move paper here, Write with) are above the table and reachable, with normal and Larger text;
   - in a network capture, see whether hands trigger requests to `cdn.jsdelivr.net`.

**Verdict:** the code is in good shape (typecheck and build pass; no secrets, dev code gated, link input validated). The submission isn't ready: **the submitted URL shows a stranger's website**, and the Devpost text is missing the required CC-BY and CC BY-SA credits.
