# Phase 1 Evidence — Baked pastel baby variant

- Track: 20261029-baby-trike-turn-fix — Baby Trike Turn Fix
- Phase: 1 — Baked pastel baby variant
- Date: 2026-10-29
- Branch: feat/20261029-baby-trike-turn-fix
- Base: f0edf6309106e1bb4140b97889faaca4495e1d5
- Head: <code commit below; GLB bake + verify owned by primary, see blockers>
- Result: blocked (code complete; bake execution and `pnpm verify` denied in
  executor shell — exact commands for the primary in Blockers)

## Summary

All Phase 1 code is written: the Node bake (`scripts/bake-trike-variant.js`,
pinned `createAsset` params, Waddle retarget onto the new skeleton, Blender
headless Draco pass via `scripts/bake-trike-variant.py`), the runtime-remap
removal in `src/viewer/main.ts` (blush pin moved in-file), the replacement
variant test (`tests/waddle/pastel.test.ts`), the viewer test updates, and the
GLB check updates for the size-0.6 bounds. What remains needs a shell the
executor does not have: delete `src/ranch/pastel.ts`, run the bake, run
`pnpm verify`. No verification command could be executed here; nothing is
claimed green.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| inspect | `git status --short` | 0 | Clean tree before work |
| modify | `git rm src/ranch/pastel.ts` | denied | Shell refused; filed as blocker 1 |
| verify | `pnpm verify` | denied | Shell refused; filed as blocker 3 |
| bake | `node scripts/bake-trike-variant.js` | not run | Node execution refused (`node --version` denied); filed as blocker 2 |
| bake | `blender --version` | not run | Blender execution refused; covered by blocker 2 |

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | Baked verts read pastel green, no remap | `TRIKE_VARIANT_PARAMS` pins the 4 pastel hexes; `tests/waddle/pastel.test.ts` asserts >50 COLOR_0 verts per hex and zero retired browns on the procedural build; `main.ts` contains no recolor path | partial (GLB bake pending) |
| AC-2 | Baby proportions (size 0.6, short horns) | Params assert size 0.6 / horns 0.7 / noseHorn 0.6; procedural length asserted 3.3–4.2 m and 0.55–0.65x of the default adult build; `check-trike` bounds updated to the same window | partial (GLB bake pending) |
| AC-3 | Rayed frill, pastel shield tones | `frill: "rayed"` pinned; explicit cream/leaf `shieldTrim`/`shieldMark` override the pattern rust defaults; variant test asserts the pattern defaults (`#dcc9a2`/`#a8442a`) are absent | partial (GLB bake pending) |
| AC-7 | `pastel.ts` and its test are gone; no COLOR_0 remap ships | `pastel.test.ts` rewritten as the variant test; viewer test asserts `main.ts` has no `applyPastelRemap`/`pastelRemap`/`../ranch/pastel` and that `src/ranch/pastel.ts` is unreadable | partial (`git rm` needs primary) |
| FR-1 | Bake script pins `createAsset` params | `scripts/bake-trike-variant.js` + `.d.ts`, header pins the exact call; variant test asserts params verbatim | done (code) |
| FR-2 | Shipped GLB already pastel, remap deleted | Remap call removed from `loadTrikePlayer`; module deletion pending blocker 1 | partial |
| FR-7 | Blush stays pinned under Head | `attachBlushCheeks` moved verbatim into `main.ts`; viewer test pins 2 cheeks under Head; GLB check asserts a Head node exists | done (code) |
| NFR-4 | Fully offline, no runtime Polyfork | Bake imports only the vendored module + node_modules `three`; no network; viewer imports no Polyfork code | done (code) |

## Evidence paths

- `scripts/bake-trike-variant.js` — pinned bake (procedural variant +
  Waddle retarget + Blender Draco pass, never half-writes the GLB)
- `scripts/bake-trike-variant.d.ts` — typed exports for the variant test
- `scripts/bake-trike-variant.py` — headless Blender Draco re-export
- `src/viewer/main.ts` — remap unwired, blush pin local, placeholder hexes kept
- `tests/waddle/pastel.test.ts` — replacement variant test (params, COLOR_0,
  proportions, Waddle retarget against the previous GLB)
- `src/viewer/viewer.test.ts` — baked-look + no-remap asserts
- `scripts/check-trike.test.ts` — size-0.6 bounds (3.3–4.2 m, height <2.6 m),
  Head-node assert (outside Touches, recorded below)

## Deviations

- `scripts/check-trike.test.ts` (outside Touches): updated length bounds
  1.7–2.1 m → 3.3–4.2 m and height <1.3 m → <2.6 m (required — the size-0.6
  rebuild is ~2x the old 0.3x GLB), added Head-node assert, added `nodes` to
  the GLB JSON interface, generalized the Draco comment. Bounds derive from
  the vendor's own spec numbers (6.26 m reference, 3.65 m shield top), not
  from a measured bake — confirm against the baked GLB when verifying.
- `CREDITS.md` left untouched although it still says "baby-scaled 0.3x":
  product-doc edits are out of scope; flagged for the primary.
- New files `scripts/bake-trike-variant.d.ts` and
  `scripts/bake-trike-variant.py` match the `scripts/bake-trike-variant.*`
  Touches pattern (typed exports for the test; Blender Draco pass).

## Notes

- Vendor module contains NO stride/duty/gait/walk-timing data (searched:
  stride, duty, phase, gait, walk, clip, keyframe all absent; only hoof/paw
  foot tags, landmarks, `animationWorkflow: "web-keyframes"`). Phase 2 must
  source its gait data elsewhere (e.g. sampling the authored clips from
  `assets/trike/triceratops-base.glb`). The retargeted clip preserves the old
  0.8 s timing exactly; foot-plant quality on the longer legs is Phase 2 work.
- Old bone names are assumed 1:1 with the new skeleton (24 bones,
  Hips/Spine/Chest/Neck/Head/Jaw + 4 legs x4 + Tail/TailTip per the archived
  review). The bake validates this strictly and throws with the missing names
  instead of writing a bad GLB; if it throws, paste the error back for a fix.
- `POSITION_TRACK_SCALE = 0.6` rests on the previous GLB carrying a 0.3x root
  scale over authored size-1.0 offsets; the bake asserts the 0.3x root at
  runtime and the variant test asserts it in CI.
- Check-trike bounds are predictions, not measurements. If the baked GLB
  lands outside 3.3–4.2 m / 2.6 m, adjust the bounds to the measured numbers
  (and record) rather than forcing the model.
- Retry budget untouched (0 of 2 used — no fix cycle was possible without a
  runnable shell).
