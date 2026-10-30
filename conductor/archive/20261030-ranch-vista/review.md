# Review

- Track: `20261030-ranch-vista` — Ranch Vista: Staged Paddock and Sky POV
- Reviewed at: `a12515e`
- Reviewer: read-only subagent, against spec, plan, evidence, captures and the TypeScript style guide
- Verdict: **BLOCK** on the first pass, **PASS WITH FINDINGS** after the fix round
- Rounds: 1

## What the reviewer said

The layout-as-data refactor, the ground and sky maths, and the occlusion /
frame-edge / sky-coverage kits were judged stronger than most tracks carry. The
block was two findings of the same species: a requirement whose test checked
something else.

## Findings and what happened to them

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| F1 | major | The sprig off-axis test compared a sprig's bearing from the ranch *origin* against a lens *forward* bearing — two reference frames — so it could not fail. Measured at the lens, the club-moss sat 5.5° and the wildflower 6.9° off their axes, inside FR-6's ±18°. | Fixed `f828842`: the assertion is now taken at the lens, and both sprigs moved (100° → 130°, 285° → 320°), clearing 25° and 20°. |
| F2 | major | AC-1 said "fully inside the HUD-safe area"; the test only checked the head's top edge at the nearest walk stance. At the Brachio's nearest stance its paws sat behind the Walk button. | Fixed `6c15e3f` + recorded: a sweep of the whole FR-7 box found no legal fit (the Brachio spans 727 px of an 800 px frame), so the Nest lens moved to the window's far end and the two remaining overflows are pinned in `WALK_STANCE_OVERFLOW_PX` and written into AC-1. |
| F3 | medium | AC-8's draw-call figure was arithmetic (`manifest + 3`), omitting sky, ground, dinos and particles, and the evidence printed it as the frame. | Fixed `110889d`: `snapshot()` now reads `renderer.info.render`, and the evidence says "dressing group" where it means it. |
| F4 | medium | FR-6 was enforced more softly than written: three mid-band height exceptions, the cap applied only to new props, and the rhyme exemption only inside a test. | Fixed `e43b935` + spec amended: FR-6 now names the three exceptions, scopes the cap to this track's props, and records the FR-16 carve-out. |
| F5 | medium | AC-13's "clear approach ≥ 72 px" was measured nowhere. | Fixed `4179b50`: one rect-versus-rect assertion per corner in its own preset. |
| F6 | medium | The windpump rotor was looked up *after* the bake that erased it, so a mesh rotor vanished and the fallback fan stood in front of stationary baked blades. | Fixed `02918de`: the fan is found before the bake and baked inside its own node; the test reads the real GLB's node names. |
| F7 | medium | Phase 6 said pending while its captures and doc sync had landed. | Fixed `f090cf9`: P6.T1 and P6.T2 ticked, P6.T3 left open until the PR. |
| F8 | low | `hudOwnsPointer` could never be true — the listener sits on the canvas, so a HUD click never reaches it. | Fixed `22d5c3f`: flag and its two test cases deleted. |
| F9 | low | The shipped-placement snapshot held the ginkgo at its post-move position with no comment, and the fixture said "the one deliberate break" while two props moved. | Fixed `22d5c3f`: both moves annotated, the test name says ten of twelve. |
| F10 | low | The `loop.ts` dressing hook was labelled FR-18 only, though it advances sway and sparkles, and the new imports broke the file's alphabetical blocks. | Fixed `22d5c3f`: relabelled FR-11/12/18 and re-sorted. |

## Requirements coverage

Every FR, NFR and AC in the spec is traced to an implementation and a test in
`verification/integrated.md`. Three are recorded rather than fully green, and
all three are written into the spec where a reader will find them: FR-2 (two
shipped props moved), FR-6 (three named height exceptions and the rhyme
carve-out) and AC-1 (the nearest-stance crop).

## Residual limits carried into the PR

1. AC-1 at the nearest walk stance — measured, pinned, recorded.
2. The Sky frame at 2.4:1 aspect reaching ~3 m past the meadow edge.
3. The sky's horizon tone authored to match rather than measured.
