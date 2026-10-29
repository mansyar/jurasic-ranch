# Phase R1 - Review Fixes

- **Track:** `20261029-authored-dino-walk-clips`
- **Phase:** R1 (Review Fixes, round 1)
- **Date:** 2026-10-30
- **Branch:** `fix/20261029-authored-dino-walk-clips`
- **Base:** `a95d8e8`
- **Head:** _set on squash_
- **Result:** verified

## What the review found

Round 1 blocked the track on one High: Phase 4 measured a stride on the baked
group at **authored** size and Phase 4 also drew the model at
`DINO_GROUP_SCALE` (0.5923), while `DinoPlayer` advances the root in **world**
metres. The shipped animals therefore covered less ground with their feet than
the root travelled:

| Species | Authored stride | Drawn scale | World foot travel / loop | Root travel / loop | Skid |
| --- | --- | --- | --- | --- | --- |
| Stego | 1.788 m / 2.4 s | 0.5923 | 1.0591 m | 1.788 m | **0.3037 m/s** |
| Brachio | 1.767 m / 3.8 s | 0.5923 | 1.0467 m | 1.767 m | **0.1896 m/s** |

Phase 4 certified floors of 0.0185 m/s (Stego) and 0.0517 m/s (Brachio) on the
unscaled rig. The shipped build skated 16x and 3.7x those floors, at 40 % of
walk speed. Every stride suite builds its own unscaled rig and the AC-3/AC-7
screenshots are stills, so nothing in the suite could see it.

## Fixes

### F1 (High) - the stride is applied at the group scale

`src/viewer/loaders.ts` exports `worldGait(gait, groupScale)` and applies it
inside `loadDinoPlayer`, so the conversion sits on the one path every species
takes. The Trike is scale 1 and returns the same object untouched.

| Species | World stride | World speed | Before |
| --- | --- | --- | --- |
| Trike | 0.29 m / 0.8 s | 0.3625 m/s | unchanged |
| Stego | 1.788 x 0.59233 = 1.0591 m / 2.4 s | 0.4413 m/s | 0.7450 m/s |
| Brachio | 1.767 x 0.59233 = 1.0467 m / 3.8 s | 0.2754 m/s | 0.4650 m/s |

The Brachio now genuinely walks slowest in world space (0.275 m/s against the
Trike's 0.3625), which is what the "cozy" brief wants and what the old
authored-metre numbers only appeared to say.

Slower speeds move the avoidance numbers, so they were re-derived rather than
left alone:

| Constant | Before | After | Why |
| --- | --- | --- | --- |
| `MAX_CLOSING_SPEED_METRES_PER_SECOND` | 1.21 | 0.804 | fastest pair is now Trike 0.3625 + Stego 0.4413 |
| `AVOIDANCE_TRIGGER_METRES` | 1.842 m | 1.639 m | body clearance 1.2372 + 0.804 x 0.5 s |

`tests/waddle/avoidance.test.ts` no longer pins a bare number: it recomputes the
two fastest world gaits and asserts the constant is their sum, so a stride or a
group-scale change has to move it.

### F2 (Medium) - the bake docs described clips that no longer ship

Corrected in `scripts/bake-trike-variant.js` (`selectShippedClips` now says it
accepts the published download "or an already-shipped GLB (Walk)"), in both
`scripts/vendor/bake-*-variant.js` (header says the shipped file carries
Polyfork's authored `Walk`, `Idle`/`Run` withdrawn; the `build*Clips` contract
says `Walk` only, one of the three; the channel lists say `Walk` (48/70) is
carried verbatim), and in both `bake-*-variant.py` docstrings.

### F3, F4 (Low) - two comments that contradicted their own code

`TRIKE_GAIT`'s docblock claimed bit-identical behaviour and then noted the
wander radius grew - but the radius is a field of that object, so the Trike's
path geometry changed 4.6x. Restated: the motion math is identical, the shared
stay-in-frame circle is not. The orphaned `POV_FOCUS_SPECIES` docblock that
argued for aiming at the ranch centre (the design Phase 5 replaced) was deleted.

### F5 (Low) - evidence pointed at the wrong tests

`verification/integrated.md`: FR-4 now cites `tests/waddle/trio-viewer.test.ts`
(in-game size per species) instead of the gait-constants suite, which never
touches the group scale; FR-7 cites `tests/ranch/dressing.test.ts` (the previous
path was not a file); FR-6 names the two wander suites instead of a glob that
matched nothing.

## Commands

| Command | Result |
| --- | --- |
| `pnpm format` | 67 files |
| `pnpm typecheck` | clean (required typing `worldSlide`'s parameter as `GaitParams`) |
| `pnpm test` | 36 files / **351 tests** pass (2 new coupling tests) |
| `pnpm verify` | exit 0 - 67 files formatted, 351 tests, lines **71.07 %** (1108/1559), precache 30 entries / **4,221.88 KiB**, `dist clean` |

## Acceptance

| Finding | Criterion | Result |
| --- | --- | --- |
| F1 | the shipped rig's feet do not skate | pass - both suites measure the scaled rig (`slideAt(v/S) x S`) and assert ≤ 0.03 m/s (Stego) and ≤ 0.07 m/s (Brachio) at the shipped stride, and > 0.15 / > 0.1 m/s without the conversion |
| F1 | the conversion cannot be forgotten | pass - it lives inside `loadDinoPlayer`, the only constructor path |
| F1 | avoidance numbers follow the speeds | pass - constant re-derived, trigger 1.639 m, test recomputes it from the gaits |
| F2 | the docs describe what ships | pass - six passages corrected; grep for `Idle` in the bake files now only appears as a withdrawal note |
| F3, F4 | no comment contradicts its code | pass |
| F5 | every requirement row cites a test that asserts it | pass |
| AC-9 | `pnpm verify` green | pass |

## Notes

- The stride constants stay in **authored** metres on purpose: they are what the
  clip was measured at, and the docblocks now say so. The conversion is one
  function with one call site, and the Trike returns early because its bake is
  the reference `S` was derived from.
- The scaling rule is asserted arithmetically and behaviourally but not visually:
  a still cannot show foot slide. The coupling test is the durable guard.
- `IN_FRAME_OVERSHOOT_METRES` (0.91) was left alone. Slower gaits produce smaller
  in-frame bounds, and `dressing.test.ts` recomputes all three from the gaits and
  still passes, so the margin is now conservative rather than exact - noted as
  debt rather than re-tuned in a review fix.
