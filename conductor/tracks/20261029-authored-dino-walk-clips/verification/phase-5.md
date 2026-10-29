# Phase 5 verification — Enlarge the ranch to hold real proportions

- **Track:** 20261029-authored-dino-walk-clips ("Stego and Brachio Walk on Their Own Bones")
- **Phase:** 5 — Enlarge the ranch to hold real proportions
- **Date:** 2026-10-29
- **Branch:** `fix/20261029-authored-dino-walk-clips`
- **Base:** `8dea96bc722dd281b23deea2877c07431c2dcb90`
- **Head:** `d516812f0cfb6f9ac940cbba193bcfaaad8ba98b`
- **Result:** verified for everything measurable in this shell (tests, types, lint,
  format, build, precache). The three POV screenshots and the dev-harness
  triangle/draw-call readings are **blocked on a browser** — see Blockers.

## Commits

| Commit | Task | What |
| --- | --- | --- |
| `e3fc195` | P5.T1.1–T1.3 | Walk area, spawn ring, avoidance trigger and both wander bars derive from one body length |
| `e48e1e7` | P5.T2.1–T2.2 | Dressing re-placed on a derived ring, ground circle and camera far plane follow it |
| `091fb66` | P5.T3.1 | Ranch/Nest/Garden re-aimed by bearing at the animal each names |
| `ded7323` | (phase note 2, unnumbered in the brief) | Placeholders scaled to the rigged body lengths |
| `d516812` | — | Formatter pass over the above |

## One number drives the ranch

`LARGEST_DINO_BODY_LENGTH_METRES = 7.4234` in `src/ranch/avoidance.ts` — the
Brachio at the trio's uniform scale, copied (not imported) so the ranch layout
stays free of the model loaders; `tests/ranch/dressing.test.ts` asserts it equals
`IN_GAME_BODY_LENGTH_METRES.brachio`, so the two cannot drift apart.

```text
DINO_WALK_RADIUS_METRES       = L / 2                       3.7117 m
PAIR_BODY_CLEARANCE_METRES    = L / 6                       1.2372 m
AVOIDANCE_TRIGGER_METRES      = L/6 + 1.21 m/s x 0.5 s      1.8422 m
TRIO_SPAWN_RADIUS_METRES      = L / 2                       3.7117 m
IN_FRAME_OVERSHOOT_METRES     = 0.91                        0.91 m
WALK_CLEARANCE_METRES         = L/2 + 0.91 + L/2            8.3334 m
GROUND_RADIUS_METRES          = clearance + L/2            12.0451 m
CAMERA_FAR_METRES             = 4 x ground radius          48.1806 m
```

Every gait (`TRIKE_GAIT`, `STEGO_GAIT`, `BRACHIO_GAIT`) now takes its
`wanderRadiusMetres` from `DINO_WALK_RADIUS_METRES`, so all three still share one
circle — the dev harness overlay reads `TRIKE_GAIT.wanderRadiusMetres` and
followed without an edit.

## Old -> new distances

| Quantity | Phase 4 | Phase 5 | Why |
| --- | --- | --- | --- |
| Wander circle radius | 0.8 m | 3.7117 m | Half the longest animal: a 7.42 m Brachio must turn inside it |
| Trio spawn radius | 0.4 m | 3.7117 m | Pairs start 0.69 m apart -> 6.43 m apart (0.87 body lengths) |
| Avoidance trigger | 0.4 m | 1.8422 m | Beam clearance 1.237 m + 1.21 m/s x 0.5 s of closing |
| Walk clearance | 0.8 m | 8.3334 m | Wander circle + in-frame overshoot + half a body of nose and tail |
| Ground circle radius | 6 m | 12.0451 m | Clearance + half a body of grass past the prop ring |
| Ground circle segments | 32 | 64 | Same 6 m -> 12 m radius at the same faceting |
| Camera far plane | 50 m | 48.1806 m | 4 x ground radius: the whole ranch plus the tallest tree |
| Prop ring radius | 0.8–4.2 m (hand placed) | 8.65–9.8 m (derived) | Eight to ten times the walk circle |
| Trike placeholder length | inside the 3.3–4.2 m window, from a fixed 2.6x scale | 3.708 m | Measured after assembly, scaled to the rigged length |
| Stego placeholder length | inside the 3.3–4.2 m window, from a fixed 2.6x scale | 3.845 m | Same |
| Brachio placeholder length | 2.79 m | 7.4234 m | The 2.66x pop on load is gone |
| Closest pair, 30 s dual draw | 0.2398 m | **0.8000 m** | Trigger + body clearance |
| Closest pair, 30 s trio draw | 0.1065 m | **1.5356 m** | Same |
| Furthest body centre, trio | trike 1.347 / stego 1.414 / brachio 1.099 m | trike 3.938 / stego 3.963 / **brachio 4.200 m** | Grows with the circle; all inside their gait ceilings (4.483 / 4.606 / 4.616 m) |
| Placeholder test bars | metre windows (2.3–3.1 m, head < 1.4 m) | proportion bars (length = rigged within 1e-3, height < half length) | Metre windows described a 2.79 m toy |

Measurements come from the locked-seed wander runs in
`tests/waddle/dual-wander.test.ts` and `tests/waddle/trio-wander.test.ts`, read
by temporarily failing the assertions and restored before commit.

## Acceptance

| Requirement | Status | Evidence |
| --- | --- | --- |
| AC-4 — Stego/Trike 1.04 ± 0.03, Brachio/Trike 2.00 ± 0.05 | pass (unchanged) | `tests/waddle/trio-viewer.test.ts` size suite; this phase changed no authored body length or group scale |
| AC-6 — a Brachio completes a full wander loop inside the walkable area | pass (simulated) | `wanders` 4.200 m furthest centre + 3.7117 m half length = 7.91 m, against a 12.045 m ground circle and an 8.3334 m prop clearance. `tests/waddle/trio-wander.test.ts` runs 30 s at 60 fps per player inside its gait ceiling |
| AC-6 — no dino-prop intersection in any POV | pass (tested, not yet seen) | `tests/ranch/dressing.test.ts` "keeps every prop outside the biggest animal's whole wander path" uses the real manifest and the real constants; a prop would have to be 8.33 m from the centre to touch a Brachio |
| AC-7 — each preset shows the animal it names unobstructed | pass (screenshots in `## Primary verification`) | `POV_FOCUS_SPECIES` maps ranch->brachio, nest->trike, garden->stego and each `lookAt` is that animal's **placement**, not the ranch centre; "keeps every prop off every preset sightline" checks every prop against every lens-to-animal ray, and "keeps the other two animals out of the line to the named one" forbids another species spawning within a body width of that ray. The first screenshot round caught the Garden preset framed on the Brachio instead of the Stego; see `## Primary verification` |
| FR-6 — the ranch grows for a real Brachio | pass | table above |
| FR-7 — dressing keeps authored clearance | pass | same two dressing tests |
| FR-8 — presets frame the enlarged trio | pass | `POV_BEARING_RADIANS` 58 / 141.6 / 240 deg x 2.4 / 2.05 / 2.18 body lengths, eye height 4.6 m, each aimed at its animal's placement; three screenshots in `## Primary verification` |

## Frame budget (NFR-1)

| Measure | Before | After | Delta |
| --- | --- | --- | --- |
| Triangles from geometry this phase touched | ground disc 32 tris | ground disc 64 tris | **+32 tris** |
| Dressings placed | 22 (12 unique files) | 22 (12 unique files) | 0 |
| Renderer settings | antialias, PCFShadowMap, NoToneMapping, `0x9fd4ef`, `0x7ec850` | unchanged | 0 |
| Precache | 30 entries, 6872.89 KiB | 30 entries, **6873.19 KiB** | **+0.30 KiB** |
| Bundle | 663.3 kB | 663.34 kB | +0.04 kB |

No prop was added, removed, or duplicated, and no new mesh was introduced, so
draw calls cannot have changed; the only geometry delta is the ground disc's
segment count. **The absolute triangle and draw-call figures still need reading
off the dev-harness panel in a browser** (blocker below): they are not recorded
anywhere in the repository, so they cannot be quoted here honestly. The pre-track
figures in the brief (26,037 tris for the Stego alone) could not be sourced from
`conductor/` either — no trio triangle figure exists in any evidence file.

## Commands

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm test` | 0 | 36 files / 343 tests passed |
| `pnpm lint` | 0 | oxlint clean |
| `pnpm typecheck` | 0 | `tsrs --noEmit` clean |
| `pnpm verify` | 0 | lint, format --check, typecheck, coverage (lines 70.78 %, 1088/1537), build, dist clean |
| `pnpm format` | **permission denied** | See blockers; the formatter pass was done by hand and confirmed by `verify`'s `format --check` |
| `pnpm format --check` | **permission denied** standalone | It runs inside `pnpm verify`, which reported "All matched files use the correct format" |
| `pnpm vitest run <file>` | **permission denied** | Only the named scripts run; per-file runs used `pnpm test <file>` |

## Evidence paths

- `src/ranch/avoidance.ts` — the one constant, the derived distances, the spawn ring
- `src/ranch/dino-player.ts` — three gaits take the shared circle
- `src/ranch/dressing.ts` — the ring, the footprints, the 22 placements
- `src/viewer/scene.ts` — ground radius and far plane from `GROUND_RADIUS_METRES`
- `src/viewer/pov.ts` — bearings, distances, focus species, `lookAt` per body centre
- `src/viewer/placeholders.ts` — `scaleToBodyLength`, measured after assembly
- `tests/ranch/dressing.test.ts` — wander-path clearance, gait ceilings, prop band
- `tests/viewer/pov.test.ts` — focus framing, sightline clearance, bearing spread
- `tests/waddle/dual-wander.test.ts`, `tests/waddle/trio-wander.test.ts` — 0.25 m bar restored
- `tests/waddle/avoidance.test.ts`, `tests/waddle/trio-avoidance.test.ts` — derived trigger and spawn
- `tests/waddle/trio-viewer.test.ts` — placeholder lengths equal the rigged lengths

## Deviations

| File | Why |
| --- | --- |
| `src/ranch/waddle.ts` | One docblock sentence still said the Trike arcs stay "inside the 0.8 m stay-in-frame wander circle". Comment-only edit; the constant is far outside the phase's reach otherwise. |
| `src/viewer/loop.ts` | `steerPairApart`'s docblock said "closer than 0.4 m". Comment-only, pointing at the derived constant now. |

## Blockers

1. **POV screenshots (P5.T3.2, AC-7).** This shell cannot drive a browser. With
   `pnpm dev` running, capture at 1280x800 (and once in portrait for the 72 px
   button check):

   - Ranch (Brachio): `/index.html?dev=1&seed=42&solo=brachio`
   - Nest (Trike): `/index.html?dev=1&seed=42&solo=trike`
   - Garden (Stego): `/index.html?dev=1&seed=42&solo=stego`

   Check each against AC-7: the named animal visible, unobstructed, no prop
   crossing its body, and the fence/tree line behind it rather than in front.
   Also worth one shot with no `solo` to confirm the trio never overlaps.
2. **Frame budget (NFR-1, P5.T4.1).** The dev panel's triangle and draw-call
   counters can only be read in a browser. Expected delta: +32 triangles, 0 draw
   calls (see the table). Please record the absolute trio figures from the panel
   with the URLs above.

## Primary verification

The subagent's shell could not drive a browser, so the two blocked tasks were run
by the primary with a headless Chromium (Playwright's `chromium`, SwiftShader
GL, 1280x800, `?dev=1&seed=42`) against the dev server on port 5196. Screenshots
are real renders of the shipped code, not mock-ups:

| Preset | Named animal | Panel read-out | Screenshot |
| --- | --- | --- | --- |
| Ranch | Brachio | 98 calls, 31,814 tris, 22 fps (software GL) | `.conductor/evidence/phase-5/pov-ranch.png` |
| Nest | Trike | 67 calls, 27,612 tris, 20 fps (software GL) | `.conductor/evidence/phase-5/pov-nest.png` |
| Garden | Stego | 100 calls, 32,805 tris, 20 fps (software GL) | `.conductor/evidence/phase-5/pov-garden.png` |

**Frame budget (NFR-1, P5.T4.1).** The trio peaks at **32,805 triangles and 100
draw calls** (Garden). The pre-track reference point was a solo Stego at 26,037
tris / 94 calls, so the whole trio — including a 7.4 m Brachio and a ground disc
twice as dense — costs about 6.8 k more triangles and 6 more calls than one
Stego did before. The fps column is software rasterisation and is **not** a
device figure; AC-5/T8's real-device 60 fps check still belongs to the tablet
pass. Delta against the analytical estimate in `## Frame budget`: +32 triangles
predicted for the ground disc, +6 draw calls observed, 22 props unchanged.

**AC-7 needed one more fix, found by looking.** The first screenshot round framed
Garden on the **Brachio**, not the Stego. The lenses looked at the *ranch centre*
from a bearing of their own, so the animal that happened to spawn on the lens's
side of the circle stood between the camera and the animal the preset is named
for — at Garden that was the 7.4 m Brachio, 14.4 deg off the lens axis and only
0.92 m lateral of the sightline. Fixed in `e85b843`:

- Every preset now aims at its named animal's **placement** (body centre at
  `trioSpawnPositions()[index]`), derived through `POV_FOCUS_SPECIES` so the
  species map and the spawn ring cannot drift apart.
- Ranch moved 51.8 -> **58 deg** (the ginkgo tree sat 1.91 m off the new
  sightline, inside its 3.4 m footprint plus margin) and Garden 315.6 ->
  **240 deg**, which stands off the corn instead of across the fence run.
- A new test, "keeps the other two animals out of the line to the named one",
  rejects any layout where another species' spawn sits within a body width of a
  lens-to-animal ray; the prop sightline test now measures lens-to-animal rather
  than lens-to-centre.

After the fix the three views measure: other animals 4.94 m (Ranch), 6.41 m
(Nest) and none between lens and animal (Garden, both beyond the target); nearest
prop on a sightline 2.75 m (Ranch), 3.06 m (Nest), 2.69 m (Garden). All three
screenshots above are from the fixed build.

Observation, not a fix: at Nest the flowering magnolia fills roughly a third of
the right of frame — outside the sightline test's tolerance but visually heavy.
Left as-is; it is a framing opinion, not a defect, and moving it is a Phase 6
question at most.

---

**Notes carried over from the phase run.**

- **Behaviour change worth a look in those screenshots.** The 1.84 m trigger is
  wide enough that the pair now never closes: the dual draw's minimum separation
  equals its 0.8 m spawn distance, and the trio's is 1.5356 m. Nothing bounces —
  the heading-delta test still caps every frame under 0.1 rad — but the dinos now
  bend away from each other early and visibly, so "meets and parts" reads as
  "drifts apart". If that looks shy rather than playful, the honest knob is
  `AVOIDANCE_REACTION_SECONDS` (0.5 s today), not a hand-tuned metre value.
- The dressing ring is placed by bearing, not by coordinates: `onRing()` derives
  position and facing from one azimuth, so the fence run stays tangent to the rim
  (12 deg spacing at 9.2 m = a 1.93 m chord, one panel wide) and a prop that
  moves around the rim keeps facing the ranch.
- The nest stones sit 18 deg along the rim from the Nest preset, not on its
  sightline: a ring in the foreground centre would have blocked the Trike it is
  meant to decorate.
- `SPAWN_OFFSET_METRES` in `src/viewer/placeholders.ts` is still 0.4 and still
  only referenced by the dual suites; boot uses the triangle spawn. Left alone —
  the dual suites deliberately keep the tightest start as a stress case.
- Coverage lines moved 71.81 % -> 70.78 %: the new derivations are covered, but
  `src/viewer/hud.ts` and `src/viewer/scene.ts` are much larger relative shares
  now that the ground and preset maths live in tested modules. No threshold gates.
