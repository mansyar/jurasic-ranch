# Phase R1 Verification — Review Fixes (F1, F2)

- Track: 20261029-ranch-warmth-ui
- Phase: R1 (Review Fixes — hint/sleepy precedence + matchMedia hoist)
- Date: 2026-10-29
- Branch: feat/20261029-ranch-warmth-ui
- Base: 6c6defb
- Head: 0a0a157
- Result: verified

## Summary

Two Low review findings in `src/viewer/main.ts` resolved with minimal diffs.
F1: the 1s hint interval now returns early when
`hintSuppressedBySleepy(sleepy.update(performance.now()))`, so the hint class
is never re-added while drowsy/sleepy (previously re-added each second and
stripped each frame by the animation loop). F2: one hoisted
`reducedMotionQuery = window.matchMedia(...)` const beside the interval is
read via `.matches` on both the interval and animation-loop paths — no more
fresh `matchMedia` object per second/per frame. A hint-precedence regression
test pins the F1 guard.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` | 0 | oxlint clean |
| static | `pnpm format --check` | 0 | oxfmt clean |
| static | `pnpm typecheck` | 0 | tsrs clean |
| unit | `pnpm test` | 0 | 17 files, 175 tests pass (+1 new F1 test) |
| build | `pnpm build` | 0 | vite build + PWA precache 28 entries / 4309.48 KiB |
| phase | `pnpm verify` | 0 | full chain green (exact command as written) |

## Acceptance Criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| F1 | Hint interval never adds the hint class while drowsy/sleepy | `window.setInterval` guard in `src/viewer/main.ts` + `never adds the hint class while drowsy/sleepy` test in `tests/ranch/sleepy-ui.test.ts` | covered |
| F2 | Single hoisted MediaQueryList, `.matches` read per tick/frame | `reducedMotionQuery` const in `src/viewer/main.ts`, used by interval and animation loop | covered |

## Commits

- ec64045 `fix(viewer): guard hint interval with sleepy state` (R1.T1: interval guard + shared query const + F1 test)
- 0a0a157 `refactor(viewer): hoist matchMedia query off hot paths` (R1.T2: animation loop reuses the hoisted query)

## Notes

- The R1.T1 commit introduces the hoisted `reducedMotionQuery` const because
  the guarded interval line needs it; R1.T2 completes F2 by switching the
  animation-loop path to reuse it. No behavior change beyond the two fixes.
- No deviations: all changes stay within the phase `Touches`
  (`src/viewer/main.ts`, `tests/ranch/sleepy-ui.test.ts`).
