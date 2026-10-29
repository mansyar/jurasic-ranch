## Summary

Every surface a child presses now answers with sound, not just the dev harness.
Walk, the three POV pills and both mute buttons dispatch `tap` through the
existing audio engine; the three species entries became 72 px buttons that play
their own coo (one coo at a time across the trio, gated to that species' catalog
duration); and `hello` greets once per session after the 400 ms music fade. The
decisions live in a pure `src/audio/feedback.ts` module so they are testable
without a DOM, a Howl or a timer per tap.

## Track

- **ID:** `20261030-ranch-audible`
- **Type:** `feature`
- **Spec:** [`conductor/archive/20261030-ranch-audible/spec.md`](conductor/archive/20261030-ranch-audible/spec.md)
- **Plan:** [`conductor/archive/20261030-ranch-audible/plan.md`](conductor/archive/20261030-ranch-audible/plan.md)
- **Review:** [`conductor/archive/20261030-ranch-audible/review.md`](conductor/archive/20261030-ranch-audible/review.md)

## What happened

| Phase | Goal | Result | Checkpoint | Notes |
| --- | --- | --- | --- | --- |
| 1: Feedback decisions as pure data | Surface map, coo gate, greeting rule, first-press slot | verified | `48dde04` | No DOM, no Howl, no engine change |
| 2: The child hears what they touch | Markup and HUD dispatch, 72 px species buttons | verified | `ab596ed` | One rework: the Walk status line still drew a bone for Brachio |
| 3: Unlock timing, greeting and mute ordering | Queue the unlocking press, greet after the fade, mute tap ordering | verified | `8fff83a` | Greeting scheduled on one injectable clock |
| 4: Tablet listening pass and evidence | Live measurement at 1280 × 800 | verified | `f783c7e` | One rework: `hello` was being sent to `playSfx` and dropped by the bus check; feedback now routes by catalog bus |
| R1: Review fixes | Resolve findings F1–F6 | verified | `c7a18cc` | Provenance recorded instead of inferred; mute tap from the surface table |
| R2: Review fixes (round 2) | Resolve F7–F8 | verified | `26a7b59` | Provenance captured once, from the unlocking call |

## Requirements

- [x] `FR-1` — Walk dispatches `tap` (test: `tests/viewer/hud-audio.test.ts`)
- [x] `FR-2` — every POV pill dispatches `tap`, including the active one
- [x] `FR-3` — mute taps land on the audible side of the boundary
  (`tests/viewer/audio-controls-feedback.test.ts`)
- [x] `FR-4` — each species button plays its own coo at ≥72 × 72 px
- [x] `FR-5` — one coo at a time, window from the catalog duration
  (`tests/audio/feedback.test.ts`)
- [x] `FR-6` — `hello` once per session, after the fade, suppressed when muted or
  when the unlocking gesture was a mute control
- [x] `FR-7` — the unlocking press is queued and flushed, or dropped on failure
- [x] `FR-8` — gear hold, panel Close and the volume slider stay silent
- [x] `FR-9` — a locked, muted or failing engine never throws
- [x] `FR-10` — `🦒` replaces the bone glyph in the list and the status line
- [x] `FR-11` — decisions in a pure module, adapters stay thin
- [x] `NFR-1` — no new asset, dependency or network call
- [x] `NFR-2` — dispatch latency 0.2–0.3 ms measured, no timer on the tap path
- [x] `NFR-3` — `feedback.ts` 100 %, `hud.ts` 78.57 %, global floor holds
- [x] `NFR-4` — sound is never gated on reduced motion; muting changes nothing else
- [x] `NFR-5` — `pnpm verify` green, dist free of dev markers
- [x] `AC-1` … `AC-9`, `AC-11` — see `review.md`
- [ ] `AC-10` — parent listening pass on the real tablet, the `tablet-touch-play`
  manual exception; checklist in `verification/phase-4.md`

## Verification

| Layer | Command | Result | Evidence |
| --- | --- | --- | --- |
| unit | `pnpm test` (inside `pnpm verify`) | pass — 46 files / 545 tests | `conductor/archive/20261030-ranch-audible/verification/integrated.md` |
| coverage | `pnpm coverage` | pass — 80.38 % lines | same |
| static | `pnpm lint`, `pnpm format --check`, `pnpm typecheck` | pass | |
| build | `pnpm build` + `check-dist-clean` | pass — 303 ms, no dev markers | |
| smoke | `pnpm dev --host` + Chromium | pass — unlock, four surfaces, three coos, mute both ways, greeting trace | `verification/phase-4.md` |

## Review

- **Verdict:** `PASS WITH FINDINGS`
- **Rounds:** 2
- **Fixed:** 5 findings across two rounds
- **Accepted/deferred:** 1 (F2, recorded in Debt) plus the `tablet-touch-play` and
  screenshot substitutions

## Deviations and risks

- The greeting timer is one `window.setTimeout`; NFR-2 was narrowed in the spec to
  forbid timers on the tap path rather than every timer, since the 400 ms fade the
  spec requires already needs one.
- The 1280 × 800 screenshot could not be captured (no visible desktop window in
  the automation session); a numeric layout measurement of every target replaced
  it, and AC-9 is recorded as partial on that basis.
- A muting press while the engine is still locked dispatches `tap` and is then
  refused by the muted engine by design (F2, accepted): deferring the mute would
  blip the music through the unlock.

## Follow-ups

- none — `heart`, `sparkle`, `nom`, `all-done` and `count-*` remain reserved for
  the Feed and Cuddle tracks.

## Rollback

```bash
# Squash commit
git revert --no-edit <squash-commit>
```

Nothing outside this branch: no dependency, no asset, no persisted key, and the
existing `locally saved` mute/volume state is untouched.
