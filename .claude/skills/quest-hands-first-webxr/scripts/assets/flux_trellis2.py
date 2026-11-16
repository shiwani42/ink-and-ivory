"""TRELLIS.2 (microsoft/TRELLIS.2, MIT) image->3D for hero props; concept by FLUX.1-schnell (Apache-2.0).
Copy to <repo>/tools/freegen/flux_trellis2.py. Needs HF_TOKEN=... in <repo>/.env.local (gitignored).
    python tools/freegen/flux_trellis2.py <name> "<prompt>"   -> tools/freegen/out/<name>.png/.glb/.json
Output is 100k+ faces before decimation and uses more quota than TRELLIS; use it for one hero piece."""
import json, pathlib, shutil, sys, time
from gradio_client import Client, handle_file
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).resolve().parent / "out"
tok = next(l.split("=", 1)[1].strip() for l in (ROOT / ".env.local").read_text().splitlines() if l.startswith("HF_TOKEN="))

def retry(fn, label, tries=6):
    for k in range(tries):
        try: return fn()
        except Exception as e:
            print(f"  {label}: {str(e)[:150]} — retry", flush=True); time.sleep(30 * (k + 1))
    raise SystemExit(f"{label} failed")

name, prompt = sys.argv[1], sys.argv[2]
png = OUT / f"{name}.png"
flux = retry(lambda: Client("black-forest-labs/FLUX.1-schnell", token=tok, verbose=False, httpx_kwargs={"timeout": 600}), "flux")
img, _ = retry(lambda: flux.predict(prompt=prompt, seed=3, randomize_seed=False, width=1024, height=1024, num_inference_steps=4, api_name="/infer"), "image")
shutil.copy(img["path"] if isinstance(img, dict) else img, png); print("concept ready", flush=True)
t2 = retry(lambda: Client("microsoft/TRELLIS.2", token=tok, verbose=False, httpx_kwargs={"timeout": 900}), "trellis2")
retry(lambda: t2.predict(api_name="/start_session"), "session")
pre = retry(lambda: t2.predict(handle_file(str(png)), api_name="/preprocess_image"), "preprocess")
retry(lambda: t2.predict(image=handle_file(pre if isinstance(pre, str) else pre["path"]), seed=0, resolution="1024", api_name="/image_to_3d"), "3d")
res = retry(lambda: t2.predict(decimation_target=40000, texture_size=2048, api_name="/extract_glb"), "extract")
src = res[1] if isinstance(res[1], str) else (res[1].get("path") or res[1].get("value"))
shutil.copy(src, OUT / f"{name}.glb")
(OUT / f"{name}.json").write_text(json.dumps({"prompt": prompt, "image_model": "FLUX.1-schnell (Apache-2.0)", "mesh_model": "TRELLIS.2 (MIT) microsoft/TRELLIS.2"}, indent=2))
print("saved", name, (OUT / f"{name}.glb").stat().st_size // 1024, "KB", flush=True)
