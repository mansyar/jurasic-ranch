# Phase 3 — Prop library and composition

| | |
|---|---|
| Track | `20261030-ranch-vista` — Ranch Vista: Staged Paddock and Sky POV |
| Phase | 3 — Prop library and composition |
| Date | 2026-10-30 |
| Branch | `feat/20261030-ranch-vista` |
| Base | `ebccb2d` (`conductor(plan): Mark phase 'Prop library and composition' as in progress`) |
| Head | `299fe51` (code; this report is the commit on top) |
| Result | **Content pass, one gate outstanding** — 567 tests in 47 files, `tsrs` clean, `oxlint` clean, build ok (precache 63 entries / 6,692.49 KiB). `pnpm verify` stops at `oxfmt --check`, which reports two files (`src/ranch/layout.ts`, `tests/ranch/layout.test.ts`) as unformatted. Running the fixing formatter (`pnpm format`) is not an available command for this phase, so formatting is handed to the primary. Nothing else in `pnpm verify` was seen to fail; the steps after the formatter could not run (`pnpm coverage` and `node scripts/check-dist-clean.mjs` are also not available to this subagent). |

## What this phase establishes

The prop library is data, not a hand-written array. Every new prop goes through
`ring` / `arc` / `row` / `cluster` / `scatter` in `src/ranch/layout.ts`, its
footprint and height come from its own GLB (accessor bounds, read by
`tests/ranch/dressing-files.ts`), and its band comes from
`DRESSING_BAND_RANGES`. The composition is then three claims a test can hold:

- **Three corners on the trio's own bearings** (`CORNER_AZIMUTH_DEGREES` is
  derived from `TRIO_SPAWN_ANGLES_RADIANS`, so a moved spawn moves its corner).
- **A water line with no gap**, sampled 401 times between the pump and the
  wallow, with the flush limit asserted on the geometry's own offset.
- **Cause and effect**: each scatter cluster records its parent in the
  catalogue, and every placement *and* every cluster centroid is asserted within
  1.5 m of a placement of that parent.

The band cap is enforced on this phase's props only. The twelve shipped props
are grandfathered by the phase-1 1e-9 snapshot: the 20 m redwood has always
stood at 9.8 m, and moving it to satisfy a new cap would break FR-2. Three new
mid-band props exceed the 1.4 m cap deliberately and are pinned, one line each,
in `MID_HEIGHT_EXCEPTIONS` — a fourth cannot be added without writing it down:

| File | Height | Why |
|---|---|---|
| `plum-tree-565179.glb` | 3.13 m | FR-13: the browse tree the Brachio walks towards |
| `river-reed-cluster-cba87e.glb` | 1.89 m | FR-15: reeds standing in the wallow edge |
| `signpost-0bf523.glb` | 1.97 m | FR-13: the farm marker that frames the Brachio's corner |

## Commands

| Command | Result |
|---|---|
| `pnpm test` | exit 0 — 567 passed, 47 files |
| `pnpm typecheck` | exit 0 — `tsrs --noEmit` silent |
| `pnpm build` | exit 0 — precache **63 entries, 6,692.49 KiB** (was 45 entries / 5,076.73 KiB) |
| `pnpm verify` | **exit 1** — `oxlint` clean, `oxfmt --check` reports `src/ranch/layout.ts` and `tests/ranch/layout.test.ts`; the chain stops there, so typecheck/coverage/build/dist-clean did not run *inside that command* |
| `pnpm coverage` | not available to this subagent (permission denied) |
| `node scripts/check-dist-clean.mjs` | not available to this subagent (permission denied) |
| `pnpm format` | not available to this subagent (permission denied) — the primary runs it |

## Acceptance criteria

### FR-5 — fourteen new vendored props

- **18 new GLBs** vendored under `public/models/dressing/` (requirement: ≥ 14),
  plus the twelve that shipped = 30 files, each with a `CREDITS.md` row.
- Bytes: **2,795,700 B** across the 30 files (new files 1,642,356 B); under the
  4 MB dressing budget. Largest single file 196,424 B, far under the 4 MB
  per-file precache ceiling.
- Every new file's `footprintMetres` (max of measured width and depth) and
  `heightMetres` are asserted against the file's own accessor bounds at one
  decimal — not against the vendor sheet.
- The vendor script is boring on purpose: Node 22, no dependencies, literal id
  list, `glTF` magic and version 2 checked before writing, existing files kept
  unless `--force`, one summary table, non-zero exit on any failure.

### FR-6 / NFR-5 — band rules in code and in test

| Claim | Asserted value |
|---|---|
| Mid band window | 8.4 – 10.0 m |
| Foreground window | 11.6 – 13.8 m |
| Treeline window | 17.8 m – ∞ |
| Mid cap (new props) | ≤ 1.4 m, bar the three pinned exceptions above |
| Foreground cap | ≤ 0.5 m (tallest sprig: wildflower 0.40 m) |
| Foreground off-axis | ≥ 18° from every preset's lens axis (closest: 22.2°) |
| Treeline floor | ≥ 3 m, > 17 m (tree fern 9.36 m, cycad 3.2 m, windpump 7.75 m) |
| Treeline in cones | outside every lens cone (± 25°), except the one rhyme per preset |

Every band is read from `DRESSING_BAND_RANGES`; no test or module carries a bare
band number. The prop-radius bound moved from `GROUND_RADIUS_METRES` to
`MEADOW_RADIUS_METRES` (the treeline now stands on the apron); every other
placement assertion is kept, including the band rule itself.

### FR-13 / AC-13 — three corners and a clear centre

Corner bearings derived from the trio's spawn angles: **Trike 90°,
Stego 210°, Brachio 330°**. Each corner carries ≥ 3 props inside
`CORNER_FRAME_HALF_ANGLE_DEGREES` (30°) of its own preset's axis and skips the
± `CORNER_APPROACH_CLEARANCE_DEGREES` (10°) window around the animal's own
bearing, so the approach stays clear. The shared centre is clear of
`GROUND_RADIUS_METRES / 2` (6.02 m) for every prop.

### FR-14 / AC-14 — continuous water line

`WATER_LINE_RADIUS_METRES` 8.72 m, `WATER_LINE_WIDTH_METRES` 0.4 m, from
**350°** (the hand-water-pump's own bearing) to **214°** (inside the wallow),
sweeping the short way past the trough at 338° — `WATER_LINE_SWEEP_DEGREES` is
−136°, so the run is 8.72 × 2π × 136/360 = **20.70 m** of channel.

- 401 samples along the sweep; consecutive samples are 0.052 m apart against a
  0.2 m half-width, so no sample pair can leave a gap.
- Start is within 0.5 m of the pump; the end sits inside
  `WALLOW_MUD_RADIUS_METRES` of `WALLOW_CENTRE_METRES` — the line reaches the
  mud, so there is no spur to "complete by eye".
- Flush: the channel is raised by `WATER_LINE_FLUSH_METRES / 2` (0.03 m) on a
  polygon-offset, `depthWrite: false` material, and the gutter stones are sunk
  `WATER_LINE_STONE_SINK_METRES` = 0.19 − 0.06 = 0.13 m, so nothing on the line
  stands above **0.06 m**.
- The run is one mesh plus one instanced stone batch (2 draw calls). A cloned
  stone arc over the same 136° would have cost 16 calls and read as a garden
  path; the brief asked for the flush ribbon instead.

### FR-15 / AC-15 — scatter names its parent

Parent recorded per file in `DRESSING_CATALOGUE`, cluster drawn by
`underParent()` with the area centred on the parent (0.4 – 1.0 m, inward
window, explicit seed):

| Cluster | Count | Parent | Window | Seed |
|---|---|---|---|---|
| `ginkgo-leaf-litter-9784e9.glb` | 3 | `ginkgo-tree-baa895.glb` | 178 – 238° | 4242 |
| `mushroom-cluster-f2e3ba.glb` | 3 | `dawn-redwood-001c29.glb` | 350 – 410° | 4343 |
| `fern-clump-90ff4b.glb` | 2 | `flowering-magnolia-dd76cb.glb` | 263 – 323° | 4444 |
| `river-reed-cluster-cba87e.glb` | 2 | `garden-rock-7f5d60.glb` | 224° / 10.0 m, 226° / 9.9 m | authored |

Asserted: each placement and each cluster centroid within **1.5 m** of a
placement of the recorded parent; the reeds outside the mud disc but inside
twice its radius.

### FR-16 / AC-16 — one silhouette rhyme per preset

| Preset | Subject | Lens axis | Rhyme | Bearing | Off-axis | Distance from lens | Subject distance |
|---|---|---|---|---|---|---|---|
| `ranch` | brachio | 249.85° | `tree-fern-78320e.glb` | 261.6° | 11.75° | 35.06 m | 18.0715 m |
| `nest` | trike | 334.30° | `cycad-05ad50.glb` | 344.9° | 10.6° | 32.73 m | 13.240 m |
| `garden` | stego | 68.14° | `tree-fern-78320e.glb` | 75.4° | 7.26° | 34.07 m | 13.100 m |

Each is within ± 25° of its preset's subject bearing and stands further from
the lens than the animal it frames — 35.06 > 18.07, 32.73 > 13.24,
34.07 > 13.10 — which is what makes the rhyme a backdrop rather than scenery in
front of the subject. These three are the one deliberate exception to "the
treeline stays outside every lens cone"; every other treeline prop is asserted
outside all three. The rhyme radii are 18.0 / 18.2 / 18.2 m from the ranch
centre, on the treeline's own band.

### FR-18 / AC-18 — windpump landmark

`windpump-tower-1633a9.glb` stands at 210° / 28 m, beyond the treeline minimum
and inside the meadow, 7.75 m tall. Polyfork ships it as flat primitives with no
named rotor, so the rotor is built: a six-blade `InstancedMesh` plus a hub,
parented to the **scene** at the hub height (so its scale is 1 and it turns in a
true circle), falling away from the tower along its facing. The loop turns it by
`WIND_PUMP_RADIANS_PER_SECOND` (0.9 rad/s) and stops it under reduced motion and
on a paused clock. `findRotorNode()` prefers a `blade|rotor|fan|wheel|vane`
node if a later vendor ships one. FR-18 is **implemented, not withdrawn**.

### AC-8 / NFR-1 — budget

| Quantity | Ceiling | Measured |
|---|---|---|
| Dressing bytes on disk | 4 MB | **2,795,700 B** (2.67 MiB) |
| Precache | 15 MB | **6,692.49 KiB** (6.53 MiB), 63 entries |
| Draw calls, dressing | 150 (whole frame) | **61** — 56 clones (one per placement, files baked to one buffer each) + 1 channel + 1 stone batch + 1 wallow + 2 rotor meshes |
| Triangles, dressing | 80,000 (whole frame) | **≈ 37,626** — 37,218 across the 56 placements + 240 channel + 64 wallow + ~104 rotor |

Files are near-instanced where it pays: every dressing GLB is a single material
over `POSITION`/`NORMAL`/`COLOR_0`, so `bakeToOneCall()` merges its primitives at
load. Without that bake the 56 placements ask for **224** calls — the exact
failure the brief predicted — so the bake is what keeps the ceiling honest.

## Placement map

Shipped props are unchanged (pinned by the phase-1 snapshot at 1e-9); the table
lists this phase's 34 placements.

| Band | Props | Azimuth / radius | Facing |
|---|---|---|---|
| mid | 4 × hay bale | cluster at 90° / 9.35 m, ring radius 0.55 m | spins 0.2 / 2.4 / 4.1 / 5.6 |
| mid | berry bush | 78° / 9.8 m | inward |
| mid | flower bed | 102° / 9.8 m | inward |
| mid | 2 × garden rock | 206° / 9.3 m, 222° / 9.3 m | outward, inward |
| mid | log stump | 198° / 8.75 m | inward |
| mid | plum tree | 326° / 9.1 m | inward |
| mid | milk churn | 316° / 9.4 m | inward |
| mid | wooden crate | 312° / 8.9 m | inward |
| mid | signpost | 306° / 9.0 m | inward |
| mid | 2 × river reed cluster | 224° / 10.0 m, 226° / 9.9 m | inward |
| mid (scatter) | 3 × ginkgo litter | window 178–238° around the ginkgo, 0.4–1.0 m | seeded spin |
| mid (scatter) | 3 × mushroom cluster | window 350–410° around the redwood | seeded spin |
| mid (scatter) | 2 × fern clump | window 263–323° around the magnolia | seeded spin |
| foreground | 3 × club moss mat | 34°, 117.6°, 216° / 13.0 m | inward |
| foreground | 3 × wildflower | 100°, 165.6°, 272° / 13.0 m | inward |
| treeline | tree fern (ranch rhyme) | 261.6° / 18.0 m | inward |
| treeline | cycad (nest rhyme) | 344.9° / 18.2 m | inward |
| treeline | tree fern (garden rhyme) | 75.4° / 18.2 m | inward |
| treeline | cycad filler | 160° / 19.5 m | inward |
| treeline | windpump tower | 210° / 28.0 m | inward |
| — | water line channel | 8.72 m ring, 350° → 214°, 0.4 m wide | flush, 0.06 m |
| — | 4 gutter stones | arc 348° → 336° / 8.72 m | tangent, sunk 0.13 m |
| — | wallow mud disc | 214° / 9.3 m, 1.25 m radius | flush |

## Files

| File | Change |
|---|---|
| `scripts/vendor-dressing.mjs` | New. Downloads the 19 listed GLBs, header-checked, idempotent |
| `public/models/dressing/*.glb` | 18 new files |
| `CREDITS.md` | One row per new file, in the existing Polyfork licence wording |
| `src/ranch/layout.ts` | Catalogue +18 measured entries, `DRESSING_CORNERS`, wallow and water-line constants, `DRESSING_SCATTER`, `FOREGROUND_PLACEMENTS`, `SILHOUETTE_RHYMES`, `TREELINE_PLACEMENTS`, `LANDMARK_PLACEMENTS`, and the band/cone constants the tests read |
| `src/ranch/dressing.ts` | Water line channel + instanced stones, wallow disc, `bakeToOneCall`, rotor build and `updateDressing`, band/height/parent maps, budget ceilings, `measureDressing` |
| `src/viewer/loop.ts` | Optional `dressing?: DressingFrame` on `LoopView`; one `updateDressing(...)` call beside `sky?.update` |
| `src/viewer/main.ts` | Keeps a stable `DressingFrame` handle so the built dressing reaches the loop |
| `tests/ranch/dressing.test.ts` | 4 MB / 15 MB / call / triangle budgets, the bake, water line and rotor |
| `tests/ranch/layout.test.ts` | Band rules, corners, water line, scatter parents, rhymes, landmark |
| `tests/ranch/dressing-files.ts` | New. GLB header + JSON-chunk reader (bytes, primitives, triangles, materials, bounds) |
| `tests/viewer/pov.test.ts` | Ring-prop bound excludes the treeline; the sightline test judges it |

Commits: `af56a55` vendor script + GLBs + credits, `64c7ad7` layout
composition, `127737b` water line, wallow and rotor, `12c1090` tests,
`299fe51` `ground.ts` reverted to its phase-2 shape.

## Deviations

1. **`src/viewer/loop.ts` and `src/viewer/main.ts` are outside `Touches`.**
   FR-18's turning blades need a per-frame tick on the loop's clamped `dt` (so
   the paused dev harness freezes them, NFR-8). `LoopView` gains one optional
   field and `startLoop` one call; `main.ts` holds a stable frame object because
   `startLoop` destructures its view. The alternative — a second animation
   path — would break the pause contract.
2. **`tests/viewer/pov.test.ts` is outside `Touches`.** Its "lens stands beyond
   every prop" bound was true while everything was on the ring; the treeline is
   now staged on the apron on purpose (FR-6, FR-16) and the windpump sits at
   28 m. The assertion is now against ring props only, and the same file's
   sightline test still proves no prop stands between a lens and its animal.
3. **FR-6's 1.4 m mid cap has three pinned exceptions** (plum tree, reeds,
   signpost), recorded above and in `MID_HEIGHT_EXCEPTIONS`. The twelve shipped
   props are grandfathered by the snapshot, not re-judged.
4. **The shipped catalogue entries keep their phase-1 footprints.** New entries
   are measured from the GLB; the twelve shipped ones keep the values their
   positions were accepted against, because a measured *canopy* footprint
   (ginkgo 5.69 m, not 3.4 m) would put a shipped prop inside the new
   lens-sightline clearance, and FR-2 forbids moving it.
5. **`src/ranch/ground.ts` is untouched.** The wallow was going to be a new
   flush patch there; it is built in `dressing.ts` on the same polygon-offset,
   `depthWrite: false`, `renderOrder` recipe instead, so `ground.test.ts` needed
   no change and the ground module keeps its phase-2 shape.
6. **The water line is one flush ribbon, not a cloned stone path.** FR-14 asks
   for a flush stone gutter; the channel is a continuous stone-toned ribbon with
   real stones dressing the pump→trough stretch as one instanced batch. The
   brief's own note (a 140° stone arc costs 16 draw calls and reads as a garden
   path) is why.
7. **Formatting.** Two files are unformatted per `oxfmt --check`; the fixing
   formatter is not available to this subagent.

## Evidence paths

- `tests/ranch/layout.test.ts` — FR-5, FR-6, FR-13, FR-14, FR-15, FR-16, FR-18
  (bands, bearings, 401-sample water line, parent distances, rhyme geometry).
- `tests/ranch/dressing.test.ts` — AC-8 budgets, the bake, the water line's
  material, the rotor's turn and its reduced-motion stop.
- `tests/ranch/dressing-files.ts` — the GLB reader both suites measure with.
- `tests/viewer/pov.test.ts` — the lens-beyond-the-ring bound and the sightline.

## Notes

- **No visual capture.** This phase produced no picture: the dev capture path
  (`?pov=` and a scripted grab) is phase 4's, and the numbers above are measured
  from the built scene and the vendored bytes rather than eyeballed. Draw calls
  and triangles are asserted from the manifest, so a re-vendor that doubles
  either number fails in `pnpm test` before it reaches a phone.
- **The rotor is built, not stolen.** Polyfork's windpump has no named rotor
  node, so `findRotorNode()` finds nothing and the six-blade fan is authored to
  the tower's hub height. It hangs off the scene, not the tower group, so its
  scale is 1 and it turns in a true circle instead of an ellipse.
- **The wallow reads as ground, not as a prop.** It is a `CircleGeometry` at
  0.03 m on the wear recipe with the same `renderOrder` band as the wear discs,
  so it sits under every rim stone and reed in the wallow's edge.
- **Scatter is seeded, not random.** `Math.random` is never called (asserted),
  so `/?dev=1&seed=42&pause=1` captures the same ranch every time.
