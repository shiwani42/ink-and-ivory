"""Remove floating fragments from a generated GLB: blender -b -P clean_fragments.py -- in.glb out.glb [min_fraction=0.02]"""
import bpy, bmesh, sys
a = sys.argv[sys.argv.index("--") + 1:]
frac = float(a[2]) if len(a) > 2 else 0.02
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
removed = 0
for o in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    seen, islands = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        stack, isl = [v], []
        seen.add(v.index)
        while stack:
            x = stack.pop(); isl.append(x)
            for e in x.link_edges:
                y = e.other_vert(x)
                if y.index not in seen: seen.add(y.index); stack.append(y)
        islands.append(isl)
    big = max(islands, key=len)
    from mathutils import Vector
    cen = lambda isl: sum((v.co for v in isl), Vector()) / len(isl)
    c0 = cen(big)
    zs = [v.co.z for v in big] + [v.co.y for v in big]
    span = max(max(zs) - min(zs), 1e-3)
    def far(isl):  # fragment lying well outside the main body's footprint
        c = cen(isl); d = c - c0
        return (d.x * d.x + d.y * d.y) ** 0.5 > span * 0.2 and len(isl) < len(big) * 0.2  # horizontal (Blender Z-up)
    kill = [v for isl in islands if (len(isl) < len(big) * frac) or (frac >= 0.1 and far(isl)) for v in isl]
    if frac >= 0.1:  # distance mode: keep small parts that sit on the body
        kill = [v for isl in islands if far(isl) for v in isl]
    removed += len(kill)
    bmesh.ops.delete(bm, geom=kill, context="VERTS"); bm.to_mesh(o.data); bm.free()
bpy.ops.export_scene.gltf(filepath=a[1], export_format="GLB", export_image_format="AUTO")
print("CLEANED removed verts:", removed)
