# Dev Harness for Debugging & Verification - Implementation Plan

> **Branch:** `chore/20261029-dev-harness`
> **Base:** `main` @ `cb12399`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, or `blocked`.
> Only the primary agent writes this file. Phase subagents report results and the
> primary records them.

## Phase 1: Pure dev logic (options, seeded RNG, snapshot)

- **Goal:** the harness's decision-making is a set of DOM-free, renderer-free
  modules with unit tests: URL option parsing, a deterministic RNG, and the
  snapshot/pairwise-distance builder.
- **Depends on:** none
- **Covers:** FR-1, FR-7, FR-8, AC-1, AC-8, AC-9, NFR-4
- **Touches:** `src/dev/**`, `tests/dev/**`
- **Verification:** `pnpm verify`
- **Status:** pending

- [ ] **P1.T1: Dev option parsing and seeded RNG** - covers: FR-1, FR-8
  - [ ] **P1.T1.1: `parseDevQuery`** returns `{ enabled, seed, solo, paused, overlays }`; `dev` must equal `1` for `enabled`, and `seed` parses only finite integers (0 and negatives valid, junk ignored).
  - [ ] **P1.T1.2: `seededRandom`** is a deterministic PRNG (mulberry32 or equivalent) whose first N outputs are stable for a given seed and differ across seeds.
  - [ ] **P1.T1.3: tests** cover `?dev=1`, `?dev=0`, no query, `seed=0`, `seed=-7`, `seed=abc`, `seed=` and seed-without-dev.
- [ ] **P1.T2: Snapshot builder** - covers: FR-7
  - [ ] **P1.T2.1: `buildSnapshot(input)`** projects dino handles plus walking/paused/pov/sleepy/fps into the documented JSON shape, computing all pairwise distances and `minSeparation`.
  - [ ] **P1.T2.2: tests** assert pairwise distances equal `hypot` of reported positions, `minSeparation` equals the smallest pair, and a single visible dino yields an empty `pairs` list with `minSeparation: null`.

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/<track-id>/verification/phase-1.md
-->

## Phase 2: Harness module and viewer wiring

- **Goal:** `?dev=1` renders the panel, its controls and overlays actually drive
  and inspect the live ranch, and `window.__ranch` answers.
- **Depends on:** Phase 1
- **Covers:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-10, AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, NFR-1, NFR-2, NFR-3
- **Touches:** `src/dev/**`, `src/viewer/main.ts`, `src/ranch/dino-player.ts`, `tests/**`
- **Verification:** `pnpm verify`
- **Status:** pending

- [ ] **P2.T1: Forceable blink** - covers: FR-5
  - [ ] **P2.T1.1: `BlinkController.forceBlink()` / `DinoPlayer.forceBlink()`** start a blink on the next update without disturbing the 3-5 s schedule that follows.
  - [ ] **P2.T1.2: test** proves a forced blink returns `true` on the next update and the normal schedule still resets.
- [ ] **P2.T2: Harness module** - covers: FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8
  - [ ] **P2.T2.1: Panel DOM** built at runtime (collapsible, keyboard-reachable, clear of the Walk button and POV pills) with visibility/solo buttons, pause/step, HUD, forced-state buttons, POV buttons and overlay toggles.
  - [ ] **P2.T2.2: Overlay group** draws the shared wander radius, a per-dino avoidance trigger ring and a per-dino heading arrow, refreshed from live positions and toggled as one unit.
  - [ ] **P2.T2.3: `installDevHarness(bridge)`** returns a frame hook that honours pause/step and publishes `window.__ranch` (`snapshot`, visibility, solo, walking, pause, step, POV, forced states); re-installation replaces rather than duplicates.
- [ ] **P2.T3: Viewer integration** - covers: FR-1, FR-10
  - [ ] **P2.T3.1: dev-only dynamic import** guarded by `import.meta.env.DEV`, with the bridge passed after the scene, trio and dust pool exist.
  - [ ] **P2.T3.2: animation loop** consults the frame hook (paused frames still render; `dt` unchanged when harness is absent) and the seeded RNG feeds `DustPool` and the dino players only when `?dev=1&seed=` is present.
  - [ ] **P2.T3.3: no-`?dev=1` path** verified unchanged: no extra DOM node, no extra network request, same render output.

<!--
Review fixes are appended by `conductor-review` as:

## Phase R1: Review Fixes
...
-->

## Phase 3: Production isolation guard and docs

- **Goal:** `pnpm verify` proves the harness never reaches the production
  bundle, and the project docs record the new dev workflow.
- **Depends on:** Phase 2
- **Covers:** FR-9, NFR-4, AC-10, AC-11
- **Touches:** `scripts/**`, `package.json`, `tests/**`, `conductor/tech-stack.md`
- **Verification:** `pnpm verify`
- **Status:** pending

- [ ] **P3.T1: dist guard** - covers: FR-9
  - [ ] **P3.T1.1: `scripts/check-dist-clean.mjs`** scans `dist/` for the harness markers (`__ranch`, `data-dev-panel`, `installDevHarness`) and exits non-zero with the offending file when one is found.
  - [ ] **P3.T1.2: verify wiring** appends the check after `pnpm build` in the `verify` script without changing lint/format/typecheck/test/build semantics.
  - [ ] **P3.T1.3: test** proves the guard passes on the real build and fails when a marker is planted in a temporary `dist` fixture.
- [ ] **P3.T2: Developer docs** - covers: FR-1, FR-9
  - [ ] **P3.T2.1: `conductor/tech-stack.md`** gains a dated dev-harness note: how to open `?dev=1`, the `seed` parameter, the `window.__ranch` surface, and the dist guarantee.

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/<track-id>/verification/phase-3.md
-->
