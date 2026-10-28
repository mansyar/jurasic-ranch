# Baby Trike Turn Fix — Implementation Plan

> **Branch:** `feat/20261029-baby-trike-turn-fix`
> **Base:** `main` @ `d6718219b40e704c941b9497b358f8613a84094b`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, or `blocked`.
> Only the primary agent writes this file. Phase subagents report results and the
> primary records them.

## Phase 1: Baked pastel baby variant

- **Goal:** Committed pastel baby GLB (rayed shield, short horns, size 0.6) loads with zero runtime recolor.
- **Depends on:** none
- **Covers:** FR-1, FR-2, FR-3, FR-7, NFR-4, AC-1, AC-2, AC-3, AC-7
- **Touches:** `scripts/bake-trike-variant.*`, `public/models/trike.glb`, `src/viewer/main.ts`, `src/ranch/pastel.ts` (delete), `tests/waddle/pastel.test.ts` (replace), `src/viewer/viewer.test.ts`
- **Verification:** `pnpm verify`
- **Status:** verified
- **Result:** Baked pastel baby GLB committed (85252 bytes, Draco, 1 material, Waddle 0.800 s / 72 tracks); runtime remap deleted; variant asserts green; primary `pnpm verify` exit 0 (56/56 tests).
- **Checkpoint:** `99762ce`
- **Evidence:** `conductor/tracks/20261029-baby-trike-turn-fix/verification/phase-1.md`

- [x] **P1.T1: Bake script via Polyfork module** — covers: FR-1
  - [x] **P1.T1.1: createAsset params pinned (rayed, horns 0.7, noseHorn 0.6, size 0.6, pastel hexes)**
  - [x] **P1.T1.2: Draco-compress output to public/models/trike.glb**
- [x] **P1.T2: Remove runtime remap, keep blush pin** — covers: FR-2, FR-7
- [x] **P1.T3: Variant asserts (colors, single material, baby proportions)** — covers: AC-1, AC-2, AC-3, AC-7

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/20261029-baby-trike-turn-fix/verification/phase-1.md
-->

## Phase 2: Gait retime on baby legs

- **Goal:** Waddle matches the size-0.6 skeleton with clean foot plants (distance-phased via the gait block).
- **Depends on:** Phase 1
- **Covers:** FR-6, AC-6
- **Touches:** `src/ranch/waddle.ts`, `src/ranch/trike-player.ts`, `tests/waddle/*`
- **Verification:** `pnpm verify`
- **Status:** verified
- **Result:** Stride 0.29 m / speed 0.3625 m/s sampled from the shipped clip;
  all four feet within slide tolerance; `pnpm verify` exit 0 on primary
  re-run (59/59 tests).
- **Checkpoint:** `aeb1961`
- **Evidence:** `conductor/tracks/20261029-baby-trike-turn-fix/verification/phase-2.md`

- [x] **P2.T1: Derive stride from new gait block (step/duty/clearance)** — covers: FR-6
- [x] **P2.T2: Foot-slide tolerance test across the cycle** — covers: AC-6

## Phase 3: Curvy turns + stop deadband

- **Goal:** Slow stroller arcs in motion, heading frozen below stop threshold — no jitter, stays in frame.
- **Depends on:** Phase 2
- **Covers:** FR-4, FR-5, NFR-3, AC-4, AC-5
- **Touches:** `src/ranch/trike-player.ts`, `tests/waddle/trike-player.test.ts`
- **Verification:** `pnpm verify`
- **Status:** verified
- **Result:** Arc-limited stroller turns (90° ≈ 1.04 s, 180° ≈ 1.93 s,
  radius ≈ 0.22 m, translation never pauses); stop deadband 0.03 freezes
  heading with bit-identical halt; `pnpm verify` exit 0 on primary re-run
  (62/62 tests).
- **Checkpoint:** `1778813`
- **Evidence:** `conductor/tracks/20261029-baby-trike-turn-fix/verification/phase-3.md`

- [x] **P3.T1: Arc-limited steering (max turn rate, no in-place spin)** — covers: FR-4, AC-4
- [x] **P3.T2: Stop deadband + settle-then-halt regression test** — covers: FR-5, AC-5
