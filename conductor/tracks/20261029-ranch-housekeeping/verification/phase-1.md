# Phase 1 — Retire the completed migration shim

- **Track:** `20261029-ranch-housekeeping` — Ranch Housekeeping
- **Phase:** 1 — Retire the completed migration shim
- **Date:** 2026-10-29
- **Branch:** `refactor/20261029-ranch-housekeeping`
- **Base commit:** `f8dc1cdf9a7bf1f6ce0642ac9f492c1f8480d500`
- **Head commit:** `c823d4b` (code commit; this evidence file is committed on top)
- **Result:** verified — P1.T1 and P1.T2 both complete. The subagent was denied
  `edit` on `conductor/tech-stack.md`; the primary applied P1.T2.1 and re-verified.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| unit (baseline, before change) | `pnpm test` | 0 | 24 files, **234** tests passed |
| unit (after change) | `pnpm test` | 0 | 23 files, **232** tests passed — exactly the two deleted `it` blocks |
| static + unit + build | `pnpm verify` | 0 | oxlint clean; oxfmt "All matched files use the correct format." (4 files); `tsrs --noEmit` clean; vitest 232/232; `vite build` 25 modules, precache 29 entries / 4428.17 KiB |
| git index | `git ls-files src/ranch/trike-player.ts tests/waddle/trike-player.test.ts` | 0 | no output — neither file is tracked |

`pnpm verify` is the phase `Verification` command from the brief, run exactly as
written (`pnpm test` then `pnpm verify`).

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-3 (clause 1) | `git ls-files` shows no `src/ranch/trike-player.ts` | `git ls-files src/ranch/trike-player.ts tests/waddle/trike-player.test.ts` → empty, exit 0 | pass |
| AC-3 (clause 2) | no test imports `trike-player.js` | grep for `trike-player` over `src/`, `tests/`, `scripts/`: the single hit outside `conductor/archive/**` is the negative guard `expect(viewer).not.toMatch(/trike-player\.js/)` at `tests/waddle/dino-player.test.ts:487`; `scripts/` has no hit at all | pass |
| AC-3 (clause 3) | `pnpm test` is green | 232/232 across 23 files, exit 0 | pass |
| FR-3 | any assertion unique to the deleted test is ported to `tests/waddle/dino-player.test.ts` | no port required — see "Coverage check" below | pass |

### Coverage check (P1.T1.1)

The deleted suite had two `it` blocks. Both behaviours were already asserted
against `DinoPlayer` in `tests/waddle/dino-player.test.ts`, so **no assertions
were ported and the test count drops by exactly 2 (234 → 232)**.

1. **"is a DinoPlayer that defaults to the Trike gait"** — the contract part
   (`instanceof DinoPlayer`, `clipDurationSeconds ≈ 0.8`) is covered by
   `dino-player.test.ts:184` ("loops the 0.8 s Waddle clip and starts stopped")
   and `:93` ("defaults to the Trike gait when none is given"). The *motion*
   part is the move-and-measure assertion the brief warned about, and it already
   exists at `dino-player.test.ts:116-151` ("honours a custom stride: double
   stride covers double distance per loop"): it settles the 0.2 s blend ramp,
   measures one full 0.8 s loop of a `DinoPlayer` built with `TRIKE_GAIT`, and
   asserts `trikeStride` ≈ `WADDLE_STRIDE_METRES` at 6 decimals — the same
   measurement with the same tolerance as the deleted shim test.
2. **"re-exports the Trike wander radius from the gait config"** — the value
   assertions are covered: `dino-player.test.ts:83` asserts
   `TRIKE_GAIT.wanderRadiusMetres` ≈ 0.8, `tests/waddle/brachio-gait.test.ts:172`
   asserts `=== 0.8`, and the behavioural wander-radius case exists at
   `dino-player.test.ts:153`. The only thing unique to the deleted test was that
   the *shim module re-exported* that constant; with the module gone the export
   has no referent, so porting it would assert a symbol that no longer exists.

`WADDLE_STRIDE_METRES` and `PLACEHOLDER_BODY_HEX` were left untouched
(out of scope).

### Grep audit (P1.T1.3)

`trike-player` (literal, whole repo): one live hit —
`tests/waddle/dino-player.test.ts:487`, the guard assertion. The remaining hits
are historical records under `conductor/archive/**` and this track's own
`spec.md` / `plan.md`, none of which is code.

`TrikePlayer` (whole repo): no code hit refers to the deleted class. The
surviving matches are

- `tests/waddle/dino-player.test.ts:480,487-490` — the guard suite (expected);
- `tests/waddle/brachio-gait.test.ts:185` and `tests/waddle/trio-viewer.test.ts:341`
  — pre-existing negative guards (`not.toMatch(/class TrikePlayer/)`) that read
  `src/ranch/dino-player.ts` and `src/viewer/main.ts` respectively, not the
  deleted file;
- `loadTrikePlayer` call sites in `src/viewer/main.ts`, `src/viewer/viewer.test.ts`,
  `tests/waddle/dual-viewer.test.ts` and `tests/waddle/trio-viewer.test.ts` —
  the Trike *loader* keeps its species name (as `dino-player.test.ts:483`
  documents); it constructs `DinoPlayer`, not a species class.

## Evidence paths

- Phase report: `conductor/tracks/20261029-ranch-housekeeping/verification/phase-1.md`
- Commit: `c823d4b` — `refactor(ranch): delete the completed TrikePlayer migration shim`
  (2 files changed, 83 deletions)
- Deleted: `src/ranch/trike-player.ts` (31 lines),
  `tests/waddle/trike-player.test.ts` (52 lines)

## Deviations

- None. Both deleted files and `pnpm test` / `pnpm verify` were inside the phase
  contract.

## Primary verification

The primary re-ran every acceptance check independently rather than accepting the
report.

| Check | Command | Result |
| --- | --- | --- |
| AC-3 clause 1 | `git ls-files` filtered for `trike-player` | PASS — nothing tracked |
| AC-3 clause 2 | grep `from .*trike-player\.js` over `src/`, `tests/`, `scripts/` | PASS — no importing module |
| guard intact | grep `trike-player` in `tests/waddle/dino-player.test.ts` | PASS — line 487 `expect(viewer).not.toMatch(/trike-player\.js/)` |
| AC-3 clause 3 | `pnpm test` | PASS — 23 files, 232 tests |
| full gate | `pnpm verify` | PASS — exit 0 |

**Files changed vs phase base:** `src/ranch/trike-player.ts`,
`tests/waddle/trike-player.test.ts`, `verification/phase-1.md`,
`conductor/tech-stack.md`. All within `Touches`.

**P1.T2.1 applied by the primary** after the subagent reported a permission
denial on `conductor/tech-stack.md`. The note was added under a new
`## Architecture Notes` section rather than appended to `## Frameworks &
Libraries`, so it does not imply a library dependency.

## Notes

- **Test-count arithmetic differs from the plan's assumption.** The brief and
  the spec quote "175 passing tests"; the measured baseline on `f8dc1cd` is
  **234** tests in 24 files. The drop is still exactly the two deleted `it`
  blocks (234 → 232, 24 → 23 files), so the acceptable outcome holds. The
  "175" figure in the spec's Goals and AC-2 is stale relative to the tree and is
  worth correcting before Phase 2 relies on it.
- `conductor/tech-stack.md` (P1.T2.1) is the one unfinished item. The intended
  one-line addition is under `## Frameworks & Libraries`, immediately after the
  three.js bullet:

  ```markdown
  - Ranch players: `DinoPlayer` is the single player class — species behaviour is a gait config (`TRIKE_GAIT`, `STEGO_GAIT`, `BRACHIO_GAIT`), never a species subclass or shim
  ```

- `pnpm verify` still prints `No config found, using defaults.` and checks only
  4 files — the Phase 3 defects the spec describes. Both are pre-existing at the
  phase base and untouched here.
