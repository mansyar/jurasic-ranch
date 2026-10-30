# Phase 4 verification — The visit

| Field | Value |
| --- | --- |
| Track | `20261030-wallow-nest-life` |
| Phase | 4 (P4.T1–P4.T4) |
| Date | 2026-10-30 |
| Branch | `feat/20261030-wallow-nest-life` |
| Base | `3014659490071faed5314fa5857b529800d7196d` |
| Head | `f1e559c` (`ac976bf`, `5c87e16`, `a9f0202`, `68f026f`, `f1e559c`; the Rework 1 docs commit follows it) |
| Result | verified — `pnpm verify` exit 0 |

Covers FR-4, FR-5, FR-9, FR-11, AC-4, AC-5, AC-9, AC-11.

## Commands

| Command | Exit | Numbers it printed |
| --- | --- | --- |
| `pnpm verify` | 0 | `oxlint` clean; `oxfmt --check` 103 files "All matched files use the correct format"; `tsrs --noEmit` clean; `vitest run --coverage` 54 files / 706 tests passed; statements 84.46 % (2752/3258), branches 69.05 % (837/1212), functions 86.02 % (468/544), lines 84.47 % (2693/3188); audio pack ok 15 assets (1 music, 6 sfx, 8 voice) 853,289 B; `vite build` `dist/assets/index-a99FMjj_.js` 710.91 kB (gzip 186.40 kB); precache 63 entries (8961.75 KiB); `dist clean: no dev harness markers in dist` |
| `pnpm test tests/ranch/visit.test.ts` | 0 | 1 file, 24 tests passed (710 ms) |
| `pnpm test tests/ranch/visit.test.ts --reporter=verbose` | 0 | 23 tests (22 + one temporary timing probe, since removed); printed the state timings quoted below |

Coverage of the new and touched modules, from the same run: `src/ranch/visit.ts`
92.79 % statements / 80.95 % branches / 91.30 % functions / 92.59 % lines;
`src/ranch/layout.ts` 97.16 / 65.71 / 100 / 97.02.

## Requirement → proof

| Req | Proof |
| --- | --- |
| FR-4 (state machine, durations from distance + own walk speed, dwell from the clip) | `src/ranch/visit.ts` `VisitDirector.advance` switches over exactly `idle`/`approach`/`arrive`/`dwell`/`return`; `beginVisit` sets `approachSeconds = distanceToAnchor / gaitSpeedMetresPerSecond(gait)`; `visitCorner` derives `arrivalRadiusMetres = placeRadiusMetres + turnDriftMetres(gait) + speed * WALK_BLEND_SECONDS`, with `turnDriftMetres = speed * (radians / yawRate)`; `VISIT_DWELL_SECONDS` is the measured clip length at each corner. Tests: `walks <species> through idle → approach → arrive → dwell → return → idle` (one per species) asserts the observed state sequence equals `VISIT_STATE_ORDER`, `approachSeconds` equals `startDistance / speed` to 12 dp, the dwell lasts `dwellSeconds` ± 2 frames, and the home ring is restored exactly |
| FR-5 (each corner publishes anchor + arrival radius, animal faces the corner) | `CORNER_ANCHORS` in `src/ranch/layout.ts`: trike = hay-nest centre `HAY_NEST_CENTRE_METRES` at 64°/9.0 m, stego = `WALLOW_CENTRE_METRES` (mud centre, 214°/9.3 m), brachio = `BROWSE_TREE_FOOT_METRES` at 326°/9.1 m; each with `placeRadiusMetres` (half the largest prop's footprint, or the mud radius) and `facingRadians = atan2(x, z)` (outward). `visitCorner` turns those into the published `arrivalRadiusMetres` + `stopRadiusMetres`. Tests: anchors equal the wallow / hay-nest / browse-tree constants; the hay nest is pinned to the mean of the four bales and the browse tree to the plum placement; each anchor sits inside its corner frame (`< CORNER_FRAME_HALF_ANGLE_DEGREES`) and within `placeRadius + 0.5 m` of a corner prop; the three places stay apart; every anchor clears every ground lens sightline; arrival radius and facing are asserted per species to 12 dp; AC-5's "faces the corner" is measured on a real `DinoPlayer` (≤ 0.2 rad) |
| FR-9 (autonomous visit near 45 s, jittered, only while walking is on) | `VISIT_TIMER_BASE_SECONDS = 45`, `VISIT_TIMER_WINDOW_SECONDS = 3`, `VISIT_TIMER_SLOTS = {trike: -3, stego: 0, brachio: 3}`, jitter drawn from `createSeededStream(seed + 1001 + speciesIndex)`; the `idle` branch decrements only when `walking`. Tests: each countdown lies in `[base + slot, base + slot + window]` and the three differ; `update(DT, false)` for 120 s leaves every countdown byte-identical and every animal idle |
| FR-11 (avoidance keeps running on visit headings) | `loop.ts` calls `visit?.update(dt, hud.isWalking())` **before** the `steerTrioApart`/`steerPairApart` block, so the nudge is applied to the heading the director just set; `steerTrioApart` still only calls `turnTo` when a nudge is non-zero. Tests: the shipped trio walking out to two corners keeps a minimum pair separation of **3.5485 m** (≥ `PAIR_BODY_CLEARANCE_METRES` 1.23723) with both visits completing; three animals started 1.386 m apart are pushed apart to a minimum of **1.3696 m** with **69 nudged frames**, and all three still arrive |
| AC-4 (the five states in order, none skipped, every species) | one test per species (a `for` loop over `SPECIES`) asserting `seen` equals `['idle','approach','arrive','dwell','return','idle']`, plus the walking flags observed in each state `[true, true, false, true, false]` |
| AC-5 (stops inside the arrival radius, faces within 0.2 rad) | Per-species test on a real `DinoPlayer` with synthetic clips: rests within `arrivalRadiusMetres` of the anchor after the 0.2 s blend glides out, and `|wrapAngle(facing - heading)| ≤ 0.2` |
| AC-9 (each visits within 90 s of a seeded run; the three do not start in the same second) | Seed-42 run of three stubs: each species reaches `dwell` inside 90 s, and `new Set(floor(startSeconds)).size === 3` |
| AC-11 (two simultaneous approaches never drop below pair clearance) | The FR-11 tests above; the closest pair distance is measured only while both visits are out of `idle`, i.e. during transit |

## State timings derived (seed 42, stubs at the trio spawn)

| Species | Anchor (x, z) | Place / stop (m) | Arrival radius, shipped gait (m) | Walk speed (m/s) | Distance (m) | Approach (s) | Return (s) | Dwell (s) | Facing (rad) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| trike | (3.9453, 8.0891) | 1.02 | 1.7906 | 0.3625 | 5.8930 | 16.26 | 14.59 | 6 (Idle 6.000) | 0.4538 |
| stego | (−7.7100, −5.2005) | 1.25 | 1.7795 | 0.44129 | 5.6033 | 12.70 | 12.66 | 4 (MudRoll 4.000) | −2.1642 |
| brachio | (7.5442, −5.0887) | 0.705 | 1.4582 | 0.27543 | 5.4035 | 19.62 | 19.56 | 8 (Idle 8.000) | 2.1642 |

The viewer feeds the **world** gaits (`worldGait(STEGO_GAIT, DINO_GROUP_SCALE)`,
likewise Brachio), so Stego's 0.44129 m/s and Brachio's 0.27543 m/s are the
speeds actually walked; the authored-gait arrival radii (2.144 / 1.6096 m) are
larger and are what the unit test pins, because the test deliberately avoids
importing `loaders.ts`. The shipped radii are smaller, so the real stop is
inside the asserted one.

Countdowns armed by seed 42: trike 42.197 s, stego 45.197 s, brachio 48.197 s —
three different whole seconds, which is what AC-9 asks for.

## Design notes worth carrying forward

- **"Arrive" is a ring change, not a deceleration.** While approaching, the ring
  is the anchor at `arrivalRadiusMetres`, so `steerInsideWanderRadius()` pulls
  towards the corner instead of back to the paddock; the animal stops when it is
  inside `stopRadiusMetres`, where `setWalking(false)` hands the pose to Phase 1's
  blend and the `Idle` clip.
- **The controller never moves an animal.** It calls `setWanderRing`, `turnTo`
  and `setWalking` and reads `heading`, `walking` and `body.position`. `DinoPlayer`
  satisfies `VisitActor`/`VisitBody` structurally, so `tests/ranch/visit.test.ts`
  runs the whole state machine against a stub and a real `DinoPlayer` without
  loading a GLB.
- **The timer is frame-dt driven.** `update` returns early on `!(dtSeconds > 0)`,
  and `loop.ts` returns before it on a paused frame, so `&pause=1` freezes the
  schedule with the rest of the ranch and a seeded run reproduces it.
- **The home ring is data the director owns.** There is no ring reset verb; the
  director is constructed with the home ring (world origin, `DINO_WALK_RADIUS_METRES`)
  and re-asserts it in `sendHome`.

## Deviations

None from Touches: `src/ranch/visit.ts` (new), `src/ranch/layout.ts` (anchors
export only — `HAY_NEST_CENTRE_METRES`, `HAY_NEST_CLUSTER_RADIUS_METRES`,
`BROWSE_TREE_FOOT_METRES`, `CORNER_ANCHORS`, plus the two private helpers they
need; the bale cluster now reads the exported centre and radius, so no placement
moves), `src/viewer/loop.ts`, `src/viewer/main.ts`, `tests/ranch/visit.test.ts`
(new).

One tooling deviation: `pnpm format` (and `pnpm exec oxfmt`) is denied in this
sandbox, so the two files the formatter flagged were hand-formatted to the
surrounding style and `pnpm format --check` was re-run inside `pnpm verify`,
which now passes on 103 files.

## Rework 1 — the visit kept the walk flag for good

**Defect.** The cycle ended with `setWalking(false)` on arriving home and `idle`
never turned walking back on, so an animal stood at its ring after its first
visit until the next timer — and, since the timer only re-fires while walking is
on, a child who left Walk on saw one visit and then a statue. The visit had
taken over the walk flag and never given it back.

**Fix.** `VisitTrack.takenOverWalking` records `actor.walking` in `beginVisit`,
immediately before the visit borrows it. `advance`'s `idle` branch — which
already returns early when `this.walking` is false — hands the flag back on the
first idle frame, and only when it is actually off, so the return leg still ends
with the animal stopped on its ring and the very next frame resumes the amble.
Nothing forces `true`: the restore is the recorded value, and the `!this.walking`
guard keeps FR-10 true (Walk off leaves everyone home until Walk comes back).

**Proof** (`tests/ranch/visit.test.ts`, 24 tests in the file, +2):

- `gives the walk back when the visit ends, so the animal ambles on` — a stub
  with walking already on runs the full cycle; on the frame `idle` is entered
  `actor.walking` is `false` (the return leg stopped it), the next frame it is
  `true`, and 30 s of further simulation moves the body **> 1 m** from where it
  rested (0.3625 m/s × 30 s ≈ 10.9 m of ground).
- `never turns walking on while Walk is off` — 120 s of `update(DT, false)`
  leaves the stub idle, `startVisit` refused, and `actor.calls` free of any
  `walking:true`.

Re-run after the fix: `pnpm verify` exit 0 — oxlint clean, oxfmt 103 files,
`tsrs --noEmit` clean, vitest 54 files / **706** tests, statements 84.46 %
(2752/3258), branches 69.05 % (837/1212), functions 86.02 % (468/544), lines
84.47 % (2693/3188), `visit.ts` 92.98 / 82.60 / 91.30 / 92.79, audio pack 15
assets 853,289 B, build `dist/assets/index-a99FMjj_.js` 710.91 kB (gzip 186.40),
precache 63 entries (8961.75 KiB), dist clean. Commit `f1e559c`.

## What I could not prove, and what to watch

- **No GPU-level check of the blend at the stop.** AC-5 measures the rested
  position and heading of a real `DinoPlayer` in Node; that the `Idle` clip is
  what the eye sees there is Phase 1's proof, not re-run here.
- **The three never visit in the same whole second for seed 42 only.** The slot
  offsets make it structurally impossible (each species' window is disjoint), and
  the test asserts it for the seeded run AC-9 names, not for every seed.
- `pnpm verify`'s coverage numbers are the whole repo's; `visit.ts` at 92.79 %
  lines is above NFR-8's 60 % new-code floor but its uncovered lines
  (`249, 289, 304-309`) are the re-registration path, the missing-species guard
  and `getSnapshots`, which the viewer does not call yet (Phase 6's harness will).

## Primary verification

Independent checks run by the orchestrator at `9476151` (squashed from
`ac976bf..72f8f45`), not by the phase agent.

| Check | Command | Result |
| --- | --- | --- |
| Clean tree before squash | `git status --porcelain` | empty |
| Touches | `git diff --name-only 7bd9de8..HEAD` | 6 files: `src/ranch/layout.ts`, `src/ranch/visit.ts`, `src/viewer/loop.ts`, `src/viewer/main.ts`, `tests/ranch/visit.test.ts`, this evidence file. All inside Touches; `plan.md` excluded from the squash so the phase commit is code and evidence only. |
| Full gate | `pnpm verify` | exit 0 - build ok, `precache 63 entries (8961.75 KiB)`, `dist clean: no dev harness markers in dist` |
| Walk flag restore | read of `src/ranch/visit.ts` | line 324 restores only when `track.takenOverWalking` is true, and only when walking is currently off: `if (!actor.walking && track.takenOverWalking) actor.setWalking(true)`. Nothing forces `true`, so FR-10 holds when Walk is off. |
| Cost | precache delta | 8957.64 -> 8961.75 KiB (+4.11 KiB, from `visit.ts` in the bundle). No new asset, no new dependency, no draw call. |

### The defect this phase caught

Round 1 reported that the return leg ends with `setWalking(false)` and that
`idle` never turns walking back on. That is not a stylistic choice: it would
have ended the endless amble after each animal's first visit, leaving the trio
standing on its rings for the rest of the session. Rework 1 recorded the walk
state at `beginVisit` and handed it back on the first idle frame, with two
tests (`gives the walk back when the visit ends`, `never turns walking on
while Walk is off`). The phase was squashed only after that fix.

### Not proven here

- Nothing has been *seen*. `MudRoll` still does not play - the loader does not
  request it until Phase 5 wires the arrival - so the clip's sign-off and the
  arrival effects remain Phase 5's, with captures.
- The viewer feeds world gaits (`worldGait(..., DINO_GROUP_SCALE)`), so the
  shipped arrival radii (1.7795 m Stego, 1.4582 m Brachio) are smaller than the
  authored radii the unit test pins (2.144 m, 1.6096 m). The stop lands inside
  the asserted radius either way; recorded rather than papered over.
