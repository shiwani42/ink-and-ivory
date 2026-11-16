"""Remove a generated ground slab under an object, keeping the object's own feet.
blender -b -P remove_ground_slab.py -- in.glb out.glb"""
import bpy, bmesh, sys
from mathutils import Vector
a = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
for o in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
    bm = bmesh.new(); bm.from_mesh(o.data)
    mw = o.matrix_world
    zs = [(mw @ v.co).z for v in bm.verts]; z0, z1 = min(zs), max(zs); h = z1 - z0
    # footprint of the feet: vertices a little above the slab
    feet = [(mw @ v.co) for v in bm.verts if z0 + 0.04 * h < (mw @ v.co).z < z0 + 0.14 * h]
    xs = sorted(p.x for p in feet)
    # split into left/right clusters at the largest gap
    gaps = [(xs[i + 1] - xs[i], i) for i in range(len(xs) - 1)]
    g, i = max(gaps)
    clusters = []
    for part in (feet[:0], ):
        pass
    left = [p for p in feet if p.x <= xs[i]]; right = [p for p in feet if p.x > xs[i]]
    boxes = []
    for c in (left, right):
        if not c: continue
        boxes.append((min(p.x for p in c) - 0.01 * h, max(p.x for p in c) + 0.01 * h, min(p.y for p in c) - 0.01 * h, max(p.y for p in c) + 0.01 * h))
    inside = lambda p: any(b[0] <= p.x <= b[1] and b[2] <= p.y <= b[3] for b in boxes)
    kill = [f for f in bm.faces if all((mw @ v.co).z < z0 + 0.035 * h for v in f.verts) and not inside(mw @ f.calc_center_median())]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(o.data); bm.free()
    print("DESLAB removed faces:", len(kill), "feet boxes:", len(boxes))
bpy.ops.export_scene.gltf(filepath=a[1], export_format="GLB", export_image_format="AUTO")
