# Phase 3 Verification — Sleepy Cues + Cozy Guards

- Track: 20261029-ranch-warmth-ui
- Phase: 3 (Sleepy Cues + Cozy Guards)
- Date: 2026-10-29
- Branch: feat/20261029-ranch-warmth-ui
- Base: 2338ed3
- Head: f44411d (code); evidence committed separately as docs
- Result: verified

## Summary

Idle sleepy cues ship by composition: `src/ranch/sleepy.ts` owns the
timestamp-driven awake→drowsy→sleepy state machine (`IDLE_AFTER_MS =
90_000`), `src/ranch/dino-player.ts` gained a clamped sleepy weight hook
(droop floors the existing blink lids, yawn swells model height), and
`src/viewer/sleepy-ui.ts` presents three looping ZZZ glyphs as a
tablet-cheap DOM overlay. Everything is visual-only, every cue cancels
mid-flight with the base pose restored, and reduced-motion freezes all
oscillation into static highlights. The viewer wires the existing
pointer/key handlers and animation loop — no new timers, no new deps.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` | 0 | oxlint clean (one clash fixed, see notes) |
| static | `pnpm format --check` | 0 | oxfmt clean |
| static | `pnpm typecheck` | 0 | tsrs clean (one DOM typing fixed, see notes) |
| unit | `pnpm test` | 0 | 17 files, 174 tests pass |
| build | `pnpm build` | 0 | vite build + PWA precache OK |
| phase | `pnpm verify` | 0 | full chain green (exact command as written) |

Two verification fixes were needed inside the retry budget: the sleepy
weight getter clashed with its backing field under
`useDefineForClassFields` (renamed to `sleepyLevel`), and the DOM lib
types `HTMLElement.hidden` as `string | boolean` (sink interface widened).

## Acceptance Criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-4 | Idle 90s → droopy + yawn + ZZZ play, any tap cancels | `tests/ranch/sleepy.test.ts`: state machine at 45s/90s, droop outside blink windows, yawn pulse, clamp/weight, twin restore, 92s end-to-end; `tests/ranch/sleepy-ui.test.ts`: 3-Z overlay show/hide | pass |
| AC-7 | Any tap interrupts cleanly, no stuck pose, wander stays in 0.8m circle | twin-restore test (post-clear frames equal a never-sleepy twin), max-lid restore test, 30s sleepy walk stays within 0.8m + stride, ease-in/snap-out weight test | pass |
| FR-8 | Reduced-motion → static highlights | `yawnScaleFor(..., reducedMotion=true)` frozen, player frozen-swell test, `sleepyModeFor(true)` static overlay test, injected `prefers-reduced-motion` guard | pass |

Human-only exceptions (`tablet-touch-play`, `parent-voice-review`) remain
with dad per the workflow; no audio ships in this phase (lullaby is a later
track).

## Evidence Paths

- `tests/ranch/sleepy.test.ts` — state machine, yawn, droop, overlay, interrupt, wander
- `tests/ranch/sleepy-ui.test.ts` — ZZZ overlay, reduced-motion, hint precedence, viewer wiring
- `src/ranch/sleepy.ts` — `IDLE_AFTER_MS`, `SleepyController`, `yawnScaleFor`
- `src/ranch/dino-player.ts` — droop-aware `BlinkController.update`, sleepy weight hook
- `src/viewer/sleepy-ui.ts` — ZZZ overlay, static mode, hint precedence
- `src/viewer/main.ts` — viewer wiring (deviation, see below)

## Deviations

- `src/viewer/main.ts` (outside `Touches`): smallest necessary wiring —
  `SleepyController` + `ensureSleepyOverlay` construction, existing
  `markInteraction` extended to wake sleepy, per-frame weight/state sync in
  the existing animation loop, hint-glow suppression while drowsy/sleepy,
  `reducedMotion` passed into `player.update`. No new listeners or timers.

## Primary verification (independent)

- Re-ran `pnpm verify` on the squashed tree: exit 0 (build ok, precache 28 entries / 4309.50 KiB).
- `git status` clean except intended files; `src/viewer/main.ts` touched outside Touches — accepted as smallest-necessary wiring (deviation recorded in evidence).
- AC-4/AC-7 spot-check: timestamp-driven machine, twin-restore + max-lid tests prove no stuck pose; 30s sleepy walk stays in 0.8m.
- Squashed 6 commits (2f7665d, 33a979b, ef4b83a, 5ada931, f44411d, 0b05d99) → `293d2ae feat(ranch): visual-only sleepy cues with cozy interrupt guards` via `git reset --soft 2338ed3`.

## Notes

- Timestamps, not fake timers: the controller is timestamp-driven, so tests
  step explicit `nowMs` values — deterministic and equivalent, and it proves
  no timer can leak across POV switches (source-text assertion included).
- Droop reuses the blink base-capture path (floors the lid) instead of
  multiplying scales, so a blink starting mid-droop cannot capture a
  drooped base and stick.
- Placeholders do not droop: the overlay drives rigged players only, and
  ZZZ is DOM-level so it plays regardless. Offline-fallback placeholders
  keep walking; droop arrives with the rigged swap.
- `pixelRatio` cap untouched, no new dependencies, no console output added.
- Task commits: `2f7665d` (P3.T1), `33a979b` (P3.T2), `ef4b83a` (P3.T3),
  `5ada931` (P3.T4), plus `f44411d` verification fixes.
