# Phase 5 — Dev Bridge, Offline Smoke & Docs

- Track: `20261029-cozy-sound-voice` — Cozy Sound & Voice Foundation
- Phase: 5 of 5
- Date: 2026-10-29
- Branch: `feat/20261029-cozy-sound-voice`
- Base: `6507cef` (phase base)
- Head: `a4b1753` (code and tests) + this evidence file
- Result: **partial** — P5.T1 and the code half of P5.T3 are verified by
  `pnpm verify`; P5.T2 (offline reload, latency, fps) is `pending primary
  browser run`; the two doc edits in P5.T3 are blocked by write permission and
  staged as an artifact (see Deviations).

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static + unit + coverage + build | `pnpm verify` | 0 | oxlint clean; oxfmt 81 files clean; `tsrs --noEmit`; 40 files / 450 tests pass; lines 82.03% (gate 60); audio pack 15 assets / 859,977 B; Vite build OK; precache 45 entries / 4280.33 KiB; `dist` clean of dev-harness markers |

Coverage for the changed modules:

| File | Statements | Branches | Lines |
| --- | --- | --- | --- |
| `src/audio/engine.ts` | 96.37 | 90.00 | 97.36 |
| `src/dev/harness.ts` | 74.65 | 50.00 | 74.91 |
| `src/dev/snapshot.ts` | covered through `tests/dev/snapshot.test.ts` (ported row not listed) | — | — |

`harness.ts` uncovered lines are the frame hook, overlay disposal, and the
`dev !== null` install paths that need a real three/WebGL boot; every new audio
line and the Sound row are covered by `tests/dev/harness-panel.test.ts`.

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-2 | No Howl/AudioContext before a gesture; one unlock; no duplicate playback | `tests/audio/engine.test.ts` "loads no Howler and builds no Howl", "is idempotent", "shares one in-flight unlock" | unit met; browser confirmation `pending primary browser run` |
| AC-3 | Music loops/pauses when hidden, ducks under voice, restores after the tail | `tests/audio/engine.test.ts` ducking and visibility suites | unit met; audible confirmation `pending primary browser run` |
| AC-4 | Each SFX id plays; rapid calls respect the overlap cap with no console errors | `tests/audio/engine.test.ts` SFX overlap suite | unit met; browser `pending primary browser run` |
| AC-5 | Second line stops the first; start latency <=100 ms; each line <=2 s + 0.3 s tail | `tests/audio/catalog.test.ts` durations; `tests/audio/engine.test.ts` newest-wins; the new `lastStartLatencyMs` reports dispatch time | measured latency `pending primary browser run` |
| AC-9 | One warning, silence, successful boot after an asset rename | `tests/audio/engine.test.ts` asset-failure suite | unit met; browser `pending primary browser run` |
| AC-10 | Airplane-mode reload serves the shell and plays music, SFX, voice with no external requests | Method and rows below | `pending primary browser run` |
| AC-11 | Harness reports audio state and accepts actions; `check-dist-clean` proves it is absent from `dist` | `tests/dev/harness-panel.test.ts` audio bridge suite (state, mute, setVolume, play, stopAll, Sound row, snapshot block); `pnpm verify` prints `dist clean: no dev harness markers in dist` | met (machine surface + dist); preview call `pending primary browser run` |
| AC-12 | Pack <=2.5 MB, precache <15 MB, CREDITS covers every asset | `pnpm verify`: `audio pack ok: 15 assets (1 music, 6 sfx, 8 voice), 859977 bytes`; `PWA precache 45 entries (4280.33 KiB)`; `CREDITS.md` has 15 asset rows | met |
| AC-13 | Parent-voice-review and tablet-touch-play approval | Not machine-checkable (human audio/touch review) | human-only, pending review |
| AC-14 | fps before/after music and voice playback shows no regression | `window.__ranch.snapshot().fps` plus the Sound row (Mute / Play hello / Stop) exist for the comparison | `pending primary browser run` |

## Pack / precache / latency / fps

| Metric | Budget | Measured | Where |
| --- | --- | --- | --- |
| Starter pack size | <=2.5 MB | 859,977 B (15 assets) | `node scripts/check-audio-pack.mjs` in `pnpm verify` |
| Precache total | <15 MB | 45 entries / 4280.33 KiB (~4.18 MB) | Vite PWA build output in `pnpm verify` |
| Music start latency | NFR-2 not numeric for music | `pending primary browser run` | — |
| Voice start latency (dispatch) | <=100 ms | `pending primary browser run`; unit tests assert the new `lastStartLatencyMs` is finite and resets to 0 on `stopAll` | `tests/audio/engine.test.ts` |
| SFX start latency | <=50 ms | `pending primary browser run` | — |
| fps before playback | 60 fps, no regression | `pending primary browser run` | — |
| fps after music + voice | 60 fps, no regression | `pending primary browser run` | — |

`lastStartLatencyMs` is dispatch latency: `performance.now()` taken immediately
before and after `Howl.play` inside `playVoice`. It excludes decode that already
happened at preload and excludes DAC/onset, so it is a lower bound on what a
listener perceives.

## Offline method and result

Planned (primary):

1. `pnpm build`
2. `pnpm preview --host`
3. Open `/?dev=1&seed=42&pause=1` in the target browser, unlock with one gesture.
4. Record same-origin-only requests in DevTools (audio must come from the service
   worker cache).
5. Reload with the network/airplane mode off, then call
   `__ranch.audio.play('hello')`, `play('tap')`, `play('music-kalimba')` and
   compare `__ranch.snapshot().fps` before and after.

Result: `pending primary browser run`. If the browser cannot produce a
measurement, record the limitation instead of a number (brief, P5.T2 note).

## Evidence paths

- Engine surface: `src/audio/engine.ts` (`activeVoiceId`, `lastStartLatencyMs`,
  `play(id)`), `tests/audio/engine.test.ts` ("dev harness audio surface (FR-10)")
- Snapshot: `src/dev/snapshot.ts` (`SnapshotAudio`, `audio` block),
  `tests/dev/snapshot.test.ts` ("audio block (FR-10)"), fixture update in
  `tests/dev/harness-state.test.ts`
- Bridge: `src/dev/harness.ts` (`DevBridge` audio surface, `DevAudioApi`,
  `window.__ranch.audio`, Sound row), `tests/dev/harness-panel.test.ts`
  ("audio bridge (FR-10, AC-11)")
- Wiring: `src/viewer/main.ts` (`getAudioState`, `mute`, `setVolume`, `play`,
  `stopAll` closures over `hud.audio` and `audioEngine()`)
- Docs to apply: `.conductor/evidence/phase-5-docs.md`
- Credits and pack check: `CREDITS.md` (15 rows), `scripts/check-audio-pack.mjs`

## Deviations

1. `src/audio/engine.ts` — brief-authorized engine change; also gained a
   `play(id)` dispatcher so the bus routing (`music`/`sfx`/`voice`, unknown ids
   ignored) is unit-testable instead of living untested in `main.ts`.
2. `tests/audio/engine.test.ts` — not in `Touches`; extended to pin the new
   engine getters and the `play(id)` routing.
3. `tests/dev/harness-state.test.ts` — not in `Touches`; its single
   `buildSnapshot` call needed the new required `audio` block (type-only fix).
4. `tests/dev/dev-harness.test.ts` does not exist; the harness suite is
   `tests/dev/harness-panel.test.ts` (brief allows "the existing harness test").
5. `conductor/tech-stack.md` and `conductor/product.md` — **not written**: the
   edit tool returned `permission denied` for `conductor/tech-stack.md` (and
   `product.md` is also off-limits as a product doc for this subagent). The exact
   replacement text is staged in `.conductor/evidence/phase-5-docs.md` for the
   primary to apply. This is why P5.T3 is reported `partial`.
6. `.conductor/evidence/phase-5-docs.md` — new artifact, allowed evidence path.

## Notes

- `mute` goes through `hud.audio.setMuted`, so the button/panel label,
  `aria-pressed`, engine mute, and the `audio-muted` write all follow a dev call
  exactly as a tap would. It deliberately does **not** call the button's
  `unlock()`: a browser only grants an AudioContext from a real gesture, so the
  primary must unlock first (one tap) before `play()` produces sound.
- `setVolume` goes through `hud.audio.setVolume`, so it clamps, updates the
  slider/percent readout, applies to the engine, and persists — the same path as
  the parent slider.
- `play(id)` on the engine reads the catalog bus and ignores unknown ids; music
  resumes the existing loop rather than restarting it.
- Bridge state is read live through `getAudioState()`, so `__ranch.audio` never
  reports a stale copy; `snapshot().audio` is a fresh copy of the same block.
- The Sound row (`Mute`, `Play hello`, `Stop`) is dev-only chrome inside the
  existing panel; `check-dist-clean` still passes because the harness is a
  `import.meta.env.DEV`-guarded dynamic import.
- Commit trail: `72aa38b` engine surface + tests, `a4b1753` dev bridge + tests,
  then this evidence file.
