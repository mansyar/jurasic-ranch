# Trike Waddle Walk — Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

First real skeletal animation for Jurasic Ranch plus minimal PWA scaffold. Vendors Polyfork Triceratops as a 0.9m forever-baby, rigs a 12-bone armature in Blender, bakes a 0.8s seamless waddle loop with foot-plant + dust, and plays it back at 60fps via three AnimationMixer with turn-then-walk and blink. Establishes the copy-template for Stego and Brachio.

## Problem / Motivation

No PWA exists yet (repo is docs-only) and no rigged dino exists. Without this track the ranch has no moving baby, no playback pattern, and no proof the Polyfork → Blender → three pipeline hits 60fps offline on a newer tablet. If not solved, all edu surprises (counting, body tap, sort) have nothing to play on.

## Goals & Success Metrics

- **Goal:** Cute slow baby waddle that reads at 2m distance.
- **Metric:** 0.8s loop plays 10x with no visible pop, turn 90° in place <0.6s then 0.4m/s walk, blink every 3-5s.
- **Goal:** Establish copyable rig template for Stego/Brachio.
- **Metric:** 12-bone hierarchy + weight workflow documented, GLB <150KB Draco.
- **Goal:** Prove offline PWA playback at 60fps.
- **Metric:** Boots airplane-mode, first paint <3s, no console errors, pixelRatio cap 2.

## Scope

### In Scope

- Minimal PWA scaffold: pnpm 12, Vite 8, three 0.180, TS, Howler stub, vite-plugin-pwa, idb-keyval stub, 72px viewer button
- Vendor Polyfork Triceratops GLB, baby scale 0.25-0.35x (~0.9m long), pastel + blush
- Blender 12-bone armature: hips/spine/chest/head+jaw/tail1-tail2/4 legs IK/eyelids
- Bake Waddle clip 0.8s 24f: wide shuffly steps, bob+sway+squash, foot plant 0.2s + dust puff
- Playback: AnimationMixer loop, root motion 0.4m/s, turn-in-place then walk, blink timer 3-5s, silent walk
- Evidence: preview_scene link + tablet video/screenshot, `pnpm verify` green

### Out of Scope

- Stego/Brachio (later tracks copy this template)
- Other 5 clips (idle, eat_nom, blink solo, happy_wiggle, sleep_droop)
- Edu minis (counting, body tap, sort, TSB), sticker book, audio voice/music/SFX
- Hosting/deploy (local `preview --host` only), accounts, multiplayer

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | PWA scaffold boots offline via `pnpm dev --host` and `pnpm preview --host` | must |
| FR-2 | Trike GLB vendored under `public/models/trike.glb`, baby scale ~0.9m | must |
| FR-3 | 12-bone armature with IK legs, jaw, eyelids, mirrored weights | must |
| FR-4 | Waddle clip 0.8s 24f loops seamlessly with no pop | must |
| FR-5 | Turn-in-place 90° <0.6s then walk forward 0.4m/s | must |
| FR-6 | Blink every 3-5s while walking (eyelid bones) | should |
| FR-7 | Bob + sway + squash on contact, foot plant 0.2s + dust puff | must |
| FR-8 | Walk is silent (no audio) in this track | must |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | 60fps on newer tablet, pixelRatio cap 2, shadows low |
| NFR-2 | GLB <150KB with Draco, one material flat-shaded |
| NFR-3 | Daylight lush only, no ACES tone-mapping |
| NFR-4 | Viewer button 72px+, tap only, landscape |
| NFR-5 | Licenses MIT/Apache-2.0/CC0 only, CREDITS kept |

## Acceptance Criteria

| ID | Criterion | Verifies |
| --- | --- | --- |
| AC-1 | Waddle loops 10x with no visible pop or foot ice-skate | FR-4, FR-7 |
| AC-2 | Turn 90° completes in place <0.6s then walks straight | FR-5 |
| AC-3 | Blink visible at least once per 5s walk video | FR-6 |
| AC-4 | Dust puff on each foot plant, squash on contact | FR-7 |
| AC-5 | Airplane-mode boot shows Trike walking in <3s, no console errors | FR-1 |
| AC-6 | `pnpm verify` (oxlint+oxfmt+tsrs+vitest+build) exits 0, 60% new-code gate met | FR-1 |

## Edge Cases

- Foot slide on turn: plant targets re-aim, hide residual with dust + sway
- Y-up export flip: verify Blender +Y up, three Y-up, feet on y=0
- Perf drop on tablet: cap pixelRatio 2, disable shadows, halve dust
- Weight mirror fail (left/right asymmetry): manual fix jaw/eyelids, re-export
- Offline cache miss: SW precaches trike.glb, fallback loading spinner
- pnpm 12 vs Node 20 mismatch: require Node 22.12+, document in README

## Dependencies

- **Tracks:** none
- **External:** Polyfork Prehistoric Valley Triceratops + Cozy Farm stub, Blender 4.x, pnpm 12.15, Node 22.12+, Python not needed this track

## Open Questions & Assumptions

- **Question:** Exact tablet model string for final perf gate?
- **Assumption:** Newer tablet 60fps assumed until dad tests; plant+dust chosen as best animation over accept-slide; Trike-only scope; silent walk MVP; af_bella voice later
- **Assumption:** Polyfork Trike GLB available under current key, else report_need honest no

## References

- conductor/product.md, conductor/tech-stack.md, conductor/product-guidelines.md
- Polyfork: prehistoric-valley-8638dc, triceratops-base, cozy-farm-cc979f
