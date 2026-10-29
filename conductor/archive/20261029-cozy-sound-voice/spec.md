# Cozy Sound & Voice Foundation — Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

Replace the silent audio stub with a complete, offline-first audio foundation: a
typed asset catalog, a Howler-backed mixer with music/SFX/voice buses,
gesture-gated unlocking, voice ducking, a one-tap mute control, persisted master
volume, and a hold-to-open parent volume gate. It ships a starter pack of one
CC0 kalimba loop, six SFX, and eight Kokoro `af_bella` 0.85x voice lines. No care
gameplay is added.

## Problem / Motivation

`src/viewer/audio.ts` only dynamically imports Howler; it never plays anything,
and unlocking is wired solely to the Walk toggle. The ranch is therefore
completely silent, which violates three product pillars: "fully voiced, no
reading", "every tap <100 ms ... sound", and "kalimba -20 dB under voice". The
mute button and parent volume lock required by the guidelines do not exist.
Every planned care verb (feed, wash, cuddle) needs a stable audio API, so
building that API now prevents three separate ad-hoc audio implementations
later.

## Goals & Success Metrics

- **Goal:** any first gesture unlocks audio; the starter pack plays offline;
  mute and volume survive reload; music ducks under voice.
- **Metric:** zero audible output before a gesture; voice start <=100 ms after
  preload; starter pack <=2.5 MB; total precache <15 MB; zero console errors
  when an asset is missing; parent-voice-review and tablet-touch-play approved.

## Scope

### In Scope

- Typed catalog for 1 music loop, 6 SFX, and 8 voice lines.
- Music/SFX/voice buses, master volume, mute, and voice ducking.
- First-gesture unlock, visibility pause/resume, and silent degradation on load
  failure.
- Bottom-right 72 px mute button and 72 px gear with a 2 s hold gate.
- Persisted mute and master volume via `idb-keyval`.
- Offline precache for mp3, a pack validation script, and updated CREDITS.
- Kokoro generation script and a reproducible voice-line manifest.
- Dev-harness audio state and actions.

### Out of Scope

- Feed, wash, cuddle, counting gameplay, or any care interaction.
- Body-part lines, "thank you", "yum", or the parent re-record pack.
- Parent language toggle, sticker reset, credits screen, or full parent corner.
- Runtime TTS, SpeechSynthesis, cloud audio, CDN assets, analytics, or
  background playback when the app is closed.
- Separate music/voice sliders, preset volume levels, spatial audio, or haptics.
- Choosing or shipping more than one music loop.

## Functional Requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                                           | Priority |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-1  | A typed catalog is the single source of truth for every audio asset: `id`, `bus` (`music`/`sfx`/`voice`), `path`, `loop`, `gain`, and `durationSeconds`. Paths resolve through `import.meta.env.BASE_URL`.                                                                                                             | must     |
| FR-2  | The first `pointerdown` or `keydown` anywhere on the document unlocks audio exactly once. No AudioContext is created, resumed, or played before a gesture. Unlock is idempotent.                                                                                                                                      | must     |
| FR-3  | After unlock, the kalimba loop starts if not muted, loops seamlessly, fades in over <=400 ms, plays at 0.1x the voice bus (approx -20 dB), pauses while the document is hidden, and resumes on return if not muted.                                                                                                    | must     |
| FR-4  | Six one-shot SFX are available by id: `coo-trike`, `coo-stego`, `coo-brachio`, `tap`, `heart`, `sparkle`. Each call plays once; repeated calls overlap up to a fixed cap and never queue.                                                                                                                              | must     |
| FR-5  | Eight voice lines are available by id: `hello`, `nom`, `all-done`, `count-1`, `count-2`, `count-3`, `count-4`, `count-5`. A new line stops the current line immediately ("newest wins"), ducks music to 0.35x while speaking, and restores music after the line plus a 0.3 s tail. Every line is <=2 s.               | must     |
| FR-6  | A 72 px bottom-right mute button with icon + English word toggles all sound instantly, exposes `aria-pressed`, stops any active voice line, and persists its state across reloads.                                                                                                                                    | must     |
| FR-7  | A master volume in `0..1`, default `0.8`, is persisted, clamped, and applied live. It is adjustable only inside the parent panel.                                                                                                                                                                                     | must     |
| FR-8  | A 72 px gear opens the parent panel only after a continuous 2 s pointer or keyboard hold with visible progress. Early release, pointer cancel, or blur cancels. The panel contains the master slider, current mute state, and a 72 px close button; `Escape` closes it and returns focus to the gear. No external links. The unlocked state is not persisted. | must     |
| FR-9  | Missing, 404, or undecodable assets log one `console.warn`, play silence, and never block boot or reject an unhandled promise. All shipped assets are precached; runtime makes no network requests.                                                                                                                     | must     |
| FR-10 | The dev harness exposes `window.__ranch.audio` with `{ unlocked, muted, volume, musicPlaying, activeLine, lastStartLatencyMs }` plus `mute()`, `setVolume()`, `play(id)`, and `stopAll()`. The snapshot includes the same state. The bridge is dev-only.                                                               | should   |
| FR-11 | At runtime the app requests only same-origin static files. No CDN, analytics, or third-party calls are introduced.                                                                                                                                                                                                    | must     |
| FR-12 | Settings read/write failures (private mode, blocked IndexedDB) fall back to in-memory defaults and never throw.                                                                                                                                                                                                        | should   |

## Non-Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1  | Starter pack <=2.5 MB; total precache <15 MB; voice/SFX mp3 at 128 kbps; music loop 30-60 s.                                                                                                                                                   |
| NFR-2  | Voice start <=100 ms after preload; SFX start <=50 ms; first unlock completes <=300 ms after the gesture; 60 fps and the existing frame budget are unaffected.                                                                                  |
| NFR-3  | Voice normalized to -16 LUFS with <=0.3 s trailing silence; kalimba sits approx -20 dB under voice; no clipping, no startling transients, no sound above the intended warm character.                                                         |
| NFR-4  | All new controls are >=72 px, icon + English word, keyboard operable, focus-visible, colorblind-safe, and never rely on color alone. No reading is required to use the game. Hold-gate progress is visible without motion.                       |
| NFR-5  | Audio never changes seeded simulation state or determinism. Playback logic has no leaked timers or listeners across teardown, and pure logic is unit-tested.                                                                                    |
| NFR-6  | Music and SFX are CC0; Kokoro-82M is Apache-2.0. Every asset has a CREDITS row with source URL, license, and processing notes. No attribution-only or unclear-license assets.                                                                   |
| NFR-7  | Works on current iPadOS Safari and Android Chrome tablets, including suspended/resumed AudioContext, hidden-tab transitions, and first-gesture unlock.                                                                                         |
| NFR-8  | Fully offline and COPPA-safe: no accounts, tracking, ads, or data leaving the device.                                                                                                                                                          |

## Acceptance Criteria

| ID    | Criterion                                                                                                                                        | Verifies                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| AC-1  | The catalog contains exactly 1 music, 6 SFX, and 8 voice entries; every entry resolves to a committed file; the pack check exits 0.                | FR-1                       |
| AC-2  | Before a gesture, no Howl is constructed and no AudioContext is resumed; the first gesture unlocks once; additional gestures do not duplicate playback. | FR-2                  |
| AC-3  | After unlock, music loops and pauses when hidden; it drops to the ducked level during a voice line and returns after the 0.3 s tail.             | FR-3, FR-5                 |
| AC-4  | Each SFX id plays on demand; rapid repeated calls respect the overlap cap and produce no console errors.                                          | FR-4                       |
| AC-5  | Triggering a second voice line stops the first; measured start latency is <=100 ms; each line is <=2 s with a 0.3 s tail.                         | FR-5, NFR-2                |
| AC-6  | The mute button is >=72 px, toggles sound immediately, exposes the correct icon/word/`aria-pressed`, and survives reload.                        | FR-6                       |
| AC-7  | Volume changes apply live, clamp to `0..1`, persist across reload, and are reachable only through the parent panel.                               | FR-7                       |
| AC-8  | A 2 s hold opens the panel; release at 1.9 s cancels; `Escape` and the close button close it and return focus to the gear.                        | FR-8                       |
| AC-9  | Renaming one mp3 produces exactly one warning, silent playback, and a successful boot with no unhandled rejection.                               | FR-9                       |
| AC-10 | Airplane-mode reload serves the shell and plays music, SFX, and a voice line with no external requests.                                            | FR-9, NFR-1                |
| AC-11 | The dev harness reports audio state and accepts actions; `check-dist-clean` still proves the bridge is absent from `dist`.                        | FR-10                      |
| AC-12 | The starter pack is <=2.5 MB, total precache <15 MB, and CREDITS covers every asset.                                                              | FR-1, FR-9, NFR-1, NFR-6   |
| AC-13 | Parent-voice-review approves warmth and no-scare; tablet-touch-play approves the mute and gear feel.                                             | FR-5, FR-8, NFR-4          |
| AC-14 | A dev-harness fps comparison before/after music and voice playback shows no regression.                                                          | FR-3, FR-4, NFR-2          |

## Edge Cases

- First gesture is the mute button: unlock silently, remain muted, no music blip.
- Persisted `muted: true`: unlock succeeds, music never starts.
- Persisted volume `0`: silent but not muted; slider remains usable.
- Rapid taps: SFX overlap cap; no unbounded Howl instances.
- New voice line during a line: previous stops immediately; music duck does not
  stack.
- Voice ends naturally: music restores exactly once after the tail.
- Tab hidden during a line: music pauses; voice may finish; return resumes only
  if not muted.
- Asset 404/decode failure: one warning per asset, silence, no retry loop.
- IndexedDB unavailable: defaults in memory; no throw; UI still works.
- Parent holds, drags off the gear, or the pointer is cancelled: gate resets.
- Keyboard user holds Space/Enter: same 2 s gate; `Escape` closes.
- Orientation change while the panel is open: panel remains usable; no clipped
  controls.
- Reduced motion: hold progress uses a static ring/fill, not pulsing.
- Duplicate unlock calls from Walk + document listener: one unlock, one music
  start.
- Howler context suspended after device sleep: next gesture resumes it.

## Dependencies

- **Tracks:** none.
- **External:** Kokoro-82M ONNX model and a local Python environment (one-time,
  build-time only); CC0 music/SFX sources for the starter pack. No runtime
  services or credentials.

## Open Questions & Assumptions

- **Assumption:** a single master volume is sufficient; separate music/voice
  sliders are deferred.
- **Assumption:** the gear is labelled "Volume" with
  `aria-label="Parent volume settings"`.
- **Assumption:** music pauses while the tab is hidden and does not continue in
  the background.
- **Assumption:** the first gesture on mute unlocks silently.
- **Assumption:** Kokoro runs under Python 3.13; if not, a 3.12 virtualenv is an
  acceptable fallback.
- **Open:** the exact CC0 kalimba track and SFX sources are selected in the
  asset phase; if no suitable loop is found, an original synthesized loop is the
  fallback.
- **Open:** final voice text may be trimmed during parent-voice-review while
  keeping the same ids.

## References

- `conductor/product.md` - voice/music scope, 6-clip cap, offline constraints.
- `conductor/product-guidelines.md` - voice tone, -20 dB music, mute + parent
  lock, 72 px, no reading.
- `conductor/tech-stack.md` - Howler 2.2, mp3 128 kbps, Kokoro af_bella 0.85x,
  IndexedDB settings.
- `conductor/workflow.md` - verification layers, manual exceptions, quality
  gates.
- `conductor/archive/20261029-ranch-warmth-ui/spec.md` - lullaby deferral to
  Cozy Sound.
