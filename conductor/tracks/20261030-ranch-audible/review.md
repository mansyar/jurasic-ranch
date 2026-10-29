# Review: The Ranch Answers Back

- **Track:** `20261030-ranch-audible`
- **Type:** `feature`
- **Branch:** `feat/20261030-ranch-audible`
- **Range:** `94178c4..5a01777`
- **Date:** 2026-10-30T06:20:00+11:00
- **Verdict:** `BLOCK`

## Summary

The track is well built: the surface table, coo gate and first-press slot are
genuinely pure and directly tested, every wired surface dispatches one id per
press, the bus-routing rework (`f783c7e`) fixes a real silent-greeting bug found
by live verification, mute ordering is asserted through both buttons, and the
failure paths stay silent and throw nothing. One High finding blocks: FR-6/AC-5
require `hello` to be suppressed whenever the *unlocking gesture* was a mute
control, but `createUnlockFeedback` infers that from `engine.muted` at unlock
time, so an unmute-first session greets — the case the Edge Cases forbid, and the
mirror case over-suppresses a Walk unlock that a parent unmutes inside the fade.
Three Medium findings are resolved as one fix and two accepted-with-reason
downgrades (see Round 1 disposition).

## Verification

| Layer | Command | Result | Evidence |
| --- | --- | --- | --- |
| test | `pnpm test` (inside `pnpm verify`) | pass — 46 files / 543 tests | `verification/integrated.md` |
| coverage | `pnpm coverage` (inside `pnpm verify`) | pass — 80.38 % lines; `feedback.ts` 100 %, `audio.ts` 84.31 %, `hud.ts` 78.57 % | same |
| lint | `pnpm lint` (inside `pnpm verify`) | pass | same |
| format | `pnpm format --check` (inside `pnpm verify`) | pass | same |
| typecheck | `pnpm typecheck` (inside `pnpm verify`) | pass | same |
| build | `pnpm build` + `check-dist-clean` (inside `pnpm verify`) | pass — 309 ms, no dev markers | same |
| smoke (live) | `pnpm dev --host` + Chromium `/?dev=1` | pass — unlock, tap, three coos, mute both ways, greeting trace | `verification/phase-4.md` |

## Requirements

| ID | Implemented by | Verified by | Status |
| --- | --- | --- | --- |
| FR-1 | `hud.ts` Walk dispatch | `tests/viewer/hud-audio.test.ts` | covered |
| FR-2 | `hud.ts` POV dispatch | same | covered |
| FR-3 | `audio-controls.ts` `onSfx` ordering | `tests/viewer/audio-controls*.test.ts` | covered (see F2) |
| FR-4 | `index.html` species buttons + coo | `hud-audio.test.ts`, live probe | covered |
| FR-5 | `feedback.ts` coo gate | `tests/audio/feedback.test.ts`, live probe | covered |
| FR-6 | `audio.ts` greeting scheduler | `audio-routing.test.ts` | **partial** — F1 |
| FR-7 | `audio.ts` first-press slot | `audio-routing.test.ts`, live trace | covered |
| FR-8 | no `onSfx` on gear/Close/slider | `audio-controls.test.ts` | covered (F5 removes a vacuous duplicate) |
| FR-9 | try/catch on every path | three suites | covered |
| FR-10 | `🦒` in list and status text | DOM test + code-point check | covered |
| FR-11 | pure `feedback.ts`, thin adapters | `feedback.test.ts` | partial — F4 |
| NFR-1 | no new asset or dependency | precache 45 / 5072.34 KiB | covered |
| NFR-2 | latency 0.2–0.3 ms measured | `lastStartLatencyMs` | partial — F3 |
| NFR-3 | coverage floor | `pnpm coverage` | covered |
| NFR-4 | no motion gating | code review | covered |
| NFR-5 | `pnpm verify` green | exit 0 | covered |
| AC-1 | Walk, POV, mute dispatch | stub tests | covered |
| AC-2 | mute call order | `audio-controls.test.ts` | covered |
| AC-3 | per-species coo | stub tests + live | covered |
| AC-4 | gate windows | `feedback.test.ts` + live | covered |
| AC-5 | greeting once / after fade / not muted-or-mute-first | `audio-routing.test.ts` | **partial** — F1 |
| AC-6 | queued first press | `audio-routing.test.ts` + live | covered |
| AC-7 | gear/Close/slider silent | `audio-controls.test.ts` | covered |
| AC-8 | forced failure | three suites | covered |
| AC-9 | ≥72 px, names, no bone | 1280 × 800 measurement | partial — screenshot substituted, declared |
| AC-10 | parent listening pass | not run | **missing** — declared `tablet-touch-play` exception |
| AC-11 | coverage + verify | `pnpm verify` | covered |

## Findings

### Critical

- none

### High

- **F1 — `hello` is not suppressed after an unmute-first unlock**
  - **File:** `src/viewer/audio.ts:140`
  - **What:** `afterUnlock()` sets `firstGestureWasMute = audioEngine().muted`
    instead of recording which surface unlocked. On the mute path the unmuting
    branch runs `setMuted(false)` before `unlock()`, so `engine.muted` is already
    false and an unmute-first session greets. The mirror case over-suppresses: a
    Walk unlock while persisted-muted stays silent for the session even if a
    parent unmutes inside the fade.
  - **Why:** FR-6 and the "Mute-first gesture" edge case key suppression on the
    gesture, not on the mute state; AC-5 is not met in the unmute direction.
  - **Fix:** record provenance explicitly — `afterUnlock(options?: { viaMuteControl?: boolean })`,
    OR it into `firstGestureWasMute`, and keep the fire-time `muted` check as the
    only mute-state test.
  - **Requirement:** FR-6, AC-5
  - **Test gap:** the existing "stays silent after a mute-first unlock" test only
    models muted-at-unlock; it passes while the unmute-first path greets.

### Medium

- **F2 — the unlocking mute press's `tap` is flushed after mute applies** →
  **downgraded to Low, accepted** (see Debt). Dispatch happens exactly once
  (AC-1); audibility is governed by FR-9's "no-ops silently when muted", and the
  press *is* a muting press. Deferring `setMuted` until unlock resolves (the
  suggested fix) would read the stale unmuted state inside `AudioEngine.start()`
  and blip the kalimba for the length of the unlock, which is worse for a
  nursery at night.
- **F3 — the greeting adds a new timer, which NFR-2 forbids** → **fixed by
  narrowing NFR-2's wording** (see Doc sync). The invariant that matters —
  dispatch stays synchronous, no per-tap debounce, no repeating timer — holds;
  the blanket ban also forbade the 400 ms fade the spec itself requires.

### Low

- **F4 — `audio-controls.ts` hardcodes `'tap'`** instead of the surface table,
  leaving `sfxForSurface('mute')` dead in production (FR-11). Fixed in R1.
- **F5 — the HUD-level FR-8 test is vacuous** (`tests/viewer/hud-audio.test.ts:315`);
  the fake elements are never wired, so the assertion cannot fail. Fixed in R1 by
  deleting it — AC-7 rests on the adapter test, which does wire real listeners.
- **F6 — plan and Phase 4 acceptance text overstate two results:** P4.T3.1 is
  checked as an audible-and-instant verdict although the same block declares the
  `tablet-touch-play` exception, and Phase 4 marks AC-5 "met" while Phase 3
  discloses the unmute-first gap. Fixed in R1.
- **F2 (downgraded)** — accepted with reason, recorded in Debt.

## Overrides

- none

## Plan compliance

All 16 planned tasks are checked and the phase boundaries match the diff. Phase 1
is `src/audio/feedback.ts` plus its node test, Phase 2 is markup plus HUD
dispatch, Phase 3 is the facade/adapter wiring, Phase 4 is evidence plus
`tech-stack.md`. The squash and rework history (five phase commits, `f783c7e`
rework, doc sync at `5a01777`) is consistent with the evidence. Two records were
inaccurate and are corrected in R1 (F6).

## Out of scope

- Real 3D picking of the dinosaurs (Cuddle & Coo track).
- Wiring `heart`, `sparkle`, `nom`, `all-done`, `count-*`.
- Externalised strings: `product-guidelines.md` claims UI copy lives in
  `strings/en.json`, which does not exist. Not introduced by this track.

## Debt

| ID | Finding | Reason | Issue |
| --- | --- | --- | --- |
| F2 | Locked mute-first press dispatches `tap` but the engine is already muted when the held press flushes | dispatch order and frequency are correct; audibility is FR-9's business; deferring the mute would blip music | none — accepted, recorded here |
| AC-10 | Parent listening pass on the real tablet | human-only `tablet-touch-play` exception; checklist in `verification/phase-4.md` | none |
| AC-9 | Landscape screenshot | no visible desktop window in the automation session; substituted by a 1280 × 800 layout measurement | none |

## Doc sync

`updated` — `tech-stack.md` gained the feedback-layer bullet before review; NFR-2
in `spec.md` narrowed during R1 to "no new timers on the dispatch path; the single
one-shot greeting scheduler and the existing HUD interval are the only timers".

## History

| Round | Verdict | Critical | High | Medium | Low | Fixed |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | BLOCK | 0 | 1 | 2 | 3 | 3 |
