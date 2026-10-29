# Add PR CI — Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

Add a GitHub Actions workflow that runs the project's full `pnpm verify` on
every pull request to `main` (and on pushes to `main`), so regressions are
caught before merge. Runs are skipped when a change touches only `conductor/`
docs, keeping docs-only tracks fast and noise-free.

## Problem / Motivation

Today PRs merge with no automated checks: `conductor/workflow.md` already sets
`pr.watch_ci: true` with a 15-minute watch timeout, but `.github/workflows/`
does not exist, so the watch has nothing to observe. Regressions can only be
caught by a locally-run `pnpm verify`, which is easy to forget.

## Goals & Success Metrics

- **Goal:** Every code PR gets an automated green/red `pnpm verify` signal.
- **Metric:** Workflow file committed and YAML-valid; evidence proves the
  trigger/ignore rules; a conductor-only change produces no CI run.

## Scope

### In Scope

- `.github/workflows/ci.yml`: `pull_request` (to `main`) + `push` (to `main`)
  triggers, `paths-ignore: conductor/**`, one `verify` job running
  `pnpm verify` on `ubuntu-latest` with Node 24, pnpm from `packageManager`
  (`--frozen-lockfile`), `timeout-minutes: 15`.
- Validation evidence (actionlint when available, else YAML parse + trigger
  review).
- One-line CI note in `conductor/workflow.md`.

### Out of Scope

- Branch protection / required-check repo settings (manual, owner-only).
- Changes to `pnpm verify` itself, product code, or engines/tech-stack pins.
- Deployment, releases, build matrices, or cache tuning beyond setup defaults.

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | On PR opened/synchronized to `main` and on push to `main`, CI runs the full `pnpm verify` | must |
| FR-2 | Changes touching only `conductor/**` do not trigger CI | must |
| FR-3 | The job uses Node major 24 and pnpm resolved from `packageManager` with a frozen lockfile | must |
| FR-4 | The job times out after 15 minutes | must |
| FR-5 | Validation evidence proves the YAML is valid and the triggers resolve as specified | should |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | No secrets required; install comes from the public registry only |
| NFR-2 | No product behavior change; the code diff is limited to `.github/` plus a `conductor/workflow.md` note |
| NFR-3 | CI completes inside the timeout on a clean tree (`pnpm verify` takes ~1–2 min locally) |

## Acceptance Criteria

| ID | Criterion | Verifies |
| --- | --- | --- |
| AC-1 | The workflow defines `pull_request`→`main` and `push`→`main` triggers and a step running `pnpm verify` | FR-1 |
| AC-2 | `paths-ignore: conductor/**` is present; evidence records that mixed code+docs PRs still trigger | FR-2 |
| AC-3 | The job pins `node-version: 24`, sets up pnpm honoring `packageManager`, and installs with `--frozen-lockfile` | FR-3 |
| AC-4 | The job sets `timeout-minutes: 15` | FR-4 |
| AC-5 | The evidence file shows the validation output | FR-5 |

## Edge Cases

- Mixed PR (code + conductor docs) still runs CI — `paths-ignore` skips only
  when *all* changed files match.
- Fork PRs are safe — the workflow uses no secrets.
- Toolchain drift is absorbed — major pins (Node 24, pnpm 12 via
  `packageManager`) float over patch releases.
- If no network/actionlint is available at implementation time, validation falls
  back to a local YAML parse plus trigger review, recorded in evidence.

## Dependencies

- **Tracks:** none
- **External:** GitHub Actions runners (assumed available); none else

## Open Questions & Assumptions

- **Assumption:** Branch protection stays a manual owner step; CI only reports status.
- **Assumption:** `pnpm/action-setup` reads `packageManager: pnpm 12.15.0`, so no version arg is needed.
- **Assumption:** Validation uses actionlint when installable, else a YAML parse plus trigger review.

## References

- `conductor/workflow.md` (Workflow Config: `verify_phase`, `pr.watch_ci`, `pr.watch_timeout_minutes: 15`)
- `conductor/tech-stack.md` (Node 22.12+, pnpm 12.15.0)
