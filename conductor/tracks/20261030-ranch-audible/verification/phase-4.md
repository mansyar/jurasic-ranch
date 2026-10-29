# Phase 4 — Tablet listening pass and evidence

- **Track:** 20261030-ranch-audible — The Ranch Answers Back
- **Phase:** 4 — Tablet listening pass and evidence
- **Date:** 2026-10-30
- **Branch:** `feat/20261030-ranch-audible`
- **Phase base:** `a82d0f85eea84a2d8ecb7e698f10457a2802557e`
- **Head at verification:** `f783c7e` (rework commit, see Rework log)
- **Result:** verified, with one rework and one human-only item left open (AC-10)

## How the listening pass was run

`pnpm dev --host` (Vite 8.3.5, ready in 416 ms), Chromium driven through the
in-app browser at `http://localhost:5173/?dev=1`, real `AudioContext`, speakers
muted at the OS level only — every measurement is instrumented, not heard.

Onset probe: `AudioBufferSourceNode.prototype.start` was wrapped to timestamp
each buffer start, and `window.__ranch.snapshot().audio` supplied `unlocked`,
`musicPlaying`, `activeLine` and `lastStartLatencyMs`. Offsets are milliseconds
after the press.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static + unit + build | `pnpm verify` | 0 | 46 test files / 543 tests, 80.38 % lines, 45 precache entries (5072.34 KiB), build 309 ms, dist clean |
| smoke (live) | `pnpm dev --host` + in-app Chromium | n/a | app boots at `/`, `?dev=1` exposes `window.__ranch`, zero console errors apart from the known `THREE.Clock` deprecation |

## Measurements — 1280 × 800 logical viewport (AC-9 numeric half)

Measured inside a 1280 × 800 iframe loading the real page (`?dev=0`), so the
layout ran at the AC's viewport without an emulation tool:

| Target | Width | Height |
| --- | --- | --- |
| 🦕 Trike (species button) | 83 px | 72 px |
| 🦖 Stego (species button) | 89 px | 72 px |
| 🦒 Brachio (species button) | 101 px | 72 px |
| Walk | 102 px | 72 px |
| 🏠 Ranch | 82 px | 72 px |
| 🪹 Nest | 72 px | 72 px |
| 🌼 Garden | 89 px | 72 px |
| 🔊 Sound | 116 px | 72 px |
| ⚙️ Volume (parent) | 116 px | 72 px |

Every target is ≥ 72 px in both axes. Markup confirmed as
`BUTTON:trike`, `BUTTON:stego`, `BUTTON:brachio` inside `#species li`, with the
accessible names `🦕 Trike`, `🦖 Stego`, `🦒 Brachio` and `Parent volume settings`
for the gear. No `🦴` code point exists anywhere under `src/` or `index.html`
(checked by code point, U+1F9B4 absent).

## Measurements — onset and routing (AC-1, AC-3, AC-4, AC-6, AC-7)

| Check | Result |
| --- | --- |
| Tap / coo onset after press | **0.0 ms** offset on every controlled press (buffer start in the same task as the click) |
| Dispatch latency (`lastStartLatencyMs`) | **0.2 – 0.3 ms**, budget is 100 ms |
| Walk press while locked | one `tap` played after unlock resolved |
| Each species press (stego, trike, brachio, brachio again after the window) | exactly **1** start each, never 2 |
| Same species twice inside its window | **0** starts (gate holds) |
| Two species in the same tick | **0** extra starts (one coo at a time across the trio) |
| Mute press | 1 start (`tap`) before muting, then `muted: true`, `musicPlaying: false` |
| Unmute press | 2 starts (`tap` after unmuting + music resume), `muted: false`, `musicPlaying: true` |
| Gear, Close, slider | no starts, and the panel never opened: `requestAnimationFrame` advanced **1 frame in 800 ms** in this session, so the 2 s hold gate cannot complete here. Covered by unit tests (zero `onSfx` on gear, Close and slider); recorded honestly as untested live |

## Greeting trace (AC-5)

First gesture = a species press on a freshly loaded page, sampled every ~100 ms:

| t (ms) | starts | `activeLine` | `musicPlaying` |
| --- | --- | --- | --- |
| 11248 | 0 | null | false |
| 11350 | 0 | null | true (unlocked) |
| 11456 | 1 | null | true (queued first press flushed) |
| 11671 | 1 | null | true |
| 11779 | 3 | **hello** | true (greeting at unlock + ~400 ms, music start) |
| 12645 | 3 | null | true (hello finished, 0.93 s) |

A second gesture in the same session added sound but never set `activeLine`
again — `hello` fires once per session, after the 400 ms fade, exactly as FR-6
asks.

## Budget (P4.T4)

| Measure | Before | After |
| --- | --- | --- |
| Precache entries | 45 (5072.24 KiB) | 45 (5072.34 KiB) |
| Audio assets | 15 (853,289 B) | unchanged |
| New dependencies | — | none |

Growth is 0.1 KiB of hashed JavaScript, well inside NFR-2's 2 KiB allowance. No
asset, font or network request was added.

## Rework log

Phase 4 verification initially **failed** FR-6 / AC-5 on live evidence: after a
first-gesture unlock, the app produced two buffer starts (first press + music)
and `activeLine` stayed `null` — the greeting never played.

Root cause: `hello` is a **voice**-bus asset, and the Phase 3 facade delivered
every feedback id through `playSfx`. `AudioEngine.playSfx` resolves through
`readyHowl(id, 'sfx')`, which returns `undefined` for any id whose catalog bus is
not `sfx`, so the greeting was silently dropped — the exact failure mode FR-9
asks to stay silent about, hiding a real bug. Unit tests missed it because they
stub the engine and never exercise the bus rule.

Proof: `window.__ranch.audio.play('hello')`, which routes by bus to `playVoice`,
fired a buffer start, set `activeLine: "hello"` and reported 0.3 ms dispatch
latency on the same page where the production path stayed silent.

Fix (`f783c7e`, rework attempt 1): `deliver()` resolves the catalog asset and
dispatches by bus (`voice` → `playVoice`, `sfx` → `playSfx`, `music`/unknown →
nothing), which also gives the greeting the duck treatment and `activeLine`
tracking it needs; the greeting timer now returns early when
`!isAudioUnlocked()` so a relocked engine cannot park `hello` in the first-press
slot. `tests/viewer/audio-routing.test.ts` pins the routing against the real
catalog — five of its six tests fail when either half of the fix is reverted.

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | Walk, each POV pill and each mute button dispatch `tap` once per press | Phase 2/3 unit tests (call counts); live mute/unmute start counts above | met |
| AC-2 | Muting taps before `setMuted(true)`, unmuting after | `tests/viewer/audio-controls*.test.ts` call-order spies; live mute trace | met |
| AC-3 | Species buttons dispatch their own coo | live: stego/trike/brachio each 1 start, `coo-*` per `data-species` | met |
| AC-4 | Ten taps in 1 s → one coo; two species together → one coo | live gate probe (0 starts inside the window) + `tests/audio/feedback.test.ts` | met |
| AC-5 | `hello` once per session, not before the fade, never muted or after a mute-first gesture | greeting trace above; `shouldGreet` unit tests; routing tests | met (after rework) |
| AC-6 | Queued first press plays one `tap` after unlock, none on reject | live trace (11456 ms start after a locked press); routing tests for the locked path | met |
| AC-7 | Gear, Close and slider are silent | `tests/viewer/audio-controls*.test.ts` (zero `onSfx`); live probe | met |
| AC-8 | Forced engine failure stays silent and throws nothing | Phase 2/3 unit tests on the failing-engine path | met |
| AC-9 | ≥ 72 px targets at 1280 × 800, non-empty accessible names, Brachio not a bone | measurement table above; code-point check | met (numeric half measured, see limitation) |
| AC-10 | A parent hears every wired surface on the real tablet | **not run** — `tablet-touch-play` is a human-only exception | **open (human)** |
| AC-11 | New module ≥ 90 % lines, `hud.ts` > 50 %, `pnpm verify` green | `feedback.ts` 100 %, `hud.ts` 78.57 %, `audio.ts` 84.31 %; verify exit 0 | met |

### AC-10 checklist for the parent pass

1. Open the app on the tablet, headphones off, volume at the saved level.
2. Press Walk, then each POV pill: a soft tick on every press.
3. Press Trike, Stego, Brachio: each coo is distinct and matches its dinosaur.
4. Press Sound to mute: one tick, then silence; press again: tick, then music.
5. On first load only: "Hello!" lands just after the music comes up.
6. Hold the gear for two seconds: nothing sounds until the panel opens, then
   adjust the slider — still silent.

## Limitations

- `browser.screenshot` refused every attempt ("Screenshot needs a visible tab …
  keep its desktop window visible") because the desktop window is not visible in
  this session, and no viewport-emulation tool is installed. AC-9's numeric half
  was therefore measured by loading the page in a 1280 × 800 iframe and reading
  real `getBoundingClientRect()` values. A landscape screenshot is still worth
  capturing on the tablet during the AC-10 pass.
- The same invisibility throttles `requestAnimationFrame` (1 frame in 800 ms), so
  the gear's frame-driven two-second hold could not be completed live. AC-7's
  gear/Close/slider half rests on the unit tests, which assert zero `onSfx`
  calls; the hold gate itself is unchanged by this track and is covered by its
  own existing tests.
- Onset is measured at the buffer start inside the page, not at the speaker. The
  OS/DAC path adds delay that automation cannot observe; AC-10 covers it.
- The clean-machine check that the iOS silent switch never suppresses a sound is
  unverifiable in Chromium and stays with AC-10.

## Deviations

| File | Reason |
| --- | --- |
| `src/viewer/audio.ts` | rework: dispatches by catalog bus so `hello` reaches `playVoice` |
| `tests/viewer/audio-routing.test.ts` | new regression suite for the bus rule |
| `tests/viewer/audio-controls-feedback.test.ts` | fake engine needed a `playVoice` recorder once the greeting routes there |
