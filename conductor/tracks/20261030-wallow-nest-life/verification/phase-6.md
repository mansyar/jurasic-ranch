# Phase 6 verification — Harness, motion, docs and PR

- **Track:** 20261030-wallow-nest-life
- **Phase:** 6 — Harness, motion, docs and PR
- **Date:** 2026-10-30
- **Branch:** feat/20261030-wallow-nest-life
- **Base:** `3c2c2a8`
- **Result:** PASS

## What was asked

- **FR-14** a dev-harness verb that calls a visit and a way to read visit state.
- **FR-15** reduced motion keeps the clips and settles the decoration.
- **FR-16** `&pause=1` freezes visits and a seeded run reproduces.
- **NFR-2 / NFR-4 / NFR-5 / NFR-6 / NFR-8** budgets, no new control, determinism,
  no flashing, coverage floor.
- **AC-14 … AC-18**.
- **P6.T4.1** four camera captures at 1280×800, at least one with an animal at a
  corner, attached to the PR with alt text.

## Commands

| Command | Result |
| --- | --- |
| `pnpm verify` | exit 0 — 58 files, 758 tests, lines 84.94 %, precache 63 entries 8,964.85 KiB, `dist clean` |
| `node .conductor/tools/capture-visits.mjs <url> <outDir> 9340` | exit 0 — seven PNGs written |

## Harness (P6.T1)

`callVisit(species)` routes through the same cooldown map and `startVisit` call
the tap uses, so the bridge cannot reach a state a finger cannot; it returns
`false` when refused rather than pretending. `getVisitState()` returns the
director's own snapshots — state, `secondsInState`, `secondsUntilVisit`,
`visitsStarted`, `arrivals`, corner, arrival radius and a **measured**
`distanceToCorner` — and `unknown` with nulls for an animal the director has not
registered yet. `stepUntilVisit(species, state, { extraFrames, maxFrames })`
advances fixed 1/60 s frames until the director reports the state, because
`step(n)` cannot reach a chosen mid-dwell frame; it stops paused, resolves
`{ frames, reached }`, and gives up with `reached: false` rather than hanging.

That last verb is what made the captures possible at all: `step(n)` cannot land
inside a four-second clip, and a screenshot taken whenever the approach happened
to finish would show whatever frame it happened to be on.

## Motion and determinism (P6.T2)

Reduced motion had a real hole: `updateDressing` never forwarded the flag, so a
tap sparkle kept animating under `prefers-reduced-motion` and AC-15 was false
until `SparkleReactions.update(dt, reducedMotion)` retired a burst in one frame.
The old docblock claimed the opposite and is superseded. Clips (walk, idle, the
mud roll) still play, because an animal stopping is not decoration.

Determinism is a test, not a claim: two seeded runs must produce identical
schedules and positions, and the test guards against passing vacuously.

## Docs (P6.T3)

| Doc | Change |
| --- | --- |
| `conductor/product.md` | roadmap gains the delivered line for this track |
| `conductor/product-guidelines.md` | the animals go where the things are; the tap is a delight, the timer is the route |
| `conductor/tech-stack.md` | wander ring as data, the visit director's three verbs, `SHIPPED_CLIP_NAMES` back to Idle + Walk and its ~2.2 MiB cost, `BESPOKE_CLIP_NAMES`, and why a bespoke clip is authored in Node and never in Blender |

## Captures (P6.T4.1)

Seven shots at 1280×800 into `.conductor/evidence/wallow-nest-life/after/`, the
dev panel hidden and the canvas unobstructed, taken over Chrome DevTools
Protocol by `.conductor/tools/capture-visits.mjs` (the desktop browser refuses to
capture a hidden window here and `--screenshot` returns a blank WebGL canvas).

Two passes, each on a fresh page, because the app carries state a capture must
not inherit: the walk setting persists in storage, and the sleepy cue fires after
ninety seconds without a pointer, which a long seek crosses.

| Shot | What it shows |
| --- | --- |
| `ranch.png` | Ranch POV, trio at rest — the everyday view, unchanged by this track |
| `nest.png` | Nest POV, trio at rest |
| `garden.png` | Garden POV, trio at rest; the wallow is at the frame's bottom-right edge |
| `sky.png` | Sky POV, trio at rest |
| `nest-trike.png` | Nest POV, Trike standing at its hay nest after `callVisit('trike')` |
| `sky-nest.png` | Sky POV, Trike at its hay nest (seek reached after 834 frames) |
| `sky-wallow-roll.png` | Sky POV, Stego at the wallow mid-roll, 120 frames into a 4 s dwell (seek reached after 741 frames) |

## The finding the pictures produced

The four cameras frame **spawns**, and the corners sit 5–6 m beyond them. So the
payoff happens at the edge of the frame or off it: the Trike's hay nest is
comfortably inside the Nest POV, the wallow sits at the Garden POV's bottom-right
corner, and from the Sky POV — which is framed for the whole ranch per FR-8 — a
visiting animal is around 80 px and reads small. Nothing here contradicts the
spec, and no test was weakened to make a picture work, but it is the honest gap
between "the animal goes somewhere" and "you can see it go". Recorded as a
follow-up in the PR rather than patched in this phase, because a camera that
frames a visit is a new camera, not a fix.

## Not claimed

- The mud ripple, the straw puff and the leaf drift are proven by tests and
  numbers, not by a picture: they are sub-second and a still cannot show them.
- The coos were not heard. They route through the existing `playFeedback` path
  and are asserted there, but this phase has no ears.

## Deviations

- `src/viewer/main.ts`, `src/ranch/ambient.ts` and `src/ranch/dressing.ts` joined
  this phase's Touches because the bridge needs the tap's cooldown map and the
  reduced-motion fix lives in the dressing/ambient pair. Recorded in `plan.md`.
- `tests/dev/reduced-motion.test.ts` and `tests/dev/visit-determinism.test.ts`
  are new files, also recorded in `plan.md`.
- `pnpm format` is denied to the sandboxed phase agent, so formatting was done by
  hand and then confirmed by the orchestrator running `pnpm format` and the gate.
