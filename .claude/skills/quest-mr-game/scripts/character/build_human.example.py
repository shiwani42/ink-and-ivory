"""
TEMPLATE: build a realistic, rigged human from MakeHuman/MPFB (CC0 output) -> a GLB.
The values below are one example character (a court schemer NPC); adapt the macros, face targets,
skin art, costume and colours. See references/character-pipeline.md.

Copy to <repo>/tools/character/build_human.py, then run (Blender 4.2+ with the MPFB extension and
the MakeHuman CC0 system assets installed):
    blender -b -P tools/character/build_human.py -- --out public/models/character.glb [--preview preview.png]

Character brief (original design, no real person's likeness): a lean, aquiline court
schemer in his late fifties — sharp cheekbones, hooked nose, arched sly brows, thin
lips, goatee and moustache, kohl-rimmed eyes, a jewelled turban and a silk angarkha.

What the script produces:
- body: MPFB basemesh with macro + face targets baked in; helper geometry and legs removed
- eyes, eyebrows, eyelashes, teeth, tongue (MakeHuman CC0 proxies)
- rig: MPFB "default" (jaw, eyes, spine, arms, fingers — driven procedurally at runtime)
- runtime shape keys (morph targets) copied onto lashes/brows too:
  blink_L/R, squint_L/R, brow_up_L/R, brow_down, smile, sneer, mouth_open, purse
- costume (built here): turban, angarkha/robe, shawl, beard + moustache, jewellery
"""
import bpy, bmesh, sys, os, math, argparse
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--preview", default=None)
ap.add_argument("--no-costume", action="store_true")
args = ap.parse_args(argv)

PKG = "bl_ext.user_default.mpfb"
import importlib
HumanService = importlib.import_module(PKG + ".services.humanservice").HumanService
TargetService = importlib.import_module(PKG + ".services.targetservice").TargetService
LocationService = importlib.import_module(PKG + ".services.locationservice").LocationService
ObjectService = importlib.import_module(PKG + ".services.objectservice").ObjectService
Mhclo = importlib.import_module(PKG + ".entities.clothes.mhclo").Mhclo

bpy.ops.wm.read_factory_settings(use_empty=True)
DATA = LocationService.get_user_data()

# ── 1. body ───────────────────────────────────────────────────────────────
macro = TargetService.get_default_macro_info_dict()
macro.update({"gender": 1.0, "age": 0.78, "muscle": 0.42, "weight": 0.36,
              "height": 0.56, "proportions": 0.7})
macro["race"] = {"asian": 0.3, "caucasian": 0.5, "african": 0.2}
basemesh = HumanService.create_human(macro_detail_dict=macro, feet_on_ground=True, scale=0.1)
basemesh.name = "Shakuni_Body"

FACE = {
    # aquiline, gaunt, sly
    "nose-hump-incr": 0.7, "nose-point-down": 0.35, "nose-scale-vert-incr": 0.3,
    "nose-width2-decr": 0.3, "nose-flaring-decr": 0.2, "nose-greek-incr": 0.2,
    "l-cheek-volume-decr": 0.65, "r-cheek-volume-decr": 0.65,
    "l-cheek-bones-incr": 0.55, "r-cheek-bones-incr": 0.55,
    "l-cheek-inner-decr": 0.4, "r-cheek-inner-decr": 0.4,
    "chin-prominent-incr": 0.35, "chin-width-decr": 0.35, "chin-triangle": 0.35,
    "eyebrows-angle-up": 0.65, "eyebrows-trans-down": 0.2,
    "l-eye-eyefold-angle-up": 0.35, "r-eye-eyefold-angle-up": 0.35,
    "l-eye-height2-decr": 0.25, "r-eye-height2-decr": 0.25,
    "l-eye-bag-incr": 0.45, "r-eye-bag-incr": 0.45,
    "mouth-upperlip-volume-decr": 0.5, "mouth-lowerlip-volume-decr": 0.35,
    "mouth-angles-down": 0.2, "mouth-laugh-lines-in": 0.4,
    "head-age-incr": 0.3, "forehead-temple-decr": 0.3,
    "neck-scale-horiz-decr": 0.2,
}
for name, w in FACE.items():
    p = TargetService.target_full_path(name)
    if p: TargetService.load_target(basemesh, p, weight=w, name=name)
    else: print("WARN missing target", name)
TargetService.bake_targets(basemesh)

# ── 2. body parts (fit to the baked shape) ────────────────────────────────
def add(rel, kind):
    path = os.path.join(DATA, rel)
    return HumanService.add_mhclo_asset(path, basemesh, asset_type=kind, subdiv_levels=0, material_type="GAMEENGINE")

eyes = add("eyes/high-poly/high-poly.mhclo", "Eyes")
if eyes is not None:
    _eimg = bpy.data.images.load(os.path.join(DATA, "eyes/materials/brown_eye.png"))
    for _slot in eyes.material_slots:
        for _n in (_slot.material.node_tree.nodes if _slot.material and _slot.material.use_nodes else []):
            if _n.type == "TEX_IMAGE": _n.image = _eimg
brows = add("eyebrows/eyebrow001/eyebrow001.mhclo", "Eyebrows")
lashes = add("eyelashes/eyelashes01/eyelashes01.mhclo", "Eyelashes")
teeth = add("teeth/teeth_base/teeth_base.mhclo", "Teeth")
tongue = add("tongue/tongue01/tongue01.mhclo", "Tongue")
HumanService.set_character_skin(os.path.join(DATA, "skins/middleage_asian_male/middleage_asian_male.mhmat"),
                                basemesh, skin_type="GAMEENGINE")

# ── 3. rig ────────────────────────────────────────────────────────────────
rig = HumanService.add_builtin_rig(basemesh, "default", import_weights=True)
rig.name = "Shakuni_Rig"

# ── 3b. skin art: warm complexion, kohl, stubble shadow, lip tone ────────────
import numpy as np
def skin_image(obj):
    for slot in obj.material_slots:
        if not slot.material or not slot.material.use_nodes: continue
        for n in slot.material.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and n.image.size[0] > 0: return slot.material, n.image
    return None, None

def region_mask(obj, pred, W, H, blur):
    """Rasterise UV triangles of faces whose vertices all satisfy pred → blurred 0..1 mask."""
    me = obj.data; uv = me.uv_layers.active.data
    names = {g.index: g.name for g in obj.vertex_groups}
    ok = [pred({names[g.group]: g.weight for g in v.groups}) for v in me.vertices]
    m = np.zeros((H, W), np.float32)
    for poly in me.polygons:
        if not all(ok[vi] for vi in poly.vertices): continue
        pts = [uv[li].uv for li in poly.loop_indices]
        for k in range(1, len(pts) - 1):
            tri = np.array([pts[0], pts[k], pts[k + 1]], np.float32) * [W, H]
            x0, y0 = np.floor(tri.min(0)).astype(int); x1, y1 = np.ceil(tri.max(0)).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
            if x1 < x0 or y1 < y0: continue
            yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1].astype(np.float32) + 0.5
            (ax, ay), (bx, by), (cx, cy) = tri
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-9: continue
            l1 = ((by - cy) * (xx - cx) + (cx - bx) * (yy - cy)) / d
            l2 = ((cy - ay) * (xx - cx) + (ax - cx) * (yy - cy)) / d
            inside = (l1 >= -0.01) & (l2 >= -0.01) & (1 - l1 - l2 >= -0.01)
            m[y0:y1 + 1, x0:x1 + 1][inside] = 1.0
    # blur: three box passes ≈ gaussian
    for _ in range(3):
        for ax_ in (0, 1):
            c = np.cumsum(np.pad(m, [(blur + 1, blur)] * 1 + [(0, 0)] if ax_ == 0 else [(0, 0), (blur + 1, blur)], mode="edge"), axis=ax_)
            m = (np.take(c, range(2 * blur + 1, c.shape[ax_]), axis=ax_) - np.take(c, range(0, c.shape[ax_] - 2 * blur - 1), axis=ax_)) / (2 * blur + 1)
    return m

def tint(px, mask, rgb, strength):
    a = np.clip(mask * strength, 0, 1)[..., None]
    px[..., :3] = px[..., :3] * (1 - a) + np.array(rgb, np.float32) * a

mat, img = skin_image(basemesh)
if img is not None:
    W, H = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    # warm, deeper complexion (multiply), slightly desaturated
    lum = px[..., :3].mean(-1, keepdims=True)
    px[..., :3] = px[..., :3] * 0.8 + lum * 0.2
    px[..., :3] = np.clip(px[..., :3] * np.array([0.72, 0.57, 0.47], np.float32), 0, 1)
    b = max(3, W // 512)
    w = lambda g, *names: max((g.get(n, 0) for n in names), default=0)
    kohl = region_mask(basemesh, lambda g: w(g, "orbicularis03.L", "orbicularis03.R", "orbicularis04.L", "orbicularis04.R") > 0.35, W, H, b)
    tint(px, kohl, (0.045, 0.03, 0.03), 0.9)
    stub = region_mask(basemesh, lambda g: w(g, "jaw") > 0.5 or w(g, "oris01", "oris02", "oris03.L", "oris03.R", "oris05", "oris06") > 0.4, W, H, b * 3)
    noise = np.random.default_rng(7).random((H, W)).astype(np.float32)
    tint(px, stub * (0.55 + 0.45 * noise), (0.13, 0.1, 0.09), 0.55)
    kohl_n, stub_n, lips = int(kohl.sum()), int(stub.sum()), []
    new = bpy.data.images.new("shakuni_skin", W, H, alpha=False)
    new.pixels = px.ravel()
    new.filepath_raw = "//shakuni_skin.jpg"; new.file_format = "JPEG"
    for n in mat.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image == img: n.image = new
    for n in mat.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            n.inputs["Roughness"].default_value = 0.55
            if "Specular IOR Level" in n.inputs: n.inputs["Specular IOR Level"].default_value = 0.35
    print("SKIN painted", W, H, kohl_n, stub_n)
else:
    print("WARN skin image not found")

# ── 4. expression shape keys (runtime morph targets) ──────────────────────
EXPR = {
    "blink_L": ("eye-left-closure", 1.0), "blink_R": ("eye-right-closure", 1.0),
    "squint_L": ("eye-left-slit", 1.0), "squint_R": ("eye-right-slit", 1.0),
    "brow_up_L": ("eyebrows-left-up", 1.0), "brow_up_R": ("eyebrows-right-up", 1.0),
    "brow_down_L": ("eyebrows-left-down", 1.0), "brow_down_R": ("eyebrows-right-down", 1.0),
    "smile": ("mouth-corner-puller", 1.0), "sneer": ("mouth-upward-retraction", 1.0),
    "mouth_open": ("mouth-open", 1.0), "purse": ("mouth-pursing", 1.0),
    "frown": ("mouth-depression", 1.0),
}
units = os.path.join(LocationService.get_mpfb_data("targets"), "expression", "units", "caucasian")
if not basemesh.data.shape_keys:
    basemesh.shape_key_add(name="Basis", from_mix=False)
for key, (unit, w) in EXPR.items():
    TargetService.load_target(basemesh, os.path.join(units, unit + ".target.gz"), weight=0.0, name=key)

def mhclo_path_for(obj):
    for prop in ("mhclo", "fitting_ref", "asset_source"):
        v = ObjectService.get_object_property(obj, prop) if hasattr(ObjectService, "get_object_property") else None
        if v and str(v).endswith(".mhclo"): return str(v)
    return None

def interpolate_keys(child, mhclo_file):
    """Copy our expression keys onto a fitted child mesh via MHCLO barycentric mapping."""
    m = Mhclo(); m.load(mhclo_file)
    basis = [v.co.copy() for v in basemesh.data.vertices]
    if not child.data.shape_keys: child.shape_key_add(name="Basis", from_mix=False)
    for key in EXPR:
        src = basemesh.data.shape_keys.key_blocks[key]
        moved = []
        for ci, mp in m.verts.items():
            if ci >= len(child.data.vertices): continue
            (v0, v1, v2), (w0, w1, w2) = mp["verts"], mp["weights"]
            off = (src.data[v0].co - basis[v0]) * w0 + (src.data[v1].co - basis[v1]) * w1 + (src.data[v2].co - basis[v2]) * w2
            if off.length > 1e-5: moved.append((ci, off))
        if not moved: continue
        nk = child.shape_key_add(name=key, from_mix=False); nk.value = 0
        for ci, off in moved: nk.data[ci].co = child.data.shape_keys.key_blocks["Basis"].data[ci].co + off

for child, rel in [(lashes, "eyelashes/eyelashes01/eyelashes01.mhclo"), (brows, "eyebrows/eyebrow001/eyebrow001.mhclo")]:
    if child: interpolate_keys(child, os.path.join(DATA, rel))

# ── 4b. eyes, lashes, brows ride rigidly on the head bone ────────────────────
# (interpolated proxy weights spread onto facial bones that don't follow the head,
#  so the eyeballs lagged out of their sockets when he turned his head)
for part in (eyes, lashes, brows, teeth, tongue):
    if part is None: continue
    for g in list(part.vertex_groups): part.vertex_groups.remove(g)
    vg = part.vertex_groups.new(name="head")
    vg.add(range(len(part.data.vertices)), 1.0, "REPLACE")
    # proxies added before the rig never got an armature modifier → exported unskinned
    if not any(m.type == "ARMATURE" for m in part.modifiers):
        mod = part.modifiers.new("Armature", "ARMATURE")
        mod.object = rig

# ── 5. trim: helper geometry ──────────────────────────────────────────────
def delete_verts(obj, predicate):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(obj.data)
    deform = bm.verts.layers.deform.active
    names = {i: g.name for i, g in enumerate(obj.vertex_groups)}
    kill = [v for v in bm.verts if predicate(v, {names[k]: w for k, w in v[deform].items()} if deform else {})]
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode="OBJECT")
    return len(kill)

def is_trash(v, groups):
    # helper geometry only — he keeps his whole body (seated cross-legged at runtime)
    return any(n.startswith(("helper-", "joint-")) and w > 0.5 for n, w in groups.items())
print("deleted", delete_verts(basemesh, is_trash), "verts")
for mod in list(basemesh.modifiers):
    if mod.type != "ARMATURE": basemesh.modifiers.remove(mod)

# ── 5b. costume + hair (costume.py, copied from costume.example.py) ──────────────────────────
if not args.no_costume:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import costume
    costume.use_rig(rig)
    costume.build_hair(basemesh, rig)
    costume.build_turban(basemesh, rig)
    robe = costume.build_robe(basemesh, rig)
    costume.build_shawl_and_jewels(basemesh, robe, rig, shawl=False)

# landmarks for the runtime (glTF space: x, z, -y), metres
for bn in ("root", "pelvis.R", "spine03", "neck01", "head", "jaw", "eye.L", "clavicle.R", "upperarm01.R", "lowerarm01.R", "wrist.R", "upperarm01.L", "lowerarm01.L", "wrist.L"):
    if bn in rig.pose.bones:
        h = rig.matrix_world @ rig.pose.bones[bn].head
        print("BONE", bn, round(h.x, 3), round(h.z, 3), round(-h.y, 3))

# ── 5c. bake object transforms into vertices (glTF ignores a skinned mesh's own
#        node transform; MPFB proxies carry a small offset → eyes left their sockets)
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    mw = o.matrix_world.copy()
    if o.parent is not None:
        o.parent = None
    o.matrix_world = mw
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for m in o.modifiers:
        if m.type == "ARMATURE": m.object = rig
    print("BAKED", o.name, [round(x, 3) for x in mw.translation])

# ── 6. export ─────────────────────────────────────────────────────────────
for o in bpy.data.objects: o.select_set(o.type in ("MESH", "ARMATURE"))
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.out), export_format="GLB", use_selection=True,
                          export_skins=True, export_morph=True, export_morph_normal=False,
                          export_animations=False, export_yup=True, export_image_format="JPEG",
                          export_jpeg_quality=88, export_apply=False)
print("EXPORTED", args.out)
print("STATS", {o.name: (len(o.data.vertices), len(o.data.polygons), len(o.data.shape_keys.key_blocks) if o.type == "MESH" and o.data.shape_keys else 0)
                for o in bpy.data.objects if o.type == "MESH"})

# ── 7. optional preview render (face close-up, Cycles CPU) ────────────────
if args.preview:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.device = "CPU"
    scene.render.resolution_x = scene.render.resolution_y = 640
    head = rig.pose.bones["head"]
    hpos = rig.matrix_world @ head.head
    target = hpos + Vector((0, 0, 0.06))
    cam_data = bpy.data.cameras.new("cam"); cam_data.lens = 70
    cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam)
    cam.location = target + Vector((0.3, -0.95, -0.05))
    target.z -= 0.08
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    for loc, energy, color in [((1.2, -1.6, 1.9), 160, (1, 0.78, 0.55)), ((-1.8, -1.2, 1.6), 40, (0.6, 0.7, 1)), ((0, 1.8, 2.0), 120, (1, 0.9, 0.8))]:
        ld = bpy.data.lights.new("l", "AREA"); ld.energy = energy; ld.color = color; ld.size = 1.5
        lo = bpy.data.objects.new("l", ld); lo.location = Vector(loc) + hpos * 0
        lo.location.z += hpos.z - 1.6
        lo.rotation_euler = (hpos - lo.location).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(lo)
    world = bpy.data.worlds.new("w"); world.color = (0.05, 0.04, 0.035); scene.world = world
    scene.render.filepath = os.path.abspath(args.preview)
    bpy.ops.render.render(write_still=True)
    print("PREVIEW", args.preview)
