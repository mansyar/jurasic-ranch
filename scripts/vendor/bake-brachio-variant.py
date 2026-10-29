"""Draco-compress the baked Brachiosaurus GLB (second half of the bake).

The Node bake (scripts/vendor/bake-brachio-variant.js) builds the pastel variant
from the vendored module, grafts Polyfork's own authored Idle/Walk/Run clips
from the published asset GLB, and exports that to an uncompressed temp GLB;
three's GLTFExporter has no Draco writer, so this pass imports that file into a
clean headless Blender scene and re-exports it with
KHR_draco_mesh_compression.

Usage:
    blender --background --python scripts/vendor/bake-brachio-variant.py -- <in.glb> <out.glb>

Prints the imported armature/action/material counts so the bake log shows what
was compressed. Refuses to write when no armature survives the import.
"""

import sys

import bpy


def main() -> None:
    args = sys.argv
    in_path = args[-2]
    out_path = args[-1]
    if in_path == out_path or "--" not in args:
        raise SystemExit("usage: blender --background --python bake-brachio-variant.py -- <in.glb> <out.glb>")

    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    bpy.ops.import_scene.gltf(filepath=in_path)

    armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    actions = sorted(a.name for a in bpy.data.actions)
    materials = sorted(m.name for m in bpy.data.materials)
    print(f"bake-brachio-variant: armatures={len(armatures)} actions={actions} materials={materials}")
    if not armatures:
        raise SystemExit("no armature imported; refusing to write output")

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_draco_mesh_compression_enable=True,
    )
    print(f"bake-brachio-variant: wrote {out_path}")


main()
