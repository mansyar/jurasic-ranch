# Cozy Sound & Voice Foundation — Implementation Plan

> **Branch:** `feat/20261029-cozy-sound-voice`
> **Base:** `main` @ `1a96d6b0ba63f3f9e08d0a9592a3ad746fe4960e`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, or `blocked`.
> Only the primary agent writes this file. Phase subagents report results and the
> primary records them.

## Phase 1: Audio Catalog & Pure Mix Logic

- **Goal:** A typed 15-asset catalog and pure mute/volume/duck/overlap resolvers exist with unit tests, without importing Howler.
- **Depends on:** none
- **Covers:** FR-1, FR-5, FR-6, FR-7, NFR-5
- **Touches:** `src/audio/catalog.ts`, `src/audio/mix.ts`, `tests/audio/catalog.test.ts`, `tests/audio/mix.test.ts`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P1.T1: Define the catalog schema and all 15 entries** — covers: FR-1
  - [x] **P1.T1.1:** Add `AudioBus`, `AudioAsset`, `AUDIO_CATALOG`, `getAudioAsset`, and an `assetUrl` helper resolving through `import.meta.env.BASE_URL`.
  - [x] **P1.T1.2:** Add exactly 1 music, 6 SFX, and 8 voice entries with `path`, `loop`, `gain`, and `durationSeconds`; voice ids must match the spec.
  - [x] **P1.T1.3:** Test unique ids, exact bus counts, loop-only-on-music, unknown-id behavior, and base-path resolution.
- [x] **P1.T2: Add pure mix and overlap logic** — covers: FR-5, FR-6, FR-7
  - [x] **P1.T2.1:** Define `DEFAULT_VOLUME = 0.8`, `MUSIC_BUS_GAIN = 0.1`, `DUCK_FACTOR = 0.35`, `VOICE_TAIL_SECONDS = 0.3`, and `SFX_OVERLAP_CAP`.
  - [x] **P1.T2.2:** Add `clampVolume`, `musicGain`, `duckGain`, and `canPlaySfx` with no DOM or Howler dependency.
  - [x] **P1.T2.3:** Test volume bounds, mute, duck/restore arithmetic, overlap cap, and defaults.

## Phase 2: Starter Pack Assets & Offline Precache

- **Goal:** All 15 assets are licensed, committed, normalized, validated by a script, and included in the offline precache within budget.
- **Depends on:** Phase 1
- **Covers:** FR-1, FR-3, FR-4, FR-5, FR-9, NFR-1, NFR-3, NFR-6
- **Touches:** `public/audio/**`, `scripts/voice/**`, `scripts/check-audio-pack.mjs`, `CREDITS.md`, `vite.config.ts`, `package.json`, `tests/scripts/check-audio-pack.test.ts`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P2.T1: Build the Kokoro voice generation pipeline** — covers: FR-5, NFR-3, NFR-6
  - [x] **P2.T1.1:** Add `scripts/voice/lines.json` with the eight ids, final text, `af_bella`, speed `0.85`, and tail `0.3`.
  - [x] **P2.T1.2:** Add `scripts/voice/generate.py` (kokoro-onnx -> ffmpeg: trim, -16 LUFS, 0.3 s tail, 128 kbps mono mp3) and a setup README including model/license notes.
  - [x] **P2.T1.3:** Generate the eight files and record durations and loudness for the evidence file.
- [x] **P2.T2: Source and process CC0 music and SFX** — covers: FR-3, FR-4, NFR-1, NFR-6
  - [x] **P2.T2.1:** Select one 30-60 s CC0 kalimba loop and trim it to a seamless loop point.
  - [x] **P2.T2.2:** Source CC0 coo, tap, heart, and sparkle audio; derive three distinct species coos without changing pitch beyond a warm range.
  - [x] **P2.T2.3:** Encode at 128 kbps mp3, normalize, and add a CREDITS row per asset with source URL, license, and processing notes.
- [x] **P2.T3: Validate the pack and precache mp3** — covers: FR-1, FR-9, NFR-1
  - [x] **P2.T3.1:** Add `scripts/check-audio-pack.mjs`: manifest <-> files, exact counts, no orphans, total <=2.5 MB, nonzero exit on failure.
  - [x] **P2.T3.2:** Add `mp3` to the Vite precache glob and the pack check to `pnpm verify`; unit-test the script helpers.
  - [x] **P2.T3.3:** Build and record the new precache entry count and total size.

## Phase 3: Howler Engine, Unlock & Ducking

- **Goal:** A gesture-unlocked engine plays, stops, and ducks the starter pack, and degrades to silence without blocking boot.
- **Depends on:** Phase 2
- **Covers:** FR-2, FR-3, FR-4, FR-5, FR-9, NFR-2, NFR-7
- **Touches:** `src/audio/engine.ts`, `src/audio/gesture.ts`, `src/viewer/audio.ts`, `src/viewer/main.ts`, `tests/audio/engine.test.ts`, `tests/audio/gesture.test.ts`, `tests/viewer/viewer.test.ts`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P3.T1: Build the Howler-backed engine** — covers: FR-1, FR-3, FR-4, FR-5, FR-9
  - [x] **P3.T1.1:** Lazy-load Howler, create Howls with `preload` and Web Audio, and warn once per failed asset without throwing.
  - [x] **P3.T1.2:** Implement seamless music loop with fade-in, hidden-tab pause/resume, duck to `0.35x` during voice, and restore after the 0.3 s tail.
  - [x] **P3.T1.3:** Implement newest-wins voice playback, SFX overlap cap, `stopAll`, `setMuted`, `setVolume`, and `dispose`.
  - [x] **P3.T1.4:** Test every transition with a fake Howl/Howler module; no real audio in unit tests.
- [x] **P3.T2: Add gesture unlock and visibility handling** — covers: FR-2, FR-3, NFR-7
  - [x] **P3.T2.1:** Unlock once on the first document `pointerdown` or `keydown`; no AudioContext before the gesture; repeated gestures are no-ops.
  - [x] **P3.T2.2:** Keep the first gesture mute-safe: resolve mute before starting music so tapping mute produces no blip.
  - [x] **P3.T2.3:** Resume a suspended context after device sleep; pause music on `visibilitychange` and resume only when visible and unmuted.
- [x] **P3.T3: Integrate the engine into boot** — covers: FR-2, FR-9
  - [x] **P3.T3.1:** Replace the walk-only `unlockAudio` path in `main.ts` with the engine while keeping `src/viewer/audio.ts` as the thin facade.
  - [x] **P3.T3.2:** Update the viewer tests that assert the old silent stub behavior.
  - [x] **P3.T3.3:** Confirm a missing-asset rename produces one warning and a successful boot.

## Phase 4: Sound Controls, Persistence & Parent Gate

- **Goal:** A bottom-right mute button and gear work with persisted state, a visible 2 s hold gate, and an accessible parent volume panel.
- **Depends on:** Phase 3
- **Covers:** FR-6, FR-7, FR-8, FR-12, NFR-4
- **Touches:** `index.html`, `src/audio/gate.ts`, `src/audio/settings.ts`, `src/viewer/audio-controls.ts`, `src/viewer/hud.ts`, `src/viewer/main.ts`, `tests/audio/gate.test.ts`, `tests/audio/settings.test.ts`, `tests/viewer/audio-controls.test.ts`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P4.T1: Implement the hold-gate state machine** — covers: FR-8
  - [x] **P4.T1.1:** Add a pure `HoldGate` with 2000 ms duration, progress `0..1`, start/tick/cancel/complete, and keyboard parity.
  - [x] **P4.T1.2:** Test completion at 2 s, cancel at 1.9 s, pointer cancel/blur, repeated starts, and progress clamping.
- [x] **P4.T2: Persist mute and master volume safely** — covers: FR-6, FR-7, FR-12
  - [x] **P4.T2.1:** Add `audio-muted` and `audio-volume` keys, default volume `0.8`, clamping, and live application to the engine.
  - [x] **P4.T2.2:** Fall back to in-memory defaults when `idb-keyval` fails; test read, write, and failure paths.
- [x] **P4.T3: Build the controls and parent panel** — covers: FR-6, FR-7, FR-8, NFR-4
  - [x] **P4.T3.1:** Add the bottom-right 72 px mute and gear buttons with icon + word, `aria-pressed`, and a visible non-motion hold ring.
  - [x] **P4.T3.2:** Add the parent panel with master slider, mute state, 72 px close, `Escape`, focus return, and no external links.
  - [x] **P4.T3.3:** Wire through `hud.ts`, add fake-DOM tests, and check landscape and portrait placement.

## Phase 5: Dev Bridge, Offline Smoke & Docs

- **Goal:** The dev harness exposes audio state/actions, the offline and latency/fps evidence is captured, and the docs reflect the shipped audio pipeline.
- **Depends on:** Phase 4
- **Covers:** FR-9, FR-10, FR-11, NFR-1, NFR-2, NFR-5, NFR-8
- **Touches:** `src/dev/harness.ts`, `src/dev/snapshot.ts`, `tests/dev/dev-harness.test.ts`, `tests/dev/snapshot.test.ts`, `conductor/tech-stack.md`, `conductor/product.md`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P5.T1: Expose audio in the dev harness** — covers: FR-10
  - [x] **P5.T1.1:** Add `window.__ranch.audio` state (`unlocked`, `muted`, `volume`, `musicPlaying`, `activeLine`, `lastStartLatencyMs`) and actions (`mute`, `setVolume`, `play`, `stopAll`).
  - [x] **P5.T1.2:** Add the same state to the snapshot; keep the bridge dev-only and covered by `check-dist-clean`.
  - [x] **P5.T1.3:** Test the bridge surface and snapshot shape without real audio.
- [x] **P5.T2: Capture offline, latency, and fps evidence** — covers: FR-9, FR-11, NFR-1, NFR-2, NFR-8
  - [x] **P5.T2.1:** Build and preview, reload with the network offline, and confirm music, SFX, and voice play with no external requests.
  - [x] **P5.T2.2:** Record pack size, precache total, voice start latency, and fps before/after playback in the phase evidence.
  - [x] **P5.T2.3:** Confirm the production build has no harness and no dev-only audio controls.
- [x] **P5.T3: Sync the docs and run integrated verification** — covers: NFR-1, NFR-6
  - [x] **P5.T3.1:** Document the audio pipeline, bus gains, pack budget, and voice-generation command in `tech-stack.md`.
  - [x] **P5.T3.2:** Update the Track 7 lullaby note in `product.md` to record delivery by this track.
  - [x] **P5.T3.3:** Confirm CREDITS and the `pnpm verify` pack check are documented, then run the full integrated verification.

> **Human-only exceptions:** `parent-voice-review` and `tablet-touch-play` are
> recorded during review. Phase 5 collects the pack measurements and harness
> evidence those reviews reference.

## Phase R1: Review Fixes

- **Goal:** Resolve review findings F1-F4 and F6-F9; record F5 and F10 as accepted debt with a Track 8 follow-up.
- **Depends on:** Phase 5
- **Covers:** F1, F2, F3, F4, F5, F6, F7, F8, F9, F10
- **Touches:** `src/audio/engine.ts`, `tests/audio/engine.test.ts`, `src/viewer/audio-controls.ts`, `tests/viewer/audio-controls.test.ts`, `src/viewer/main.ts`, `scripts/voice/generate.py`, `src/audio/mix.ts`, `conductor/tech-stack.md`, `CREDITS.md`, `conductor/tracks/20261029-cozy-sound-voice/verification/phase-5.md`
- **Verification:** `pnpm verify`
- **Status:** in_progress

- [ ] **R1.T1: Block failed-load assets and un-duck safely** — covers: F1
  - [ ] **R1.T1.1:** Track failed ids and make `readyHowl`/`musicHowl` reject them; clear their SFX slots.
  - [ ] **R1.T1.2:** Add regression tests for a failed voice (music restores, no active line) and a failed SFX (the rest of the bus still plays).
- [ ] **R1.T2: Fix parent-panel Escape and dialog semantics** — covers: F2
  - [ ] **R1.T2.1:** Bind Escape on the window while the panel is open and drop the false `aria-modal` claim.
  - [ ] **R1.T2.2:** Test Escape from the window, not the panel.
- [ ] **R1.T3: Measure real playback-start latency** — covers: F3
  - [ ] **R1.T3.1:** Capture the Howler `play` event and report elapsed time from the voice request.
  - [ ] **R1.T3.2:** Update the engine tests and evidence to distinguish playback latency from dispatch.
- [ ] **R1.T4: Keep boot alive when audio markup is missing** — covers: F4
  - [ ] **R1.T4.1:** Guard only the audio block and continue the ranch boot without it.
- [ ] **R1.T5: Correct docs, dead constants, and boot ordering** — covers: F5, F6, F7, F8, F9
  - [ ] **R1.T5.1:** Install the gesture unlock before the first awaited settings read.
  - [ ] **R1.T5.2:** Fix the `generate.py` tolerance docstrings, mark `VOICE_TAIL_SECONDS` documentation-only, and correct the CREDITS normalization sentence.
  - [ ] **R1.T5.3:** Record AC-14 as pending-hardware and F10 as accepted debt for Track 8.
