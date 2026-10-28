# PR — Baby Trike Turn Fix (20261029-baby-trike-turn-fix)

- Base: main | Head: feat/20261029-baby-trike-turn-fix
- Type: feature (pastel baby bake + turn rework; fixes the reported stop-jitter)

## Summary

Supersedes the Track 1 runtime pastel remap with a build-time baked baby:
`scripts/bake-trike-variant.js` pins the Polyfork `createAsset()` call
(size 0.6, horns 0.7, noseHorn 0.6, rayed frill, pastel hexes) and writes a
committed 85 KB Draco GLB (single material, 0.8 s Waddle, blush-safe Head
node); `pastel.ts` is deleted. Stride is retimed to the baby legs by
sampling the shipped clip (0.29 m / 0.3625 m/s, all four feet within slide
tolerance). Turning is fully reworked into slow stroller arcs (90° ≈ 1.04 s,
180° ≈ 1.93 s, translation never pauses) with a 0.03 stop-blend deadband
that freezes heading for a bit-identical halt — the reported
jitter-when-almost-stopped is closed by construction plus regression test.
Also in: loading placeholder rescaled to the ~3.8 m baby footprint, lint
output quietened (quote fix), tablet-60fps allocation-free turn math.

## Test report

- `pnpm verify` green: oxlint (quiet) + oxfmt --check + tsrs --noEmit +
  vitest 62/62 (6 files) + vite build
- PWA precache 10 entries (app shell + trike.glb + 3 Draco decoder files)
- Coverage gate: 60% new-code (new code fully asserted; `@vitest/coverage-v8`
  not installed so no coverage % measured — recorded gap, same as Track 1)
- Review: PASS (round 1 PASS WITH FINDINGS → all 4 fixed in R1, re-verified)

## Media

No automated screenshots in this environment (headless). Human follow-up:
manual tablet video (walk toggle, 180° turn feel, pastel look,
airplane-mode reload) to be attached by the parent-reviewer before merge.

## Human follow-ups before merge

- Manual tablet video: arc liveliness, pastel baby look, 72 px button taps
- Airplane-mode second visit walks from precache
- Parent-voice review of status-pill wording
- 4-beat gait note (Phase 2 evidence) is a future-tuning candidate, not a blocker
