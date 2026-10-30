# Review — Wallow and Nest Life

**Verdict:** PASS WITH FINDINGS (first pass BLOCK)
**Reviewed at:** `b5f58bd`
**Rounds:** 1
**Final commit:** `8c3436e`

## First pass

The reviewer read the full diff from the base commit, checked every requirement against
file and line, and returned BLOCK on two majors: the mud roll never actually played, and
Stop during a return leg stranded the animal. Both were real, and no test caught either.

## Findings

| ID | Severity | Finding | Outcome |
| --- | --- | --- | --- |
| F1 | major | Stego's roll was requested on the frame the walk stopped, while the walk weight was still falling, so the stop-on-walk guard killed it before the mixer ran. The roll was dead code. | Fixed in `8c3436e`; buffered and started when the walk lets go |
| F2 | major | Stop during the return leg left the animal frozen outside its ring, because the HUD cleared every player's walking flag in one call and nothing gave it back. | Fixed in `8c3436e` |
| F3 | medium | The draw-call and triangle ceilings were never measured. | Measured (169 calls, 45,782 triangles) and NFR-2 amended |
| F4 | medium | Dwell lengths are typed, not derived, against the stack note. | Accepted: a felt length, recorded as typed |
| F5 | medium | A second arrival inside the dust lifetime loses its burst shape, keeping its coo. | Accepted: the pool is sized for one arrival; follow-up |
| F6 | medium | The determinism test uses stand-in players, not the shipped loop. | Accepted: it proves the director, which is its claim |
| F7 | low | A comment overstated how much of the trajectory is pinned. | Accepted, corrected in the record |
| F8 | low | Disjoint timer slots mean jitter cannot reorder the trio. | Accepted: that is the point |
| F9 | low | `secondsUntilVisit` read negative through a visit. | Fixed: clamped at zero |
| F10 | low | AC-8's "same frame" is a wiring assertion. | Accepted: the behavioural proof is the tap test |
| F11 | nit | The harness visit button discards the refusal boolean. | Accepted: dev panel only |

## What the review confirmed as sound

- The wander ring is genuinely inert at its default: a 60 s trajectory recorded before the
  change is reproduced to 5e-10, and setting the home ring explicitly is `toBe`-identical to
  never setting it.
- The Trike's Hips-mean gate genuinely discriminates: 1.4955 is the shipped footfall and a
  re-scaled waddle would read 0.897, so the stale root-scale guard cannot come back quietly.
- The clip set is honest: Idle and Walk ship at their published lengths, Run stays absent,
  and MudRoll is rest-to-rest with a 0.55 m root drop.

## Residual limits

- The wallow, the nest and the browse tree sit 5–6 m outside every walk ring, so the three
  ground cameras — aimed at the spawns — catch a visiting animal at the frame edge. Only the
  Nest lens happens to frame its own corner. Recorded as the first follow-up; no camera or
  test was changed to hide it.
- Sub-second effects (ripple, straw, leaf, the first splash) are proven by tests and numbers,
  not by a picture.
- The coos were not heard by anyone: the audio path is tested, the sound is the user's to judge.
