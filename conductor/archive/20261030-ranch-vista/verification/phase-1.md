# Phase 1 verification — Layout as data

- **Track:** `20261030-ranch-vista`
- **Phase:** 1 (Layout as data)
- **Date:** 2026-10-30
- **Branch:** `feat/20261030-ranch-vista`
- **Base:** `b2c0245db4f85241fe211c862be1a0c2634e8958`
- **Head:** `f4d43104acf8e0909a3756e1996f63885f25ee9c`
- **Result:** PASS

## Commands

| Command | Exit | Output |
| --- | --- | --- |
| `pnpm verify` | 0 | lint clean; oxfmt check clean (85 files); `tsrs --noEmit` clean; vitest 45 files / 509 tests passed with coverage 77.43% lines; audio pack ok; `vite build` ok; `dist` clean |

## Acceptance criteria

| ID | Check | Evidence | Result |
| --- | --- | --- | --- |
| FR-1 | Placements are declared through helpers (`ring`, `arc`, `row`, `cluster`, `scatter`) over a per-file catalogue with `{footprintMetres, heightMetres, band, parent?}`; no banded prop carries a hand-written position array | `src/ranch/layout.ts`, `DRESSING_MANIFEST` in `src/ranch/dressing.ts` (lines 26-105) | pass |
| FR-2 | The phase-1 refactor changes no rendered position | `tests/ranch/layout.test.ts` snapshot compares all 23 placements (file, x/y/z, rotationY) against the pre-refactor hand-written values at 1e-9; `tests/ranch/dressing.test.ts` untouched and still green | pass |
| AC-5 | Placement snapshot identical before/after | Same snapshot test: exit 0 under `pnpm verify` | pass |

## Supporting constraints

- **Band ranges are derived, not typed twice** (NFR-5): `DRESSING_BAND_RANGES` computes `mid` 8.4-10.0 m, `foreground` 11.6-13.8 m, `treeline` 17.8 m+ from `WALK_CLEARANCE_METRES`/`GROUND_RADIUS_METRES` and the derived prop band, snapped inward to a 0.2 m grid. `DRESSING_FOOTPRINT_METRES` is derived from `DRESSING_CATALOGUE`, so footprint and catalogue cannot disagree (asserted in `layout.test.ts`).
- **Scatter is pure in its seed:** local 32-bit xorshift, non-finite seed remapped to 1, zero remapped to `0x9e3779b9`. Tested for same-seed equality, different-seed inequality, area bounds, and that `Math.random` is never called.
- **No behaviour change in `buildDressing`:** signature, per-placement clone, cast/receive shadow flags, `RanchDressing` group name, one load per unique file, and the never-rejecting summary are unchanged; `DRESSING_MANIFEST`, `DRESSING_FOOTPRINT_METRES` and the three radii keep their exported names and values (re-exported from `layout.ts`).
- **Module is side-effect free** and imports only `./avoidance.js`, so it loads in the Node test without WebGL.

## Evidence paths

- `src/ranch/layout.ts` (new: constants, bands, catalogue, placement helpers, seeded scatter)
- `src/ranch/dressing.ts` (manifest rewritten on helpers; loader unchanged)
- `tests/ranch/layout.test.ts` (new: 1e-9 snapshot, helper, scatter and band tests)
- `tests/ranch/dressing.test.ts` (unchanged, all prior assertions passing)

## Deviations

- `cluster` takes an explicit `ClusterProp[]` of `{azimuthDegrees, rotationY}` instead of a plain rotation list with a sequential first azimuth: the shipped river stones are authored 0°, 180°, 90°, 270°, so a sequential helper reordered them and broke AC-5. The explicit form keeps manifest order and is still declarative.
- Measured GLB heights for the catalogue were taken from each file's world-space bounds (node hierarchy composed), not from `CREDITS.md`, which carries no dimensions. Values are rounded to the centimetre for readability; nothing reads them yet.

## Notes

- The catalogue marks all twelve shipped props `mid`, which is where they stand today; the treeline restaging belongs to Phase 3 (prop library), whose plan entry already lists these files.
- `src/ranch/layout.ts` coverage: 95.74% lines / 76.19% branches.
- Frame-identical refactor: no rendered media is attached to the PR, and the PR body should say so.

## Primary verification

Run by the orchestrator after squashing the phase to `a190a1c`.

| Step | Command | Exit | Result |
| --- | --- | --- | --- |
| Formatting (write) | `pnpm format` | 0 | 85 files, tree stayed clean — the subagent's hand formatting needed no correction (its `pnpm format` call was permission-denied) |
| Full gate | `pnpm verify` | 0 | lint clean; oxfmt check clean; `tsrs --noEmit` clean; 509 tests passed; coverage 77.43% lines; audio pack 15 assets / 853,289 B; build ok; `dist clean: no dev harness markers` |
| Touches | `git diff --name-only b2c0245..HEAD` | — | `src/ranch/layout.ts`, `src/ranch/dressing.ts`, `tests/ranch/layout.test.ts`, this file. No unreported file touched; `tests/ranch/dressing.test.ts` deliberately unchanged |
| AC-5 independence | inspection of `tests/ranch/layout.test.ts` | — | the 22-entry snapshot is hardcoded literal floats, not recomputed through the new helpers, so it genuinely pins the pre-refactor values |
| Refactor reality | grep `src/ranch/dressing.ts` for `onRing` / literal `position: [` | — | zero hits: the manifest is composed from helpers, not carried over verbatim |
