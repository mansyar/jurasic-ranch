# Phase 2 — The ring becomes a place

Status: **verified**. `pnpm verify` exits 0 on the tree described here.

Covers FR-3, AC-3. Branch `feat/20261030-wallow-nest-life`, phase base
`3ebcecd78eef7db5d4532da3b30450c5c009912c`, head
`cd79a3eb8c382d2e3fdc38aab0d951435ef56e09` (task commits `475af64`,
`cd79a3e`).

## 1. What changed

`src/ranch/dino-player.ts` only:

- `steerInsideWanderRadius()` measures from the player's own ring centre:
  `const x = this.model.position.x - this.ringCentreX` (same for `z`), then
  `Math.hypot(x, z)` and `Math.atan2(-x, -z)`. Subtracting the centre **into the
  local** is the brief's order of operations, so with the default centre the
  subtraction is `p - 0`, which is exact for every finite `p` — the steering
  test, the home heading and the jitter draw are bit-identical to before.
- `setWanderRing(centre, radius)` sets the three fields; `get wanderRing()`
  returns a fresh `{centre: {x, z}, radius}` (the effective ring, so a test or
  the dev harness reads it without a private field).
- New exported types `WanderCentre` (`{x, z}`) and `WanderRing`
  (`{centre, radius}`).
- The default radius is the gait radius, snapshotted in the constructor right
  after `this.gait` is assigned. Every shipped gait is a module constant, so this
  is the same number per frame as reading `this.gait.wanderRadiusMetres`; it
  also removes the per-frame branch the override would otherwise need.

Untouched, deliberately: the `remaining >= TURN_ALIGN_RADIANS` early return (a
ring enforced mid-turn would yank the animal), the single `this.random()` draw
per steer and its position in the function, `TURN_ALIGN_RADIANS`,
`WANDER_STEER_JITTER_RADIANS`, and every `GaitParams` constant (`TRIKE_GAIT`,
`STEGO_GAIT`, `BRACHIO_GAIT` are byte-identical, so `src/ranch/ground.ts`'s worn
discs do not move). No visit concept was added.

## 2. AC-3 proof — the default ring is today's circle, to 1e-9

The numbers below were **recorded from the unmodified player at the phase base**
(`3ebcecd`) with a temporary probe in `tests/waddle/dino-player.test.ts`, run
before `src/ranch/dino-player.ts` was touched; the probe was then replaced by the
assertion that pins them. The run: Trike gait, spawn at the world origin, walking
from frame 0, 60 s at 1/60 s, `seededRandom(0x51ee)` for wander + dust and
`seededRandom(0xb1a2c)` for blinks (separate streams, as `src/viewer/main.ts`
wires them).

| t (s) | x | z |
| --- | --- | --- |
| 1 | 0 | 0.32927083333333335 |
| 2 | 0 | 0.69177083333333167 |
| 5 | 0 | 1.7792708333333360 |
| 10 | 0 | 3.5917708333332943 |
| 20 | -0.55008121422701250 | 1.0843760364497754 |
| 30 | -1.8521648132890887 | -2.2986999752670219 |
| 40 | -0.51855034531869471 | -1.4250202086968915 |
| 50 | 1.5107235709481892 | 1.5787561432905279 |
| 60 | 1.4059488656971091 | 1.8475159936385848 |

Whole-run scalars from the same capture: max radius **3.9384440842210675 m**
(the gait circle is 3.7117 m, so it reaches the rim and overshoots by 0.227 m),
final heading **-2.6991812750673865 rad**.

`tests/waddle/dino-player.test.ts` asserts, after the change:

- all nine checkpoints with `toBeCloseTo(golden, 9)` (tolerance 5e-10, i.e.
  tighter than the 1e-9 the criterion asks for), for both `x` and `z`;
- `expect(compared).toBe(GOLDEN_WANDER_POSITIONS.length)` — the nine comparisons
  actually ran, so the pin cannot pass by sampling nothing;
- max radius and final heading to the same 1e-9.

The first ten seconds are `x === 0` exactly, which is the useful part: from the
origin at heading 0 the animal walks straight up +Z, so any accidental offset in
the ring centre would show up as a non-zero `x` there. The steering itself is
exercised from ~10.5 s (radius 3.7117 m reached at 0.3625 m/s), so the golden
also pins the frame on which the steer draws its jitter: a shifted draw moves
every checkpoint after t = 10.

A second test pins the same claim from the other side: two players on identical
seeded streams, one with no ring set and one with
`setWanderRing({x: 0, z: 0}, TRIKE_GAIT.wanderRadiusMetres)` called explicitly,
must agree **exactly** (`toBe`, not `toBeCloseTo`) in `x`, `z` and heading after
60 s. That is the property Phase 4 needs: handing a player its home ring cannot
change what it does.

## 3. P2.T2.2 — an overridden ring holds the animal

`tests/waddle/dino-player.test.ts`, 60 s at 1/60 s, ring centre `(5, -3)`, radius
1.5 m, animal started 0.4 m from the centre:

- max distance from the ring centre is `> radius - 0.3` (it roams out to its own
  rim) and `<= 2.27066 m`. That ceiling is the trio test's overshoot bound for
  the Trike: `radius + speed * (PI / yawRate + WALK_BLEND_SECONDS)` with
  speed `0.29 / 0.8 = 0.3625 m/s`, `yawRate = min(PI, 4.5 * 0.3625) = 1.63125`,
  blend `0.2 s` → `1.5 + 0.77066`.
- min distance from the **world origin** over the last 30 s is `> 3.7117 m`: the
  whole override ring lies outside the default circle (nearest point 5.831 −
  1.5 = 4.331 m), so an animal still steering at the origin would have been
  pulled home and could not hold that.

`tests/waddle/trio-wander.test.ts` asserts the default ring for all three shipped
gaits (`worldGait`-scaled stride, own `wanderRadiusMetres`): centre `(0, 0)`,
radius `DINO_WALK_RADIUS_METRES` for Trike, Stego and Brachio.

## 4. Verification

```
pnpm verify
```

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| lint | `oxlint --ignore-pattern "scripts/vendor/**"` | 0 | clean |
| format | `oxfmt … --check` | 0 | 100 files, correct format |
| typecheck | `tsrs --noEmit` | 0 | clean |
| unit + coverage | `vitest run --coverage` | 0 | 54 files, **683 tests passed**; lines 84.18 %, branches 68.58 %, functions 85.74 %, statements 84.17 % (floor 60 %); `src/ranch/dino-player.ts` **100 % statements / 100 % lines**, 98.61 % branches |
| audio | `node scripts/check-audio-pack.mjs` | 0 | 15 assets (1 music, 6 sfx, 8 voice), 853,289 bytes |
| build | `vite build` | 0 | 42 modules; `index-ye90AkkT.js` 706.70 kB (gzip 184.88); precache 63 entries (8,914.59 KiB) |
| dist | `node scripts/check-dist-clean.mjs` | 0 | no dev harness markers in dist |

Targeted runs during the phase: `pnpm test tests/waddle/dino-player.test.ts
tests/waddle/trio-wander.test.ts` → 2 files, 40 tests passed.

| AC | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-3 | A player with no visit active wanders inside the gait radius around the world origin, and a 60 s seeded run reproduces today's positions to 1e-9 | §2 — nine checkpoints, max radius and final heading, all at 5e-10 | met |

## 5. Deviations

None. Every edit is inside the phase's Touches
(`src/ranch/dino-player.ts`, `tests/waddle/dino-player.test.ts`,
`tests/waddle/trio-wander.test.ts`); no gait constant, no `ground.ts`, no
`plan.md`/`spec.md`/`metadata.json`/`tracks.md`.

## 6. Notes for the primary

- **A draft trio-level AC-3 test was dropped.** The first `pnpm verify` run of
  this phase failed on the existing test `keeps all three in-frame over 30 s and
  clear of each other` with `Test timed out in 5000ms` (7,217 ms under coverage,
  54 workers spawned). That run also carried a tenth draft test comparing two
  full 30 s trio sims, i.e. two extra heavy sims in the same file. The draft was
  removed and the steer path made branch-free; the re-run passed with the
  file's test count and timing back to its pre-phase shape. This is the same
  5 s-default pressure Phase 1 recorded for `brachio-pastel.test.ts` — the
  suite's heavy sims sit near the default timeout under coverage, so a future
  phase that adds sims to `trio-wander.test.ts` should budget for it.
- **Sandbox limits.** `git log <range>`, `git log --format=…` and
  `pnpm vitest run …` were refused by the permission layer; the SHAs above come
  from the brief and `git rev-parse HEAD`, and every check ran through the
  configured `pnpm verify` / `pnpm test` commands.
- **Phase 4 handover.** `setWanderRing(centre, radius)` is the only new state;
  there is no clear/reset. Coming home is `setWanderRing({x: 0, z: 0},
  player.wanderRing.radius)`-equivalent, or a second setter call with the home
  anchor — no reset verb was added because nothing in this phase needs one.
- The radius is snapshotted from the gait at construction, so mutating a
  `GaitParams` object *after* a player is built no longer moves its ring. No call
  site does that; it is called out because it is the one semantic difference
  from reading `this.gait.wanderRadiusMetres` per frame.

## Primary verification

Run by the orchestrating agent at the phase squash, independent of the phase
agent's report.

| Check | Command | Result |
| --- | --- | --- |
| Full gate | `pnpm verify` | exit 0 - 54 files / 683 tests, precache 63 entries 8,914.59 KiB, dist clean |
| Touches | `git diff --name-only 3ebcecd..HEAD` | exactly the three Touches files plus the evidence file; no widening |
| AC-3 inertness | `src/ranch/dino-player.ts:486-495` | the centre is subtracted into locals before `Math.hypot(x, z)` and `Math.atan2(-x, -z)`, so centre `(0,0)` runs the same float ops in the same order as before |
| AC-3 evidence | `tests/waddle/dino-player.test.ts` | 60 s seeded trajectory recorded from the pre-FR-3 player at `3ebcecd`, nine checkpoints at 5e-10, max radius 3.9384440842210675, final heading -2.6991812750673865; a home ring set explicitly is `toBe`-identical to no ring |

### Cost

Nothing measurable: precache moved 8,914.29 -> 8,914.59 KiB, which is the code
itself. The steer path is branch-free now, and the seeded draw count is
unchanged, which is what let the 5e-10 pin hold.

### Note for Phase 4

There is no ring reset verb. Coming home is a second `setWanderRing` call with
the animal's home anchor, and the ring radius is snapshotted from the gait at
construction. Phase 4 should treat the home ring as data it owns rather than
expecting the player to remember it.
