# Stego Joins via Generic DinoPlayer — Implementation Plan

> **Branch:** `feat/20261029-stego-generic-player`
> **Base:** `main` @ `784d133a2144b62a159dc908e28cff77cb52efe3`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, or `blocked`.
> Only the primary agent writes this file. Phase subagents report results and the
> primary records them.

## Phase 1: Generic DinoPlayer extraction

- **Goal:** Trike waddles identically via generic DinoPlayer with no duplication
- **Depends on:** none
- **Covers:** FR-1, FR-2, FR-10, AC-1, AC-7
- **Touches:** `src/ranch/dino-player.ts`, `src/ranch/trike-player.ts`, `src/ranch/waddle.ts`, `tests/**/dino-*.ts`, `tests/**/trike-*.ts`, `tests/**/waddle-*.ts`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P1.T1: Extract GaitParams + DinoPlayer** — covers: FR-1
  - [x] **P1.T1.1: Define GaitParams + Trike config** — stride 0.29, loop 0.8, turnRate PI, curvature 4.5, wander 0.8
  - [x] **P1.T1.2: Move mixer/blink/dust wiring into DinoPlayer** — identical behaviour, weight/blend/squash preserved
- [x] **P1.T2: Preserve Trike + remove duplication** — covers: FR-2, FR-10
  - [x] **P1.T2.1: Delete TrikePlayer or thin alias, update imports in viewer** — only DinoPlayer imported
  - [x] **P1.T2.2: Migrate trike-player tests to dino-player tests** — turn-then-walk, deadband freeze, stride, alloc ≤2 Vector3, blink

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** 920784d
**Evidence:** conductor/tracks/20261029-stego-generic-player/verification/phase-1.md
-->

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/20261029-stego-generic-player/verification/phase-1.md
-->

## Phase 2: Stego vendor + pastel bake

- **Goal:** Stego GLB baked pastel distinct from Trike, loops seamlessly, passes size/material gates
- **Depends on:** Phase 1
- **Covers:** FR-3, FR-4, AC-2
- **Touches:** `assets/stego/**`, `public/models/stego.glb`, `scripts/vendor/bake-stego-*`, `scripts/**/check-stego*`, `tests/**/stego-*.ts`, `tests/**/pastel-*.ts`, `CREDITS.md`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P2.T1: Vendor + bake Stego** — covers: FR-3
  - [x] **P2.T1.1: Lookup Polyfork Stego base, record final pastel distinct from Trike** — resolve TBD palette, colorblind-safe
  - [x] **P2.T1.2: Copy bake-trike pipeline to bake-stego** — baby 0.25–0.35x, one-material flat-shaded Draco, feet y=0, blush
- [x] **P2.T2: Clip + pastel gates** — covers: FR-4
  - [x] **P2.T2.1: Prefer Waddle else first anim, 0.8 s seamless 24f linear check** — same /draco/ decoder
  - [x] **P2.T2.2: Pastel + plates + size + CREDITS** — distinct zones, >50 verts, each GLB small, total tracked toward <18 MB

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** a06cdef
**Evidence:** conductor/tracks/20261029-stego-generic-player/verification/phase-2.md
-->

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/20261029-stego-generic-player/verification/phase-2.md
-->

## Phase 3: Dual ranch + avoidance + Walk both

- **Goal:** Trike + Stego wander independently with soft-steer, one Walk toggles both, <18 MB with screenshots
- **Depends on:** Phase 2
- **Covers:** FR-5, FR-6, FR-7, FR-8, FR-9, AC-3, AC-4, AC-5, AC-6, AC-8
- **Touches:** `src/viewer/main.ts`, `src/viewer/*.ts`, `src/ranch/avoidance.ts`, `index.html`, `vite.config.ts`, `tests/**/dual-*.ts`, `tests/**/avoidance-*.ts`
- **Verification:** `pnpm verify`
- **Status:** pending

- [ ] **P3.T1: Dual wander + soft-steer avoidance** — covers: FR-5, FR-6
  - [ ] **P3.T1.1: Spawn offset ±0.4 m, independent poses, soft steer <0.4 m bias away** — never stop, no bounce
  - [ ] **P3.T1.2: 30 s wander test** — inside RADIUS + CYCLE, min separation >0.25 m
- [ ] **P3.T2: Viewer integration + shared FX + fallback** — covers: FR-7, FR-8, FR-9
  - [ ] **P3.T2.1: Load two DinoPlayers, shared DustPool, single Walk toggles both** — status + persist + aria-pressed
  - [ ] **P3.T2.2: Placeholder Stego fallback on missing GLB** — warn, Trike continues
  - [ ] **P3.T2.3: Precache stego.glb, report total <18 MB + tablet screenshot + preview_scene** — visual + smoke evidence

<!--
Review fixes are appended by `conductor-review` as:

## Phase R1: Review Fixes

- **Goal:** Resolve review findings ...
- **Depends on:** Phase 3
- **Covers:** review findings
- **Touches:** ...
- **Verification:** ...
- **Status:** pending

- [ ] **R1.T1: Resolve <finding ID>** — covers: <finding ID>
-->
