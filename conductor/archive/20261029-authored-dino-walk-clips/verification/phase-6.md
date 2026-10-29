# Phase 6 - Tell the truth about the trio

- **Track:** 20261029-authored-dino-walk-clips
- **Phase:** 6
- **Date:** 2026-10-30
- **Branch:** `fix/20261029-authored-dino-walk-clips`
- **Base:** `12520e180c845be0dab9a552fca78c5e88d00ed1`
- **Head:** _set after squash_

## Result

**Verified.** Three things happened, in the order they were found:

1. **The viewer was still asking for a clip that no longer exists.** `loaders.ts`
   looked up `Waddle` and fell back to `animations[0]`. The re-bake ships
   `Idle` first, so after Phase 2 both Stego and Brachio walked on their own
   **Idle** pose for the length of a waddle loop - a second, quieter defect
   hiding behind the bone collapse this track fixed. Switching on `?dev=1` and
   pressing Walk is what surfaced it.
2. **The cache budget, measured, does not fit three clips.** `Idle` + `Walk` +
   `Run` cost 6,872.75 KiB of precache against a 3,426 KiB baseline: +3.4 MiB
   against an NFR of 2 MiB. `Run` alone was 102-370 KiB per species; `Idle`,
   which nobody plays, was 912 KiB (Stego) and 1,183 KiB (Brachio).
3. **The docs still described the donor transfer.** `product.md` still capped
   the Brachio at 1.2 m and called it a seated shuffle; `tech-stack.md` said
   nothing about how a dino is baked; `CREDITS.md` still said all three clips
   ship.

The shipped set is now `Walk` only, the loader asks for `Walk` (or the Trike's
`Waddle`) and refuses to guess, and the docs say what the pipeline actually is.

## Commands

| Command | Result |
| --- | --- |
| `node scripts/vendor/bake-stego-variant.js` | exit 0 - `Walk 2.400 s / 48 tracks`, Blender 5.2.3 Draco pass |
| `node scripts/vendor/bake-brachio-variant.js` | exit 0 - `Walk 3.800 s / 70 tracks` |
| both bakes, second run | **byte-identical** - Stego `E07C284DB2C0DB92…`, Brachio `6325955587D07C11…` (NFR-3) |
| `node --check scripts/bake-trike-variant.js` | exit 0 |
| `pnpm test` | 36 files / **349 tests** passed |
| `pnpm verify` | **exit 0** - format 67 files correct, coverage lines 71.03 % (1106/1557), build ok, `dist clean: no dev harness markers` |
| `pnpm build` | precache **30 entries, 4,221.80 KiB** |

## Shipped files

| File | Bytes | Clips | Change |
| --- | --- | --- | --- |
| `public/models/stego.glb` | 338,260 | `Walk` 2.4 s, 48 ch | was 1,412,000 (Idle+Walk+Run), before the track 95,684 |
| `public/models/brachio.glb` | 690,276 | `Walk` 3.8 s, 70 ch | was 2,331,836 (Idle+Walk+Run), before the track 119,252 |
| `public/models/trike.glb` | 85,252 | `Waddle` 0.8 s | unchanged |

Net growth over the pre-track pair: **+813,600 B = +796 KiB**, against NFR-2's
2 MiB ceiling.

## The loader picks the walk clip, or refuses (FR-1, AC-1)

`src/viewer/loaders.ts` replaced `WADDLE_CLIP_NAME = 'Waddle'` with

```ts
const WALK_CLIP_NAMES = ['Walk', 'Waddle'];   // Polyfork's name, then the Trike bake's
function findWalkClip(animations): AnimationClip | undefined
```

and the `animations[0]` fallback is gone: a GLB with no walk clip now throws with
the clip names it does carry (`tests/waddle/dual-viewer.test.ts`,
`trio-viewer.test.ts`, `src/viewer/viewer.test.ts` pin all three behaviours -
prefers `Walk` over a leading `Idle`, still accepts the Trike's `Waddle`,
refuses a file with neither).

## Acceptance

| Criterion | Evidence | Result |
| --- | --- | --- |
| FR-1 - authored Polyfork clips, not the Trike donor | `Walk` grafted per joint name by `graftAuthoredClips`; `scripts/check-{stego,brachio}.test.ts` assert the exact clip set and that no `Waddle` exists | pass (withdrawal amended, see below) |
| AC-1 - `Walk` 2.4 s / 3.8 s, no `Waddle` | `scripts/check-dino-clips.test.ts`, `check-stego.test.ts`, `check-brachio.test.ts` | pass |
| AC-3 - no visible bone collapse in the Garden POV | `.conductor/evidence/phase-6/walk-stego.png`, `walk-brachio.png`, `walk-trike.png` | pass |
| AC-8 - CREDITS names the official GLB as the clip source | `CREDITS.md` Stegosaurus / Brachiosaurus sections | pass |
| AC-9 - `pnpm verify` green | 349 tests, coverage 71.03 %, build ok | pass |
| NFR-2 - precache +@2 MiB | 4,221.80 KiB vs 3,426 KiB baseline | pass (+796 KiB) |
| NFR-3 - reproducible bake | two runs, identical SHA-256 per file | pass |
| NFR-5 - new pure functions tested | `selectShippedClips` exercised by both pastel suites; `findWalkClip` by three viewer suites | pass |

## Screenshots

Captured with headless Chromium (SwiftShader) at 1280x800, deterministic pose:
`?dev=1&seed=42&solo=<species>&paused=1`, `setWalking(true)` then a fixed step
count, so the stride phase is reproducible.

| Shot | Panel | What it shows |
| --- | --- | --- |
| `walk-stego.png` | 55 fps, 82 calls, 20,301 tris | plates in a clean row along the spine, body upright, head level |
| `walk-brachio.png` | 53 fps, 78 calls, 19,078 tris | neck upright, all four legs planted, tail trailing |
| `walk-trike.png` | 29 fps, 49 calls | the control - unchanged by this track |

## Docs

- `conductor/product.md` - the "Brachio scale reads huge, cap 1.2 m, mostly
  seated shuffle" risk is retired in favour of the real rule (proportions kept,
  walk area sized from the largest body), and the Track 3 line records
  "own authored walk clip, 7.42 m long, 2.0x the Trike".
- `conductor/tech-stack.md` - new bullet describing the bake: parametric mesh +
  published-GLB clip graft + Blender Draco pass + viewer group scale, with the
  reason a translation channel must not be rescaled, and why `Idle`/`Run` stay
  withdrawn.
- `CREDITS.md` - both species' clip paragraphs now name `Walk` as the shipped
  clip and say `Idle`/`Run` are withdrawn, without weakening the
  no-redistribution note.

## Deviations

- **Spec amended, not silently reinterpreted.** FR-1 and AC-1 said the files
  carry `Idle` and `Run` beside `Walk`; they now say `Walk` only, with the
  amendment dated inline and the reasoning in the edge-case section. The spec's
  own escape hatch only authorised withdrawing `Run`; measurement showed
  `Idle` alone cost more than the remaining budget, and no code path plays it.
- **Phase 2's evidence was right; its report was not.** The subagent's summary
  quoted 236 KB / 318 KB, which are the sizes of the pre-Draco temp file it read
  before the Blender pass. `verification/phase-2.md` already records the true
  committed sizes (1,412,000 / 2,331,836 B), so nothing needed correcting there -
  only this note, so the two files are not read as contradicting each other.
- **`selectShippedClips` accepts the shipped set as well as the published one.**
  The first version asserted the full `Idle`/`Walk`/`Run` allow-list against its
  input, which made a re-bake read of an already-shipped GLB throw and broke
  five suites. It now rejects unknown names and missing requested names, and
  orders the result by `PUBLISHED_CLIP_NAMES` so the same clip set always
  serialises to the same bytes.

## Notes

- `WALK_CLIP_NAMES` keeps `Waddle` because the Trike is still the donor-retarget
  bake: renaming its clip would re-bake a model this track deliberately leaves
  untouched.
- The 20,301-triangle Stego and 19,078-triangle Brachio readings are lower than
  Phase 5's trio figures (32,805) because the solo filter hides the other two
  animals; silhouette counts are unchanged.
- Coverage rose slightly (70.78 % -> 71.03 %) despite more test code, because
  the removed clip paths (`Idle`/`Run` assertions) were covered code.
