# Wallow and Nest Life - Implementation Plan

**Branch:** `feat/20261030-wallow-nest-life`
**Base:** `main` @ `c5c385c`

> Phase states: `pending` · `in_progress` · `verified` · `failed` · `blocked`.
> Only the primary implementation agent writes this file.

---

## Phase 1: Idle ships and the player blends

**Goal:** every species ships Polyfork's authored `Idle` alongside its walk clip,
and the player crossfades between them so a stopped dinosaur breathes instead of
holding a stride.
**Depends on:** none.
**Covers:** FR-1, FR-2, NFR-1, AC-1, AC-2.
**Touches:** `scripts/vendor/bake-stego-variant.js`, `scripts/vendor/bake-brachio-variant.js`,
`scripts/vendor/bake-stego-variant.py`, `scripts/vendor/bake-brachio-variant.py`,
`scripts/vendor/bake-stego-variant.d.ts`, `scripts/vendor/bake-brachio-variant.d.ts`,
`public/models/stego.glb`, `public/models/brachio.glb`, `public/models/trike.glb`,
`src/viewer/loaders.ts`, `src/ranch/dino-player.ts`, `CREDITS.md`,
`tests/scripts/check-stego-clips.test.ts`, `tests/scripts/check-brachio-clips.test.ts`,
`tests/waddle/dino-player.test.ts`.
**Verification:** `pnpm verify`, plus the recorded precache size before and after.

- [ ] **P1.T1: Ship `Idle` in the bake** - covers: FR-1
  - [ ] **P1.T1.1:** Add `Idle` to `SHIPPED_CLIP_NAMES` in both variant bakes and their `.py` twins, and update the contracts that still say `Walk` only.
  - [ ] **P1.T1.2:** Re-run both bakes and the Trike bake path, and commit the three GLBs.
  - [ ] **P1.T1.3:** Record the measured precache delta and amend NFR-1's figure in the evidence.
- [ ] **P1.T2: Loader asks for both clips** - covers: FR-1
  - [ ] **P1.T2.1:** `findWalkClip` becomes a two-clip lookup; a GLB missing `Idle` throws with the missing name and the clip list it does carry.
  - [ ] **P1.T2.2:** Pass the idle clip through `DinoPlayerOptions` and update every call site.
- [ ] **P1.T3: Two-action blend** - covers: FR-2
  - [ ] **P1.T3.1:** Add the idle action to the mixer and drive `walkWeight` / `1 - walkWeight` from the existing eased blend.
  - [ ] **P1.T3.2:** Assert weights sum to 1 within 1e-6 at a mid-blend sample and that a stopped player reads `Idle` at 1.
- [ ] **P1.T4: Clip gates** - covers: FR-1, NFR-1
  - [ ] **P1.T4.1:** Extend the clip gate tests to pin `Idle` + walk per species with durations and track counts.
  - [ ] **P1.T4.2:** Add a test that a GLB without `Idle` fails loudly rather than falling back.

---

## Phase 2: The ring becomes a place

**Goal:** the wander ring is a centre and a radius a player can be given, and with
no visit active it is exactly today's world-origin circle.
**Depends on:** Phase 1.
**Covers:** FR-3, AC-3.
**Touches:** `src/ranch/dino-player.ts`, `tests/waddle/dino-player.test.ts`,
`tests/waddle/trio-wander.test.ts`.
**Verification:** `pnpm verify`.

- [ ] **P2.T1: Parameterise the ring** - covers: FR-3
  - [ ] **P2.T1.1:** Replace the world-origin `Math.hypot` in `steerInsideWanderRadius()` with a `centre` + `radius` pair defaulting to `(0, 0)` and the gait radius.
  - [ ] **P2.T1.2:** Add `setWanderRing(centre, radius)` and a getter, with no other behaviour change.
- [ ] **P2.T2: Pin the default** - covers: AC-3
  - [ ] **P2.T2.1:** Assert a 60 s seeded run with no ring override reproduces today's positions to 1e-9.
  - [ ] **P2.T2.2:** Assert an overridden ring actually holds the animal inside the new circle.

---

## Phase 3: Stego's mud roll

**Goal:** Stego has a bespoke `MudRoll` clip authored by a checked-in deterministic
script, baked into `stego.glb`, and gated by a test that reads the shipped file.
**Depends on:** Phase 1.
**Covers:** FR-6, NFR-7, AC-6.
**Touches:** `scripts/vendor/bake-stego-mudroll.py`, `scripts/vendor/bake-stego-variant.js`,
`public/models/stego.glb`, `tests/scripts/check-stego-clips.test.ts`,
`conductor/tracks/20261030-wallow-nest-life/verification/phase-3.md`.
**Verification:** `pnpm verify`, plus the bake run recorded in the evidence.

- [ ] **P3.T1: Author the roll** - covers: FR-6
  - [ ] **P3.T1.1:** Write the Blender script: Hips drop and roll, Chest counter-roll, Neck dip, Tail swish, legs splay, one rise-and-shake, ~4 s at the scene's 30 fps.
  - [ ] **P3.T1.2:** Key it on the 24 named bones only, deterministically, with no random and no dependence on scene state.
  - [ ] **P3.T1.3:** Render or screenshot the pose at three frames and record them as evidence that the roll reads as a roll.
- [ ] **P3.T2: Bake it in** - covers: FR-6, NFR-7
  - [ ] **P3.T2.1:** Graft `MudRoll` beside `Idle`/`Walk` in the Stego bake and commit the GLB.
  - [ ] **P3.T2.2:** Prove re-running the script reproduces the same duration and track count.
- [ ] **P3.T3: Gate the clip** - covers: AC-6
  - [ ] **P3.T3.1:** Extend the Stego clip gate to pin `Waddle`, `Walk`, `Idle`, `MudRoll` with durations.
  - [ ] **P3.T3.2:** Add a viewer test that a GLB missing `MudRoll` falls back to `Idle` with a warning instead of throwing.

---

## Phase 4: The visit

**Goal:** each animal can be sent to its corner and come home, with anchors,
derived durations, the seeded timer and avoidance intact.
**Depends on:** Phases 2 and 3.
**Covers:** FR-4, FR-5, FR-9, FR-11, AC-4, AC-5, AC-9, AC-11.
**Touches:** `src/ranch/visit.ts`, `src/ranch/layout.ts` (anchors export only),
`src/viewer/loop.ts`, `src/viewer/main.ts`, `tests/ranch/visit.test.ts`.
**Verification:** `pnpm verify`.

- [ ] **P4.T1: Anchors** - covers: FR-5
  - [ ] **P4.T1.1:** Export a per-species anchor, arrival radius and facing from the corner definitions in `layout.ts` — wallow mud centre, hay-nest centre, browse-tree foot.
  - [ ] **P4.T1.2:** Assert each anchor sits inside its corner's staged props and outside every camera's lens corridor.
- [ ] **P4.T2: State machine** - covers: FR-4
  - [ ] **P4.T2.1:** Write `src/ranch/visit.ts`: `idle → approach → arrive → dwell → return → idle`, with durations derived from distance, the species' walk speed and the dwell clip.
  - [ ] **P4.T2.2:** Drive the player through `setWanderRing` and `turnTo` only — no new locomotion.
  - [ ] **P4.T2.3:** Assert the full cycle and that no state is skipped for any species.
- [ ] **P4.T3: Timer** - covers: FR-9
  - [ ] **P4.T3.1:** Per-animal seeded timer near 45 s with jitter, gated on walking being on.
  - [ ] **P4.T3.2:** Assert each species visits within 90 s of a seeded run and the three do not start in the same second.
- [ ] **P4.T4: Avoidance in transit** - covers: FR-11
  - [ ] **P4.T4.1:** Keep `trioAvoidanceNudges` running on visit headings.
  - [ ] **P4.T4.2:** Assert pair separation never drops below the pair clearance across two simultaneous approaches.

---

## Phase 5: Call and payoff

**Goal:** a corner answers a tap by calling its animal, arrives with mud, straw or
leaves, and turning Walk off brings everyone home.
**Depends on:** Phase 4.
**Covers:** FR-7, FR-8, FR-10, FR-12, FR-13, AC-7, AC-8, AC-10, AC-12, AC-13.
**Touches:** `src/ranch/visit-effects.ts`, `src/ranch/ambient.ts`,
`src/viewer/main.ts`, `src/viewer/loop.ts`, `tests/ranch/visit-effects.test.ts`,
`tests/ranch/ambient.test.ts`.
**Verification:** `pnpm verify`.

- [ ] **P5.T1: Tap to call** - covers: FR-8
  - [ ] **P5.T1.1:** Route a corner-prop tap through the existing raycast to `callVisit`, keeping the sparkle in the same frame.
  - [ ] **P5.T1.2:** Add the per-corner cooldown and assert a second tap inside it does not restart the journey.
- [ ] **P5.T2: Arrival effects** - covers: FR-7, FR-12
  - [ ] **P5.T2.1:** Mud ripple ring plus splash droplets at the wallow, straw puff at the nest, leaf drift at the tree, all from the shared `DustPool`, once per arrival.
  - [ ] **P5.T2.2:** Assert the pool's live count returns to zero within 2 s and nothing emits after.
- [ ] **P5.T3: Arrival sound** - covers: FR-13
  - [ ] **P5.T3.1:** Play the species coo once on arrival and `tap` for the splash, through the existing voice path so ducking applies.
  - [ ] **P5.T3.2:** Assert one coo per arrival and silence under mute.
- [ ] **P5.T4: Walk off sends everyone home** - covers: FR-10
  - [ ] **P5.T4.1:** End any visit in progress when walking stops, returning the animal from wherever it stands.
  - [ ] **P5.T4.2:** Assert no animal is left stranded outside its ring and the machine settles at `idle`.

---

## Phase 6: Harness, motion, docs and PR

**Goal:** the feature is inspectable, deterministic, documented, and shown in
pictures.
**Depends on:** Phase 5.
**Covers:** FR-14, FR-15, FR-16, NFR-2, NFR-4, NFR-5, NFR-6, NFR-8, AC-14, AC-15, AC-16, AC-17, AC-18.
**Touches:** `src/dev/harness.ts`, `src/dev/snapshot.ts`, `src/dev/harness-state.ts`,
`index.html` (panel markup only), `conductor/product.md`,
`conductor/product-guidelines.md`, `conductor/tech-stack.md`,
`tests/dev/snapshot.test.ts`, `tests/dev/harness-panel.test.ts`,
`conductor/tracks/20261030-wallow-nest-life/`.
**Verification:** `pnpm verify`, plus four captures.

- [ ] **P6.T1: Harness** - covers: FR-14
  - [ ] **P6.T1.1:** `callVisit(species)` and `getVisitState()` on `window.__ranch`, snapshot fields, one panel button per corner.
  - [ ] **P6.T1.2:** Assert the snapshot carries visit state and the panel drives a full visit.
- [ ] **P6.T2: Reduced motion and determinism** - covers: FR-15, FR-16, NFR-5
  - [ ] **P6.T2.1:** Clips keep playing under reduced motion while ripple, splash and sparkle complete in one frame.
  - [ ] **P6.T2.2:** Assert two seeded runs produce identical visit schedules and positions.
- [ ] **P6.T3: Docs** - covers: NFR-6
  - [ ] **P6.T3.1:** `product.md` and `product-guidelines.md`: the trio visits its corners, tapping calls an animal, and no visit is ever required.
  - [ ] **P6.T3.2:** `tech-stack.md`: the two-clip player, the parameterised ring, the visit module and the Stego bake script.
- [ ] **P6.T4: Evidence and PR** - covers: AC-17, AC-18
  - [ ] **P6.T4.1:** Capture Ranch, Nest, Garden and Sky at 1280x800, at least one with an animal at its corner, and attach them with alt text.
  - [ ] **P6.T4.2:** Write `verification/phase-6.md`, run the integrated gate and the offline smoke.
