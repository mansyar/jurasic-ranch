# Wallow and Nest Life

- **Track ID:** `20261030-wallow-nest-life`
- **Type:** feature
- **Priority:** medium
- **Status:** new
- **Branch:** `feat/20261030-wallow-nest-life`
- **Base:** `main` @ `c5c385c`

## Documents

- [Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Metadata](./metadata.json)

## Summary

The trio can go somewhere on purpose. Each animal owns a corner of the paddock and
can walk out to it: Stego rolls in the mud with a bespoke authored clip, Trike
settles into the hay nest, Brachio browses under the plum tree. A tap on a corner
calls its animal; a slow seeded timer sends it out on its own. Every species also
ships Polyfork's authored `Idle`, so a stopped dinosaur breathes instead of
holding a frozen stride.

## Phases

| # | Phase | Covers | Status |
| --- | --- | --- | --- |
| 1 | Idle ships and the player blends | FR-1, FR-2, NFR-1 | pending |
| 2 | The ring becomes a place | FR-3 | pending |
| 3 | Stego's mud roll | FR-6, NFR-7 | pending |
| 4 | The visit | FR-4, FR-5, FR-9, FR-11 | pending |
| 5 | Call and payoff | FR-7, FR-8, FR-10, FR-12, FR-13 | pending |
| 6 | Harness, motion, docs and PR | FR-14 to FR-16, NFR-5, NFR-6 | pending |

## Verification

Evidence lives in [`./verification/`](./verification/) as each phase completes.
The integrated gate is `pnpm verify`; captures go under
`.conductor/evidence/wallow-nest-life/`.
