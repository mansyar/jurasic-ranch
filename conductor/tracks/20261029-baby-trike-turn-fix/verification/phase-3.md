# Phase 3 Evidence — Curvy turns + stop deadband

- Track: `20261029-baby-trike-turn-fix` — Baby Trike Turn Fix
- Phase: 3 — Curvy turns + stop deadband (P3.T1, P3.T2)
- Date: 2026-10-29
- Branch: `feat/20261029-baby-trike-turn-fix`
- Base: `62d06b4`
- Head: `1778813`
- Result: **verified**

## Summary

Full turn rework for the jitter-when-almost-stopped defect. Heading now bends
into slow stroller arcs while the Trike keeps walking (yaw = curvature x actual
root speed, capped), and below the stop blend deadband the heading freezes so
the model settles to a true, bit-identical halt. The 0.8 m wander steering is
unchanged and the Trike stays in frame; gait/stride, the GLB, and the viewer
are untouched. Turn/deadband math allocates nothing per frame.

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| P3.T1 | `ec10dca` | `feat(ranch): arc-limited stroller turns with allocation-free math` |
| P3.T2 | `1778813` | `fix(ranch): stop deadband freezes heading for a true halt` |

## Commands

| Layer | Command | Exit | Summary |
| ----- | ------- | ---- | ------- |
| unit (interim P3.T1) | `pnpm test` | 1 (first run) | 2 failures drove tuning: 90° test asserted stale precision-5 snap timing; wander peaked 1.0907 m vs 1.09 m bound |
| unit (P3.T1 retune) | `pnpm test` | 0 | 60/60 green after curvature 4.5 + arc-tolerance assertions |
| unit (P3.T2) | `pnpm test` | 0 | 62/62 green incl. new deadband + NFR-3 tests |
| static + unit + build | `pnpm verify` | 0 | oxlint (only pre-existing vendor-script warnings), oxfmt check, tsrs, 62/62 vitest, vite build + PWA precache |

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| -- | --------- | -------- | ------ |
| AC-4 | Commanded 180° reversal while walking resolves as a wide arc, never a snap spin; Trike remains in frame | New test `resolves a 180 deg reversal while walking as a wide in-frame arc`: 0 paused frames, reversal takes ~1.93 s (> 1 s snap bound, < 6 s), lateral bend 0.5 m diameter, max distance within `WANDER_RADIUS + WADDLE_CYCLE` | pass |
| AC-5 | 2-second settle recording after Stop shows heading variance ~zero (no jitter oscillation) | New test `freezes heading with a pending turn and halts dead after settling`: 60-frame settle, then 120-frame recording with max heading deviation exactly 0 and displacement exactly 0; pending 1 rad turn stays ~0.76 rad short (never chased after Stop) | pass |
| FR-4 | Heading changes arc-limited; no in-place spinning; stays in frame via wander | `TURN_ARC_CURVATURE_RADIANS_PER_METRE = 4.5` (~0.22 m radius), yaw capped at `TURN_RATE`; blend no longer gated on alignment so translation never pauses; 30 s wander test stays in frame | pass |
| FR-5 | Below stop threshold heading freezes; no jitter while settling | `STOP_BLEND_DEADBAND = 0.03` early-return in `updateWaddlePose`; graceful 0.2 s decel preserved, then frozen | pass |
| NFR-3 | 60 fps tablet; turn math allocation-free | `TrikePlayer` reuses 2 constructor scratch `Vector3`s (`forwardTemp`, `footTemp`); zero `new` in per-frame path (source-count test ≤ 2); no array literals in hot loop (`FOOT_PLANT_PHASES` is module-level readonly) | pass |

## Evidence paths

- `tests/waddle/trike-player.test.ts` — rewritten 90° arc test, new 180° reversal test, new stop-deadband settle test, new NFR-3 source-count test
- `src/ranch/waddle.ts` — arc curvature + deadband constants, reworked `updateWaddlePose`
- `src/ranch/trike-player.ts` — scratch-vector refactor, arc-wander comment updates
- `pnpm verify` transcript in the phase run log (exit 0)

## Deviations

- `src/ranch/waddle.ts` (not in Touches): required — the turn integrator lives
  there (`updateWaddlePose` + turn constants). Smallest necessary change:
  turn docs/constants/function only; stride, speed, gait-block, blink, and
  plant math untouched, and `tests/waddle/waddle.test.ts` still passes
  unmodified. Recorded here per workflow.

## Notes

- Turn dynamics (deterministic, DT = 1/60): full-speed yaw 1.631 rad/s; 90°
  arc ≈ 1.04 s (> 0.6 s, proving no snap spin); 180° ≈ 1.93 s; radius ≈ 0.22 m.
- The old defects are both closed: heading no longer integrates at ~zero speed
  (deadband), and the post-Stop drift is gone (blend parks at exactly 0 and
  heading is frozen, so the pose is bit-identical frame to frame).
- `waddle.test.ts` turn-then-walk case passes unchanged (it starts aligned, so
  it exercises only the blend ramp and the `turnDurationSeconds` cap bound,
  both preserved).
- No product/design decisions needed; no blockers. Evidence file left
  uncommitted for the primary state commit.

## Primary verification

- Command: `pnpm verify` (primary run, 2026-10-29) — exit 0; separate
  `pnpm test` re-run: 6 files, 62/62 passed.
- oxlint: exit 0, quiet (quote fix from Phase 2 accept holding). oxfmt:
  clean. tsrs: clean. vite build: green, PWA precache 10 entries.
- Squash decision: NO squash. Range `62d06b4..HEAD` is exactly the two
  reported task commits (`ec10dca`, `1778813`), each mapping 1:1 to its
  task; keeping them consistent with Phases 1–2 and avoids rewriting
  history on the already-pushed branch. Checkpoint = `1778813`.
- Deviation accepted: `src/ranch/waddle.ts` (turn integrator lives there;
  turn docs/constants/function only, gait math untouched,
  `waddle.test.ts` green unmodified). Smallest necessary change.
- AC-4/AC-5/FR-4/FR-5/NFR-3: satisfied per table above. The user's
  jitter-when-almost-stopped defect is closed by construction (deadband +
  true halt) with a bit-identical-halt regression test; liveliness of the
  new arcs remains a human/tablet follow-up for the review.
