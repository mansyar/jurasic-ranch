# Ranch Warmth UI - Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

Turn the bare prototype ranch into a warm AAA-cozy forever-home: fixed Ranch / Nest / Garden POV buttons, Valley + Farm Polyfork dressing, visual-only sleepy cues, 5s hint glow, and 72px touch + landscape hardening — all interruptible, no fail states.

## Problem / Motivation

Today the ranch is a flat green circle + single Walk button + species list. No place identity for Nest/Garden, no sleepy cues for the care-plus-surprise loop, tiny touch targets, pinch/orbit possible — feels like a tech demo, not a cozy home a 4yo trusts. Without this, feed/wash/surprises land on a cold stage.

## Goals & Success Metrics

- **Goal:** Warm believable ranch with 3 fixed cozy views.
- **Metric:** POV cut <100ms feedback, hint glow after 5s idle, ZZZ after ~90s idle interruptible, 60fps tablet pixelRatio≤2, no console errors, first paint <3s.
- **Goal:** AAA-cozy look from Polyfork without breaking PWA.
- **Metric:** Curated Valley ground + Farm props load offline via precache; size reported, 60fps held; if >15MB, optimization follow-up filed, not silent.

## Scope

### In Scope

- 3 fixed POV buttons Ranch / Nest / Garden — instant cut, 72px+, no orbit/follow
- Ranch dressing Valley + Farm mix (12-18 curated parts): Valley ground/trees/rocks + Farm fences/trough/nest ring, Draco GLBs
- Sleepy visual cues only: droopy eyes (long blink), yawn scale, ZZZ particles after ~90s idle, never auto-sleep
- 5s hint glow on Walk/POV, pulsing, respects reduced-motion
- Touch hardening: ≥72px targets, landscape lock, pinch/double-tap zoom prevention, safe-area
- Cozy guards: reduced-motion disables tween/ZZZ, portrait rotate hint, all anims cancellable

### Out of Scope

- Lullaby audio, mute/volume lock, parent gate (Cozy Sound track)
- Feed / wash / petting / surprises / sticker book
- Follow-cam, orbit, free camera
- Full buildKit 500+ placement import
- Brachio, settings persistence beyond walking flag

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | POV buttons switch between 3 fixed camera presets (Ranch, Nest, Garden) with instant cut | must |
| FR-2 | All interactive controls ≥72px, with icon + label, tap feedback <100ms | must |
| FR-3 | Ranch dressed with Valley terrain ground + trees/rocks + Farm fences/trough/nest markers, precached offline | must |
| FR-4 | Sleepy cues play after ~90s no-interaction: droopy blink, yawn scale, ZZZ particles, interruptible on any tap | must |
| FR-5 | Hint glow pulses on Walk/POV after 5s idle, clears on interaction | must |
| FR-6 | Landscape locked, pinch/double-tap zoom prevented, portrait shows rotate hint | must |
| FR-7 | All animations interruptible, no fail states, dinos stay in frame via existing wander/avoidance | must |
| FR-8 | Reduced-motion respected: tween/ZZZ/glow become static highlights | should |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | 60fps on tablet, pixelRatio capped at 2, NoToneMapping daylight |
| NFR-2 | PWA offline: new GLBs precached, size reported; best-effort <15MB (overage → follow-up, not block) |
| NFR-3 | First paint <3s, no console errors, smoke boot passes |
| NFR-4 | Pastel one-material Polyfork style, no ACES, CC0 only |
| NFR-5 | COPPA: no accounts, no tracking, local-only |

## Acceptance Criteria

| ID | Criterion | Verifies |
| --- | --- | --- |
| AC-1 | Tap Ranch/Nest/Garden → camera jumps to preset <200ms, both dinos reachable in frame | FR-1 |
| AC-2 | All buttons measured ≥72px, tap shows hearts/wiggle/sound stub <100ms | FR-2 |
| AC-3 | Ranch boots offline with ground + fences + nest + garden markers visible, no missing GLB | FR-3 |
| AC-4 | Idle 90s → droopy + yawn + ZZZ play, any tap cancels and dinos resume walk/idle | FR-4 |
| AC-5 | Idle 5s → Walk/POV glows, tap clears, reduced-motion shows static outline | FR-5 |
| AC-6 | Pinch/double-tap does not zoom, portrait shows rotate hint, landscape full-bleed | FR-6 |
| AC-7 | During any anim, tap interrupts cleanly, no stuck pose, wander stays in 0.8m circle | FR-7 |

## Edge Cases

- Idle timer resets on any pointerdown, Walk toggle, or POV switch
- Sleepy cues do not trigger while user is dragging or mid-tween
- Portrait / narrow: UI stacks, rotate hint, no overlap of 72px targets
- Reduced-motion: no pulse/tween/particles, instant state changes only
- WebGL fail / GLB missing: placeholder ground + buttons still usable, error logged not crashed
- Offline first load: precache manifest includes new GLBs or graceful fallback

## Dependencies

- **Tracks:** none (builds on archived trike-waddle-walk + stego-generic-player already in main)
- **External:** Polyfork CDN free GLBs (cozy-farm-cc979f, prehistoric-valley-8638dc), CC0, Draco

## Open Questions & Assumptions

- **Question:** Exact 12-18 part shortlist TBD from get_kit rows during planning — ok to lock then?
- **Assumption:** No-cap max beauty accepted with guardrail: measure size/fps, file optimization follow-up if >15MB or <50fps, don't block warmth.
- **Assumption:** Instant cut for POV now, gentle 0.8s tween later if dad wants.
- **Assumption:** ZZZ timing 90s tunable via constant, sleepy never forces nap/exit.

## References

- conductor/product.md, product-guidelines.md, tech-stack.md
- Polyfork kits: cozy-farm-cc979f, prehistoric-valley-8638dc, nature-forest-kit-f29d6a
- Current: src/viewer/main.ts (fixed cam 2.4,1.5,3.0), src/ranch/*
