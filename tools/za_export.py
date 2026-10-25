# Blender skript: z Z-Anatomy (Startup.blend) vyexportuje kosti kostry a body popisků (landmarky).
#   blender -b Startup.blend --python za_export.py -- <výstupní složka>
# Výstup: obj/<jméno>.obj (svět, metry, Z nahoru; materiál plochy v řádcích "g"),
#         landmarks.tsv  jméno<TAB>x y z<TAB>x y z – oba konce čáry popisku (jeden leží na kosti).
# (Přenosný Blender nemá celou standardní knihovnu Pythonu, proto žádný json.)
import bpy, sys, os

out = sys.argv[sys.argv.index('--') + 1]
os.makedirs(os.path.join(out, 'obj'), exist_ok=True)
dg = bpy.context.evaluated_depsgraph_get()


def skeletal(ob):
    return any('1: Skeletal' in c.name for c in ob.users_collection)


n = 0
for ob in bpy.data.objects:
    if ob.type != 'MESH' or not skeletal(ob) or len(ob.data.polygons) == 0:
        continue
    me = ob.evaluated_get(dg).to_mesh()
    mw = ob.matrix_world
    mats = [m.name if m else '' for m in ob.data.materials]
    with open(os.path.join(out, 'obj', ob.name.replace(' ', '_').replace('/', '_') + '.obj'), 'w', encoding='utf-8') as f:
        f.write("# Z-Anatomy '%s' (CC BY-SA 4.0)\n" % ob.name)
        for v in me.vertices:
            w = mw @ v.co
            f.write("v %.6f %.6f %.6f\n" % (w.x, w.y, w.z))
        cur = None
        for p in me.polygons:
            if p.material_index != cur:
                cur = p.material_index
                f.write("g %s\n" % (mats[cur] if cur < len(mats) else cur))
            idx = list(p.vertices)
            for k in range(1, len(idx) - 1):
                f.write("f %d %d %d\n" % (idx[0] + 1, idx[k] + 1, idx[k + 1] + 1))
    n += 1

lm = 0
with open(os.path.join(out, 'landmarks.tsv'), 'w', encoding='utf-8') as f:
    for ob in bpy.data.objects:
        if ob.type == 'MESH' and ob.name.endswith('.j') and len(ob.data.vertices) >= 1:
            me = ob.evaluated_get(dg).to_mesh()
            mw = ob.matrix_world
            pts = ['%.6f %.6f %.6f' % tuple(mw @ v.co) for v in me.vertices]
            f.write(ob.name[:-2] + '\t' + '\t'.join(pts) + '\n')
            lm += 1
print('EXPORTED', n, 'meshes', lm, 'landmarks')
