# Proven patterns (IWSDK 1.1.0, Quest Browser)

All snippets are taken from `hands-of-a-master/src/` and were verified in the IWSDK emulator. They assume they run inside a system (`createSystem`), with preallocated fields (`this.v`, `this.m`, …); never allocate in `update()`. Import Three.js types from `@iwsdk/core`, never from `three`.

## 1. Session tuning and clean pause
```ts
this.world.visibilityState.subscribe((state) => {
  if (state === VisibilityState.Visible) {
    (this.world.session as any)?.updateTargetFrameRate?.(72).catch(() => {});
    this.renderer.xr.setFoveation(0.4); // three.js defaults to 1.0 (max): too blurry for text
  }
});
// in update(): freeze game logic while the Quest system menu has focus
if (this.world.visibilityState.peek() === VisibilityState.VisibleBlurred) { /* end strokes, mute loops */ return; }
```

## 2. Code-owned UIKit panels (spatial UI)
```ts
// public/ui/menu.uikitml registered in src/assets.ts as AssetType.UIKitML 'menu-panel'
const panel = await this.world.assets.instantiate<UIKitMLAsset>('menu-panel');
panel.scale.setScalar(0.062);          // UIKit units are CENTIMETRES: 330 units * 0.062 = 20 cm wide
const e = this.world.createTransformEntity(panel, { parent: deskEntity, persistent: true });
e.addComponent(RayInteractable); e.addComponent(PokeInteractable);
panel.getElementById<UIKit.Text>('streak')?.setProperties({ text: 'Practised today' });
panel.getElementById('cap-actions')?.setProperties({ display: 'none' });
```
- Panels face +Z. Parent them to the object they control and angle them toward the user. Never head-lock them.
- Text elements inside a `<ButtonLabel><span id=…>` accept `setProperties({ text })`.
- Use ASCII only: no CJK glyphs and no Indic shaping in the default font.
- Buttons: Horizon `<Button>` gives about 2.6 cm hit height at scale 0.06–0.07, which meets the 2.2 cm guideline.

## 3. Fingertip poke for UIKit buttons (works where the built-in touch pointer did not)
```ts
interface PokeButton { id: string; el: Object3D; panel: Object3D; fn: () => void; depth: [number, number] }
// register: el = panel.getElementById(id); also el.addEventListener('click', () => this.trigger(id, fn))
// per frame, for each tracked hand (slot 0/1) and each visible button:
const e = b.el.matrixWorld.elements;            // maps the unit square onto the element's rectangle
const pe = b.panel.matrixWorld.elements;        // the panel's +Z is the press normal
this.n.set(pe[8], pe[9], pe[10]).normalize();
this.d.set(tip.x - e[12], tip.y - e[13], tip.z - e[14]);
const depth = this.d.dot(this.n);
this.axis.set(e[0], e[1], e[2]); const lx = this.d.dot(this.axis) / this.axis.lengthSq();
this.axis.set(e[4], e[5], e[6]); const ly = this.d.dot(this.axis) / this.axis.lengthSq();
const over = Math.abs(lx) <= 0.55 && Math.abs(ly) <= 0.6;
if (over && b.depth[slot] > 0.004 && depth <= 0.004 && depth > -0.03) this.trigger(b.id, b.fn);
b.depth[slot] = depth;
// trigger(): debounce per id (600 ms), play a click sound, then run fn. Ray, mouse and poke share it.
```

## 4. Hand joints, smoothing and picking the active hand
```ts
const frame = this.xrFrame, ref = this.renderer.xr.getReferenceSpace();
for (const source of this.renderer.xr.getSession()!.inputSources) {
  if (!source.hand) continue;
  const pose = frame.getJointPose!(source.hand.get('index-finger-tip')!, ref!);
  // world = pose position (× player.matrixWorld if the player moved); then into your object's local space
}
// all 25 joints at once (cast: fillPoses is missing from the TS types)
(frame as any).fillPoses(Array.from(source.hand.values()), ref, out /* Float32Array(25*16) */);
```
- Smooth with a One Euro filter per axis: `minCutoff 2`, `beta 20`, positions in metres.
- **Active hand selection:** the lowest hand over the work area wins, with three rules:
  - ignore hands more than 10 cm *below* the surface (lap under a virtual desk);
  - give the current hand a 2 cm bonus;
  - switch handedness-dependent layout only when a hand is actually at the work area.

## 5. Touching a real surface (hand tracking has no haptics)
- **One-touch calibration.** Ask the user to rest a fingertip on a target (a seal or button on the surface) for 0.35 s at low speed. Set `offset = tipY - 0.0085`; 8.5 mm is the joint centre above the skin.
- **Hysteresis:** contact starts when `h < 12 mm` and ends when `h > 24 mm`. Also end it when `h < -12 cm` or the tip leaves the area.
- **Require a lift** before the first action after calibration and after each action.
- **Discard silently:** contacts under 0.2 s, and contacts where the tip plunges below −5 cm within the first 0.25 s. Both are hands passing through on the way to the lap.
- **Hover cursor:** a ring under the fingertip that shrinks and darkens as `h → 0`, hidden while in contact.

## 6. Table placement with fallback and anchor
```ts
// planes: query { required: [XRPlane] }; plane = entity.getValue(XRPlane, '_plane') as XRPlane; obj = entity.object3D
if (plane.orientation !== 'horizontal' || ['floor','ceiling'].includes(plane.semanticLabel)) continue;
const y = obj.matrixWorld.elements[13]; if (y < head.y - 0.95 || y > head.y - 0.12) continue; // seated height
const local = obj.worldToLocal(target /* head + forward*0.4 at height y */);
// clamp into polygon AABB (minus half the footprint), then while(!footprintInside) slide 15% toward centroid
// score = horizontal distance to target − 0.3 if label is table/desk; reject if > 0.6 m
// yaw toward the user: Math.atan2(head.x - p.x, head.z - p.z)  (local +Z faces the user)
```
- Run the search every frame for up to 2.5 s; planes arrive late.
- If nothing qualifies, use a **virtual table**: head − 0.42 m, 0.38 m forward. Show a tabletop mesh and say so in the caption.
- After placing, `entity.addComponent(XRAnchor)`. IWSDK re-parents it under a stabilised anchor group (`attach`, so world pose is preserved).
- To move it later, compute the world matrix, premultiply by `inverse(parent.matrixWorld)`, then decompose.
- Point-in-polygon uses the plane-local `polygon[i].x/.z`.

## 7. Skinned translucent "ghost" hand
- **Model:** `https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/generic-hand/{left,right}.glb` (MIT). Vendor it into `public/models/` and register it in assets with `priority: 'critical'`.
  - It has 25 **flat** bones named after the WebXR joints, under `Armature`.
- **Drive it:** `bone.matrix = inverse(armature.matrixWorld) × jointWorld`, then decompose into position, quaternion and scale.
- **Materials:**
  - Clone the SkinnedMesh.
  - Original: `MeshBasicMaterial({ colorWrite:false, depthWrite:true, transparent:true })`, `renderOrder 20`.
  - Clone: a Fresnel `ShaderMaterial` (`transparent`, `depthWrite:false`), `renderOrder 21`.
  - Shader includes: `skinning_pars_vertex`, `skinbase_vertex`, `beginnormal_vertex`, `skinnormal_vertex`, `defaultnormal_vertex`, `begin_vertex`, `skinning_vertex`.
  - Alpha: `opacity * (0.3 + 0.7 * rim)` with `rim = pow(1 - |n·v|, 2.2)`.
  - Add an additive sprite glow at the index tip (joint 9) so the "brush" is always findable.
- **Blend onto the user's real hand** ("lock-in"): per joint, lerp positions and slerp quaternions between the ghost and the user's `fillPoses` matrices.

## 8. Procedural hand poses from IWER
- IWER ships poses in `node_modules/iwer/lib/device/configs/hand/{point,pinch,relaxed}.js` (MIT). Each is 25 `offsetMatrix` entries of **left-hand** data.
- **Right hand:** element-wise multiply by `[1,-1,-1,0, -1,1,1,0, -1,1,1,0, -1,1,1,1]`.
- Extract them at build time into JSON (`tools/build-data.mjs`).
- **Orient the pose:**
  1. Take the basis from the pose: finger direction `f` = tip − proximal; back of hand `d` = wrist Y column, made orthogonal to `f`.
  2. Build the target basis (F, D) and set `Q = basis(F, D, F×D) · basis(f, d, f×d)ᵀ`.
  3. Translate so `Q·tip` lands on the target.
- From the user's own eyes, a hand pointing straight down reads end-on. Bring it in from the user's side (for a right hand: `F ≈ (−0.5, −0.5, −0.7)` in surface-local space).

## 9. Ribbons (ink, trails, paths)
- Preallocate about 700 points × 2 vertices.
- Rebuild only the last two vertices per added point, and use `setDrawRange`.
- Width comes from speed (slow = wide), with a taper at the entry and exit.
- `alphaMap`: a canvas texture of dry-brush streaks, with `u` = arc length × 9.
- Material: `MeshBasicMaterial({ transparent, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, toneMapped:false })`.
- Stack successive strokes a few hundredths of a millimetre apart in height.

## 10. Sound without files (Web Audio)
- Create the `AudioContext` lazily and `resume()` it from a user gesture; entering XR counts.
- **Paper scratch:** looped white noise → bandpass (1.6–6 kHz, following speed) → gain following speed.
- **Bell:** a sine plus partials at 2.76× and 5.4×, with an exponential decay over about 1.6 s, walking a pentatonic scale per success.
- **Wood block for UI:** a 520 Hz triangle wave with a 0.09 s decay.
- **Thud:** 95 Hz plus low-passed noise.

## 11. Grounding and look on passthrough
- A felt or dark mat under light content, so it reads on any real table.
- A soft radial-gradient alpha disc as a contact shadow, with no shadow maps.
- `IBLGradient` intensity about 0.25; ACES tone mapping; one directional light.
- Arrival animation: scale the content in along its depth axis over 0.7 s.

## 12. Dev-only test hooks
```ts
if (import.meta.env.DEV) console.info(`[tag] layout ${JSON.stringify({ targets: worldPoints })}`);
// Shift+R: localStorage.clear(); location.reload();   (registered only in DEV)
// every 3 s in DEV: renderer.info.render.calls / .triangles
```

## 13. Immersive places from public 360-degree photos (one world at a time)
- **Sources, all CC0:** Poly Haven HDRIs (download the 4k tonemapped JPG for the backdrop and a 1k HDR for lighting), and Wikimedia Commons equirectangular photos (filter by license; check for people and brand signage). Commons rate-limits hard (HTTP 429): use `curl`, one request every 3 to 4 s, and fetch the `upload.wikimedia.org` thumbnail URL at 4096 px.
- **Backdrop:** an inside-out `SphereGeometry(40, 64, 32)`, `BackSide`, `depthWrite:false`, `renderOrder:-100`, `frustumCulled:false`, and move it to the head position every frame (no parallax, reads as infinitely far). Sample the texture yourself from the view direction so you can rotate it with a `uYaw` uniform.
- **Seam:** set `wrapS = RepeatWrapping`, mipmaps on, `LinearMipmapLinearFilter`; otherwise a vertical line shows where the photo wraps.
- **Keep it quiet behind the task ("calm"):** in the same fragment shader, `texture2D(map, uv, bias)` with a mip bias of about 3 (cheap blur), 50% desaturation, mix 30% toward a warm haze colour, dim about 8%. Users said a crisp busy photo was distracting; this fixed it. Choose the yaw so the user faces the calmest part of the photo.
- **Never mix passthrough and a place.** Users found the room plus a partial world confusing. Place content in passthrough (so it lands on the real table), then dissolve fully into the place, with a menu button back to the room.
- **Ink-bleed dissolve:** alpha = `smoothstep(n-0.05, n+0.05, t*1.25-0.12)` where `n` is two octaves of 3D value noise on the view direction and `t` goes 0 to 1 over about 2.4 s; add a dark rim where `abs(edge-n)` is small. When switching places, dissolve out, load, dissolve in, and guard with a load ticket so a fast double switch can't show the wrong place.
- **Keep the touch real:** when the place is showing, draw a virtual tabletop at the real table's plane so the user's fingers still land on the real surface.
- **Music per place:** OpenGameArt filtered by CC0; re-encode to 96 kbps MP3 with `ffmpeg -af afade=t=in:d=2`. Mute music where the user makes the sound (piano).

## 14. Pressing keys with tracked fingertips (piano)
- For each hand, take only **extended** fingers (tip more than 6 cm from its own base joint; curled tips tuck in close. The thumb needs 4.5 cm and must not be tucked against the side of the hand), then the **lowest** extended tip over a key presses it. Resting or curled fingers never play.
- Hysteresis: down when the tip is 12 mm above the key top, up at 19 mm; 120 ms debounce per key.
- Sampled notes: Salamander Grand Piano (CC-BY 3.0) MP3s, one sample every minor third, pitch-shifted with `playbackRate = 2^(semitones/12)`.
- Score accuracy and rhythm separately (we used 65/35); call a note "on the beat" within a third of a beat and show it in gold.

## 15. The user's own content ("teach the master", file import)
- **Perform it:** in a `listen` phase, reuse the same press detector as play. Push `{midi, t}` per press and let the master's hand follow the last key. End after 3 s of quiet with 3 or more notes, or at 40 notes. Convert: beat = median gap (clamped 0.3 to 1.2 s), each note's beats = gap / beat rounded to 0.5 (0.5 to 3), last note 2 beats, bpm = 60 / beat. Then play it back in watch mode and teach it like any song. Reference: `hands-of-a-master/src/piano/custom-song.ts` (`songFromRecording`).
- **Import a MIDI file** on the 2D start page: a UIKit button calls a hidden `<input type="file" accept=".mid,.midi">` (the panel click counts as the user gesture), plus `dragover`/`drop` on `window`. Remove both in `cleanupFuncs`. Parser (`songFromMidi`, about 100 lines, no dependency):
  - SMF format 0/1, ticks per quarter (reject SMPTE);
  - running status, first tempo meta;
  - skip channel 10 drums and note-on with velocity 0;
  - skyline (highest note per onset within division/16 ticks);
  - fit into range by whole octaves, then fold;
  - cap at 40 notes; durations in quarter beats rounded to 0.25.
- **Storage:** localStorage under a versioned key, wrapped in try/catch. Reset that slot's score whenever its content changes. Show its name on the last tile.
- **Unit test** the parser with a MIDI written by a few lines of Python (header, a tempo track, chords, a drum note, running status), bundled with esbuild and run in node.
