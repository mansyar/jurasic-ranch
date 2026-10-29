# Integrated Verification — Dev Harness for Debugging & Verification

- **Track:** 20261029-dev-harness
- **Branch:** chore/20261029-dev-harness
- **Base:** main @ cb12399
- **Head at verification:** 0df2b98
- **Date:** 2026-10-29

## Strategy run

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` | 0 | oxlint clean across src, tests, scripts |
| static | `pnpm format --check` | 0 | oxfmt reports every matched file formatted |
| static | `pnpm typecheck` | 0 | tsrs clean, including the `.d.mts` declaration for the `.mjs` guard |
| static | `pnpm build` | 0 | vite build, 25 modules, precache 29 entries / 4428.51 KiB |
| static | `node scripts/check-dist-clean.mjs` | 0 | `dist clean: no dev harness markers in dist` |
| unit | `pnpm test` | 0 | 31 files / 290 tests (234 pre-existing + 56 new harness tests) |
| smoke | dev server `/?dev=1` | 0 | panel mounts, `window.__ranch.snapshot()` returns the documented shape, bulldozer-free trio at 0.6928 m pairwise, solo/POV/hint proven live |

## Acceptance criteria across phases

| AC | Phase | Evidence |
| --- | --- | --- |
| AC-1 (gating) | 1 + 2 | `dev-options.test.ts`; live `?dev=1` mount and undefined `window.__ranch` without it |
| AC-2 (panel controls) | 2 | `harness-state.test.ts`; live panel button inventory |
| AC-3 (visibility/solo) | 2 | live `solo("stego")` → `[false, true, false]`, restored without movement |
| AC-4 (pause/step) | 2 | `harness-state.test.ts` proves step consumes exactly N frames and re-pauses (live blocked, see below) |
| AC-5 (HUD) | 2 | `formatHud` unit tests (live fps blocked, see below) |
| AC-6 (forced states) | 2 | `blink.test.ts`; live POV + hint |
| AC-7 (overlays) | 2 | `harness-state.test.ts` overlay toggle; group built from live positions |
| AC-8 (snapshot) | 1 + 2 | `snapshot.test.ts`; live distances 0.6928 m = 120° triangle at r=0.4 |
| AC-9 (determinism) | 1 | seeded-RNG tests; plays the same sequence for the same seed |
| AC-10 (dist clean) | 3 | guard passes in `verify`; planted marker makes it exit 1 |
| AC-11 (no regressions) | 3 | 290 tests green; precache +0.34 KiB from prod-side null checks only |

## Deviations

1. **Brachio gait curvature** carried over from the previous track — not touched here.
2. **`scripts/check-dist-clean.d.mts`** added so strict `tsrs` can type the `.mjs` import in the test; mirrors `scripts/bake-trike-variant.d.ts`.
3. **Precache +0.34 KiB** (4428.17 → 4428.51) from `devFrame`/`random` null-check plumbing in `main.ts`. No harness code or extra chunk is emitted; the guard proves it.

## Untested by automation

- **Live frame-driven behavior** (`step`, sleepy stage, fps HUD, actual movement) could not be observed in the in-app review pane: that tab never composites, so `requestAnimationFrame` never fires and `browser.screenshot` refuses. These paths are covered by unit tests; a human pass on a real browser window is still owed before release. Recorded as debt in review.
