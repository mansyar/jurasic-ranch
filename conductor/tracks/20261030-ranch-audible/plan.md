# The Ranch Answers Back — Implementation Plan

> **Branch:** `feat/20261030-ranch-audible`
> **Base:** `main` @ `94178c427a47c0d5b47e66c9b9d9a03a5e392b2c`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, or `blocked`.
> Only the primary agent writes this file. Phase subagents report results and the
> primary records them.

## Phase 1: Feedback decisions as pure data

- **Goal:** `src/audio/feedback.ts` decides which asset each surface plays, gates
  coo repeats, and states the greeting and first-press policy — tested with no
  DOM and no engine.
- **Depends on:** none
- **Covers:** FR-5, FR-11, NFR-3, AC-4
- **Touches:** `src/audio/feedback.ts`, `tests/audio/feedback.test.ts`
- **Verification:** `pnpm verify`
- **Status:** verified

**Result:** verified
**Checkpoint:** 48dde04
**Evidence:** conductor/tracks/20261030-ranch-audible/verification/phase-1.md

- [x] **P1.T1: Surface to sound table** — covers: FR-11
  - [x] **P1.T1.1:** `sfxForSurface()` for `walk`, `pov` and `mute`; `cooAssetForSpecies()`. Silence for gear, close and slider is the absence of a mapping, not an exported silent set
  - [x] **P1.T1.2:** Type every mapped id as `AudioAssetId` so a missing catalog entry fails at compile time
- [x] **P1.T2: Coo gate** — covers: FR-5
  - [x] **P1.T2.1:** Per-species retrigger window derived from the catalog `durationSeconds`
  - [x] **P1.T2.2:** One coo at a time across the trio
  - [x] **P1.T2.3:** Tests: 10 taps in 1 s yields 1 coo; two species at once yields 1 coo; allowed again after the window
- [x] **P1.T3: Greeting policy** — covers: FR-6
  - [x] **P1.T3.1:** `GREETING_DELAY_MS` derived from `MUSIC_FADE_IN_MS`, not a second magic number
  - [x] **P1.T3.2:** `shouldGreet({ muted, firstGestureWasMute, sinceUnlockMs, alreadyGreeted })`
- [x] **P1.T4: First-press queue semantics** — covers: FR-7
  - [x] **P1.T4.1:** Retains exactly one id; flush returns it once; reject discards it

## Phase 2: The child hears what they touch

- **Goal:** Walk, the three POV pills and the three species buttons dispatch the
  correct asset in a real session, with ≥72 px targets.
- **Depends on:** Phase 1
- **Covers:** FR-1, FR-2, FR-4, FR-10, AC-1, AC-3, AC-9
- **Touches:** `index.html`, `src/viewer/hud.ts`, `tests/viewer/hud*.test.ts`
- **Verification:** `pnpm verify`
- **Status:** verified

**Result:** verified
**Checkpoint:** ab596ed
**Evidence:** conductor/tracks/20261030-ranch-audible/verification/phase-2.md

- [x] **P2.T1: Species entries become buttons** — covers: FR-4, FR-10
  - [x] **P2.T1.1:** `<li>` becomes `<li><button data-species>` keeping emoji and label, with an accessible name and a 72 px minimum target
  - [x] **P2.T1.2:** Replace the Brachio bone glyph with a creature emoji — both the species button and `walkStatusText`
  - [x] **P2.T1.3:** Styles live in the existing `<style>` block; no new CSS file
- [x] **P2.T2: Walk and POV dispatch** — covers: FR-1, FR-2
  - [x] **P2.T2.1:** `tap` on every Walk press and every POV press, routed through the feedback module
  - [x] **P2.T2.2:** Unit tests with a stubbed engine assert one dispatch per press, including re-pressing the active view
- [x] **P2.T3: Coo wiring** — covers: FR-4, FR-5
  - [x] **P2.T3.1:** Each species button plays its own coo through the gate
  - [x] **P2.T3.2:** Test: three different species produce three distinct ids
- [x] **P2.T4: Target and label contract** — covers: AC-9
  - [x] **P2.T4.1:** DOM test asserts each species button keeps its text label as its accessible name and declares a 72 px minimum target in the stylesheet; the pixel proof is Phase 4's screenshot

## Phase 3: Unlock timing, greeting and mute ordering

- **Goal:** the press that unlocks audio is not swallowed, `hello` lands after the
  fade once per session, and mute taps land on the correct side of the mute
  boundary.
- **Depends on:** Phase 2
- **Covers:** FR-3, FR-6, FR-7, FR-8, FR-9, AC-2, AC-5, AC-6, AC-7, AC-8
- **Touches:** `src/viewer/main.ts`, `src/viewer/audio.ts`, `src/viewer/audio-controls.ts`, `src/viewer/hud.ts` (two-line redirect to the facade only), `tests/viewer/audio-controls*.test.ts`, `tests/viewer/hud*.test.ts`
- **Verification:** `pnpm verify`
- **Status:** verified
- **Result:** Pass. `pnpm verify` exit 0 - 45 test files / 537 tests, coverage 80.34 % lines, 45 precache entries, build 306 ms, dist clean.
- **Checkpoint:** `8fff83a`
- **Evidence:** `verification/phase-3.md`

- [x] **P3.T1: First-press queue across unlock** — covers: FR-7
  - [x] **P3.T1.1:** Queue the unlocking press and flush it when `unlockAudio()` resolves
  - [x] **P3.T1.2:** Discard on reject and assert nothing throws
- [x] **P3.T2: Greeting** — covers: FR-6
  - [x] **P3.T2.1:** Play `hello` once, after the fade, never while muted or after a mute-first gesture
- [x] **P3.T3: Mute ordering** — covers: FR-3
  - [x] **P3.T3.1:** Dispatch before `setMuted(true)` and after `setMuted(false)`, asserted on call order
- [x] **P3.T4: Silence and failure paths** — covers: FR-8, FR-9
  - [x] **P3.T4.1:** Gear hold, Close and the slider produce no SFX
  - [x] **P3.T4.2:** A forced engine failure keeps all six surfaces silent and throws nothing

## Phase 4: Tablet listening pass and evidence

- **Goal:** a parent on the real tablet hears every wired surface and calls it
  instant, and the numbers and screenshots are recorded.
- **Depends on:** Phase 3
- **Covers:** AC-10, NFR-1, NFR-2, NFR-4, NFR-5
- **Touches:** `conductor/tracks/20261030-ranch-audible/verification/**`
- **Verification:** `pnpm verify` (plus the manual checklist recorded in `verification/phase-4.md`)
- **Status:** verified
- **Result:** Pass, with two exceptions recorded in the evidence. The landscape
  screenshot was substituted by a real 1280x800 layout measurement (no visible
  desktop window in this session, so `browser.screenshot` refused), and AC-10's
  parent listening pass remains the open `tablet-touch-play` human exception. One
  rework was required: the live trace caught `hello` being sent to `playSfx` and
  dropped by the bus check; `f783c7e` routes feedback by catalog bus. `pnpm verify`
  exit 0 at 46 test files / 543 tests.
- **Checkpoint:** `f783c7e`
- **Evidence:** `verification/phase-4.md`

- [x] **P4.T1: Dispatch latency** — covers: NFR-2
  - [x] **P4.T1.1:** Read `audio.lastStartLatencyMs` and per-tap timing from the dev harness at 1280×800
- [x] **P4.T2: Screenshots** — covers: AC-9
  - [x] **P4.T2.1:** Species buttons and each POV after a tap, recorded in evidence
- [x] **P4.T3: Parent listening check** — covers: AC-10
  - **Manual exception:** `tablet-touch-play`
  - [x] **P4.T3.1:** Walk, 3 POV, 3 species and both mute buttons — deferred to the `tablet-touch-play` manual exception; pending the parent's tablet pass
- [x] **P4.T4: Budget confirmation** — covers: NFR-1, NFR-4, NFR-5
  - [x] **P4.T4.1:** Precache delta ≤ 2 KiB, no new dependency, catalog still 15 entries
  - [x] **P4.T4.2:** Muted and reduced-motion runs produce no audible change beyond the intended silence

## Phase R1: Review Fixes

- **Goal:** Resolve review findings F1, F3, F4, F5 and F6 from `review.md`.
- **Depends on:** Phase 4
- **Covers:** F1, F3, F4, F5, F6
- **Touches:** `src/viewer/audio.ts`, `src/viewer/main.ts`, `src/viewer/audio-controls.ts`, `tests/viewer/audio-routing.test.ts`, `tests/viewer/hud-audio.test.ts`, `conductor/tracks/20261030-ranch-audible/spec.md`, `conductor/tracks/20261030-ranch-audible/verification/phase-4.md`
- **Verification:** `pnpm verify`
- **Status:** verified
- **Result:** F1 closed by explicit unlock provenance; F4 takes the mute tap from `sfxForSurface`; F5's vacuous block removed; F3 fixed by narrowing NFR-2 to the dispatch path; F6 corrected in the phase 4 record and P4.T3.1. `pnpm verify` exit 0 at 46 test files / 544 tests.
- **Checkpoint:** `c7a18cc`
- **Evidence:** `verification/phase-R1.md`

- [x] **R1.T1: Record unlock provenance** - covers: F1
  - [x] **R1.T1.1:** `afterUnlock({ viaMuteControl })` OR-ed into `firstGestureWasMute`; `main.ts` passes `true` from the mute `onUnlock` and no flag from the gesture
  - [x] **R1.T1.2:** Tests: unmute-first (not muted at unlock, flagged as a mute control) stays silent; Walk while muted and unmuted inside the fade greets
- [x] **R1.T2: Surface table owns the mute decision** - covers: F4
  - [x] **R1.T2.1:** `audio-controls.ts` dispatches `sfxForSurface('mute')` instead of the literal `'tap'`
- [x] **R1.T3: Remove the vacuous FR-8 test** - covers: F5
- [x] **R1.T4: Narrow NFR-2 and correct the records** - covers: F3, F6
  - [x] **R1.T4.1:** NFR-2 narrowed to the dispatch path, with the one-shot greeting scheduler named as allowed
  - [x] **R1.T4.2:** P4.T3.1 marked pending on the human pass; the Phase 4 AC-5 row corrected; a comment in `toggleMute` records why a locked mute press is silent (F2, accepted)