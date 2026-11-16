"""
Renders a still life of the exported writing-set GLBs for visual review.
  blender -b --python tools/blender/preview.py -- <glb_dir> <hdri.hdr> <out.png>
"""
import math
import os
import sys

import bpy

argv = sys.argv[sys.argv.index('--') + 1:]
GLB, HDRI, OUT = argv[0], argv[1], argv[2]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
scene.view_settings.view_transform = 'AgX' if 'AgX' in [v.identifier for v in scene.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'

world = bpy.data.worlds.new('w')
scene.world = world
world.use_nodes = True
env = world.node_tree.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(HDRI)
world.node_tree.links.new(env.outputs['Color'], world.node_tree.nodes['Background'].inputs['Color'])
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8

# Placement in Blender Z-up metres (glTF import converts from Y-up).
layout = {
    'tabletop': (0, 0, 0, 0),
    'paperweight': (0, 0.16, 0.0, 0),
    'inkstone': (0.21, 0.04, 0.0, 0),
    'brush_rest': (0.21, -0.1, 0.0, 0),
    'brush': (0.21, -0.1, 0.012, 90),
    'water_dropper': (0.29, 0.13, 0.0, 0),
    'seal_set': (-0.2, -0.13, 0.0, 0),
}
for name, (x, y, z, rot) in layout.items():
    path = os.path.join(GLB, f'{name}.glb')
    if not os.path.exists(path):
        continue
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    for o in set(bpy.data.objects) - before:
        if o.parent is None:
            o.location = (o.location.x + x, o.location.y + y, o.location.z + z)
            o.rotation_euler.z += math.radians(rot)

# Paper stand-in.
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.02, 0.0045))
paper = bpy.context.active_object
paper.scale = (0.26, 0.34, 1)
m = bpy.data.materials.new('paper'); m.use_nodes = True
m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.92, 0.89, 0.82, 1)
m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
paper.data.materials.append(m)

cam_data = bpy.data.cameras.new('cam'); cam_data.lens = 35
cam = bpy.data.objects.new('cam', cam_data); scene.collection.objects.link(cam)
cam.location = (0.0, -0.62, 0.42)
direction = (0.06, 0.0, 0.0)
import mathutils
look = mathutils.Vector(direction) - cam.location
cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 2.5; sun.angle = math.radians(8)
so = bpy.data.objects.new('sun', sun); scene.collection.objects.link(so)
so.rotation_euler = (math.radians(50), math.radians(10), math.radians(30))

scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print('RENDERED', OUT)
