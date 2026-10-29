# Ranch Vista: Staged Paddock and Sky POV — Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

The ranch is currently one flat 12.05 m grass disc with twelve props scattered on
a single 8.55–9.8 m ring, three dinos wandering near the middle, and three fixed
cameras that stand *outside* that ring (15.2–17.8 m out, 4.6 m high, 40° fov). The
result is three shots in which tall props stand between the lens and the animals,
the middle distance is empty, and the edge of the world is visible against a flat
blue sky. This track restages the ranch as a paddock with depth — worn middle,
low midground props, foreground sprigs, a distant treeline standing on a meadow
apron — retunes the three ground lenses so the view is wide and unobstructed, adds
a fourth tilted-helicopter POV so the whole ranch can be seen at once, and gives
the dressing a little life (quiet sway, one sparkle per tap).

## Problem / Motivation

A four-year-old sees the same three shots many times a session. Today those shots
have three measurable defects:

- **Props block the lens.** The 6.1 m flowering magnolia at 113° sits 28° off the
  Nest axis and fills the right half of that frame; the 7.59 m dawn redwood eats
  the right third of Ranch. The existing sightline test only checks a
  ground-level line from lens to one subject point, so it passes while the shot is
  spoiled.
- **Animals are cropped.** `lookAt` sits at `bodyLength / 2` (1.86 m for Brachio)
  while the head is near 4.6 m, so Brachio's head touches the frame top in Ranch
  and Stego's tail leaves the frame in Garden.
- **The world has no depth.** The grass disc ends mid-frame against flat sky, and
  the flat `0x9fd4ef` background is roughly 40 % of every ground shot.

There is also no way to see the ranch as a whole, which is exactly what a parent
and a child want when they ask "where is everybody?". The roadmap's next three
tracks (feed, wash, surprises) each need a visible, unobstructed place to happen;
none of those places exist yet.

If this is not solved, the art ceiling is set by a scatter ring: every future prop
has to fight the same ring for space, and every future interaction has to be
dropped somewhere arbitrary.

## Goals & Success Metrics

- **Goal:** four cameras, each with a wide and unobstructed view of a ranch that
  reads as a place.
- **Metric:** the screen-space occlusion test passes for all four presets (no prop
  nearer than the subject overlaps the subject's bounding box); no preset shows
  background colour inside the frame; each focus animal is fully inside the
  HUD-safe area and at least 40 % of frame height; each dino is at least 72 px
  across in the Sky view at 1280×800.
- **Goal:** the props earn their place.
- **Metric:** every mid-band prop belongs to a corner, the water line or the farm
  run; every scatter element has a recorded parent; dressing is at most 4 MB and
  the precache stays under 15 MB.
- **Goal:** the dressing feels alive without becoming a toy.
- **Metric:** a tap on any prop answers within 100 ms with exactly one sparkle per
  250 ms, and never changes walk, POV, sleepy or audio-lock state.

## Scope

### In Scope

- A declarative layout module: bands, seeded scatter, and per-file metadata
  (footprint, height, band, parent) replacing hand-written position arrays.
- A meadow apron around the play disc so no camera sees the edge of the world.
- Ground wear derived from the gait geometry: a trefoil of worn discs on the three
  homes, a dirt stub from the farm gate, and trackway decals at the junction.
- A sky with depth: vertical gradient plus four chunky drifting clouds.
- About fourteen new vendored Polyfork props across three bands, staged as three
  corners (Brachio's, Trike's, Stego's) plus a shared centre.
- A water line: hand pump → trough → flush stone gutter along the mid band →
  Stego's wallow.
- Cause-and-effect scatter (litter under its tree, mushrooms under the redwood,
  reeds at the wallow) and per-camera silhouette rhymes.
- A fourth `sky` POV (75° tilt) with a fourth nav button, plus retuned optics on
  the three ground presets.
- Quiet sway on corn, reeds and leaf litter; one sparkle per tap on any prop.
- A screen-space occlusion and coverage test kit, and doc/CREDITS sync.

### Out of Scope

- Ambient critters (chickens, ducks, dragonflies). Rigged animals import the whole
  clip-bake pipeline; they belong in a later "Ranch Life" track.
- Any feeding, washing, cuddling or surprise behaviour. This track only reserves
  and frames the places those tracks will use.
- Texture painting, atlases, normal maps, ambient occlusion baking.
- Free orbit, pinch-zoom, or any camera the child can move.
- `Idle` / `Run` clips, new dino animation, new voice lines.
- A navigable map or tap-to-teleport in the Sky view.
- Species renames, palette changes, ACES tone mapping.

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Dressing placements are produced by a declarative layout module: bands (mid, foreground, treeline), seeded scatter helpers, and per-file metadata `{footprintMetres, heightMetres, band, parent?}`. No hand-written position array for a banded prop. | must |
| FR-2 | The phase-1 refactor is pixel-identical: the twelve shipped props keep their exact position and rotation. | must |
| FR-3 | The ground extends to a meadow apron of at least three times the play radius, in two tones with a seam that no preset can see, and no preset shows the geometry edge inside the frame. | must |
| FR-4 | Ground wear is derived, not drawn by hand: one worn disc per dino, centred on its spawn position with radius equal to its gait wander radius; a dirt stub from the farm gate into the wear; two trackway decals where the stub meets it. | must |
| FR-5 | At least fourteen new Polyfork GLBs are vendored under `public/models/dressing/`, each with footprint and height metadata and a `CREDITS.md` row recording source, licence and processing. | must |
| FR-6 | Band rules are enforced in code and by test: mid band props are at most 1.4 m tall and stand between 8.4 m and 10.2 m; foreground sprigs are at most 0.5 m tall, stand between 11.5 m and 14 m, and never inside ±18° of a lens axis; treeline props are at least 3 m tall and stand beyond 17 m, outside every lens cone. | must |
| FR-7 | The three ground presets keep their bearings (58°, 141.6°, 240°), gain a per-preset vertical fov between 48° and 52°, a lens between 10.6 m and 11.4 m from the centre, an eye height between 3.0 m and 3.4 m, and a `lookAt` at 55–60 % of the focus animal's height. | must |
| FR-8 | A fourth preset `sky` frames the whole play disc plus meadow margin from a 75° tilt with no background colour in frame, and every dino is at least 72 px across at 1280×800. | must |
| FR-9 | The POV nav grows to four 72 px buttons (`Ranch`, `Nest`, `Garden`, `Sky`), keeps `aria-pressed` in sync, keeps the portrait lift, and `hud.ts` selects presets through `POV_PRESETS` instead of a hardcoded id list. The dev harness derives its POV buttons from `POV_ORDER` and the snapshot type widens to include the new id. | must |
| FR-10 | `applyPovPreset` applies fov and `updateProjectionMatrix` as well as position and look direction, and the render loop never writes the camera. | must |
| FR-11 | Corn, reeds and leaf litter sway on a per-object sine whose phase comes from the seeded random stream; every sway is disabled under `prefers-reduced-motion: reduce`. | must |
| FR-12 | A tap on any dressing prop plays exactly one `sparkle` SFX and one sparkle burst, with a 250 ms per-prop cooldown, no hearts, no voice line, no hearts counter, and no interference with the Walk button, the POV nav or the sleepy overlay. It honours the audio lock (no AudioContext before a user gesture). | must |
| FR-13 | The ranch is staged as three corners plus a shared centre: Brachio's corner (trough and browse tree) framed by Ranch, Trike's hay nest framed by Nest, Stego's wallow and ferns framed by Garden, and the twinkle spot where the three worn discs meet. Each corner keeps a clear approach of at least 72 px in its own preset. | must |
| FR-14 | A continuous water line runs from the hand pump to the trough, then along the mid band as a flush stone gutter to Stego's wallow. No gap along the line; the gutter sits within 0.06 m of the ground. | must |
| FR-15 | Scatter is cause-and-effect: ginkgo litter under the ginkgo, mushrooms under the redwood, ferns under the magnolia, reeds at the wallow edge. Every scatter placement records its parent prop. | must |
| FR-16 | Each ground preset has a silhouette rhyme: one backdrop prop within ±25° of that preset's subject bearing, further from the lens than the subject. | must |
| FR-17 | The sky carries a vertical gradient (pale at the horizon) and four chunky clouds that drift slowly, cast no shadows, make no sound, and hold still under reduced motion. | must |
| FR-18 | The sky's horizon carries one distant landmark, the Cozy Farm windpump tower, on the meadow apron with a slowly turning blade group. Withdrawn with a recorded reason if its rig cannot be driven without a new bake. | should |
| FR-19 | A test kit covers screen-space occlusion, band rules, apron edge, sky coverage, gutter continuity, scatter parentage, rhyme angles and the perf/byte budget. | must |
| FR-20 | Documentation is synced: `product.md` (four POVs, roadmap line), `product-guidelines.md` ("4 POV buttons"), `tech-stack.md` (new modules and constants), `CREDITS.md` (new assets). | must |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | 60 fps on a newer tablet: fewer than 150 draw calls, fewer than 80k triangles, dressing at most 4 MB, precache under 15 MB. |
| NFR-2 | No new runtime dependency and no network at runtime; every new GLB is vendored and precached. |
| NFR-3 | 72 px minimum targets; every new control carries an icon and an English word; colour is never the only signal. |
| NFR-4 | Daylight palette unchanged, no ACES tone mapping, no flashing above 3 Hz, no new sound that plays unprompted. |
| NFR-5 | Every geometry constant is derived (clearance, footprint, bearing, radius), never a bare number; a test fails if a prop enters a lens cone. |
| NFR-6 | `pnpm verify` exits 0 and the 60 % new-code coverage floor holds. |
| NFR-7 | Sway and tap reactions are inert under reduced motion (except the sparkle) and silent before the first gesture. |
| NFR-8 | Captures at `/?dev=1&seed=42&pause=1` stay deterministic: cloud drift and sway advance only from the paused clock. |

## Acceptance Criteria

| ID | Criterion | Verifies |
| --- | --- | --- |
| AC-1 | For every preset, projecting every prop's bounding box into that camera shows no prop nearer than the subject overlapping the subject's box, and the subject sits fully inside the HUD-safe area. | FR-6, FR-7 |
| AC-2 | In `sky`, every pixel of the frame below the horizon is ground, and the play disc is fully inside with at least 5 % margin. | FR-8 |
| AC-3 | Every dino is at least 72 px across in `sky` and in the preset that frames it, at 1280×800. | FR-7, FR-8 |
| AC-4 | Four nav buttons render at 72 px, `aria-pressed` follows the active camera, and the portrait lift still applies. | FR-9 |
| AC-5 | Phase 1 changes no rendered geometry: the placement snapshot is identical before and after. | FR-2 |
| AC-6 | Each worn disc's centre equals its species' spawn position and its radius equals that species' wander radius. | FR-4 |
| AC-7 | No preset sees the ground edge, and the apron radius is at least three times the play radius. | FR-3 |
| AC-8 | Dressing bytes, precache bytes, draw calls and triangles are inside the NFR-1 limits in the dev snapshot. | NFR-1 |
| AC-9 | A tap on a prop plays exactly one sparkle per 250 ms and leaves walk, POV, sleepy and mute state untouched. | FR-12 |
| AC-10 | With reduced motion the props are static and the sparkle still fires. | FR-11, FR-12 |
| AC-11 | `pnpm verify` exits 0 and the dist-clean gate still passes. | NFR-6 |
| AC-12 | The PR body carries Ranch, Nest, Garden and Sky shots with alt text. | FR-20 |
| AC-13 | Each corner's props are framed by its own preset and leave a clear approach of at least 72 px. | FR-13 |
| AC-14 | Walking the gutter samples from the pump to the wallow finds no gap and no point above 0.06 m. | FR-14 |
| AC-15 | Every scatter placement's centroid is within 1.5 m of its recorded parent. | FR-15 |
| AC-16 | Each preset's rhyme prop is within ±25° of the subject bearing and further from the lens than the subject. | FR-16 |
| AC-17 | The sky gradient and four clouds exist; clouds cast no shadow; both are static under reduced motion. | FR-17 |
| AC-18 | The windpump is present with a turning blade group, or `FR-18` is marked Withdrawn with the reason recorded in the spec and the plan. | FR-18 |

## Edge Cases

- **A prop GLB fails to load.** The existing behaviour holds: log one warning,
  keep the rest, resolve the summary with the failure list; a missing corner prop
  must not break the occlusion test (the test reads the manifest, not the scene).
- **Tap lands on the HUD.** The button wins: props are raycast only after the DOM
  target check, so Walk and the POV nav never swallow a sparkle or vice versa.
- **Tap during the sleepy overlay.** No sparkle and no chime; the overlay keeps
  its calm.
- **Audio still locked.** The first tap both unlocks the engine and sparkles, in
  that order, so the chime is not lost.
- **Short or portrait viewport.** Sky framing is computed from the projected disc,
  not a fixed height, so a 4:3 or portrait tablet still shows the whole ranch.
- **Overhead sightline test.** The sky preset's lens→target ground vector is
  zero-length; the test must treat an overhead preset by kind, never by dividing
  by zero.
- **Reduced motion.** Sway and cloud drift freeze; the tap sparkle still fires
  because it is feedback, not decoration.
- **Offline first load.** New GLBs are in the precache manifest; the 15 MB cap and
  `check-dist-clean` still pass.
- **Two tracks editing `tracks.md`.** Keep both registry lines.

## Dependencies

- **Tracks:** none. All eleven tracks are archived, `main` is green, and the
  branch is cut from the current `main` tip (which carries the PR-media doc
  commit `0d4e56c`).
- **External:** Polyfork free asset downloads (no key required) and `gh` 2.103.0
  for `--attach` at PR time.

## Open Questions & Assumptions

- **Question:** should the four corner signposts eventually carry pictograms
  (feed / wash / cuddle / twinkle)? Deferred until those tracks define them.
- **Assumption:** the Sky height and fov are tuned against projection tests rather
  than fixed in this spec; acceptance is by AC-2 and AC-3, not by a magic number.
- **Assumption:** sway is silent. An audio rustle would add unprompted sound,
  which NFR-4 forbids.
- **Assumption:** free Polyfork assets fall under the existing CC0/Apache policy
  already recorded for the twelve shipped props; each new file still gets its own
  `CREDITS.md` row.
- **Assumption:** the `sparkle` SFX already in the catalog is the right sound for
  a prop tap; no new audio asset is produced.

## References

- `conductor/product.md` (cozy sandbox, forever-babies, day only, no fail states)
- `conductor/product-guidelines.md` (72 px targets, every tap answers, icon + word)
- `conductor/tech-stack.md` (three 0.186, Vite 8, precache budget, Polyfork)
- Live frame evidence: Ranch, Nest and Garden captures at
  `/?dev=1&seed=42&pause=1`, 1280×800, 2026-10-30 (see
  `.conductor/evidence/ranch-vista/before/`)
