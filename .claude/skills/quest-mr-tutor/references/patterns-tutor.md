# Tutor patterns (IWSDK 1.1.0, Quest Browser)

Taken from the reference tutor's `src/` and verified in the IWSDK emulator. They run inside a `createSystem` with preallocated fields (`this.v`, `this.m`, …); never allocate in `update()`. Import three.js types from `@iwsdk/core`.

## 1. Touching a real surface (hand tracking has no haptics)
- **One-touch calibration:** ask the user to rest a fingertip on a target on the surface for 0.35 s at low speed. `offset = tipY - 0.0085` (8.5 mm is the joint centre above the skin).
- **Contact hysteresis:** contact starts when `h < 12 mm`, ends when `h > 24 mm`. Also end it when `h < -12 cm` or the tip leaves the area.
- **Require a lift** before the first action after calibration and after each action.
- **Discard silently:** contacts under 0.2 s, and contacts whose tip plunges below −5 cm within the first 0.25 s (hands passing through on the way to the lap).
- **Hover cursor:** a ring under the fingertip that shrinks and darkens as `h → 0`, hidden during contact.

## 2. Skinned translucent "ghost" hand
- **Model:** `https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/{left,right}.glb` (MIT). Vendor into `public/models/`, register with `priority: 'critical'`. It has 25 **flat** bones named after the WebXR joints, under `Armature`.
- **Drive it:** `bone.matrix = inverse(armature.matrixWorld) × jointWorld`, then decompose.
- **Materials:** clone the SkinnedMesh. Original: `MeshBasicMaterial({ colorWrite:false, depthWrite:true, transparent:true })`, `renderOrder 20` (depth pre-pass). Clone: a Fresnel `ShaderMaterial` (`transparent`, `depthWrite:false`), `renderOrder 21`, with the skinning chunks `skinning_pars_vertex`, `skinbase_vertex`, `beginnormal_vertex`, `skinnormal_vertex`, `defaultnormal_vertex`, `begin_vertex`, `skinning_vertex`. Alpha `opacity * (0.3 + 0.7 * rim)`, `rim = pow(1 - |n·v|, 2.2)`.
- An additive sprite glow at the index tip (joint 9) keeps the "brush" findable.
- **Lock-in on success:** per joint, lerp positions and slerp quaternions between the ghost and the user's `fillPoses` matrices.

## 3. Procedural hand poses from IWER
- IWER ships poses in `node_modules/iwer/lib/device/configs/hand/{point,pinch,relaxed}.js` (MIT): 25 `offsetMatrix` entries of **left-hand** data.
- **Right hand:** element-wise multiply by `[1,-1,-1,0, -1,1,1,0, -1,1,1,0, -1,1,1,1]`.
- Extract at build time into JSON (e.g. `tools/build-data.mjs`).
- **Orient:** basis from the pose (finger `f` = tip − proximal; back of hand `d` = wrist Y column orthogonalised to `f`); target basis (F, D); `Q = basis(F, D, F×D) · basis(f, d, f×d)ᵀ`; translate so `Q·tip` lands on the target.
- A hand pointing straight down reads end-on from the user's eyes. Bring it in from the user's side (right hand: `F ≈ (−0.5, −0.5, −0.7)` in surface-local space).

## 4. Ribbons (ink, trails, paths)
- Preallocate ~700 points × 2 vertices; rebuild only the last two vertices per point; `setDrawRange`.
- Width from speed (slow = wide), tapered at entry and exit.
- `alphaMap`: a canvas of dry-brush streaks, `u` = arc length × 9.
- `MeshBasicMaterial({ transparent, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, toneMapped:false })`.
- Stack successive strokes a few hundredths of a millimetre apart in height.

## 5. Pressing keys with tracked fingertips (piano-style)
- Per hand, consider only **extended** fingers (tip more than 6 cm from its own base joint; the thumb needs 4.5 cm and must not be tucked against the hand); the **lowest** extended tip over a key presses it. Resting or curled fingers never play.
- Hysteresis: down at 12 mm above the key top, up at 19 mm; 120 ms debounce per key.
- Samples: one every minor third, `playbackRate = 2^(semitones/12)` (core audio.md).
- Show the music: a sheet on the instrument (current note highlighted, played notes inked), letters on keys, notes floating up from pressed keys.

## 6. The user's own content
- **Perform it:** in a `listen` phase reuse the same press detector; push `{midi, t}` per press and let the master's hand follow the last key. End after 3 s of quiet with ≥3 notes, or at 40 notes. Beat = median gap (clamped 0.3–1.2 s); each note's beats = gap / beat rounded to 0.5 (0.5–3); last note 2 beats; bpm = 60 / beat. Play it back in watch mode and teach it like any song. Reference: `hands-of-a-master/src/piano/custom-song.ts` (`songFromRecording`).
- **Import a MIDI file** on the 2D start page: a UIKit button clicks a hidden `<input type="file" accept=".mid,.midi">` (the panel click counts as the user gesture), plus `dragover`/`drop` on `window`; remove both in `cleanupFuncs`. Parser (~100 lines, no dependency): SMF format 0/1, ticks per quarter (reject SMPTE), running status, first tempo meta, skip channel 10 and velocity-0 note-ons, skyline (highest note per onset within division/16 ticks), fit into range by whole octaves then fold, cap at 40 notes, durations in quarter beats rounded to 0.25.
- **Storage:** localStorage under a versioned key, try/catch; reset that slot's score when its content changes; show its name on the last tile.
- **Unit test** the parser with a MIDI written by a few lines of Python (header, tempo track, chords, a drum note, running status), bundled with esbuild and run in node.

## Several fingers and chords (piano-style keys)
- **Each extended fingertip presses its own key.** A finger that isn't its hand's lowest must clearly touch (about 60% of the press height), so a neighbour dipping as the hand lands stays silent. Curled fingers never play. Reuse one preallocated `pressed` array per frame.
- **Scoring:** if any press is the expected key, count it and let the others just sound. Count at most one wrong note per press, so an extra finger never costs the learner.
- **Perform-to-teach:** keep a chord's top note (taps within 80 ms merge; keep the higher MIDI), the same skyline rule as MIDI import.
- **Test:** an open hand, palm down, fingers forward, dropped onto the keys must sound at least 2 keys (`tools/e2e_chord.py`).

## Headset off and on
- Quest may blur the session (system menu, headset off briefly), so pause cleanly on `visible-blurred`.
- Or it may end the session (sleep), so after restarting, everything must work again: placement, calibration, writing and menu pokes.
- Test with `xr exit` then `xr enter` mid-journey (`tools/e2e_restart.py`).
- The emulator CLI can't drive the blurred state; ask a headset tester what they see: the 2D page, a frozen scene, or dead hands.
