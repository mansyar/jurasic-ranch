# Phase 1 evidence — Brachio gait + trio avoidance unit

- Track: 20261029-brachio-joins-ranch — Brachio Joins the Ranch
- Phase: 1 — Brachio gait + trio avoidance unit
- Date: 2026-10-29
- Branch: feat/20261029-brachio-joins-ranch
- Base: 6260568b4524022be33f3e90c38f46b7adaa0d64
- Head (code): 79cfeafb1a325ebd8ce9012f9e746f93ab6e21e0
  - P1.T1: 41f5aa5 feat(ranch): add BRACHIO_GAIT shuffle config with gait tests
  - P1.T2: 79cfeaf feat(ranch): add trio avoidance with triangle spawn and wander tests
- Result: verified

## Commands

| Layer | Command | Exit | Summary |
| ----- | ------- | ---- | ------- |
| Test (red) | `pnpm test` | 1 | 20 new tests fail as designed (missing BRACHIO_GAIT / trio helpers); 119 existing pass |
| Test (green) | `pnpm test` | 0 | 140/140 pass (17 files), incl. all pre-existing suites unchanged |
| Full | `pnpm verify` | 0 | lint + format-check + typecheck + test + build all pass |

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| -- | --------- | -------- | ------ |
| FR-1 | Brachio moves slower (~0.24 m/s) through the generic DinoPlayer with its own BRACHIO_GAIT; no new player class | `tests/waddle/brachio-gait.test.ts` (shuffle tuning, 0.24 m/s slower than Trike/Stego, no-new-class source scan); `src/ranch/dino-player.ts` BRACHIO_GAIT | Met |
| FR-2 | Trike/Stego behaviour bit-identical | Pinned gait values asserted in `tests/waddle/brachio-gait.test.ts`; all 119 pre-existing tests pass unchanged | Met |
| FR-5 | Triangle spawn 120° offsets; trio wanders from it | `tests/waddle/trio-avoidance.test.ts` (0.4 m radius, 120° gaps, pairwise start >0.4 m); `tests/waddle/trio-wander.test.ts` sim spawns from `trioSpawnPositions()` | Met |
| FR-6 | Pairwise soft-steer <0.4 m extended to 3-way; never stops, no bounce | `tests/waddle/trio-avoidance.test.ts` (clamped-sum identity, ±0.2 cap, coincidence finite, head-on deflection); `tests/waddle/trio-wander.test.ts` (walking every frame, heading steps <0.1 rad) | Met |
| FR-10 | Only DinoPlayer drives all three gaits | `tests/waddle/brachio-gait.test.ts` (no Trike/Stego/BrachioPlayer class in source) + trio generic-player test | Met |
| AC-1 | Third dino reuses DinoPlayer + shared dust/blink/squash; Trike/Stego unchanged | Brachio walks 2 s with `minScaleY < 1` and `dust.aliveCount > 0` (`tests/waddle/brachio-gait.test.ts`); full suite green | Met |
| AC-3 | Trio 30 s wander stays in-frame (≤ RADIUS + CYCLE) with min pairwise separation >0.25 m | `tests/waddle/trio-wander.test.ts`: per-player max ≤1.09 m, min separation >0.25 m, avoided > baseline differential on locked + 2 extra draws | Met |
| AC-7 | Only DinoPlayer imported; BRACHIO_GAIT exported with Trike/Stego | Source-scan test (`tests/waddle/brachio-gait.test.ts`); existing `dino-player.test.ts` viewer tests unchanged | Met |

## Evidence paths

- `src/ranch/dino-player.ts` — BRACHIO_GAIT export
- `src/ranch/avoidance.ts` — TRIO_SPAWN_RADIUS_METRES, TRIO_SPAWN_ANGLES_RADIANS, trioSpawnPositions, TrioNudges, trioAvoidanceNudges
- `tests/waddle/brachio-gait.test.ts` — P1.T1 (8 tests)
- `tests/waddle/trio-avoidance.test.ts` — P1.T2 unit (8 tests)
- `tests/waddle/trio-wander.test.ts` — P1.T2 integration (7 tests)

## Deviations

1. **BRACHIO_GAIT curvature 4.5 instead of the assumed 3.0** (`src/ranch/dino-player.ts`).
   TDD against AC-3 falsified 3.0: at curvature 3.0 the yaw rate binds on
   curvature × speed (3.0 × 0.24 = 0.72 rad/s, 0.33 m turn radius), and even a
   solo Brachio (no avoidance at all) swings to ~1.17–1.20 m on outward rim
   crossings — structurally past the 1.09 m bound (apex ≈ 0.8 + 0.24 × 2.18 ×
   0.64 ≈ 1.13). Trike (1.63 rad/s → apex ≈ 1.02) and Stego (π → apex ≈ 0.92)
   stay inside by the same math. 4.5 is the trike-proven stroller curvature and
   the smallest change that contains the trio (yaw 1.08 rad/s, 0.22 m radius,
   apex ≈ 1.02; observed per-player max 1.086/0.943/1.078). Every other assumed
   number (stride 0.24, loop 1.0, turnRate 1.8, wander 0.8) is kept. The spec
   marks the gait table "(to verify)" — this is that verification.
2. **Scratch file left untracked**: `tests/waddle/debug-trio.test.ts` (passing
   snapshot probe, clearly header-marked SCRATCH). The executor's `rm` was
   shell-denied (`permission.rejected`), and `git clean` is out of scope, so it
   could not be removed. Please delete it (`rm tests/waddle/debug-trio.test.ts`);
   it is NOT added to any commit and real coverage lives in
   `trio-avoidance.test.ts`.

## Notes

- **Turn-budget finding (for Phase 2, owner of AC-2):** the brief's "90° <1.0 s"
  holds as a yaw-cap rate bound ((π/2)/1.8 = 0.87 s, tested), but the full
  walking arc binds on curvature × speed: ~1.45 s at the shipped 4.5 (was
  ~2.3 s at the assumed 3.0). The arc converges and walks straight (tested);
  Phase 2 decides the AC-2 turn-budget call against the real GLB bake.
- **Phase 3 spawn recommendation:** the naive all-heading-0 spawn marches the
  formation to the rim and churns avoidance-locked there (trike hit 1.48 m on
  that draw). The locked test draw uses staggered entry — trike near-center
  (π−0.35), stego central (1.0472), brachio radial-outward leg (2.094) that
  wander-returns head-on — keeping every leg central/radial. Consider adopting
  it (or wander-priority loop order) when wiring the viewer trio.
- Frame loop mirrors the viewer/dual pattern (avoid → update at 60 fps);
  avoidance never touches `moving`, so the trio never stops, bounces, or
  teleports (heading steps assert <0.1 rad vs ~0.05 physical max).
- No viewer, GLB bake, CREDITS, index.html, or vite config touched. Trike/Stego
  exports and all shared waddle math (loopPhase/squash/dust/deadband) untouched.
