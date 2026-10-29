# Phase 1 Verification — Pure dev logic (options, seeded RNG, snapshot)

- Track: 20261029-dev-harness — Dev Harness for Debugging & Verification
- Phase: 1 — Pure dev logic (options, seeded RNG, snapshot)
- Date: 2026-10-29
- Branch: chore/20261029-dev-harness
- Base: e24bf8756d1e3513eaf2519ccc4ecd8f985ee6c9
- Head: ff07e6450085351844d50e86a9ba9b5a430b8755 (code head; this evidence file
  is committed on top)
- Result: verified

## Commits

- `482474ff3a26416bef80422f72aa2ff3ddc9164c` — test(dev): add failing specs
  for dev options, seeded RNG and snapshot (TDD red: 3 suites failed on missing
  modules, 234 pre-existing tests still green)
- `0e7614467c7c04b7bc75b07c15ce34fbc663e70c` — feat(dev): parse harness URL
  options and seeded RNG (`src/dev/dev-options.ts`, `src/dev/seeded-random.ts`;
  P1.T1)
- `ff07e6450085351844d50e86a9ba9b5a430b8755` — feat(dev): add snapshot builder
  with pairwise distances (`src/dev/snapshot.ts`; P1.T2)

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` (oxlint) | 0 | no warnings |
| static | `pnpm format --check` (oxfmt) | 0 | all matched files correctly formatted |
| static | `pnpm typecheck` (tsrs --noEmit) | 0 | no type errors |
| unit | `pnpm test` (vitest run) | 0 | 27 files, 257 tests passed (23 new) |
| unit (red) | `pnpm test -- tests/dev` before implementation | 1 | 3 new suites failed on missing `src/dev/*` modules; 234 existing tests passed |
| build | `pnpm build` (vite build + PWA precache) | 0 | built in 389 ms, 25 modules, precache 29 entries; chunk-size warning pre-existing (three.js bundle) |

Full gate ran as `pnpm verify` (lint + format --check + typecheck + test + build),
exit 0, no retries.

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | Loading the dev server without `?dev=1` leaves `window.__ranch` undefined and no `[data-dev-panel]` node | Parsing half only in this phase: `parseDevQuery` returns `enabled: false` for empty search, `?dev=0`, `?dev=true`, `?dev=` and seed-only `?seed=42`; asserted in `tests/dev/dev-options.test.ts` (4 tests). The viewer/DOM half (`window.__ranch`, `[data-dev-panel]`) lands in Phase 2. | partial (by design) |
| AC-8 | `snapshot()` returns all documented fields, pairwise distances match a manual `hypot` of the reported positions, `minSeparation` equals the smallest pair | `buildSnapshot` asserts every documented field is carried through, every unordered pair appears once in `dinos` order, each distance equals `Math.hypot(a.x - b.x, a.z - b.z)` (Y ignored), `minSeparation` is the smallest pair, one dino yields `pairs: []` / `minSeparation: null`, and the input is not mutated — `tests/dev/snapshot.test.ts` (6 tests). | pass (logic layer) |
| AC-9 | Two loads of `?dev=1&seed=42` report identical positions after the same number of stepped frames | Determinism half only: `seededRandom(seed)` replays an identical 25-value stream for the same seed, stays in `[0, 1)`, differs across seeds 1/2 and does not degenerate for seed 0 — `tests/dev/seeded-random.test.ts` (4 tests). Wiring the RNG into wander/dust and the stepped-frame comparison is Phase 2. | partial (by design) |

NFR-4 (pure modules under `pnpm verify`): the three new modules are DOM-free,
renderer-free (no `three` import) and fully exercised by the new tests — every
exported function and every branch (dev on/off, seed valid/empty/junk,
solo valid/unknown, overlays default/`0`, pair and single-dino cases) has at
least one assertion.

## Evidence paths

- `conductor/tracks/20261029-dev-harness/verification/phase-1.md` (this file)
- `src/dev/dev-options.ts` — `DevOptions`, `parseDevQuery`
- `src/dev/seeded-random.ts` — `seededRandom` (mulberry32)
- `src/dev/snapshot.ts` — `SpeciesId`, `SnapshotDino`, `SnapshotPair`,
  `DevSnapshot`, `buildSnapshot`
- `tests/dev/dev-options.test.ts` — 11 tests
- `tests/dev/seeded-random.test.ts` — 4 tests
- `tests/dev/snapshot.test.ts` — 8 tests

## Deviations

- None. All code and tests live inside `Touches` (`src/dev/**`, `tests/dev/**`);
  no file outside the boundary was modified.

## Notes

- TDD followed literally: the three spec files were written first, the targeted
  run failed with "Cannot find module '../../src/dev/…'" while the 234 existing
  tests stayed green, and only then were the modules added.
- `parseDevQuery` accepts both a full `location.search` (`?dev=1&seed=42`) and a
  bare query (`dev=1&seed=42`) because `URLSearchParams` handles both; asserted
  in the activation test.
- Seed parsing follows the brief exactly: `Number.parseInt(raw, 10)`, empty
  string means unseeded, and only non-finite results fall back to `null` — so
  `seed=0`, `seed=-7` and trailing junk (`seed=42abc` → 42) are accepted while
  `seed=abc` / `seed=Infinity` are `null`.
- `seededRandom` truncates and coerces non-finite seeds to `0` before `>>> 0`, so
  the stream is never NaN; seed `0` still advances the mulberry32 state.
- `buildSnapshot` copies each dino (`{ ...dino }`) and builds the pair list in
  `dinos` order, so callers cannot observe mutation of their input.
- `pnpm coverage` was not part of this phase's `Verification` command and was
  permission-denied in this sandbox; coverage is argued structurally above
  rather than reported as a number.

## Primary verification

- Squash guard: 4 commits (same author, conventional, no merge commit) squashed to `76ba7b2` via `git reset --soft` against the phase base.
- Working tree clean; `git diff --name-only e24bf87..HEAD` reported exactly 7 paths, all inside Touches (src/dev/**, 	ests/dev/**) plus this evidence file.
- `pnpm verify` re-run by the primary: exit 0 — oxlint clean, oxfmt clean, tsrs clean, vitest 27 files / 257 tests, vite build OK (precache 29 entries / 4428.17 KiB, unchanged).
- AC table reviewed line by line; AC-1 and AC-9 are partial **by design** and their viewer halves are P2.T3 scope.
