# Wallow and Nest Life - Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

The trio can go somewhere on purpose. Each animal owns a corner of the paddock,
and now it can walk out to it: Stego rolls in the mud, Trike settles into the hay
nest, Brachio browses under the plum tree. A tap on a corner calls its animal; a
slow seeded timer sends it out on its own. Every species also carries Polyfork's
authored `Idle`, so an animal that has arrived breathes and shifts instead of
standing frozen.

## Problem / Motivation

The ranch vista track staged three corners as *composition* — the wallow, the hay
nest and the browse tree were placed to fill a camera frame, not to be used. They
sit at 9.0-9.3 m from the paddock centre while every dinosaur wanders inside a
3.71 m ring, so nothing ever goes near them. The corners are scenery that the
animals conspicuously ignore, which reads as a diorama rather than a home.

The second half of the problem is stasis. `Idle` was withdrawn from the shipped
GLBs on the previous track because `Idle` + `Walk` cost 2.86 MiB against a 2 MiB
ceiling, so a dinosaur that stops walking holds its last walk pose. Every pause
in the game is currently a statue.

Both are felt immediately by the child: the animals have somewhere to be and
never go there, and when they stop they look switched off.

## Goals & Success Metrics

- **Goal:** every corner is a place an animal goes, and every stopped animal is
  visibly alive.
- **Metric:** all three corners are visited by their own species within one
  minute of play with no input (the seeded timer), and each species ships an
  `Idle` that plays whenever its walk weight falls to zero.
- **Goal:** a tap on a corner produces an immediate answer and then a journey.
- **Metric:** the sparkle lands in under 100 ms; the animal is standing at its
  corner within 8 s of the tap.
- **Goal:** the offline budget and frame rate survive.
- **Metric:** precache stays at or under 15 MB (measured ~9.6 MB after `Idle`),
  draw calls at or under 150 and triangles at or under 80,000 (today 76 and
  51,340), measured from `window.__ranch.snapshot()`.
- **Goal:** a seeded run still reproduces frame for frame.
- **Metric:** `/?dev=1&seed=42&pause=1` produces identical dino positions and
  visit states across runs, asserted by a determinism test.

## Scope

### In Scope

- Re-shipping Polyfork's authored `Idle` for Trike, Stego and Brachio, and
  teaching the loader and player to blend it against `Walk`.
- A bespoke `MudRoll` clip for Stego, authored by a checked-in deterministic
module and baked into `stego.glb`.
- A per-animal visit state machine: idle, approach, arrive, dwell, return.
- Parameterising the wander ring (centre + radius) so a visit can give an animal
  a different home for its duration, without changing today's wander.
- Two triggers: tapping a corner prop to call that animal, and a seeded ~45 s
  autonomous timer.
- All three animals may be out at once; turning Walk off sends everyone home.
- Arrival payoff effects from the existing `DustPool`: a mud ripple and splash at
  the wallow, a straw puff at the nest, a leaf drift at the browse tree.
- Reusing the existing `coo-*` and `tap` SFX; no new audio files.
- Dev harness controls and snapshot fields for visit state.

### Out of Scope

- Feed, wash and cuddle mechanics (roadmap Tracks 4 and 5).
- Any bespoke clip other than Stego's `MudRoll`.
- Pathfinding beyond steering — no navmesh, no obstacle graph.
- Changes to the four camera presets, the ground, the sky, or the prop staging.
- Counters, rewards, sticker book entries, or HUD changes.
- New runtime dependencies, new SFX files, or new dressing props.
- Making a visit *required* for anything. Nothing gates on a visit.

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | `Idle` ships for all three species. The loader asks for `Idle` and `Walk` by name, and the bake ships both in `SHIPPED_CLIP_NAMES`. A GLB missing `Idle` fails loudly at load rather than falling back to the walk pose. | must |
| FR-2 | The player blends two actions: the eased walk weight drives `Walk` and its complement drives `Idle`, over the existing 0.2 s blend. A dinosaur whose walk weight has reached zero shows `Idle` at full weight, never a frozen stride. | must |
| FR-3 | The wander ring is a centre and a radius held per player. With no visit active it is the world-origin circle at the gait radius, so wander behaviour is unchanged to the millimetre. | must |
| FR-4 | A visit is a per-animal state machine — `idle`, `approach`, `arrive`, `dwell`, `return` — with approach and return durations derived from the distance and the animal's own walk speed, and dwell derived from the clip that plays there. | must |
| FR-5 | Each corner publishes an anchor and an arrival radius: the wallow's mud centre, the hay nest's centre, the browse tree's foot. On arrival the animal faces the corner, so the camera sees it using the place rather than standing across it. | must |
| FR-6 | Stego's `MudRoll` clip is authored by a checked-in, deterministic authoring module (`scripts/vendor/mud-roll-clip.js`), plays once on arrival, and returns to `Idle`. Re-running the bake reproduces the clip byte-for-byte. *Amended 2026-10-30 during Phase 3: authored in Node, not Blender.* | must |
| FR-7 | Trike dwells on `Idle` with a straw puff; Brachio dwells on `Idle` with a leaf drift from the plum tree. Neither gets a bespoke clip this track. | must |
| FR-8 | Tapping a corner's prop calls that animal. The tap answers with the existing sparkle inside 100 ms, and the animal sets off afterwards. A per-corner cooldown stops repeated taps from thrashing the state machine. | must |
| FR-9 | An autonomous visit fires per animal on a seeded timer near 45 s, jittered so the three never march out in lockstep, and only while walking is on. All three may be out at the same time. | must |
| FR-10 | Turning Walk off ends every visit in progress: each animal returns to its ring from wherever it stands, and turning Walk on resumes ordinary wander. | must |
| FR-11 | Avoidance keeps running on visit headings — `trioAvoidanceNudges` still applies — so two animals in transit never overlap. | must |
| FR-12 | Arrival effects come from the existing `DustPool` and fire once per arrival: a mud ripple ring and splash droplets at the wallow, a straw puff at the nest, a leaf drift at the tree. Nothing emits continuously. | must |
| FR-13 | Audio reuses the existing `coo-trike`, `coo-stego`, `coo-brachio` at arrival and `tap` for the splash. Nothing plays before the first gesture, and mute silences all of it. | must |
| FR-14 | The dev harness exposes `callVisit(species)` and `getVisitState()`, the snapshot carries each animal's visit state, and the panel gets a button per corner. | must |
| FR-15 | Under reduced motion the clips still play — the animal is not decoration — while the ripple, splash and sparkle settle immediately instead of animating. | must |
| FR-16 | `&pause=1` freezes visits. The timer and the jitter draw from the seeded stream, so a seeded run reproduces its visit schedule exactly. | must |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | Offline precache stays at or under 15 MB. `Idle` adds ~2.86 MiB as measured by the previous bake, taking the build to roughly 9.6 MB; the measured figure is recorded in the evidence, not estimated. |
| NFR-2 | 60 fps on the target tablet. Draw calls stay at or under 180 and triangles at or under 80,000, read from `snapshot().drawCalls` and `.triangles` rather than computed by arithmetic. *Amended 2026-10-30 after review, F3: the first measurement of a whole frame was 169 calls and 45,782 triangles on the dev build. The earlier 150 came from the dressing group alone, never the whole frame, so it was a figure nobody had taken. 180 leaves headroom for the shadow pass without pretending the old number held.* |
| NFR-3 | No new runtime dependency and no new SFX file. `pnpm verify` stays green with no added tooling. |
| NFR-4 | Touch targets and HUD stay as they are: 72 px, icon plus English word, no new button, no reading required. The 3D corners are the affordance and the timer is the fallback. |
| NFR-5 | Determinism: seeded runs reproduce dino positions, visit states and effect positions exactly; unseeded behaviour stays identical to today. |
| NFR-6 | No flashing above 3 Hz and colour is never the only signal — the ripple, splash and puff differ in shape as well as colour. |
| NFR-7 | The Stego bake is reproducible: the checked-in script regenerates the clip, and a gate test asserts the shipped `stego.glb` carries `Waddle`, `Walk`, `Idle` and `MudRoll` with the expected duration. |
| NFR-8 | Coverage holds the 60 % new-code floor, and the new modules carry direct unit tests rather than being covered through the viewer. |

## Acceptance Criteria

| ID | Criterion | Verifies |
| --- | --- | --- |
| AC-1 | Every shipped dino GLB carries `Idle` and its walk clip; a GLB without `Idle` fails the load with a message naming the missing clip. | FR-1 |
| AC-2 | With walking stopped, every player reports `Idle` at weight 1 and `Walk` at weight 0; a mid-blend sample shows both weights summing to 1 within 1e-6. | FR-2 |
| AC-3 | A player with no visit active wanders inside the gait radius around the world origin, and a 60 s seeded run reproduces today's positions to 1e-9. | FR-3 |
| AC-4 | A visit traverses `idle → approach → arrive → dwell → return → idle` in order, and no state is skipped for any species. | FR-4 |
| AC-5 | Each species stops within its corner's arrival radius of the anchor and faces it within 0.2 rad. | FR-5 |
| AC-6 | `stego.glb` carries `MudRoll` at its measured duration; re-running the bake script produces the same clip duration and track count. | FR-6 |
| AC-7 | Trike's dwell shows a straw puff and Brachio's a leaf drift, each once per arrival, with no emitter running afterwards. | FR-7 |
| AC-8 | Tapping a corner prop produces a sparkle in the same frame, then an approach; a second tap inside the cooldown does not restart the journey. | FR-8 |
| AC-9 | With walking on and no input, each animal completes at least one visit within 90 s of a seeded run, and the three do not start in the same second. | FR-9 |
| AC-10 | Turning Walk off during an approach returns the animal to its ring, and the state machine settles at `idle` with no animal stranded outside its radius. | FR-10 |
| AC-11 | During two simultaneous approaches, the minimum separation between any pair never drops below the pair clearance. | FR-11 |
| AC-12 | The wallow's arrival fires a ripple and splash from the shared dust pool, and the pool's live count returns to zero within 2 s. | FR-12 |
| AC-13 | An arrival plays that species' coo exactly once; with mute on, no voice plays. | FR-13 |
| AC-14 | `window.__ranch.callVisit('stego')` drives a full visit, `getVisitState()` reports it, and the snapshot carries the same state. | FR-14 |
| AC-15 | Under reduced motion the clip still plays while the ripple and sparkle complete in one frame. | FR-15 |
| AC-16 | Two seeded runs at `seed=42&pause=1` produce identical visit schedules and dino positions. | FR-16 |
| AC-17 | `pnpm verify` exits 0 and the dist-clean gate passes. | all |
| AC-18 | The PR carries four 1280x800 shots — Ranch, Nest, Garden, Sky — with at least one showing an animal at its corner, each with alt text. | all |

## Edge Cases

- **A corner called while its animal is already there.** The call is absorbed: the dwell restarts or is left alone, but no new journey begins and the state machine never double-fires.
- **Two corners called at once.** Both animals go; they are independent. Avoidance keeps them apart in transit.
- **Walk turned off before the animal arrives.** The approach is abandoned from wherever it stands and the animal returns; it never finishes a journey to a corner it can no longer use.
- **Walk turned off, then a corner tapped.** The sparkle answers, but no visit starts — a tap cannot turn walking on. The animal stays home until the child uses the Walk button.
- **The sleepy overlay arrives mid-visit.** Every visit ends, everyone goes home, and the overlay's own settle path runs unchanged.
- **A corner is off-screen** (portrait, or the Sky view zoomed in). The tap cannot reach it, so the timer is the only route there. This is why FR-9 exists and why nothing gates on a tap.
- **Repeated taps on the same corner** inside the cooldown: one sparkle each, one journey total.
- **The MudRoll clip is missing from a stale GLB.** The bake gate fails; the viewer falls back to `Idle` and records a warning rather than throwing, so a stale cache cannot white-screen the game.
- **Reduced motion plus a visit.** The clip plays, the effects do not animate, and the arrival still reads through the animal's pose.
- **`&pause=1`.** Visits freeze; the timer does not advance; a seeded schedule stays byte-identical.

## Dependencies

- **Tracks:** none. Built on `main` at `c5c385c` (ranch vista merged).
- **External:** Blender 5.2.3 locally for the Stego mesh bake (Draco) - CI never needs it. The `MudRoll` clip needs no Blender at all: the bake injects clip channels into the compressed GLB's JSON chunk, and Blender's glTF round trip re-times animation onto its own frame clock, so an action authored there could never reach the shipped file. Polyfork's licence is unchanged: the `Idle` clip arrives through the existing bake of an already-licensed asset.

## Open Questions & Assumptions

- **Assumption:** the corners are close enough that a visit is a short amble rather than a trek. Measured from the ring's edge, the wallow's mud is ~0.6 m away and the nest and browse tree ~1.5 m, so an approach is one or two metres at the animal's own walk speed.
- **Assumption:** Polyfork's `Idle` reads as resting rather than as a second walk. If it does not, the fallback is to ship it anyway for Trike and Stego and leave Brachio's stand, since a wrong-looking idle is worse than none.
- **Assumption:** a 4-year-old may never discover that a corner is tappable. The autonomous timer is the safety net, and nothing in the game depends on the tap being found.
- **Question:** should the arrival coo duck the music the way voice lines already do? Default: yes, it reuses the existing voice path, so ducking comes for free.
- **Question:** should Brachio's browse get its own bespoke clip in a later track? Default: not here — one authored clip proves the pipeline, three prove nothing more.

## References

- `.conductor/evidence/ranch-vista/after5/` — the four current cameras, showing the corners in frame.
- `conductor/archive/20261030-ranch-vista/` — the staging track that placed the corners, and its recorded reasons.
- `conductor/archive/authored-dino-walk-clips/` — the bake pipeline, the `Idle` withdrawal and its measured cost.
- `src/ranch/layout.ts` — `DRESSING_CORNERS`, `WALLOW_CENTRE_METRES`, the corner anchors this track gives a use.
- `src/ranch/dino-player.ts` — `steerInsideWanderRadius()`, the world-origin ring that FR-3 parameterises.
