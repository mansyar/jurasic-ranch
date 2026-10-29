# Phase R2 — Review fixes (round 2)

- **Track:** 20261030-ranch-audible — The Ranch Answers Back
- **Phase:** R2 — Review fixes (round 2)
- **Date:** 2026-10-30
- **Branch:** `feat/20261030-ranch-audible`
- **Phase base:** `15c80c9`
- **Head at verification:** `26a7b59`
- **Result:** complete — F7 and F8 closed, no finding left open.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static + unit + build | `pnpm verify` | 0 | 46 files / 545 tests, 80.38 % lines, 45 precache entries (5072.38 KiB), dist clean |

## Findings

| ID | Severity | Change | Test / evidence |
| --- | --- | --- | --- |
| F7 | Medium | `firstGestureWasMute = source?.viaMuteControl === true` moved inside the `scheduled` guard, so provenance is captured once, from the call that resolved the unlock. Before this, `audio-controls`' `onUnlock` (which fires on every mute and unmute press) could set the flag during the fade and drop a greeting a Walk unlock had earned. | `tests/viewer/audio-routing.test.ts` → `greets after a Walk unlock when a mute press lands inside the fade`: `afterUnlock()` then two `afterUnlock({ viaMuteControl: true })` calls with the engine unmuted at fire time still deliver `hello`. The mute-first test still suppresses. |
| F8 | Low | `verification/phase-R1.md`: Result now reads "complete", the F3 row says "Applied by the primary in `15c80c9`", and Blockers is marked resolved with the intended edit kept for provenance. | The file itself; `spec.md` NFR-2 confirms the applied wording. |

## Deviations

None. Touches matched the plan.

## Notes

- Fixed by the primary rather than a phase subagent: the change is two statements
  plus one test, and the round 2 review was the last permitted round, so the fix
  and its evidence were recorded directly.
- The F7 test fails against `15c80c9` (which OR-accumulated before the guard) and
  passes at `26a7b59`; the mute-first suppression test passes on both, which is
  what makes this a narrowing of behaviour rather than a reversal.
- `pnpm verify` re-run twice at this head (303 ms build both times); the tree was
  clean after the record edits.
