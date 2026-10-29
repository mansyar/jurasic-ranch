# The Ranch Answers Back — Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

The ranch already has a full sound engine and a 15-asset pack, and the kalimba
loop starts on the first gesture (`src/audio/engine.ts:394`). What is missing is
reciprocity: the Walk toggle (`src/viewer/hud.ts:122`), the three POV pills
(`src/viewer/hud.ts:147`) and both mute buttons
(`src/viewer/audio-controls.ts:293,297`) call no audio at all. This track makes
every surface the child touches answer with a sound, turns the three static
species entries into tappable coo buttons, and greets the child once after the
music fades in. No new assets, no new dependencies, no engine change.

## Problem / Motivation

`conductor/product-guidelines.md` requires *every tap under 100 ms: hearts +
wiggle + sound*. Today a press produces no sound, so the child gets no
confirmation that anything heard them. Three `coo-*` assets
(`coo-trike`, `coo-stego`, `coo-brachio`) sit unused while the trio has no
voice. If unsolved, every later care track (feed, wash, cuddle) inherits a mute
UI and must invent its own feedback ad hoc.

Who feels it: the four-year-old, immediately, on their first press.

## Goals & Success Metrics

- **Goal:** every kid-facing control answers audibly.
  **Metric:** 5 wired surfaces dispatch an SFX within 100 ms, read from the
  dev-harness `audio.lastStartLatencyMs` field.
- **Goal:** the trio has a voice.
  **Metric:** all 3 `coo-*` assets become reachable from the UI, up from 0.
- **Goal:** a mash never becomes noise.
  **Metric:** 10 taps in 1 s yields ≤ 1 coo per species.

## Scope

### In Scope

- `tap` SFX on the Walk toggle, the three POV pills, and both mute buttons.
- The three species entries become buttons that play their own coo.
- `hello` once per session, after the 400 ms music fade-in.
- First-press queueing so the gesture that unlocks audio is not swallowed.
- Correcting the Brachio bone emoji in the species list.
- A pure feedback module plus thin adapters in `hud.ts` / `audio-controls.ts`.

### Out of Scope

- Wiring `heart`, `sparkle`, `nom`, `all-done` or `count-1..5`.
- 3D raycast picking of the dinos (Cuddle & Coo track).
- New audio assets, re-recording, or changes to the audio catalog.
- Sound on the gear hold-complete, the panel Close button, or the volume slider.
- Changes to music, mixing, duck rules, or the sleepy/hint systems.
- Any gameplay, any new UI surface.

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | The Walk toggle plays `tap` on every press, including a press that re-toggles. | must |
| FR-2 | Each of the three POV pills plays `tap` on every press, including re-pressing the active view. | must |
| FR-3 | Both mute buttons play `tap`; when muting it is dispatched before mute applies, when unmuting after. | must |
| FR-4 | The three species entries become buttons with a ≥72×72 px target and a non-empty accessible name; tapping plays that species' `coo-*`. | must |
| FR-5 | Coo gating: a species cannot retrigger its coo until its own duration elapses, and at most one coo plays at a time across the trio. | must |
| FR-6 | `hello` plays once per session after the first successful unlock, no earlier than the 400 ms music fade; suppressed when muted or when the unlocking gesture was a mute control. | must |
| FR-7 | The press that triggers unlock is queued and played once unlock resolves; it is dropped silently if unlock fails. | must |
| FR-8 | The gear hold-complete, the panel Close button and the volume slider stay silent. | must |
| FR-9 | Every feedback path no-ops silently when locked, muted, failed or disposed, and never throws. | must |
| FR-10 | The Brachio entry no longer uses the bone emoji. | should |
| FR-11 | Play/deny decisions live in a pure, DOM-free module; `hud.ts` and `audio-controls.ts` stay thin adapters. | must |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | No new audio assets, runtime dependencies or network calls; the 15-entry audio catalog is unchanged and precache grows ≤ 2 KiB for markup only. |
| NFR-2 | Dispatch-to-Howler latency ≤ 100 ms, measured through the existing dev-harness latency field; no new timers, intervals or rAF loops are added. |
| NFR-3 | The pure feedback module is ≥ 90 % line-covered and `hud.ts` rises above 50 %; the global 60 % floor holds. |
| NFR-4 | No audible change when muted or on the iOS silent switch, and sound is never disabled by reduced-motion — it is the only feedback for these presses. |
| NFR-5 | `pnpm verify` is green and `pnpm build` stays free of dev-harness markers. |

## Acceptance Criteria

| ID | Criterion | Verifies |
| --- | --- | --- |
| AC-1 | Pressing Walk, each POV pill and each mute button dispatches `tap` exactly once per press, asserted against a stubbed engine. | FR-1, FR-2, FR-3 |
| AC-2 | Muting dispatches its tap before `setMuted(true)`; unmuting dispatches after `setMuted(false)`, asserted on call order. | FR-3 |
| AC-3 | Tapping each species button dispatches `coo-trike` / `coo-stego` / `coo-brachio` respectively. | FR-4 |
| AC-4 | Ten taps on one species inside 1 s produce one coo, and two different species tapped together produce one coo. | FR-5 |
| AC-5 | `hello` fires exactly once per session, not before the fade, and never while muted or after a mute-first gesture. | FR-6 |
| AC-6 | A first press on Walk while locked plays one `tap` after unlock resolves, and none when unlock rejects. | FR-7 |
| AC-7 | Gear hold, Close and the volume slider produce no SFX. | FR-8 |
| AC-8 | With the engine forced to fail, all six surfaces stay silent and no error escapes. | FR-9 |
| AC-9 | The species buttons measure ≥ 72 px in a 1280×800 landscape screenshot, each has a non-empty accessible name, and Brachio's icon is not a bone. | FR-4, FR-10 |
| AC-10 | On the real tablet, a parent hears every wired surface and reports it as instant (`tablet-touch-play` manual exception). | NFR-2 |
| AC-11 | The coverage report shows the new module ≥ 90 % and `hud.ts` > 50 %, and `pnpm verify` is green. | NFR-1, NFR-3, NFR-5 |

## Edge Cases

- **Mash:** the gate absorbs repeats. No queue grows unbounded and nothing is
  retained per tap beyond the single first-press slot.
- **Locked / failed engine:** the first-press slot holds exactly one id, then is
  discarded. No retry loop.
- **Muted:** taps are still dispatched; the engine no-ops by design and no UI
  state changes.
- **Hidden tab:** SFX may still dispatch; the existing music pause behaviour is
  untouched.
- **Reduced motion:** sound is unaffected. It is the only feedback for these
  presses, so it must never be gated on the motion preference.
- **iOS silent switch:** WebAudio may still play. Recorded as an unknown in
  Phase 4, not asserted.
- **Mute-first gesture:** the unlocking gesture was a mute control, so `hello`
  is suppressed even after a later unmute in the same session.

## Dependencies

- **Tracks:** none. The scale track
  (`20261029-authored-dino-walk-clips`, merged as PR #11 at `94178c4`) is this
  track's base, and `git diff --stat 12801ec 94178c4` shows it did not touch
  `hud.ts`, `audio-controls.ts`, `main.ts`, `index.html` or `src/audio/`.
- **External:** none.

## Open Questions & Assumptions

- **Assumption:** a page reload starts a new session, so `hello` may greet
  again after a reload.
- **Assumption:** the species list keeps its top-left overlay position and gains
  no layout change beyond button semantics.
- **Assumption:** coo gating uses the catalog's `durationSeconds`
  (1.0 / 1.2 / 1.4 s), so it stays correct if a file is later re-cut.
- **Open:** whether the iOS silent switch suppresses WebAudio on the target
  tablet. Recorded by observation in Phase 4, not treated as a failure.

## References

- `conductor/product-guidelines.md` — every tap under 100 ms; sound is never the
  only signal; kalimba sits under voice.
- `conductor/product.md` — Core Use Cases and Roadmap (T5 cuddle, T6 sticker
  book own the remaining assets).
- `conductor/tech-stack.md` — audio catalog as the single source of truth.
- `src/audio/catalog.ts`, `src/audio/engine.ts`, `src/audio/gesture.ts`,
  `src/audio/mix.ts`.
- `src/viewer/hud.ts`, `src/viewer/audio-controls.ts`, `src/viewer/main.ts`.
- `index.html:284-288` — the species list that becomes buttons.
- `conductor/tracks/20261029-cozy-sound-voice/` — where the pack was shipped and
  the unused-surface debt was recorded.
