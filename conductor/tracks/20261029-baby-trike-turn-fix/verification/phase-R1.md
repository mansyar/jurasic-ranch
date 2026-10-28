# Phase R1 Evidence — Review Fixes (F1–F4)

- Track: `20261029-baby-trike-turn-fix` — Baby Trike Turn Fix
- Phase: R1 — Review Fixes (R1.T1, R1.T2)
- Date: 2026-10-29
- Branch: `feat/20261029-baby-trike-turn-fix`
- Base: `115c470`
- Head: `3710c63`
- Result: **verified**

## Summary

Resolves all four review findings. The loading placeholder is rescaled from
1.3× to 2.6× so its bounding z-length sits in the shipped-GLB 3.3–4.2 m
window (no more ~2× pop on swap); the `turnTo()` doc now describes walk
arcs, the turn-rate doc carries the ~1.63 rad/s derivation, and the
per-foot stride assert binds exactly `STRIDE_TOLERANCE_METRES`.

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| R1.T1 | `110a407` | `fix(viewer): rescale placeholder into baked baby footprint` |
| R1.T2 | `3710c63` | `docs(ranch): arc-turn wording, turn-rate number, honest stride bound` |

## Commands

| Layer | Command | Exit | Summary |
| ----- | ------- | ---- | ------- |
| static + unit + build | `pnpm verify` | 0 | oxlint (only pre-existing vendor-script warnings), oxfmt check clean, tsrs clean, 62/62 vitest, vite build + PWA precache 10 entries |

## Findings disposition

| ID | Fix | Evidence | Status |
| -- | --- | -------- | ------ |
| F1 | Placeholder scale 1.3 → 2.6 (~1.44 m authored × 2.6 ≈ 3.7 m); `~1.9 m` comments updated to the baked ~3.8 m / 3.3–4.2 m window; viewer test now asserts z-length within `[3.3, 4.2]` (mirrors `scripts/check-trike.test.ts`) | `src/viewer/main.ts`, `src/viewer/viewer.test.ts`, `pnpm verify` 62/62 green | fixed |
| F2 | `turnTo()` doc reworded from "turn-in-place" to walk-arc wording | `src/ranch/trike-player.ts` | fixed |
| F3 | Turn-rate doc `~1.45 rad/s` → `~1.63 rad/s` with derivation `min(PI, 4.5 x 0.3625)` (curvature × full-blend speed 0.29 / 0.8) | `src/ranch/waddle.ts` | fixed |
| F4 | Per-foot assert binds exactly `STRIDE_TOLERANCE_METRES` (slack `+ 0.01` dropped); measured travels 0.2900–0.2921 vs coded 0.29 (max diff ~0.002), so the honest bound holds | `tests/waddle/stride.test.ts`, `pnpm verify` stride log | fixed |

## Evidence paths

- `src/viewer/main.ts` — placeholder scale + comments
- `src/viewer/viewer.test.ts` — footprint-in-shipped-window assert
- `src/ranch/trike-player.ts` — arc-turn `turnTo()` doc
- `src/ranch/waddle.ts` — turn-rate doc number + derivation
- `tests/waddle/stride.test.ts` — tightened per-foot bound
- `pnpm verify` transcript in the phase run log (exit 0)

## Deviations

- none (all changes inside Touches; no new files outside the evidence path)

## Notes

- Placeholder rescale keeps the group origin at ground level, so feet stay
  on y = 0; mesh count is unchanged (NFR-3 lightweight holds).
- No product/design decisions needed; no blockers. Evidence file left
  uncommitted for the primary state commit, per track precedent.

## Primary verification (re-review)

- Command: `pnpm verify` (primary run, 2026-10-29) — exit 0; 6 files,
  62/62 tests green (includes the new placeholder-footprint assert).
- Range `115c470..HEAD` is exactly the two reported task commits —
  no squash needed (1:1 task mapping, consistent with Phases 1–3).
- F1 confirmed: placeholder 1.3 → 2.6 with z-window test mirroring
  check-trike bounds. F2/F3/F4 confirmed as worded. No deviations.
- Verdict: all review findings closed → track verdict `PASS`.
