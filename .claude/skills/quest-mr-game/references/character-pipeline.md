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
