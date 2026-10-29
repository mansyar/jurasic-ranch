# Integrated verification - 20261029-authored-dino-walk-clips

- **Branch:** `fix/20261029-authored-dino-walk-clips`
- **Base:** `main` @ `1a96d6b0ba63f3f9e08d0a9592a3ad746fe4960e`
- **Date:** 2026-10-30
- **Phases:** 6 verified (checkpoints `17f6b8a`, `d2a3bcd`, `3dd8e88`, `aac879e`, `05005c8`, `4a4eb62`)

## Gate

| Layer | Command | Result |
| --- | --- | --- |
| format | `pnpm format --check` | pass - 67 files correct |
| lint | `pnpm lint` | pass |
| typecheck | `pnpm typecheck` (`tsrs`) | pass |
| unit | `pnpm test` | pass - 36 files / **349 tests** |
| coverage | `pnpm coverage` | pass - **71.03 % lines** (1106/1557), floor 60 |
| build | `pnpm build` | pass - precache 30 entries / **4,221.80 KiB** |
| dist hygiene | `node scripts/check-dist-clean.mjs` | pass - no dev-harness markers |
| verify | `pnpm verify` | **exit 0** |

## Requirements

| ID | Where it was done | Evidence | Status |
| --- | --- | --- | --- |
| FR-1 | Phases 2 + 6 - authored `Walk` grafted per joint name; loader asks for `Walk` (or the Trike's `Waddle`) and refuses `animations[0]` | `scripts/check-{stego,brachio,dino-clips}.test.ts`, three viewer suites | covered (amended: `Idle`/`Run` withdrawn) |
| FR-2 | Phase 2 - re-bake at `size: 1.0`; Phase 1 proved the module rig equals the official rig | `verification/phase-1.md` (24/24 and 35/35 joints, 0.0000 m), `phase-2.md` | covered |
| FR-3 | Phase 3 - displacement gate ≤ 25 % of rest offset to parent, switchable to any GLB directory | `scripts/check-dino-clips.test.ts` | covered |
| FR-4 | Phase 4 - `IN_GAME_BODY_LENGTH_METRES`, one uniform group scale | `tests/waddle/trio-viewer.test.ts` (in-game size per species) | covered |
| FR-5 | Phase 4 - stride swept from the clips (Stego 1.788 m / 2.4 s, Brachio 1.767 m / 3.8 s) | stride suites + constants test forbidding a copy of `TRIKE_GAIT` | covered |
| FR-6 | Phase 5 - one `LARGEST_DINO_BODY_LENGTH_METRES` drives walk circle, spawn ring, clearance, trigger, far plane | `tests/waddle/dual-wander.test.ts`, `tests/waddle/trio-wander.test.ts`, `tests/viewer/pov.test.ts` | covered |
| FR-7 | Phase 5 - dressing placed by bearing + radius, asserted outside wander + overshoot + half a body | `tests/ranch/dressing.test.ts` | covered |
| FR-8 | Phase 5 - each preset aims at its named animal's placement; prop and animal sightlines asserted | `tests/viewer/pov.test.ts` (three tests) | covered |
| FR-9 | Phases 2 + 6 - CREDITS and bake docblocks name the official GLB as the clip source | `CREDITS.md`, `scripts/vendor/bake-*.js` | covered |
| NFR-1 | Phase 5 - trio peaks 32,805 tris / 100 calls at 1280x800 | `verification/phase-5.md` | covered |
| NFR-2 | Phase 6 - +796 KiB over baseline (4,221.80 vs 3,426 KiB) | `verification/phase-6.md` | covered |
| NFR-3 | Phase 2 + 6 - re-bake twice, identical SHA-256 | `phase-2.md`, `phase-6.md` | covered |
| NFR-4 | Phases 2 + 6 - clips inside the GLBs; no new request | network log in `phase-4.md` | covered |
| NFR-5 | Every phase - pure functions unit-tested, coverage above floor | coverage table above | covered |
| AC-1 | Phase 6 - `Walk` 2.4 s / 3.8 s, no `Waddle`/`Idle`/`Run` | three clip suites | covered |
| AC-2 | Phase 3 - 4 passed on the shipped files, 4 failed on `1a96d6b` (22/24 and 12/35 bones over) | `verification/phase-3.md` | covered |
| AC-3 | Phase 6 - screenshots per species | `.conductor/evidence/phase-6/walk-*.png` | covered |
| AC-4 | Phase 4 - ratios 1.037 and 2.002 | `phase-4.md` | covered |
| AC-5 | Phase 4 - stride suites green, constants test forbids a copied gait | `phase-4.md` | covered |
| AC-6 | Phase 5 - spawn/wander assertions plus per-POV screenshots | `phase-5.md` | covered |
| AC-7 | Phase 5 - three POV screenshots, each framing its animal | `phase-5.md` | covered |
| AC-8 | Phase 6 - CREDITS names the official GLB, no-redistribution kept | `CREDITS.md` | covered |
| AC-9 | This file | `pnpm verify` exit 0 | covered |

## Cross-phase invariants

- **The shipped rigs are still the official rigs.** Phase 1 measured 0.0000 m / 0.000° worst deviation on 24/24 (Stego) and 35/35 (Brachio) joints; Phase 2 re-measured the same after the Draco pass.
- **Displacement, the original defect.** Worst first-frame displacement is now 0.0987 m (Stego `Hips`, 4.2 % of rest offset) and 0.0523 m (Brachio, 1.3 %); the pre-track files had 22/24 and 12/35 bones over the 25 % bound, worst 148.5 %.
- **The clip the viewer plays.** `Walk` on both new species, `Waddle` on the untouched Trike donor bake; the loader refuses to guess when neither is present.
- **Size story in one line.** Trike 3.708 m (anchor), Stego 3.845 m (1.04x), Brachio 7.423 m (2.00x), all drawn by one uniform group scale.
- **Budget.** Precache 3,426 KiB (pre-track, 29 entries) -> 6,873 KiB with three clips -> 4,222 KiB with `Walk` only (30 entries, the extra one being the manifest-adjacent dev-free build's icon set).
- **`dist/` total** 4,341,330 B over 32 files.

## Deviations

| Phase | Deviation | Why it stands |
| --- | --- | --- |
| 1 | Added `scripts/vendor/inspect-dino-clips.d.mts` | tsconfig has no `allowJs`; mirrors the existing `bake-stego-variant.d.ts` convention |
| 2 | Clips injected after the Blender pass, not exported through `GLTFExporter` | the exporter re-times to 24 fps (2.4 s -> 2.375 s) and re-emits TRS for every animated node |
| 2 | `vite.config.ts` precache cap 2 MiB -> 4 MiB | workbox refused `brachio.glb`; smallest change that keeps airplane mode honest |
| 4 | `DINO_GROUP_SCALE` documented in the bake script, not in the params JSON | the params files are verbatim upstream provenance that nothing imports |
| 4 | Temporary separation floors 0.15 m / 0.10 m in two wander suites | superseeded in Phase 5; the 0.25 m bar is back |
| 5 | POV bearings moved (58°, 141.6°, 240°) and `lookAt` retargeted to the named animal | the Garden preset framed the Brachio; found by looking at the screenshots |
| 6 | FR-1 / AC-1 amended: `Idle` and `Run` withdrawn, `Walk` only | `Idle` + `Walk` alone cost +2.86 MiB against a 2 MiB ceiling, and no code path plays either |

## Known debt

- `Idle` and `Run` are not in the game files. A track that wants a resting loop re-bakes with them in `SHIPPED_CLIP_NAMES` and amends NFR-2 with the measured cost.
- The Stego and Brachio bakes are keyed to the published clip names; a Polyfork rename fails the bake loudly (by design) rather than degrading.
- `THREE.Clock` deprecation warning is still in the render loop (pre-existing).
- Coverage of `src/dev/harness.ts` is low by nature; it is exercised end-to-end by `tests/dev/*` and by the screenshots in Phase 5 and 6.
