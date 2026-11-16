# Assets, AI generation and licensing (zero budget)

Competition entries are public. Everything shipped must be original, public domain, or under a licence that allows it, with proof on request (Meta VR Start rules 10 and 12). Keep a provenance line per asset (source URL, author, licence, generator and its licence, date, scripts used) in `public/**/CREDITS.md`, the README and the Devpost text. Ask early whether the user will spend money or create accounts.

## Source decision tree (all free unless marked)
| Need | First choice | Notes |
|---|---|---|
| PBR textures | Poly Haven, ambientCG (CC0) | 1k–2k JPGs: diffuse, normal, roughness |
| Real-world props (brass, wood, ceramics, furniture) | Poly Haven API (CC0, no account): `https://api.polyhaven.com/assets?t=models`, then `/files/<id>` → glTF 1k | Mostly European interiors |
| 360° real places | Poly Haven HDRIs (4k tonemapped JPG + 1k HDR); Wikimedia Commons filtered to CC0/PD | Commons: check for people and signage; HTTP 429 → `curl` 3–4 s apart, `upload.wikimedia.org` thumbnail at 4096 px |
| 360° invented environment | FLUX.1-schnell HF Space (`black-forest-labs/FLUX.1-schnell`, Apache-2.0) at 2048×1024, prompt *"seamless 360 degree equirectangular panorama, interior of …"* | Works anonymously; 2–3 seeds, pick one. `scripts/assets/flux_panorama.py` |
| Hero 3D props | FLUX concept → TRELLIS (`trellis-community/TRELLIS`, MIT) or TRELLIS.2 (`microsoft/TRELLIS.2`, MIT) with a free HF token | `scripts/assets/flux_trellis.py`, `flux_trellis2.py` |
| If TRELLIS is down | `VAST-AI/TripoSG`, `Stable-X/Hi3DGen`, `stabilityai/stable-fast-3d` (check each Space's licence before shipping) | All on ZeroGPU: one shared daily quota |
| Curated human-made models | Sketchfab, Downloadable + CC0/CC-BY, downloaded **by the user** (give exact search terms, a triangle budget, filenames and a CREDITS line format) | Avoid NC/ND |
| Characters | MakeHuman/MPFB (CC0 output): `quest-mr-game` character pipeline | AI meshes have no face rig |
| Hand mesh and poses | WebXR Input Profiles generic hand; IWER poses (MIT) | `quest-mr-tutor` |
| Music | OpenGameArt filtered to CC0 | audio.md |
| Melodies | Public domain compositions; write your own arrangement | Arrangements can be copyrighted |
| Meta's 3D library | `metavr asset search` / MCP `vr_assets_search` | "Invalid API response" for every query, logged in or not (Nov 2026). Retry occasionally; never depend on it |
| Paid (only if the user agrees) | Meshy API (Pro tier for the API) | Don't build this path before asking |

**No local NVIDIA GPU:** Modly, MyMeshy, ComfyUI and 3D Gen Studio are out. Google Colab (free T4, under the user's own login) is the backup when the HF quota is gone. CPU TripoSR/Shap-E are below a production bar.

## Hugging Face ZeroGPU realities
- Anonymous: about 1 model a day. A **free account token**: a few GPU-minutes a day, roughly **1–3 TRELLIS models**. The quota is shared across all ZeroGPU Spaces, FLUX included.
- Generate **hero assets first**, one at a time; reuse concept images; keep a procedural fallback for every asset so a missing file is skipped, not broken.
- Token: the user writes `HF_TOKEN=…` into the gitignored `.env.local` from their own terminal. Links: `https://huggingface.co/join`, `https://huggingface.co/settings/tokens/new?tokenType=read`.
- `gradio_client` ≥ 2: `Client(space, token=…, httpx_kwargs={"timeout": 600})`. Retry the connection and every predict; free Spaces take minutes to wake. "exceeded your free ZeroGPU quota" means stop until the reset.
- Feed image-to-3D your own concept or render, never a photo of a real product or person.

## Prompts that produce usable meshes
`"<object, materials, colours>, isolated single object centred on a plain pure white background, three-quarter view, soft even studio lighting, product photograph, photoreal, highly detailed"`. Add "compact shape, nothing hanging below" for anything with chains or pendants. One object per image.

## Cleanup (preview first: `blender -b --python scripts/blender_preview_glb.py -- in.glb out.png`)
- **Floating fragments:** `scripts/assets/clean_fragments.py`. Size mode (islands under 2% of the main body) for blobs; for thin parts (rings on a stem) use horizontal distance from the main axis.
- **Ground slab** baked in from the white background: `scripts/assets/remove_ground_slab.py`.
- **Reject** results wrong in silhouette or colour; regenerate with a better concept rather than patching materials.
- Decimate in Blender (TRELLIS.2 outputs 100k+ faces; props under ~20k triangles).
- Optimise: `gltf-transform optimize in.glb out.glb --compress false --texture-compress webp --texture-size 1024` (2048 for hero pieces).

## Placement
Normalise each prop at load (target height, base at y=0, centred in x/z) and **clone per placement**. Real-world scale: chairs 0.9 m, standing lamps 1.1–1.2 m, pillars 2.6–2.9 m, arches ~2.7 m, table props ~0.1 m.

## Blender script pipeline (models from code)
One script builds every model, run headless: `blender -b --python tools/blender/build_assets.py -- <texture_dir> <out_dir>`.
- Metres; base at y=0; centred on the footprint; bevels on visible edges; smooth shading by angle; CC0 PBR maps; Z-up exported as glTF Y-up.
- **Name the nodes the code needs** (`key_C4`, `legs`) and look them up with `getObjectByName`.
- **Parameters, not literals,** for anything content depends on (e.g. an instrument's range).
- **Merge static parts by material** before export (`make_single_user`, apply modifiers, group by parent and material, `join`).
- Export GLB with WebP textures, **no Draco** (never on skinned meshes; Blender's libdraco may be missing) and **no meshopt** (IWSDK can't decode it).
- Build to a scratch folder while a test runs, review with a render, then copy into `public/models/`.
- `scripts/assets/remotezip.py` + `remotezip_fetch.py` fetch selected members of a huge remote zip over HTTP Range (no full download).

## Other people's code
- **Reuse with the notice:** MIT, Apache-2.0, BSD, CC0.
- **Learn the technique only:** no licence, GPL, custom licences (e.g. OSLLv1), minified bundles.
- Disclose analytics if any; for a judged entry prefer none.

## Do not ship
- **Copyrighted songs**, including the melody alone (pop, film, game). Offer public-domain alternatives and a bring-your-own path; keep them out of the trailer too.
- **Logos, brands, identifiable people** (also a rule). Never copy a real actor's face; draw on an archetype instead.
- **Hunyuan3D output** (Tencent's licence bars use and display in the EU, UK and South Korea). Don't use it as a fallback either.
- AI-generated video in the trailer.
- Credits written from memory: verify every author and licence on the source page; if unconfirmed, credit by title and licence.
