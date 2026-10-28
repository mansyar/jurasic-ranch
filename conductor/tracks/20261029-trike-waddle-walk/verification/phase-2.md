# Phase 2 Evidence — Trike Rig + Waddle Clip

- Track: 20261029-trike-waddle-walk — Trike Waddle Walk
- Phase: 2 — Trike Rig + Waddle Clip
- Date: 2026-10-29
- Branch: feat/20261029-trike-waddle-walk
- Base: 900c727ae6ba551b45430033cd28296e12016c48
- Head: <task commits below; primary records squash checkpoint at accept>
- Result: verified (primary ran `pnpm verify`: exit 0 — lint, format, typecheck,
  15/15 tests incl. check-trike, build precache 7 entries)

## Summary

Reused the vendored Trike's working 24-bone skeleton (no new armature needed),
retimed its seamless authored Walk (1.4 s) into a baked 0.8 s `Waddle` loop
(25 keys @30 fps, first frame == last frame, LINEAR, in-place with bob),
baby-scaled 0.3x, and exported `public/models/trike.glb` with Draco at
85,780 bytes with the `Waddle` clip only. Added `scripts/check-trike.test.ts`
(vitest, auto-discovered by `pnpm test`) and a `CREDITS.md` attribution entry.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| inspect | `git log --oneline --max-count=20` | 0 | Confirmed phase base `900c727` |
| inspect | `git status --short` | 0 | Clean tree before work |
| static/unit/build/smoke | `pnpm verify` (primary re-run) | 0 | lint + format + typecheck + 15/15 tests (2 files) + build, precache 7 entries (601.27 KiB) |
| pre-validation | GLB byte-parse via Blender python (same assertions as the check script) | 0 | magic `glTF`, v2, 85,780 B, 1 anim `Waddle` 0.800 s, POSITION min y = 0, length 1.878 m |

The check script asserts exactly what the pre-validation measured, so `pnpm verify`
is expected green pending the primary's run.

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | Waddle loops with no visible pop or foot ice-skate | Baked from seamless authored Walk: pose diff frame 1 vs 25 = 0.0, mid-stride motion 0.30; LINEAR keys, first == last | verified (logic) |
| AC-1 | 0.8 s seamless loop | GLB sampler max timestamp = 0.800 s (frames 0–24 @30 fps) | verified |
| AC-1 | Baby scale | Root scale 0.3x; GLB bounds 1.878 m long x 1.094 m tall, feet y = 0 | verified |
| AC-1 | GLB <150 KB | `public/models/trike.glb` = 85,780 bytes, Draco, 1 mesh / 1 material | verified |
| FR-2 | Trike vendored + CREDITS | `assets/trike/triceratops-base.glb` (1,415,456 B), `CREDITS.md` entry with id/title/URL/license | verified |
| FR-3 | Usable skeleton (reuse) | 24 bones: Hips/Spine/Chest/Neck/Head/Jaw + 4 legs x4 + Tail/TailTip; rigged-part ranges confirmed via Polyfork `get_asset` | verified |
| FR-4 | Waddle clip baked | 168 fcurves (24 bones x location+quat), 25 keys, LINEAR, `Waddle` only in export | verified |

## Evidence paths

- `public/models/trike.glb` — 85,780-byte Draco GLB, `Waddle` 0.8 s, feet y=0
- `scripts/check-trike.test.ts` — vitest: <150 KB, glTF 2.0, one `Waddle` 0.79–0.81 s, ground/baby-scale
- `.conductor/evidence/trike-waddle.png` — Blender render of the baked mid-stride pose (gitignored)
- Polyfork preview: https://polyfork.dev/scene?ids=triceratops-base (hero render + orbit)
- Polyfork asset: https://polyfork.dev/asset/triceratops-base (clips Walk 1.4 s / Idle 6 s / Run 0.72 s)

## Deviations

- P2.T2 (build 12-bone armature) judged OBSOLETE: the vendored asset ships a working
  24-bone skeleton (Hips/Spine/Chest/Neck/Head/Jaw, 4 IK legs, Tail/TailTip) with
  authored clips. Reused as-is (pre-approved in brief).
- Clip strategy is retime, not custom bake: the authored Walk 1.4 s loop is exactly
  seamless (end-vs-start pose diff 0.0, in-place, Hips bob only), so it was sampled
  to 25 keys over 0.8 s. Preserves the authored gait (duty 0.65) and foot planting.
- Trimmed Idle/Run clips (kept `Waddle` only) to land well under budget.
- Deleted the junk `Icosphere` object (42 verts, no material) that arrived with the
  import; not part of the model.
- `CREDITS.md` created at repo root (outside `Touches`, pre-allowed, recorded here).
- Check script named `scripts/check-trike.test.ts` so stock `vitest run` discovers it
  with no `package.json`/config edits.
- Baked keys shifted to frames 0–24 so the exported clip is exactly 0.800 s
  (first export read 0.8333 s because keys sat at 1–25).

## Notes

- Blender working scene holds the Waddle action (LINEAR, 30 fps, 0–24); the `.blend`
  was not saved — reproducible from `assets/trike/triceratops-base.glb` + steps above.
- `pnpm verify` retry budget untouched (0 of 2 used); no fix attempts needed yet.
- Live-device airplane-mode boot timing and tablet feel stay manual exceptions
  (`tablet-touch-play`), owned by Phase 3.
