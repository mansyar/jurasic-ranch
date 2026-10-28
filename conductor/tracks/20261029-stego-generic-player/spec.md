# Stego Joins via Generic DinoPlayer — Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

Second forever-baby Stego joins Trike via a new Polyfork Stego base GLB (minimal pipeline, distinct pastel colour pending asset lookup), plus extraction of Trike-specific `TrikePlayer` into a generic `DinoPlayer` with gait configs. Trike + Stego wander independently in the same 0.8 m radius with soft-steer avoidance, share one DustPool + BlinkController, and toggle together from a single 72 px Walk button. Proves the copy-template and unblocks Brachio.

## Problem / Motivation

Ranch has only Trike; `TrikePlayer` hard-codes Trike gait, blush, and wander. Duplicating it for Stego/Brachio triples maintenance and risks gait drift, breaks the roadmap (Track 2 Stego), and leaves the 4yo with a single-baby ranch (boredom risk). If not solved, every future dino re-pays the Trike integration cost and dual-dino coexistence (overlap, perf, cache) stays unproven.

## Goals & Success Metrics

- **Goal:** Generic player with identical Trike behaviour.
- **Metric:** Existing Trike waddle / trike-player tests pass unchanged; Trike loop 10x shows no pop or regression on video.
- **Goal:** Cute Stego distinct from Trike that reads at 2 m.
- **Metric:** Stego Waddle loops 10x with no pop/foot-skate; turn 90° in place <0.6 s then walk; blink every 3–5 s.
- **Goal:** Cozy two-dino coexistence with no overlap.
- **Metric:** 30 s dual wander stays in-frame (≤ RADIUS + CYCLE); min separation >0.25 m via soft steer; shared dust puffs visible.
- **Goal:** Prove two-mixer perf + cache headroom.
- **Metric:** 60 fps tablet, total precache <18 MB reported, `pnpm verify` green, tablet screenshot + preview_scene link in evidence.

## Scope

### In Scope

- Generic `DinoPlayer` with `GaitParams` (stride / loop / turnRate / curvature / wanderRadius) + Trike and Stego configs; Trike behaviour identical
- Vendor new Polyfork Stego base GLB → `public/models/stego.glb`, baby scale 0.25–0.35x, pastel distinct from Trike #9ed68a, blush, feet y=0, one-material flat-shaded Draco
- Reuse `scripts/vendor/bake-trike-variant` pipeline pattern for Stego (copy + retime); prefer `Waddle` clip else first animation; same `/draco/` decoder
- Dual independent wander (0.8 m radius, spawn offset ±0.4 m) + soft-steer avoidance (bias away when <0.4 m apart, never stop, no bounce)
- Shared `DustPool` (48) + shared `BlinkController` via `DinoPlayer`; single 72 px Walk toggles both, status + persisted flag
- Boxy placeholder Stego fallback on missing GLB (warn, Trike keeps waddling)
- CREDITS update for Stego source

### Out of Scope

- Brachio (Track 3), feed + snack counting 1–5 (Track 4), wash + cuddle (Track 5)
- Surprises + sticker book (Track 6), ranch dressing / 3 POV buttons / nest-garden (Track 7)
- Audio voice / music / SFX, strings/en.json externalization, hosting/deploy, accounts/multiplayer

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Generic `DinoPlayer` with `GaitParams` and Trike + Stego configs | must |
| FR-2 | Trike behaviour preserved identical (0.8 s, 0.29 m stride, ~0.4 m/s, turn <0.6 s, blink 3–5 s, dust 2–4, squash) | must |
| FR-3 | Stego GLB vendored at `public/models/stego.glb`, baby scale, pastel distinct from Trike, blush, feet y=0 | must |
| FR-4 | Stego Waddle loops seamlessly; loader prefers `Waddle` else first clip via same Draco path | must |
| FR-5 | Dual independent wander in 0.8 m radius, stay-in-frame over 30 s | must |
| FR-6 | Soft-steer avoidance biases heading away when <0.4 m apart, never stops, no bounce | must |
| FR-7 | Single Walk button toggles both dinos, aria-pressed + status + persisted walking flag | must |
| FR-8 | Missing Stego GLB shows placeholder Stego + warn; Trike keeps waddling | must |
| FR-9 | Single shared DustPool + BlinkController via generic player (no per-dino duplication) | must |
| FR-10 | No `TrikePlayer` duplication: deleted or thin alias over `DinoPlayer`, imports updated | must |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | 60 fps on newer tablet with two mixers, pixelRatio cap 2, shadows low |
| NFR-2 | Total precache <18 MB (relaxed from 15 MB for second Draco GLB); each GLB Draco one-material flat-shaded; size reported in evidence |
| NFR-3 | Daylight lush only, no ACES tone-mapping |
| NFR-4 | 72 px+ targets, tap only, landscape, no pinch/double-tap/orbit; species names Trike/Stego with icon + word |
| NFR-5 | Licenses MIT/Apache-2.0/CC0 only, CREDITS kept |
| NFR-6 | `pnpm verify` (oxlint + oxfmt check + tsrs + vitest + build) exits 0, 60% new-code gate met |

## Acceptance Criteria

| ID | Criterion | Verifies |
| --- | --- | --- |
| AC-1 | Trike regression: existing waddle/trike-player tests pass; Trike loop 10x shows no pop | FR-2 |
| AC-2 | Stego loops 10x with no pop or foot-skate; turn 90° <0.6 s then walks straight | FR-3, FR-4 |
| AC-3 | Dual 30 s wander stays in-frame (≤ RADIUS + CYCLE) with min separation >0.25 m | FR-5, FR-6 |
| AC-4 | One Walk toggles both; aria-pressed + status correct; persists across reload | FR-7 |
| AC-5 | Missing Stego GLB → placeholder visible + warn; Trike keeps walking | FR-8 |
| AC-6 | Single DustPool puffs for both; both blink at least once per 5 s walk | FR-9 |
| AC-7 | No TrikePlayer duplication: only DinoPlayer imported; old file deleted or alias | FR-1, FR-10 |
| AC-8 | `pnpm verify` green; tablet screenshot + preview_scene link; precache <18 MB reported | FR-1 |

## Edge Cases

- Stego base colours unknown until Polyfork lookup: palette TBD, must stay distinct from Trike, pastel, colorblind-safe
- Clip name mismatch: prefer `Waddle`, else first animation, else placeholder (never fail boot)
- Y-up export flip: verify Blender +Y up → three Y-up, Stego feet on y=0 (plates tall, check ground contact)
- Perf drop with two mixers: cap pixelRatio 2, shadows low, halve dust, report fps
- Cache exceeds 18 MB: fail with size report, recompress Draco / trim
- Spawn coincidence: initial offset ±0.4 m to avoid first-frame avoidance jerk
- Single-material violation after bake: re-bake one-material flat-shaded
- pnpm 12 vs Node 20 mismatch: require Node 22.12+, document

## Dependencies

- **Tracks:** 20261029-trike-waddle-walk (complete/merged), 20261029-baby-trike-turn-fix (complete/merged)
- **External:** Polyfork Stego base GLB (current key, else report_need honest no), Blender 4.x bake, pnpm 12.15, Node 22.12+, Draco decoders

## Open Questions & Assumptions

- **Question:** Stego base asset exact palette? User asked to check the Polyfork asset first.
- **Assumption:** Proposal dusty teal body + peach plates + cream belly (distinct from Trike #9ed68a), pastel colorblind-safe; final TBD pending lookup in Phase 2
- **Question:** Exact tablet model string for final perf gate?
- **Assumption:** Same 0.8 s / 0.29 m gait for Stego unless bake shows retime need; soft-steer threshold 0.4 m, min-separation target 0.25 m; spawn offset ±0.4 m; <18 MB total; single Walk toggles both; share all FX; reuse Trike pipeline
- **Assumption:** Polyfork Stego available under current key, else honest no

## References

- conductor/product.md (Roadmap Track 2), conductor/tech-stack.md, conductor/product-guidelines.md, conductor/workflow.md
- conductor/archive/20261029-trike-waddle-walk/spec.md + plan.md (copy-template)
- scripts/vendor/bake-trike-variant.*, scripts/check-trike.test.ts, CREDITS.md, assets/trike/triceratops-base.glb
