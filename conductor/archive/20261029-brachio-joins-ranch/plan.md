# Brachio Joins the Ranch — Implementation Plan

> **Branch:** `feat/20261029-brachio-joins-ranch`
> **Base:** `main` @ `502be829090e6f7e40579d99c29462c21c6f426a`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, or `blocked`.
> Only the primary agent writes this file. Phase subagents report results and the
> primary records them.

## Phase 1: Brachio gait + trio avoidance unit

- **Goal:** Brachio shuffles slower via BRACHIO_GAIT with pairwise trio avoidance, Trike/Stego unchanged
- **Depends on:** none
- **Covers:** FR-1, FR-2, FR-5, FR-6, FR-10, AC-1, AC-3, AC-7
- **Touches:** `src/ranch/waddle.ts`, `src/ranch/dino-player.ts`, `src/ranch/avoidance.ts`, `tests/**/brachio-*.ts`, `tests/**/trio-*.ts`, `tests/**/avoidance-*.ts`, `tests/**/dino-*.ts`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P1.T1: Define BRACHIO_GAIT + Brachio config** — covers: FR-1
  - [x] **P1.T1.1: Gait params stride 0.24 loop 1.0 turnRate 1.8 curvature 3.0 wander 0.8** — speed ~0.24 m/s shuffle, 90° <1.0 s
  - [x] **P1.T1.2: Export BRACHIO_GAIT with TRIKE/STEGO, waddle math unchanged** — loopPhase/squash/dust reuse
- [x] **P1.T2: Trio wander + pairwise avoidance** — covers: FR-5, FR-6, FR-2, FR-10
  - [x] **P1.T2.1: Triangle spawn 120° offsets + pairwise soft-steer <0.4 m** — never stop, no bounce, extends dual logic
  - [x] **P1.T2.2: 30 s trio wander test in-frame + min sep >0.25 m + Trike/Stego regression** — no pop, no duplication

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** 4793dc5
**Evidence:** conductor/tracks/20261029-brachio-joins-ranch/verification/phase-1.md
-->

## Phase 2: Brachio vendor + pastel bake

- **Goal:** Brachio GLB baked lavender 1.2 m cap loops seamlessly, passes size/material gates
- **Depends on:** Phase 1
- **Covers:** FR-3, FR-4, AC-2
- **Touches:** `assets/brachio/**`, `public/models/brachio.glb`, `scripts/vendor/bake-brachio-*`, `scripts/**/check-brachio*`, `tests/**/brachio-*.ts`, `CREDITS.md`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P2.T1: Vendor + bake Brachio** — covers: FR-3
  - [x] **P2.T1.1: Lookup Polyfork brachiosaurus-base, record final lavender distinct from Trike/Stego** — colorblind-safe, honest report_need if missing
  - [x] **P2.T1.2: Copy bake-stego pipeline to bake-brachio** — 1.2 m cap seated-shuffle, one-material flat-shaded Draco, feet y=0, blush
- [x] **P2.T2: Clip + pastel gates** — covers: FR-4
  - [x] **P2.T2.1: Prefer Waddle else first anim, 1.0 s seamless linear check** — same /draco/ decoder, no pop/skate
  - [x] **P2.T2.2: Pastel + neck + size + CREDITS** — distinct zones, neck in-frame, each GLB small, total tracked toward <22 MB

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** 0af5b63
**Evidence:** conductor/tracks/20261029-brachio-joins-ranch/verification/phase-2.md
-->

## Phase 3: Trio ranch + Walk three + fallback

- **Goal:** Trike + Stego + Brachio wander with one Walk toggles all, <22 MB with screenshots
- **Depends on:** Phase 2
- **Covers:** FR-5, FR-6, FR-7, FR-8, FR-9, AC-3, AC-4, AC-5, AC-6, AC-8
- **Touches:** `src/viewer/main.ts`, `src/viewer/*.ts`, `src/ranch/*.ts`, `index.html`, `vite.config.ts`, `tests/**/trio-*.ts`, `tests/**/viewer-*.ts`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **P3.T1: Trio wander + pairwise avoidance integration** — covers: FR-5, FR-6
  - [x] **P3.T1.1: Load three DinoPlayers triangle spawn, pairwise steer each frame** — stay in-frame 30 s, min sep >0.25 m
  - [x] **P3.T1.2: Shared DustPool + Blink per-player, 60 fps tablet target** — pixelRatio 2, shadows low
- [x] **P3.T2: Viewer chrome + fallback + evidence** — covers: FR-7, FR-8, FR-9
  - [x] **P3.T2.1: Single Walk toggles three + status + 3 pills + persist + aria-pressed** — placeholder long-neck fallback warns, others continue
  - [x] **P3.T2.2: Precache brachio.glb, report total <22 MB + tablet screenshot + preview_scene** — visual + smoke evidence

<!--
**Result:** verified
**Checkpoint:** b2ecad6
**Evidence:** conductor/tracks/20261029-brachio-joins-ranch/verification/phase-3.md
-->

## Phase R1: Review Fixes

- **Goal:** Resolve review findings F2, F3 (stale test comments).
- **Depends on:** Phase 3
- **Covers:** F2, F3
- **Touches:** `tests/waddle/brachio-stride.test.ts`, `tests/waddle/brachio-pastel.test.ts`
- **Verification:** `pnpm verify`
- **Status:** verified

- [x] **R1.T1: Resolve F2** — covers: F2 (rename SHIPPED_GLB → DONOR_TRIKE_GLB + donor comment)
- [x] **R1.T2: Resolve F3** — covers: F3 (header 0.5 → 0.27 post-scale)

<!--
**Result:** verified
**Checkpoint:** 15f9674
**Evidence:** conductor/tracks/20261029-brachio-joins-ranch/verification/phase-R1.md
-->
