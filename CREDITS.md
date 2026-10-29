# Credits

## Triceratops base model

- Asset: Triceratops (`triceratops-base`), Polyfork low-poly animal, 2700 tris, one material.
- Source: https://polyfork.dev/asset/triceratops-base
- Vendored: `assets/trike/triceratops-base.glb`; baked game file `public/models/trike.glb`
  (baked size-0.6 baby variant: rayed shield, short horns, pastel colors,
  retimed 0.8 s `Waddle` clip, Draco-compressed).
- License: commercial use allowed, no attribution required. No redistribution of the
  standalone files; vendoring into this game counts as use, not redistribution.
  See https://polyfork.dev/licensing.

## Stegosaurus base model

- Asset: Stegosaurus (`stegosaurus-base`), Polyfork low-poly animal, 2858 tris, one material.
- Source: https://polyfork.dev/asset/stegosaurus-base
- Mesh and palette: `scripts/vendor/stegosaurus-base.mjs` and
  `scripts/vendor/stegosaurus-base-params.json`, called at authored proportions
  (`size: 1.0`) with the pastel colourway; baked game file `public/models/stego.glb`
  (pastel-coloured, Draco-compressed).
- Clips: the published asset GLB (`https://polyfork.dev/cdn/stegosaurus-base.glb`),
  which is the only place Polyfork ships its authored animation. Its `Idle`,
  `Walk` and `Run` are grafted verbatim (name, duration, keyframes) onto the
  baked rig. Not derived from the Trike.
- License: commercial use allowed, no attribution required. No redistribution of the
  standalone files; vendoring into this game counts as use, not redistribution.
  See https://polyfork.dev/licensing.

## Brachiosaurus base model

- Asset: Brachiosaurus (`brachiosaurus-base`), Polyfork low-poly animal, 2910 tris, one material.
- Source: https://polyfork.dev/asset/brachiosaurus-base
- Mesh and palette: `scripts/vendor/brachiosaurus-base.mjs` and
  `scripts/vendor/brachiosaurus-base-params.json`, called at authored proportions
  (`size: 1.0`) with the lavender-blush pastel colourway; baked game file
  `public/models/brachio.glb` (pastel-coloured, Draco-compressed). Gameplay size
  is a viewer group scale, never a bake knob.
- Clips: the published asset GLB (`https://polyfork.dev/cdn/brachiosaurus-base.glb`).
  Its `Idle`, `Walk` and `Run` are grafted verbatim onto the baked rig, so all 35
  bones — including the neck and tail chains — move on the sauropod's own
  authored motion. Not derived from the Trike.
- License: commercial use allowed, no attribution required. No redistribution of the
  standalone files; vendoring into this game counts as use, not redistribution.
  See https://polyfork.dev/licensing.
