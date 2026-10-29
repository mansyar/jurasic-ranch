# Phase 3 — Howler Engine, Unlock & Ducking

- Track: `20261029-cozy-sound-voice` — Cozy Sound & Voice Foundation
- Phase: 3 of 5
- Date: 2026-10-29
- Branch: `feat/20261029-cozy-sound-voice`
- Base: `817c04c` (phase base)
- Head: `da9ffe9`
- Result: **verified**

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static + unit + coverage + build | `pnpm verify` | 0 | oxlint clean; oxfmt 75 files clean; `tsrs --noEmit`; 37 files / 396 tests pass; lines 79.81% (gate 60); audio pack 15 assets / 859,977 B; Vite build OK; `dist` clean of dev-harness markers |

Coverage for the new modules:

| File | Statements | Branches | Lines |
| --- | --- | --- | --- |
| `src/audio/engine.ts` | 96.08 | 89.28 | 97.15 |
| `src/audio/gesture.ts` | 96.42 | 90.00 | 96.42 |
| `src/viewer/audio.ts` | 85.71 | 100.00 | 85.71 |

Uncovered lines are the real Howler loader (`engine.ts:72-73`, imported only on a real
gesture) and the only facade line that calls a real unlock (`audio.ts:24`); unit tests are
forbidden from importing Howler or touching an `AudioContext`.

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-2 | Audio unlocks on the first `pointerdown`/`keydown` exactly once; no `Howl` or `AudioContext` before the gesture | `tests/audio/engine.test.ts` — "loads no Howler and builds no Howl", "ignores playback calls until unlock runs", "is idempotent", "shares one in-flight unlock"; `tests/audio/gesture.test.ts` — pointerdown and keydown cases fire once, passive listeners removed after the gesture and on cleanup; mute-safe first gesture test starts music at zero Howl plays | met |
| AC-3 | Seamless music loop with a ≤400 ms fade-in, paused while hidden, resumed when visible, ducked during a voice line | `engine.test.ts` — music `Howl` created with `loop: true`, `preload: true`, `html5: false`; fade 0 → `MUSIC_BUS_GAIN` in 400 ms; hide pauses and the same sound instance resumes; unmuted-only resume; suspended context resumed once; duck to `0.35x` and restore | met |
| AC-4 | Six SFX share a small overlap pool with no queue and no errors above the cap | `engine.test.ts` — cap admits exactly `SFX_OVERLAP_CAP`, the extra tap is dropped, a slot is freed on natural end and on explicit stop; bus-mismatched ids are ignored | met |
| AC-5 | A new voice line always wins and the duck survives the interruption | `engine.test.ts` — previous line stopped before the next starts, stale `onend` from the replaced line cannot restore music, same-asset replay does not compound the duck. ≤100 ms start latency is a Phase 5 measurement | partial (latency deferred) |
| AC-9 | A missing asset warns once and boot still succeeds | `engine.test.ts` — one `console.warn` per asset id on `onloaderror`, the rest of the pack plays, `unlock()` resolves even when Howler itself fails to load, `musicPlaying` stays false. The live rename/reload smoke is deferred to Phase 5 (see deviations) | met at unit level; runtime smoke Phase 5 |

Supporting invariants: master volume rides `Howler.volume` after `clampVolume`, while the
music Howl keeps `MUSIC_BUS_GAIN` × duck (`setVolume` never rewrites the duck); `mute` stops
an active line so a duck cannot outlive it; `stopAll` clears music, voice, SFX, and the SFX
count; `dispose` unloads every Howl and returns the engine to locked.

## Evidence paths

- Engine: `src/audio/engine.ts`, `tests/audio/engine.test.ts`
- Gesture + visibility: `src/audio/gesture.ts`, `tests/audio/gesture.test.ts`
- Boot wiring + facade: `src/viewer/main.ts`, `src/viewer/audio.ts`, `src/viewer/viewer.test.ts`
- Lazy chunk proof from the build: `dist/assets/howler-o_lUzpHf.js` (35.92 kB, 9.59 kB gzip)
  is emitted separately and referenced only from the dynamic loader.

## Deviations

1. `src/viewer/viewer.test.ts` — the brief names `tests/viewer/viewer.test.ts`, but the
   viewer suite lives beside its source and no `tests/viewer/viewer.test.ts` exists. Updating
   the real file avoids a duplicate suite that would drift; the assertion change (old silent
   stub → lazy facade + gesture wiring) is exactly P3.T3.2.
2. P3.T3.3's rename smoke was not run: renaming a committed MP3 breaks the audio-pack gate,
   so the phase shell cannot both rename the file and finish green, and there is no allowed
   dev-server/browser command. The failure path is covered at unit level (one warning, pack
   usable, `unlock()` resolves), and boot never awaits audio. The end-to-end rename and reload
   stays for the Phase 5 offline smoke.
3. No other files outside `Touches` were touched.

## Known gaps

- The ≤400 ms fade-in uses Howler's own `fade`. Howler's `volume()` cancels an in-flight fade
  before applying the new value, so a duck that starts inside the fade window is not
  overwritten by the fade's target; the fake `fade` is synchronous and does not model the
  interval. No private timer is needed.
- `musicPlaying` is engine state, not a Howler query, so it reports intent even if the device
  never produced sound (for example a locked-down browser). The dev bridge in Phase 5 exposes
  it as intent.

## Notes

- `unlock()` never rejects: a failed `howler` import or a failed `Howl` construction warns once
  and sets `loadFailed`, so the gesture handler has no unhandled promise.
- Music duck is applied to the music Howl only; voice and SFX gains come from the catalog, so
  the music bus stays near −20 dB under a line without touching the other buses.
- `installGestureUnlock` and `installVisibilityHandling` both take injectable DOM targets, so
  the tests run without jsdom; `VisibilityEngine` is a structural interface so the visibility
  tests do not need a real engine.
- Commit trail: `089a63f` engine + tests, `f5e4dd3` gesture + visibility, `45872fd` boot
  wiring, `199596f` facade tests.
