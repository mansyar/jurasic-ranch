# Phase 4 — Cameras and the Sky POV

| | |
|---|---|
| Track | `20261030-ranch-vista` — Ranch Vista: Staged Paddock and Sky POV |
| Phase | 4 — Cameras and the Sky POV |
| Date | 2026-10-30 |
| Branch | `feat/20261030-ranch-vista` |
| Base | `dd5c732` |
| Head | `b6b5a7b` (code and tests; this report is the commit on top) |
| Result | **Pass, with one documented limit.** `pnpm verify` exits 0: `oxlint` clean, `oxfmt --check` clean (91 files), `tsrs --noEmit` silent, **585 tests in 47 files** all passing, coverage 81.18 % statements / 66.14 % branches, audio pack ok (15 assets / 853,289 B), build ok (precache 63 entries / 6,693.19 KiB), `dist clean: no dev harness markers`. |

## What this phase establishes

A preset is now the whole cut — where the lens stands, where it aims, **and the
lens it aims through**. `PovPreset` carries `kind` (`ground` | `overhead`),
`anchor` (the corner it frames, or `centre`) and `fov`; `applyPovPreset` sets
position, look direction, `fov` and `updateProjectionMatrix()` and nothing else,
and the render loop still touches none of them (asserted, see FR-10). The three
ground lenses are pulled in from the 15.2–17.8 m they stood at to 10.8–11.4 m,
widened to 48–52° vertical, and kept on their bearings to the last digit. A
fourth preset, `sky`, stands 17.49 m out at 30° and 65.26 m up, tilting 75° at
the ranch's middle, with its distance derived from the play disc's *projected*
extent on the narrowest frame the app boots into.

The instrument that proves all four frames is a screen-space occlusion kit in
`tests/viewer/pov.test.ts`: every prop's box and every animal's silhouette are
projected with `camera.projectionMatrix × camera.matrixWorldInverse`, so AC-1,
AC-2 and AC-3 are arithmetic — no renderer, no browser, no screenshot.

The kit rejected Phase 3 placements, and they were nudged along their own
bearings and radii until they passed. No rule was loosened to make a placement
fit; the two rules that changed are listed as deviations below, and one AC-2
limit is recorded rather than papered over.

## Commands

| Command | Result |
|---|---|
| `pnpm verify` | **exit 0** — lint, format check, typecheck, coverage, audio pack, build, dist-clean all green |
| `pnpm lint` | exit 0 — `oxlint` silent (no warnings) |
| `pnpm format --check` | exit 0 — 91 files, all correctly formatted |
| `pnpm typecheck` | exit 0 — `tsrs --noEmit` silent |
| `pnpm coverage` | exit 0 — 585 tests / 47 files; 81.18 % stmts, 66.14 % branches, 82.57 % funcs, 81.15 % lines |
| `node scripts/check-audio-pack.mjs` | exit 0 — 15 assets (1 music, 6 sfx, 8 voice), 853,289 B |
| `pnpm build` | exit 0 — 40 modules, precache 63 entries / 6,693.19 KiB |
| `node scripts/check-dist-clean.mjs` | exit 0 — no dev harness markers in `dist` |

## Acceptance criteria

### FR-7 / FR-10 / AC-1 — three ground lenses, cut as a preset

| Preset | Bearing | Lens | Eye | fov | Aim |
|---|---|---|---|---|---|
| `ranch` | 58° (1.0123 rad) | 11.4 m | 3.4 m | 52° | brachio, 58 % of 4.602 m = **2.669 m** |
| `nest` | 141.6° (2.471 rad) | 10.8 m | 3.0 m | 50° | trike, 58 % of 2.299 m = **1.334 m** |
| `garden` | 240° (4.1888 rad) | 11.1 m | 3.2 m | 48° | stego, 58 % of 2.383 m = **1.382 m** |

- Bearings are asserted against `POV_BEARING_RADIANS` to 1e-9 and in degrees
  against 58 / 141.6 / 240 — none moved.
- The windows are asserted, not just the values: lens ∈ [10.6, 11.4], eye ∈
  [3.0, 3.4], fov ∈ [48, 52], aim at 55–60 % of the focus animal's height.
- Each lens stands **outside the mid band** (`> 10.0 m`) and **inside the
  foreground band** (`< 11.6 m`), so the props a shot reads first are the band
  the composition put there — and `> WALK_CLEARANCE_METRES` (8.333 m), so no
  lens stands in an animal's path.
- `applyPovPreset` is asserted to set `camera.fov` and to re-project:
  `projectionMatrix.elements[5] === 1 / tan(fov/2)` after the cut. `loop.ts` is
  asserted to contain none of `camera.position`, `lookAt`, `fov`, `rotation`,
  `quaternion`, `matrix`, `projectionMatrix`, `updateProjectionMatrix` or
  `applyPovPreset`, and to still contain `renderer.render(scene, camera)`
  (FR-10: the loop never writes the camera).
- AC-1 is one table of findings, printed in full when it fails: for every prop,
  whose box is nearer the lens than the subject's silhouette, the two screen
  rects must not overlap; and the subject's silhouette must sit wholly inside
  the HUD-safe inset (96 px top, 120 px bottom, 24 px sides) at 16:10 and 3:4.

### FR-8 / AC-2 / AC-3 — the sky POV

| Claim | Asserted value |
|---|---|
| Tilt | **exactly 75°** — from `SKY_TILT_DEGREES`, and again from the applied camera's `getWorldDirection` pitch, so the constants and the cut cannot disagree |
| fov | 30° vertical |
| Bearing | 30° (`π/6`) — the one bearing FR-7 does not fix |
| Distance | **17.49 m** from the ranch centre (derived, `SKY_ACROSS_DISTANCE_METRES` binds) |
| Height | **65.26 m** (= distance × tan 75°) |
| Disc margin, 3:4 portrait | disc spans **93.0 %** of the width → **7.0 % margin** each side (≥ 5 %) |
| Disc margin, 16:10 landscape | disc spans **43.6 %** of the half-width, and 67.4 % of the half-height |
| Dinos | every one ≥ 72 px across at 1280×800 and at 960×1280; the **Trike (3.708 m, the smallest) is the binding animal** — ≈ 79–82 px in landscape, ≈ 126–131 px in portrait at the disc's scale of ≈ 22.1 / 35.3 px per metre |

The distance is derived, not chosen. A horizontal disc of radius `R` seen from
`D` out and `H = D·tan(75°)` up projects to an ellipse whose half-extents in
camera space are `R/(D/cos p − R cos p)` across and `R sin p/(D/cos p − R cos p)`
up — both charging the rim the nearest depth it can reach. Requiring each to
stay inside `(1 − margin)` of its half-frame gives two lower bounds; the distance
is the larger. The test holds the shipped distance against both bounds, asserts
`across ≤ 0.95 · 0.75 · tan(v/2)` and `up ≤ 0.95 · tan(v/2)`, and asserts that
**3 % closer breaks the portrait bound** — which is what "sized from the
projected disc" means rather than "a height someone liked".

Margin is measured by projecting **360 rim samples**, not the disc's bounding
square (a circle at 75° is an ellipse whose extremes are on the rim). AC-2 is
measured through `frameEdgeGround()`: all five edge rays must hit ground, the
top ray must be below the horizon, and every hit must land inside the meadow.

**Documented limit (AC-2 at an aspect the app does not ship).** At 2.4:1 the
frame's top corners reach ≈ 51 m, about 3 m past the meadow's 48.18 m edge,
because framing the disc on the portrait width is what fixes the distance.
16:10, 3:4 and 1:1 all land inside the meadow and are asserted as such; at 2.4:1
and 0.46:1 the test asserts the weaker, still-true claim that the whole frame is
ground plane below the horizon. 0.46:1 (a tall phone) does stay inside the
meadow, and is asserted separately.

### FR-9 / AC-4 — four buttons, and no list anywhere

- `index.html` carries exactly four `data-pov` buttons — `#pov-ranch`,
  `#pov-nest`, `#pov-garden`, `#pov-sky` — each ≥ 72 × 72 px, each an icon plus
  an English word (`🏠 Ranch`, `🪹 Nest`, `🌼 Garden`, `🚁 Sky`), each with
  `aria-pressed`, synced to the active camera.
- The portrait lift (`#pov` raised by 88 px) was widened to
  `@media (orientation: portrait), (max-width: 800px)`: four 72 px buttons plus
  three 12 px gaps are 324 px, which reaches the centred Walk button on any
  viewport narrower than about 800 px. The lift therefore applies on the 768 px
  portrait tablet AC-4 names, and Walk stays clear.
- **Every preset is looked up, never listed.** `hud.ts`'s hardcoded
  `id !== 'ranch' && id !== 'nest' && id !== 'garden'` guard is gone, replaced by
  `isPovPresetId()` (`Object.hasOwn(POV_PRESETS, value)`); the shell test asserts
  the old three-id chain is *absent* and the lookup is present. The dev harness's
  Viewpoint row already derived from `POV_ORDER` and needed no change; it now
  proves it, with a button per id and a Sky press routed through `setPov`.
- `DevSnapshot['pov']` widened from the three-id union to `PovPresetId`, and
  `buildSnapshot` round-trips every preset id.
- Reduced motion and hint behaviour keep working off the same presets: the glow /
  static-outline split and the idle timer are unchanged, and no rotate/pinch
  affordance was added (`gesturestart`, `dblclick` and multi-touch guards stay).

### FR-19 — the occlusion kit

`tests/viewer/pov.test.ts` builds a `PerspectiveCamera(1, aspect, 0.1,
CAMERA_FAR_METRES)` per preset and aspect, applies the real `applyPovPreset`,
then projects:

- `projectBox` — a prop's footprint square × its catalogue height, all eight
  corners, returning the screen rect and the nearest depth; a box whose nearest
  corner is at or behind the lens plane is skipped (it cannot occlude), and a
  lens standing *inside* a prop's footprint is reported separately.
- `subjectSilhouette` — the body length held **broadside** to the sightline at
  58 % height, which is the widest a heading can present. (A full-length square
  in plan, the first cut of this kit, overstates the animal and cannot be
  satisfied in portrait at 48–52°.)
- Rim sampling for the disc, and `frameEdgeGround` for the sky frame.

No renderer, no DOM, no browser: pure three.js vector maths on the same camera
object the app cuts to.

## Occlusion findings and every nudge

The kit and the layout suite rejected these Phase 3 placements. Each was moved
**along its own bearing and radius**; no clearance number, half-angle or margin
was relaxed.

| Rejected | Why | Nudge |
|---|---|---|
| `wildflower-68d3a1.glb` at 272° / 13 m | 15.8° off the Ranch lens axis, inside the 18° foreground clearance | → **215° / 13 m** (30.5° off the nearest axis) |
| Trike corner: 4 hay bales clustered at **90° / 9.35 m**, berry bush 78° / 9.8 m, flower bed 102° / 9.8 m | 35.8° off the Nest lens axis (lens pulled in to 10.8 m), outside the 30° the preset's view allows | bale cluster → **64° / 9.0 m** (ring radius 0.55 m kept), berry bush → **61° / 8.7 m**, flower bed → **68° / 8.7 m**; all still in the mid band and on the trike's side |
| Stego corner: garden rocks at 206° / 9.3 m and 222° / 9.3 m, log stump 198° / 8.75 m | 43.7° off the Garden lens axis (lens at 240° / 11.1 m, only 30° round from Stego's own bearing) | → rocks at **223° / 8.42 m** and **229.8° / 8.6 m**, stump at **226.5° / 8.45 m**: the window where the lens's 30° still reaches them *and* the sightline corridor is ≥ 0.86 m clear. They now lean on each other at the wallow's eastern rim |
| Ranch frame: ginkgo-tree box overlapping the brachio's subject box | measured against an intermediate lens model | cleared once the lens model was final (11.4 m / 52°); **no shipped prop moved** |
| "touches the lens" findings on wildflower, tree-fern, redwood, cycad, windpump | a kit bug: boxes beside and behind the lens plane were projected through it | kit fixed — nearest depth ≤ 0.1 skipped, and a lens inside a footprint reported separately |
| Ranch HUD-safe area (bottom at 16:10; left and right at 3:4), Garden (left at 3:4) | the first kit measured a body-length **square**, which no heading presents | kit fixed — the subject is now its broadside silhouette; the animals did not move |
| Sky margin 803 px > 760 px at 16:10 | the disc was projected as a square `Box3` | kit fixed — 360 rim samples; the disc is an ellipse, not its bounding square |
| Sky portrait rim at 38–40 px against the 40 px floor | the closed-form bound charges the whole rim the nearest depth, so the disc landed exactly on the 5 % line | `SKY_FRAME_CUSHION = 0.02` of the half-frame kept inside the margin, so the asserted 5 % holds with pixels to spare (distance 17.03 → 17.49 m) |
| AC-2 far edge at 49.96 m > 48.18 m | ultrawide 2.4:1 frame, see the documented limit above | not a placement: scoped in the test to the shipped frames, recorded here |

## Files

| File | Change |
|---|---|
| `src/viewer/pov.ts` | `PovKind`, `PovAnchor`, `GroundPovPresetId`, `fov` on `PovPreset`, `GROUND_POV_ORDER`, `BOOT_POV_ID`, `POV_LENS_METRES`, `POV_EYE_METRES`, `POV_FOV_DEGREES`, `DINO_HEAD_HEIGHT_OF_BODY_LENGTH`, `POV_LOOK_AT_HEIGHT_FRACTION`, `focusHeightMetres`, the derived sky preset (`SKY_TILT_DEGREES`, `SKY_DISC_FRAME_MARGIN`, `SKY_FRAME_CUSHION`, `SKY_NARROWEST_ASPECT`, `SKY_BEARING_RADIANS`, `SKY_DISTANCE_METRES`, `SKY_HEIGHT_METRES`), `isPovPresetId`, and `applyPovPreset` now cutting fov |
| `src/viewer/scene.ts` | `CAMERA_VERTICAL_FOV_DEGREES` is now `POV_PRESETS[BOOT_POV_ID].fov` — the lens belongs to the preset, so there is one number |
| `src/viewer/hud.ts` | `activePov` starts at `BOOT_POV_ID`; the hardcoded three-id guard becomes `isPovPresetId(id)` |
| `src/dev/snapshot.ts` | `DevSnapshot.pov` and `buildSnapshot`'s input widen to `PovPresetId` |
| `index.html` | `#pov-sky` (🚁 Sky) as the fourth button; the portrait lift widened to `(orientation: portrait), (max-width: 800px)` |
| `src/ranch/layout.ts` | Placement nudges only — nine placements moved, two docblocks rewritten |
| `tests/viewer/pov.test.ts` | The occlusion kit, the four-preset model, ground optics windows, sky derivation, AC-2, AC-3, FR-10 loop guard, shell wiring |
| `tests/dev/snapshot.test.ts` | `pov` round-trips every preset id |
| `tests/dev/harness-panel.test.ts` | A Viewpoint row per `POV_ORDER` id; a Sky press routed to `setPov` and `aria-pressed` |
| `tests/ranch/ground.test.ts` | *Deviation* — ground-only loops; `fov` read from the preset |
| `tests/ranch/layout.test.ts` | *Deviation* — ground-only loops for the band, cone and sightline rules |
| `tests/ranch/dressing.test.ts` | *Deviation* — ground presets judged by band, the overhead one by clearance and height |

Commits: `2c2c038` presets, sky camera, nav and lookup, `b6b5a7b` the occlusion
kit and the ground-only scoping.

## Deviations

1. **`tests/ranch/ground.test.ts` is outside `Touches`.** Five of its tests loop
   `POV_ORDER` and read `CAMERA_VERTICAL_FOV_DEGREES`; two of them ("reaches past
   every frame-edge ground hit", "keeps the top of every preset frame above the
   horizon") are true of a ground lens and *false by design* of the sky lens,
   whose whole frame must be below the horizon (AC-2). They now loop
   `GROUND_POV_ORDER` and take `fov` from the preset. The far-plane and seam
   bounds still loop every preset, so the sky camera is still held to
   `distance + GROUND_RADIUS < CAMERA_FAR_METRES` and to the seam radius.
2. **`tests/ranch/layout.test.ts` is outside `Touches`.** Three tests measure a
   lateral axis against a lens: the foreground 18° clearance, the treeline ±25°
   cone, and the prop-between-lens-and-animal clearance. An overhead lens has no
   lateral subject direction — its lens→subject ground vector is zero-length,
   which is the Edge Case the spec calls out — so all three now loop
   `GROUND_POV_ORDER`, and the silhouette-rhyme loop does too (a `sky` key in
   `POV_FOCUS_SPECIES` would be a lie). No threshold changed.
3. **`tests/ranch/dressing.test.ts` is outside `Touches`.** "Leaves the ranch a
   prop band to stand in" used `Object.values(POV_PRESETS)` and demanded every
   lens stand past 14.85 m (two body lengths). The ground lenses deliberately
   stand at 10.8–11.4 m now, so ground presets are judged by their band
   (`> WALK_CLEARANCE`, `> mid.maxMetres`, `< foreground.minMetres`) and the
   overhead one by clearance and height.
4. **`src/ranch/layout.ts` placements moved** — allowed by `Touches`
   ("placement nudges only"), nine of them, each listed above.

NFR-5 is respected throughout: the sky distance, height, tilt-derived numbers,
the fov per preset and the aim height are all derived expressions over
`GROUND_RADIUS_METRES`, `IN_GAME_BODY_LENGTH_METRES` and the tilt — no bare
camera number is written down.

## Captures

**The four shots are pending.** No picture was taken in this phase and none is
claimed here. What this phase provides is a capture that is reproducible: each
view is a preset, and each preset is reachable through the dev bridge —

```js
window.__ranch.setPov('ranch'); // 'nest' | 'garden' | 'sky'
```

— so the primary can capture the same four frames deterministically
(`?dev=1&seed=42&pause=1` pins the scene), once a still frame can be grabbed.
Everything a reviewer would look for in those shots is asserted as arithmetic
above: lens, eye, fov and aim per ground preset; tilt, distance, disc margin and
dino pixel size for the sky view; and that nothing nearer than the subject
overlaps it in any of the four.

## Notes for the primary

- **The portrait width is what sizes the sky camera**, and it is the frame a
  phone or tablet actually boots into. Sizing from 16:10 alone would let the
  ranch's ears leave a 3:4 frame.
- **The Trike is the animal to watch in the sky view.** At 3.708 m it is the
  smallest of the three, so the 72 px floor binds on it, and it measures ≈ 79–82
  px in landscape — the tightest number in this phase.
- **The Stego corner is the squeeze.** The Garden lens stands only 30° round from
  Stego's own bearing, so its corner props sit a couple of metres from the lens
  and subtend a wide angle; they now crowd the wallow's eastern rim, where the
  lens's view and the animal's sightline still allow them. That is a staging
  consequence of pulling the lenses in, not a rule bent.
- **One AC-2 limit is recorded, not hidden:** a 2.4:1 ultrawide frame puts its
  top corners ≈ 3 m past the meadow's edge. The shipped 16:10 and 3:4 frames are
  clean at every edge, and the meadow's radius is a Phase 2 number, not a camera
  one.

## Evidence paths

- `tests/viewer/pov.test.ts` — FR-7, FR-8, FR-9, FR-10, FR-19, AC-1..AC-4.
- `tests/dev/harness-panel.test.ts`, `tests/dev/snapshot.test.ts` — FR-9.
- `tests/ranch/layout.test.ts`, `tests/ranch/ground.test.ts`,
  `tests/ranch/dressing.test.ts` — the band, cone and sightline rules, scoped to
  the ground lenses, plus the far-plane and seam bounds that still hold the sky
  camera.

## Primary verification

Run by the orchestrator after squashing the phase.

| Step | Command | Exit | Result |
| --- | --- | --- | --- |
| Full gate | `pnpm verify` | 0 | lint, oxfmt check, typecheck, tests, coverage, audio pack, build, precache 63 entries / 6,693.19 KiB, `dist clean` |
| Touches | `git diff --name-only dd5c732..HEAD` | - | the five source files named in the phase, six test files and this evidence file. Three test deviations, all scoped to `GROUND_POV_ORDER` so the overhead lens is judged by its own rule instead of failing a ground rule by design |
| Captures | `node .conductor/tools/capture-povs.mjs` over CDP | 0 | **done, four shots at 1280x800** in `.conductor/evidence/ranch-vista/after/` (`ranch.png`, `nest.png`, `garden.png`, `sky.png`). Headless Chrome driven over the DevTools protocol with `window.__ranch.setPov`, dev panel hidden, `?dev=1&seed=42&pause=1` |

### What the four shots say

The camera work lands: the ground lenses are wide and the herd reads at a glance, the Sky view holds the whole ranch with the worn trefoil, the water line and the gate path legible from above, and four nav buttons sit correctly at 72 px.

Three composition defects are now visible that the test kit did not catch, and they are carried into Phase 5 as its polish tasks rather than waved through:

1. **Brachio's head is cropped by the frame top in `ranch`** (and its neck crosses the `nest` frame). The subject box the occlusion kit projects is the body, not the head, so a crop the eye sees passes the test.
2. **The magnolia still crowds the right third of `nest`.** The occlusion kit measures the shipped twelve by their Phase 1 *catalogue* footprints, which understate the canopies — the magnolia's catalogue footprint is 3.6 m against a measured 6.1 m canopy, so the one prop that most needs to be judged cannot fail.
3. **The meadow is sparse.** From the Sky view the ranch reads as a cluster of props on a lawn: the treeline is a thin ring of three species, and the frame is mostly flat green. The beauty gap the track was opened for is density, not more geometry types — the assets are already vendored.

One documented limit, unchanged: at 2.4:1 the sky frame's top corners reach past the meadow edge. 16:10, 3:4 and 1:1 are clean.
