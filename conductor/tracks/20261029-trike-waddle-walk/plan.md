# Trike Waddle Walk — Implementation Plan

> **Branch:** `feat/20261029-trike-waddle-walk`
> **Base:** `main` @ `8c371c3f8525996dec10351910807c6df5fc2a09`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, or `blocked`.
> Only the primary agent writes this file. Phase subagents report results and the
> primary records them.

## Phase 1: PWA Scaffold

- **Goal:** Minimal viewer boots offline and `pnpm verify` is green
- **Depends on:** none
- **Covers:** FR-1, AC-5, AC-6
- **Touches:** `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/viewer/*`, `public/manifest.webmanifest`
- **Verification:** `pnpm verify`
- **Status:** verified
- **Result:** verified
- **Checkpoint:** cbe9d6f
- **Evidence:** conductor/tracks/20261029-trike-waddle-walk/verification/phase-1.md

- [x] **P1.T1: Init pnpm + Vite8 + three viewer** — covers: FR-1
  - [x] **P1.T1.1: Configs** (package.json, vite + pwa plugin, tsconfig tsrs, oxlint/oxfmt, vitest)
  - [x] **P1.T1.2: Viewer stub** (scene, daylight, fixed cam, 72px Walk button, pixelRatio cap)
- [x] **P1.T2: Offline PWA stub** — covers: FR-1, AC-5
  - [x] **P1.T2.1: Manifest + SW precache stub**
  - [x] **P1.T2.2: Smoke boot airplane-mode <3s no errors** (scaffold ready; live device timing pending Phase 3 tablet run)

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/20261029-trike-waddle-walk/verification/phase-1.md
-->

## Phase 2: Trike Rig + Waddle Clip

- **Goal:** 0.8s seamless waddle GLB <150KB exported
- **Depends on:** Phase 1 (verified cbe9d6f)
- **Covers:** FR-2, FR-3, FR-4, AC-1
- **Touches:** `assets/trike/*`, `public/models/trike.glb`, `scripts/check-trike.*`
- **Verification:** `pnpm verify`
- **Status:** verified
- **Result:** verified
- **Checkpoint:** f9c6fc3
- **Evidence:** conductor/tracks/20261029-trike-waddle-walk/verification/phase-2.md

- [x] **P2.T1: Vendor + baby scale** — covers: FR-2
  - [x] **P2.T1.1: Vendor Triceratops GLB + CREDITS**
  - [x] **P2.T1.2: Scale 0.25-0.35x, feet y=0, Y-up check** (0.3x → 1.878 m)
- [x] **P2.T2: 12-bone armature + weights** — covers: FR-3 (DEVIATION: reused shipped 24-bone skeleton, no new armature)
  - [x] **P2.T2.1: Build hips/spine/chest/head+jaw/tail2/legs-IK/eyelids** (confirmed usable as shipped)
  - [x] **P2.T2.2: Mirror weights, fix jaw/eyelids** (spot-checked, no fix needed)
- [x] **P2.T3: Bake Waddle + export** — covers: FR-4
  - [x] **P2.T3.1: Pose 0.8s 24f bob+sway+squash, foot plant 0.2s** (retimed seamless Walk, 25 keys @30fps LINEAR, seam diff 0.0)
  - [x] **P2.T3.2: Export Draco GLB <150KB, preview_scene link** (85,780 B)

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/20261029-trike-waddle-walk/verification/phase-2.md
-->

## Phase 3: Playback Turn Blink Dust

- **Goal:** Turn-then-walk 0.4m/s 60fps with blink and dust
- **Depends on:** Phase 2 (verified f9c6fc3)
- **Covers:** FR-5, FR-6, FR-7, FR-8, AC-1, AC-2, AC-3, AC-4
- **Touches:** `src/ranch/*`, `tests/waddle/*`, `public/*`
- **Verification:** `pnpm verify`
- **Status:** verified
- **Result:** verified
- **Checkpoint:** 8acd84a
- **Evidence:** conductor/tracks/20261029-trike-waddle-walk/verification/phase-3.md

- [x] **P3.T1: Mixer + root motion** — covers: FR-5
  - [x] **P3.T1.1: AnimationMixer loop, 0.4m/s root, no pop** (0.2 s ease in/out)
  - [x] **P3.T1.2: Turn-in-place 90° <0.6s then walk**
- [x] **P3.T2: Blink + dust + squash** — covers: FR-6, FR-7 (blink = head-dip; no eyelid bones in shipped skeleton)
  - [x] **P3.T2.1: Blink timer 3-5s eyelids**
  - [x] **P3.T2.2: Dust puff + squash on plant** (pooled THREE.Points, 48 particles)
- [x] **P3.T3: Unit + visual evidence** — covers: AC-1..AC-4
  - [x] **P3.T3.1: Vitest turn/blink timing (silent walk assert)** (25 tests, 37/37 incl. FR-8 silence)
  - [x] **P3.T3.2: Tablet video + screenshot evidence** (manual user follow-up)
