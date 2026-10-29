# Stego and Brachio Walk on Their Own Bones

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not renumber it. If a requirement is removed, mark it `Withdrawn` instead of deleting it.

## Overview

Stego and Brachio currently walk on the **Trike's** animation clip. Their GLBs are baked by copying every channel of `public/models/trike.glb`'s `Waddle` clip onto their own skeletons, scaling the position tracks by a single constant. Because glTF translation channels are absolute local translations, the copied clip drags each bone off its rest offset, and both animals deform visibly while walking.

This track replaces that with the locomotion Polyfork actually authored for each species, re-bakes both pastel GLBs from the vendored module so their rigs match the clip's rig bone-for-bone, and enlarges the ranch so the trio can hold real-life size proportions.

## Problem / Motivation

- `scripts/vendor/bake-stego-variant.js` extracts `Waddle` from the Trike donor and rebuilds all 72 channels on the Stego skeleton: rotation quaternions verbatim, `VectorKeyframeTrack` positions multiplied by `STEGO_POSITION_TRACK_SCALE = 0.6`. `bake-brachio-variant.js` does the same at a different constant.
- glTF `translation` channels are **absolute** local translations, not deltas. Measured at frame 0 of the shipped files:

  | Bone | Stego rest (y) | Stego clip[0] (y) | Displacement |
  |---|---|---|---|
  | `Hips` | 1.368 | 0.781 | −0.59 m |
  | `Head` | 0.233 | 0.054 | −0.18 m |
  | `Tail` | −0.091 | −0.252 | −0.16 m |
  | `Jaw` | +0.004 | −0.063 | sign inverted |

  Brachio is the same defect at a larger scale: `Chest` rest `0,0.45,0.852` → clip[0] `0,−0.277,0.943` (−0.73 m), `Head` `0,0,0` → `0,0.167,0.522`.
- Rotations are **not** the problem: all 24 bones of Trike and Stego share an identity rest quaternion (delta 0.0°), and their joint names are identical. Only the translations disagree, because Stego's rest skeleton is not the Trike's scaled uniformly (`LeftHindUpLeg` y ratio 8.55, `Head` 2.58, `Jaw` 0.22).
- The vendored parametric modules cannot emit clips — neither `stegosaurus-base.mjs` nor `brachiosaurus-base.mjs` contains an `AnimationClip` or mixer API. Polyfork ships its authored clips **only inside the published GLB**: Stego `Idle` 9 s / `Walk` 2.4 s / `Run` 1 s, Brachio `Idle` 8 s / `Walk` 3.8 s / `Run` 2.5 s.
- In the dev harness the defect is obvious: hips collapse onto stumpy legs, plates fan out, the head sinks into the chest.
- The gait constants inherited the same assumption: `STEGO_GAIT.strideMetres` is `0.29`, identical to `TRIKE_GAIT` — it was never measured, it was copied.

## Goals & Success Metrics

- **Goal:** every bone stays inside a plausible envelope while walking.
  **Metric:** per-bone max displacement from rest ≤ 25 % of that bone's rest distance to its parent, asserted by a test over the baked clips.
- **Goal:** each species walks on its own authored clip.
  **Metric:** baked `Walk` duration is 2.4 s (Stego) and 3.8 s (Brachio), and the clip name is `Walk`, not `Waddle`.
- **Goal:** the trio reads as a real family.
  **Metric:** body-length ratios Stego/Trike = 1.04 ± 0.03 and Brachio/Trike = 2.00 ± 0.05.
- **Goal:** no foot slide.
  **Metric:** the stride tests derive metres-per-loop from the shipped clip and the gait config matches within 5 %.

## Scope

### In Scope

- Re-bake `public/models/stego.glb` and `public/models/brachio.glb` from the vendored module at **authored proportions** (`size: 1.0`) with the existing pastel colour knobs, so the mesh, the palette and the rig all come from one `createAsset()` call.
- Graft the authored `Idle`, `Walk` and `Run` clips from each species' official Polyfork GLB into the re-baked file.
- Apply in-game size as a **uniform group scale per species** in the viewer, never as a bake-time knob.
- Re-measure stride for both species from the new clips and update `STEGO_GAIT` / `BRACHIO_GAIT`.
- Enlarge the ranch: ground circle, spawn ring, wander radius, walk clearance, avoidance trigger, dressing placements, the three POV presets and the camera far plane.
- Lift the Brachio scale cap recorded in `conductor/product.md` (1.2 m) now that the ranch can hold a real one.
- Update `CREDITS.md`, `conductor/tech-stack.md` and the bake-script docblocks to describe the new pipeline.

### Out of Scope

- Trike's mesh or clip: it is already correct and stays byte-identical unless the shared bake helper forces a re-run.
- New gameplay (feeding, washing, stickers), audio, i18n.
- Retuning blink cadence, sleepy timings, dust counts or squash depth — those are per-species constants already, and this track only changes locomotion basis and scale.
- Polyfork HD editions, `Run`/`Idle` **state machines**: the clips ship in the GLB, but nothing in the app drives them yet.
- Recolouring the official GLBs, or shipping their brown palette.

## Bug Details

**Reproduction:** open the app with `?dev=1`, choose the Garden POV, tap Walk. Stego's hips drop, its plates fan and its head sinks into its chest; Brachio's chest collapses into its shoulders. Both animate on a 0.8 s loop, which is the Trike's clip duration.

**Expected:** each animal walks with the gait its own author rigged, feet planting under its body, at the size its own asset specifies.

**Actual:** both walk on `Waddle` extracted from `trike.glb`, with position tracks scaled by one constant and rotation tracks replayed verbatim.

**Root-cause hypothesis:** the bake treats glTF translation channels as deltas and assumes the derived skeleton is the Trike skeleton times a scalar. Neither holds: translations are absolute, and the derived rest poses differ per bone by factors from 0.22 to 8.55.

**Regression test:** a bake-time test that loads each shipped GLB, resolves every animated bone's rest translation from the node hierarchy and its first-frame translation from the clip, and fails when the displacement exceeds 25 % of that bone's rest distance to its parent. It must fail against today's `stego.glb` and `brachio.glb` and pass after the re-bake.

## Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Each of Stego and Brachio ships locomotion clips authored by Polyfork, named `Walk` (plus `Idle` and `Run`), instead of a clip extracted from the Trike donor. **Amended 2026-10-30 (Phase 6):** `Idle` and `Run` are withdrawn - the shipped file carries `Walk` only (see NFR-2 and the edge case). | must |
| FR-2 | Both GLBs are re-baked from the vendored module at authored proportions (`size: 1.0`) so the rig matches the source GLB's rig bone-for-bone. | must |
| FR-3 | A regression test asserts, for every animated bone in each shipped GLB, that first-frame translation displacement from rest is ≤ 25 % of that bone's rest distance to its parent. | must |
| FR-4 | In-game size is a uniform per-species group scale in the viewer; no bake-time `size` knob decides gameplay scale. | must |
| FR-5 | `STEGO_GAIT` and `BRACHIO_GAIT` stride values are re-measured from the shipped clips; no gait constant remains a copy of `TRIKE_GAIT`. | must |
| FR-6 | The ranch grows so a Brachio at real proportion can turn inside the walkable area: ground circle radius, spawn ring, wander radius, walk clearance, avoidance trigger and camera far plane all cover it. | must |
| FR-7 | Dressing placements keep their authored clearance from every species' wander path; no prop intersects a dino's body at any point of its loop. | must |
| FR-8 | The three POV presets frame the enlarged trio: no preset puts a prop between the camera and the animal it names, and each looks at a species' body centre. | should |
| FR-9 | `CREDITS.md` and the bake-script docblocks describe the graft pipeline and name the official GLB as the clip source. | must |

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | The re-baked trio keeps the render loop inside the current frame budget: ≤ 30k triangles and ≤ 100 draw calls in the dev harness at 1280×800, no PCF shadow regression. |
| NFR-2 | Offline precache grows by no more than 2 MiB over the current 3,426 KiB, and `pnpm build` stays free of dev-harness markers. Measured 2026-10-30: 4,221.80 KiB, i.e. +796 KiB. |
| NFR-3 | The bake is reproducible: re-running it on a clean tree produces byte-identical GLBs (sorted JSON chunk, fixed generator string, no timestamps). |
| NFR-4 | No runtime network dependency is added; the authored clips ship inside the GLBs. |
| NFR-5 | Every new pure function (rest-pose resolver, displacement check, stride measurement) is unit-tested and the global coverage floor of 60 % lines is maintained. |

## Acceptance Criteria

| ID | Criterion | Verifies |
|---|---|---|
| AC-1 | `stego.glb` and `brachio.glb` contain a `Walk` clip of 2.4 s and 3.8 s respectively, and no clip named `Waddle`, `Idle` or `Run` (amended 2026-10-30: `Idle` and `Run` withdrawn for the cache budget). | FR-1 |
| AC-2 | The new regression test fails against the pre-track GLBs (`1a96d6b`) and passes against the re-baked ones. | FR-3 |
| AC-3 | In the dev harness at the Garden POV, Stego and Brachio walk with no visible bone collapse; a screenshot pair is recorded in the phase evidence. | FR-1, FR-2 |
| AC-4 | Body-length ratios Stego/Trike and Brachio/Trike sit within 1.04 ± 0.03 and 2.00 ± 0.05 as measured from the model bounds in the browser. | FR-4, FR-6 |
| AC-5 | Stride tests pass with the new gait constants and no gait constant equals `TRIKE_GAIT.strideMetres` by copy. | FR-5 |
| AC-6 | A Brachio completes a full wander loop without leaving the walkable area, and no dino-prop intersection is visible in any POV screenshot. | FR-6, FR-7 |
| AC-7 | Each POV preset's screenshot shows the animal it names unobstructed. | FR-8 |
| AC-8 | `CREDITS.md` names the official Polyfork GLB as the clip source and keeps the no-redistribution note. | FR-9 |
| AC-9 | `pnpm verify` is green, including the new tests and the coverage floor. | NFR-1–NFR-5 |

## Edge Cases

- **Pastel colour is runtime-only.** `get_variant` states the CDN GLB carries geometry but not `hide`/`belly`/`plateTrim`; colour is applied per-vertex by the module. The bake must therefore call `createAsset()` itself and graft clips onto its own output, never fetch a colour variant and assume the paint is in the file.
- **Clip rig vs mesh rig.** If a module default knob changes between now and a future re-bake, the grafted clip's rig can diverge from the baked rig again. FR-3's test is the guard; the bake must also fail loudly when a grafted bone has no counterpart, which is what the current script does for donor channels.
- **Authored proportions vs game size.** Scale lives in one place only (the viewer's per-species group scale). A bake-time size knob would silently reintroduce the translation mismatch.
- **Spawn overlap.** A Brachio twice the Trike's length cannot spawn 0.4 m from it; the spawn ring and avoidance trigger must both grow with the body lengths.
- **Offline precache.** Measured 2026-10-30, the budget in NFR-2 is breached by the published keyframe density, not by the clip count alone: shipping `Idle` + `Walk` cost +2.86 MiB (6,873 KiB precache), and `Run` alone was 102-370 KiB per species. Resolution: **withdraw both secondary clips** - `Idle` and `Run` are carried by no code path - and ship `Walk` only, which lands at +796 KiB. A track that needs `Idle` re-bakes with it in `SHIPPED_CLIP_NAMES` and amends NFR-2 with the measured cost.
- **Older snapshots.** A stale `dist/` or cached GLB will still show the broken Stego. Calc must invalidate the workbox precache on the GLB hashes, which the existing config already does.

## Dependencies

**Tracks:** none.

**External:**
- Polyfork `stegosaurus-base` and `brachiosaurus-base` (free, commercial use, no attribution, no redistribution of files) — the authored `Idle`/`Walk`/`Run` clips and the fitted gait metadata.
- Blender 5.2.3 LTS on PATH for the Draco pass (already the repo's bake toolchain).
- `three` `GLTFExporter` for the uncompressed intermediate (already used).

## Open Questions & Assumptions

- **Assumption:** the official GLBs were built by the same vendored module with default knobs at `size: 1.0`, so a fresh `createAsset()` output has the identical rest pose and the authored clips apply verbatim. Verified in Phase 1 by a bone-by-bone rest comparison before any clip is grafted.
- **Assumption:** authored `size: 1.0` means body length 6.49 m (Stego) and 12.53 m (Brachio), taking the asset's `size_m` as authoritative.
- **Assumption:** a walkable area that fits a real-proportion Brachio is acceptable at the cost of moving dressing and re-aiming POV presets; the user chose this over shrinking all three.
- **Question (resolved):** colour cannot be baked through MCP — `get_variant`'s `glb_note` states colour is applied per-vertex at runtime. The module path is therefore mandatory.
- **Open:** whether `Run` will ever be driven by the app; it ships now, guarded only by size.

## References

- `conductor/product.md` — Roadmap T3/T7 and the pastel-scale assumption this track revises.
- `conductor/tech-stack.md` — three/GLB and Draco pipeline notes.
- `scripts/vendor/bake-stego-variant.js`, `scripts/vendor/bake-brachio-variant.js` — the current donor-based bake.
- `scripts/vendor/stegosaurus-base.mjs`, `scripts/vendor/brachiosaurus-base.mjs`, `scripts/vendor/*-base-params.json` — the vendored generators.
- `conductor/archive/20261029-stego-generic-player/` and `conductor/archive/20261029-brachio-joins-ranch/` — where the donor-based clip transfer was introduced.
- Polyfork asset pages: `https://polyfork.dev/asset/stegosaurus-base`, `https://polyfork.dev/asset/brachiosaurus-base`.
