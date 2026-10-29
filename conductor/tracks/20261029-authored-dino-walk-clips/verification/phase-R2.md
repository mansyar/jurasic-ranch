# Phase R2 - Review Fixes, Round 2

- **Track:** 20261029-authored-dino-walk-clips
- **Branch:** `fix/20261029-authored-dino-walk-clips`
- **Base:** `fe7bd89`
- **Head:** _set after squash_
- **Result:** verified - round 1's High is confirmed closed, and the one Medium round 2 raised (the fix had no test observing the production call site) is now guarded by a test that fails without it.

## Round 2 findings

| ID | Severity | Finding | Fix |
| --- | --- | --- | --- |
| F2.1 | Medium | `src/viewer/loaders.ts:195` had no test. Every regression guard called `worldGait` itself, so deleting the wrapper restored the round-1 High (0.304 m/s Stego skid) and the suite stayed green. | `tests/waddle/trio-viewer.test.ts` "world stride at the loader boundary" loads the shipped player through the mocked GLTFLoader, walks it, and times the root against summed per-frame path length. Two tests: Stego 0.4413 m/s, Trike 0.3625 m/s. |
| F2.2 | Low | `BRACHIO_GAIT`'s docblock claimed the yaw cap binds, but at the shipped 0.2754 m/s the curvature binds (4.5 x 0.2754 = 1.24 rad/s under the 1.8 cap), so the shipped 90 deg arc takes ~1.27 s + ramp, not ~0.87 s. | Docblock states both arcs; `brachio-gait.test.ts` gained a shipped-gait player and an arc test asserting 1.2 s < elapsed < 1.8 s, while the existing authored-arc test's comment now says which gait it exercises. |
| F2.3 | Low | `tests/waddle/trio-wander.test.ts` claimed to "mirror the viewer frame loop" but built players from the authored gaits, running 1.69x faster than production, and its separation comment still quoted the retired 1.21 m/s closing rate. | The sim now runs `SIM_GAITS` (`worldGait` for all three); the comment names the world pair (0.804 m/s against a 1.639 m trigger). |
| F2.4 | Low | `verification/integrated.md` still carried the pre-review gate figures and an FR-6 row citing three files of which none asserted the trigger. | Gate rows updated to the post-fix run; FR-6 also cites `tests/waddle/avoidance.test.ts`, and a "Review fixes (R1 + R2)" section records both rounds. |

## Probe: the new guard actually bites

Removing the conversion at the call site (`gait: worldGait(gait, groupScale)` -> `gait`) and running only the new suite:

```
tests/waddle/trio-viewer.test.ts (28 tests | 1 failed)
AssertionError: expected 0.7450000000000029 to be close to 0.4413, 2
  received difference is 0.30370000000000286, but expected 0.005
Tests  1 failed | 27 passed (28)
```

0.745 m/s is the authored stride playing on a 0.592x group: exactly the 0.3037 m/s of skate round 1 measured. `src/viewer/loaders.ts` was restored immediately after the probe (`git checkout --`), and `worldGait(gait, groupScale)` is back at line 195.

## Commands

| Command | Result |
| --- | --- |
| `pnpm exec vitest run tests/waddle/trio-wander.test.ts` | 7 passed - the sim runs the shipped gaits and still clears the 0.25 m bar |
| `pnpm exec vitest run tests/waddle/brachio-gait.test.ts` | 9 passed - authored arc < 1.2 s, shipped arc 1.2-1.8 s |
| `pnpm exec vitest run tests/waddle/trio-viewer.test.ts` | 28 passed with the call site intact; 1 failed with it removed (probe above) |
| `pnpm format` | 67 files, all correct |
| `pnpm verify` | **exit 0** - format clean, 36 files / **354 tests**, lines **71.07 %** (1108/1559), precache 30 entries (4,221.88 KiB), `dist clean: no dev harness markers` |

## Acceptance

| Item | Status |
| --- | --- |
| Round 1 F1 (High) closed and guarded | pass - `worldGait` on the single constructor path plus a test that walks the loaded player; probe proves it fails without the call |
| Round 1 F2-F5 closed | pass - confirmed by the round-2 reviewer against the source, not the evidence file |
| Round 2 F2.1-F2.4 closed | pass |
| New tests are not tautologies | pass - the loader-boundary test never imports `worldGait`, and the shipped-arc test asserts a window the authored gait cannot reach |
| `pnpm verify` green | pass - exit 0 |

## Notes

- The loader-boundary test sums per-frame path length rather than net displacement, so a wandering curve cannot make it read short; the 0.2 s blend ramp is skipped by a one-second warm-up before the measured window.
- Speeding the trio-wander sim down to the shipped gaits did not weaken it: avoidance still fires, the 0.25 m bar holds, and the differential no-avoidance draw still comes closer. The sim is now the configuration the child actually sees.
- `IN_FRAME_OVERSHOOT_METRES` stays at 0.91. Round 2 confirmed it is still an upper bound (world overshoots fall to 0.770 / 0.530 / 0.753 m) and that `dressing.test.ts` evaluates the stricter authored gaits, so the clearance is conservative rather than wrong. Left as recorded debt rather than re-tuned.
