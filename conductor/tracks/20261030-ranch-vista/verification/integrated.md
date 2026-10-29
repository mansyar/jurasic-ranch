# Integrated verification

- Track: `20261030-ranch-vista` — Ranch Vista: Staged Paddock and Sky POV
- Branch: `feat/20261030-ranch-vista`
- Verified at: `2026-10-30`, after Phase 5 accepted and docs synced
- Result: **PASS**

## The gate

| Check | Command | Result |
| --- | --- | --- |
| Full gate | `pnpm verify` | exit 0 - oxlint clean, oxfmt clean, tsrs clean, 617 tests in 50 files, coverage 82.31 % statements / 67.35 % branches / 83.40 % functions, audio pack 15 assets / 853,289 B, `vite build` ok, `dist clean: no dev harness markers in dist` |
| Coverage floor | (inside `pnpm verify`) | 60 % new-code floor held; the phase modules are the best covered in the tree (`ground.ts` 98.56 %, `sky.ts` 100 %) |
| Precache budget | (inside the build) | 63 entries / 6,700.94 KiB, inside the 15 MB offline budget |
| Dist hygiene | `scripts/check-dist-clean.mjs` | no `__ranch`, `data-dev-panel`, `installDevHarness` or `parseDevQuery` in `dist/` |

## What the track claims, and what proves it

| Claim | Proof | Where |
| --- | --- | --- |
| Placements are data, and the twelve shipped props did not move | 22-entry literal snapshot at 1e-9 | `tests/ranch/layout.test.ts` |
| The ground never ends inside a frame | frame-edge rays intersected with `y = 0` for each lens; worst reach 14.643 m against a 48.180 m meadow | `tests/ranch/ground.test.ts` |
| The worn trefoil sits where the trio lives | disc centre = spawn, radius = that gait's wander radius | `tests/ranch/ground.test.ts` |
| Every prop obeys its band and stays out of every lens corridor | band radii derived once, corridors measured per lens | `tests/ranch/dressing.test.ts`, `tests/ranch/rework-1.test.ts` |
| The four cameras frame their subject whole | whole-model box, head included, at the nearest walk-circle stance | `tests/viewer/pov.test.ts` |
| The Sky camera shows the whole ranch with every dino ≥ 72 px | projected disc for 16:10, 3:4 and 1:1; trike ~79 px at 1280×800 | `tests/viewer/pov.test.ts` |
| Every camera can see a cloud | cloud centre projected per lens; ranch sees two, nest one, garden one, sky none (75° never reaches the horizon) | `tests/viewer/sky.test.ts` |
| Props sway, answer a tap, and never touch gameplay | seeded phases, raycast into `RanchDressing` only, state untouched | `tests/ranch/ambient.test.ts` |
| The windpump's colours survive the bake | `COLOR_0` present, `vertexColors` enabled, palette asserted | `tests/ranch/windpump-palette.test.ts` |

## Offline smoke

`pnpm build` then `pnpm preview --host`, loaded at `/?dev=1&seed=42&pause=1` with the
network cut: the shell, the three dinos, all 19 dressing GLBs, the ground, the sky
and the four POV buttons all load from the service-worker precache (63 entries), and
the four cameras switch instantly. The dev panel and `window.__ranch` are absent from
`dist/` by construction.

## Captures

Four 1280×800 shots per round, captured over CDP with the dev panel hidden, because
the headless `--screenshot` path returns a blank WebGL canvas and the in-app browser
refused to shoot while its window was hidden. Script: `.conductor/tools/capture-povs.mjs`
(connect-only; a headless Chrome is started by the shell). Rounds:

- `.conductor/evidence/ranch-vista/before/` - Ranch, Nest, Garden at `aa43e2d`
- `.conductor/evidence/ranch-vista/after/` - the same three plus Sky after Phase 4
- `.conductor/evidence/ranch-vista/after2/` - after Phase 5
- `.conductor/evidence/ranch-vista/after3/` - after rework 1
- `.conductor/evidence/ranch-vista/after4/` - after rework 2, the shots attached to the PR

Each round is what drove the next: the head crop, the magnolia, the lawn, the
grey clouds, the fog patches and the invisible windpump were all found by looking,
not by a test.

## Residual limits, recorded rather than hidden

1. **Wide aspect ratios.** The Sky frame covers the disc plus margin at 16:10, 3:4
   and 1:1. At 2.4:1 its top corners reach ~51 m, about 3 m past the meadow edge.
   The tablet is landscape 16:10, so this is a limit, not a defect.
2. **The sky's horizon tone is authored to match, not measured.** The apron is lit
   and the dome is unlit, so the rendered rim sits a shade brighter than the sky it
   meets. It reads as haze in the captures, which is why it was accepted.
3. **The meadow is pasture, not a park.** Density is 73 placements in three thickets.
   The Sky view still shows a lot of open field; that is the intent, not an
   unfinished pass.
