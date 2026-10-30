# Phase 3 — Stego's mud roll

- **Track:** 20261030-wallow-nest-life
- **Phase:** 3 — Stego's mud roll
- **Date:** 2026-10-30
- **Branch:** feat/20261030-wallow-nest-life
- **Base:** 3ebcecd (Phase 2 checkpoint)
- **Result:** PASS

## What was asked

FR-6: a bespoke `MudRoll` for Stego, authored by a checked-in deterministic
script, playing once on arrival and returning to `Idle`. AC-6: `stego.glb`
carries `MudRoll` at its measured duration, and re-running the bake reproduces
it.

## The pivot this phase had to make

The plan (and the spec, as first written) said "authored by a checked-in
deterministic **Blender** script". That was wrong about where animation enters
the pipeline, and the phase found it by building the thing.

`bake-stego-variant.js` compresses the mesh in headless Blender and then
**injects** the clip channels into the compressed GLB's JSON chunk, because
`GLTFExporter` cannot write Draco and Blender's glTF round trip re-times
animation onto its own frame clock. Proven end to end before pivoting:

- The uncompressed temp GLB the JS bake writes carries `animations []`.
- A Blender action authored against the imported mesh *does* survive Blender's
  own export (`probe-out.glb` → `MudRoll`, 72 channels) — so Blender was never
  the problem. Reaching the **shipped** file was: the bake overwrites
  `animations` wholesale from the donor clips.
- Therefore any Blender-authored action is discarded by the bake by
  construction.

So the roll is authored in `scripts/vendor/mud-roll-clip.js`, which produces
exactly the shape `injectGlbAnimations` consumes and rides the existing, tested
injection path. FR-6 and the plan's Touches were amended to say so, with the
reason recorded rather than the plan quietly diverging.

A first attempt at the Blender route is preserved in the transcript, not in the
tree: `scripts/vendor/bake-stego-mudroll.py` was written, iterated against
renders, and then deleted once the pivot made it dead code. The keyframe table
survived the move intact.

## How the motion was designed

Three drafts were rejected against renders before the shipped one:

| Draft | What it looked like | Why it failed |
| --- | --- | --- |
| Per-bone deltas down the spine | Folded onto its nose | Hips 24 + Chest 10 + Neck 18 + Head 14 = 66° at the nose, not 24° |
| 0.30 m drop, no roll | A play bow | The drop is not the readable part |
| 26° pitch, 0.55 m drop | A face-plant | The pitch is not the readable part either |

The shipped motion: body stays **flat** (10–12°), drops 0.55 m until the belly
is in the mud, neck bends so the chin reaches it, body rolls ±28° onto one
shoulder then the other, a smaller third roll, tail swishes once, heave up,
shake off, rest. The roll carries the read; the drop puts it in the mud.

Spine values are authored as **cumulative armature-space rotation** and
resolved into per-bone deltas by `resolveMudRollPose`, pinned by a unit test:
a value means "the chest is pitched 20° in world terms".

Rotations are authored in armature space and conjugated into each bone's local
space with the bone's armature-space rest rotation, so `ry` means "roll onto the
left side" whatever axis the bone happens to have.

## Evidence

| Claim | Proof |
| --- | --- |
| `stego.glb` carries `MudRoll` | `Idle 9.000 s / 48 ch`, `Walk 2.400 s / 48 ch`, `MudRoll 4.000 s / 16 ch / 121 keys` (`.conductor/evidence/inspect-stego-anims.cjs`) |
| 16 channels | 15 animated bones + the root's translation channel |
| Rest to rest | Hips first quat `0,0,0,1` equals last; max \|delta\| `0.00e+0` |
| Belly reaches the mud | Hips translation y `1.730 .. 2.280` — a 0.55 m drop and return |
| Peak roll | 30.4° off rest at the roll keys (gate asserts > 20°) |
| Reproducible | Bake re-run writes the same clip duration and channel count; the clip is arithmetic over a constant table with no clock, no RNG, no Blender |
| Gate | `scripts/check-stego.test.ts` — 8 tests, including the rest-to-rest, drop-range and chain-resolution assertions |

## Cost

| Measure | Before | After | Delta |
| --- | --- | --- | --- |
| `stego.glb` | 1,318,864 B | 1,334,028 B | +15,164 B (+14.8 KiB) |
| Precache | 8,914.59 KiB | 8,957.64 KiB | +43.05 KiB |
| Precache headroom (NFR-1) | 6,446.36 KiB | 6,403.31 KiB | still inside 15 MB |

Fifteen kilobytes for a bespoke four-second animation, because the clip is 121
LINEAR keys on 16 channels rather than a baked-every-frame export.

## Deviations

1. **Authored in Node, not Blender.** FR-6 amended. Reason above; the bake
   discards anything Blender animates.
2. **`scripts/vendor/mud-roll-clip.js` + `.d.ts`** are new files not in the
   plan's Touches; `scripts/vendor/bake-stego-mudroll.py` was planned and is
   not shipped.
3. **`scripts/bake-trike-variant.js`** gained `BESPOKE_CLIP_NAMES` so
   `selectShippedClips` no longer treats a repo-authored clip as foreign when
   it reads a shipped GLB. Without it, every re-bake idempotency test threw.
4. **`scripts/check-dino-clips.test.ts`** now expects three clips for Stego and
   two for the others.
5. **A stale untracked measurement test** (`.conductor/evidence/phase-4/
   measure-gait.measure.test.ts`, from the ranch-vista track) was deleted: it
   read the old Stego clip set, was picked up by the suite, and is gitignored
   scratch whose numbers live in that track's archived evidence.

## Not claimed

The clip is not yet played by anything — Phase 4 owns the visit state machine
and Phase 5 wires the arrival. Visual sign-off of the roll **in the ranch** is
therefore Phase 5's, with captures; this phase proves the clip's shape,
duration, rest-to-rest property and drop numerically, plus the render-based
design work that produced the table.
