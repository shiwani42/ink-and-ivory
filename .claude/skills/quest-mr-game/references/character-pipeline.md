# Realistic character pipeline: MakeHuman/MPFB → glTF → procedural animation (WebXR)

Use this when a project needs a believable human NPC (opponent, guide, mentor) that blinks, talks, looks at the player and uses its hands. AI image-to-3D gives detailed but **unrigged, faceless** meshes; MakeHuman gives a rigged body with face targets, and its generated humans and system assets are **CC0**.

Template code:
- `scripts/character/build_human.example.py` (body, face, skin art, rig, expression keys, export);
- `scripts/character/costume.example.py` (hair cards, turban, robe cut from the body, jewellery);
- `reference/runtime/human.ts` (runtime driver; compiles on its own against `@iwsdk/core`).

Provenance: built for the NPC opponent in `chausar/` (Nov 2026); the scripts are templates with that character's brief and costume, marked where to adapt.

## 0. Decide first: realistic or stylised?
- **Realistic** (this pipeline) when the brief or user asks for "a real human". Cost: about 1 day including QA. Risk: the uncanny valley, mitigated by expression, motion and lighting.
- **Stylised hero** (canvas-drawn face, procedural "life", like 2025's IWSDK winner The Nanauts) when time is short or the tone is playful.
- **Never copy a real actor's face.** Competition rules ban identifiable people, and it's likeness use. Draw on the *archetype* of on-screen portrayals instead (costume vocabulary, mannerisms).

## 1. Install (headless, no GPU needed)
1. Get MPFB from the Blender extensions API: `https://extensions.blender.org/api/v1/extensions/` → item `mpfb` → `archive_url`. Verify the sha256 against the URL. Then run `blender -b -c extension install-file -r user_default --enable mpfb.zip`. Blender's own online sync is often disabled.
2. The MakeHuman CC0 system-asset pack is 281 MB on a throttled server. Use the core skill's `quest-hands-first-webxr/scripts/assets/remotezip_fetch.py` to read the zip's central directory over HTTP Range and fetch only what you need (one skin, eyes, brows, lashes, teeth, tongue), with parallel ranged GETs and local decompression.
   - Never copy files while a download is still writing (you get 0-byte PNGs).
   - Delete 0-byte leftovers before re-fetching; the fetcher skips files that already exist.
3. Install the assets into MPFB's user data dir (`LocationService.get_user_data()`, usually `~/.config/blender/<ver>/extensions/.user/user_default/mpfb/data`).

## 2. Build order (in the build script)
1. `create_human(macro)`: gender, age, muscle, weight, height, proportions, race mix.
2. Face shaping with `load_target(path, weight)` (nose, cheeks, chin, brows, eyes, lips), then `bake_targets`.
3. Proxies with `material_type="GAMEENGINE"` (the only type that exports cleanly): eyes (high-poly), eyebrows, eyelashes, teeth, tongue. Skin with `set_character_skin(..., skin_type="GAMEENGINE")`.
4. `add_builtin_rig("default")`, which has spine, neck, head, jaw, eyes, arms, fingers and legs.
5. **Every proxy gets an Armature modifier and rigid `head` weights** (eyes, lashes, brows, teeth). Proxies added before the rig have no armature modifier and export unskinned.
6. Runtime expression shape keys from `targets/expression/units/<race>/`:
   - blink: `eye-*-closure`;
   - squint: `eye-*-slit`;
   - brows: `eyebrows-*-up/down`;
   - smile: `mouth-corner-puller`;
   - sneer: `mouth-upward-retraction`;
   - `mouth-open`, purse, frown.

   Copy the keys onto lashes and brows using the MHCLO barycentric mapping, so blinks move the lashes.
7. **Skin art in the texture.** Rasterise the UV triangles of faces selected by bone weights (eyelids → kohl, jaw/mouth → stubble), blur the mask, and tint. Point stamps leave dotted patterns. Warm or deepen the complexion by multiplying and desaturating slightly.
8. Costume and hair (next section).
9. Delete helper geometry only. **Keep the whole body**: seated characters need legs.
10. Bake object transforms, export GLB (skins + morphs, no animations, JPEG/PNG images), then `gltf-transform optimize --compress false --texture-compress webp --texture-size 2048`. About 9.5 MB comes down to 2.8 MB.
11. Print key bone positions (head, jaw, wrists, pelvis) in glTF space, for runtime placement.
12. Render a Cycles preview (face close-up, 3/4 view) on every build. **This is your ground truth** for later A/B comparisons.

## 3. Costume and hair that don't look naive
- **Garments cut from the body:** copy the body, keep the faces whose dominant bone is torso, arms or legs, push out along the normals (1–2 cm, more for loose garments) and smooth. It inherits the skin weights, so it deforms with the body for free. Smart-UV it, then **scale the UVs ×6–8** so pattern motifs tile small. Put a trim material on the faces within 1–2 rings of the open edges.
  - **End sleeves mid-forearm.** Full-length sleeves with a hard trim band make hands look severed when the elbow bends.
- **Wrapped headwear:** one ribbon wound in a helix with alternating crossing tilt, folds as small radial noise, a cap dome, and a fan crest. Stacked tori read as donuts. Raise it so the forehead and brows stay visible. Use matte silk (roughness ~0.65, specular ~0.35); low roughness turns plum silk to chrome.
- **Facial hair = alpha hair cards:**
  - root them on landmarks taken from the geometry (nose tip = the most forward face vertex; mouth line ≈ nose tip − 3.2 cm; chin = the lowest front vertex);
  - many fine strands for a moustache (curled, sweeping out and down), with a pointed goatee converging to a tip;
  - dark salt-and-pepper texture.

  Vertex-group guesses put moustaches on eyebrows.
- **Jewellery:** beads along a curve projected onto the garment surface (BVH raycast from the front), weights from the nearest garment vertex.
- **A better hero piece later** (e.g. an AI-generated turban): fit it to the bounding box of the procedural one in model space at rest, then parent it to the head bone (`wearTurban()` in `human.ts`). Generated pieces need a clean concept: a single compact object, nothing dangling.

## 4. Export and engine traps (each was a full iteration)

| Symptom in engine | Cause | Fix |
|---|---|---|
| Model "fails to load", falls back | three sanitises node names (`wrist.R` → `wristR`) | look up bones raw *and* sanitised |
| Eyes slide out of their sockets when the head turns | proxies exported **unskinned** (no armature modifier) | add an Armature modifier and rigid head weights before export |
| Eyes look shut, dark slits or white blobs at the corners | MakeHuman eyes include a **clear cornea shell**; forced opaque, it covers the iris | eye material `alphaTest = 0.5` (no blending) |
| Limbs look cut, eyes vanish behind the lids | MPFB exports skin and eyes as **BLEND** → per-object sorting errors | force skin, eyes and body opaque at load; strands alpha-tested |
| Pale rectangles ("glasses") around the eyes | lash/brow transparency nodes don't survive glTF export | `onBeforeCompile`: `alpha = smoothstep(.25,.75, 1 - luminance)`, tint the strands near-black |
| Lashes and brows displaced | **Draco** quantisation of small skinned meshes | no Draco on characters |
| Pink sliver at the lip | teeth or tongue poking through closed lips | hide them unless the mouth opens wide |
| Hard cut at the tabletop | clipping-plane hack | full seated body plus seat plus `DepthOccludable` |

**Debug protocol:** dev key for neutral (rest pose and zero morphs) → compare with the Blender preview → toggle posing → toggle morphs → swap the compressed and uncompressed GLB → log each mesh's `isSkinnedMesh` and bone count. One of these A/Bs isolates the stage.

## 5. Runtime animation (`human.ts`)
- Each frame: reset all bones to rest, then layer legs → spine → head → arms → fingers → morphs.
- **World-space bone maths only:** "rotate bone so world direction A → B" is `q = setFromUnitVectors(A, B)`, applied as `local = parentWorld⁻¹ · q · boneWorld`. This avoids depending on the rig's local axes.
- **Two-bone IK** (analytic) for arms *and* legs. Seated cross-legged means feet tucked under the opposite knee, knees out and forward.
- **Seat sized to the real table:** seat height = table height − 0.33 m; the pelvis 0.10 m above the seat. The head then sits about 0.42 m above any table ≥ 0.4 m. Floor = −tableHeight in board space (local-floor reference space).
- **Lean** the spine when a reach target is beyond ~82 % of arm length. The arms can't reach the far side of the table, so bring objects to the character (e.g. dice "obey" him and slide over).
- **Head and eyes:** spring (k≈120, damping 0.82) toward a clamped yaw/pitch; eyes take a small lead; a sly head tilt when suspicious; turn the torso partly when looking away. Eye contact targets the player's eyes (head − 3 cm), not the chest.
- **Face:**
  - blink every 2–6 s for 140 ms;
  - expressions as smoothed morph weights driven by game state (smug baseline, a modest squint when watching, laugh, anger, sneer);
  - jaw rotation while a line is being spoken (syllable rhythm). Keep baseline squint low (≤0.06), or the eyes read as closed.
- **Gestures near the body need staging.** Beard stroke: wrist in front of the chest and below the target, elbow pole out to the side, then **aim the wrist bone so the knuckles point at the target**, with the target in front of the beard surface. Aiming only the wrist hides the forearm in the torso and the hand looks severed. Measure the fingertip with a bone, don't guess.
- Fade in with material opacity, then restore opaque. Hide the procedural fallback when the model loads.

## 6. QA checklist before showing anyone
Use dev review cameras: face close-up, seated body, side profile. Trigger every pose (idle, reach, lift, under-table dip, throw, laugh, anger, beard stroke). Check:
- eyes open, irises visible, lashes as strands, brows present;
- no floating cards;
- hands connected to visible forearms, fingers in front of the beard or face;
- no clothing seams cutting limbs;
- no body intersecting the table or seat;
- the face reads at the real viewing distance (~0.8–1.2 m);
- colours right under the scene's actual lighting (warm lamps shift magenta and plum).

## 7. The production route: real clothes, hair and skin + mocap + procedural layers (Sadak VR, Nov 2026)
Use this when users say NPCs look "junky" or "broken". Painted-on clothes and hair, and code-only idles, read as fake at 0.7 m. This is how VR NPCs are usually built, entirely from free CC0 sources. Code: `sadak-vr/tools/humans/build_character.py`, `retarget.py`, `preview.py`, `preview_anim.py`, and `src/world/human.ts`.

**Sources (all CC0):**
- **MakeHuman asset packs:** https://static.makehumancommunity.org/assets/assetpacks.html
  - Mesh packs download from `https://files.makehumancommunity.org/asset_packs/<pack>/<pack>_cc0.zip`. The `files2.` mirror runs at about 7 KB/s; `files.` at about 2.7 MB/s.
  - Functional packs are at `https://files.makehumancommunity.org/functional/<pack>.zip`.
  - Useful packs:
    - `makehuman_system_assets`: 281 MB with skins, hair, casual suits and shoes;
    - `skins01`: female, including `cutoff3d_indian_female_skin`;
    - `skins02`: male;
    - `hair01`: buns and braids;
    - `shirts01`, `pants01` (harem pants make a good pyjama), `shoes01`, `skirts01` (`toigo_long_full_skirt` works as a sari skirt);
    - `visemes02`: the 15 Meta/Oculus visemes, as `.target` files;
    - `faceunits01`: 52 ARKit-style units (blink, brows, smile, jawOpen…).
  - Unzip straight into MPFB's user data dir.
- **Motion capture:** Quaternius Universal Animation Library 1 and 2, Standard (free) versions.
  - https://quaternius.itch.io/universal-animation-library and https://quaternius.itch.io/universal-animation-library-2
  - itch needs a click-through, so ask the user; scripted downloads get blocked.
  - About 130 clips on a 65-bone UE-mannequin rig, with the same names as MPFB's `game_engine` rig, except the source's `Head` is capitalised.
  - NPC-useful clips: `Idle_Loop`, `Idle_Talking_Loop`, `Idle_FoldArms_Loop`, `Interact`, `Yes`, `Idle_No_Loop`, `Driving_Loop`, `Idle_Rail_Loop`, `Sitting_Idle_Loop`, `Sitting_Talking_Loop`, `Idle_TalkingPhone_Loop`, `PickUp_Table`, `Consume`, `Walk_Loop`.

**Build (one Blender run per character, about 15 s):**
1. `create_human(detailed_helpers=True)`, then seeded face targets, then `add_builtin_rig('game_engine')`.
2. `set_character_skin(..., 'GAMEENGINE')`, then eyes, brows, lashes, teeth, hair and clothes via `add_mhclo_asset(material_type='GAMEENGINE')`. Clothes come fitted and weighted to the rig automatically.
3. Freeze the shape keys (`apply_mix`), then load the face morphs as new shape keys on the base-mesh topology. Do this before deleting any vertex, because targets are vertex-indexed.
4. Delete the body hidden under clothes (`Delete.*` groups) and the helpers (not in group `body`) with **bmesh**: it keeps shape keys, while `modifier_apply` refuses on a mesh with shape keys.
5. Add eye bones (`eye_l`/`eye_r` under `head`, at each eye's centroid) and reweight the eye mesh by x sign, for gaze.
6. **Clothes look:**
   - recolour by unlinking Base Color and setting a plain colour (or tint by multiplying);
   - tint skin by multiplying the texture by the target skin tone; vertex and material colours are linear, so convert sRGB hex with `^2.2`;
   - make everything opaque except hair, brows and lashes (alpha clip) and eyes (keep the clear cornea transparent, or eyes glow white).
7. **Garments the packs lack, from real meshes:**
   - **Kurta:** a tee plus a flared cloth skirt in the tee's own material. Size it per height to clear the trousers underneath, recalculate the normals outward, and cut the trousers above the hem so they never poke through.
   - **Sari:** long skirt plus a short-sleeved blouse, plus a pallu built as a band along an ellipse path round the measured girth (hip → chest → over the shoulder → down the back). Shrinkwrapping onto a body whose hidden vertices were deleted gives jagged spikes.
8. Retarget the clips onto this very rig before export, then export the GLB with skins, morphs (`export_try_sparse_sk`) and NLA-track animations. Each character is 4.3–6.8 MB with 8 clips.

**Retargeting (`retarget.py`, standard world-space method):**
- First align the rest poses: turn each target bone's direction onto its source bone's rest direction. Then per frame: target world rotation = source world change since its rest × aligned target rest. Solve locals parent-first; the pelvis takes the source hip translation scaled by hip height.
- **Bone direction = the main child.** Skip eye, jaw and leaf children, or the head (whose first child is now `eye_l`) aligns to "forward" and every clip looks at the sky.
- **Name output actions uniquely** (`RT_<name>`) while the source actions still exist. Otherwise Blender renames yours `Yes.001` and the export filter drops them. Rename after deleting the source.
- Retarget inside the build, onto the exact armature that ships. A separate `anims.glb` re-imported and re-exported can change the bones' rest rotations, so its local quaternions no longer fit.

**Runtime layering (`human.ts`, a `VendorRig`):**
- Clone with `SkeletonUtils.clone`; play the base clip through an `AnimationMixer` (idle ↔ talking, 0.5 s crossfades, the odd folded-arms rest).
- Then the procedural layers every frame, all in world-space bone maths:
  - gaze: neck 35 %, head 75 %, eyes 100 %, clamped;
  - two-bone IK for hands, blended in when idle (`restW`) so hands drift onto the counter, and out while talking so the mocap gestures play;
  - palm orientation;
  - blinks (`eyeBlinkLeft/Right`);
  - visemes from a voice meter, or a syllable rhythm.
- Seated with a sitting clip: offset the body so the clip's pelvis lands on the seat.
- **Bugs that cost an iteration each:**
  - Measuring the character's "forward" in world space when its GLB loads after the holder is already placed: use the holder's world quaternion, or heads twist sideways.
  - Sharing module-level scratch vectors (`_a`, `_b`, `_c`) between hand targets, gaze targets and the IK internals: one limb's solve overwrote the other's target (an arm vanished) and the gaze target (heads looked up). Give targets their own vectors.
  - `MeshStandardMaterial` under lights tuned for cel/toon bands over-exposes plain cloth to white. Scale plain-colour materials by about 0.5 and textured ones by about 0.75, or light the characters separately.
- Stream the characters: the first NPC is `priority: 'critical'`, the rest `'background'`. Build lazily in `update()` once `AssetManager.getGLTF(key)` returns.
- Review with Blender renders of a mid-clip frame per clip (`preview_anim.py`), plus in-app shots of idle, talking and offering.

**Polish layers that users notice (Sadak VR):**
- **Solid counters:** after the mocap and IK, test the hand and three fingertips (middle, index, thumb `_03`) against the counter's footprint in the holder frame. If any is below the top plus 2 cm, re-run the arm IK with the hand raised by the overlap. Recorded motion never knows the furniture exists.
- **Lip sync from real audio:** tap an `AnalyserNode` (fftSize 256) on the voice bus. Each frame, loudness = mean magnitude × 3.2, and brightness = the energy share above 18 % of the bins. Map loudness to mouth opening and brightness to the viseme (E/I bright, aa middle, O/U dark), with PP closures in the gaps. Fall back to a syllable rhythm with no audio.
- **Accessories over hair** (caps, turbans): size them from the hair and scalp vertices above the crown, never the bald head, or hair pokes through or the cap sits on a bald scalp.
- **Kurta over loose trousers:** cut the hidden trousers *before* building the kurta skirt, and keep each ring at least as wide as the ring above, so cloth falls instead of stepping out.
