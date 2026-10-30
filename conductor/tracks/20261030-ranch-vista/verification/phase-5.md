# Phase 5 — Aliveness and composition polish

- Track: `20261030-ranch-vista` — Ranch Vista: Staged Paddock and Sky POV
- Phase: 5
- Date: 2026-10-30
- Branch: `feat/20261030-ranch-vista`
- Base: `059e8c3` (phase-5 brief head) · Head: `d546689` (`b5ca091` aliveness, `d546689` polish)
- Result: **pass** — `pnpm verify` exits 0

## Commands

| Command | Result |
| --- | --- |
| `pnpm verify` | exit 0 — lint, `oxfmt --check`, typecheck, 603 tests in 48 files, audio pack (15 assets / 853,289 B), build, dist-clean |
| `pnpm coverage` (inside verify) | 81.97 % statements · 67.10 % branches · 83.19 % functions |

## What changed

### Aliveness (FR-11, FR-12, AC-9, AC-10)

New module `src/ranch/ambient.ts`, hung off the already-dressed group so no
render-loop hook was needed (`loop.ts` is untouched).

- **Sway (P5.T1).** `AmbientSway` walks the dressing group once at build time and
  keys each clone off the manifest file it came from (`node.userData.file`, set
  in `buildDressing`). Three classes, each tuned against its own geometry:

  | Class | Files | Amplitude | Period | Cross axis |
  | --- | --- | --- | --- | --- |
  | corn | `corn-crop-b71f2f.glb` ×6 | 0.024 rad (1.38°) | 4.4 s | 0.60 |
  | reeds | `river-reed-cluster-cba87e.glb` ×2 | 0.038 rad (2.18°) | 3.2 s | 0.75 |
  | litter | `ginkgo-leaf-litter-9784e9.glb` ×3 | 0.050 rad (2.86°) | 5.6 s | 0.50 |

  Eleven props sway; every other clone is untouched. Each phase is one draw from
  `createSeededStream(seed)` (exported from `layout.ts` — the ranch already owned
  a seeded stream, so no second generator was added), so the ripple replays under
  `?dev=1&seed=42` and differs under another seed. `update(dt, reducedMotion)`
  only ever reads `dt`: `dt <= 0` is a no-op (paused captures stay still), and
  the angle is `2π·elapsed/period + phase`, so nothing depends on a timer.
- **Reduced motion (P5.T2).** `update` calls `settle()` — a one-way reset of the
  two rotation axes to zero — the moment `reducedMotion` is true, and freezes its
  clock, so a live media-query flip stops the grass mid-shin rather than mid-lean,
  and flipping back resumes from a clean phase rather than a jump.
- **Tap raycast (P5.T3).** `propUnderPointer(root, camera, ndc)` raycasts into the
  `RanchDressing` group's descendants only, then walks the first hit back up to
  the group's direct child, so the thing that sparkles and the thing that owns
  the cooldown are the same object.
- **Sparkle (P5.T4).** `SparkleReactions` wraps the existing `DustPool` shape
  (same pool, same geometry contract) with a generated four-point `DataTexture`
  star, 8 particles per burst, 0.3 m points, additive, `renderOrder` 6, named
  `RanchSparkles`. `allows(prop, nowMs)` is a `WeakMap` of last-burst times with
  `SPARKLE_COOLDOWN_MS = 250`; `react` is decoration only — no heart, no voice,
  no counter, no sleepy or walk change.
- **Guards (P5.T5).** `main.ts` listens on the canvas (never on `document`), and
  `allowsPropTap({ sleepy, hudOwnsPointer })` runs before any raycast:
  `event.target !== canvas` means the HUD owns the pointer and the tap is lost to
  the button; `hud.sleepy.shown || hud.sleepyState() === 'sleepy'` means the
  overlay is up. If the engine is still locked, the handler runs
  `unlockAudio()` first and bursts in the `then` — one gesture, chime included,
  in that order.

### Polish (AC-1, FR-6, FR-4)

- **Whole-model subject box (P5.T6).** `pov.ts`'s single
  `DINO_HEAD_HEIGHT_OF_BODY_LENGTH = 0.62` is replaced by
  `DINO_HEAD_HEIGHT_METRES` measured from the rigged GLBs: trike 2.247 m,
  stego 2.263 m, brachio 7.226 m. The old ratio aimed the Ranch lens at a 4.602 m
  "head" for an animal whose box is 57 % taller — that is the crop in the
  capture, not a lens that was too wide. The kit (`tests/viewer/pov.test.ts`) now
  re-reads the same GLB bytes, projects the whole box at the **nearest point of
  the walk circle** (not the spawn) and fails if the head leaves the frame. Aim
  went to the floor of FR-7's window, 55 %:

  | Preset | Lens | Eye | fov | Aim (55 %) | Was (58 % of 0.62·body) |
  | --- | --- | --- | --- | --- | --- |
  | ranch | 11.4 m | 3.4 m | 52° | **3.974 m** | 2.669 m |
  | nest | 10.8 m | 3.0 m | 50° | **1.236 m** | 1.334 m |
  | garden | 11.1 m | 3.2 m | 48° | **1.245 m** | 1.382 m |

  Bearings untouched (58°, 141.6°, 240°). No lens, eye or fov changed: the Ranch
  preset was already at the top of its windows (11.4 m / 52°), so the only lawful
  lever was aim, and it was spent. Head headroom in the Ranch frame at the
  Brachio's spawn, 1280×800: the frame's top edge now reaches 11.06 m at the
  animal's depth, against 9.49 m before — 205 px of margin over the measured
  7.226 m head, and ≈70 px even if the walk clip poses the neck a metre and a
  half above its bind bounds.
- **True footprints (P5.T7).** Every one of the thirty catalogue entries is now
  the GLB's own widest ground extent and height, measured from the file's
  POSITION accessors. The twelve that shipped with Phase 1's vendor sheet:
  ginkgo 3.4→**5.69** / 11.74→**13.05**, redwood 3.4→**7.59** / 20.0→**21.32**,
  magnolia 3.6→**5.09** / 6.1→**3.65**, boulder 2.4→**2.0** / 1.27→**1.64**,
  stump 1.3→**1.0** / 1.2→**1.21**, fence 2.0→2.0 / 1.1, farm gate 1.7→**2.72**,
  trough 2.0→**1.6** / 0.5, pump 1.2→**0.90** / 1.21→**1.47**, well 1.7→**0.97** /
  1.75→**1.93**, corn 1.3→**0.88** / 1.81→**1.82**, river stones 1.6→**1.5**.
  `tests/ranch/layout.test.ts` widened from `NEW_FILES` to all thirty, so the
  sheet can never drift from the bytes again.
  - **Magnolia 113° → 100°** (the expected failure): its 5.09 m canopy stood 5.2 m
    from the Nest lens with its inner corner 1.94 m off the sightline, covering
    the Trike's rectangle. At 100° the inner edge clears by 2.4 m. Snapshot
    updated deliberately.
  - **Ginkgo 28°/9.6 m → 92°/9.8 m** (a second shipped prop, same justification):
    its 5.69 m canopy stood 5.7 m from the Ranch lens with its inner edge 0.75 m
    off the sightline, so its box covered the Brachio's rectangle — the honest
    footprint failed it, the box is what AC-1 measures, and every placement that
    keeps it in that frame covers the animal. It now stands behind the Ranch
    camera and reads in Nest and Garden instead. Snapshot updated. **This is a
    visible composition change the primary should judge from the captures.**
- **Meadow density (P5.T8).** No new assets: the treeline ring goes 4 → **12**
  (three times), using the cycad and tree fern already vendored, at 19.5–26 m on
  bearings chosen from the three lens axes (>25° off every cone); the apron
  gains four more sprigs (club-moss mat, wildflower) at 12.4–13 m outside every
  lens's ±18°. Budget: 56 → 68 placements, so **71 draw calls in the dressing
  group** (68 + 3, against a 150 ceiling) and **≈47.7k triangles** in that group
  (ceiling 80,000) — repeats of one file share the bake, which is why nine more
  props cost six calls' worth of work, not nine. These are the dressing group's
  own arithmetic, not the frame's; the frame is measured through
  `renderer.info.render` (see the review-fix notes on F3).
- **Soft decal edges (P5.T9).** `ground.ts` generates a 128 px alpha ramp into a
  `DataTexture` (green channel, smoothstep, no image file): a radial ramp for the
  three worn discs (fade begins at 62 % of the radius, so the trefoil keeps a
  solid core) and a lengthwise ramp for the gate path and both trackways. The
  decals are now `transparent` with `alphaMap`, still flush at y = 0, still
  polygon-offset and unlit-ish, still one draw call each.

## Acceptance criteria

| Criterion | Number / evidence |
| --- | --- |
| FR-4 derived ground wear | 3 worn discs (one per spawn, gait radius), gate stub, 2 trackways — unchanged, now with 128 px ramps |
| FR-6 band rules | 12 treeline props ≥ 17.8 m and ≥ 3 m tall; 10 sprigs ≤ 0.5 m at 12.4–13 m, all > 18° off every lens axis; mid cap holds |
| FR-11 sway | 11 props, 1.38°–2.86° at 3.2–5.6 s, seeded phases, `dt`-driven, inert under reduced motion |
| FR-12 tap | 1 burst (8 particles) + 1 `sparkle` per prop per 250 ms; no hearts, voice, counter or state change |
| AC-1 | whole-model box, head included, at the nearest walk-circle stance, in every ground preset; every prop box clear of the subject's rect |
| AC-9 | `tests/ranch/ambient.test.ts` drives `allows`/`react` across the 250 ms boundary and source-scans the handler for the five forbidden calls; the four-tap guard truth table |
| AC-10 | reduced motion settles the sway and freezes the clock; the sparkle pool keeps running |

## Evidence

- `.conductor/evidence/ranch-vista/glb-measurements.json` — every GLB's measured
  width/depth/height, triangles and draw calls, and the dinos' authored vs
  in-game bounds (the numbers behind the footprint table and
  `DINO_HEAD_HEIGHT_METRES`).
- `.conductor/evidence/ranch-vista/phase-5-notes.md` — working notes.
- No captures: this agent cannot render. The primary captures Ranch, Nest,
  Garden and Sky after this phase.

## Deviations

- `tests/ranch/ground.test.ts` — in Touches; the worn-disc geometry changed from
  `CircleGeometry` to `RingGeometry` (the radial ramp needs inner/outer radius),
  so the assertion reads `outerRadius`/`innerRadius`.
- `tests/viewer/pov.test.ts`, `tests/ranch/layout.test.ts` — in Touches.
- Two shipped props moved (magnolia, ginkgo) with the justification above; the
  Phase-1 snapshot records both.

## Notes for the next agent

1. **Everything waiting on a capture.** `ranch`'s Brachio head, the magnolia's
   clearance in `nest`, and whether the meadow now reads as an edge rather than a
   fence line are all judgements the shots make, not the tests.
2. **The ginkgo is the one thing to look at first.** If losing the Ranch frame's
   left canopy reads worse than the overlap it fixes, the alternative is a
   canopy model in the kit (a tree's box is solid from the ground, which is what
   AC-1 measures) — not a smaller box.
3. The Brachio's head room is computed from the GLB's bind-pose bounds. If the
   capture still crops it, the cause is the walk clip posing the neck above those
   bounds; FR-7's windows (aim ≤ 60 %, fov 48–52°, lens 10.6–11.4 m) are already
   at their useful edge, so that would need a recorded limit rather than a nudge.

## Rework 1

The first pass's instruments were right — the head is in frame, the magnolia is
out of the Nest sightline, the meadow holds more props — and the place still read
as props on a lawn. Four causes, all of them visible in the second capture set
(`.conductor/evidence/ranch-vista/after2/`), and one smaller: no cloud in any
frame, one flat green field, vegetation standing alone, a blank white windpump,
and a gate path that read as two painted stripes.

### What changed

- **Clouds are placed by the angle they subtend (FR-17).** The first pass put them
  at 1.05 × `GROUND_RADIUS_METRES` trimmed by a per-cloud altitude factor — 26–32 m
  up, at 24–40 m out, which is 30–40° above a lens standing 3 m up and looking
  down: they sat above the top of every frame, and `sky` saw them only where the
  white slabs appear at the bottom right. A cloud now carries a bearing, a
  distance and an elevation, and `cloudCentreMetres(spec)` puts its centre at
  `eye 3.2 m + tan(elevation) × distance`:

  | Cloud | Bearing | Distance | Elevation | Centre (x, y, z) | Scale | Drift |
  | --- | --- | --- | --- | --- | --- | --- |
  | 1 | 244° | 60 m | 9.5° | (−26.3, 13.2, −53.9) | 1.15 | 0.9 |
  | 2 | 282° | 66 m | 11° | (13.7, 16.0, −64.6) | 0.9 | 0.7 |
  | 3 | 333° | 58 m | 8° | (51.7, 11.4, −26.3) | 1.05 | 1.1 |
  | 4 | 56° | 62 m | 6.5° | (34.7, 14.7, 51.4) | 1.0 | 0.8 |

  The three ground lenses are 8–14° below the horizon (they look down at the
  animal), so their visible sky is a band of roughly 0–9° elevation: the specks
  are placed inside it, 58–66 m out so they read distant, and spread over four
  bearings that bracket the Ranch (256.2°), Nest (340.5°) and Garden (73.2°) axes.
  Projected through each preset at 1280×800 (centre pixel, and whether it lands
  inside the frame above that lens's horizon row):

  | Preset | Horizon row (ndc y) | Cloud pixels | Verdict |
  | --- | --- | --- | --- |
  | ranch | −0.099 | 1 → (449, 324); 2 → (931, 293) | two clouds in frame |
  | nest | +0.421 | 3 → (494, 119) | one cloud, upper left |
  | garden | +0.542 | 4 → (357, 85) | one cloud, upper left |
  | sky | — | none | overhead frame never reaches the horizon |

  Cloud 4's elevation came down from 10.5° to 6.5° after the first projection put
  it at y = 21 px, hard against the top edge of the Garden frame. Clouds stay
  flat-shaded, unlit boxes, shadow-free, drifting on the loop clock and bit-static
  under reduced motion; `CLOUD_DRIFT_BOUND_METRES` widened to six play radii so
  the far ones never wrap mid-frame.
- **The ground gets tones (FR-3 addition).** Five flush patches, each a
  `RingGeometry` disc with the same generated 128 px radial alpha ramp the worn
  discs use, so no edge catches a low lens, one material per tone (three
  materials, five draw calls):

  | Tone | Hex | Lightness vs field | Centre (x, z) | Radius |
  | --- | --- | --- | --- | --- |
  | yard | `#82b552` | −0.056 | (9.0, −2.1) | 4.2 m |
  | bleach | `#a2d38b` | +0.126 | (13.1, 3.7) | 9.0 m |
  | shade | `#72b84a` | −0.055 | (−6.1, 15.0) | 7.4 m |
  | shade | `#72b84a` | −0.055 | (−14.4, −4.1) | 6.8 m |
  | bleach | `#a2d38b` | +0.126 | (0.5, −14.2) | 8.2 m |

  The yard sits under the well, trough and pump (bearing 347°, where those three
  actually stand); the two bleached and two shaded stretches sit on the apron
  beyond the trefoil, spread so every ground lens and the overhead lens see at
  least one. All are within a seventh of the field's lightness — a meadow with
  weather in it, not a quilt. No image files.
- **The treeline is massed (FR-6).** Twelve singles spread over the ring read as
  a dotted line of palms; there are now three thickets of four or five
  overlapping props, varied in scale (0.95–1.25) and facing, with wide open arcs
  between them:

  | Mass | Props | Bearings / radii / scales |
  | --- | --- | --- |
  | south | 5 | cycad 152°/21/1.1 · tree fern 156°/23.5/1.15 · cycad 160°/19.5/1 · tree fern 164°/25/0.95 · cycad 168°/22/1.05 |
  | south-west | 5 | cycad 188°/25.5/1.25 · tree fern 193°/22.5/1.1 · cycad 198°/24/1.05 · tree fern 203°/26/1 · tree fern 208°/23/1.15 |
  | north | 4 | cycad 30°/19.6/1.2 · tree fern 33°/22.4/1.1 · cycad 36°/25/0.95 · tree fern 38°/27/1.05 |

  Seventeen treeline props (the three silhouette rhymes plus one cycad kept at
  160°/19.5, plus these thirteen), clustered as 5 / 1 / 1 / 4 / 1 / 5 around the
  ring. Every one still stands beyond 17.8 m, above 3 m tall at its own scale, and
  more than 25° off all three lens cones — the north mass overlaps along the
  radius rather than the bearing because the only wide safe arc there is a few
  degrees wide. `DressingPlacement` gained an optional `scale`, applied in
  `buildDressing`; both sightline kits (`pov.test.ts`'s `propBox` and the lateral
  clearance in `pov.test.ts` / `layout.test.ts`) now grow a box by its placement's
  scale, so a bigger clone is measured at the size it renders.
- **The windpump's colour, at the source.** The file is *not* white: it has one
  material, `pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.85 }`,
  with **no `baseColorFactor`**, no images and no textures, and four meshes
  (`tower`, `head`, `fan-wheel`, `tail-body`) whose every primitive carries
  `POSITION`, `NORMAL` **and `COLOR_0`**. The palette is entirely per-vertex —
  measured brown, R 0.19–0.73 > G 0.09–0.44 > B 0.02–0.20. `bakeToOneCall`
  merged the primitives into a material that had no `vertexColors` flag, so
  three.js ignored the attribute and painted the tower its material's white. The
  bake now turns `vertexColors` on for any merged buffer that carries a colour
  attribute. Two tests pin it: one drives the bake with a coloured two-mesh source
  and asserts the merged material keeps the flag, one reads the vendored file and
  asserts the single white material and the per-vertex timber palette.
- **A softer track.** The gate path's material is now `GROUND_GATE_PATH_HEX`
  (`#939d51`, `GROUND_DIRT_HEX` a third of the way back to grass, −0.119
  lightness against the field instead of the old full dirt), and three soft scuff
  discs at 26 %, 54 % and 79 % along the stub, each offset off the centre line by
  0.62 / −0.78 / 0.44 path widths at 0.85 of the path's half-width, break the
  straight edge so grass reads through it.

### Frame budget

`DRESSING_MANIFEST` 68 → **73 placements**; **76 draw calls in the dressing
group** (73 + 3, against the 150 ceiling) and **51,340 triangles in that group**
(ceiling 80,000) measured from the GLB bytes over the manifest. That figure is
the dressing group's, not the frame's: sky, ground, dinos, dust and sparkles are
not in it. The measured frame is available in the dev harness as
`window.__ranch.snapshot().drawCalls` / `.triangles`, read straight off
`renderer.info.render` (F3). The ground gains five patch calls and three scuff
calls, which is inside the ground's own budget; the aliveness and rotor calls
are unchanged.

### What the next capture should show

- `ranch`: the Brachio's head still inside the top edge, with one or two soft
  white clouds in the pale band above the horizon (they were absent before).
- `nest`: a cloud in the upper left, the magnolia still clear of the Trike, a
  massed clump of cycads and tree ferns where single palms stood.
- `garden`: a cloud over the left shoulder, the gate path reading as a worn track
  with grass showing through rather than two brown stripes, the tone patches
  visible as a faint shade shift on the apron.
- `sky`: no longer one flat disc — a bleached stretch, two shaded stretches and
  the dirt yard around the farm fittings, three clumped thickets on the rim
  instead of scattered singles, and a **brown** windpump instead of a white slab.
  (The white slab at the bottom right of the previous Sky capture was, in fact,
  cloud 2 — it projected to (996, 820) — so that corner should also read as sky
  now that the clouds sit at 8–11° instead of overhead.)

### Deviations (rework 1)

- `src/viewer/sky.ts`, `tests/viewer/sky.test.ts` — added to Touches by the rework
  brief; the cloud spec, `cloudCentreMetres`, `SKY_CLOUD_SPECS` and
  `CLOUD_DRIFT_BOUND_METRES` are now exported for the projection test.
- `src/ranch/dressing.ts`, `src/ranch/layout.ts`, `src/ranch/ground.ts`, and
  their tests — in Touches. `DressingPlacement` gained `scale`, so `layout.ts`'s
  `thicket()` helper and the two sightline kits in `tests/viewer/pov.test.ts` and
  `tests/ranch/layout.test.ts` grew a scale term.
- **`tests/ranch/_tmp-dump.test.ts` and `tests/ranch/_tmp-inspect.test.ts` must be
  renamed by the primary.** Both started as throwaway measurement dumps and were
  rewritten into real suites (rework-1's frame contract, and the windpump palette),
  but this agent's shell could not delete or `git mv` them (`Remove-Item`,
  `pnpm exec rimraf` and `git mv` are all outside its permissions). Suggested
  names: `tests/ranch/rework-1.test.ts` and
  `tests/ranch/windpump-palette.test.ts`. They lint, format, typecheck and pass
  as they stand.
- The two `bleach` patches sit at +0.126 lightness against the field — inside the
  brief's "a shade off the field", but the loudest of the five. If the capture
  reads them as pale flowers rather than dry grass, drop the mix from 0.25 to
  0.18.

### Verification (rework 1)

`pnpm verify` — exit 0. 614 tests in 50 files, coverage 82.21 % statements /
67.35 % branches / 83.40 % functions, audio pack 15 assets / 853,289 bytes,
precache 63 entries (6,700.76 KiB), dist clean.

## Rework 2

Base `b9113e1`. The primary's second capture pass (`after3/`) found the structure
right — clouds present, field toned, treeline massed, windpump coloured — and
four things wrong, all colour or placement:

1. The clouds read as grey-green concrete slabs with dark undersides.
2. The two `bleach` patches read as fog lying on the grass.
3. The gate path read as a brown smear, not a worn track.
4. The windpump stood in none of the four frames: at 28 m it sits past the Sky
   preset's own ground coverage, so FR-18's landmark was never seen.

Nothing else was touched: placements, bands, lens corridors, thickets, patch
count, sway, sparkle and every guard are as rework 1 left them.

### What changed

**Clouds — unlit, warm, two-tone (FR-17).** The palette was never the whole
problem; the *material* was. A `MeshStandardMaterial` under the scene's own
hemisphere light picked up the meadow's green bounce, which is what turned cream
into concrete, and its downward faces lost the sky and went dark. The clouds now
carry their colour themselves, exactly as the dome carries its gradient: one
shared unlit `MeshBasicMaterial` with `vertexColors` and `toneMapped: false`,
and a `color` attribute on the box geometry running from the base tone at each
box's underside to the cream at its top face. No light in the scene can reach a
surface that already knows its colour.

| Tone | Hex | Role |
|---|---|---|
| `CLOUD_TOP_HEX` | `#fffaf1` | cream body: R > G > B, blue at 0.95 |
| `CLOUD_BASE_HEX` | `#e7ebf3` | underside: slightly cooler, blue ≥ red, lightness 0.85 |

The previous base was `#dfe4ee`; it was lifted because the cooler tone read as
slate at 0.80 lightness. Positions, sizes, drift speeds and the reduced-motion
freeze are untouched, so the per-preset projection is rework 1's, unchanged:

| Cloud | Bearing / distance / elevation | Centre (x, y, z) m | Seen in |
|---|---|---|---|
| 1 | 244° / 60 m / 9.5° | (−26.3, 13.2, −53.9) | `ranch` (449, 324 px) |
| 2 | 282° / 66 m / 11° | (13.7, 16.0, −64.6) | `ranch` (931, 293 px) |
| 3 | 333° / 58 m / 8° | (51.7, 11.4, −26.3) | `nest` (494, 119 px) |
| 4 | 56° / 62 m / 6.5° | (34.7, 14.7, 51.4) | `garden` (357, 85 px) |

`ranch` therefore sees two, `nest` and `garden` one each, and `sky` none — its
75° lens looks at the ground, and the clouds sit above its top edge. That is
correct: the overhead frame is a plan of the ranch, not a sky portrait.

**Field tones — a bleached stretch is a shade, not fog.** The mix toward the
horizon tone dropped from a quarter to a fifth, and the two bleached patches
shrank from 9 m and 8.2 m radius to 7.2 m and 7 m:

| Patch | Hex | ΔL vs field | Radius |
|---|---|---|---|
| field | `#7ec850` | — | L = 0.329 |
| yard (dirt) | `#82b552` | −0.056 | 4.2 m |
| bleach | `#99d07e` | **+0.091** (was +0.126) | 7.2 m / 7.0 m |
| shade | `#72b84a` | −0.055 | 7.4 m / 6.8 m |

Shade and yard are unchanged; only the bleach pair moved. Five patches, same
count, same centres.

**The gate road — a strip with an edge, not a blur (FR-4).** Two changes:

- The path tone came back toward the grass: `GROUND_GATE_PATH_HEX` is now
  `mix(#9c7f52 dirt, #7ec850 grass, 0.45)` = `#8fa551`, ΔL −0.100 against the
  field (was `#939d51`, −0.119 at a 0.34 mix).
- The `'length'` alpha ramp is retired. The path and both ruts now share a
  generated `'track'` ramp: solid across the middle 45 % of the width, softening
  over the remaining shoulders, with only the last 6 % of the length fading out.
  A strip that holds its middle reads by its shoulder; the old ramp faded from
  the centre line outward, which is what made it a smear.

The three offset scuff discs are replaced by **two hoof-worn spots down the
centre line**, at 32 % and 66 % of the stub, each 0.42 × the path's width, tone
`mix(path, dirt, 0.35)`, drawn at order 3 so they sit on the track instead of
beside it. Both sit inside the strip, which `tests/ranch/ground.test.ts` now
asserts by measuring each spot's perpendicular distance from the centre line
against half the path width.

**The windpump — moved where a camera can see it (FR-18).** Rework 1's colour fix
was invisible because the placement was out of frame:

| | Old | New |
|---|---|---|
| Bearing / radius | 210° / 28 m | **142° / 22 m** |
| Position (x, z) | (−24.25, −14.00) | **(−17.34, 13.54)** |
| In the `sky` frame | no — past its ground coverage | **yes: base (203, 230) px, top (151, 161) px** |

At 142° it stands 2.6 m inside the overhead frame's edge, more than 100° off all
three ground lens axes (256.2°, 340.5°, 73.2°), still beyond the treeline band's
17.8 m floor and still inside the meadow's 48.18 m edge. `tests/viewer/sky.test.ts`
projects its base and cap through the `sky` preset and asserts both land within
90 % of the frame. The move costs nothing in geometry: the same one prop, the
same GLB, the same draw call.

**Dressing-group budget after the move:** 73 placements, 76 draw calls
(`DRESSING_MANIFEST.length + 3`, the group's arithmetic, not the frame's),
51,340 triangles — unchanged, since a move is not a placement and the cloud
meshes swapped two shared materials for one.

### What the next capture should show

- **Ranch:** two soft cream clouds, pale underneath, floating in the pale sky
  band above the horizon — no grey, no green, no dark belly.
- **Nest and Garden:** one cloud each in the same band.
- **Sky:** the bleached stretches read as dry grass, not as fog lying on the
  green; five patches still break the field; the worn trefoil and the track are
  the only hard-edged marks.
- **Garden (and Ranch):** the gate road is a strip of worn green-brown with a
  traceable edge and two darker hoof spots along it, not a smear; the grass
  shows at its shoulders.
- **Sky:** the windpump stands in the upper-left quadrant, whole — tower, head,
  and a turned fan — its brown timber palette visible rather than a white slab.

### Deviations (rework 2)

- `src/ranch/ground.ts`, `src/viewer/sky.ts`, `src/ranch/layout.ts` and their
  tests — all in Touches. `CLOUD_BASE_HEX` was lightened inside the brief's
  "very slightly cooler underside"; the brief's own 0.80-lightness floor is
  what the test pins, and `#dfe4ee` missed it at 0.796.
- `DECAL_PATH_FADE_END` and the `'length'` ramp are gone rather than kept
  alongside `'track'`: a second unused branch is coverage the suite pays for and
  nothing draws.
- No throwaway test files remain. The rework-1 sweeper that only logged landmark
  candidates was replaced by the real assertion in `tests/viewer/sky.test.ts`,
  and the temporary `console.log` dumps used to read the ΔL and pixel numbers
  above are removed.

### Verification (rework 2)

`pnpm verify` — exit 0. 617 tests in 50 files, coverage 82.31 % statements /
67.35 % branches / 83.40 % functions, audio pack 15 assets / 853,289 bytes,
precache 63 entries (6,700.94 KiB), dist clean.

## Review fixes

Base `a12515e` — the review's ten findings, worked in order, fixing causes where
the cause was reachable and recording a limit where a rule could not be met. One
row per finding; the number that proves it is in the third column.

| # | Fix | Proof |
|---|---|---|
| F1 (major) | The sprig test measures the bearing in the lens's frame now — `bearingDegrees(lens, groundXZ(item.position))` against `bearingDegrees(lens, groundXZ(preset.lookAt))` — and both offenders moved: **wildflower 100° → 130° (25° clear)**, **club-moss 285° → 320° (20° clear)**, both at 13 m. The old form measured the sprig's polar bearing from the ranch origin against the lens's forward bearing and passed by coincidence. | The rewritten test failed first with exactly two findings — `garden: wildflower-68d3a1.glb at 13.0 m sits 8.4 deg off its axis` and `ranch: club-moss-mat-edcb1b.glb at 13.0 m sits 6.9 deg off its axis` — then went green with the moves. Rule untouched at ±18°. |
| F2 (major) | Aim was tried at FR-7's ceiling (60 %) and **measured worse**: the frame tilts up, which moves the whole animal *down*, so the head gained ~28 px while the paws lost ~30. Aim stays 0.55 and the **Nest lens moved 10.8 m → 11.4 m** (the window's far end). The nearest-stance test now asserts the **full** HUD inset on all four edges for all three ground lenses, and pins the two overflows FR-7 cannot close in `WALK_STANCE_OVERFLOW_PX`. | Nearest stances: Ranch 8.15 m → head at 62 px (34 px into the 96 px top inset), paws at 789 px (111 px past the 680 px limit); Nest 5.84 m → **0 / 0, 11 px to spare**; Garden 4.39 m → paws 94 px past. An exhaustive sweep of the whole FR-7 box (aim 0.55–0.60, lens 10.6–11.4, eye 3.0–3.4, fov 48–52) reports **no legal fit** for Ranch (needs 64° at 12.0 m) or Garden (52° at 12.0 m); the Brachio spans 727 px of an 800 px frame at its nearest stance, so a 216 px inset pair cannot both be met. |
| F3 (medium) | The arithmetic proxy is renamed for what it is — `keeps the dressing group under the draw-call and triangle ceilings (a per-prop guard, not the frame)` — and the frame is now measured: `snapshot()` carries `drawCalls` and `triangles`, `harness.ts` fills them from `renderer.info.render` (the same numbers the panel already printed), and a test drives the bridge to prove the plumbing. `verification/phase-3.md` and this file now say "dressing group" wherever they used to imply the frame. | `tests/dev/snapshot.test.ts` asserts `drawCalls: 61 / triangles: 37_600` survive the copy; `tests/dev/harness-panel.test.ts` sets `renderer.info.render.calls = 87`, `triangles = 41_234` and asserts the snapshot reports them. Dressing group: 73 placements, `DRESSING_MANIFEST.length + 3 = 76` calls under the 150 ceiling, 51,340 triangles under 80,000 — plus the one extra call F6 spends on the fan, so 77 in that group by the same arithmetic. |
| F4 (medium) | Catalogue comments now name all three mid-band height exceptions (`#1 of three (FR-13)` plum, `#2 of three (FR-15)` reeds, `#3 of three (FR-14)` signpost), `MID_PROP_MAX_HEIGHT_METRES`'s docblock scopes the cap to the props this track added and says the shipped seven are measured but not capped, and the describe/exception docblocks record that the rhyme exemption belongs in FR-6's text. **`spec.md` could not be edited — the edit tool is denied for that path (see Blockers).** | `tests/ranch/layout.test.ts` 32 tests green; the exception list, catalogue comments and cap docblock now agree on three named exceptions and a cap scoped to new props. |
| F5 (medium) | AC-13 is measured: a new test projects each corner's props and the animal through its own preset and asks for a 72 px clear approach per prop. Two corners pass; **Stego's three props are cropped by the frame** and the test pins the exact pixels instead of asserting a number that cannot hold. | `gives every corner a clear 72 px approach, and records the one crop (AC-13)` — findings pinned as `stego #0 garden-rock -172 px`, `#1 log-stump -216 px`, `#2 garden-rock -323 px`; Ranch and Nest corners report zero findings. A sweep of in-band, in-corner placements (195–240° at 8.4–10.2 m) never gets better than **−10 px at 210°/8.4 m**, so the 72 px is unsatisfiable for that corner under FR-6's mid band plus FR-7's windows. |
| F6 (medium) | The rotor is found **before** the bake: `bakeToOneCall(root, keep)` now merges around a protected sub-tree and merges the kept sub-tree in place, so the fan's meshes survive under their own node instead of being flattened into the root. | `finds the fan by the GLB's own node name, with geometry still under it (review F6)` reads `windpump-tower-1633a9.glb`, takes `wheel`/`fan-wheel` out of its own `nodes[].name` list, and asserts the returned rotor **is** that node, holds exactly one merged `Mesh`, and its ancestor chain reaches `RanchDressing`. Cost: one extra draw call in the dressing group. |
| F7 (medium) | **`plan.md` could not be edited — same denial (see Blockers).** Phase 6 still reads `pending` with T1/T2 open although the captures and the doc sync landed. | Nothing in the repo to point at; the intended edit is quoted verbatim under Blockers. |
| F8 (nit) | `hudOwnsPointer` is gone from `TapGuards`, `allowsPropTap` and the tap handler — it could never be true, because the listener is on the canvas and a tap the HUD owns never arrives. The two test cases that locked it in collapsed to one, and the source scan now asserts the flag is **absent**. | `tests/ranch/ambient.test.ts`: one guard test (`{sleepy:false}` true, `{sleepy:true}` false), plus `expect(source).not.toContain('hudOwnsPointer')`. |
| F9 (nit) | The snapshot fixture says what it is — **ten of twelve unmoved, two moved deliberately** — the test is renamed to match, and the ginkgo entry now carries its own annotation (measured 5.69 m canopy, 0.75 m off the Ranch sightline, 92°/9.8 m) alongside the magnolia's. | `holds ten of twelve props where they shipped, two moved deliberately`; both moved entries annotated in place. |
| F10 (nit) | The loop's dressing hook is relabelled **FR-11, FR-12, FR-18** and says it advances sway, sparkles and the fan; its imports are back in the file's alphabetical blocks (`dressing` before `waddle`, type import beside value import). | `src/viewer/loop.ts` import block is alphabetical again; the `LoopView.dressing` docblock names all three moving parts. |

### New sprig bearings (F1)

| Sprig | Was | Now | Clearance at the lens |
|---|---|---|---|
| `wildflower-68d3a1.glb` | 100° / 13 m | **130° / 13 m** | 8.4° → **25°** |
| `club-moss-mat-edcb1b.glb` | 285° / 13 m | **320° / 13 m** | 6.9° → **20°** |

The other eight sprigs stand where they stood (club-moss 34°, 117.6°, 216°,
145°/12.4 m; wildflower 165.6°, 215°, 200°/12.8 m, 40°/12.9 m).

### Aim per lens and the full-inset margin at the nearest stance (F2)

| Lens | lens / eye / fov | aim (% of head height) | nearest stance | head | paws | inset result |
|---|---|---|---|---|---|---|
| Ranch | 11.4 m / 3.4 m / 52° | 55 % → 3.974 m | 8.15 m | 62 px | 789 px | 34 px into top chrome, 111 px past bottom — **pinned limit** |
| Nest | **11.4 m** (was 10.8) / 3.0 m / 50° | 55 % → 1.236 m | 5.84 m | 353 px | 658 px | inside every inset, **11 px to spare** |
| Garden | 11.1 m / 3.2 m / 48° | 55 % → 1.245 m | 4.39 m | 376 px | 772 px | sides and top clear, paws 94 px past — **pinned limit** |

The pinned overflows are the review's own conclusion, measured rather than
asserted: FR-7's aim headroom does not buy the inset because raising the aim
tilts the frame up and pushes the animal down. Widening FR-7 or shortening the
3.71 m walk circle is the owner's decision; the test keeps the composition from
quietly worsening in the meantime.

### Frame budget after F6

- Dressing group: **73 placements**, `DRESSING_MANIFEST.length + 3 = 76` calls,
  **51,340 triangles** — and one more call for the fan F6 keeps turnable, so 77
  in that group. The ceilings are 150 and 80,000.
- The **frame** is no longer inferred: `snapshot().drawCalls` and
  `.triangles` read `renderer.info.render` after the draw, and the dev panel
  prints the same pair. Per-preset frame numbers are read off that panel in the
  next capture rather than reasoned about here.

### What the next capture should show

- **Ranch / Nest / Garden:** the same compositions as `after3/`, minus two sprigs
  that have moved out of the lens corridors — nothing else in these frames should
  have shifted, since the only other changes are the Nest lens standing 0.6 m
  further back (the Trike reads ~5 % smaller, better framed vertically) and the
  windpump's fan now visibly turning.
- **Sky:** the windpump's fan turns instead of standing still behind a duplicate
  fallback fan.
- The dev panel's call/triangle pair, if the primary captures with `?dev=1`,
  is the honest frame number this document no longer guesses at.

### Deviations (review fixes)

- `tests/ranch/ambient.test.ts` lost two cases rather than gained any: the guard
  truth table is one bit now that `hudOwnsPointer` is gone. That is the finding,
  not a weakened test — the removed rows asserted a state the app cannot enter.
- `tests/viewer/pov.test.ts` carries a recorded limit rather than a green
  assertion: `WALK_STANCE_OVERFLOW_PX` pins Ranch and Garden at their nearest
  stance. The review asked to stop and report if no legal fit existed; the sweep
  says none does, so the numbers are here and the test pins them.
- Commits: `f828842` (F1), `6c15e3f` (F2), `110889d` (F3), `e43b935` (F4, code
  side), `4179b50` (F5), `02918de` (F6), `22d5c3f` (F8–F10).

### Verification (review fixes)

`pnpm verify` — exit 0. **621 tests in 50 files**, coverage 82.44 % statements /
67.78 % branches / 83.53 % functions, audio pack 15 assets / 853,289 bytes,
precache 63 entries (6,701.15 KiB), dist clean.

### Blockers (review fixes)

Two findings needed files this agent cannot write — the edit tool is denied for
both paths, and the denial is not transient. The exact text to apply is below.

1. **F4 — the FR-6 amendment in `spec.md`.** Replace the FR-6 paragraph with:

   > Mid props are at most 1.4 m tall and stand 8.4–10.2 m out, with exactly three
   > named height exceptions — the plum browse tree (FR-13), the reeds at the
   > wallow edge (FR-15) and the signpost (FR-14) — and the height cap applies to
   > the props this track added; the twelve that shipped are measured but not
   > capped. Foreground sprigs are at most 0.5 m tall, stand 11.5–14 m out and
   > never sit inside ±18° of a lens axis, measured at the lens. Treeline props are
   > at least 3 m tall and stand beyond 17 m, outside every lens cone — but for the
   > one silhouette rhyme each ground preset asked for (FR-16), which is exempt
   > from the cone rule and from that rule only.

2. **F7 — the Phase 6 task states in `plan.md`.** Set the phase's `**Status:**`
   to `in_progress`, tick **P6.T1** (`Captures`, both subtasks — captured against
   `07fda93` and its two reworks) and **P6.T2** (`Doc sync`, both subtasks —
   `79ac2e8`), and leave **P6.T3** and **P6.T4** open; the PR body and the
   integrated verification are the primary's.


