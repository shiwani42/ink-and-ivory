"""
TEMPLATE: costume and hair built procedurally in Blender and skinned to the MPFB rig
(one example character's costume; adapt garments, headwear, colours). Copy next to build_human.py
as costume.py (build_human.py does `import costume`).

Everything here is original geometry and texture (no third-party assets):
- beard + moustache: alpha hair cards rooted on the chin / upper lip
- turban (pagdi): skull cap + wrapped twisted bands + sarpech jewel + plume
- angarkha robe: offset copy of the torso/arms with smart-UV brocade and gold trim
- shawl: a ribbon draped from the left shoulder across the chest
- pearl mala + gold ear hoops
"""
import bpy, bmesh, math, random
import numpy as np
from mathutils import Vector, Matrix, kdtree, bvhtree

R = random.Random(11)


# ── helpers ────────────────────────────────────────────────────────────────
BONES = set()


def use_rig(rig):
    BONES.clear()
    BONES.update(b.name for b in rig.data.bones)


def groups_of(obj):
    """Per-vertex {bone: weight}, bone groups only (MPFB also adds helper/body groups)."""
    names = {g.index: g.name for g in obj.vertex_groups}
    return [{names[g.group]: g.weight for g in v.groups if not BONES or names[g.group] in BONES} for v in obj.data.vertices]


def dominant(g):
    return max(g.items(), key=lambda kv: kv[1])[0] if g else ""


def new_image(name, arr):
    """arr: HxWx4 float 0..1, origin bottom-left."""
    H, W = arr.shape[:2]
    img = bpy.data.images.new(name, W, H, alpha=True)
    img.pixels = arr.astype(np.float32).ravel()
    img.file_format = "PNG"
    img.pack()
    return img


def make_material(name, *, color=(1, 1, 1, 1), image=None, metallic=0.0, roughness=0.6, alpha_from_image=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if image is not None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha_from_image:
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    return m


def mesh_object(name, verts, faces, uvs=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    if uvs is not None:
        uvl = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li, vi in zip(poly.loop_indices, poly.vertices):
                uvl.data[li].uv = uvs[vi]
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def skin_like(obj, src, rig, fixed_group=None):
    """Bind obj to rig: copy weights from the nearest src vertex, or one fixed bone."""
    mw = src.matrix_world
    if fixed_group:
        vg = obj.vertex_groups.new(name=fixed_group)
        vg.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    else:
        kd = kdtree.KDTree(len(src.data.vertices))
        for i, v in enumerate(src.data.vertices):
            kd.insert(mw @ v.co, i)
        kd.balance()
        sg = groups_of(src)
        cache = {}
        for v in obj.data.vertices:
            _, i, _ = kd.find(obj.matrix_world @ v.co)
            for name, w in sg[i].items():
                if w < 0.01:
                    continue
                g = cache.get(name) or obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
                cache[name] = g
                g.add([v.index], w, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    obj.parent = rig


def bone_world(rig, name, tail=False):
    b = rig.pose.bones[name]
    return rig.matrix_world @ (b.tail if tail else b.head)


# ── procedural textures ────────────────────────────────────────────────────
def hair_card_texture(W=256, H=512, color=(0.035, 0.028, 0.025), grey=0.14, seed=3):
    """Strands with alpha; v=0 root (thick), v=1 tip (thin)."""
    rng = np.random.default_rng(seed)
    a = np.zeros((H, W), np.float32)
    col = np.zeros((H, W, 3), np.float32)
    ys = np.arange(H) / H
    for _ in range(140):
        x0 = rng.uniform(0.05, 0.95) * W
        drift = rng.uniform(-0.12, 0.12) * W
        length = rng.uniform(0.55, 1.0)
        width = rng.uniform(0.8, 2.2)
        g = rng.random() < grey
        c = np.array([0.42, 0.4, 0.38]) if g else np.array(color) * rng.uniform(0.7, 1.3)
        for yi in range(int(length * H)):
            t = yi / H
            x = x0 + drift * t * t
            xi = int(x)
            fade = (1 - t / length) ** 0.6
            for dx in range(-2, 3):
                xx = xi + dx
                if 0 <= xx < W:
                    v = max(0.0, 1 - abs(x - xx) / width) * fade
                    if v > a[yi, xx]:
                        a[yi, xx] = v
                        col[yi, xx] = c
    arr = np.zeros((H, W, 4), np.float32)
    arr[..., :3] = col
    arr[..., 3] = np.clip(a * 1.3, 0, 1)
    return arr


def brocade_texture(S=1024, base=(0.16, 0.05, 0.14), gold=(0.86, 0.66, 0.3), seed=5):
    """Silk brocade: deep base with small gold buta (paisley-ish) motifs on a diagonal lattice."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
    arr = np.zeros((S, S, 4), np.float32)
    # silk sheen + weave
    weave = 0.04 * np.sin(xx * S * 1.7) * np.sin(yy * S * 1.9)
    arr[..., :3] = np.array(base) * (1 + weave[..., None])
    n = 8
    m = np.zeros((S, S), np.float32)
    for i in range(n):
        for j in range(n):
            cx = (i + 0.5 * (j % 2)) / n
            cy = (j + 0.5) / n
            dx = ((xx - cx + 0.5) % 1) - 0.5
            dy = ((yy - cy + 0.5) % 1) - 0.5
            # paisley-ish: teardrop = circle + offset tail
            r1 = np.sqrt((dx * n) ** 2 + (dy * n * 1.1) ** 2)
            tail = np.sqrt(((dx * n) - 0.18) ** 2 + ((dy * n) - 0.18) ** 2)
            shape = np.clip(1.0 - np.minimum(r1 / 0.22, tail / 0.12), 0, 1)
            ring = np.clip(1.0 - np.abs(r1 - 0.3) / 0.025, 0, 1)
            m = np.maximum(m, np.maximum(shape, ring * 0.8))
    arr[..., :3] = arr[..., :3] * (1 - m[..., None]) + np.array(gold) * m[..., None]
    arr[..., 3] = 1
    return arr


def zari_border_texture(W=1024, H=128, base=(0.72, 0.52, 0.2), dark=(0.25, 0.05, 0.07)):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    arr = np.zeros((H, W, 4), np.float32)
    arr[..., :3] = base
    stripe = ((yy > H * 0.18) & (yy < H * 0.82)).astype(np.float32)
    diamonds = (np.abs(((xx / (H * 0.7)) % 1) - 0.5) + np.abs(yy / H - 0.5) < 0.28).astype(np.float32)
    inner = stripe * (1 - diamonds)
    arr[..., :3] = arr[..., :3] * (1 - inner[..., None] * 0.75) + np.array(dark) * inner[..., None] * 0.75
    arr[..., 3] = 1
    return arr


def turban_texture(S=512, base=(0.36, 0.06, 0.08), stripe=(0.85, 0.62, 0.25)):
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S
    arr = np.zeros((S, S, 4), np.float32)
    s = (np.abs(((yy * 6) % 1) - 0.5) < 0.06).astype(np.float32)
    fine = 0.06 * np.sin(xx * 400) * np.sin(yy * 380)
    arr[..., :3] = np.array(base) * (1 + fine[..., None])
    arr[..., :3] = arr[..., :3] * (1 - s[..., None]) + np.array(stripe) * s[..., None]
    arr[..., 3] = 1
    return arr


# ── pieces ────────────────────────────────────────────────────────────────
def build_hair(basemesh, rig):
    """Pointed goatee + curled moustache from alpha hair cards."""
    mw = basemesh.matrix_world
    gs = groups_of(basemesh)
    head = bone_world(rig, "head")
    jaw = bone_world(rig, "jaw")
    verts = basemesh.data.vertices
    basemesh.data.calc_normals_split() if hasattr(basemesh.data, "calc_normals_split") else None
    co = [mw @ v.co for v in verts]
    nrm = [(mw.to_3x3() @ v.normal).normalized() for v in verts]
    # landmarks from geometry: the nose tip is the most forward point of the face
    face = [p for p, g in zip(co, gs) if dominant(g) in ("head", "jaw") or any(k.startswith(("oris", "levator", "risorius", "special")) for k in g)]
    nose = min(face, key=lambda p: p.y)
    mouth_z = nose.z - 0.032
    chin_tip = min((p for p in face if abs(p.x) < 0.012 and p.y < nose.y + 0.05), key=lambda p: p.z)
    goatee_pt = chin_tip + Vector((0, -0.014, -0.075))
    roots_g, roots_m = [], []
    for i, p in enumerate(co):
        if nrm[i].y > -0.2 or abs(p.y - nose.y) > 0.06:  # forward-facing skin on the front of the face
            continue
        if p.z < mouth_z - 0.012 and p.z > chin_tip.z - 0.004 and abs(p.x) < 0.028:
            roots_g.append(i)
        elif nose.z - 0.026 < p.z < nose.z - 0.012 and 0.004 < abs(p.x) < 0.026:
            roots_m.append(i)
    V, F, UV = [], [], []

    def card(root, n, direction, length, width, curl=0.0, side=0.0):
        d = direction.normalized()
        wv = d.cross(n).normalized() * width
        seg = 4
        pts = []
        p = root + n * 0.0015
        dd = d.copy()
        for k in range(seg + 1):
            pts.append(p.copy())
            dd = (dd + Vector((side * curl, 0, curl * 0.6)) * (1.0 / seg)).normalized()
            p = p + dd * (length / seg)
        base = len(V)
        for k, q in enumerate(pts):
            taper = 1 - 0.75 * (k / seg)
            V.append(q - wv * taper * 0.5)
            V.append(q + wv * taper * 0.5)
            UV.append((0.0, k / seg))
            UV.append((1.0, k / seg))
        for k in range(seg):
            a = base + 2 * k
            F.append((a, a + 1, a + 3, a + 2))

    for i in R.choices(roots_g, k=min(260, 4 * len(roots_g))) if roots_g else []:
        root = co[i]
        to_pt = (goatee_pt - root)
        direction = to_pt.normalized() * 0.75 + nrm[i] * 0.25
        length = min(0.085, to_pt.length * (0.85 + R.random() * 0.3))
        card(root + Vector((R.uniform(-0.003, 0.003), 0, R.uniform(-0.003, 0.003))), nrm[i], direction, length, 0.008 + R.random() * 0.004, curl=0.15, side=R.uniform(-1, 1))
    # moustache: many short, fine strands sweeping out and down, tips curling up (a courtly twirl)
    for i in R.choices(roots_m, k=min(220, 3 * len(roots_m))) if roots_m else []:
        root = co[i] + Vector((R.uniform(-0.002, 0.002), 0, R.uniform(-0.002, 0.002)))
        sgn = 1 if root.x >= 0 else -1
        reach = min(1.0, abs(root.x) / 0.022)
        direction = Vector((sgn * (0.55 + 0.4 * reach), -0.3, -0.55 + 0.25 * reach))
        card(root, nrm[i], direction, 0.018 + 0.022 * reach + R.random() * 0.006, 0.0045, curl=1.6 * reach, side=sgn)
    ob = mesh_object("Shakuni_Beard", V, F, UV)
    img = new_image("beard_strands", hair_card_texture())
    ob.data.materials.append(make_material("hair_beard", image=img, roughness=0.62, alpha_from_image=True))
    skin_like(ob, basemesh, rig)
    print("HAIR cards", len(F) // 4, "goatee roots", len(roots_g), "moustache roots", len(roots_m))
    return ob


def pagdi_texture(W=1024, H=128, base=(0.30, 0.05, 0.10), gold=(0.88, 0.66, 0.28)):
    """One wrap of cloth: plum silk, gold zari borders along both edges, fine weave + a twill sheen."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = yy / H
    arr = np.zeros((H, W, 4), np.float32)
    weave = 0.07 * np.sin(xx * 1.9) * np.sin(yy * 2.3) + 0.05 * np.sin((xx + yy) * 0.35)
    arr[..., :3] = np.array(base) * (1 + weave[..., None])
    edge = ((v < 0.09) | (v > 0.91)).astype(np.float32)
    inner = ((np.abs(v - 0.14) < 0.012) | (np.abs(v - 0.86) < 0.012)).astype(np.float32)
    dots = ((np.abs(((xx / 22) % 1) - 0.5) < 0.12) & (np.abs(v - 0.5) < 0.03)).astype(np.float32)
    m = np.clip(edge + inner + dots * 0.8, 0, 1)
    arr[..., :3] = arr[..., :3] * (1 - m[..., None]) + np.array(gold) * m[..., None]
    arr[..., 3] = 1
    return arr


def ribbon(V, F, UV, path, widths, ups, outs, thick=0.004, u_scale=6.0):
    """Closed-section ribbon along path (list of Vectors) with per-point width/up/outward."""
    base = len(V)
    L = 0.0
    for k, p in enumerate(path):
        if k: L += (p - path[k - 1]).length
        w = widths[k] * 0.5
        up, out = ups[k], outs[k]
        for (a, b) in ((-w, 0), (w, 0), (w, thick), (-w, thick)):
            V.append(p + up * a + out * b)
        u = L * u_scale
        UV.extend([(u, 0.0), (u, 1.0), (u, 1.0), (u, 0.0)])
    n = len(path)
    for k in range(n - 1):
        a, b = base + 4 * k, base + 4 * (k + 1)
        F.append((a + 3, a + 2, b + 2, b + 3))  # outer face (gets the cloth)
        F.append((a, a + 3, b + 3, b))
        F.append((a + 1, b + 1, b + 2, a + 2))


def build_turban(basemesh, rig):
    """Pagdi: one long gold-bordered band wound round the head, crossing at the front, plus a fanned
    crest (turra), a sarpech jewel and a plume. Rigid on the head bone."""
    mw = basemesh.matrix_world
    gs = groups_of(basemesh)
    head_pts = [mw @ v.co for v, g in zip(basemesh.data.vertices, gs) if dominant(g) == "head"]
    xs = [p.x for p in head_pts]; ys = [p.y for p in head_pts]; zs = [p.z for p in head_pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2 + 0.006
    top = max(zs)
    rx, ry = (max(xs) - min(xs)) / 2 * 1.08, (max(ys) - min(ys)) / 2 * 1.06
    z0 = top - 0.062  # just above the brow line, forehead stays visible
    V, F, UV = [], [], []
    turns = 6
    seg = 72
    for k in range(turns):
        tilt = (1 if k % 2 == 0 else -1) * 0.022  # alternate crossing at the front (θ = -90°: front is -y)
        grow = 1.0 + 0.035 * k
        z = z0 + 0.016 * k
        path, widths, ups, outs = [], [], [], []
        for j in range(seg + 1):
            th = 2 * math.pi * j / seg
            fold = 0.0025 * math.sin(th * 9 + k)  # soft cloth folds
            r = grow + fold / rx
            p = Vector((cx + rx * r * math.cos(th), cy + ry * r * math.sin(th),
                        z + tilt * -math.sin(th) + 0.004 * math.sin(th * 3 + k)))
            out = Vector((math.cos(th) / rx, math.sin(th) / ry, 0)).normalized()
            up = Vector((0, 0, 1)) - out * 0.15
            path.append(p); widths.append(0.034 + 0.006 * math.sin(th * 2 + k)); ups.append(up.normalized()); outs.append(out)
        ribbon(V, F, UV, path, widths, ups, outs)
    # crown: a domed cap of cloth on top
    crown_z = z0 + 0.016 * turns
    rings, segs = 8, 48
    cbase = len(V)
    for i in range(rings + 1):
        a = (i / rings) * (math.pi / 2)
        for j in range(segs):
            th = 2 * math.pi * j / segs
            rr = math.cos(a)
            V.append(Vector((cx + rx * 1.18 * rr * math.cos(th), cy + ry * 1.18 * rr * math.sin(th), crown_z + 0.045 * math.sin(a))))
            UV.append((j / segs * 4, i / rings))
    for i in range(rings):
        for j in range(segs):
            a = cbase + i * segs + j
            b = cbase + i * segs + (j + 1) % segs
            F.append((a, b, b + segs, a + segs))
    # turra: a fan of three folded cloth tails rising at the front-left
    fx, fy = cx + rx * 0.35, cy - ry * 1.1
    for t in range(3):
        path, widths, ups, outs = [], [], [], []
        ang = math.radians(-18 + 18 * t)
        for j in range(12):
            s_ = j / 11
            p = Vector((fx + math.sin(ang) * 0.05 * s_, fy - 0.01 * s_, crown_z - 0.01 + 0.075 * s_ + 0.01 * math.sin(s_ * 3)))
            path.append(p); widths.append(0.03 * (1 - 0.6 * s_)); ups.append(Vector((1, 0, 0))); outs.append(Vector((0, -1, 0)))
        ribbon(V, F, UV, path, widths, ups, outs, thick=0.003)
    turban = mesh_object("Shakuni_Turban", V, F, UV)
    bpy.context.view_layer.objects.active = turban
    turban.select_set(True)
    bpy.ops.object.shade_smooth()
    turban.data.materials.append(make_material("silk_turban", image=new_image("pagdi", pagdi_texture()), roughness=0.4))

    # sarpech: gold setting + ruby + pearl drops + plume, at the front centre
    front = Vector((cx, cy - ry * 1.2, z0 + 0.04))
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.017, depth=0.005, location=front, rotation=(math.pi / 2, 0, 0))
    parts.append((bpy.context.active_object, "gold"))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.01, location=front + Vector((0, -0.005, 0)))
    ruby = bpy.context.active_object; ruby.scale = (1, 0.55, 1.2); parts.append((ruby, "ruby"))
    for k in range(5):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.0035,
                                             location=front + Vector((0.012 * (k - 2), -0.004, -0.02 - 0.004 * (2 - abs(k - 2)))))
        parts.append((bpy.context.active_object, "pearl"))
    for k in range(6):
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.005, radius2=0.0006, depth=0.12,
                                        location=front + Vector((0.003 * (k - 2.5), 0.006, 0.07)))
        f = bpy.context.active_object
        f.rotation_euler = (math.radians(-14 - 2 * k), math.radians(5 * (k - 2.5)), 0)
        f.scale = (1, 0.3, 1)
        parts.append((f, "plume"))
    mats = {"gold": make_material("gold", color=(0.95, 0.72, 0.32, 1), metallic=1.0, roughness=0.22),
            "ruby": make_material("ruby", color=(0.55, 0.02, 0.06, 1), metallic=0.1, roughness=0.06),
            "pearl": make_material("pearl_s", color=(0.94, 0.91, 0.86, 1), roughness=0.15),
            "plume": make_material("plume", color=(0.96, 0.93, 0.86, 1), roughness=0.75)}
    for o, m in parts:
        o.data.materials.append(mats[m])
    bpy.ops.object.select_all(action="DESELECT")
    for o, _ in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0][0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    jewel = bpy.context.active_object
    jewel.name = "Shakuni_Sarpech"
    for o in (turban, jewel):
        skin_like(o, basemesh, rig, fixed_group="head")
    print("TURBAN", len(turban.data.vertices), "verts")
    return turban, jewel


ROBE_BONES = ("spine", "clavicle", "shoulder01", "upperarm", "lowerarm01", "pelvis", "root", "breast", "upperleg", "lowerleg", "neck01")


def build_robe(basemesh, rig):
    """Offset copy of torso + arms → silk angarkha with gold trim on every open edge."""
    gs = groups_of(basemesh)
    keep = set()
    for i, g in enumerate(gs):
        d = dominant(g)
        # angarkha + dhoti: torso, upper arms, forearm to mid-length (bare wrists), hips, legs; bare feet
        if d.startswith(ROBE_BONES) and not d.startswith(("foot", "toe", "lowerarm02")):
            keep.add(i)
    robe = basemesh.copy()
    robe.data = basemesh.data.copy()
    robe.name = "Shakuni_Robe"
    bpy.context.scene.collection.objects.link(robe)
    if robe.data.shape_keys:
        robe.shape_key_clear()
    for m in list(robe.modifiers):
        if m.type != "ARMATURE":
            robe.modifiers.remove(m)
    robe.data.materials.clear()
    bpy.context.view_layer.objects.active = robe
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(robe.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in keep], context="VERTS")
    bm.normal_update()
    for v in bm.verts:
        z = v.co.z
        push = 0.022 if z < 0.9 else (0.016 if z < 1.1 else 0.011)  # baggy dhoti, roomier below the chest
        v.co += v.normal * push
    # smooth the shell a little so it reads as cloth, not skin
    bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.6, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # trim: faces touching an open edge, two rings deep
    edge_faces = set()
    ring = {e for e in bm.edges if e.is_boundary}
    verts = {v for e in ring for v in e.verts}
    for _ in range(2):
        faces = {f for v in verts for f in v.link_faces}
        edge_faces |= faces
        verts = {v for f in faces for v in f.verts}
    bm.faces.index_update()
    trim_ids = {f.index for f in edge_faces}
    bmesh.update_edit_mesh(robe.data)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01)
    bpy.ops.object.mode_set(mode="OBJECT")
    for luv in robe.data.uv_layers.active.data:  # tile the brocade: small motifs like real cloth
        luv.uv = (luv.uv[0] * 7.0, luv.uv[1] * 7.0)
    silk = make_material("silk_robe", image=new_image("robe_brocade", brocade_texture()), roughness=0.38)
    trim = make_material("zari_trim", image=new_image("zari", zari_border_texture()), metallic=0.85, roughness=0.32)
    robe.data.materials.append(silk)
    robe.data.materials.append(trim)
    for p in robe.data.polygons:
        p.material_index = 1 if p.index in trim_ids else 0
    robe.parent = rig
    print("ROBE", len(robe.data.vertices), "verts", len(trim_ids), "trim faces")
    return robe


def build_shawl_and_jewels(basemesh, robe, rig, shawl=True):
    """Shawl ribbon across the chest + pearl mala, projected onto the robe surface."""
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = bvhtree.BVHTree.FromObject(robe, dg)
    neck = bone_world(rig, "neck01")
    l_sh = bone_world(rig, "upperarm01.L")
    r_hip = bone_world(rig, "pelvis.R")
    chest_z = bone_world(rig, "spine03").z

    def on_surface(p, push=0.006):
        hit = bvh.ray_cast(p + Vector((0, -0.4, 0)), Vector((0, 1, 0)))
        if hit[0] is None:
            return p
        return hit[0] + hit[1] * push

    shawl_obj = None
    path = []
    N = 22
    a = l_sh + Vector((0, 0, 0.04))
    b = r_hip + Vector((0, 0, 0.06))
    for k in range(N + 1):
        t = k / N
        p = a.lerp(b, t)
        p.z += math.sin(math.pi * t) * 0.03
        path.append(on_surface(p, 0.007))
    V, F, UV = [], [], []
    width = 0.12 if shawl else 0.0
    for k, p in enumerate(path):
        tangent = (path[min(k + 1, N)] - path[max(k - 1, 0)]).normalized()
        side = tangent.cross(Vector((0, -1, 0))).normalized() * width * 0.5
        V += [p - side, p + side]
        UV += [(0, k / 4), (1, k / 4)]
        if k:
            i = 2 * k
            F.append((i - 2, i - 1, i + 1, i))
    if shawl:
        shawl_obj = mesh_object("Shakuni_Shawl", V, F, UV)
        shawl_obj.data.materials.append(make_material("zari_shawl", image=new_image("shawl_zari", zari_border_texture(base=(0.78, 0.6, 0.26), dark=(0.42, 0.06, 0.1))), metallic=0.6, roughness=0.35))
        skin_like(shawl_obj, robe, rig)

    # pearl mala: a U from collarbone to collarbone, dipping to mid-chest
    pearls = []
    left = bone_world(rig, "clavicle.L", tail=True)
    right = bone_world(rig, "clavicle.R", tail=True)
    M = 46
    for k in range(M):
        t = k / (M - 1)
        p = left.lerp(right, t)
        p.z -= math.sin(math.pi * t) * (left.z - chest_z) * 0.9 + 0.02
        q = on_surface(p, 0.009)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.0055 if k % 6 else 0.008, location=q)
        pearls.append(bpy.context.active_object)
    bpy.ops.object.select_all(action="DESELECT")
    for o in pearls:
        o.select_set(True)
    bpy.context.view_layer.objects.active = pearls[0]
    bpy.ops.object.join()
    mala = bpy.context.active_object
    mala.name = "Shakuni_Mala"
    bpy.ops.object.shade_smooth()
    mala.data.materials.append(make_material("pearl", color=(0.93, 0.9, 0.84, 1), roughness=0.18, metallic=0.05))
    skin_like(mala, robe, rig)
    print("SHAWL", len(F), "MALA", M)
    return shawl_obj, mala
