# Add PR CI — Implementation Plan

> **Branch:** `chore/20261029-add-ci-for-pr`
> **Base:** `main` @ `90060011c85d3e27e2485afaf1928a35452fcae6`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, or `blocked`.
> Only the primary agent writes this file. Phase subagents report results and the
> primary records them.

## Phase 1: Workflow file

- **Goal:** `.github/workflows/ci.yml` committed with triggers, ignore rule, toolchain, and timeout.
- **Depends on:** none
- **Covers:** FR-1, FR-2, FR-3, FR-4, AC-1, AC-2, AC-3, AC-4
- **Touches:** `.github/workflows/ci.yml`
- **Verification:** actionlint (when available), else YAML parse + trigger grep
- **Status:** verified

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** `954e097`
**Evidence:** conductor/tracks/20261029-add-ci-for-pr/verification/phase-1.md
-->

- [x] **P1.T1: Author the workflow file** — covers: FR-1
  - [x] **P1.T1.1: Triggers `pull_request`→`main` + `push`→`main` with `paths-ignore: conductor/**`**
  - [x] **P1.T1.2: `verify` job — ubuntu-latest, Node 24, pnpm via packageManager frozen, `pnpm verify`, `timeout-minutes: 15`**
- [x] **P1.T2: Validate the YAML locally** — covers: FR-5

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/20261029-add-ci-for-pr/verification/phase-1.md
-->

## Phase 2: Proof and doc note

- **Goal:** Validation evidence recorded and `workflow.md` documents the CI behavior.
- **Depends on:** Phase 1
- **Covers:** FR-5, AC-5
- **Touches:** `conductor/workflow.md`, `conductor/tracks/20261029-add-ci-for-pr/verification/phase-2.md`
- **Verification:** `pnpm verify`
- **Status:** verified

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** `fa24093`
**Evidence:** conductor/tracks/20261029-add-ci-for-pr/verification/phase-2.md
-->

- [x] **P2.T1: Record validation evidence and note CI in workflow.md** — covers: FR-5
- [x] **P2.T2: Run full `pnpm verify` green on the branch** — covers: AC-5
- [x] **P2.T3: Fix oxfmt drift flagged by CI run 40784795415 and re-verify** — covers: AC-5
