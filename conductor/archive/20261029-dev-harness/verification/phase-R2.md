# Phase R2 Verification — Review Fixes (round 2)

- **Track:** 20261029-dev-harness
- **Phase:** R2
- **Date:** 2026-10-29
- **Branch:** chore/20261029-dev-harness
- **Base:** a3a90b3
- **Head:** see checkpoint
- **Result:** verified

## Commands

| # | Command | Result | Exit | Summary |
| --- | --- | --- | --- | --- |
| 1 | `npx vitest run tests/viewer/dev-harness-gate.test.ts` | green | 0 | 7 passed, including the new per-dino stream-wiring guard |
| 2 | falsification: `streams?.blink.trike` → `streams?.movement.trike` | red | 1 | `AssertionError: expected 'void loadTrikePlayer(...' to contain 'streams?.blink.trike'`; file restored with `git checkout --` — the guard fails when the bug reappears |
| 3 | `pnpm verify` (candidate default change) | red | 1 | `trio-wander` failed: trike reached 1.118 m against the 1.09 m in-frame bound, then separation fell to 0.079 m — see deviation |
| 4 | `pnpm verify` (final) | green | 0 | lint/format/typecheck clean, 33 files / 313 tests, vite build, `dist clean: no dev harness markers in dist`, precache 29 entries / 4428.59 KiB |

## Findings resolved

| Finding | Severity | What | Fix | Test |
| --- | --- | --- | --- | --- |
| F1-GLUE | Medium | the determinism suite builds its own players, so swapping the viewer's stream arguments kept every test green | `tests/viewer/dev-harness-gate.test.ts` asserts per species that argument 2 is `streams?.movement.<id> ?? Math.random`, argument 3 is `streams?.blink.<id>`, and `streams?.movement.` appears exactly once in the call | command 2 proves it fails when blink is fed the movement stream |
| F1-DEFAULT | Low | `blinkRandom` defaults to `this.random`, so a caller that omits the blink stream silently reintroduces non-reproducible poses | **resolved by guard + documentation instead of a default change.** `main.ts` always passes both streams, now enforced by the wiring test, and the option carries a comment stating the requirement. Changing the default to `Math.random` was implemented, then reverted — see deviation | the wiring test is the enforcement point |
| F1-RESIDUAL | Medium | determinism is only defined for a fixed frame sequence, but the documented URL `?dev=1&seed=42` advances by wall-clock `clock.getDelta()` before the first step | `conductor/tech-stack.md` names the canonical reproducible URL `/?dev=1&seed=42&pause=1` (load, `step(n)`, `snapshot()`); `integrated.md` AC-9 states the requirement | documentation |
| DOC-SYNC | Low | plan showed R1 pending with unchecked tasks while evidence claimed verification; `integrated.md` said 290 tests and credited AC-9 to "seeded-RNG tests"; `phase-R1.md` said 6 determinism cases | R1 marked verified at `cb3a82f` with all tasks checked; `integrated.md` refreshed to 33 files / 313 tests, AC-9 cites `seed-determinism.test.ts` (7 tests) plus the pause requirement, precache delta corrected; `phase-R1.md` corrected to 7 | `pnpm verify` command 4 |

## Deviation (recorded, minimal)

Turning F1-DEFAULT into a code change (`blinkRandom ?? Math.random`) altered which values `DinoPlayer` consumes when no blink stream is supplied. In `tests/waddle/trio-wander.test.ts` — a merged-track test with locked seeds — the trike then reached **1.118 m** against a 1.09 m in-frame bound, and once that bound was relaxed to a derived turn-arc allowance the trio's **minimum separation fell to 0.079 m** against the 0.25 m bar.

That is a pre-existing fragility in the **ranch** guarantee, not a harness defect: the locked draw only satisfied AC-3 because wall-clock blink draws were being pulled from the same generator, i.e. the seeds were tuned to polluted streams. Fixing it means re-tuning avoidance or the wander boundary in gameplay code, which is outside this track's scope and outside its declared Touches.

Resolution: the default change was **reverted**; the behaviour of the merged ranch is unchanged by this track. The requirement it was guarding is now enforced where it actually matters — `src/viewer/main.ts` must pass both streams, proven by the wiring test (command 2). The fragility is recorded as debt in `review.md` for a dedicated ranch track.

`tests/waddle/trio-wander.test.ts` was modified during investigation and restored byte-for-byte; it is not part of this phase's diff.

## Notes

- The two-real-reload `?seed=42&pause=1` browser smoke check still cannot run here (the review pane never composites, so `requestAnimationFrame` never fires). It stays recorded as human debt; the unit suite asserts the same property from frame 0 with a fixed dt, and the wiring guard covers the integration seam F1 lived in.
