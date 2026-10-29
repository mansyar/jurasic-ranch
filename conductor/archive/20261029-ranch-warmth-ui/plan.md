# Ranch Warmth UI - Implementation Plan

> **Branch:** `feat/20261029-ranch-warmth-ui`
> **Base:** `main` @ `502be829090e6f7e40579d99c29462c21c6f426a`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, or `blocked`.
> Only the primary agent writes this file. Phase subagents report results and the
> primary records them.

## Phase 1: POV + Touch Hardening

- **Goal:** 3 fixed POV buttons switch cam instantly, 72px targets, 5s hint glow, landscape/pinch lock
- **Depends on:** none
- **Covers:** FR-1, FR-2, FR-5, FR-6, NFR-1, NFR-3, NFR-5, AC-1, AC-2, AC-5, AC-6
- **Touches:** `src/viewer/main.ts`, `src/viewer/pov.ts`, `index.html`, `src/styles/*`, `tests/viewer/*`
- **Verification:** `pnpm verify`
- **Status:** verified
- **Result:** verified
- **Checkpoint:** 2596cda
- **Evidence:** conductor/tracks/20261029-ranch-warmth-ui/verification/phase-1.md

- [x] **P1.T1: Fixed POV presets + buttons** - covers: FR-1
  - [x] **P1.T1.1: Preset constants + camera jump** - covers: FR-1
  - [x] **P1.T1.2: Ranch/Nest/Garden buttons 72px + icons** - covers: FR-1
- [x] **P1.T2: Hint glow after 5s idle** - covers: FR-5
- [x] **P1.T3: Viewport lock + portrait hint** - covers: FR-6
- [x] **P1.T4: Viewer POV + hint tests** - covers: AC-1

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/20261029-ranch-warmth-ui/verification/phase-1.md
-->

## Phase 2: Valley + Farm Dressing

- **Goal:** Valley ground + Farm props precached offline, AAA-cozy look, size/fps reported
- **Depends on:** Phase 1
- **Covers:** FR-3, NFR-1, NFR-2, NFR-4, AC-3
- **Touches:** `src/ranch/dressing.ts`, `public/models/dressing/*`, `src/viewer/main.ts`, `vite.config.ts`, `tests/ranch/dressing*`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P2.T1: Kit shortlist 12 parts (primary-vendored, 1.1MB)** - covers: FR-3
  - [x] **P2.T1.1: get_kit Valley + Farm rows + tris audit (~8k tris)** - covers: FR-3
- [x] **P2.T2: Valley ground + trees/rocks** - covers: FR-3
- [x] **P2.T3: Farm fences/trough/nest-garden markers** - covers: FR-3
- [x] **P2.T4: Precache + size/fps report** - covers: FR-3
- [x] **P2.T5: Dressing fallback tests** - covers: AC-3

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** 2e5976a
**Evidence:** conductor/tracks/20261029-ranch-warmth-ui/verification/phase-2.md
-->

## Phase 3: Sleepy Cues + Cozy Guards

- **Goal:** Droopy + yawn + ZZZ after 90s idle, interruptible, reduced-motion + portrait guards
- **Depends on:** Phase 2
- **Covers:** FR-4, FR-7, FR-8, NFR-1, NFR-3, NFR-5, AC-4, AC-7
- **Touches:** `src/ranch/dino-player.ts`, `src/ranch/sleepy.ts`, `src/viewer/sleepy-ui.ts`, `tests/ranch/sleepy*`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P3.T1: Idle sleepy state machine (90s)** - covers: FR-4
- [x] **P3.T2: ZZZ particles + yawn/droopy** - covers: FR-4
- [x] **P3.T3: Reduced-motion + interrupt guards** - covers: FR-8
- [x] **P3.T4: Sleepy + interrupt tests** - covers: AC-4

## Phase R1: Review Fixes

- **Goal:** Resolve review findings F1, F2 (hint/sleepy precedence + matchMedia hoist)
- **Depends on:** Phase 3
- **Covers:** F1, F2
- **Touches:** `src/viewer/main.ts`, `tests/ranch/sleepy-ui.test.ts`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **R1.T1: Guard hint interval with sleepy state** - covers: F1
- [x] **R1.T2: Hoist matchMedia query off hot paths** - covers: F2

<!--
Review fixes are appended by `conductor-review` as:

## Phase R1: Review Fixes

- **Goal:** Resolve review findings ...
- **Depends on:** Phase 3
- **Covers:** review findings
- **Touches:** ...
- **Verification:** ...
- **Status:** pending

- [ ] **R1.T1: Resolve <finding ID>** - covers: <finding ID>
-->
