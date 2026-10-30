## Summary

The trio can now go somewhere on purpose. Each animal has a home corner ΓÇö Stego's mud
wallow, Trike's hay nest, Brachio under the plum tree ΓÇö and it gets there two ways: tap
the corner's prop to call it, or wait, because a slow seeded timer sends it out anyway.
Stego rolls in the mud with a bespoke four-second clip. All three now carry Polyfork's
authored `Idle`, so an animal that has stopped breathes instead of freezing mid-stride.

The unlock was small: the wander ring was pinned to the world origin, so no dino could
ever amble the 5ΓÇô6 m out to where the corners are. It is now a centre and a radius a
player can be handed, and with no visit active it is bit-identical to the old circle.

## Track

- **ID:** 20261030-wallow-nest-life
- **Type:** feature
- **Spec:** [spec.md](./spec.md)
- **Plan:** [plan.md](./plan.md)
- **Review:** [review.md](./review.md)

## What happened

| Phase | Goal | Result | Checkpoint |
| --- | --- | --- | --- |
| 1 | Idle ships and the player blends | Idle for all three, crossfaded under the walk weight; a stopped dino always breathes | `053a561` |
| 2 | The ring becomes a place | Wander ring is a centre and a radius, inert at the default | `7905498` |
| 3 | Stego's mud roll | `MudRoll` authored in Node, baked into `stego.glb`, gated by reading the shipped file | `46054c6` |
| 4 | The visit | idle ΓåÆ approach ΓåÆ arrive ΓåÆ dwell ΓåÆ return, seeded timer, avoidance intact | `9476151` |
| 5 | Call and payoff | Tap calls a corner, arrival pays off in mud, straw or leaves, Walk off walks everyone home | `b84984d` |
| 6 | Harness and motion | Visits drivable from the bridge, reduced motion settles decoration, seeded runs reproduce | `6319f87` |

## Requirements

- **FR-1** Idle ships for all three species ΓÇö `scripts/check-{trike,stego,brachio}.test.ts`
- **FR-2** Two-action blend, never frozen at rest ΓÇö `tests/waddle/dino-player.test.ts`
- **FR-3** The ring is a centre and a radius, default unchanged ΓÇö `tests/waddle/trio-wander.test.ts`
- **FR-4** Visit state machine with derived durations ΓÇö `tests/ranch/visit.test.ts`
- **FR-5** Corner anchors, arrival radius, facing ΓÇö `tests/ranch/visit.test.ts`
- **FR-6** Stego's bespoke `MudRoll`, played once on arrival ΓÇö `scripts/check-stego.test.ts`, `tests/waddle/dino-player.test.ts`
- **FR-7** Straw at the nest, leaves at the tree, no bespoke clip ΓÇö `tests/ranch/visit-effects.test.ts`
- **FR-8** Tap to call with a sparkle inside 100 ms ΓÇö `tests/ranch/ambient.test.ts`
- **FR-9** Seeded ~45 s timer, walking only, all three may be out ΓÇö `tests/ranch/visit.test.ts`
- **FR-10** Walk off sends everyone home ΓÇö `tests/ranch/visit.test.ts`
- **FR-11** Avoidance keeps running in transit ΓÇö `tests/ranch/visit.test.ts`
- **FR-12** One arrival burst from the shared pool ΓÇö `tests/ranch/visit-effects.test.ts`
- **FR-13** Coos and the splash reuse the shipped sounds ΓÇö `tests/ranch/visit-effects.test.ts`
- **FR-14** Harness verbs and snapshot fields ΓÇö `tests/dev/snapshot.test.ts`
- **FR-15** Reduced motion keeps clips, settles decoration ΓÇö `tests/dev/reduced-motion.test.ts`
- **FR-16** Pause freezes, seeded runs reproduce ΓÇö `tests/dev/visit-determinism.test.ts`
- **NFR-1** Precache Γëñ 15 MB ΓÇö measured 8,965 KiB
- **NFR-2** Draw calls Γëñ 180, triangles Γëñ 80,000 ΓÇö measured 169 / 45,782
- **NFR-3** No new dependency or sound file
- **NFR-4** No new HUD control; the timer is the fallback
- **NFR-5** Determinism ΓÇö `tests/dev/visit-determinism.test.ts`
- **NFR-6** No flashing above 3 Hz, shape not just colour
- **NFR-7** Bake reproducibility ΓÇö `scripts/vendor/mud-roll-clip.js`
- **NFR-8** Coverage floor ΓÇö 84.94 % lines
- **AC-1 ΓÇª AC-18** mapped in the phase evidence under `verification/`

## Verification

| Layer | Command | Result | Evidence |
| --- | --- | --- | --- |
| Static | `pnpm lint`, `pnpm format --check`, `pnpm typecheck` | pass | `verification/phase-6.md` |
| Unit | `pnpm test` | 758 tests / 58 files | `verification/phase-6.md` |
| Coverage | `pnpm coverage` | 84.94 % lines | `verification/integrated.md` |
| Build | `pnpm build` | precache 63 entries, 8,965 KiB | `verification/phase-6.md` |
| Smoke | offline boot, four cameras, two visits | pass | `verification/integrated.md` |
| Visual | seven captures, 1280├ù800 | attached below | `verification/phase-6.md` |

## Media

The four cameras with the trio at rest, then two corners with an animal on them.

**Ranch** ΓÇö unchanged framing; the track's promise is what happens elsewhere.

![Ranch POV with the trio at rest](https://github.com/user-attachments/assets/06870ae3-0797-490f-978b-a86b19a8ec1a)

**Nest** ΓÇö the hay nest is the one corner a ground lens already frames.

![Nest POV with the trio at rest](https://github.com/user-attachments/assets/47179c4f-c596-423d-9e1e-4c39cfac9ac6)

**Garden** ΓÇö the wallow sits at the bottom-right edge, which is the finding below.

![Garden POV with the trio at rest](https://github.com/user-attachments/assets/1e7c02d6-1372-4cb7-8764-0884db9cede6)

**Sky** ΓÇö the whole ranch, all three corners inside the frame.

![Sky POV over the whole ranch](https://github.com/user-attachments/assets/dbea531f-0503-4036-9e2a-25c83cd30978)

**Trike at its hay nest**, called from the Nest lens: the animal walks out, turns to face
the nest and settles.

![Trike standing at its hay nest](https://github.com/user-attachments/assets/fb6f79c4-9d49-49b5-901a-839c868a4ba8)

**Sky with the Trike at the nest** ΓÇö the corner visits read as real from above, small.

![Sky POV with the Trike at its hay nest](https://github.com/user-attachments/assets/512299b9-c737-4e95-8a13-fc67cc5afab9)

**Sky with Stego at the wallow**, sought to 2 s into its four-second roll.

![Sky POV with Stego at the mud wallow](https://github.com/user-attachments/assets/c5f99751-f9b7-43ee-a448-3de153d86ccc)

## Review

**Verdict:** PASS WITH FINDINGS after one fix round. Two majors were real defects: the roll
never played, and Stop during a return leg stranded the animal. Both fixed in `8c3436e`.
Nine other findings: three fixed, six accepted with the reason recorded.

## Deviations and risks

- **The cameras frame spawns, not corners.** The wallow, the nest and the browse tree sit
  5ΓÇô6 m outside every walk ring, so a visiting animal is at the frame edge of its own
  lens, and from the Sky view it is about 80 px. Nothing was moved to hide it: the fix is
  a camera or a corner, and both are follow-ups.
- **The roll is authored in Node, not Blender.** The bake compresses the mesh headlessly and
  injects clip channels into the compressed GLB's JSON chunk, because Blender's glTF round
  trip re-times animation onto its own frame clock. A Blender action can never reach the
  shipped file, so `scripts/vendor/mud-roll-clip.js` is the checked-in authoring module.
- **Idle costs 2.2 MiB.** 6,703 ΓåÆ 8,965 KiB of precache. Inside the 15 MB budget with
  6.3 MB spare, but it is the largest single cost this project has paid for a clip.
- **The Trike's old root-scale guard was wrong.** The shipped `trike.glb` has no root scale
  and its translations are already in size-0.6 space, so the 0.3 guard would have shrunk
  every footfall by 40 %. Corrected and pinned by a Hips-mean test.
- **One burst at a time.** A second corner arriving within the dust lifetime keeps its coo
  and loses its shape; the pool is sized for one arrival.

## Follow-ups

1. Frame the corners: either nudge the three ground lenses a few degrees toward their
   corners or move the corners inside the rings. The Nest lens proves it can look right.
2. Widen the arrival pool so two animals can arrive at once with both shapes.
3. The Track 8 tablet pass still carries the nearest-stance crop behind the Walk button.

## Rollback

```bash
git revert --no-edit <squash-commit>
```
