# Renderiza quadros de cada animacao (rapido, Workbench) pra conferir as poses.
import bpy, os, json, math
from mathutils import Vector
D = os.path.dirname(bpy.data.filepath)
OUT = os.path.join(D, "previa_anim"); os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene; ARM = bpy.data.objects["Esqueleto_Motoboy"]
eng = sc.render.engine; rx, ry = sc.render.resolution_x, sc.render.resolution_y; fp = sc.render.filepath
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"; sc.display.shading.color_type = "MATERIAL"
sc.display.shading.show_shadows = True; sc.display.shading.show_cavity = True
sc.render.resolution_x, sc.render.resolution_y = 300, 380
cam = bpy.data.objects.get("CamPrevia")
if not cam:
    cam = bpy.data.objects.new("CamPrevia", bpy.data.cameras.new("CamPrevia")); sc.collection.objects.link(cam)
cam.data.lens = 50
pos = Vector((2.6, -5.6, 1.55)); cam.location = pos
cam.rotation_euler = (Vector((0, 0, 0.98)) - pos).to_track_quat("-Z", "Y").to_euler()
old = sc.camera; sc.camera = cam
SHOTS = json.load(open(os.path.join(D, "_shots.json")))
for name, frames in SHOTS.items():
    ARM.animation_data.action = bpy.data.actions["MB_" + name]
    for f in frames:
        sc.frame_set(f)
        sc.render.filepath = os.path.join(OUT, "%s_%03d.png" % (name, f))
        bpy.ops.render.render(write_still=True)
sc.camera = old; sc.render.engine = eng; sc.render.resolution_x, sc.render.resolution_y = rx, ry; sc.render.filepath = fp
ARM.animation_data.action = bpy.data.actions["MB_Parado"]
open(os.path.join(D, "_render_ok.txt"), "w").write("ok")
print("RENDER OK")
