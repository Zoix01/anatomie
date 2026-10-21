"""Rozbalí z archivu BodyParts3D jen vybraná tělesa (podle ID, např. FMA13303) do cílové složky.

Cesty v archivu používají zpětná lomítka, se kterými si `unzip` neporadí; zipfile ano.
Použití: python extract_obj.py ARCHIV.zip CILOVA_SLOZKA ID [ID ...]
"""
import os
import sys
import zipfile

archive, out_dir, *ids = sys.argv[1:]
wanted = set(ids)
os.makedirs(out_dir, exist_ok=True)
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
        base = name.replace("\\", "/").split("/")[-1]
        if base.endswith(".obj") and base[:-4] in wanted:
            with open(os.path.join(out_dir, base), "wb") as f:
                f.write(z.read(name))
            wanted.discard(base[:-4])
for missing in sorted(wanted):
    print(missing)  # build-model.mjs je nahlásí jako chybějící
