# Phase 2 evidence — Stego vendor + pastel bake

- Track: 20261029-stego-generic-player
- Phase: P2 (Stego vendor + pastel bake; covers FR-3, FR-4, AC-2)
- Date: 2026-10-28 (UTC)
- Branch: feat/20261029-stego-generic-player
- Base: 45d1276460366724cf90182acc8b0e85b6b881bf
- Head: a06cdef (squashed single code commit; was b7d25f4 + aa53331)
- Result: verified (`pnpm verify` exit 0, 90/90 tests)

## Commands

| Command | Exit | Notes |
| --- | --- | --- |
| `pnpm verify` | 0 | lint (warnings only, same as baseline) + format check + typecheck + 90/90 tests + build; precache 11 entries / 1839.92 KiB (~1.8 MB, far under the 18 MB NFR-2 budget) |
| `pnpm test scripts/vendor/bake-stego-tmp.test.ts` | 0 | one-shot bake: Waddle 0.7917 s, 72 tracks, Blender Draco pass, encoded 63,107 bytes |
| `blender --background --python .conductor/evidence/render-stego-proof.py` | 0 | beauty renders of the shipped GLB (see visual proof) |

## Acceptance

| AC / FR | Gate | Measured | Status |
| --- | --- | --- | --- |
| FR-3 vendor | Polyfork Stego base vendored, no Trike-mesh faking | `stegosaurus-base` (free, owned, 2858 tris), `scripts/vendor/stegosaurus-base.mjs` + `-params.json` | pass |
| FR-3 pastel | 8 pastel zones distinct from Trike #9ed68a, retired browns gone | hide #7fb5a3: 3888, belly #f6ead0: 858, blend #bacfb9: 156, feet #6da08e: 624, mark #4f5e59: 894, plate #efa27e: 864, plateTrim #b26a4d: 720, spike #fff3dd: 360 verts (all > 50); all 8 retired browns exactly 0 | pass |
| FR-3 size | baby GLB bounds | height 2.29 m (< 2.6), length 3.894 m (3.3–4.2); adult ref 6.491 m, ratio 0.60 | pass (see deviation: size 0.6, not 0.25–0.35x) |
| FR-3 material | one flat-shaded Draco mesh, feet y = 0, Head kept | 1 mesh / 1 material, KHR_draco_mesh_compression, vertexColors + flatShading, min y = 0.0000, Head node present, 63,107 bytes (< 150 KB) | pass |
| FR-4 clip | Waddle 0.8 s, 24-frame linear, seamless | exactly one animation named `Waddle`, 0.7917 s (0.79–0.81); 72 tracks (24 nodes x translation/rotation/scale), all LINEAR; positions x0.6, quats verbatim; seam gap 0.0486 (< 0.05); zero dropped channels | pass |
| FR-4 loader | prefers `Waddle` else first clip via `/draco/` path | unchanged generic loader (`findByName(Waddle) ?? animations[0]` + DRACOLoader) covers the Stego GLB; Phase 3 mirrors it | pass (no change needed) |
| AC-2 no-skate | stride matches clip, planted feet stay | travel 0.2900–0.2921 m vs coded 0.29 (±0.02); duty 0.73–0.74; excursion ≤ 0.096 (≤ 0.12); slides ≤ 0.36/0.19 (≤ 0.45/0.25) | pass |
| AC-2 turn | 90° turn < 0.6 s then walks straight (STEGO_GAIT) | measured turn completes inside 0.6 s at 60 fps sim; heading then holds target within 0.05 rad; wander cross-track deviation stays inside the 0.8 m circle | pass |
| CREDITS | Stego source recorded | Stegosaurus section appended (asset, source URL, vendored + baked files, license) | pass |

## Touched paths

- `scripts/vendor/stegosaurus-base.mjs` + `scripts/vendor/stegosaurus-base-params.json` (new, vendored Polyfork source)
- `scripts/vendor/bake-stego-variant.js` / `.py` / `.d.ts` (new, bake pipeline)
- `public/models/stego.glb` (new, baked Draco game file)
- `scripts/check-stego.test.ts`, `tests/waddle/stego-pastel.test.ts`, `tests/waddle/stego-gait.test.ts` (new gates)
- `src/ranch/dino-player.ts` (STEGO_GAIT only)
- `CREDITS.md` (Stego section)

## Deviations

1. **Baby scale 0.6, not 0.25–0.35x.** The `size` knob's documented range is
   0.6–1.4, so `size: 0.3` clamps to 0.6 (measured variant length 3.894 m =
   exactly 0.6 x 6.491 m). Forcing 0.3x would need a post-scale hack outside
   the bake-trike pattern and would halve the stride (retime need). At 0.6 the
   Stego is a pen-mate of the Trike and the bake confirms the spec assumption:
   same 0.8 s / 0.29 m gait, no retime (measured travel 0.2908 m). Recorded
   here instead of silently shipping; spec/plan palette TBD resolved as below.
2. **No `assets/stego/` base GLB.** The Trike pattern vendors a base `.glb`,
   but the Stego source downloads cleanly as a parametric `.mjs` (112,798
   chars) + params JSON, which is what the bake imports — vendoring the module
   is the faithful equivalent and keeps everything procedural.
3. **Donor is the shipped Trike GLB** (`public/models/trike.glb`), not the
   Stego's own clips: the Stego base ships Idle/Walk/Run, no `Waddle`, and its
   skeleton is name-identical to the Trike's 24-bone rig, so the donor Waddle
   maps 1:1 with zero drops and identical 0.8 s timing (loader's
   prefer-`Waddle`-else-first contract holds).
4. **Temp worker files left untracked for the primary to delete** (shell `del`
   is permission-denied for this executor): `scripts/vendor/fetch-stego-tmp.test.ts`,
   `scripts/vendor/fetch-stego-base.mjs`, `scripts/vendor/probe-stego-tmp.test.ts`,
   `scripts/vendor/bake-stego-tmp.test.ts`. All green; none are staged or
   committed. `package.json` was reverted (no trace of the temporary
   `fetch:stego` script).

## Notes

- Chosen asset: `stegosaurus-base` (https://polyfork.dev/asset/stegosaurus-base),
  free, owned under the current key, 2858 tris, 1.85 x 3.82 x 6.49 m, origin_y 0.
- Final palette (dusty teal + peach, colorblind-safe by luminance separation,
  verified distinct from Trike #9ed68a): hide `#7fb5a3`, belly `#f6ead0`,
  blend `#bacfb9`, feet `#6da08e`, mark `#4f5e59`, plate `#efa27e`,
  plateTrim `#b26a4d`, spike `#fff3dd`; dark/mouth/tongue keep Polyfork defaults;
  `plates: 24, plateSize: 1, tail: 1, plateColour: umber`.
- Size report: adult ref 6.491 m long / 3.82 m tall; variant 3.894 m / 2.292 m
  (ratio 0.60); GLB 63,107 bytes Draco (raw 497,292, ratio 7.88); precache total
  1839.92 KiB across 11 entries.
- STEGO_GAIT: stride 0.29 m, loop 0.8 s, turnRate PI, curvature 20 rad/m,
  wander 0.8 m. The hot curvature caps yaw at PI for a 0.5 s quarter turn;
  heading steps clamp to the remaining angle so it settles exactly.
- Visual proof (Blender CYCLES renders of the shipped `stego.glb`, gitignored):
  `.conductor/evidence/stego-bake-side.png` (peach plate row profile),
  `.conductor/evidence/stego-bake-front.png` (teal/cream split, spikes),
  script `.conductor/evidence/render-stego-proof.py`. Both inspected: teal hide,
  peach/terracotta plates, cream belly, slate marks, white tail spikes, feet planted.
- Untouched per scope: `src/viewer/main.ts`, `index.html`, `vite.config.ts`,
  `src/ranch/waddle.ts` behaviour, `plan.md`/`tracks.md`/metadata/index/review/pr.
