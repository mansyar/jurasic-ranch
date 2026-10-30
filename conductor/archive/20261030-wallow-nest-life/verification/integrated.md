# Integrated verification — Wallow and Nest Life

**Result:** PASS
**Branch:** `feat/20261030-wallow-nest-life`
**Final commit:** `8c3436e`

## Gate

| Check | Command | Result |
| --- | --- | --- |
| Full gate | `pnpm verify` | exit 0 |
| Tests | `pnpm test` | 758 passed, 58 files |
| Coverage | `pnpm coverage` | 84.94 % lines, 70.16 % branches |
| Build | `pnpm build` | 63 precache entries, 8,965 KiB |
| Dist clean | `scripts/check-dist-clean.mjs` | pass — no dev harness markers in `dist/` |
| Frame cost | `snapshot().drawCalls` / `.triangles` | 169 / 45,782 |

## Claim to proof

| Claim | Proof |
| --- | --- |
| A stopped dino breathes | `dino-player.ts` weights: walk drives Walk, its complement drives Idle; the mixer advances every frame |
| The ring is inert by default | 60 s trajectory recorded before the change, reproduced at 5e-10; home ring `toBe`-identical |
| Idle ships at published length | Trike 6.000 s / 72 ch, Stego 9.000 s / 48 ch, Brachio 8.000 s / 70 ch, read from the shipped GLBs |
| Stego's roll is real | 4.000 s, 16 channels, rest-to-rest, Hips drops 0.55 m, peak roll 30.4° |
| A visit runs the whole cycle | `tests/ranch/visit.test.ts`: every state reached, none skipped, durations derived from world gait |
| Nobody is stranded | Stop during a return leg hands the walk back; Stop during approach sends the animal home |
| Two animals never overlap in transit | minimum pair separation 3.5485 m against 1.2372 m clearance |
| The roll plays when the walk lets go | buffered request; started on the first frame at zero walk weight, dropped if the animal strides |
| Reduced motion settles decoration | `tests/dev/reduced-motion.test.ts`: a burst retires in one frame, clips keep playing |
| Seeded runs reproduce | `tests/dev/visit-determinism.test.ts`: identical schedules and positions across two runs |

## Offline smoke

Built, served locally, opened in airplane-mode-equivalent (no network beyond localhost):
boots from the service worker, all four cameras work, a corner tap calls its animal, the
timer sends one out unprompted, Walk off walks everyone home, mute silences the coos.

## Captures

Seven 1280×800 shots in `.conductor/evidence/wallow-nest-life/after/`: the four cameras at
rest, the Trike at its nest from the Nest lens, and two Sky shots with an animal at a corner.

## Residual limits

- The ground cameras frame spawns; a visiting animal sits at the frame edge of its own lens.
- Sub-second effects are proven by numbers, not by a picture.
- The coos were never heard by a person; the audio path is tested and the sound is the user's call.
