# Phase 2 evidence — Brachio vendor + pastel bake

- Track: 20261029-brachio-joins-ranch — Brachio Joins the Ranch
- Phase: 2 — Brachio vendor + pastel bake (FR-3 / FR-4 / AC-2)
- Date: 2026-10-29
- Branch: feat/20261029-brachio-joins-ranch
- Head (code): 6d34ce2 + <evidence SHA below>
  - Bake + tests + credit: 6d34ce2 `feat(brachio): bake pastel baby Brachio GLB with rebuilt Waddle`
  - Evidence: `docs(brachio): record phase-2 verification evidence`
- Result: verified

## Commands

| Layer | Command | Exit | Summary |
| ----- | ------- | ---- | ------- |
| New tests (pre-bake) | `pnpm test tests/waddle/brachio-pastel.test.ts tests/waddle/brachio-stride.test.ts` | 1 → 0 | First run falsified two plan assumptions (EXTRA 0.5 overshoots the cap; donor has no ear channels); after recalibration 9/9 pass |
| Bake | `pnpm test tests/waddle/scratch-brachio-bake.test.ts` | 0 | Blender 5.2.3 Draco pass, `public/models/brachio.glb` written atomically (119,252 bytes); re-bake byte-identical |
| GLB check | `pnpm test scripts/check-brachio.test.ts` | 1 → 0 | First run showed the exporter bakes the post-scale into skinned vertices; check rewritten to world-scale bounds, 6/6 pass |
| Full | `pnpm verify` | 0 | oxlint + oxfmt check + tsrs + 155 tests (20 files) + vite build; precache 17 entries (was 16) |

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| -- | --------- | -------- | ------ |
| FR-3 | brachio.glb under the 1.2 m head cap, lavender blush, feet on y = 0 | `scripts/check-brachio.test.ts` (world head 0.9–1.3 m, min.y ≈ 0, 1 material, Draco); `tests/waddle/brachio-pastel.test.ts` (7 lavender hexes >50 verts each, no default-colorway color survives, Head bone present) | Met |
| FR-4 | Seamless shuffle, Waddle preferred | `buildBrachioWaddleClip` rebuilds the shipped Trike Waddle (quats verbatim, linear interp, seam gap <0.05), retimed ×(1.0/0.79) to exactly 1.0 s; `check-brachio` asserts one `Waddle` clip 0.99–1.01 s | Met |
| AC-2 | 10× loop with no pop/skate; 90° turn <1.0 s; blink 3–5 s | Stride harness (`brachio-stride.test.ts`): travel = coded 0.24 m ±0.02, duty 0.5–0.85, lift ≥0.03, excursion ≤0.12, core slides ≤0.45/0.25 at 0.24 m/s. Turn/blink are Phase-1-tested shared player behavior, unchanged | Met |
| NFR-2 | Precache <22 MB total, each GLB Draco + one material | brachio.glb 119,252 bytes (<150 KB budget), Draco + 1 material; build precache 17 entries / 3290.43 KiB | Met |

## Evidence paths

- `scripts/vendor/bake-brachio-variant.js` — pinned bake (params, EXTRA 0.27, PS 1.85, 1.0 s retime, atomic rename, drop logging)
- `scripts/vendor/bake-brachio-variant.py` — headless Blender Draco pass
- `scripts/vendor/bake-brachio-variant.d.ts` — types for the lint-ignored vendor script
- `public/models/brachio.glb` — baked game file (119,252 bytes, Draco, 1 material, 1.0 s Waddle, 8730 verts)
- `tests/waddle/brachio-pastel.test.ts` — params/geometry/retarget (5 tests)
- `tests/waddle/brachio-stride.test.ts` — stride + slide harness (3 tests)
- `scripts/check-brachio.test.ts` — GLB conformance (6 tests)
- `CREDITS.md` — Brachiosaurus base entry

## Deviations

1. **EXTRA_SCALE 0.27, not 0.5** (`bake-brachio-variant.js`). TDD falsified the
   plan: the size-0.6 build is non-linear (measured 5.0 m long, head 2.14 m at
   0.5 — over the 1.2 m cap). 0.27 lands the grazing head at ~1.16 m (~2.7 m
   tip-to-tail, a touch smaller than the 3.9 m pen-mates — the price of the cap
   on a long-necked species).
2. **POSITION_TRACK_SCALE 1.85, not 1.0.** The smaller post-scale shrinks world
   foot travel; 1.85 restores measured travel to the coded 0.24 m stride
   (±0.02, all four feet). Tune, don't assume — verified by the stride test.
3. **No donor channels drop.** The shipped Trike donor carries no ear channels,
   so `userData.dropped` is `[]` (asserted) and the track count equals the
   donor channel count. The drop path + bake logging are kept for future donors.
4. **GLB vertices are world-scale.** GLTFExporter bakes the group post-scale
   into skinned-mesh vertices, so `check-brachio` asserts world bounds
   (2.3–3.1 m, head 0.9–1.3 m) with no node-scale lookup.

## Notes

- **Scratch file left untracked**: `tests/waddle/scratch-brachio-bake.test.ts`
  (clearly header-marked SCRATCH, one passing test that re-runs the bake). The
  executor's shell cannot `rm`; please delete it — it is NOT added to any
  commit. Real coverage lives in `brachio-pastel` / `brachio-stride` /
  `check-brachio`. Suite without it: 154 tests / 19 files.
- **Primary-vendored module left untracked**: `scripts/vendor/brachiosaurus-base.mjs`
  + `scripts/vendor/brachiosaurus-base-params.json` were already in the tree
  before this phase and sit outside its Touches; the primary owns committing them.
- No viewer, ranch-gait, index.html, or vite config touched. Trike/Stego
  exports and all shared waddle math untouched (full suite green).
