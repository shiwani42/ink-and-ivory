# Assets, music and licensing

Competition entries are public. Everything shipped must be original, public domain, or under a licence that allows it, with proof on request (Meta VR Start rules 10 and 12). Keep a provenance note per asset (source URL, author, licence, date) and credit it in the README and the Devpost text.

## Sources that worked (all free)
| Need | Source | Licence | Notes |
|---|---|---|---|
| PBR textures | Poly Haven, ambientCG | CC0 | Download 1k to 2k JPGs (diffuse, normal, roughness) |
| 360-degree places | Poly Haven HDRIs (4k tonemapped JPG plus 1k HDR for lighting) | CC0 | Studio, interiors, gardens |
| 360-degree real places | Wikimedia Commons, filtered to CC0 or public domain | varies | Check for people and brand signage. Rate-limited: `curl`, 3 to 4 s apart, `upload.wikimedia.org` thumbnail at 4096 px |
| Music | OpenGameArt, filtered to CC0 | CC0 | Verify the author on the page; re-encode `ffmpeg -ac 2 -b:a 96k -af afade=t=in:d=2` |
| Piano samples | Salamander Grand Piano via `tonejs.github.io/audio/salamander/<Note>.mp3` | CC-BY 3.0 (Alexander Holm) | One sample every minor third (A, C, D#, F#), pitch-shifted with `playbackRate` |
| Stroke order | KanjiVG | CC BY-SA 3.0 | Derived data is under the same licence |
| Hand mesh and poses | WebXR Input Profiles generic hand; IWER poses | MIT | |
| Melodies | Pieces whose composers died long ago (Beethoven, folk tunes); Happy Birthday (PD in the US since 2016 and the EU since 2017) | public domain | Arrangements can still be copyrighted: write your own simple version |

## Other people's code
- **Reuse with the notice:** MIT, Apache-2.0, BSD, CC0. Keep the licence text and credit the author in the README.
- **Learn the technique only** (re-implement in your own words and code): no licence at all (default copyright), GPL (would force our licence), custom licences such as OpenSoundLab's OSLLv1 (no store distribution of derivatives), and minified production bundles.
- **Disclose analytics** if you add any (Nanauts shipped Google Analytics); for a judged entry, prefer none.

## Do not ship
- **Copyrighted songs**, including their melody alone: pop, film and game music. If the user asks for one, explain, offer public-domain alternatives with the same feel, and point to the bring-your-own path (the user's own MIDI or performance). Don't transcribe it yourself, and keep it out of the trailer too.
- **Logos, brands, or identifiable people** (also a rule). Check photos for faces and signage.
- **Hunyuan3D output** (Tencent's licence bars use and display in the EU, UK and South Korea).
- AI-generated video in the trailer (judges discourage it).

## Models: Blender script pipeline
One Python script builds every model (`tools/blender/build_assets.py` in the reference project), run headless:
```bash
blender -b --python tools/blender/build_assets.py -- <texture_dir> <out_dir>
```
- **Conventions:** metres; base at y = 0; centred on the footprint; bevels on visible edges (they catch light up close); smooth shading by angle; PBR materials from CC0 maps; Blender Z-up exported as glTF Y-up.
- **Name the nodes the code needs** (`key_C4`, `legs`, `case_*`) and look them up with `getObjectByName`. Animate or hide parts by name instead of splitting files.
- **Parameters, not literals,** for anything content depends on (keyboard range, key width). Changing the range is then one line and a rebuild.
- **Merge static parts by material before export** (`merge_by_material` in the reference script: `make_single_user`, `convert` to apply modifiers, group by parent and material, `join`). Keep animated or named nodes separate.
- **Export:** GLB, WebP textures, no Draco (Blender's libdraco may be missing) and no meshopt (IWSDK can't decode it).
- **Build to a scratch folder while a test runs,** then copy into `public/models/`. Review with a render first: [../scripts/blender_preview_glb.py](../scripts/blender_preview_glb.py) renders any GLB. Compare old and new renders before replacing a model.

## AI 3D generation (checked Nov 2026, CPU-only machine)
- **Only practical option:** the Hugging Face Space `trellis-community/TRELLIS` (MIT).
  - Image-to-3D only, through the API `/generate_and_extract_glb`. Feed it your own render or sketch, never a photo of a product or person.
  - Free ZeroGPU quota: about 2 min a day anonymous, 5 min with a free login, so roughly 1 to 3 models a day.
  - Decimate to under 20k triangles in Blender.
- `microsoft/TRELLIS.2` (MIT) is the best quality, but outputs 100k+ faces and needs more quota than the free tier gives.
- Modly and MyMeshy need a GPU; TripoSR's Space was broken.
- The viewers (Manyfold, model-viewer, Online 3D Viewer, F3D) add little over Blender renders and the emulator.
- **Default:** Blender procedural plus CC0 textures. Use AI only for a few hero props, with a provenance note.

## Meta's own asset API
`metavr asset search` and the MCP `vr_assets_search` returned "Invalid API response" for every query, logged in or not (server side, Nov 2026). Don't plan around it; retry occasionally.
