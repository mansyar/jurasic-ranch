# Phase 1 Verification — Generic DinoPlayer extraction

- **Track:** 20261029-stego-generic-player
- **Phase:** 1 (Generic DinoPlayer extraction)
- **Date:** 2026-10-29
- **Branch:** feat/20261029-stego-generic-player
- **Base:** 8b1b0b4738c74532b7b7db6b3bc2698e508f976a
- **Head:** 920784d
- **Result:** verified

## Summary

Trike now waddles through the generic `DinoPlayer` with zero behaviour change.
`GaitParams` (stride / loop / turnRate / curvature / wanderRadius) is defined in
`src/ranch/waddle.ts` with gait-parameterized pose/disp/phase variants;
`TRIKE_GAIT` (0.29 m, 0.8 s, PI, 4.5, 0.8 m) pins the shipped tuning.
`TrikePlayer` is a thin alias over `DinoPlayer`; the viewer imports only
`DinoPlayer`. `pnpm verify` exits 0 (70/70 tests).

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` | 0 | oxlint clean; only pre-existing warnings in `scripts/vendor/triceratops-base.mjs` (untouched) |
| static | `pnpm format --check` | 0 | all matched files use the correct format |
| static | `pnpm typecheck` | 0 | tsrs `--noEmit` clean |
| unit | `pnpm test` | 0 | 7 files, 70/70 pass (dino-player 23, trike alias 2, waddle 10, viewer 19, stride 3, check-trike 6, pastel 7) |
| static | `pnpm build` | 0 | vite build + PWA precache 10 entries (1746.48 KiB); chunk-size warning pre-existing |
| phase | `pnpm verify` | 0 | full chain green |

TDD note: the new `tests/waddle/dino-player.test.ts` was written first and
confirmed red (`TS2307: Cannot find module '../../src/ranch/dino-player.js'`)
before the implementation; two further iterations fixed a wrong relative path
and an over-strict AC-7 assertion (see Notes).

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | Trike regression: existing waddle/trike-player tests pass; no pop | `waddle.test.ts` 10/10, `stride.test.ts` 3/3 (mean 0.2908 vs coded 0.29), alias suite pins one stride per 0.8 s loop; `updateWaddlePose`/`displacementMetres`/`loopPhase` bodies unchanged (delegating cores) | pass |
| AC-7 | No TrikePlayer duplication: only DinoPlayer imported; old file deleted or alias | `src/ranch/trike-player.ts` is a behaviour-free alias (subclass + re-exports); `src/viewer/main.ts` imports only from `../ranch/dino-player.js`; new test `wires only DinoPlayer into the viewer` asserts no `trike-player.js` import and no `new/: /instanceof TrikePlayer` usage | pass |
| FR-1 | Generic `DinoPlayer` with `GaitParams` and Trike config | `GaitParams` + `gaitSpeedMetresPerSecond` + `updateWaddlePoseWithGait`/`displacementMetresWithGait`/`loopPhaseWithGait` in `waddle.ts`; `DinoPlayer` + `TRIKE_GAIT` in `dino-player.ts`; gait tests: default-is-Trike identity, 2x stride → 2x distance, custom wander radius gates steering | pass |
| FR-2 | Trike behaviour preserved identical | Migrated suite covers turn-then-walk 90° gradual (>0.6 s arc, >0.2 m ground), deadband freeze (heading variance 0, displacement 0), stride `WALK_SPEED` per loop, alloc ≤ 2 `Vector3`, blink ≥ 1/5 s walking, dust 2–4 puffs, squash dip, 30 s wander ≤ RADIUS + CYCLE; all pass | pass |

Coverage: NFR-6 60% new-code gate — no coverage tooling is configured in this
repo (`pnpm coverage` exists but no gate measurement); all new code
(`dino-player.ts`, gait variants) is exercised by the 23-test dino suite.

## Touched paths

- `src/ranch/dino-player.ts` (new) — `DinoPlayer`, `TRIKE_GAIT`, `BlinkController`, `findBlinkTargets`, `WANDER_STEER_JITTER_RADIANS`
- `src/ranch/trike-player.ts` — collapsed to thin alias (subclass + re-exports)
- `src/ranch/waddle.ts` — additive `GaitParams`, gait-speed helper, `WithGait` variants + shared pose core (existing exports delegate, behaviour unchanged)
- `tests/waddle/dino-player.test.ts` (new) — 23 tests: gait config (5), mixer (5), deadband (2), blink (4), dust (1), wander (2), AC-7 (1), silence (3)
- `tests/waddle/trike-player.test.ts` — replaced by 2-test alias-compat suite
- `src/viewer/main.ts` — imports/constructs `DinoPlayer` with `TRIKE_GAIT`; stale `TrikePlayer` comment reworded
- `src/viewer/viewer.test.ts` — imports/asserts `DinoPlayer`

## Deviations

- Touched `src/viewer/main.ts` and `src/viewer/viewer.test.ts`: outside the
  plan's `Touches` list but explicitly required by P1.T2.1 ("update imports in
  viewer") and AC-7 ("only DinoPlayer imported"). Minimal diffs (import +
  type + constructor + comment + test import/assert). No viewer behaviour
  change.
- Quote style: new code uses double quotes, matching the repo's oxfmt-default
  formatting (existing `src/` files use double quotes and `format --check`
  passes), rather than the single-quote preference in
  `conductor/code_styleguides/typescript.md`. Required for `pnpm verify` green.
- Kept the `loadTrikePlayer` / `LoadedTrike` names in the viewer: they are
  Trike-specific loader names, not player duplication; the wired class is
  `DinoPlayer`.

## Notes

- The first AC-7 test draft asserted the viewer contains no `TrikePlayer`
  substring; it failed on the legitimate `loadTrikePlayer` loader name. The
  assertion now targets class usage (`new` / `: ` / `instanceof`) plus the
  module import path, which is what AC-7 requires.
- `git` line-level behaviour proof: `TrikePlayer` (alias) vs `DinoPlayer`
  default-gait identity is covered by the `defaults to the Trike gait` test
  (240 frames, positions bit-equal) and the stride test.
- Boards/lists: N/A (no board integration in this project).
