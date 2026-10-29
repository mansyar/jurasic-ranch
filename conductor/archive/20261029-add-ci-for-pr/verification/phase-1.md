# Phase 1 Evidence — Workflow file

- Track: 20261029-add-ci-for-pr — Add PR CI
- Phase: 1 — Workflow file
- Date: 2026-10-29
- Branch: chore/20261029-add-ci-for-pr
- Base: d50404b5e9ef75291a4c5b7bd98d32bd354fd44e
- Head: 8ad6835
- Result: verified

## Summary

Authored `.github/workflows/ci.yml` exactly per the phase brief (P1.T1.1,
P1.T1.2) and validated it locally via file read plus trigger/key grep
(P1.T2). Content matches the authoritative YAML in the brief byte-for-byte
(21 lines). Committed as `8ad6835`.

actionlint was not available in this environment (no network/tool install
permitted for the phase subagent), so validation used the approved
fallback: YAML parse (read) + trigger grep.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | read `.github/workflows/ci.yml` (native tool; YAML parse) | 0 | 21 lines, structure valid, matches authoritative content |
| static | grep triggers/keys in `.github/workflows/ci.yml` (native tool) | 0 | 9 matches: pull_request, push, 2x paths-ignore, ubuntu-latest, timeout-minutes, node-version, frozen-lockfile, pnpm verify |
| git | `git add .github/workflows/ci.yml` | 0 | staged |
| git | `git commit -m "ci(workflow): add PR verify workflow with conductor ignore"` | 0 | committed as 8ad6835 |

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | Workflow defines `pull_request`→`main` and `push`→`main` triggers and a step running `pnpm verify` | ci.yml lines 3–8 (triggers), line 21 (`pnpm verify`); grep 9 matches | pass |
| AC-2 | `paths-ignore: conductor/**` present; mixed code+docs PRs still trigger | ci.yml lines 5, 8; GitHub `paths-ignore` semantics skip only when all files match | pass |
| AC-3 | Job pins `node-version: 24`, sets up pnpm honoring `packageManager`, installs with `--frozen-lockfile` | ci.yml lines 15–20; `package.json` has `packageManager: pnpm@12.15.0`, unversioned `pnpm/action-setup@v4` reads it | pass |
| AC-4 | Job sets `timeout-minutes: 15` | ci.yml line 12 | pass |

Covers FR-1, FR-2, FR-3, FR-4 per the phase contract (FR-5/AC-5 belong to Phase 2).

## Evidence paths

- `.github/workflows/ci.yml` (committed, head 8ad6835)
- This report: `conductor/tracks/20261029-add-ci-for-pr/verification/phase-1.md`

## Deviations

None. Only `.github/workflows/ci.yml` (in Touches) was created; no file
outside Touches was touched except this evidence file.

## Notes

- `pnpm/action-setup@v4` with no version arg resolves pnpm from
  `packageManager: pnpm 12.15.0` in `package.json` (verified present).
- `pnpm verify` = lint + format check + typecheck + test + build (per
  `package.json` script).
- Full `pnpm verify` run and `workflow.md` doc note are Phase 2 scope.
