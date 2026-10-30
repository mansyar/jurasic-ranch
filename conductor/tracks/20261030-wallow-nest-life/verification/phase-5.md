# Phase 5 — Call and payoff

| | |
| --- | --- |
| **Track** | `20261030-wallow-nest-life` |
| **Phase** | 5 — Call and payoff (P5.T1–P5.T5) |
| **Date** | 2026-10-30 |
| **Branch** | `feat/20261030-wallow-nest-life` |
| **Base** | `cc175066be1f20654750ef44167e5d7f715d6be3` |
| **Head** | `5914364a145f71d980f87568d94c6980b7eefce7` |
| **Result** | `pnpm verify` exit 0 — 56 files / 736 tests, precache 8964.80 KiB |

## What this phase adds

A tap on any prop of a corner now calls that corner's animal: the sparkle is
already up in the frame the tap landed in, the call is gated per corner, and the
journey starts after it. Each arrival throws up its own shape from one
preallocated pool — a ripple ring and a splash at the wallow, a straw puff at the
hay nest, a leaf drift under the browse tree — says its species coo once through
`playFeedback`, and (for Stego) plays its `MudRoll` once at rest before `Idle`
takes the weight back. Walk off no longer leaves an animal out at its corner: the
visit is cut short and the animal walks home from wherever it stands.

New module: `src/ranch/visit-effects.ts`. No new dependency, asset or sound file.

## Commands

| Command | Result |
| --- | --- |
| `pnpm lint` | clean (oxlint, `scripts/vendor` ignored) |
| `pnpm format --check` | `All matched files use the correct format.` — 106 files, 20 threads |
| `pnpm typecheck` | clean (`tsrs --noEmit`) |
| `pnpm coverage` | 56 files / **736 tests passed**; statements **84.93 %** (2865/3373), branches **70.16 %** (889/1267), functions **86.45 %** (485/561), lines **84.94 %** (2804/3301) |
| `node scripts/check-audio-pack.mjs` | `audio pack ok: 15 assets (1 music, 6 sfx, 8 voice), 853289 bytes` |
| `pnpm build` | `dist/assets/index-D9QLVCXv.js` 714.04 kB (gzip 187.43 kB); 44 modules |
| `node scripts/check-dist-clean.mjs` | `dist clean: no dev harness markers in dist` |
| **`pnpm verify`** | **exit 0** (all of the above in one run) |

`pnpm format` itself was denied in this sandbox (see Deviations), so formatting was
checked with the `--check` step inside `pnpm verify` and corrected by hand.

## Proof per requirement

Line numbers are on the head commit above.

| Req | Where | Proof |
| --- | --- | --- |
| **FR-6** — Stego's `MudRoll` plays once on arrival, back to `Idle` | `src/viewer/loaders.ts:83` (`MUD_ROLL_CLIP_NAME`), `:221-232` (optional lookup, warn not throw), `:302` (only Stego asks) · `src/ranch/dino-player.ts:365` (third action, `LoopOnce`/`clampWhenFinished`), `:428` (`playArrivalClip`), `:577-582` (released when the walk blend rises or the clip ends) · `src/ranch/visit.ts:374` (asked on the `arrive` frame) | `tests/waddle/dino-player.test.ts` → *plays once, owns the pose while it runs, and hands the weight back to Idle*; *lets go the moment the animal strides, so the walk blend is never disturbed*; *is a no-op for a player whose GLB carries no such clip*. `tests/viewer/viewer.test.ts` → *gives Stego its roll, so the corner can play it*; *never asks the Trike or the Brachio for it, even when their GLB has one* |
| **FR-6 (edge)** — a GLB without `MudRoll` falls back to `Idle` with a warning, never throws | `src/viewer/loaders.ts:224-231` | `tests/viewer/viewer.test.ts` → *falls back to Idle with a warning when the GLB carries no roll* (asserts the load resolves, one `console.warn` naming `MudRoll`, and `playArrivalClip()` returns false) |
| **FR-7** — Trike dwells on `Idle` + straw, Brachio on `Idle` + leaf, no bespoke clips | `src/ranch/visit-effects.ts:20-25` (`ARRIVAL_EFFECTS`), `:145` (`arrive`) | `tests/ranch/visit-effects.test.ts` → *gives each corner its own shape and its own coo*; *reads as three different shapes, not one shape in three places* (spreads measured on the pool's own positions: straw ≥ 0.35 m, ripple ≥ 0.6 m, leaf ≥ 0.5 m, strictly widening) |
| **FR-8** — tap a corner prop calls that animal; sparkle inside 100 ms; animal sets off after | `src/ranch/ambient.ts:251` (`cornerUnderProp`, identity by `file` + exact `position`), `:271` (`CALL_COOLDOWN_MS`), `:282` (`CallCooldowns`) · `src/viewer/main.ts:407-411` (call after the sparkle) | `tests/ranch/ambient.test.ts` → *calls the corner that owns the prop, for every prop of every corner*; *lets any prop of a corner call the same animal: the bale and the berry bush*; *needs the file and the place both*; `tests/viewer/viewer.test.ts` → *sparkles first and calls the corner after, in the same frame* (asserts the sparkle call precedes the call in the handler, so nothing is awaited between them) |
| **FR-8 (edge)** — a second tap inside the cooldown does not restart the journey | `src/ranch/ambient.ts:282-300` (per-corner map) | `tests/ranch/ambient.test.ts` → *refuses a second call to the same corner until it cools*; *is per corner, so two corners can be called back to back*; `tests/ranch/visit.test.ts` → *sparkles again but leaves the journey running as it was* (asserts `visitsStarted` and `approachSeconds` unchanged) |
| **FR-8 (edge)** — tap while Walk off → sparkle only, no visit | `src/ranch/visit.ts` `startVisit` (refused unless the director has been told Walk is on) | Existing `tests/ranch/visit.test.ts` → *never turns walking on while Walk is off*; the cooldown test drives the handler order with Walk on |
| **FR-10** — Walk off ends every visit in progress, each animal returns from where it stands | `src/ranch/visit.ts:281` (`abandonVisit` before advancing), `:443` (only `approach`/`arrive`/`dwell` are cut short) | `tests/ranch/visit.test.ts` → *turns the animal around from where it stands, then walks it home* (body position bit-identical on the turn-around frame; still outside its ring for > 30 frames of `return`); *ends a visit already at its corner, so nobody is left out* |
| **AC-6** — `stego.glb` carries `MudRoll` at its measured duration, and the viewer plays it | as FR-6 | as FR-6. The GLB's own 4.000 s bake is Phase 3's (`conductor/tracks/.../verification/phase-3.md`); this phase proves the hand-off and the one-shot |
| **AC-7** — puff/drift once per arrival, no emitter afterwards | `src/ranch/visit-effects.ts:145-183` | `tests/ranch/visit-effects.test.ts` → *throws up one burst per arrival, and the pool is empty inside 2 s* (then 120 more frames, still empty); *never restarts a burst that is still in the air* (second arrival: coo only, `aliveCount` unchanged) |
| **AC-8** — sparkle same frame then approach; second tap inside the cooldown does not restart | as FR-8 | as FR-8 |
| **AC-10** — Walk off during approach returns the animal to its ring; settles at `idle`, nobody stranded | `src/ranch/visit.ts:281,443` | `tests/ranch/visit.test.ts` → *turns the animal around from where it stands, then walks it home* (every species ends `idle`, home distance ≤ `DINO_WALK_RADIUS_METRES`, ring restored to the home ring) |
| **AC-12** — ripple + splash from the shared dust pool, live count back to zero within 2 s | `src/ranch/visit-effects.ts:82` (`ARRIVAL_PEAK_PARTICLES` = 36 ≤ `DUST_POOL_SIZE` 48), `:185` (`update`) | `tests/ranch/visit-effects.test.ts` → *throws up one burst per arrival, and the pool is empty inside 2 s*; *keeps one arrival inside the pool budget, so a burst never recycles itself*; *holds still on a paused frame* (`update(0)` × 30 keeps the count) |
| **AC-13** — species coo exactly once; mute silences | `src/ranch/visit-effects.ts:28-33` (`ARRIVAL_COO`), `:36` (`SPLASH_SOUND = 'tap'`) · `src/viewer/main.ts:237-241` (`playSound: playFeedback`) | `tests/ranch/visit-effects.test.ts` → *says the species coo once, and the splash only at the wallow*; the sink is `playFeedback`, which already holds the gesture gate, mute and ducking (`tests/viewer/audio-routing.test.ts` pins that path) |
| **FR-12** — arrival effects from the existing `DustPool`, nothing continuous | `src/ranch/visit-effects.ts:101` (one `DustPool`, named `RanchArrivalDust`), `:145` · `src/viewer/main.ts:237-242` | as AC-7/AC-12; plus *shares the walk dust sprite and carries a name of its own* (same texture, distinct name so the harness and the draw-call count can tell the pools apart) |
| **FR-13** — audio reuses `coo-*` at arrival and `tap` for the splash, nothing before the first gesture, mute silences | `src/ranch/visit-effects.ts:28-36` | as AC-13 |
| **FR-15 (reduced motion)** — clip plays, effects settle instantly, sparkle still shows, coos still play | `src/ranch/visit-effects.ts:185-198` | `tests/ranch/visit-effects.test.ts` → *settles the arrival in a single reduced-motion frame* (no burst, coo still sent; a burst already in the air is retired on that frame) |
| **`&pause=1` freezes visits** | `src/viewer/loop.ts:247` (`arrivals?.update(dt, …)` behind the `dt <= 0` early return) | *holds still on a paused frame*; the loop's own pause early-return is pinned by `tests/viewer/dev-harness-gate.test.ts` |

## Cost

| Measure | Before (phase 4) | After |
| --- | --- | --- |
| Precache | 63 entries, 8961.75 KiB | 63 entries, **8964.80 KiB** (+3.05 KiB) |
| Bundle | `index-a99FMjj_.js` 710.91 kB (gzip 186.40) | `index-D9QLVCXv.js` 714.04 kB (gzip 187.43) |
| Audio pack | 15 assets, 853,289 B | 15 assets, 853,289 B (unchanged — no new SFX) |
| `src/ranch/visit-effects.ts` (new) | — | absent from the per-file table, which is the reporter eliding rows that are 100 % on all four columns (the same reason `avoidance.ts` and `pov.ts` are absent). Its nine tests drive `arrive`, `update`, the ring, the arc and the puffs |
| Draw calls / triangles | — | **not measured here**: no GPU in this sandbox. By construction the arrival payoff adds exactly one draw call (one `THREE.Points` on one pool, `visit-effects.ts:101-108`), so the ceiling of 150/80,000 is untouched in shape; Phase 6's `snapshot()` will print the real numbers |
| New dependencies | — | none |

## Deviations

| File | Reason |
| --- | --- |
| `pnpm format` (denied in this sandbox) | The formatter run itself is not permitted here, so every formatting fix was made by hand against `oxfmt --check` inside `pnpm verify`. It took four passes: oxfmt wants a call's argument list and a function's parameter list on **one** line whenever they fit in 100 columns, and breaks a >100-column signature into a named `interface` rather than a wrapped return type. No assertion was weakened to get there. |

No file outside the phase's `Touches` list was modified.

## Not proven here

- **Nothing was seen on a GPU.** No capture, no screenshot, no frame timing. Phase
  6 owns the harness captures; this evidence is unit- and wiring-level only.
- **The three shapes were measured, not looked at.** The test proves the spreads
  differ (0.35 m / 0.6 m / 0.5 m+ and widening); whether a straw puff *reads* as
  straw at the nest is a capture question.
- **The coo was never heard.** The tests prove one coo per arrival goes to
  `playFeedback` and that no sound is sent under reduced motion for the burst;
  that the sfx bus is silent under mute and behind the gesture gate is pinned by
  the existing `tests/viewer/audio-routing.test.ts`, not re-proven here.
- **The roll's 4.000 s length is Phase 3's bake**, read from the shipped GLB by
  the Phase 3 gate. This phase proves the loader hands it over and that it plays
  once, but the clip itself was not re-inspected.
- **The real `stego.glb` was not loaded** in these tests — the loader tests stub
  `GLTFLoader`. A GLB that loses its `MudRoll` is covered by the warn-and-fall-back
  path, but the shipped file's clip list is asserted by the bake gate, not here.
- **Arrival effects were not checked against the arrival radius**: the ripple is
  drawn at the corner anchor inside the 1.25 m mud disc, which is a layout fact
  (`WALLOW_MUD_RADIUS_METRES`), not something this phase re-measured.
