"""360-degree equirectangular backdrop from FLUX.1-schnell (Apache-2.0), free and anonymous.
Copy to <repo>/tools/freegen/flux_panorama.py, edit PROMPT, then:
    python tools/freegen/flux_panorama.py [seed ...]     (default seeds 11 23)
Writes tools/freegen/out/pano_<seed>.png; pick the best, convert to JPG, put it under public/textures/."""
import pathlib, shutil, sys
from gradio_client import Client
OUT = pathlib.Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)
# Example prompt (a palace interior); replace with your place. Keep "seamless 360 degree equirectangular panorama".
PROMPT = ("seamless 360 degree equirectangular panorama, interior of an ancient Indian royal assembly hall "
          "(Mahabharata era palace of Hastinapur) at night, rows of carved red sandstone pillars with lotus "
          "capitals, scalloped marble arches, hanging brass oil lamps glowing warm, silk drapes in maroon and "
          "saffron, gold leaf ornament, polished stone floor, deep shadows, cinematic warm lamplight, "
          "highly detailed, photoreal, no people, no text")
c = Client("black-forest-labs/FLUX.1-schnell", verbose=False)
for seed in (sys.argv[1:] or ["11", "23"]):
    img, _ = c.predict(prompt=PROMPT, seed=int(seed), randomize_seed=False, width=2048, height=1024,
                       num_inference_steps=4, api_name="/infer")
    src = img["path"] if isinstance(img, dict) else img
    dst = OUT / f"pano_{seed}.png"
    shutil.copy(src, dst)
    print("saved", dst, flush=True)
