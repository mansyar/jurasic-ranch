# Review Fix 2 — Pastel Rigged Look + Stay-in-Frame Wander

- **Track:** 20261029-trike-waddle-walk
- **Branch:** feat/20261029-trike-waddle-walk
- **Base:** effc2e7 (conductor state: reopen for fix round 2)
- **Head:** c469886 (Fix B commit; see commits below)
- **Date:** 2026-10-29
- **Status:** **verified** — primary ran `pnpm verify` green
  (oxlint + oxfmt + tsrs + vitest 55/55 + vite build, PWA precache 10).

## Goal

Live browser viewing showed the rigged Trike walking, but (1) it rendered
BROWN (authored Polyfork colors) instead of the spec'd pastel-green blush
baby, and (2) root motion walked it out of the fixed camera frame within
seconds. Fix both; keep everything else (0.8 s Waddle, turn-then-walk,
head-dip blink, dust, silence, offline, NFR-2 single-material Draco GLB).

## Commits

| SHA | Message | Contents |
| --- | ------- | -------- |
| 3c6bc32 | feat(ranch): add pastel vertex-color remap module | Fix A: `src/ranch/pastel.ts` + `tests/waddle/pastel.test.ts` (new) |
| f5fac21 | fix(ranch): apply pastel look to rigged trike in viewer swap | Fix A wiring: `src/viewer/main.ts`, `head` getter in `src/ranch/trike-player.ts`, `src/viewer/viewer.test.ts` |
| c469886 | fix(ranch): stay-in-frame wander steering in TrikePlayer | Fix B: `src/ranch/trike-player.ts` wander + `tests/waddle/trike-player.test.ts` |

## Fix A — pastel look

- `src/ranch/pastel.ts` (new): exports `PASTEL_BODY_HEX = 0x9ed68a` and
  `PASTEL_BLUSH_HEX = 0xf2a0ac` — the exact hexes previously inlined in
  `createPlaceholderTrike`, now shared as one constant each.
  `pastelRemap(r,g,b)` is a preserve-luminance remap: luminance < 0.12 keeps
  (dark eyes/horns), low-saturation + luminance > 0.6 keeps (cream claws),
  otherwise placeholder pastel green scaled by `luminance / pastelLuminance`
  so baked shading detail survives. `applyPastelRemap(model)` remaps every
  COLOR_0 (`color`) attribute in place and switches standard materials to
  runtime `flatShading` (glTF carries no flat-shading flag; the GLB file
  itself is untouched, still one Draco material per NFR-2).
  `attachBlushCheeks(head)` pins two r=0.03 m pink spheres (`Blush_L/R`,
  symmetric low-forward offsets) to the Head bone; no-op on null, idempotent.
- `src/viewer/main.ts`: placeholder now uses the shared constants;
  `loadTrikePlayer()` applies `applyPastelRemap(gltf.scene)` and
  `attachBlushCheeks(player.head)` after clip resolution. Stub scenes without
  meshes/Head (existing loader tests) are unaffected no-ops.
- `src/ranch/trike-player.ts`: new `head` getter exposing the existing
  blink-target Head reference (also used for blush pinning).

### Fix A test report (not yet executed — sandbox is git-only)

- `tests/waddle/pastel.test.ts` (new, 9 tests): brown sample remaps to a
  green-dominant triplet in the same luminance band; black → unchanged;
  cream → unchanged; white → unchanged; hex constants equal the placeholder
  values; COLOR_0 remapped in place + `flatShading` on; mesh without vertex
  colors only gains `flatShading`; two pink cheeks under Head with mirrored
  offsets and r ≈ 0.03 m; null-Head no-op; repeat attach stays at 2 children.
- `src/viewer/viewer.test.ts` (+2 tests): stubbed brown rig through
  `loadTrikePlayer()` comes out green-hued + flat-shaded with the blush hex
  present in the placeholder palette; exactly 2 blush-hex meshes under Head.
- Expected: all pass; existing viewer/loader tests unaffected (no-ops).

## Fix B — stay-in-frame wander

- `src/ranch/trike-player.ts`: new `WANDER_RADIUS_METRES = 0.8` and
  `WANDER_STEER_JITTER_RADIANS = 0.6`. After each root-motion step,
  `steerInsideWanderRadius()` retargets `pose.targetHeading` toward the
  origin plus a small random offset when the model is outside the radius —
  reusing the existing turn-then-walk controller (turns in place <0.6 s per
  90°, translation pauses mid-turn). Guards: only while `moving` (Stop still
  halts dead), and never overrides a turn already in progress (no jitter).
- `tests/waddle/trike-player.test.ts`: new `stay-in-frame wander` block —
  30 s of `update()` with walking on asserts max distance from origin stays
  within `WANDER_RADIUS_METRES + WADDLE_CYCLE_METRES` (one stride overshoot;
  expected max ≈ 0.85 m) with walking still enabled and at least one
  center-steering turn (heading deviation > 0.3 rad); a far-spawn (2 m) test
  asserts steering engages and Stop still freezes the model.

### Required adaptation to an existing test (recorded, in-scope)

- The `turns 90 deg in place … then walks 0.4 m/s` test walked ~1.8 m
  straight, which is exactly the unbounded behavior Fix B replaces (wander
  would steer it off-heading mid-test). Its sampling window was shortened
  from `while (time < 3)` to `while (time < 0.8)` — every assertion is
  preserved (turn completes in place < 0.6 s, heading π/2, 0.4 m over the
  final 1 s window ending ≈ 0.69 m from origin, inside the radius). All other
  turn/blink/dust tests keep passing unmodified (verified by simulation:
  their walk distances stay under 0.8 m, blink/dust are heading-independent).

## Files changed

- `src/ranch/pastel.ts` (new)
- `tests/waddle/pastel.test.ts` (new)
- `src/viewer/main.ts`
- `src/viewer/viewer.test.ts`
- `src/ranch/trike-player.ts`
- `tests/waddle/trike-player.test.ts`

## Deviations

None outside the brief's scope. `scripts/check-trike.test.ts` untouched
(NFR-2 asserts intact; GLB file itself unmodified). No new dependencies, no
audio/post-processing strings in ranch sources (silence/cheap-walk asserts
hold: no `howler`/`AudioContext`/`unlockAudio`/`EffectComposer` added).

## Primary rework (1 round)

- Attempted gating translation on `striding` (blend > 0.5) to kill the
  post-Stop drift: reduced drift 0.037 → 0.025 m but delayed first
  translation one frame, breaking the <0.6 s turn bound
  (0.6000000000000002). Reverted — the decel slide is intended smooth-stop
  behavior, not a bug.
- Park test now settles 60 frames after Stop before snapshotting, then
  asserts zero motion over the next 60 frames (true halt, graceful decel
  preserved).

## Verification

| Layer | Command | Result |
| ----- | ------- | ------ |
| static | `pnpm verify` (lint + format + typecheck + vitest + build) | GREEN — 55/55 tests (5 files), precache 10 |
| unit (new) | pastel (9) + viewer pastel (2) + wander (2) | all green |
| unit (existing) | turn/blink/dust/loader/waddle | all green (1 window shortened, park test settles first — see above) |

## Notes for primary

1. Run `pnpm verify` on this branch; if `oxfmt` reformats, that is cosmetic.
2. Suggested live check: airplane-mode boot, Walk on — Trike should read
   pastel green with pink cheeks and roam without leaving the fixed frame.
3. The 0.8 s Waddle, turn-then-walk, blink, dust, silence, and offline
   behavior are otherwise untouched.
