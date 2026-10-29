# Phase 2 Verification — Valley + Farm Dressing

- Track: 20261029-ranch-warmth-ui
- Phase: 2 (Valley + Farm Dressing)
- Date: 2026-10-29
- Branch: feat/20261029-ranch-warmth-ui
- Base: f64709f
- Head: b20564f
- Result: verified

## Summary

`src/ranch/dressing.ts` loads the 12 vendored CC0 GLBs (one GLTFLoader fetch
per unique file, cloned per placement, 23 instances), falls back silently per
file offline, and boots non-blocking from `src/viewer/main.ts`. No
`vite.config.ts` change was needed: the existing workbox glob already covers
`*.glb`. Full `pnpm verify` passes; all 12 GLBs appear in the built precache
manifest.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` (oxlint) | 0 | clean |
| static | `pnpm format --check` (oxfmt) | 0 | all matched files correct |
| static | `pnpm typecheck` (tsrs --noEmit) | 0 | clean |
| unit | `pnpm test` (vitest run) | 0 | 15 files, 142 tests passed (16 new dressing tests) |
| build | `pnpm build` (vite + PWA) | 0 | built; precache 28 entries (4305.99 KiB); `dist/sw.js` + `dist/workbox-*.js` generated |
| phase | `pnpm verify` | 0 | all of the above in one run |

## Size / precache report (P2.T4)

Vendored bytes per file (primary-vendored ground truth, re-asserted at test
time by `statSync` + 15 MB budget check in `tests/ranch/dressing.test.ts`):

| File | Bytes | Tris | Size |
| --- | --- | --- | --- |
| wooden-fence-section-d72055.glb | 29,576 | 248 | 2x1.1x0.23m |
| farm-gate-8ab320.glb | 63,744 | 542 | 2x1.2x0.28m |
| water-trough-df3ced.glb | 44,188 | 376 | 1.6x0.5x0.6m |
| hand-water-pump-448037.glb | 73,740 | 626 | ~1m |
| stone-well-b2dfcd.glb | 70,828 | 600 | ~1x1.75m |
| corn-crop-b71f2f.glb | 81,996 | 690 | crop row piece |
| ginkgo-tree-baa895.glb | 196,424 | 1,080 | tree |
| dawn-redwood-001c29.glb | 156,352 | 892 | tree |
| flowering-magnolia-dd76cb.glb | 113,712 | 934 | flowering tree |
| fern-covered-boulder-2e0375.glb | 167,080 | 807 | boulder |
| river-stone-cluster-0b55bc.glb | 55,640 | 476 | stone cluster |
| moss-covered-stump-7253ab.glb | 100,064 | 815 | stump |
| **Total** | **1,153,344 (~1.1 MB)** | **8,086 (~8k)** | — |

- PWA budget: 1,153,344 < 15,000,000 bytes — well under NFR-2, no follow-up needed.
- Precache entries after build: **28** (4305.99 KiB total). All **12/12**
  dressing GLBs present in `dist/sw.js` `precacheAndRoute` with revision
  hashes (10 visible + `corn-crop-b71f2f`, `dawn-redwood-001c29` confirmed by
  targeted manifest greps); all 12 files copied to `dist/models/dressing/`.
- fps: no new draw-call risk beyond 23 low-poly clones (~8k tris); tablet
  60 fps gate stays a manual play check (human-only exception).

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-3 | Ranch boots offline with ground + fences + nest + garden markers visible, no missing GLB | `buildDressing` places 23 instances (3 trees, boulder, stump, 3 fences + gate, trough + pump + well, 6 corn in 2 rows, 4-stone nest ring); per-file silent fallback; 12/12 GLBs precached | pass |
| FR-3 | Valley ground/trees/rocks + Farm fences/trough/nest markers, precached offline | layout invariant tests (outside 0.8 m walk circle, inside 6 m ground, clear of POV near-planes); precache manifest greps | pass |
| NFR-1 | 60fps, pixelRatio cap, NoToneMapping daylight | `main.ts` tone mapping untouched; dressing adds only static meshes with shadows | pass |
| NFR-2 | PWA offline, size reported | size table above; budget test; 28-entry precache | pass |
| NFR-4 | Pastel one-material Polyfork style, no ACES, CC0 | vendored files untouched; no runtime recolor; no new deps | pass |

## Evidence paths

- `tests/ranch/dressing.test.ts` (16 tests: manifest-on-disk, layout invariants, loader fallback, precache + wiring)
- `src/ranch/dressing.ts` (`buildDressing`, `DRESSING_MANIFEST`, `DressingSummary`)
- `dist/sw.js` precache manifest (12/12 dressing URLs, build artifact, gitignored)
- `dist/models/dressing/` (12 copied GLBs, build artifact, gitignored)

## Deviations

None. `vite.config.ts` required no change (existing `**/*.{...glb...}`
glob already precaches `public/models/dressing/*.glb`); `public/models/dressing/*`
binaries were read (tests) but never modified.

## Notes

- Dressing GLBs carry no Draco extensions (verified by content grep), so
  `buildDressing` uses a plain `GLTFLoader` — no decoder download, no new dep.
- All 23 placements sit at y = 0, outside the 0.8 m dino wander circle,
  inside the 6 m ground circle, and >0.5 m from every POV camera position
  (near-plane is 0.1 m).
- Viewer boots dressing with `void buildDressing(scene).catch(...)` in
  parallel with the dino loads; `buildDressing` itself never rejects on GLB
  failure (resolves with `failedFiles`), so the ranch stays playable bare.
