# Dev Harness for Debugging & Verification - Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

Add a development-only harness to the viewer: a `?dev=1` panel that can show or
hide each baby dino, pause and step the simulation, force the states that
normally take seconds of idling (blink, dust, sleepy, hint), draw diagnostic
overlays (wander radius, avoidance trigger ring, headings), and expose a
machine-readable `window.__ranch` snapshot plus controls. The harness is
dynamically imported behind `import.meta.env.DEV` and must not exist in the
production bundle, so the kid-facing app, offline precache and bundle size are
unchanged.

## Problem / Motivation

Verification today is mostly visual: the agent takes a screenshot, reads pixels,
and guesses whether the trio is far enough apart, whether a turn finished in
budget, or whether sleepy cues fired. Distances, headings, blink timers and the
sleepy stage are all computed in the runtime but invisible from outside.

- **Who feels it:** the agent verifying each Phase (evidence-over-assertion
  suffers), and the solo developer when one dino hides a bug behind another.
- **If unsolved:** every future track (feed, wash, surprises) needs the same
  manual eyeballing, flaky screenshots and slow 90-second waits, and regressions
  in pairwise separation or turn time can pass review unnoticed.

## Goals & Success Metrics

- **Goal:** an agent can deterministically drive and read the ranch without
  visual guesswork, and a human can isolate any one dino in two taps.
- **Metric:** any state assertion (pairwise distance, heading, sleepy stage,
  blink, walking, fps) is available as JSON from one `browser.evaluate` call;
  forcing sleepy or a blink takes one click instead of 90 s / 3-5 s.
- **Metric:** `dist/` contains zero harness markers after `pnpm build`
  (automated check in `pnpm verify`).
- **Metric:** with no `?dev=1`, the viewer behaves exactly as before — the
  existing 234 tests stay green and no new network request appears.

## Scope

### In Scope

- `?dev=1` opt-in activation on the dev server; harness UI built entirely at
  runtime (no `index.html` changes).
- Per-dino visibility toggles plus one-tap solo presets (All / Trike / Stego /
  Brachio).
- Pause, resume and single/frame-batch stepping of the animation loop.
- HUD with live fps, frame time, draw calls and triangle count.
- Forced states: blink, dust puff, sleepy stage, hint glow, POV preset switch.
- Diagnostic overlays: wander radius circle, avoidance trigger ring per dino,
  heading arrows; individually toggleable.
- `window.__ranch` with `snapshot()` and the same controls the panel offers.
- `?dev=1&seed=<n>` seeded RNG so wander jitter and dust are reproducible.
- Automated assertion that no harness code reaches `dist/`.

### Out of Scope

- Any production/debug flag: the harness is unreachable outside a dev build.
- Teleport/park, time-scale or slow-motion, GLB hot-swap, animation clip
  scrubbing.
- Network throttling, offline simulation, audio mixer inspection, heap or
  renderer profiling tools.
- Changing gameplay constants, gaits, palettes or the kid-facing UI.
- Persisting harness settings across reloads (URL params are the only state).

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | In a dev build, the harness activates only when the URL query contains `dev=1`; without it the panel, overlays and `window.__ranch` are absent. | must |
| FR-2 | The panel toggles visibility of each dino independently and offers solo presets that leave exactly one (or all three) visible, without pausing or resetting the hidden dinos. | must |
| FR-3 | The panel pauses and resumes the simulation and advances exactly N frames while paused, leaving state unchanged when N is not requested. | must |
| FR-4 | The HUD reports live fps, frame time, renderer draw calls and triangle count for the last rendered frame. | must |
| FR-5 | The panel forces a blink on all rigged dinos, spawns one dust puff, jumps the ranch to the sleepy stage, re-arms the hint glow, and cuts to any POV preset, each without touching the Walk toggle or persisted settings. | must |
| FR-6 | The panel draws toggleable diagnostic overlays: the shared wander radius, a per-dino avoidance trigger ring and a per-dino heading arrow, updated from live positions. | should |
| FR-7 | `window.__ranch.snapshot()` returns machine-readable JSON with walking, paused, POV, sleepy stage, fps, per-dino id/visibility/rigged/position/heading/walking, and every pairwise distance plus the minimum separation. `window.__ranch` also exposes controls for visibility, solo, walking, pause, step, POV and forced states. | must |
| FR-8 | `?dev=1&seed=<integer>` makes wander jitter and dust deterministic so the same URL reproduces the same poses; without `seed` the harness behaves randomly. | should |
| FR-9 | A build-time check fails `pnpm verify` when harness markers appear anywhere in `dist/`. | must |
| FR-10 | With no `?dev=1`, the viewer makes no additional network request, adds no DOM node, and renders the same scene as today. | must |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | With the harness inactive the per-frame cost is a single null check; with it active the panel and overlays stay under 2 ms/frame on the target tablet and never drop the 60 fps budget on their own. |
| NFR-2 | The panel must not overlap the 72 px Walk button or POV pills, must stay keyboard-reachable, and must be collapsible so the stage stays visible during play-testing. |
| NFR-3 | The harness adds no network traffic and works offline like the rest of the app. |
| NFR-4 | `pnpm verify` (lint, format check, typecheck, tests, build, dist check) passes with at least 60 % coverage on the new pure modules. |

## Acceptance Criteria

| ID | Criterion | Verifies |
| --- | --- | --- |
| AC-1 | Loading the dev server without `?dev=1` leaves `window.__ranch` undefined and the document without any `[data-dev-panel]` node. | FR-1, FR-10 |
| AC-2 | Loading `?dev=1` shows the panel; hiding Stego removes it from the scene while Trike and Brachio keep walking. | FR-1, FR-2 |
| AC-3 | The solo presets leave exactly one dino visible, and switching back to All restores three without changing their world positions. | FR-2 |
| AC-4 | Pause freezes positions across 1 s of wall time; `step(10)` advances the pose by the equivalent of ten frames. | FR-3 |
| AC-5 | The HUD shows a numeric fps, draw calls and triangles that change while the scene animates. | FR-4 |
| AC-6 | Each forced action produces its state change immediately: blink within one frame, a visible dust puff, `sleepy` stage with the ZZZ overlay, hint glow without the 5 s wait, and the requested POV. | FR-5 |
| AC-7 | Overlays toggle on and off and follow live positions when a dino wanders. | FR-6 |
| AC-8 | `snapshot()` returns all documented fields, pairwise distances match a manual `hypot` of the reported positions, and `minSeparation` equals the smallest pair. | FR-7 |
| AC-9 | Two loads of `?dev=1&seed=42` report identical positions after the same number of stepped frames. | FR-8 |
| AC-10 | After `pnpm build`, a search of `dist/` for the harness markers finds nothing, and the check script exits non-zero when a marker is planted. | FR-9 |
| AC-11 | The existing 234 tests stay green and the production precache size is unchanged by this track. | FR-10, NFR-4 |

## Edge Cases

- **Placeholder window:** before a rigged GLB swaps in, the dino has no
  `DinoPlayer`; visibility toggles must still apply to the placeholder and
  snapshot must report `rigged: false` instead of throwing.
- **Failed GLB load:** a dino that stayed on its placeholder keeps working in
  the panel (forced blink/dust become no-ops, not errors).
- **Paused before load:** stepping or forcing states while paused still applies
  the forced state on the next step.
- **Device without `matchMedia` or `performance.now`:** panel must degrade to a
  static hint rather than break boot (harness only; the app path is unchanged).
- **Seed edge values:** `seed=0`, negative, huge and non-numeric values must not
  crash; invalid seeds fall back to unseeded randomness.
- **Narrow/portrait viewport:** the panel must not cover the rotate hint or the
  Walk button; it collapses to a single toggle.
- **Seed-only activation:** `?seed=` without `dev=1` must not enable the harness.
- **Double activation:** loading `?dev=1` twice (hot reload) must not create a
  second panel or duplicate listeners.

## Dependencies

- **Tracks:** none — the base already contains the merged trio (Trike, Stego,
  Brachio) plus POV, sleepy cues and ranch dressing that the harness drives.
- **External:** none. No new packages: the panel is plain DOM, overlays reuse
  `three` line primitives already bundled.

## Open Questions & Assumptions

- **Assumption:** the harness may add a dev-only module tree under `src/dev/`
  that production code never imports statically; this is the cheapest way to
  keep `dist/` clean without a separate build target.
- **Assumption:** "step" advances the simulation with a fixed 1/60 s delta per
  frame so stepped captures are independent of wall-clock jitter.
- **Assumption:** overlays are developer diagnostics, so they may use plain
  unlit lines and ignore the kid-facing palette rules.
- **Question:** should a later track add a screenshot/PNG export helper to the
  harness for PR media? Deferred, not required here.

## References

- `conductor/product.md` (constraints: offline, 72 px targets, <15 MB, 60 fps)
- `conductor/tech-stack.md` (Vite, three, `pnpm verify`)
- `conductor/workflow.md` (verification layers, evidence-over-assertion)
- `conductor/product-guidelines.md` (kid-facing UI rules the harness must not break)
- `src/viewer/main.ts` (boot sequence the harness hooks into)
