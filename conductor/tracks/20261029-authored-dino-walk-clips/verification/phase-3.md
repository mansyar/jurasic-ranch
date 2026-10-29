# Phase 3 — Regression gate on bone displacement

- **Track**: `20261029-authored-dino-walk-clips` — "Stego and Brachio Walk on Their Own Bones"
- **Phase**: 3 of 6
- **Date**: 2026-10-29
- **Branch**: `fix/20261029-authored-dino-walk-clips`
- **Base commit**: `7ea192eb83d7010fd76e85802f66232e908760eb`
- **Head commit**: `c4d4434` — the gate and its declaration file; this evidence file follows in its own commit

## Result

**verified.** The gate exists, it passes against the shipped GLBs, and it fails
against the pre-track ones for the defect it names — not for an incidental
reason.

| Run | Directory | Tests | Exit |
|---|---|---|---|
| Shipped | `public/models` | 4 passed (4) | 0 |
| Pre-track `1a96d6b` | `.conductor/evidence/phase-3` | 4 failed (4) | 1 |

Against the pre-track files the *displacement* assertion fails on the real
numbers: **22 of 24 Stego bones** and **12 of 35 Brachio bones** are outside
25 % of their rest offset, worst Brachio `TailTip` at 148.5 %, plus Brachio
`Head` at 0.5476 m against a zero rest offset. Those counts and values are the
same ones Phase 1 measured independently, so the gate is reproducing the defect,
not a new one.

`pnpm verify` is green: 33 files / **324 tests** (was 32 / 320), lines
`71.63 % (1058/1477)` unchanged, precache `30 entries (6872.75 KiB)`, build clean.

## The gate

`scripts/check-dino-clips.test.ts` — four tests, two per species, driven by a
`describe.each` over a 24-joint and a 35-joint entry so a failure names the file
it came from.

**FR-3, per bone:** resolve the joint's rest translation from the skin and the
first keyframe of the walk clip's `translation` channel, then require
`|clip[0] − rest| ≤ 0.25 × |rest|`, where `|rest|` is that bone's rest distance to
its parent — the scale at which its position is meaningful.

Three bounds, each with a reason:

| Constant | Value | Why it is that value |
|---|---|---|
| `MAX_DISPLACEMENT_FRACTION` | 0.25 | `spec.md` Goal 1 / FR-3, verbatim |
| `MIN_REST_DISTANCE_METRES` | 1e-3 | below this the ratio is a rounding artefact |
| `MAX_ZERO_REST_DISPLACEMENT_METRES` | 1e-3 | the absolute fallback for a zero rest offset |

The fallback is the piece the brief insisted on, and the shipped files prove why.
Brachio `Head` rests **on its parent's origin**: its rest translation reads
1e-7 m, so the fraction is 100 % for a displacement of 0.1 µm. A bare ratio would
fail forever on noise in the re-baked file and pass vacuously on nothing. The
fallback bound sits four orders of magnitude above the shipped case and 548×
below the pre-track one:

| File | Brachio `Head` displacement | Against the 1 mm fallback |
|---|---|---|
| shipped (re-baked) | 0.0000 m (1e-7) | passes, 4 orders of margin |
| pre-track `1a96d6b` | 0.5476 m | fails, 548× over |

**Non-vacuity.** Before the envelope is applied the test asserts the file has a
skin, exactly 24 / 35 joints, a widest rest offset over 1 m, and one displacement
row per joint. A rig read that resolved nothing (the failure mode Phase 1 hit, when
`matrix` nodes read as zero translations) would otherwise pass every assertion in
the file.

**Clip identity.** The envelope measures `Walk` when the file carries it; a file
with a single clip under another name is measured anyway, so the defect is
reported as displacement rather than as a lookup error. The naming requirement is
its own test — `Walk` present, `Idle` and `Run` beside it, no `Waddle`, and `Walk`
at 2.4 s / 3.8 s within the export's float32 rounding (measured 2.4000001 s and
3.7999999 s). Nothing is excused by the fallback: the pre-track files fail
**both** tests, as the output below shows.

## Commands

| Command | Exit | Result |
|---|---|---|
| `git show 1a96d6b:public/models/stego.glb > .conductor/evidence/phase-3/stego.glb` | 0 | 95,684 B, the pre-track file |
| `git show 1a96d6b:public/models/brachio.glb > .conductor/evidence/phase-3/brachio.glb` | 0 | 119,252 B, the pre-track file |
| `pnpm test check-dino-clips` | 0 | 4 passed: shipped `stego.glb` / `brachio.glb` |
| `pnpm test --config .conductor/evidence/phase-3/vitest.pretrack.config.mts check-dino-clips` | 1 | 4 failed: pre-track `1a96d6b` GLBs |
| `pnpm typecheck` | 0 | `tsrs --noEmit`, no output — the `.d.mts` resolves |
| `pnpm test` | 0 | 33 files, 324 tests passed |
| `pnpm verify` | 0 | lint, format 66 files correct, typecheck, coverage `71.63 %` lines, build, `dist clean: no dev harness markers` |
| `pnpm format --check` | — | **permission denied** in this shell; `pnpm verify` runs the same check and passed |

Both runs are the *same file and the same assertions*; only `DINO_CLIPS_DIR`
differs. `pnpm test` cannot take an environment assignment and a command in one
shell statement here, so the pre-track run supplies the variable through a
throwaway vitest config in the gitignored evidence directory (see *Deviations*).

## AC-2

| Half of AC-2 | Requirement | Measured | Result |
|---|---|---|---|
| Fails against `1a96d6b` | the gate must report the defect | 22/24 Stego and 12/35 Brachio bones over the bound; 4 of 4 tests fail | **met** |
| Passes against the re-baked files | no bone over the bound | 0 bones over, 4 of 4 tests pass | **met** |

### Failure output — pre-track `1a96d6b`

Trimmed to the failing entries; the full transcript is at
`.conductor/evidence/phase-3/pretrack-run.log`.

```text
 FAIL  scripts/check-dino-clips.test.ts > stego.glb bone displacement > keeps every walking bone inside 25 % of its rest offset (FR-3)
AssertionError: expected [ …(22) ] to deeply equal []

+   "Hips sits 0.6047 m off its rest offset (rest → parent 1.3974 m, 43.3 % of it, bound 0.3493 m)",
+   "TailTip sits 0.4440 m off its rest offset (rest → parent 0.7552 m, 58.8 % of it, bound 0.1888 m)",
+   "Head sits 0.3773 m off its rest offset (rest → parent 0.5529 m, 68.2 % of it, bound 0.1382 m)",
+   "RightFrontUpLeg sits 0.3241 m off its rest offset (rest → parent 0.4503 m, 72.0 % of it, bound 0.1126 m)",
+   …
+   "Jaw sits 0.0791 m off its rest offset (rest → parent 0.1081 m, 73.1 % of it, bound 0.0270 m)",
+   "LeftFrontFoot sits 0.0517 m off its rest offset (rest → parent 0.1281 m, 40.3 % of it, bound 0.0320 m)",

 FAIL  scripts/check-dino-clips.test.ts > brachio.glb bone displacement > keeps every walking bone inside 25 % of its rest offset (FR-3)
AssertionError: expected [ …(12) ] to deeply equal []

+   "LeftFrontElbow sits 1.0419 m off its rest offset (rest → parent 1.7393 m, 59.9 % of it, bound 0.4348 m)",
+   "Neck sits 0.7495 m off its rest offset (rest → parent 0.7899 m, 94.9 % of it, bound 0.1975 m)",
+   "Chest sits 0.7332 m off its rest offset (rest → parent 0.9635 m, 76.1 % of it, bound 0.2409 m)",
+   "TailTip sits 0.6597 m off its rest offset (rest → parent 0.4442 m, 148.5 % of it, bound 0.1110 m)",
+   "Head sits 0.5476 m off its rest offset (rest → parent 0.0000 m, zero rest offset, bound 0.0010 m)",
+   "Jaw sits 0.1989 m off its rest offset (rest → parent 0.2423 m, 82.1 % of it, bound 0.0606 m)",
+   …

 FAIL  … > ships the authored Walk clip at its published length, beside Idle and Run (FR-1)
AssertionError: expected true to be false   // byName.has('Waddle')

      Tests  4 failed (4)
```

The Brachio list is exactly the 12 bones Phase 1 measured. The other 23 are not
exempt: the pre-track bake wrote channels for all 35 joints (its `Waddle` carried
35 translations, 35 rotations and 35 scales) and held the 11 sauropod-only bones
(`Neck1`–`Neck7`, `Tail1`–`Tail4`) motionless at rest, so they pass trivially —
correctly, and Phase 1 flagged that they must not be asserted away. In the
re-baked file all 35 are driven by the authored clip and all 35 stay inside the
envelope.

### Passing run — shipped GLBs

```text
$ vitest run check-dino-clips

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

Worst displacement in the shipped files, from the same reader:

| Species | Bone | Displacement | Rest → parent | Fraction | Bound |
|---|---|---|---|---|---|
| Stego | `Hips` | 0.0987 m | 2.3289 m | 4.2 % | 0.5822 m |
| Brachio | `Hips` | 0.0523 m | 4.1080 m | 1.3 % | 1.0270 m |
| Brachio | `Head` | 0.0000 m | 0.0000 m | — | 0.0010 m (absolute) |

Every other bone sits exactly on its rest offset at frame 0. The Stego's rest
offsets grew from the pre-track file's (its `Hips` rest distance was 1.3974 m,
now 2.3289 m) because Phase 2 baked at authored proportions instead of the old
group scale; the bound scales with it by construction.

## Evidence paths

- `scripts/check-dino-clips.test.ts` — the gate, committed in `c4d4434`.
- `scripts/vendor/inspect-dino-clips.d.mts` — the declaration file, same commit.
- `.conductor/evidence/phase-3/stego.glb`, `brachio.glb` — the pre-track files,
  95,684 B and 119,252 B, straight out of `1a96d6b`.
- `.conductor/evidence/phase-3/pretrack-run.log` — the failing transcript.
- `.conductor/evidence/phase-3/shipped-run.log` — the passing transcript.
- `.conductor/evidence/phase-3/vitest.pretrack.config.mts` — the throwaway config
  that supplies `DINO_CLIPS_DIR`; it changes no assertion.
- `.conductor/evidence/phase-3/README.md` — how the two GLBs were fetched.

`.conductor/` is gitignored, so none of the evidence enters the tree.

## Deviations

1. **`scripts/vendor/inspect-dino-clips.d.mts` added, outside `Touches`.**
   `tsconfig.json` has no `allowJs`, so a TypeScript test cannot import the `.mjs`
   inspector without a declaration file; the repo already does exactly this for
   `bake-stego-variant.d.ts` / `bake-brachio-variant.d.ts`. It declares only the
   three functions the gate uses and names the rest, so a later phase extends it
   rather than guessing. Without it `pnpm typecheck` fails on `TS2307`.

2. **`scripts/vendor/inspect-dino-clips.mjs` was not modified.** It was in
   `Touches` as a place helpers could be extracted from, but every helper the gate
   needs (`readRig`, `clipFacts`, `displacementRows`) was already exported, and
   the file already carries the `matrix` handling that a copy in the test would
   have had to duplicate. No edit was needed, so none was made.

3. **The historical run reaches the gate through a throwaway vitest config, not
   a shell prefix.** `pnpm test` and the env assignment cannot be one command in
   this shell (no `;` chaining), and the brief forbids working around that with a
   wrapper. The config lives in the gitignored evidence directory and only sets
   `test.env.DINO_CLIPS_DIR`; the gate's own code path is identical in both runs.
   The committed default stays `public/models`.

4. **`pnpm format --check` is denied in this shell** even though the brief listed
   it. `pnpm verify` runs the same `oxfmt --check` step and reports all 66 files
   correctly formatted, so the formatting gate is covered.

5. **Evidence transcripts are CP1252-mangled for two glyphs.** PowerShell's `>`
   redirect wrote `pretrack-run.log` in the console code page, so `→` and `…`
   appear as `ΓåÆ` / `ΓÇª` inside the log. The measurements are unaffected and the
   clean text is quoted above.

## Notes for the primary

1. **No production code was touched.** `public/models/stego.glb` and
   `brachio.glb` are unchanged at 1,412,000 B and 2,331,836 B.
2. **Test count moved 320 → 324**, 32 → 33 files. Coverage lines are unchanged
   at `71.63 % (1058/1477)`; statements read `1082/1509`.
3. **Phases 4 and 6 can now lean on this file.** The env var makes any future
   bake measurable without editing an assertion, and the 25 %-with-millimetre-floor
   shape is the one `spec.md` asks for, so a threshold change is a spec change.
4. **`NFR-2` unchanged.** Neither log nor the declaration file enters the build;
   the precache stays at `30 entries (6872.75 KiB)`.
