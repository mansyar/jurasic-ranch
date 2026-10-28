# Phase 2 Evidence — Proof and doc note

- Track: 20261029-add-ci-for-pr — Add PR CI
- Phase: 2 — Proof and doc note
- Date: 2026-10-29
- Branch: chore/20261029-add-ci-for-pr
- Base: 65a2b36cf7f0f58c2de2882d4e3ab3d97d32c7cc
- Head: 8ad6835 (+ primary follow-up, see Notes)
- Result: verified

## Summary

P2.T1 validation review completed via native read+grep: `.github/workflows/ci.yml`
(21 lines, head 8ad6835) contains all required triggers and job keys
(see Commands). The `conductor/workflow.md` CI note (2 lines) could NOT be
applied: the edit tool returned permission denied. `pnpm verify` (P2.T2) was
run exactly as written and failed with exit 1 because `node` is not on PATH
in this environment (`'node' is not recognized as an internal or external
command`), before any lint/typecheck/test/build step could execute. No code
fix was possible within Touches; no retry was attempted beyond the single
run since the failure is environmental, not code.

actionlint was not available in this environment (no network/tool install
permitted for the phase subagent), so validation used the approved fallback:
YAML parse (read) + trigger grep.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | read `.github/workflows/ci.yml` (native tool; YAML parse) | 0 | 21 lines, structure valid, matches Phase 1 content |
| static | grep triggers/keys in `.github/workflows/ci.yml` (native tool) | 0 | 10 matches: pull_request, 2x paths-ignore, push, runs-on, timeout-minutes, node-version, cache, frozen-lockfile, pnpm verify; plus 2x branches: [main] |
| verify | `pnpm verify` (subagent env) | 1 | Failed: `node` not on PATH in subagent shell; oxlint never executed |
| verify | `pnpm verify` (primary, Node v24.16.0 on PATH) | 0 | Green: oxlint clean, oxfmt 4 files clean, tsrs exit 0, vitest 62/62 on v5.0.5, vite build + PWA v2.0.0 generateSW 15 entries |

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-5 | The evidence file shows the validation output | This file; grep results above; green `pnpm verify` output (primary run) recorded | pass |
| FR-5 | Validation evidence proves the YAML is valid and the triggers resolve as specified | ci.yml lines 2–8 triggers (`pull_request`→`main`, `push`→`main`, `paths-ignore: conductor/**` on both), lines 10–21 job keys (`runs-on: ubuntu-latest`, `timeout-minutes: 15`, `node-version: 24`, `cache: pnpm`, `--frozen-lockfile`, `pnpm verify` step) | pass |

Covers FR-5, AC-5 per the phase contract. FR-1–FR-4 evidence remains in
phase-1.md; this phase adds the doc note (blocked) and full-verify run (failed-env).

## paths-ignore semantic

CI is skipped only when ALL changed files match `conductor/**`; mixed
code+docs PRs still run. Both `pull_request` and `push` stanzas carry
`paths-ignore: [conductor/**]` (ci.yml lines 5, 8).

## Intended workflow.md note (not applied — blocked)

```text
CI runs `pnpm verify` on pull requests to `main` and on pushes to `main` (see `.github/workflows/ci.yml`).
Changes touching only `conductor/**` are excluded from CI via `paths-ignore`; mixed code+docs PRs still run.
```

Target location: `conductor/workflow.md`, Workflow Config area, prose lines
after the config YAML block, before `## Development Commands`. 2 lines; no
config keys renumbered.

## Evidence paths

- `.github/workflows/ci.yml` (committed, head 8ad6835)
- `conductor/tracks/20261029-add-ci-for-pr/verification/phase-1.md`
- This report: `conductor/tracks/20261029-add-ci-for-pr/verification/phase-2.md` (uncommitted — write blocked below, primary to commit if tooling permits)

## Deviations

None. No file outside Touches was touched.

## Notes

- `pnpm/action-setup@v4` with no version arg resolves pnpm from
  `packageManager: pnpm@12.15.0` in `package.json` (verified present in Phase 1).
- P2.T1 status: resolved by primary (2-line note applied to `conductor/workflow.md`). P2.T2 status: resolved by primary (green `pnpm verify` with Node v24.16.0 on PATH).
- Primary follow-up: DONE — note applied, `pnpm verify` exit 0.
