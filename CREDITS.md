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
  which is the only place Polyfork ships its authored animation. Its `Walk` is
  grafted verbatim (name, duration, keyframes) onto the baked rig. `Idle` and
  `Run` are withdrawn from the game file (cache budget, spec FR-1). Not derived
  from the Trike.
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
  Its `Walk` is grafted verbatim onto the baked rig, so all 35 bones - including
  the neck and tail chains - move on the sauropod's own authored motion. `Idle`
  and `Run` are withdrawn from the game file (cache budget, spec FR-1). Not
  derived from the Trike.
- License: commercial use allowed, no attribution required. No redistribution of the
  standalone files; vendoring into this game counts as use, not redistribution.
  See https://polyfork.dev/licensing.

## Ranch dressing props

Every prop below (nineteen, all reused or newly vendored for the Ranch Vista track) was downloaded from Polyfork's CDN as a GLB by
`scripts/vendor-dressing.mjs` and used unmodified — no rescale, no rebake, no
re-export. Sizes live in `DRESSING_CATALOGUE`
(`src/ranch/layout.ts`), measured from each file's own accessor bounds.

| Asset | Path | Source | License | Vendored |
| --- | --- | --- | --- | --- |
| Hay bale | `public/models/dressing/hay-bale-079e8c.glb` | https://polyfork.dev/asset/hay-bale | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Signpost | `public/models/dressing/signpost-0bf523.glb` | https://polyfork.dev/asset/signpost | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Flower bed | `public/models/dressing/flower-bed-708e73.glb` | https://polyfork.dev/asset/flower-bed | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Berry bush | `public/models/dressing/berry-bush-ee4812.glb` | https://polyfork.dev/asset/berry-bush | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Milk churn | `public/models/dressing/milk-churn-895735.glb` | https://polyfork.dev/asset/milk-churn | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Wooden crate | `public/models/dressing/wooden-crate-e46521.glb` | https://polyfork.dev/asset/wooden-crate | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Log stump | `public/models/dressing/log-stump-1d65a5.glb` | https://polyfork.dev/asset/log-stump | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Garden rock | `public/models/dressing/garden-rock-7f5d60.glb` | https://polyfork.dev/asset/garden-rock | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Plum tree | `public/models/dressing/plum-tree-565179.glb` | https://polyfork.dev/asset/plum-tree | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Club moss mat | `public/models/dressing/club-moss-mat-edcb1b.glb` | https://polyfork.dev/asset/club-moss-mat | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Wildflower | `public/models/dressing/wildflower-68d3a1.glb` | https://polyfork.dev/asset/wildflower | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Mushroom cluster | `public/models/dressing/mushroom-cluster-f2e3ba.glb` | https://polyfork.dev/asset/mushroom-cluster | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Ginkgo leaf litter | `public/models/dressing/ginkgo-leaf-litter-9784e9.glb` | https://polyfork.dev/asset/ginkgo-leaf-litter | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Fern clump | `public/models/dressing/fern-clump-90ff4b.glb` | https://polyfork.dev/asset/fern-clump | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| River reed cluster | `public/models/dressing/river-reed-cluster-cba87e.glb` | https://polyfork.dev/asset/river-reed-cluster | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Cycad | `public/models/dressing/cycad-05ad50.glb` | https://polyfork.dev/asset/cycad | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Tree fern | `public/models/dressing/tree-fern-78320e.glb` | https://polyfork.dev/asset/tree-fern | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| Windpump tower | `public/models/dressing/windpump-tower-1633a9.glb` | https://polyfork.dev/asset/windpump-tower | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |
| River stone cluster | `public/models/dressing/river-stone-cluster-0b55bc.glb` | https://polyfork.dev/asset/river-stone-cluster | Polyfork free licence: commercial use inside a project, no attribution, no redistribution as standalone files ([licensing](https://polyfork.dev/licensing)) | Downloaded as GLB, unmodified |

## Starter-pack audio

All 15 starter-pack files are generated at build time and committed under
`public/audio/`; nothing is fetched at runtime. Every file is mono 44.1 kHz,
128 kbps mp3. Voice lines target −16 LUFS within 1.2 dB (the 0.3 s tail is part
of the measurement); short SFX are peak-normalized where integrated loudness is
not meaningful (`tap`), and all SFX sit below the voice in the mix.

- Voice engine: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), run
  through `kokoro-onnx`. Model license: Apache-2.0. Voice `af_bella`, speed
  `0.85`. The pipeline is `scripts/voice/generate.py`; model weights are
  downloaded for the build and are not redistributed in this repository.
- Music and SFX: original synthesis, no sampled source. Generated by
  `scripts/audio/synth-starter-pack.py` from the committed recipe, and
  **dedicated CC0 1.0 by the project** (use them for anything, no attribution
  required).

| Asset | Path | Source | License | Processing |
| --- | --- | --- | --- | --- |
| `music-kalimba` | `public/audio/music/kalimba-loop.mp3` | Original for Jurasic Ranch | CC0 1.0 (project dedication) | 96 BPM, 16 bars of 4/4 = 40.0 s; note tails wrapped into bar 1 so the loop point is sample-accurate; two-pass loudnorm |
| `coo-trike` | `public/audio/sfx/coo-trike.mp3` | Original for Jurasic Ranch | CC0 1.0 (project dedication) | G3 base coo, soft harmonics and low breath, low-passed; two-pass loudnorm |
| `coo-stego` | `public/audio/sfx/coo-stego.mp3` | Original for Jurasic Ranch | CC0 1.0 (project dedication) | Same coo voice two semitones below Trike (F3), slower; two-pass loudnorm |
| `coo-brachio` | `public/audio/sfx/coo-brachio.mp3` | Original for Jurasic Ranch | CC0 1.0 (project dedication) | Same coo voice three semitones above Trike (A3), longest; two-pass loudnorm |
| `tap` | `public/audio/sfx/tap.mp3` | Original for Jurasic Ranch | CC0 1.0 (project dedication) | Soft wooden tick, pitched body plus low-passed noise, 3.5 kHz ceiling |
| `heart` | `public/audio/sfx/heart.mp3` | Original for Jurasic Ranch | CC0 1.0 (project dedication) | Two soft 60 Hz thumps 0.21 s apart, low-passed at 320 Hz |
| `sparkle` | `public/audio/sfx/sparkle.mp3` | Original for Jurasic Ranch | CC0 1.0 (project dedication) | Three gentle bell notes (E6/G6/C7) with rolled-off highs, 9 kHz ceiling |
| `hello` | `public/audio/voice/hello.mp3` | Kokoro-82M, `af_bella` | Apache-2.0 (model) | Text "Hello!" at speed 0.85, silence trimmed, −16 LUFS, 0.3 s tail |
| `nom` | `public/audio/voice/nom.mp3` | Kokoro-82M, `af_bella` | Apache-2.0 (model) | Text "Nom nom!" at speed 0.85, silence trimmed, −16 LUFS, 0.3 s tail |
| `all-done` | `public/audio/voice/all-done.mp3` | Kokoro-82M, `af_bella` | Apache-2.0 (model) | Text "All done!" at speed 0.85, silence trimmed, −16 LUFS, 0.3 s tail |
| `count-1` | `public/audio/voice/count-1.mp3` | Kokoro-82M, `af_bella` | Apache-2.0 (model) | Text "One" at speed 0.85, silence trimmed, −16 LUFS, 0.3 s tail |
| `count-2` | `public/audio/voice/count-2.mp3` | Kokoro-82M, `af_bella` | Apache-2.0 (model) | Text "Two" at speed 0.85, silence trimmed, −16 LUFS, 0.3 s tail |
| `count-3` | `public/audio/voice/count-3.mp3` | Kokoro-82M, `af_bella` | Apache-2.0 (model) | Text "Three" at speed 0.85, silence trimmed, −16 LUFS, 0.3 s tail |
| `count-4` | `public/audio/voice/count-4.mp3` | Kokoro-82M, `af_bella` | Apache-2.0 (model) | Text "Four" at speed 0.85, silence trimmed, −16 LUFS, 0.3 s tail |
| `count-5` | `public/audio/voice/count-5.mp3` | Kokoro-82M, `af_bella` | Apache-2.0 (model) | Text "Five" at speed 0.85, silence trimmed, −16 LUFS, 0.3 s tail |

The voice texts and the exact generation settings live in
`scripts/voice/lines.json`; `scripts/voice/README.md` documents the one-time
model download and the license notes.
