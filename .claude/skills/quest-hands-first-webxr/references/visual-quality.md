# Visual quality in passthrough, within Quest's budget

Past winners didn't win on polygons. They won on **lighting, grounding, motion, sound and one consistent style**. Scene-level lighting and environment components: `iwsdk-compose-scene`.

## 1. Lighting (pick by material)
- **Matte content** (paper, wood, cloth): `IBLGradient` ~0.25, ACES tone mapping, one directional light.
- **Metal, gold, lacquer, glass:** `IBLTexture {src:'room', intensity ~0.8}` on the level root (it wins over `IBLGradient`; set `_needsUpdate` after edits). Without real reflections, brass reads as brown plastic.
- Optional warm practical light (lamp, candle): one flickering `PointLight`, created in `init`. Adding or removing lights later recompiles every lit shader.
- Check colours under the actual scene lighting: warm lamps shift magenta and plum; low roughness turns silk to chrome; a bright sheen turns crimson velvet pink.

## 2. Shadows and grounding (pick by motion)
- **No shadow map** for static or light content: a dark mat or felt under it plus a soft radial-gradient alpha disc as a contact shadow.
- **One play area, occasional moves:** one shadow-casting key, `castShadow`, a tight shadow camera (~1 m) aimed at the play area, a 1024² map, `autoUpdate=false`, refresh only when something moves; a `ShadowMaterial` catcher underneath.
- **Objects moving continuously on a table:** two tiers: a static 512² map refreshed when things settle, plus a small 128² shadow camera that follows only the moving objects.
- Never per-frame full shadow maps. **Force one material recompile** if shadows are enabled after load.
- Arrival animation: scale content in along its depth axis over ~0.7 s.

## 3. Materials that read as real
- Draw ornament once on a canvas and reuse the strokes as metalness, roughness and bump masks, so gold thread glints as the head moves.
- Lacquer and wood: `MeshPhysicalMaterial` with clearcoat. Velvet: muted sheen (dark `sheenColor`, darker base).
- Pack multi-face textures into one atlas (one draw call per object).
- Bevels on visible edges catch light up close.

## 4. Worlds: passthrough, places and domes
**Default: one world at a time.** Either passthrough, or fully in a place, with a dissolve between them. Users found the room plus a partial overlay confusing. Place content in passthrough first (so it lands on the real table), then dissolve into the place, with a button back.
**Exception: a wall-replacing dome** when the real table, hands and floor are the play surface. The dome is opaque on the walls and fades out below about −15° elevation, so there is no partial overlay at the height of the task.

Shared technique (one draw call):
- Inside-out sphere (`SphereGeometry(40, 64, 32)` for a place, radius ~2.8 m inside a dimmer for a dome), `BackSide`, `depthWrite:false`, `renderOrder:-100`, `frustumCulled:false`, **moved to the head every frame** (no parallax, horizon at eye level). Sample the texture from the view direction yourself so a `uYaw` uniform can turn it; put the seam behind the user.
- 4096×2048 JPG; `wrapS = RepeatWrapping`, mipmaps, `LinearMipmapLinearFilter`, or a vertical seam shows.
- **Calm behind a task:** in the same shader, mip bias ~3 (cheap blur), 50% desaturation, mix 30% toward a warm haze, dim ~8%. Face the calmest part of the photo.
- **Dissolve:** alpha = `smoothstep(n-0.05, n+0.05, t*1.25-0.12)`, `n` = two octaves of 3D value noise on the view direction, `t` 0→1 over ~2.4 s, dark rim where `abs(edge-n)` is small. Dissolve out, load, dissolve in; guard with a load ticket so a fast double switch can't show the wrong place.
- **Keep the touch real:** when a full place shows, draw a virtual tabletop at the real table's plane so fingers still land on the real surface.
- **Dim passthrough** (warm black inside-out sphere at 40–50%) as a dome or character appears; reveal with the entrance, dissolve back to the room on the win.
- 3D pieces in front of a dome add depth (an arch framing the focal point, symmetric pillars or lamps), clear of the play area and sight-lines.

## 5. Motion ("juice")
- Anticipation (squash) → stretch → squash on landing → settle with overshoot; a landing puff and a pitched tap; something bigger on the final step.
- Reward waves: 3–4 bursts ~0.28 s apart with a rising sound.
- Legal-move or target outline: inverted hull, easeOutBack pop-in, pulse.
- Ambient life: flicker, embers, sway, breathing.
- An awe moment without post-processing: progressive canvas drawing → additive light pillars → sparks.

## 6. A consistent look
One palette, one material language, one font pair. Every prop passes the "same world?" test; one cartoon piece makes a set look like a yard sale. Review the hero frame (first 20 s of the trailer) as a composition.

## 7. Performance budget
- **72 fps target, 60 fps hard floor**, through the heaviest effect, on the device.
- ≤100 draw calls per eye; aim ≤150k triangles, 300k ceiling; one shadow map; no full-screen post-processing; `highp` in custom shaders.
- Foveation 0.4 for text-heavy views, 0.5 otherwise.
- **Merge static models by material** in Blender before export; keep only nodes the code animates or names separate (93 meshes → 7 cut one mode from 280 to 112 emulator draw calls).
- Log `renderer.info.render` every 3–5 s in dev. The emulator renders each eye separately: halve its numbers; compare by timestamp.
- Desktop frame time doesn't predict Quest: capture on the device (`hz-perfetto-debug`).

## Baked ambient occlusion (the cheapest big upgrade)
IBL-lit models look flat without contact darkening. Bake AO in Blender into a second UV map and export it as glTF occlusion; three.js loads it as `aoMap` on UV channel 1, at no runtime cost. Recipe (`bake_ao` in `hands-of-a-master/tools/blender/build_assets.py`):
1. Apply modifiers (`make_single_user`, `convert`), so the bake matches the export.
2. Per object: add UV map `AO`, make it active, `smart_project(angle_limit=66°, island_margin=0.03)`.
3. New image (512 px props, 1024 px hero), Non-Color; a copy of each material gets an Image Texture node (UV Map node = `AO`) set as the active node.
4. Cycles, CPU, ~48 samples; `world.light_settings.distance` = AO reach (3 cm props, 25 cm a piano); `bpy.ops.object.bake(type='AO', margin=6)`; `img.pack()`.
5. Wire glTF occlusion: a node group named **`glTF Material Output`** with a float input `Occlusion`, fed from the AO texture's red channel. Reset the active UV to index 0.
6. Merge by material first, then bake (merged meshes stay one draw each). About 1 minute for a 10k-triangle piano on CPU.
AO only affects indirect light (IBL, ambient), so it reads strongest under image-based lighting. Check: the GLB's materials have `occlusionTexture`.

## Materials that read as real
- **Lacquer, polished wood, car paint:** Principled `Coat Weight` 1, `Coat Roughness` ~0.04 over a satin base (roughness ~0.2); exported as `KHR_materials_clearcoat`. One extra shader layer, no extra draw.
- **Reflections:** feed each place's own HDR as the environment, so metal and coat reflect the room the user sees.

## Frame rate and layers (Meta's WebXR guidance)
- Request 72 Hz first. If on-device traces show headroom, step up via `session.supportedFrameRates` / `updateTargetFrameRate(90)` (Quest Browser 16.4+). Meta: "higher frame rates result in more realistic experiences."
- Verify that foveation actually applies: `adb shell ovrgpuprofiler -e` (restart the browser), then `ovrgpuprofiler -t`.
- **`XRQuadLayer`** (IWSDK optional feature `layers`) renders panel text crisply, but the compositor draws it *over* everything, including hands. Use it only for panels that hands never pass in front of. The emulator shows only the fallback mesh.
- KTX2/Basis is Meta's recommended texture format (IWSDK bundles `KTX2Loader`); worth it when texture memory or upload hitches show up.
