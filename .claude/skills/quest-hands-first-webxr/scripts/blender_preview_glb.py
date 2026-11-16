"""
Render a quick three-quarter preview of any GLB, to review a model (or compare
before and after a change) without loading the app.

  blender -b --python blender_preview_glb.py -- <model.glb> <out.png> [distance]

Prints the bounding box (metres, Blender Z-up) so size mistakes show up too.
"""
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
glb, out = args[0], args[1]
dist = float(args[2]) if len(args) > 2 else 0.0

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
sc.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 960, 540
world = bpy.data.worlds.new('w')
sc.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.8, 0.8, 0.82, 1)

bpy.ops.import_scene.gltf(filepath=glb)
lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
for o in sc.objects:
    if o.type == 'MESH':
        for corner in o.bound_box:
            v = o.matrix_world @ Vector(corner)
            lo = Vector(map(min, lo, v))
            hi = Vector(map(max, hi, v))
print('BBOX', tuple(round(x, 3) for x in lo), tuple(round(x, 3) for x in hi))
centre = (lo + hi) / 2
size = max((hi - lo).length, 0.05)
d = dist or size * 1.3

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
sc.camera = cam
cam.location = centre + Vector((0.6, -0.7, 0.4)).normalized() * d
cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3
sun.rotation_euler = (0.7, 0.2, 0.8)
sc.collection.objects.link(sun)
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
