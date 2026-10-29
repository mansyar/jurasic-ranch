# Phase 1 — Prove the official base matches the module

- **Track:** 20261029-authored-dino-walk-clips — "Stego and Brachio Walk on Their Own Bones"
- **Phase:** 1 of 6
- **Date:** 2026-10-29
- **Branch:** `fix/20261029-authored-dino-walk-clips`
- **Base commit:** `a6261fcff9c2cbd42b75d48fc2f715fc3a20ea35`
- **Head commit:** `c9966ca` — the inspector plus the matrix-decomposition fix; this file follows in its own commit

## Result

**verified.**

A fresh `createAsset()` bake of each vendored module at `size: 1.0` shares the
official GLB's rest pose bone for bone, inside 1 mm and 0.1°:

| Species | Joints (official / module) | Worst translation delta | Worst rotation delta | Joints outside bounds | Verdict |
|---|---|---|---|---|---|
| Stego | 24 / 24 | 0.0000 m | 0.000° | 0 | **MATCH** |
| Brachio | 35 / 35 | 0.0000 m | 0.000° | 0 | **MATCH** |

An independent check run by the primary agreed: worst delta 0.0000 m, 0.000°,
zero joints outside bounds, and no joint missing on either side, no parent-chain
difference and no rest-scale difference (`outsideBounds`, `missingInModule`,
`extraInModule`, `parentDiffs`, `scaleDiffs` are all `[]` in both reports).

This closes the open assumption in `spec.md`: the official assets were built by
the same vendored module at `size: 1.0`, so **the authored clips apply verbatim
to a fresh bake**. `FR-2`'s premise holds and Phase 2 may graft.

One correction is recorded under *Deviations*: the first run of the inspector
reported MISMATCH for both species, and that verdict was wrong — a tool bug, not
a rig difference.

## Commands

| Command | Exit | Result |
|---|---|---|
| `curl -L -o .conductor/evidence/phase-1/stegosaurus-base.glb https://polyfork.dev/cdn/stegosaurus-base.glb` | 0 | 1,888,076 B written |
| `curl -L -o .conductor/evidence/phase-1/brachiosaurus-base.glb https://polyfork.dev/cdn/brachiosaurus-base.glb` | 0 | 2,803,752 B written |
| `node scripts/vendor/inspect-dino-clips.mjs` (first run) | 1 | `MISMATCH for stego, brachio` — **wrong**, caused by the reader bug below |
| `node scripts/vendor/inspect-dino-clips.mjs` (after the fix) | 0 | `Verdict: MATCH` for both species; reports written |
| `pnpm format` | — | **Permission denied** (shell). Not needed: the only modified file is `scripts/vendor/inspect-dino-clips.mjs`, which `pnpm format` excludes via `"!scripts/vendor/**/*.mjs"` |
| `pnpm verify` | 0 | `format --check` clean on 65 files, lint clean, `tsrs --noEmit` clean, 32 files / 311 tests passed, coverage 76.91 % lines, build fine, `dist clean: no dev harness markers` |

**`pnpm verify` cannot see this script.** `oxlint` runs with
`--ignore-pattern "scripts/vendor/**"`, `oxfmt` excludes
`"!scripts/vendor/**/*.mjs"`, and `tsconfig.json` has no `allowJs`, so
`tsrs --noEmit` never parses it. A green verify says nothing about whether the
inspector runs; its correctness rests on the measured output above, and on
Phase 3, whose test imports it.

## Rig comparison

Rule applied, as the brief specifies: **MATCH** when every joint is within 1 mm
and every rest quaternion within 0.1°; otherwise MISMATCH with each offending
bone named. Bounds live in the tool as `MATCH_TRANSLATION_METRES = 1e-3` and
`MATCH_ROTATION_DEGREES = 0.1`.

Sample rows (all joints are 0.0000 m / 0.000°; the full 24- and 35-row tables
are in the report JSON named under *Evidence paths*). Columns: joint, parent,
official rest translation, module rest translation, delta, delta as a fraction
of the joint's rest distance to its parent, rotation delta.

| Species | Joint | Parent | Official rest t (m) | Module rest t (m) | Delta (m) | Rest → parent (m) | Δrot (°) |
|---|---|---|---|---|---|---|---|
| Stego | `Hips` | `body` | (0, 2.28, −0.4749) | (0, 2.28, −0.4749) | 0.0000 | 2.3289 | 0.000 |
| Stego | `Spine` | `Hips` | (0, 0.076, 0.627) | (0, 0.076, 0.627) | 0.0000 | 0.6316 | 0.000 |
| Brachio | `Hips` | `body` | (0, 4.1, −0.2563) | (0, 4.1, −0.2563) | 0.0000 | 4.1080 | 0.000 |

Two properties make the verbatim graft safe, both measured here:

1. **The joint sets are identical by name**, so a channel's `nodeName` resolves
   on both skeletons — the lookup Phase 2 needs cannot miss.
2. **Rest rotations agree exactly**, so bone axes are the same and a grafted
   quaternion track means the same thing on the baked rig.

## Clip facts

Measured from the official GLBs by `clipFacts()`:

| Species | Clip | Duration (s) | Channels | Keyframes | Paths | Bones covered |
|---|---|---|---|---|---|---|
| Stego | `Idle` | 9.000 | 48 | 1081 | 24 translation + 24 rotation | 24 |
| Stego | `Walk` | 2.400 | 48 | 289 | 24 translation + 24 rotation | 24 |
| Stego | `Run` | 1.000 | 48 | 121 | 24 translation + 24 rotation | 24 |
| Brachio | `Idle` | 8.000 | 70 | 961 | 35 translation + 35 rotation | 35 |
| Brachio | `Walk` | 3.800 | 70 | 457 | 35 translation + 35 rotation | 35 |
| Brachio | `Run` | 2.500 | 70 | 301 | 35 translation + 35 rotation | 35 |

**The official clips carry no scale channels.** Every channel is translation or
rotation; the third channel per bone in today's shipped files was synthesised by
the donor bake. That is a Phase 2 constraint, not a detail: see *Notes*.

For contrast, the shipped files carry one clip each: Stego `Waddle` 0.8 s with 72
channels (24 × translation/rotation/scale), Brachio `Waddle` 1.0 s with 105
(35 × three paths).

## AC-2 baseline — shipped GLBs' frame-0 displacement

This is the table the Phase 3 test must fail against, from
`displacementRows()` on the current `public/models/stego.glb` and
`brachio.glb`, both of which carry a clip named `Waddle`. Rows as printed by the
passing run, sorted by displacement; `Δ / rest` is the `FR-3` quantity, bounded
at 25 %.

**Stego — 22 of 24 bones over the 25 % bound.**

| Bone | Rest t (m) | Clip[0] t (m) | Δ (m) | Rest → parent (m) | Δ / rest |
|---|---|---|---|---|---|
| `Hips` | (0, 1.368, −0.2849) | (−0.0031, 0.7815, −0.4320) | 0.6047 | 1.3974 | 43.3 % |
| `TailTip` | (0, −0.3648, −0.6612) | (0, −0.1764, −0.2592) | 0.4440 | 0.7552 | 58.8 % |
| `Head` | (0, 0.2326, 0.5016) | (0, 0.0540, 0.1692) | 0.3773 | 0.5529 | 68.2 % |
| `RightFrontUpLeg` | (−0.2622, −0.2052, 0.3032) | (−0.1872, −0.1188, 0) | 0.3241 | 0.4503 | 72.0 % |
| `LeftFrontUpLeg` | (0.2622, −0.2052, 0.3032) | (0.1872, −0.1188, 0) | 0.3241 | 0.4503 | 72.0 % |
| `LeftFrontElbow` | (0.057, −0.4902, −0.2508) | (0.036, −0.2232, −0.0684) | 0.3240 | 0.5536 | 58.5 % |
| `RightFrontElbow` | (−0.057, −0.4902, −0.2508) | (−0.036, −0.2232, −0.0684) | 0.3240 | 0.5536 | 58.5 % |
| `Neck` | (0, −0.1368, 0.4788) | (0, −0.0360, 0.2160) | 0.2815 | 0.4980 | 56.5 % |
| `Tail` | (0, −0.0912, −0.3990) | (0, −0.2520, −0.2232) | 0.2382 | 0.4093 | 58.2 % |
| `LeftHindHock` | (0.0365, −0.3876, −0.1824) | (−0.0144, −0.2232, −0.0864) | 0.1971 | 0.4299 | 45.8 % |
| `RightHindHock` | (−0.0365, −0.3876, −0.1824) | (0.0144, −0.2232, −0.0864) | 0.1971 | 0.4299 | 45.8 % |
| `RightHindLeg` | (−0.0547, −0.5814, 0.0912) | (−0.0252, −0.4104, 0.0576) | 0.1768 | 0.5910 | 29.9 % |
| `LeftHindLeg` | (0.0547, −0.5814, 0.0912) | (0.0252, −0.4104, 0.0576) | 0.1768 | 0.5910 | 29.9 % |
| `LeftFrontLeg` | (0.0438, −0.3762, 0.0798) | (−0.0108, −0.2592, 0.0936) | 0.1298 | 0.3871 | 33.5 % |
| `RightFrontLeg` | (−0.0438, −0.3762, 0.0798) | (0.0108, −0.2592, 0.0936) | 0.1298 | 0.3871 | 33.5 % |
| `LeftHindUpLeg` | (0.2394, −0.1026, 0.0182) | (0.2052, −0.0072, 0) | 0.1030 | 0.2611 | 39.4 % |
| `RightHindUpLeg` | (−0.2394, −0.1026, 0.0182) | (−0.2052, −0.0072, 0) | 0.1030 | 0.2611 | 39.4 % |
| `LeftHindFoot` | (0.0182, −0.1938, 0.0456) | (0, −0.1044, 0.0324) | 0.0922 | 0.1999 | 46.1 % |
| `RightHindFoot` | (−0.0182, −0.1938, 0.0456) | (0, −0.1044, 0.0324) | 0.0922 | 0.1999 | 46.1 % |
| `Jaw` | (0, −0.0342, 0.1026) | (0, −0.0864, 0.0432) | 0.0791 | 0.1081 | 73.1 % |
| `Chest` | (0, −0.1368, 0.3648) | (0, −0.0900, 0.3060) | 0.0752 | 0.3896 | 19.3 % |
| `Spine` | (0, 0.0456, 0.3762) | (0, 0.0288, 0.3168) | 0.0617 | 0.3790 | 16.3 % |
| `RightFrontFoot` | (−0.0132, −0.1140, 0.0570) | (0, −0.0828, 0.0180) | 0.0517 | 0.1281 | 40.3 % |
| `LeftFrontFoot` | (0.0132, −0.1140, 0.0570) | (0, −0.0828, 0.0180) | 0.0517 | 0.1281 | 40.3 % |

**Brachio — 12 of 35 bones over the bound; the 11 sauropod-only bones are not
animated at all.**

| Bone | Rest t (m) | Clip[0] t (m) | Δ (m) | Rest → parent (m) | Δ / rest |
|---|---|---|---|---|---|
| `LeftFrontElbow` | (0.048, −1.728, −0.192) | (0.111, −0.688, −0.211) | 1.0419 | 1.7393 | 59.9 % |
| `RightFrontElbow` | (−0.048, −1.728, −0.192) | (−0.111, −0.688, −0.211) | 1.0419 | 1.7393 | 59.9 % |
| `Neck` | (0, 0.618, 0.492) | (0, −0.111, 0.666) | 0.7495 | 0.7899 | 94.9 % |
| `Chest` | (0, 0.450, 0.852) | (0, −0.277, 0.943) | 0.7332 | 0.9635 | 76.1 % |
| `TailTip` | (0, 0.012, −0.444) | (0, −0.544, −0.799) | 0.6597 | 0.4442 | 148.5 % |
| `Head` | (0, 0, 0) | (0, 0.167, 0.522) | 0.5476 | 1.0e−7 | 5.4e6 × |
| `RightFrontUpLeg` | (−0.600, 0, 0) | (−0.577, −0.366, 0) | 0.3670 | 0.6000 | 61.2 % |
| `LeftFrontUpLeg` | (0.600, 0, 0) | (0.577, −0.366, 0) | 0.3670 | 0.6000 | 61.2 % |
| `Tail` | (0, −0.420, −0.636) | (0, −0.777, −0.688) | 0.3608 | 0.7622 | 47.3 % |
| `Jaw` | (0, −0.090, 0.225) | (0, −0.266, 0.133) | 0.1989 | 0.2423 | 82.1 % |
| `Spine` | (0, 0.072, 0.822) | (0, 0.089, 0.977) | 0.1557 | 0.8251 | 18.9 % |
| `RightFrontLeg` | (−0.006, −0.672, 0.336) | (0.033, −0.799, 0.289) | 0.1413 | 0.7513 | 18.8 % |
| `LeftFrontLeg` | (0.006, −0.672, 0.336) | (−0.033, −0.799, 0.289) | 0.1413 | 0.7513 | 18.8 % |
| `RightFrontFoot` | (−0.006, −0.378, 0.030) | (0, −0.255, 0.056) | 0.1255 | 0.3792 | 33.1 % |
| `LeftFrontFoot` | (0.006, −0.378, 0.030) | (0, −0.255, 0.056) | 0.1255 | 0.3792 | 33.1 % |
| `RightHindLeg` | (−0.036, −1.350, 0.126) | (−0.078, −1.265, 0.178) | 0.1075 | 1.3563 | 7.9 % |
| `LeftHindLeg` | (0.036, −1.350, 0.126) | (0.078, −1.265, 0.178) | 0.1075 | 1.3563 | 7.9 % |
| `RightHindUpLeg` | (−0.636, 0.084, 0) | (−0.633, −0.022, 0) | 0.1063 | 0.6415 | 16.6 % |
| `LeftHindUpLeg` | (0.636, 0.084, 0) | (0.633, −0.022, 0) | 0.1063 | 0.6415 | 16.6 % |
| `LeftHindHock` | (0.006, −0.744, −0.198) | (−0.044, −0.688, −0.266) | 0.1016 | 0.7699 | 13.2 % |
| `RightHindHock` | (−0.006, −0.744, −0.198) | (0.044, −0.688, −0.266) | 0.1016 | 0.7699 | 13.2 % |
| `Hips` | (0, 2.460, −1.390) | (−0.010, 2.409, −1.332) | 0.0774 | 2.8254 | 2.7 % |
| `RightHindFoot` | (−0.006, −0.282, 0.066) | (0, −0.322, 0.100) | 0.0527 | 0.2897 | 18.2 % |
| `LeftHindFoot` | (0.006, −0.282, 0.066) | (0, −0.322, 0.100) | 0.0527 | 0.2897 | 18.2 % |
| `Neck5` | (0, −0.306, 0.432) | (0, −0.306, 0.432) | 6.7e−7 | 0.5294 | 0.0001 % |
| `Tail2` | (0, −0.240, −0.630) | (0, −0.240, −0.630) | 4.8e−7 | 0.6742 | 0.0001 % |
| `Neck3` | (0, −0.198, 0.588) | (0, −0.198, 0.588) | 4.5e−7 | 0.6204 | 0.0001 % |
| `Neck2` | (0, −0.072, 0.618) | (0, −0.072, 0.618) | 4.3e−7 | 0.6222 | 0.0001 % |
| `Tail3` | (0, −0.228, −0.600) | (0, −0.228, −0.600) | 3.0e−7 | 0.6419 | 0.0000 % |
| `Tail1` | (0, −0.258, −0.540) | (0, −0.258, −0.540) | 2.8e−7 | 0.5985 | 0.0000 % |
| `Tail4` | (0, −0.102, −0.648) | (0, −0.102, −0.648) | 2.7e−7 | 0.6560 | 0.0000 % |
| `Neck1` | (0, 0.180, 0.552) | (0, 0.180, 0.552) | 2.0e−7 | 0.5806 | 0.0000 % |
| `Neck7` | (0, −0.162, 0.390) | (0, −0.162, 0.390) | 1.6e−7 | 0.4223 | 0.0000 % |
| `Neck4` | (0, −0.300, 0.498) | (0, −0.300, 0.498) | 1.5e−7 | 0.5814 | 0.0000 % |
| `Neck6` | (0, −0.312, 0.390) | (0, −0.312, 0.390) | 1.2e−7 | 0.4994 | 0.0000 % |

Read together with the rig comparison, this is the defect in one line: the
shared 24 bones share a rest pose and then get dragged off it by a foreign clip,
while Brachio's own 11 bones (`Neck1`–`Neck7`, `Tail1`–`Tail4`) have no donor
channel at all and simply sit still at rest — a sauropod with a frozen neck and
tail under a walk cycle borrowed from a triceratops.

## Evidence paths

- `scripts/vendor/inspect-dino-clips.mjs` — the tool, committed.
- `.conductor/evidence/phase-1/stegosaurus-base.glb` — 1,888,076 B, official.
- `.conductor/evidence/phase-1/brachiosaurus-base.glb` — 2,803,752 B, official.
- `.conductor/evidence/phase-1/stego-module.glb`, `brachio-module.glb` — the
  uncompressed `size: 1.0` bakes the comparison used.
- `.conductor/evidence/phase-1/stego-report.json`, `brachio-report.json` — the
  full per-joint rig tables, clip facts and displacement rows quoted above.
- `.conductor/evidence/phase-1/probe-nodes.mjs`, `compare-matrix.mjs` — the
  throwaway probes that found and confirmed the matrix bug.

`.conductor/` is gitignored (`.gitignore:1`), so none of it enters the tree. The
two official files are large because they are not Draco-compressed; they are
never shipped, only read at bake time, so they are not an `NFR-2` cost.

## What the inspector does

`node scripts/vendor/inspect-dino-clips.mjs` with no arguments, per species:

1. Reads `.conductor/evidence/phase-1/<species>-base.glb`, failing with the exact
   `curl` line if absent rather than skipping.
2. Bakes the vendored module at `size: 1.0` with only its **colour** knobs —
   `size`, `plates`, `plateSize`, `tail`, `neck`, `head` are dropped so the
   module's own geometry defaults apply and no group scale is introduced — and
   writes the uncompressed GLB beside it. No Blender, no Draco.
3. Diffs the two rigs joint by joint by node name and prints the table plus a
   **MATCH / MISMATCH** verdict with the named bones outside the bounds. Joints
   absent on either side, parent-chain differences and rest-scale differences are
   reported separately (they would invalidate a verbatim graft even at zero
   translation delta).
4. Prints each official clip's name, duration, channel count, keyframe count and
   bone count, and the shipped GLB's per-bone frame-0 displacement.
5. Writes `<species>-report.json` beside the GLBs and exits **1** on MISMATCH.

Exportable for Phase 3's test: `readRig`, `localTransform`, `compareRigs`,
`displacementRows`, `clipFacts`, `readFloatAccessor`,
`quaternionAngleDegrees`, `bakeModuleGlb`, plus the `SPECIES` table and the
`MATCH_TRANSLATION_METRES` / `MATCH_ROTATION_DEGREES` bounds.

## Deviations

**The first MATCH/MISMATCH verdict this phase produced was wrong, and the bug
was in the tool.** Recorded here because a future reader will find the earlier
run in the terminal history and must not trust it.

- **Symptom:** first run, exit 1, `MISMATCH for stego, brachio`; every module
  joint reported translation `(0, 0, 0)`. Brachio's entire module column was
  zeros and its `Hips` row read "4.1080 m / 100 %".
- **Cause:** a glTF node carries **either** `translation`/`rotation`/`scale`
  **or** a column-major `matrix`. three's `GLTFExporter` writes bones as
  `matrix`; Polyfork's published files carry TRS. `readRig` read
  `node.translation` directly, so every baked bone read as zero — a total rig
  mismatch that did not exist.
- **Confirmation:** `probe-nodes.mjs` printed `Hips keys=matrix,name,children`
  for both `*-module.glb` files while the official files carried TRS keys.
- **Fix:** new exported `localTransform(node)` — TRS path unchanged; the matrix
  path takes translation from `m[12..14]`, scales from the column norms and the
  quaternion from the normalised upper 3×3 — with a docblock naming the trap.
  `readRig` now goes through it.
- **After the fix:** exit 0, `Verdict: MATCH` for both species, 24/24 and 35/35
  joints, and the independent check agreed at worst delta 0.0000 m / 0.000°.

No file outside the Touches was modified.

## Notes for the primary

1. **Phase 2 may graft verbatim.** Same joint names, zero rest TRS delta, same
   bone axes. The `getObjectByName(channel.nodeName)` lookup cannot miss, and a
   grafted quaternion means the same thing on the baked rig. Keep a loud failure
   on a missing bone anyway — it is `FR-2`'s guard against a future module
   change, and it is nearly free.
2. **Copy translation and rotation only.** The official clips have no scale
   channels (48 = 24 + 24, 70 = 35 + 35). `buildStegoWaddleClip` and
   `buildBrachioWaddleClip` today emit a `scale` track per bone, which is a
   donor-bake artefact; carrying that habit into the new bake would re-add
   channels the authored clips never had, and would re-scale bones the artist
   left alone. Drop the scale tracks rather than synthesising them at rest.
3. **Brachio's 11 extra bones come along for free.** The official Brachio clips
   already animate `Neck1`–`Neck7` and `Tail1`–`Tail4` (35 bones, 70 channels).
   Nothing needs inventing; today's file leaves them static precisely because the
   donor had none.
4. **For Phase 3:** the pre-track GLBs fail loudly — 22 of 24 Stego bones and 12
   of 35 Brachio bones are over 25 %, worst 148.5 % (`TailTip`) and 5.4e6 ×
   (`Head`, whose rest translation is `(0, 0, 0)` and whose
   `deltaFractionOfRestDistance` is therefore meaningless). Use
   `MATCH_TRANSLATION_METRES`-style absolute fallback where the rest distance is
   under ~1 mm, or the Brachio assertion will be vacuously satisfied by a
   division so large it always trips — either way it must be deliberate, not
   accidental. The 11 sauropod-only bones pass trivially today; that is correct
   and should not be asserted away.
5. **`NFR-2` watch item:** `Idle` is the expensive clip — 1081 keyframes × 24
   bones for Stego, 961 × 35 for Brachio — against `Walk` 289/457 and `Run`
   121/301. If the precache budget is tight, `Run` is the cheap one to keep and
   `Idle` is what costs; the spec's edge case (withdraw `Run`) may be backwards
   if `Idle` is what ships.
6. `pnpm format` is denied in this session; `pnpm verify`'s `format --check`
   covered the same ground and passed, and the only changed file is excluded
   from `oxfmt` regardless.
