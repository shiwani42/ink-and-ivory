"""
Free prop pipeline: concept image (FLUX.1-schnell, Apache-2.0) → 3D GLB (TRELLIS, MIT)
via public Hugging Face Spaces. No paid accounts. Outputs are ours to use.

Copy to <repo>/tools/freegen/flux_trellis.py and replace PROPS with your own prompts.
Run with a Python that has `gradio_client` (>= 2) installed:
    python tools/freegen/flux_trellis.py              # every prop not yet generated
    python tools/freegen/flux_trellis.py lamp pillar  # selected props
Writes tools/freegen/out/<name>.png (concept), <name>.glb and <name>.json (provenance).
Optional: HF_TOKEN=... in <repo>/.env.local (gitignored) raises the ZeroGPU quota (~1-3 models a day).
"""
import json, os, pathlib, shutil, sys, time

from gradio_client import Client, handle_file

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)

SHOT = ("isolated single object centred on a plain pure white background, three-quarter view, "
        "soft even studio lighting, product photograph, sharp focus, highly detailed, photoreal")

# Example prompts (from a palace-themed board game); replace with yours.
PROPS = {
    "turban": "ornate royal Indian pagdi turban for a man, tightly wrapped deep plum silk with fine gold zari "
              "border stripes and layered diagonal folds, jewelled sarpech brooch with a ruby and pearl drops "
              "at the front, one white heron plume, empty (no head)",
    "pillar": "single carved red sandstone pillar from an ancient Indian palace hall, lotus capital with "
              "bracket corbels, fluted shaft with carved bands, small carved elephants at the base, full height",
    "arch": "ornate scalloped multifoil archway from an ancient Indian Mughal-Rajput palace, carved cream "
            "marble with red sandstone and gold inlay, freestanding, front view",
    "standing_lamp": "tall standing brass oil lamp deepam with five tiers of small wick cups and a peacock "
                     "finial on top, aged polished brass",
    "hanging_lamp": "hanging brass temple oil lamp with chains, ornate bowl with five wicks, aged brass",
    "bolster": "royal Indian floor seat: thick maroon velvet mattress with a large round bolster cushion, gold "
               "zari embroidery and gold tassels",
    "dice_box": "small carved rosewood box with ivory inlay and brass corners, lid open, for long dice",
    "necklace": "royal Indian kundan necklace with three strands of pearls and a large emerald pendant, laid flat",
}


def hf_token():
    env = ROOT / ".env.local"
    for line in env.read_text().splitlines() if env.exists() else []:
        if line.startswith("HF_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"')
    return None


def retry(fn, label, tries=6):
    for k in range(tries):
        try:
            return fn()
        except Exception as e:  # queue full, ZeroGPU quota, transient
            wait = 30 * (k + 1)
            print(f"  {label}: {str(e)[:160]} — retry in {wait}s", flush=True)
            time.sleep(wait)
    raise SystemExit(f"{label}: failed after {tries} tries")


def make(name, flux, trellis):
    png, glb = OUT / f"{name}.png", OUT / f"{name}.glb"
    if glb.exists():
        return f"{name}: cached"
    if not png.exists():
        img, seed = retry(lambda: flux.predict(prompt=f"{PROPS[name]}, {SHOT}", seed=7, randomize_seed=False,
                                               width=1024, height=1024, num_inference_steps=4, api_name="/infer"),
                          f"{name} image")
        src = img["path"] if isinstance(img, dict) else img
        shutil.copy(src, png)
        print(f"  {name}: concept image ready", flush=True)
    retry(lambda: trellis.predict(api_name="/start_session"), f"{name} session")
    res = retry(lambda: trellis.predict(image=handle_file(str(png)), multiimages=[], seed=0,
                                        ss_guidance_strength=7.5, ss_sampling_steps=12,
                                        slat_guidance_strength=3.0, slat_sampling_steps=12,
                                        multiimage_algo="stochastic", mesh_simplify=0.95, texture_size=1024,
                                        api_name="/generate_and_extract_glb"), f"{name} 3D")
    glb_src = res[1] if isinstance(res[1], str) else res[1].get("path")
    shutil.copy(glb_src, glb)
    (OUT / f"{name}.json").write_text(json.dumps({
        "prompt": PROPS[name], "image_model": "FLUX.1-schnell (Apache-2.0)",
        "mesh_model": "TRELLIS (MIT) via trellis-community/TRELLIS", "generated": time.ctime()}, indent=2))
    return f"{name}: {glb.stat().st_size // 1024} KB"


if __name__ == "__main__":
    tok = hf_token()
    # free spaces can take minutes to wake: retry the connection with a long timeout
    connect = lambda space: retry(lambda: Client(space, token=tok, verbose=False, httpx_kwargs={"timeout": 600}), f"connect {space}")
    flux = connect("black-forest-labs/FLUX.1-schnell")
    trellis = connect("trellis-community/TRELLIS")
    for name in sys.argv[1:] or list(PROPS):
        print(make(name, flux, trellis), flush=True)
