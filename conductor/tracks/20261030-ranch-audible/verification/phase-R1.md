# Phase R1 — Review fixes

- **Track:** 20261030-ranch-audible — The Ranch Answers Back
- **Phase:** R1 — Review fixes
- **Date:** 2026-10-30
- **Branch:** `feat/20261030-ranch-audible`
- **Phase base:** `4094096`
- **Head at verification:** `368a167`
- **Result:** partial — F1, F4, F5 and F6 closed; F3's `spec.md` edit was
  permission-denied for this executor and is handed to the primary (see
  Blockers). `pnpm verify` is green on the code and records shipped here.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static + unit + build | `pnpm verify` (attempt 1) | 1 | 1 failed / 543 passed — the old mute-first test modelled provenance with `engine.muted` |
| static + unit + build | `pnpm verify` (attempt 2) | 0 | 46 files / 544 tests, 80.38 % lines, 45 precache entries (5072.38 KiB), build 302 ms, dist clean |

Coverage on the touched modules: `src/audio/feedback.ts` 100 % lines,
`src/viewer/audio.ts` 85.00 % lines, `src/viewer/audio-controls.ts` 94.51 %,
`src/viewer/hud.ts` 78.57 %.

## Findings

| ID | Severity | Change | Test / evidence |
| --- | --- | --- | --- |
| F1 | High (blocking) | `UnlockSource` added; `afterUnlock(source?)` ORs `source?.viaMuteControl === true` into `firstGestureWasMute` and no longer reads `audioEngine().muted` for provenance. The mute-control `onUnlock` in `main.ts` passes `{ viaMuteControl: true }`; the gesture `onUnlock` stays provenance-less. Fire-time `muted` and `shouldGreet` are unchanged. | `tests/viewer/audio-routing.test.ts` → `greeting provenance (FR-6, AC-5)`: unmuted engine + `{ viaMuteControl: true }` greets nothing (held press still flushes once, no held id left, a later provenance-less call does not clear the flag); a muted Walk unlock that is unmuted inside the fade delivers `hello`. The mute-first case in `tests/viewer/audio-controls-feedback.test.ts` now supplies the same provenance. |
| F2 | Low (accepted) | No behaviour change. One comment in `toggleMute` records that a muting press while locked dispatches and is then refused by the muted engine by design (FR-9), and that deferring the mute would blip the music. | Comment only: `src/viewer/audio-controls.ts` `toggleMute`. |
| F3 | Medium | **Not applied — permission denied.** Intended `spec.md` NFR-2 replacement is in Blockers. | Blocked; verify is unaffected. |
| F4 | Low | Both mute branches take the id from the pure table: `onSfx?.(sfxForSurface('mute'))`, imported from `../audio/feedback.js`; the literal `'tap'` is gone. `sfxForSurface('mute')` returns `AudioAssetId`, so no null guard is needed. | Existing `tests/viewer/audio-controls*.test.ts` still assert one `onSfx` per press and the call order. |
| F5 | Low | Deleted the vacuous `silent surfaces (FR-8)` block from `tests/viewer/hud-audio.test.ts`; AC-7 stays with `tests/viewer/audio-controls.test.ts`, which wires real listeners. | `pnpm verify` green; the removed block could not fail. |
| F6 | Low | `verification/phase-4.md`: the AC-5 row now records that once-per-session and the fade were proven while the mute-control direction was not, and a `## Round R1 correction` section records P4.T3.1 as "manual exception: pending" and the F1 gap. The plan line itself is the primary's file. | `conductor/tracks/20261030-ranch-audible/verification/phase-4.md` |

## Deviations

| File | Reason |
| --- | --- |
| `tests/viewer/audio-controls-feedback.test.ts` | Outside the brief's Touches. Its "stays silent after a mute-first unlock" test modelled the gesture with `engine.muted = true`, the exact inference F1 removes, so it failed by design once provenance became explicit. Changed only that call to `afterUnlock({ viaMuteControl: true })` plus the comment; the test's intent and assertions are unchanged. |
| `conductor/tracks/20261030-ranch-audible/verification/phase-4.md` | The file has no P4.T3.1 line — that task line lives in `plan.md`, which this executor must not edit. The pending status and its reason are recorded in the new `## Round R1 correction` section instead. |

## Blockers

`edit` on `conductor/tracks/20261030-ranch-audible/spec.md` was denied
(`Permission denied: edit`). The intended R1.T4.1 change, keeping the id and the
rest of the row:

- Current: `| NFR-2 | Dispatch-to-Howler latency ≤ 100 ms, measured through the existing dev-harness latency field; no new timers, intervals or rAF loops are added. |`
- Replace the second clause with: `dispatch stays synchronous — no timer, interval or rAF loop is added to the tap path — and the single one-shot greeting scheduler plus the existing HUD interval are the only timers, neither of which repeats per press.`

## Notes

- Commits: `e38aa4f` (F1), `0742c40` (F4), `83a341b` (F5), `568485b` (mute-first
  test provenance), `bfea1d1` (F2 comment), `368a167` (F6 record).
- The `gear` / `close` / `slider` fakes remain in `hud-audio.test.ts`: the brief
  said to leave the rest of the file alone, and they are only referenced by the
  harness object, so no lint or type error follows. They are now unused by any
  assertion.
- No change to `src/audio/*`, `plan.md`, `metadata.json`, `tracks.md`,
  `conductor/index.md`, `review.md` or `pr.md`.

## Primary verification

- Tree clean before close; code diff vs 167fc3a = 6 files (+72/-22) inside the
  R1 Touches plus the reported udio-controls-feedback.test.ts deviation.
- udio.ts: `UnlockSource` + `afterUnlock(source?)` with
  `firstGestureWasMute ||= source?.viaMuteControl === true` (never cleared by a
  later provenance-less call); `main.ts` passes `{ viaMuteControl: true }` only
  from the audio-controls `onUnlock`.
- `audio-controls.ts` dispatches `sfxForSurface('mute')` (non-null for known
  surfaces) and records why a locked muting press is dispatched then refused.
- New tests assert both directions: mute-control unlock with an unmuted engine
  stays silent and parks nothing; a Walk unlock while muted greets once the parent
  unmutes inside the fade.
- `pnpm verify` re-run independently: exit **0**, 46 test files / 544 tests,
  80.38 % lines, `feedback.ts` 100 %, `audio.ts` 85 %, `hud.ts` 78.57 %,
  precache 45 entries / 5072.38 KiB, build 303 ms, dist clean.
- `spec.md` NFR-2 narrowed to the dispatch path; `P4.T3.1` now records the
  pending `tablet-touch-play` pass instead of a verdict.
