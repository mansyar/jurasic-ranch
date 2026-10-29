# Review - Stego and Brachio Walk on Their Own Bones

- **Track:** `20261029-authored-dino-walk-clips`
- **Type:** bug
- **Branch:** `fix/20261029-authored-dino-walk-clips`
- **Range:** `1a96d6b..959d9fc` (round 1 reviewed the pre-R1 tip; round 2 reviewed `cc689c9`)
- **Date:** 2026-10-30
- **Verdict:** PASS - round 1 returned BLOCK (1 High, 1 Medium, 3 Low), round 2 confirmed all five closed and raised one Medium plus three Low, all fixed in Phase R2

## Summary

The clip pipeline and the viewer are right. Polyfork's authored `Walk` is grafted
by joint name after the Draco pass, `translation` and `rotation` only, and the
shipped bytes are pinned by tests to the exact clip set, channel count and
duration. The regression gate really fails against `1a96d6b` (22/24 Stego and
12/35 Brachio bones over the 25 % bound) and passes against the shipped files.
The ranch geometry is derived from one body length and every derivation is
asserted.

What it got wrong is the join between two phases that each looked right alone.
Phase 4 measured a stride on the baked group at **authored** size; Phase 4 also
shrank the rendered model by `DINO_GROUP_SCALE` (0.5923). `DinoPlayer` advances
the root in **world** metres, so the shipped Stego covers 1.059 m of foot travel
per loop while the root moves 1.788 m: **0.304 m/s of skid**, 16x the 0.0185 m/s
floor Phase 4 certified, and 40 % of the walk speed. The Brachio skids 0.190 m/s.
No test could see it - every stride suite builds its own unscaled rig, and the
screenshots are stills.

## Verification

| Layer | Command | Result |
| --- | --- | --- |
| Static | `pnpm lint` | not run by the reviewer (shell denied); primary: pass |
| Format | `pnpm format --check` | not run by the reviewer; primary: 67 files correct |
| Types | `pnpm typecheck` | clean |
| Unit | `pnpm test` | 36 files / 351 tests pass |
| Coverage | `pnpm coverage` | 71.07 % lines, floor 60 |
| Build | `pnpm build` | precache 30 entries / 4,221.88 KiB, `dist clean` |

## Requirements

| ID | Status | Evidence |
| --- | --- | --- |
| FR-1 | covered | clip set is exactly `['Walk']`; `Waddle`/`Idle`/`Run` asserted absent |
| FR-2 | covered | 24/24 and 35/35 joints equal the official rig at 0.0000 m |
| FR-3 | covered | `check-dino-clips.test.ts`, non-vacuous, fails on `1a96d6b` |
| FR-4 | covered | one scalar before `DinoPlayer`; `trio-viewer.test.ts` pins per-species size |
| FR-5 | **partial -> covered in R1** | constants measured and distinct, but applied in the wrong unit (F1) |
| FR-6 | covered | walk circle, clearance, spawn ring, trigger, far plane all from one body length |
| FR-7 | covered | every prop outside clearance; clearance decomposed in `dressing.test.ts` |
| FR-8 | covered | `lookAt` on the named animal, sightlines clear of props and other spawns |
| FR-9 | **partial -> covered in R1** | CREDITS correct; bake docblocks still described the retired clip sets (F2) |
| NFR-1 | covered | 32,805 tris / 100 draw calls at 1280x800 |
| NFR-2 | covered | 4,221.88 KiB, +795 KiB, under the 2 MiB ceiling |
| NFR-3 | covered | two identical SHA-256 bakes recorded; not gated (debt) |
| NFR-4 | covered | clips live in the GLBs; vendor is build-time only |
| NFR-5 | covered | 71.07 % lines, 351 tests |
| AC-1..AC-9 | covered | see the table in `verification/integrated.md`, with FR-4/FR-6/FR-7 evidence paths corrected in R1 (F5) |

## Findings

### F1 - High - world-metre stride applied to a scaled model

`src/viewer/loaders.ts:189` (pre-R1) scaled the model by `DINO_GROUP_SCALE` and
then handed `STEGO_GAIT` / `BRACHIO_GAIT` to `DinoPlayer`, which advances the
root by `strideMetres` in world space. Foot travel is scaled by the model, root
travel is not, so both species skated: Stego 0.304 m/s, Brachio 0.190 m/s.

**Fix (R1):** `worldGait(gait, groupScale)` in `loaders.ts`, applied inside
`loadDinoPlayer` so a new species cannot forget it, plus two coupling tests that
measure the shipped rig (scaled slide = unscaled slide at `v / S`, scaled by
`S`) and assert the un-converted gait would skate. Documented in both gait
docblocks as "authored metres". Because the speeds changed, `MAX_CLOSING_SPEED`
was re-derived from the gaits (0.804 m/s = Trike 0.3625 + Stego 0.4413) and the
avoidance trigger fell from 1.842 m to 1.639 m; the test now recomputes the
closing speed from the gaits instead of pinning a number.

### F2 - Medium - the bake docblocks described the retired clip sets

Six passages still said `Idle`/`Walk`/`Run` or `Idle` and `Walk` shipped, while
`SHIPPED_CLIP_NAMES = ['Walk']`. FR-9 makes those docblocks a deliverable, and
`selectShippedClips`'s own contract is what a future re-bake is written against.
**Fixed in R1.**

### F3 - Low - `TRIKE_GAIT` claimed "bit-identical"

The docblock said the values matched so Trike behaviour was bit-identical, then
noted the wander radius grew - but the radius is a field of that object, so the
Trike's path geometry changed 4.6x. Restated honestly. **Fixed in R1.**

### F4 - Low - orphaned POV docblock

Two consecutive blocks sat above `POV_FOCUS_SPECIES`; the first argued for aiming
at the ranch centre, the design the same phase replaced. Deleted. **Fixed in R1.**

### F5 - Low - wrong evidence paths in `integrated.md`

FR-4 pointed at the gait-constants suite (which never touches the group scale),
FR-7 at `tests/ranch/dressing.ts` (no such file), FR-6 at a glob matching
nothing. Repointed at the suites that actually assert those requirements.
**Fixed in R1.**

## Plan compliance

| Phase | Result | Checkpoint | Notes |
| --- | --- | --- | --- |
| 1 | verified | `17f6b8a` | inspector bug (matrix vs TRS) found and fixed inside the phase |
| 2 | verified | `d2a3bcd` | inject after Blender instead of through `GLTFExporter`; 4 MiB cap |
| 3 | verified | `3dd8e88` | gate fails on `1a96d6b`, passes on the shipped files |
| 4 | verified | `aac879e` | sweep and scale both correct, never joined (F1) |
| 5 | verified | `05005c8` | POV bearings and `lookAt` recorded as deviations |
| 6 | verified | `4a4eb62` | retired clips withdrawn, docs partly stale (F2) |
| R1 | verified | _set on squash_ | F1-F5 |

## Out of scope, observed

- `src/viewer/placeholders.ts:27` still exports `SPAWN_OFFSET_METRES = 0.4`
  documented as "Trike starts at -x, Stego at +x (FR-5)" although the trio has
  spawned from `trioSpawnPositions()` since the trio track. A stale second
  description next to a correct one.
- The FR-3 gate inspects frame 0 of translation channels, which is what FR-3
  asks for, but a mid-cycle bone drag would pass it. Do not over-read it.
- `check-dino-clips.test.ts` bounds a bone whose rest offset is just above
  `MIN_REST_DISTANCE_METRES` at 0.25x its offset while a zero-rest bone gets a
  1 mm allowance: a 4x step at the threshold. Neither shipped file is near it.

## Debt

| Item | Why it stays |
| --- | --- |
| `NFR-3` determinism is recorded, not gated | two identical hashes prove it today; a hash constant in a test would need a rebake every time a mesh changes |
| No device frame rate | NFR-1 numbers are software-rasterised; the tablet track owns the real one |
| Stride suites measure at authored size | they now assert the scaling rule separately rather than duplicating the sweep; the loader-boundary test covers the shipped rig |
| `IN_FRAME_OVERSHOOT_METRES` is conservative, not tight | round 2 confirmed 0.91 is still an upper bound at the shipped speeds (0.770 / 0.530 / 0.753 m) and that the clearance test evaluates the stricter authored gaits |

## History

| Round | Verdict | Critical | High | Medium | Low | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | BLOCK | 0 | 1 | 1 | 3 | F1-F5 fixed in R1 |
| 2 | PASS WITH FINDINGS | 0 | 0 | 1 | 3 | F2.1 (the fix had no test) + F2.2-F2.4 fixed in R2; round 1 findings all confirmed closed |
| - | **PASS** | 0 | 0 | 0 | 0 | every finding closed, nothing deferred |
