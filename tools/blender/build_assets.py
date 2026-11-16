"""
Builds the writing-set models for Hands of a Master and exports them as GLB.

Run (from the project root):
  blender -b --python tools/blender/build_assets.py -- <texture_dir> <out_dir>

texture_dir must contain (CC0, Poly Haven / ambientCG):
  bamboo_veneer_diff.jpg, bamboo_veneer_nor.jpg, bamboo_veneer_rough.jpg
  black_walnut_veneer_01_diff.jpg, black_walnut_veneer_01_nor.jpg, black_walnut_veneer_01_rough.jpg

Every model: metres, base at y = 0, centred on its footprint, low-poly with
bevelled edges so it reads well up close in passthrough, PBR materials.
"""
import math
import os
import sys

import bmesh
import bpy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
TEX = argv[0] if len(argv) > 0 else 'textures'
OUT = argv[1] if len(argv) > 1 else 'public/models'
os.makedirs(OUT, exist_ok=True)


# ---------------------------------------------------------------- helpers
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def image(name):
    path = os.path.join(TEX, name)
    return bpy.data.images.load(path, check_existing=True)


def material(name, color=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, maps=None, scale=1.0, emission=None):
    """Principled material; `maps` = (diffuse, normal, rough) file names for image-based PBR."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = 1.0
    if maps:
        uv = nt.nodes.new('ShaderNodeTexCoord')
        mapping = nt.nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (scale, scale, scale)
        nt.links.new(uv.outputs['UV'], mapping.inputs['Vector'])
        diff, nor, rgh = maps
        if diff:
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = image(diff)
            nt.links.new(mapping.outputs['Vector'], t.inputs['Vector'])
            if color != (1, 1, 1):
                mix = nt.nodes.new('ShaderNodeMix')
                mix.data_type = 'RGBA'
                mix.blend_type = 'MULTIPLY'
                mix.inputs['Factor'].default_value = 1.0
                nt.links.new(t.outputs['Color'], mix.inputs['A'])
                mix.inputs['B'].default_value = (*color, 1)
                nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
            else:
                nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
        if nor:
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = image(nor)
            t.image.colorspace_settings.name = 'Non-Color'
            nt.links.new(mapping.outputs['Vector'], t.inputs['Vector'])
            nm = nt.nodes.new('ShaderNodeNormalMap')
            nt.links.new(t.outputs['Color'], nm.inputs['Color'])
            nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
        if rgh:
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = image(rgh)
            t.image.colorspace_settings.name = 'Non-Color'
            nt.links.new(mapping.outputs['Vector'], t.inputs['Vector'])
            nt.links.new(t.outputs['Color'], bsdf.inputs['Roughness'])
    return m


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def bevel(obj, width=0.002, segments=3):
    mod = obj.modifiers.new('bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    return mod


def smooth(obj, angle=40):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def box(name, sx, sy, sz, z0=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    o.location.z = z0 + sz / 2
    return o


def lathe(name, profile, segments=40):
    """Revolve a list of (radius, z) points around Z. Returns the object (with UVs)."""
    bm = bmesh.new()
    rings = []
    for i in range(segments + 1):
        a = 2 * math.pi * i / segments
        ring = [bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile]
        rings.append(ring)
    uv_layer = bm.loops.layers.uv.new()
    total = sum(math.dist(profile[k], profile[k + 1]) for k in range(len(profile) - 1)) or 1
    acc = [0.0]
    for k in range(len(profile) - 1):
        acc.append(acc[-1] + math.dist(profile[k], profile[k + 1]))
    for i in range(segments):
        for k in range(len(profile) - 1):
            f = bm.faces.new((rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1]))
            uvs = [(i / segments, acc[k] / total), ((i + 1) / segments, acc[k] / total),
                   ((i + 1) / segments, acc[k + 1] / total), (i / segments, acc[k + 1] / total)]
            for loop, uv in zip(f.loops, uvs):
                loop[uv_layer].uv = uv
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    smooth(o)
    return o


def uv_cube(obj, scale=1.0):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=scale)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)


def export(name, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = os.path.join(OUT, f'{name}.glb')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_image_format='WEBP',
        export_image_quality=82,
        export_draco_mesh_compression_enable=False,  # Blender's libdraco is not available on every machine; models are small
    )
    tris = 0
    for o in objects:
        if o.type == 'MESH':
            dg = bpy.context.evaluated_depsgraph_get()
            tris += sum(len(p.vertices) - 2 for p in o.evaluated_get(dg).data.polygons)
    print(f'EXPORTED {name}: {os.path.getsize(path) // 1024} KB, ~{tris} tris')


# ---------------------------------------------------------------- materials (recreated per scene)
def mats():
    return {
        'bamboo': material('bamboo', (0.92, 0.82, 0.62), 0.55, maps=('bamboo_veneer_diff.jpg', 'bamboo_veneer_nor.jpg', 'bamboo_veneer_rough.jpg'), scale=1.0),
        'walnut': material('walnut', (0.42, 0.28, 0.18), 0.42, maps=('black_walnut_veneer_01_diff.jpg', 'black_walnut_veneer_01_nor.jpg', 'black_walnut_veneer_01_rough.jpg'), scale=1.0),
        'horn': material('horn', (0.03, 0.025, 0.02), 0.25),
        'bristle': material('bristle', (0.86, 0.82, 0.74), 0.85),
        'ink': material('ink', (0.008, 0.008, 0.01), 0.06),
        'stone': material('stone', (0.028, 0.03, 0.034), 0.5),
        'stone_polish': material('stone_polish', (0.05, 0.055, 0.06), 0.3),
        'gold': material('gold', (0.83, 0.62, 0.28), 0.32, metal=1.0),
        'celadon': material('celadon', (0.62, 0.74, 0.66), 0.18),
        'porcelain': material('porcelain', (0.93, 0.93, 0.9), 0.15),
        'cobalt': material('cobalt', (0.12, 0.22, 0.55), 0.18),
        'vermilion': material('vermilion', (0.62, 0.07, 0.04), 0.7),
        'jade': material('jade', (0.36, 0.5, 0.4), 0.28),
        'cord': material('cord', (0.55, 0.06, 0.05), 0.8),
        'brass': material('brass', (0.78, 0.6, 0.32), 0.35, metal=1.0),
    }


# ---------------------------------------------------------------- 1. brush (fude) on its side, +X = tip
def build_brush():
    reset(); M = mats()
    L = 0.19  # handle length
    handle = lathe('brush_handle', [(0.0, 0.0), (0.0042, 0.0), (0.0044, 0.002)] +
                   [(0.0044 + (0.0006 if abs(z - n) < 0.002 else 0), z) for z in [i * 0.004 for i in range(1, int(L / 0.004))] for n in [min([0.05, 0.11, 0.165], key=lambda q: abs(q - z))]] +
                   [(0.0045, L), (0.0, L)], segments=24)
    assign(handle, M['bamboo'])
    ferrule = lathe('brush_ferrule', [(0.0, L), (0.0052, L), (0.0056, L + 0.004), (0.0056, L + 0.012), (0.0, L + 0.012)], segments=24)
    assign(ferrule, M['horn'])
    # Bristle tuft: belly then a fine point; the last 40% is soaked in ink.
    tuft_white = lathe('brush_tuft', [(0.0, L + 0.012), (0.0055, L + 0.012), (0.0062, L + 0.02), (0.0058, L + 0.026), (0.0, L + 0.026)], segments=24)
    assign(tuft_white, M['bristle'])
    tuft_ink = lathe('brush_tip', [(0.0, L + 0.026), (0.0058, L + 0.026), (0.005, L + 0.034), (0.003, L + 0.042), (0.0008, L + 0.048), (0.0, L + 0.05)], segments=24)
    assign(tuft_ink, M['ink'])
    # Hanging loop at the end of the handle.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.004, minor_radius=0.0008, location=(0, 0, -0.003), rotation=(math.pi / 2, 0, 0))
    loop = bpy.context.active_object
    loop.name = 'brush_loop'
    assign(loop, M['cord'])
    parts = [handle, ferrule, tuft_white, tuft_ink, loop]
    # Lay it along +X (tip toward +X), resting on its side: radius ~0.0062 above the surface.
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = handle
    bpy.ops.object.join()
    brush = bpy.context.active_object
    brush.name = 'brush'
    brush.rotation_euler = (0, math.pi / 2, 0)
    bpy.ops.object.transform_apply(rotation=True)
    # centre on X, base at z=0
    xs = [v.co.x for v in brush.data.vertices]
    zs = [v.co.z for v in brush.data.vertices]
    cx = (min(xs) + max(xs)) / 2
    for v in brush.data.vertices:
        v.co.x -= cx
        v.co.z -= min(zs)
    export('brush', [brush])


# ---------------------------------------------------------------- 2. brush rest (fudeoki): three ceramic peaks
def build_brush_rest():
    reset(); M = mats()
    bm = bmesh.new()
    # Profile in XZ: three rounded peaks, extruded along Y.
    pts = []
    W = 0.07
    for i in range(61):
        x = -W / 2 + W * i / 60
        t = (x + W / 2) / W
        z = 0.008 + 0.009 * (0.5 + 0.5 * math.cos(t * 2 * math.pi * 3 + math.pi)) ** 1.4
        pts.append((x, z))
    depth = 0.018
    front = [bm.verts.new((x, -depth / 2, z)) for x, z in pts]
    back = [bm.verts.new((x, depth / 2, z)) for x, z in pts]
    fb = [bm.verts.new((x, -depth / 2, 0)) for x, _ in pts]
    bb = [bm.verts.new((x, depth / 2, 0)) for x, _ in pts]
    for i in range(len(pts) - 1):
        bm.faces.new((front[i], front[i + 1], back[i + 1], back[i]))  # top
        bm.faces.new((fb[i], fb[i + 1], front[i + 1], front[i]))      # front wall
        bm.faces.new((back[i], back[i + 1], bb[i + 1], bb[i]))        # back wall
        bm.faces.new((bb[i], bb[i + 1], fb[i + 1], fb[i]))            # bottom
    bm.faces.new((fb[0], front[0], back[0], bb[0]))
    bm.faces.new((front[-1], fb[-1], bb[-1], back[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('brush_rest')
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('brush_rest', me)
    bpy.context.collection.objects.link(o)
    bevel(o, 0.002, 3)
    smooth(o, 50)
    assign(o, M['celadon'])
    export('brush_rest', [o])


# ---------------------------------------------------------------- 3. inkstone (suzuri) with ink pool
def build_inkstone():
    reset(); M = mats()
    W, D, H = 0.075, 0.125, 0.018
    stone = box('inkstone', W, D, H)
    bevel(stone, 0.004, 3)
    # Carve: a shallow grinding surface (oka) and a deep well (umi) at the far end.
    cut1 = box('cut_oka', W - 0.016, D - 0.03, 0.01, H - 0.003)
    cut1.location.y = 0.004
    cut2 = box('cut_umi', W - 0.016, 0.032, 0.02, H - 0.012)
    cut2.location.y = -(D / 2) + 0.024
    for c in (cut1, cut2):
        mod = stone.modifiers.new(c.name, 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = c
        c.hide_set(True)
    bpy.context.view_layer.objects.active = stone
    for mod in list(stone.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for c in (cut1, cut2):
        bpy.data.objects.remove(c)
    smooth(stone, 35)
    uv_cube(stone, 0.1)
    assign(stone, M['stone'])
    # Ink: a glossy pool in the well, a thin wet film on the grinding slope.
    pool = box('ink_pool', W - 0.018, 0.03, 0.0015, H - 0.0105)
    pool.location.y = -(D / 2) + 0.024
    assign(pool, M['ink'])
    film = box('ink_film', W - 0.02, 0.035, 0.0004, H - 0.0029)
    film.location.y = -0.012
    assign(film, M['ink'])
    # Ink stick (sumi) resting across the grinding surface, with a gold band.
    stick = box('ink_stick', 0.016, 0.07, 0.009, H - 0.003)
    stick.location = (0.006, 0.018, H - 0.003 + 0.0045)
    stick.rotation_euler.z = math.radians(12)
    bevel(stick, 0.0015, 2)
    assign(stick, M['ink'])
    band = box('stick_band', 0.0165, 0.012, 0.0092, H - 0.003)
    band.location = (0.0058, 0.035, H - 0.003 + 0.0046)
    band.rotation_euler.z = math.radians(12)
    assign(band, M['gold'])
    export('inkstone', [stone, pool, film, stick, band])


# ---------------------------------------------------------------- 4. water dropper (suiteki)
def build_water_dropper():
    reset(); M = mats()
    body = lathe('dropper', [(0.0, 0.0), (0.016, 0.0), (0.0215, 0.006), (0.022, 0.012), (0.018, 0.019), (0.006, 0.023), (0.0035, 0.025), (0.0025, 0.0255), (0.0, 0.0255)], segments=40)
    assign(body, M['porcelain'])
    # Cobalt band painted around the shoulder.
    band = lathe('dropper_band', [(0.0222, 0.0105), (0.0224, 0.012), (0.0222, 0.0135)], segments=40)
    assign(band, M['cobalt'])
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0022, depth=0.012, location=(0.019, 0, 0.017), rotation=(0, math.radians(55), 0), vertices=12)
    spout = bpy.context.active_object
    spout.name = 'spout'
    assign(spout, M['porcelain'])
    export('water_dropper', [body, band, spout])


# ---------------------------------------------------------------- 5. seal (hanko) and paste dish (inniku)
def build_seal_set():
    reset(); M = mats()
    seal = box('seal', 0.02, 0.02, 0.052)
    bevel(seal, 0.0025, 3)
    smooth(seal, 35)
    assign(seal, M['jade'])
    face = box('seal_face', 0.0185, 0.0185, 0.0012)
    assign(face, M['vermilion'])
    dish = lathe('paste_dish', [(0.0, 0.0), (0.018, 0.0), (0.024, 0.004), (0.026, 0.012), (0.0235, 0.0125), (0.0215, 0.006), (0.0, 0.006)], segments=40)
    assign(dish, M['porcelain'])
    paste = lathe('paste', [(0.0, 0.006), (0.0214, 0.006), (0.021, 0.009), (0.0, 0.0105)], segments=40)
    assign(paste, M['vermilion'])
    for o in (dish, paste):
        o.location.x = 0.04
    export('seal_set', [seal, face, dish, paste])


# ---------------------------------------------------------------- 6. paperweight (bunchin): walnut with brass caps
def build_paperweight():
    reset(); M = mats()
    bar = box('paperweight', 0.22, 0.014, 0.012)
    bevel(bar, 0.003, 3)
    smooth(bar, 35)
    uv_cube(bar, 0.25)
    assign(bar, M['walnut'])
    caps = []
    for s in (-1, 1):
        cap = box('cap', 0.006, 0.0145, 0.0125)
        cap.location.x = s * (0.11 - 0.004)
        bevel(cap, 0.001, 2)
        assign(cap, M['brass'])
        caps.append(cap)
    export('paperweight', [bar] + caps)


# ---------------------------------------------------------------- 7. fallback tabletop: walnut, bevelled
def build_tabletop():
    reset(); M = mats()
    top = box('tabletop', 0.9, 0.6, 0.032, -0.032)
    bevel(top, 0.006, 4)
    smooth(top, 35)
    uv_cube(top, 0.9)
    assign(top, M['walnut'])
    apron = box('apron', 0.82, 0.52, 0.06, -0.092)
    assign(apron, M['walnut'])
    uv_cube(apron, 0.9)
    export('tabletop', [top, apron])


for fn in (build_brush, build_brush_rest, build_inkstone, build_water_dropper, build_seal_set, build_paperweight, build_tabletop):
    try:
        fn()
    except Exception as e:  # keep going; report which failed
        import traceback
        traceback.print_exc()
        print('FAILED', fn.__name__, e)
print('ALL_DONE')

# ---------------------------------------------------------------- 8. keyboard (A3 to C5), keys as named nodes
# Keyboard-local (Blender Z up): x along the keys, -y away from the player
# (glTF: +z toward the player), key tops at z = 0.012 (white) / 0.022 (black).
WHITE = ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
BLACK_AFTER = {'A3': 'As3', 'C4': 'Cs4', 'D4': 'Ds4', 'F4': 'Fs4', 'G4': 'Gs4', 'A4': 'As4'}
KW, KGAP, KL, KH = 0.030, 0.0012, 0.12, 0.012     # white key width, gap, length, height
BW, BL, BH = 0.017, 0.075, 0.010                    # black key width, length, height above white


def build_keyboard():
    reset(); M = mats()
    ivory = material('ivory', (0.93, 0.9, 0.84), 0.32)
    ebony = material('ebony', (0.025, 0.022, 0.02), 0.18)
    felt = material('felt_red', (0.42, 0.05, 0.04), 0.95)
    objs = []
    n = len(WHITE)
    total = n * KW
    x0 = -total / 2 + KW / 2
    for i, note in enumerate(WHITE):
        k = box(f'key_{note}', KW - KGAP, KL, KH)
        k.location = (x0 + i * KW, 0.0, KH / 2)
        bevel(k, 0.0012, 2)
        smooth(k, 35)
        assign(k, ivory)
        objs.append(k)
        if note in BLACK_AFTER:
            b = box(f'key_{BLACK_AFTER[note]}', BW, BL, BH)
            b.location = (x0 + i * KW + KW / 2, (KL - BL) / 2, KH + BH / 2)
            bevel(b, 0.0015, 2)
            smooth(b, 35)
            assign(b, ebony)
            objs.append(b)
    # Walnut case: key bed, back rail with a red felt strip, cheeks.
    bed = box('case_bed', total + 0.03, KL + 0.05, 0.006, -0.006)
    bed.location.y = 0.012
    uv_cube(bed, 0.4); assign(bed, M['walnut']); objs.append(bed)
    rail = box('case_rail', total + 0.03, 0.045, 0.032)
    rail.location.y = KL / 2 + 0.024
    bevel(rail, 0.004, 3); smooth(rail, 35); uv_cube(rail, 0.4); assign(rail, M['walnut']); objs.append(rail)
    strip = box('case_felt', total, 0.006, 0.004, 0.012)
    strip.location.y = KL / 2 + 0.0
    assign(strip, felt); objs.append(strip)
    for sgn in (-1, 1):
        cheek = box('case_cheek', 0.015, KL + 0.05, 0.03)
        cheek.location = (sgn * (total / 2 + 0.0075), 0.012, 0.015)
        bevel(cheek, 0.004, 3); smooth(cheek, 35); uv_cube(cheek, 0.2); assign(cheek, M['walnut']); objs.append(cheek)
    # Blender +Y is away from the player; glTF export maps Blender -Y to +Z (toward the player).
    export('keyboard', objs)


try:
    build_keyboard()
except Exception as e:
    import traceback; traceback.print_exc(); print('FAILED build_keyboard', e)
print('KEYBOARD_DONE')
