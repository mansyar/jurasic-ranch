# Phase 4 — Sound Controls, Persistence & Parent Gate

- Track: `20261029-cozy-sound-voice` — Cozy Sound & Voice Foundation
- Phase: 4 of 5
- Date: 2026-10-29
- Branch: `feat/20261029-cozy-sound-voice`
- Base: `478704d` (phase base)
- Head: `3b0f549` (code, tests, and this evidence file)
- Result: **verified**

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static + unit + coverage + build | `pnpm verify` | 0 | oxlint clean; oxfmt 81 files clean; `tsrs --noEmit`; 40 files / 439 tests pass; lines 81.40% (gate 60); audio pack 15 assets / 859,977 B; Vite build OK; `dist` clean of dev-harness markers |

Coverage for the new or changed modules:

| File | Statements | Branches | Lines |
| --- | --- | --- | --- |
| `src/audio/gate.ts` | 96.96 | 92.30 | 96.96 |
| `src/viewer/audio-controls.ts` | 94.26 | 75.92 | 94.26 |
| `src/audio/gesture.ts` | 96.66 | 92.85 | 96.66 |
| `src/viewer/audio.ts` | 77.77 | 100.00 | 77.77 |

The only uncovered `audio.ts` lines are `configureAudio` (called from `main.ts`, which the
suite never boots) and the engine constructor; `gate.ts:15` is the non-finite progress guard.
`src/audio/settings.ts` is exercised by its own suite but does not appear as a row in the v8
table, so its behaviour is pinned by test assertions rather than a reported percentage.

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-6 | The mute button is >=72 px, toggles sound immediately, exposes the correct icon/word/`aria-pressed`, and survives reload | `index.html` — `#audio-mute` shares the 72 px button rule (`min-width`/`min-height: 72px`) with the gear and close; `tests/viewer/audio-controls.test.ts` — "keeps icon + word on both mute labels (NFR-4)", "starts from the persisted state and mirrors it in word + aria-pressed", "toggles sound, reports the change, and unlocks after the tap", "keeps the panel mute button in sync and stays silent on a failed unlock"; reload survival: `tests/audio/settings.test.ts` — "round-trips what save wrote, which is what a reload sees" | met (relaunch/reload smoke is human-only, see AC-13) |
| AC-7 | Volume changes apply live, clamp to `0..1`, persist across reload, and are reachable only through the parent panel | `tests/viewer/audio-controls.test.ts` — "renders the initial volume as a clamped percent", "applies slider input live and clamps it into 0..1" (55, 150, -20), "applies an external volume through the same clamp"; `tests/audio/settings.test.ts` — read/write of `audio-volume`, clamping of 1.7/-0.4/`NaN` to 1/0/0.8, "round-trips what save wrote"; only the panel contains `#audio-volume`, and the gear is the only opener | met |
| AC-8 | A 2 s hold opens the panel; release at 1.9 s cancels; `Escape` and the close button close it and return focus to the gear | `tests/audio/gate.test.ts` — completion at 2000 ms, cancel at 1900 ms, repeat start, progress clamp; `tests/viewer/audio-controls.test.ts` — "opens the panel at 2 s, resets the ring, and focuses inside", "cancels at 1.9 s on pointerup without opening", "cancels on pointerleave, pointercancel, and window blur", "does not extend the hold on a repeated pointerdown", "supports the same 2 s gate from Space and Enter", "closes on Escape and returns focus to the gear", "closes from the 72 px close button and returns focus to the gear" | met |
| AC-13 | Parent-voice-review approves warmth and no-scare; tablet-touch-play approves the mute and gear feel | Not machine-checkable: warmth/no-scare is an audio-content review, and the mute/gear feel is a tablet-touch walkthrough. The code-level half (72 px, icon + word, visible non-motion hold ring, focus-visible) is pinned above | human-only, pending review |

Supporting guarantees:

- FR-12: `settings.test.ts` covers a rejected mute read, both reads rejecting, one key
  rejecting while the other resolves, and a failing write on both setters — every path
  resolves, so boot and taps fall back to the in-memory defaults.
- NFR-4: 72 px mute, gear, close, and slider height; icon + word labels
  (`🔊 Sound` / `🔇 Muted` / `⚙️ Volume`); state never carried by colour alone (`aria-pressed`,
  text change, and a green border); `:focus-visible` outline on buttons and the slider; the
  hold ring is a static `conic-gradient` driven by `--hold-progress` with no animation.
- FR-2 edge (AC-6 first-tap path): `installGestureUnlock` takes `shouldIgnore` and does not
  consume the once-only gesture; `tests/audio/gesture.test.ts` proves an ignored
  pointerdown/keydown leaves both listeners armed and the next outside pointerdown unlocks.
  The mute handler unlocks after toggling, so the first tap constructs the engine already
  muted and starts no music.

## Persisting-reload path (unit level, no browser)

`main.ts` awaits `loadAudioSettings()` before the engine exists and calls `configureAudio`
with `getMuted`/`getVolume` readers of one mutable object. Each control callback updates that
object first, then `audioEngine().setMuted/setVolume` (live application to an already-built
engine), then fire-and-forget `saveMuted`/`saveVolume`. On the next boot the same pair comes
back from IndexedDB; the round-trip test proves the saved values are exactly what the loader
returns, and the failure tests prove a blocked store degrades to `false` / `0.8` instead of
throwing. A real relaunch check stays with the AC-13 human review.

## Placement inspection (CSS, landscape and portrait)

- Shared insets: `right`/`bottom: max(12px|24px, env(safe-area-inset-*))`, so the stack clears
  notches and rounded corners in both orientations.
- Landscape: `#audio-controls` is a bottom-right column of two 72 px buttons with a 12 px gap
  (156 px tall). `#walk-button` stays horizontally centred at the same bottom inset and
  `#pov` stays bottom-left, so the stack adds no collision at >=768 px wide.
- Portrait: the existing `@media (orientation: portrait)` rule lifts `#pov` to
  `bottom + 88px` on the left; the sound stack remains bottom-right, so they never share a
  column. The panel is right-anchored at `bottom + 180px` (2 x 72 px + 12 px gap + 24 px
  inset), i.e. 24 px above the gear, and `width: min(320px, calc(100vw - 24px))` never
  overflows the viewport.
- Narrowest phone case (320 px wide): the panel is 296 px wide and its bottom edge sits at
  204 px, while the lifted `#pov` occupies roughly 112–200 px on the left, leaving the panel
  above it rather than on top of it. Tablets (>=768 px) have ample clearance.
- The panel is `hidden` until the gate completes, so it cannot cover the
  `#pov` / `#walk-button` targets while closed, and the 72 px close button sits inside it.

## Evidence paths

- Gate: `src/audio/gate.ts`, `tests/audio/gate.test.ts`
- Settings: `src/audio/settings.ts`, `tests/audio/settings.test.ts`
- Controls + panel: `src/viewer/audio-controls.ts`, `tests/viewer/audio-controls.test.ts`
- Markup, targets, ring, placement: `index.html` (`#audio-controls`, `#audio-panel`, 72 px
  rules, `conic-gradient` ring, `[hidden]` rule)
- Wiring: `src/viewer/main.ts` (`configureAudio`, providers, callbacks, `shouldIgnore`),
  `src/viewer/hud.ts` (`Hud.audio`), `src/viewer/audio.ts` (`configureAudio`)
- Gesture edge: `src/audio/gesture.ts`, `tests/audio/gesture.test.ts`
- Shell and facade assertions: `src/viewer/viewer.test.ts`

## Deviations

1. `src/viewer/audio.ts` — not in `Touches`, but the brief's implementation notes require
   `configureAudio(options: AudioEngineOptions)` on the facade. Smallest necessary change: one
   module-level options object and a constructor argument.
2. `src/viewer/viewer.test.ts` — the brief names `tests/viewer/viewer.test.ts`, but the viewer
   suite lives beside its source and no `tests/viewer/viewer.test.ts` exists (same as Phase 3).
   Its offline-shell test was extended for `audio-*` ids, the 72 px count, and the ring
   property, and its facade test was updated from `new AudioEngine()` to
   `new AudioEngine(engineOptions)`.
3. `tests/audio/gesture.test.ts` — updated for the `shouldIgnore` predicate because the brief's
   FR-2 edge changes the installer's event shape. Not listed in `Touches`, but the brief also
   explicitly asks to update this file.
4. `tests/audio/settings.test.ts` gained a save-then-load round-trip test after the first green
   run, to record the persisting-reload path; it is committed separately (`4da0d17`).
5. No other files outside `Touches` were touched.

## Known gaps

- The v8 table omits `src/audio/settings.ts`; the module is loaded only by its unit suite, so
  no percentage is quoted. Its behaviour is covered by ten cases (defaults, boolean and
  numeric sanitization, clamping, per-key rejection, total rejection, writes, write failure,
  round trip).
- `hud.ts` still reports low coverage (6.17%) because the suite never boots the viewer; the
  only new line is the `audio` pass-through, which `viewer.test.ts` cannot exercise without a
  DOM.
- The 2 s gate is verified with an injected clock and fake frames; the real `requestAnimationFrame`
  cadence is not measured. The ring is a static gradient, so a slow frame only updates the fill.

## Notes

- `HoldGate.start` ignores a repeated start while active and `tick` completes exactly once, so
  a second pointerdown cannot extend the hold and a held key cannot re-fire (repeat is also
  ignored at the keydown listener).
- The gate lives in `src/audio/` because Phase 4's `Touches` list places it there; it imports
  nothing from the viewer and has no DOM or timer dependency.
- Both mute buttons (stack and panel) share one `setMuted` path, so the label, `aria-pressed`,
  engine mute, and persistence can never diverge.
- `shouldIgnore` is wired only through `isAudioControlTarget`, which matches
  `#audio-controls, #audio-panel` and treats a throwing `closest` as "outside" so a synthetic
  element cannot break the unlock.
- Commit trail: `088f5f4` hold gate + tests, `f2974f4` settings + facade options,
  `f9c7a76` controls, markup, HUD/main wiring and gesture edge, `4da0d17` round-trip test,
  then this evidence file.
