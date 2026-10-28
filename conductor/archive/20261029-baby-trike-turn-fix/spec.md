# Baby Trike Turn Fix — Specification

> **Track:** `20261029-baby-trike-turn-fix` · **Type:** feature · **Priority:** high
> **Branch:** `feat/20261029-baby-trike-turn-fix` · **Depends on:** `20261029-trike-waddle-walk` (merged)

## 1. Overview

Replace the runtime pastel remap with a Polyfork-baked pastel baby
Triceratops (rayed shield, short horns, size-0.6 baby proportions), retime
the waddle to the new shorter legs, and rework turning into slow curvy
stroller arcs after the user reported jitter when the Trike almost stops.

## 2. Goals

- Ship a committed GLB that is already pastel at load (no runtime recolor).
- Give the model true baby proportions (bigger head/shield, short horns).
- Turns feel like a slow stroller: wide curvy arcs, no in-place spin, no
  jitter near stop.

## 3. Scope

- **In:** bake script via Polyfork module, new GLB, remap removal, gait
  retime from the new skeleton, full turn rework (arc limit + stop
  deadband), rayed pastel shield, short baby horns.
- **Out:** Stego/Brachio, feeding, audio/voice, POV buttons, surprise
  system, sticker book.

## 4. Functional Requirements

- **FR-1:** A build-time bake script pins the Polyfork `createAsset()`
  params and writes the variant GLB.
- **FR-2:** The shipped `public/models/trike.glb` loads already pastel
  (hide `#9ed68a`, belly `#c4e8b0`, cream `#f2e8c9`, leaf `#7fb069`);
  runtime COLOR_0 remap is deleted.
- **FR-3:** Baked variant uses `size: 0.6`, `horns: 0.7`, `noseHorn: 0.6`,
  `frill: rayed` (frillSize clamped 0.85 by Polyfork).
- **FR-4:** While walking, heading changes are arc-limited (max turn rate);
  no in-place spinning, Trike stays in frame via existing wander steering.
- **FR-5:** Below a stop speed threshold, heading freezes; no jitter
  oscillation while settling.
- **FR-6:** Waddle stride is re-derived from the new skeleton's gait data;
  foot plants stay clean.
- **FR-7:** Pink blush cheeks stay pinned under Head (survives rebake).

## 5. Non-Functional Requirements

- **NFR-1:** `pnpm verify` green (oxlint, oxfmt, tsrs, vitest, vite build).
- **NFR-2:** GLB stays single-material Draco-compressed; PWA precache
  unchanged in shape (still precaches `/models/trike.glb` + `/draco/*`).
- **NFR-3:** 60 fps on the newer tablet; turn math stays allocation-free.
- **NFR-4:** Fully offline after first visit; no runtime calls to Polyfork.

## 6. Acceptance Criteria

- **AC-1:** Pixel/sample check: baked body verts read pastel green without
  any remap code present.
- **AC-2:** Skeleton proportions read baby (head/shield relatively larger,
  horn length shorter than previous GLB).
- **AC-3:** Frill resolves to the rayed pattern in pastel tones.
- **AC-4:** Commanded 180° reversal while walking resolves as a wide arc,
  never a snap spin; Trike remains in frame.
- **AC-5:** 2-second settle recording after Stop shows heading variance
  ~zero (no jitter oscillation).
- **AC-6:** Foot-slide tolerance test passes on the new stride.
- **AC-7:** `pastel.ts` and its test are gone; no COLOR_0 remap code ships.

## 7. Edge Cases

- Polyfork module fetch needs network at bake time only; failure surfaces a
  clear script error, never a half-written GLB.
- Rebake drift: params pinned in-repo; re-running the script reproduces the
  same variant (save Polyfork's resolved `createAsset()` call in script
  comments).
- Blush pin must re-resolve Head by name after rebake (names may shift).

## 8. Dependencies

- `20261029-trike-waddle-walk` (merged): viewer wiring, TrikePlayer,
  wander steering, blush-pin pattern.
- Polyfork `triceratops-base.mjs` module (bake time only, free account
  fetch by the dad's machine).
- Draco tooling already in repo.

## 9. Open Questions

- None. Variant params locked: `createAsset({"size":0.6,"horns":0.7,
  "noseHorn":0.6,"frill":"rayed","hide":"#9ed68a","belly":"#c4e8b0",
  "horn":"#f2e8c9","mark":"#7fb069","shieldTrim":"#f2e8c9",
  "shieldMark":"#7fb069"})` (Polyfork medium confidence).

## 10. References

- Prior track: `conductor/tracks/20261029-trike-waddle-walk/`
- Prior review round 3: review.md (pastel remap + wander reasoning to
  supersede)
- Polyfork params: `https://polyfork.dev/cdn/triceratops-base-params.json`
