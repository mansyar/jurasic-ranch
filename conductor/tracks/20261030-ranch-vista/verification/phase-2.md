# Phase 2 — Ground wear and sky

| | |
|---|---|
| Track | `20261030-ranch-vista` — Ranch Vista: Staged Paddock and Sky POV |
| Phase | 2 — Ground wear and sky |
| Date | 2026-10-30 |
| Branch | `feat/20261030-ranch-vista` |
| Base | `ee0641672209852e20d8d62811d44d8949afc00d` |
| Head | `f3321aa` (code; this report is the commit on top) |
| Result | **Pass** — `pnpm verify` exit 0, 542 tests in 47 files |

## What this phase establishes

FR-3 is a geometric claim, so it is proved rather than eyeballed. For every
preset, the frame's edge rays are intersected with the ground plane `y = 0`
(`frameEdgeGround()` in `src/ranch/ground.ts`), and the resulting distances are
asserted against the meadow radius. Nothing in the proof is a copied number: the
lens position, target, fov, the play radius, the spawns and the gait radii are
all imported live, so phase 4 moving a camera re-checks the guarantee instead of
silently invalidating it.

The seam is a second, independent claim. It is not hidden behind scenery; it is
**tone-continuous** — the apron's inner vertex tone is `GROUND_PLAY_HEX`
exactly, the play disc's tone is `GROUND_PLAY_HEX`, and both meshes share one
material light response. The join therefore has zero contrast at every preset and
under any lighting, which is the only honest way a 30 m boundary across an open
field can be called unseeable. The rim ends on `HORIZON_HEX`, the same constant
the sky's horizon band is built from.

## Commands

| Command | Result |
|---|---|
| `pnpm verify` | exit 0 — oxlint clean, `oxfmt --check` clean (89 files), `tsrs` clean, vitest 542 passed / 47 files, audio pack 15 assets, build ok (precache 45 entries, 5076.73 KiB), dist clean |

Coverage for the new modules: `src/ranch/ground.ts` 98.56 % statements /
98.51 % lines, `src/viewer/sky.ts` 100 % statements / 100 % lines.

Note: `pnpm format` (the fixing formatter) is not an available command for this
phase; the two test files were authored to the 100-column oxfmt style directly
and `oxfmt --check` passes untouched.

## Acceptance criteria

Derived radii, all from `GROUND_RADIUS_METRES` (12.0451 m, itself derived in
`src/ranch/layout.ts` from the largest dino and the in-frame overshoot):

| Quantity | Constant | Value |
|---|---|---|
| Play radius (existing) | `GROUND_RADIUS_METRES` | 12.0451 m |
| Meadow apron | `MEADOW_RADIUS_METRES` = 4 play radii | **48.1804 m** |
| Seam (play disc → apron) | `GROUND_SEAM_RADIUS_METRES` = 2.5 play radii | **30.1128 m** |
| Far plane | `CAMERA_FAR_METRES` = 2 meadow radii | **96.3608 m** |
| Sky dome | `SKY_DOME_RADIUS_METRES` = 6 play radii | 72.2706 m |

### FR-3 / AC-7 — no visible world edge

Farthest preset standoff from the ranch centre: 2.4 body lengths × 7.4234 m =
**17.8162 m** (ranch). Nest 15.2180 m, garden 16.1830 m.

Largest ground distance from the lens that any preset frame reaches, per aspect
ratio (the bottom corners are the extremes; the bottom-centre edge is strictly
shorter, and every top-edge ray points above the horizon and hits nothing):

| Preset | 0.46:1 | 1:1 | 1.78:1 | 2.4:1 | farthest hit from centre |
|---|---|---|---|---|---|
| `ranch` | 11.094 m | 11.664 m | 13.105 m | **14.643 m** | 14.890 m |
| `nest` | 7.568 m | 8.021 m | 9.151 m | 10.342 m | 12.869 m |
| `garden` | 7.618 m | 8.072 m | 9.207 m | 10.401 m | 12.773 m |

- Asserted: every hit is inside the meadow (14.643 < 48.1804), and every hit's
  origin distance is inside it too (14.890 < 48.1804).
- Asserted, in the brief's own phrasing: `hit + standoff` < meadow radius. Worst
  case 14.643 + 17.816 = **32.459 m** against 48.180 m — 33 % of margin.
- Asserted: apron ≥ 3 × play radius (48.180 ≥ 36.135), and apron − seam
  (18.068 m) > one play radius.
- Asserted: `CAMERA_FAR_METRES` (96.361) > meadow + standoff (66.00) for every
  preset, and the scene camera uses that same constant (`scene.ts` re-exports it).
- Asserted: the top of every preset frame is above the horizon, so no ray exists
  that could push the required reach toward infinity. A phase 4 camera tilt fails
  this test.

### FR-3 — two tones, and the seam is unseeable

| Claim | Test |
|---|---|
| Apron inner tone *is* the play tone | `GROUND_APRON_INNER_HEX === GROUND_PLAY_HEX` |
| Apron rim tone *is* the sky's horizon tone | `GROUND_APRON_OUTER_HEX === HORIZON_HEX` |
| The built mesh carries both, at the two ring radii | vertex-colour scan of `RanchGroundApron`: inner ring = play, outer ring = horizon; radii 30.113 / 48.180 |
| The two tones occupy separate radii, no coplanar overlap | `RanchGroundPlay` is a `CircleGeometry` of 30.113; the apron is a `RingGeometry` 30.113 → 48.180 |
| Both receive shadows | `receiveShadow === true` on both |

### FR-4 / AC-6 — wear where the trio lives

One disc per species, centred on `trioSpawnPositions()` and sized by that
species' `wanderRadiusMetres`:

| Species | Centre (x, z) | Radius |
|---|---|---|
| trike | (0, +3.7117) | 3.7117 m |
| stego | (−3.2145, −1.8559) | 3.7117 m |
| brachio | (+3.2145, −1.8559) | 3.7117 m |

All three gaits share `DINO_WALK_RADIUS_METRES` today, so the radii coincide —
but each disc reads its own species' gait entry, so a gait change moves it. The
test cross-checks species → spawn index through `POV_FOCUS_SPECIES` /
`POV_FOCUS_SPAWN_INDEX` rather than by list order, so a reordered species table
cannot pass by agreeing with itself.

Gate path: starts at the `farm-gate-8ab320.glb` placement read from
`DRESSING_MANIFEST` (bearing 260°, 9.2 m), width 0.5 × the gate's 1.7 m
footprint = 0.85 m, and runs inward to `GROUND_RADIUS / 3` = 4.015 m, which the
test proves lands inside the nearest wear disc. Two trackways (0.2125 m wide,
1.7 m long) sit either side of the junction, centred symmetrically on the path's
end point and rotated `-bearing` to it.

### FR-17 / AC-17 — sky and clouds

| Claim | Value / test |
|---|---|
| Four cloud groups | `SKY_CLOUD_COUNT === 4`, each 2–6 flat-shaded boxes |
| Vertical gradient, pale at the horizon | `skyToneAt(0)` = `HORIZON_HEX` exactly, `skyToneAt(1)` = `SKY_ZENITH_HEX` exactly; lightness strictly decreasing from horizon to zenith and monotone across the two bands; clamped (never darker than the horizon) below the horizon |
| Built once, survives `NoToneMapping` | dome is a vertex-coloured `MeshBasicMaterial`, `map === null`, `toneMapped === false`, `depthWrite === false`, `renderOrder < 0` |
| Gradients baked into the geometry | lowest vertex = horizon tone, highest = zenith tone |
| Clouds cast no shadow | `castShadow === false` and `receiveShadow === false` on every cloud mesh, and on each group |
| Clouds clear the scenery | altitude ≥ 26.6 m against the tallest catalogue prop (20.0 m redwood) |
| Drift rides the loop clock | `update(dt)` advances each cloud by its own derived speed (0.245–0.385 m/s), wrapping at ±38.54 m |
| Static under reduced motion | `update(5, true)` leaves every position bit-identical |
| Static on a paused clock | `update(0)` and `update(-1)` are no-ops, so the `/?dev=1&pause=1` capture is deterministic (NFR-8) |

## Files

| File | Change |
|---|---|
| `src/ranch/ground.ts` | New. Derived radii, tones, wear trefoil, gate path, trackways, flush decal materials, the built `RanchGround` group, and `frameEdgeGround()` |
| `src/viewer/sky.ts` | New. Vertex-coloured dome, four cloud groups, drift with wrap |
| `src/viewer/scene.ts` | Adds `createGround()`, re-exports `CAMERA_FAR_METRES`, exposes `CAMERA_VERTICAL_FOV_DEGREES`, background from the zenith tone |
| `src/viewer/main.ts` | Builds the sky once at boot, hands it to `startLoop` |
| `src/viewer/loop.ts` | Optional `sky?: SkyDrift` on `LoopView`; one `sky?.update(dt, reducedMotion)` call |
| `tests/ranch/ground.test.ts` | New, 19 tests |
| `tests/viewer/sky.test.ts` | New, 14 tests |

Commits: `6737564` ground and wear and tests, `ffce562` sky and drift and tests,
`f3321aa` scene and boot wiring.

## Deviations

1. **`src/viewer/loop.ts` is outside `Touches`.** One optional field and one call
   were needed there: the drift has to advance on the loop's clamped `dt` so the
   paused dev harness freezes it, and constraint 1 asks for exactly that (an
   optional `update(dt)` wired from `startLoop`, not a new render path). The
   alternative — a second `requestAnimationFrame` in `main.ts` — would have
   broken the pause contract and NFR-8 determinism.
2. **The plan's "seam hidden under the mid band" is superseded** (as the brief
   directed). The seam sits at 30.11 m: beyond every lens (max 17.82 m) and well
   beyond every ground point a frame edge reaches (max 14.89 m from the centre).
   It is unseeable because both sides of it carry the same authored tone, not
   because props stand on top of it.
3. **The two-tone ground is a continuous tone field.** A hard tonal step at
   30 m across an open field would itself be the visible world edge FR-3
   forbids, so the apron begins on exactly the play tone and ramps to the
   horizon tone at the rim. Two meshes, two radii and two tones are retained;
   the boundary between them is zero-contrast by construction.
4. **`CAMERA_VERTICAL_FOV_DEGREES` is new in `scene.ts`.** The reach proof reads
   the real lens instead of a copied `40`; the camera now uses the constant.
   (The fov was previously an inline literal there.)
5. **`CAMERA_FAR_METRES` moved from `scene.ts` to `ground.ts`**, because the far
   plane is now derived from the meadow radius. `scene.ts` re-exports it, so the
   existing import in `tests/viewer/pov.test.ts` is unaffected.

## Notes

- **Dome, not background texture.** Both satisfy "camera-relative or large
  enough"; the dome was chosen because it lets the horizon band and the apron's
  rim share one constant (`HORIZON_HEX`) in one place, so the two tones cannot
  drift apart, and because a 48-segment dome with no texture is cheaper than a
  cubemap and needs no colour-space handling under `NoToneMapping`.
- **The reach proof is about the lower edge of the frame.** From every preset
  the upper edge points above the horizon (asserted), so the ground's visible
  upper boundary is the rim itself — which is why the rim's tone equality with
  the sky is load-bearing and not decoration. The ground does not stop being
  visible at the rim; it stops *changing*, which is what "no visible edge" means
  here.
- **Lighting caveat, stated honestly.** The seam's invisibility is
  lighting-independent (same tone, same material). The rim's match against the
  sky is authored-equal but not measured-equal: the apron is lit
  (`MeshStandardMaterial`) while the dome is unlit, so the rendered rim is
  expected to sit a little brighter than the sky's authored tone. That is a
  capture question, and this phase had no renderer to capture with — no evidence
  image was produced, and the tests, not a picture, carry the claim.
- **Cost.** Three ground meshes plus six decals, one dome, four clouds of 2–6
  boxes sharing one `BoxGeometry`, no textures at all, no new dependency, and no
  allocation in the drift update (positions are mutated in place).
- **Reduced motion** is read from `hud.sleepy.reducedMotionQuery`, the codebase's
  existing source of truth; no second `matchMedia` was added.

## Primary verification

Run by the orchestrator after squashing the phase.

| Step | Command | Exit | Result |
| --- | --- | --- | --- |
| Full gate | `pnpm verify` | 0 | lint, oxfmt check, typecheck, 542 tests / 47 files, coverage above the floor, audio pack ok, build (precache 5,076.73 KiB), `dist clean: no dev harness markers` |
| Touches | `git diff --name-only ee06416..HEAD` | - | the five source files named in the phase plus two test files and this evidence file. One deviation: `src/viewer/loop.ts`, 12 lines, an optional `sky` field on `LoopView` plus one `sky?.update(dt, reducedMotion)` call, so drift rides the existing clamped dt and the paused harness still freezes it. Accepted as the smallest correct change; the alternative was a second animation path, which NFR-8 forbids |
| Test inspection | grep of `tests/ranch/ground.test.ts`, `tests/viewer/sky.test.ts` | - | real assertions against imported live constants: `frameEdgeGround`, `MEADOW_RADIUS_METRES >= 3x play radius`, `CAMERA_FAR_METRES > MEADOW_RADIUS + presetDistance` per preset, the seam radius, `SKY_CLOUD_COUNT === 4`, `castShadow === false` on the dome and every cloud child, and a bit-static reduced-motion check |
| Visual capture | headless Chrome `--screenshot`; desktop browser `screenshot` | - | **unavailable this phase.** Headless Chrome returns the page shell with a blank canvas (WebGL is not composited under `--virtual-time-budget`), and the desktop browser refused captures while its window was not visible. No picture is claimed for Phase 2; the geometric tests carry the claim, and visual sign-off moves to Phase 4, which builds the capture path (`?pov=` plus a scripted grab) and produces the four PR shots |

Accepted deviations, in addition to those recorded above:

1. **Two-tone ground became one continuous tone field.** FR-3 asks for two tones whose seam no preset can see; the step itself would be the visible line, so the apron starts at exactly the play colour and ramps to the horizon colour at the rim. The seam is invisible by construction rather than by occlusion. This is the stricter reading of FR-3 and belongs in the PR body.
2. **`CAMERA_VERTICAL_FOV_DEGREES` is a new `scene.ts` export**, so the frame-exit proof reads the lens the camera is actually built with instead of a copied 40.
3. **`CAMERA_FAR_METRES` now lives in `ground.ts`** and is re-exported from `scene.ts`, because it is derived from the meadow rather than from the play radius.
