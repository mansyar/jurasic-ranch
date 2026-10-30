# Phase 1 — Idle ships and the player blends

Status: **verified**. `pnpm verify` exits 0 on the tree described here.

Covers FR-1, FR-2, NFR-1, AC-1, AC-2.

## 0. Who did what

Attempt 1 was **blocked**: `node` is denied in this sandbox, so the bakes could
not run, and the Polyfork clip donors the variant bakes read
(`.conductor/evidence/polyfork/*.glb`) are gitignored and absent from a fresh
worktree.

The orchestrator cleared both: it downloaded the donors and ran all three bakes.
**This attempt did not run a bake.** It committed the resulting GLBs untouched
and did the code and the tests. Every number in §1 is the orchestrator's
measurement, re-verified here by parsing the committed files (a temporary vitest
probe, since `node` is denied and the read tool refuses binaries; the probe was
staged and removed, tree clean).

## 1. What the shipped files carry (measured)

| File | Bytes | Clips |
|---|---|---|
| `public/models/trike.glb` | 160,568 | `Idle` 6.000 s / 72 ch / 145 keys, `Waddle` 0.792 s / 72 ch / 20 keys |
| `public/models/stego.glb` | 1,289,948 | `Idle` 9.000 s / 48 ch, `Walk` 2.400 s / 48 ch |
| `public/models/brachio.glb` | 1,926,840 | `Idle` 8.000 s / 70 ch, `Walk` 3.800 s / 70 ch |

`Run` is absent from all three. `Waddle` appears only on the Trike.

### 1.1 The Trike's `Idle` does not come from the same path

`public/models/trike.glb` is produced by **`scripts/bake-trike-variant.js`** (repo
root `scripts/`, not `scripts/vendor/`). It is a *retarget* bake, not a graft:

1. builds the variant group from the vendored parametric module;
2. reads the **previous** `trike.glb` (`--prev` defaults to the same path, in
   place) and retargets its `Waddle` onto the new skeleton;
3. routes that one clip through `GLTFExporter` (so it emits TRS for every
   animated node: 72 channels), then a headless Blender Draco pass.

The `Idle` therefore needed a second source, which the orchestrator added:
`IDLE_SOURCE_GLB` = `assets/trike/triceratops-base.glb` (tracked, in-repo) plus
`extractAnimationTracksByName(bytes, clipName)`, and `buildRetargetedClip` grew
an optional expectation `{name, minSeconds, maxSeconds, positionScale}`.

**The guard correction, measured.** The old code assumed the previous GLB carried
a 0.3 root scale and multiplied every retargeted translation by
`POSITION_TRACK_SCALE = 0.6`. That is wrong for the shipped file: no node in
`trike.glb` carries a uniform scale, `Hips` binds at 1.332 m against the adult
base's 2.220 m, and the waddle's translations are already in size-0.6 space
(`Hips` mean distance 1.4955 vs the adult donor's 2.4929). So the previous GLB's
tracks are copied with `positionScale: 1` and only the adult `Idle` donor is
scaled by 0.6. Re-running the old code would have shortened every footfall by
40%. `scripts/check-trike.test.ts` now pins this: the `Waddle` `Hips` translation
mean must stay 1.4955 (a re-scaled waddle reads 0.897).

**Determinism.** The orchestrator ran the Trike bake twice and got the same
SHA256 (`24E9E4F1…`), so the committed GLB is reproducible from the checked-in
sources. `bakeTrikeVariant` now returns `{outPath, clips: [{name, durationSeconds,
trackCount}]}` and `scripts/bake-trike-variant.d.ts` matches.

`SHIPPED_CLIP_NAMES` is now `['Idle', 'Walk']` (serialisation order) in
`scripts/bake-trike-variant.js` — one shared constant, not four per-bake copies.

## 2. P1.T2 — the loader asks for both clips (`src/viewer/loaders.ts`)

- `findIdleClip(animations)` looks up `Idle` by name; `IDLE_CLIP_NAME` is a single
  constant because all three species carry the same authored name.
- `loadDinoPlayer` resolves the walk clip first (unchanged `Walk` / `Waddle`
  preference, still no `animations[0]` fallback), then the idle clip. A GLB
  missing either throws naming the missing clip **and every clip it does carry**:

  ```
  Trike GLB has no Idle clip (the walk/rest blend needs one; it carries Waddle)
  ```

- Both clips are passed through `DinoPlayerOptions`; every call site is
  `loadDinoPlayer`, so there is nothing else to update.

`src/viewer/main.ts` is unchanged. Its `console.warn(... 'keeping the
placeholder')` handler is why this had to be done *after* the bakes: shipping the
loader against a one-clip GLB would have replaced all three rigged dinosaurs with
procedural placeholders, which is worse than the frozen pose it fixes.

## 3. P1.T3 — the two-action blend (`src/ranch/dino-player.ts`)

- `DinoPlayerOptions.idleClip` is **optional** and defaults to today's behaviour:
  omitted, no second action is created and `blendWeights` reports `{idle: 0,
  walk: 0}`. `tests/dev/dev-harness-gate.test.ts` still sees `main.ts` pass both
  `random` and `blinkRandom`; no new option touches those.
- The idle action joins the same mixer, `LoopRepeat`, weight 1 at construction
  (the pose starts stopped, so blend 0 is its complement).
- Every frame: `action.weight = pose.blend`, `idleAction.weight = 1 - pose.blend`.
- **The mixer is hoisted out of the walk deadband.** `mixer.update(step)` used to
  sit inside `if (blend > 0.5)`; with two actions that freezes the rest loop at the
  exact moment it becomes visible. It now runs unconditionally, and everything
  that reads the walk's foot-plant phase stays gated where it was: `loopTime`,
  `plantsCrossed`, dust puffs, `prevPhase`, and the squash term (still multiplied
  by `pose.blend`). Root motion, wander steering, heading, blink, sleepy and
  avoidance are untouched.
- `get blendWeights(): {idle, walk}` reads the two actions' live weights, so the
  test asserts what the mixer holds rather than recomputing from the pose.

## 4. P1.T4 — clip gates

Two assertions were **deliberately inverted**, not deleted:

| File | Before | After |
|---|---|---|
| `scripts/check-stego.test.ts` | `Idle` absent | `Idle` required at 9 s / 48 ch; `Run` still absent |
| `scripts/check-brachio.test.ts` | `Idle` absent | `Idle` required at 8 s / 70 ch; `Run` still absent |
| `scripts/check-trike.test.ts` | exactly one clip, `Waddle` | exactly `['Idle', 'Waddle']`, 72 ch each, 6.0 s / 0.79–0.81 s, plus the 1.4955 Hips-space proof |
| `scripts/check-dino-clips.test.ts` | name set `['Walk']` | name set `['Idle', 'Walk']` with both durations per species |

Size caps were raised to match the shipped files, and say so in a comment:
Trike 150 KB → 200 KB (157 KB shipped), Stego 512 KB → 1400 KB (1260 KB),
Brachio 900 KB → 2100 KB (1882 KB). The real ceiling is NFR-1 (15 MB); these
gates exist to catch a runaway bake.

New tests in `tests/waddle/dino-player.test.ts` (`two-action blend (FR-2, AC-2)`):

- stopped: `walk` 0, `idle` 1 (9 dp);
- 40 frames of walking: `idle + walk` is 1 within 1e-6 on **every** frame, and at
  least one frame is sampled mid-blend;
- **mixer advances while stopped**: with walk weight 0 throughout, the `Hips`
  bone driven by the idle clip moves across 20 frames. This is the regression the
  phase exists to prevent — under the old gate the bone never moved;
- a player built without `idleClip` still reports `{idle: 0, walk: 0}`.

New test in `src/viewer/viewer.test.ts`: a GLB carrying `Waddle` but no `Idle`
rejects with `/no Idle clip.*carries Waddle/` (AC-1: loud, never a fallback).

## 5. NFR-1 — precache, measured with a real build

| | `pnpm build` → workbox | Entries |
|---|---|---|
| Before (attempt-1 tree, `Walk`/`Waddle` only) | **6,703.24 KiB** | 63 |
| After (this tree, `Idle` + walk) | **8,914.29 KiB** | 63 |
| **Delta** | **+2,211.05 KiB** | 0 |

The entry count is unchanged because no file was added; only three GLBs grew.
Against NFR-1's 15 MB (15,360 KiB) ceiling that leaves 6,445.71 KiB of headroom.
The inherited estimate for the two-clip set was +2.86 MiB; the measured cost is
2.16 MiB, so the estimate was conservative by ~0.7 MiB. This figure supersedes
the attempt-1 table, whose delta was 0 only because no GLB had been re-baked.

Bundle: `dist/assets/index-CXt2xXDF.js` 706.39 kB (gzip 184.80 kB) — +0.55 kB on
the previous 705.84 kB, from the loader and blend code.

## 6. Collateral, and why

Shipping `Idle` breaks every gate that assumed one clip, and the bake's
`animations[0]` ordering changes what `extractAnimationTracks` returns:

- `tests/waddle/pastel.test.ts`, `tests/waddle/stride.test.ts` — switched from
  `extractAnimationTracks` (first animation, now `Idle`) to
  `extractAnimationTracksByName(bytes, 'Waddle')`.
- `tests/waddle/{stego,brachio}-pastel.test.ts` — expected clip list and
  `CLIP_SECONDS` gained `Idle`.
- `src/viewer/viewer.test.ts`, `tests/waddle/{dual,trio}-viewer.test.ts` — loader
  fixtures gained an `Idle` clip so they still exercise what they claim to.
- `tests/waddle/brachio-pastel.test.ts` — one test got an explicit 30 s timeout:
  the graft now builds two clips (an 8 s `Idle` over 35 bones), so the
  parse-and-rebuild work roughly doubled and sat at the 5 s default under
  coverage. No assertion changed.

## 7. Deviations from the phase brief

- `scripts/bake-trike-variant.{js,d.ts}` are outside the plan's original Touches
  (which named only the two `scripts/vendor/` bakes). They are the only place
  `SHIPPED_CLIP_NAMES` lives and the only path that can emit the Trike's `Idle`;
  the orchestrator edited them and this phase committed them. Recorded here
  rather than silently expanded.
- The brief's `tests/scripts/check-{stego,brachio}-clips.test.ts` do not exist;
  the real gates are `scripts/check-{stego,brachio,trike,dino-clips}.test.ts`.
- `tests/waddle/{pastel,stride,stego-pastel,brachio-pastel,dual-viewer,trio-viewer}.test.ts`
  and `src/viewer/viewer.test.ts` are outside Touches but had to be updated, or
  `pnpm verify` cannot pass. Every edit is a fixture or expectation update, no
  assertion weakened.

## 8. Verification

```
pnpm verify
```

- `oxlint` clean (one unused-import warning found and removed).
- `oxfmt --check` — 100 files, correct format.
- `tsrs --noEmit` clean.
- `vitest run --coverage` — **54 files, 678 tests passed**.
  Coverage: statements 84.13 %, branches 68.58 %, functions 85.68 %, lines
  **84.15 %** (floor 60 %). `src/ranch/dino-player.ts` 100 % lines,
  `src/viewer/loaders.ts` 96.42 %.
- audio pack ok: 15 assets (1 music, 6 sfx, 8 voice), 853,289 bytes.
- `vite build` clean; `PWA … precache 63 entries (8914.29 KiB)`.
- `dist clean: no dev harness markers in dist`.
