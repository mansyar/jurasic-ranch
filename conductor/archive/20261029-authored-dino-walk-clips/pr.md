# fix(ranch): walk Stego and Brachio on their own authored clips

## Summary

Stego and Brachio were animated by a clip lifted from the Trike's rig, with every
bone translation multiplied by one constant. Because a glTF translation channel is
an **absolute local translation**, that dragged each bone off its own rest offset:
the Stego walked with its hips on the floor and its plates fanning from its back,
and the Brachio's neck sat a metre out of place. Both species now ship the `Walk`
clip Polyfork authored for them, grafted onto a rig that is proven identical to the
official one.

While measuring the result, two further defects surfaced that the eye could not
catch in a still: the stride was measured at authored size while the models are
drawn at 0.592x, so the feet skated up to 0.30 m/s; and the loader asked for a clip
named `Waddle`, which only the Trike has, falling back to `animations[0]` — for the
re-baked files that is `Idle`, i.e. a breathing loop used as a walk.

## Track

- **ID:** `20261029-authored-dino-walk-clips`
- **Type:** bug
- **Spec:** [spec.md](./spec.md)
- **Plan:** [plan.md](./plan.md)
- **Review:** [review.md](./review.md)

## What happened

| Phase | Goal | Result | Checkpoint | Notes |
| --- | --- | --- | --- | --- |
| 1: Prove the official base matches the module | the vendored parametric module rebuilds the official rig, joint for joint | verified | `17f6b8a` | 24/24 Stego and 35/35 Brachio joints at 0.0000 m / 0.000 deg; the first run said MISMATCH because the module exports node matrices and the official file exports TRS |
| 2: Re-bake with the authored clips | both GLBs carry Polyfork's own `Walk`, grafted by joint name | verified | `d2a3bcd` | `GLTFExporter` re-times to 24 fps and re-emits TRS, so the bake exports mesh-only, Draco-passes, then injects the official animation blocks |
| 3: Regression gate on bone displacement | a test that fails on the pre-track GLBs and passes on these | verified | `3dd8e88` | pre-track: 22/24 Stego and 12/35 Brachio bones over the bound, worst `TailTip` 148.5 %; shipped: 0 over, worst 0.0987 m |
| 4: Gait constants and per-species scale | each species walks at its measured stride, sized by one group scale | verified | `aac879e` | strides swept against planted-foot slide; `S = 3.708/6.26 = 0.59233`; Trike 3.708 m, Stego 3.845 m, Brachio 7.423 m |
| 5: Enlarge the ranch | a real-proportion Brachio turns inside the walkable area and each POV frames its animal | verified | `05005c8` | ground 12.045 m, trigger 1.842 m; the screenshot round caught Garden framing the Brachio, so each lens now aims at its named animal |
| 6: Tell the truth about the trio | viewer plays the species' own walk clip; docs and budget describe what ships | verified | `4a4eb62` | `Idle` and `Run` withdrawn (3 clips cost +3.4 MiB against a 2 MiB ceiling); loader refuses `animations[0]` |
| R1: Review fixes | stride applied at the shipped scale | verified | `cc689c9` | Stego skid 0.304 m/s, Brachio 0.190; closing speed 1.21 -> 0.804 m/s, trigger 1.842 -> 1.639 m |
| R2: Review fixes, round 2 | guard the call site, not just the helper | verified | `bff3675` | removing `worldGait` at the loader reads 0.745 m/s against 0.4413 |

## Requirements

- [x] FR-1 authored `Walk` per species, no Trike donor, no `animations[0]` guess
- [x] FR-2 the baked rig equals the official rig
- [x] FR-3 bone-displacement regression gate
- [x] FR-4 one uniform in-game scale per species
- [x] FR-5 stride measured from each clip
- [x] FR-6 ranch geometry derived from the largest body
- [x] FR-7 props clear of the walk area and the sightlines
- [x] FR-8 each POV frames its named animal
- [x] FR-9 credits and bake docs name the clip source
- [x] NFR-1 trio peaks at 32,805 tris / 100 draw calls
- [x] NFR-2 precache +796 KiB, inside the 2 MiB allowance
- [x] NFR-3 byte-identical re-bake
- [x] NFR-4 no runtime network dependency (GLBs served from `public/models`)
- [x] NFR-5 new pure functions tested, 60 % lines floor held
- [x] AC-1 `Walk` at the published lengths and nothing else
- [x] AC-2 gate fails pre-track, passes shipped
- [x] AC-3 no visible bone collapse, in motion
- [x] AC-4 real-life proportions on screen
- [x] AC-5 each species' stride, not the Trike's
- [x] AC-6 no prop inside the walk area
- [x] AC-7 no animal blocking a preset's subject
- [x] AC-8 credits name the source, no-redistribution note kept
- [x] AC-9 `pnpm verify` green

## Verification

| Layer | Command | Result | Evidence |
| --- | --- | --- | --- |
| static | `pnpm lint` / `pnpm format --check` | pass, 67 files correct | `verification/phase-R2.md` |
| typecheck | `pnpm typecheck` | pass | `verification/phase-R2.md` |
| unit | `pnpm test` | pass, 36 files / 354 tests | `verification/phase-R2.md` |
| coverage | `pnpm coverage` | pass, 71.07 % lines, floor 60 | `verification/phase-R2.md` |
| build | `pnpm build` | pass, precache 30 entries / 4,221.88 KiB | `verification/phase-6.md` |
| full gate | `pnpm verify` | exit 0, dist clean | `verification/phase-R2.md` |
| rig parity | `scripts/vendor/inspect-dino-clips.mjs` | MATCH, 24/24 and 35/35 joints | `verification/phase-1.md` |
| displacement gate | `scripts/check-dino-clips.test.ts` | pass shipped, fail on `1a96d6b` | `verification/phase-3.md` |
| visual | dev harness, each species walking | plates upright, neck vertical, feet planted | `verification/phase-6.md` |

## Media

![The Stego walking on its own authored clip](.conductor/media/20261029-authored-dino-walk-clips/walk-stego.png)

![The Brachio upright at 7.42 m](.conductor/media/20261029-authored-dino-walk-clips/walk-brachio.png)

## Review

- **Verdict:** PASS
- **Rounds:** 2
- **Fixed:** round 1 - 1 High (world-metre stride on a scaled model), 1 Medium (bake docs described retired clips), 3 Low; round 2 - 1 Medium (the fix had no test at the call site), 3 Low
- **Accepted or deferred:** none deferred

## Deviations and risks

- `Idle` and `Run` are withdrawn from the shipped GLBs: three clips cost +3.4 MiB
  of precache against a 2 MiB allowance and no code path plays either. FR-1 and
  AC-1 are amended rather than quietly narrowed.
- The bake injects the animation blocks after the Blender pass instead of routing
  them through `GLTFExporter`, which re-times to 24 fps (2.4 s shipped as 2.375 s).
- The precache cap moved 2 MiB -> 4 MiB so workbox would accept the larger GLBs.
- Speeds are now authored-metre values scaled at the loader; `IN_FRAME_OVERSHOOT_METRES`
  stays at 0.91, which round 2 confirmed is still an upper bound at the shipped speeds.
- The trio's separation behaviour changed with the body-aware trigger: pairs now
  steer apart further out, which can read as drifting rather than meeting.
  `AVOIDANCE_REACTION_SECONDS` is the knob if a play test disagrees.

## Follow-ups

- The Stego and Brachio bakes are keyed to Polyfork's published clip names: a
  rename upstream fails the bake loudly rather than degrading.
- ~970 kB of three-emitted decoder assets (`draco_decoder.js`, the gltf variant)
  ship in `dist` and are never fetched — carried from the previous track.

## Rollback

```sh
git revert --no-edit <squash-commit>
```
