# Brachio Joins the Ranch — Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

Third forever-baby Brachio joins Trike + Stego via the existing generic `DinoPlayer` with a new `BRACHIO_GAIT` shuffle config. Brachio is bigger (1.2 m cap, seated-shuffle feel) but still baby-cute, lavender pastel distinct from Trike green and Stego teal/peach. All three wander independently in the same 0.8 m radius with pairwise soft-steer avoidance, share one DustPool and one BlinkController class, and toggle together from a single 72 px Walk button. Proves the copy-template scales to three mixers and unblocks the future Big/Little size-sort surprise (no sort logic in this track).

## Problem / Motivation

Ranch has two pen-mates; roadmap Track 3 promises Brachio, and without her the ranch feels incomplete and the future UP/DOWN size contrast (Big Brachio vs Little Trike) stays unproven. `DinoPlayer` currently holds only Trike + Stego configs — adding a third without a gait contract risks drift, trio overlap (3 pairwise collisions), and perf/cache overrun. If not solved, every future dino re-pays integration cost and the 4yo loses the gentle-giant delight that anchors counting and body-vocab play.

## Goals & Success Metrics

- **Goal:** Brachio distinct from Trike/Stego that reads at 2 m.
- **Metric:** Brachio shuffle loops 10x with no pop/foot-skate; turn 90° <1.0 s then walks straight; blink every 3–5 s.
- **Goal:** Cozy trio coexistence with no overlap.
- **Metric:** 30 s trio wander stays in-frame (≤ RADIUS + CYCLE); min pairwise separation >0.25 m via soft steer; shared dust puffs visible.
- **Goal:** Trike + Stego preserved identical.
- **Metric:** Existing waddle/dino/dual tests pass unchanged; Trike/Stego loop 10x shows no regression.
- **Goal:** Prove three-mixer perf + cache headroom.
- **Metric:** 60 fps tablet target, total precache <22 MB reported, `pnpm verify` green, tablet screenshot + preview_scene link in evidence.

## Scope

### In Scope

- `BRACHIO_GAIT` with `GaitParams` (stride / loop / turnRate / curvature / wanderRadius) + Brachio config; seated-shuffle feel, slower than Trike/Stego
- Vendor new Polyfork brachiosaurus-base GLB → `public/models/brachio.glb`, 1.2 m cap (bigger than 0.6 pen-mates, review-gated), lavender/periwinkle pastel distinct from Trike #9ed68a and Stego teal/peach, blush, feet y=0, one-material flat-shaded Draco
- Reuse bake pipeline pattern (copy + retime); prefer `Waddle` clip else first animation; same `/draco/` decoder
- Trio independent wander (0.8 m radius, triangle spawn 120° offsets) + pairwise soft-steer avoidance (bias away when <0.4 m apart, never stop, no bounce)
- Shared `DustPool` + shared `BlinkController` class via `DinoPlayer` (per-player instances)
- Single 72 px Walk toggles all three, status + species list 3 pills + persisted flag + aria-pressed
- Boxy long-neck placeholder Brachio fallback on missing GLB (warn, Trike + Stego keep waddling)
- CREDITS update for Brachio source

### Out of Scope

- Feed + snack counting 1–5 (Track 4), wash + cuddle + body-tap vocab (Track 5)
- Surprises + sticker book incl. Big/Little sort game logic (Track 6) — pure joins only, no tap/sort
- Ranch dressing / 3 POV buttons / nest-garden / sleepy cues (Track 7)
- Audio voice / music / SFX, strings/en.json externalization, hosting/deploy, accounts/multiplayer

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | `BRACHIO_GAIT` + Brachio config via generic `DinoPlayer`, no new player class | must |
| FR-2 | Trike + Stego behaviour preserved identical (0.8 s, 0.29 m stride, ~0.4 m/s, turn <0.6 s, blink 3–5 s, dust 2–4, squash) | must |
| FR-3 | Brachio GLB vendored at `public/models/brachio.glb`, 1.2 m cap, lavender pastel distinct, blush, feet y=0 | must |
| FR-4 | Brachio shuffle loops seamlessly; loader prefers `Waddle` else first clip via same Draco path | must |
| FR-5 | Trio independent wander in 0.8 m radius, stay-in-frame over 30 s | must |
| FR-6 | Pairwise soft-steer avoidance biases heading away when <0.4 m apart, never stops, no bounce | must |
| FR-7 | Single Walk button toggles all three, aria-pressed + status + species 3 pills + persisted walking flag | must |
| FR-8 | Missing Brachio GLB shows placeholder long-neck + warn; Trike + Stego keep waddling | must |
| FR-9 | Single shared DustPool + shared BlinkController class via generic player (no per-dino duplication) | must |
| FR-10 | No player duplication: only DinoPlayer imported, Trike alias unchanged | must |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | 60 fps on newer tablet with three mixers, pixelRatio cap 2, shadows low |
| NFR-2 | Total precache <22 MB (relaxed from 18 MB for third Draco GLB); each GLB Draco one-material flat-shaded; size reported in evidence |
| NFR-3 | Daylight lush only, no ACES tone-mapping |
| NFR-4 | 72 px+ targets, tap only, landscape, no pinch/double-tap/orbit; species names Trike/Stego/Brachio with icon + word |
| NFR-5 | Licenses MIT/Apache-2.0/CC0 only, CREDITS kept |
| NFR-6 | `pnpm verify` (oxlint + oxfmt check + tsrs + vitest + build) exits 0, 60% new-code gate met |

## Acceptance Criteria

| ID | Criterion | Verifies |
| --- | --- | --- |
| AC-1 | Trike/Stego regression: existing waddle/dino/dual tests pass; loops 10x show no pop | FR-2 |
| AC-2 | Brachio loops 10x with no pop or foot-skate; turn 90° <1.0 s then walks straight; blink 3–5 s | FR-3, FR-4 |
| AC-3 | Trio 30 s wander stays in-frame (≤ RADIUS + CYCLE) with min pairwise separation >0.25 m | FR-5, FR-6 |
| AC-4 | One Walk toggles all three; aria-pressed + status + 3 pills correct; persists across reload | FR-7 |
| AC-5 | Missing Brachio GLB → placeholder visible + warn; Trike + Stego keep walking | FR-8 |
| AC-6 | Single Dust both/all puff; all three blink at least once per 5 s walk | FR-9 |
| AC-7 | No duplication: only DinoPlayer imported; BRACHIO_GAIT exported with Trike/Stego | FR-1, FR-10 |
| AC-8 | `pnpm verify` green; tablet screenshot + preview_scene link; precache <22 MB reported | FR-1 |

## Edge Cases

- Brachio base colours unknown until Polyfork lookup: palette TBD, must stay distinct lavender/periwinkle, pastel, colorblind-safe
- Long neck camera clip: verify neck stays in-frame at 2 m cozy cam; cap 1.2 m, mostly seated shuffle lowers head
- Long neck/tail ground contact: feet y=0, neck pivot must not dip below ground on squash
- Clip name mismatch: prefer `Waddle`, else first animation, else placeholder (never fail boot)
- Y-up export flip: verify Blender +Y up → three Y-up, feet on y=0 (neck tall, check ground contact)
- Perf drop with three mixers: cap pixelRatio 2, shadows low, halve dust if needed, report fps
- Cache exceeds 22 MB: fail with size report, recompress Draco / trim
- Spawn triangle coincidence: initial 120° offsets to avoid first-frame avoidance jerk
- Single-material violation after bake: re-bake one-material flat-shaded
- pnpm 12 vs Node 20 mismatch: require Node 22.12+, document

## Dependencies

- **Tracks:** 20261029-trike-waddle-walk (complete/merged), 20261029-baby-trike-turn-fix (complete/merged), 20261029-stego-generic-player (complete/merged)
- **External:** Polyfork brachiosaurus-base GLB (current key, else report_need honest no), Blender 4.x bake, pnpm 12.15, Node 22.12+, Draco decoders

## Open Questions & Assumptions

- **Question:** Brachio base asset exact palette + proportions?
- **Assumption:** Lavender/periwinkle body + cream belly distinct from Trike #9ed68a and Stego teal/peach, pastel colorblind-safe; final TBD pending lookup in Phase 2
- **Question:** Exact tablet model string for final perf gate?
- **Assumption:** BRACHIO_GAIT stride 0.24, loop 1.0 s (~0.24 m/s shuffle), turnRate 1.8 rad/s (90° <1.0 s), curvature 3.0, wander 0.8 m; soft-steer threshold 0.4 m, min-separation 0.25 m; triangle spawn 120° offsets; <22 MB total; single Walk toggles all three; share all FX; reuse Stego pipeline
- **Assumption:** Polyfork Brachio available under current key, else honest no

## References

- conductor/product.md (Roadmap Track 3), conductor/tech-stack.md, conductor/product-guidelines.md, conductor/workflow.md
- conductor/archive/20261029-stego-generic-player/spec.md + plan.md (copy-template for trio)
- scripts/vendor/bake-stego-*, scripts/check-stego.test.ts, CREDITS.md
