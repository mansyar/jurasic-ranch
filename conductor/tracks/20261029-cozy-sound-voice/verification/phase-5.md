# Phase 5 — Dev Bridge, Offline Smoke & Docs

- Track: `20261029-cozy-sound-voice` — Cozy Sound & Voice Foundation
- Phase: 5 of 5
- Date: 2026-10-29
- Branch: `feat/20261029-cozy-sound-voice`
- Base: `6507cef` (phase base)
- Head: `a4b1753` (code and tests) + this evidence and the doc sync
- Result: **verified** — P5.T1, the P5.T2 browser run, and P5.T3 are complete;
  `pnpm verify` is green. AC-13 remains human-only, and AC-14 is partial because
  the available browser is a throttled software renderer (see below).

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
| AC-2 | No Howl/AudioContext before a gesture; one unlock; no duplicate playback | Unit suites above, plus the browser run: a fresh dev tab reported `typeof Howler === 'undefined'`, `ctx: null`, `unlocked: false` before any tap; a real button click produced `unlocked: true`, `ctx.state: 'running'`, `musicPlaying: true`, and exactly 15 Howls. No second unlock is possible because the gesture installer disposes after the first accepted event | met |
| AC-3 | Music loops/pauses when hidden, ducks under voice, restores after the tail | Unit ducking/visibility suites; the offline production tab reported the kalimba Howl `loop: true`, `playing: true`. Visibility pause is unit-only (the browser tools cannot toggle the document hidden state) | met (audible duck is unit-tested, not ear-checked) |
| AC-4 | Each SFX id plays; rapid calls respect the overlap cap with no console errors | Unit overlap suite; browser dispatch of 20 rapid `tap` calls produced no console errors (dev and production tabs both clean) | met |
| AC-5 | Second line stops the first; start latency <=100 ms; each line <=2 s + 0.3 s tail | `play('hello')` then `play('nom')` reported `activeLine: 'nom'`; `lastStartLatencyMs` 0.1 ms; SFX dispatch 20 calls avg 0.02 ms, p95 0.1 ms, max 0.2 ms; catalog durations cap at 1.4 s | met (dispatch latency, not DAC onset) |
| AC-9 | One warning, silence, successful boot after an asset rename | Unit asset-failure suite (one warn per id, silence, boot resolves). The live rename/reload was not repeated in the browser because renaming a committed mp3 fails the pack gate and restoring it would invalidate this run | met at unit level; live rename not run |
| AC-10 | Airplane-mode reload serves the shell and plays music, SFX, voice with no external requests | Method and rows below: preview server stopped, SW-controlled reload served the shell, all 15 audio files returned 200 from the cache, music played, and a direct Howl played `hello` offline | met |
| AC-11 | Harness reports audio state and accepts actions; `check-dist-clean` proves it is absent from `dist` | Unit bridge suite; dev tab exposed `__ranch.audio` with state and all four actions; the production tab exposed no `__ranch` at all; `pnpm verify` printed `dist clean: no dev harness markers in dist` | met |
| AC-12 | Pack <=2.5 MB, precache <15 MB, CREDITS covers every asset | `pnpm verify`: `audio pack ok: 15 assets (1 music, 6 sfx, 8 voice), 859977 bytes`; `PWA precache 45 entries (4280.33 KiB)`; `CREDITS.md` has 15 asset rows | met |
| AC-13 | Parent-voice-review and tablet-touch-play approval | Not machine-checkable (human audio/touch review) | human-only, pending review |
| AC-14 | fps before/after music and voice playback shows no regression | `window.__ranch.snapshot().fps` sampled silent, with music, and with a voice line; the available browser is a throttled software renderer (4-25 fps), so a 60 fps claim is not possible. Within-run audio differences were within noise (see table) | partial: no measurable audio regression, 60 fps not verifiable here |

## Pack / precache / latency / fps

| Metric | Budget | Measured | Where |
| --- | --- | --- | --- |
| Starter pack size | <=2.5 MB | 859,977 B (15 assets) | `node scripts/check-audio-pack.mjs` in `pnpm verify` |
| Precache total | <15 MB | 45 entries / 4280.33 KiB (~4.18 MB) | Vite PWA build output in `pnpm verify` |
| Music start | playable after the first gesture | `musicPlaying: true`, `Howler.ctx.state: 'running'`, kalimba Howl `loop: true` | offline production tab |
| Voice start latency (dispatch) | <=100 ms | 0.1 ms for `hello`; `hello` then `nom` leaves `activeLine: 'nom'` | dev tab |
| SFX start latency | <=50 ms | 20 rapid `tap` calls: avg 0.02 ms, p95 0.1 ms, max 0.2 ms | dev tab |
| fps before playback | 60 fps, no regression | 4.65 -> 4.47 (silent); an earlier unthrottled window read 24.99 -> 22.89 | headless desktop browser |
| fps after music + voice | 60 fps, no regression | music 4.38 -> 4.28, voice 4.28 (same window); no repeatable audio cost | headless desktop browser |

`lastStartLatencyMs` is dispatch latency: `performance.now()` taken immediately
before and after `Howl.play` inside `playVoice`. It excludes decode that already
happened at preload and excludes DAC/onset, so it is a lower bound on what a
listener perceives.

The browser available to this run renders in software and throttles `rAF` to
4-25 fps (one 2 s `requestAnimationFrame` count produced 3 frames). That makes
AC-14 "60 fps" unverifiable here, but the audio-on/audio-off samples stay inside
the same drift, so there is no evidence of an audio regression. The parent
tablet run (AC-13) is the real check.

## Browser run

| Check | Result |
| --- | --- |
| Pre-gesture state | Fresh dev tab: `typeof Howler === 'undefined'`, `ctx: null`, `unlocked: false` |
| First real tap | `unlocked: true`, `ctx.state: 'running'`, `musicPlaying: true`, 15 Howls |
| Newest voice wins | `play('hello')` then `play('nom')` -> `activeLine: 'nom'` |
| Parent volume | `setVolume(1.7)` clamps to 1; `setVolume(0.4)` -> `Howler.volume() 0.4`, slider 40, readout `40%` |
| Mute | Button label `🔇 Muted`, `aria-pressed: true`, `Howler._muted: true`; survives an offline reload |
| Hold gate | Release at 1.5 s leaves the panel hidden; a 3.2 s hold opens it with focus on `#audio-panel-close`; Escape returns focus to the gear. The long wall-clock hold is the throttled `rAF`, not a gate bug |
| Console | No errors in the dev or production tab after the audio runs |

## Offline method and result

1. `pnpm build` and `pnpm preview --host`, load the production shell once, and
   let the service worker activate (45 entries, all 15 audio files present).
2. Stop the preview server (port 4173) so every uncached request must fail.
3. Reload: the service worker still serves the shell (`title`, status text, and
   `navigator.serviceWorker.controller` all present).
4. Inspect the app's own Howler state: 15 Howls `state: 'loaded'`, kalimba
   `playing: true`, `ctx.state: 'running'`, master volume 0.8.
5. Network list after the reload: 42 requests, the only origin is
   `http://localhost:4173`; all 15 audio files returned 200 in 2-15 ms from the
   cache. `fetch()` of `hello`, `tap`, and the kalimba also returned the exact
   byte sizes.
6. A direct `hello` Howl played (`playing: true`) with the context running.

The production bundle intentionally has no `__ranch`, so step 6 uses the
preloaded Howl directly; the engine's voice/SFX path was exercised end-to-end in
the dev tab and by the engine tests. The page still reported
`navigator.onLine === true` because this was a dead server, not true airplane
mode; the absence of a server is what forces the service-worker path.

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
- Docs applied: `conductor/tech-stack.md` (Audio section), `conductor/product.md`
  (Track 7 lullaby note), staged copy in `.conductor/evidence/phase-5-docs.md`
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
5. `conductor/tech-stack.md` and `conductor/product.md` — the subagent could not
   write them, so the primary applied both edits from
   `.conductor/evidence/phase-5-docs.md` before committing this evidence. The
   staged artifact is still present but gitignored.
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
