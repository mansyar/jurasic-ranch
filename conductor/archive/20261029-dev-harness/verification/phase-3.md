# Phase 3 Evidence: Production isolation guard

- **Track:** `20261029-dev-harness`
- **Phase:** 3 — Production isolation guard and docs
- **Date:** 2026-10-29
- **Branch:** `chore/20261029-dev-harness`
- **Base:** `9e194c8`
- **Head:** `ea565e6` (evidence commit follows)
- **Result:** blocked — code and verification complete, the `conductor/tech-stack.md`
  note could not be written (edit permission denied; see Deviations / Blockers)

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| unit (red) | `pnpm test tests/scripts/check-dist-clean.test.ts` | 1 | Before the module existed: `Cannot find module '../../scripts/check-dist-clean.mjs'` — the committed test was failing first |
| unit (targeted) | `pnpm test tests/scripts/check-dist-clean.test.ts` | 0 | 9 passed: marker detection across `.js`/`.css`/`.html`/`.webmanifest`/`sw.js`, clean tree returns `[]`, missing dir asks for `pnpm build`, CLI exit codes |
| static | `pnpm lint` | 0 | oxlint clean |
| static | `pnpm typecheck` | 0 | tsrs clean; the `.d.mts` declaration resolves the `.mjs` import |
| static | `pnpm build` | 0 | Vite 8 build, 29-entry precache (4428.51 KiB) unchanged |
| static (guard) | `pnpm build && node scripts/check-dist-clean.mjs` (inside `pnpm verify`) | 0 | `dist clean: no dev harness markers in dist` |
| full | `pnpm verify` | 0 | lint + format + typecheck + 290 tests (31 files) + build + dist guard |

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-10 | After `pnpm build`, searching `dist/` for harness markers finds nothing, and the script exits non-zero when a marker is planted | `pnpm verify` printed `dist clean: no dev harness markers in dist`. `tests/scripts/check-dist-clean.test.ts` plants `__ranch` in a temp `assets/index-abc123.js` and asserts the CLI spawned via `process.execPath` exits `1` naming file and marker; a clean temp tree exits `0`; a missing `dist` exits `1` with the `pnpm build` hint | pass |

## Requirement notes

- **FR-9:** `scripts/check-dist-clean.mjs` scans `dist/` for `__ranch`,
  `data-dev-panel`, `installDevHarness` and `parseDevQuery`, and is appended to the
  `verify` chain after `pnpm build`.
- **NFR-3 (offline / no extra traffic):** the guard proves the harness module,
  its URL parser and `window.__ranch` are absent from the built assets, so the
  production precache cannot serve or fetch harness code.
- **AC-11 (existing tests stay green):** 290 tests in 31 files pass, including
  all pre-existing suites; the precache stays at 29 entries / 4428.51 KiB.

## Evidence paths

- `scripts/check-dist-clean.mjs` — guard module and CLI entry
- `scripts/check-dist-clean.d.mts` — type declaration for the `.mjs` import
- `tests/scripts/check-dist-clean.test.ts` — fixtures and CLI exit-code proofs
- `package.json` — `verify` ends with `node scripts/check-dist-clean.mjs`
- `dist/` output of the verifying build (gitignored, reproduced by `pnpm build`)

## Deviations

- `scripts/check-dist-clean.d.mts` (new file, outside the listed Touches): the
  test imports the `.mjs` module, and `tsrs --noEmit` (strict, `allowJs` off)
  needs a sibling declaration. This mirrors the existing
  `scripts/bake-trike-variant.d.ts` + `.js` pattern.
- `conductor/tech-stack.md` note (in Touches, required by P3.T1.3 / P3.T2.1) was
  **not** written: the `edit` tool returned `Permission denied` for that path.
  No workaround was attempted per the phase rules; the primary must apply the
  note (text proposal below) or grant the permission.

### Proposed tech-stack note (for the primary)

Under `## Local Dev Env`, after the existing bullets:

> - Dev harness (2026-10-29): `pnpm dev --host` then open `/?dev=1` — `?dev=1` is
>   the only way to load it, and it is dev-only behind `import.meta.env.DEV`, so
>   the production bundle never carries it. Add `&seed=<integer>` for
>   deterministic wander jitter and dust. `window.__ranch` exposes `snapshot()`
>   (walking, paused, POV, sleepy stage, fps, per-dino visibility/position/heading,
>   pairwise distances, `minSeparation`) plus visibility, solo, walk, pause, step,
>   POV and forced-state controls. `pnpm verify` runs
>   `scripts/check-dist-clean.mjs` after `vite build` and fails if `__ranch`,
>   `data-dev-panel`, `installDevHarness` or `parseDevQuery` reach `dist/`.

## Notes

- TDD order kept: failing test committed first (`8d46834`), then the guard
  (`078abe9`), then the `verify` wiring (`ea565e6`).
- Direct `node`/`pnpm exec node` invocations are not permitted in this session, so
  the planted-marker non-zero exit is proven by the CLI tests that spawn
  `process.execPath` against temp fixtures, and the clean-dist exit is proven by
  the `pnpm verify` tail.
- No new dependencies, no network, no `src/**`, `index.html` or `vite.config.ts`
  changes.

## Primary verification

- Squash guard: 4 subagent commits (same author, conventional, no merge) plus the primary's `tech-stack.md` note squashed to `b8737ed`.
- `git diff --name-only 9e194c8..HEAD` reported exactly the 6 expected paths — no product source touched, `index.html`/`src/**`/`vite.config.ts` untouched.
- `pnpm verify` re-run by the primary: exit 0 — 31 files / 290 tests, precache unchanged at 29 entries / 4428.51 KiB, and the guard printed `dist clean: no dev harness markers in dist` from inside the chain.
- **Independent failure proof** (the check must be able to fail): appended `window.__ranch=1;` to a built asset and ran `node scripts/check-dist-clean.mjs` → exit `1` with `dev harness leaked into dist (1 marker(s)): assets/draco_decoder-*.js: __ranch`. Rebuilt and re-ran → exit `0`. The guard is not vacuous.
- Deviation accepted: `scripts/check-dist-clean.d.mts` added because strict `tsrs` needs a declaration for the `.mjs` import in the test; it mirrors the existing `scripts/bake-trike-variant.d.ts` pattern.
- AC-10 passes on live evidence; AC-11 (precache and pre-existing suites unchanged) passes — 290 tests green with the 7 harness suites added and no precache growth beyond the earlier +0.34 KiB.
