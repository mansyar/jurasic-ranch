# PR — 20261029-add-ci-for-pr (Add PR CI)

- Track: 20261029-add-ci-for-pr — Add PR CI (`chore`, medium)
- Branch: chore/20261029-add-ci-for-pr → `main`
- Merge method: squash
- Review verdict: PASS (round 1, 0 findings)

## Body

### Summary

Adds a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs the
full `pnpm verify` on pull requests to `main` and on pushes to `main`.
Changes touching only `conductor/**` are excluded from CI via
`paths-ignore`; mixed code+docs PRs still run. Documents the behavior with a
2-line note in `conductor/workflow.md`.

### Requirements

- FR-1: `pull_request`→`main` + `push`→`main` triggers with a `pnpm verify` step
- FR-2: `paths-ignore: conductor/**` on both stanzas
- FR-3: Node 24, pnpm via `packageManager`, `--frozen-lockfile`
- FR-4: `timeout-minutes: 15`
- FR-5: validation evidence in `verification/phase-1.md` + `phase-2.md`

### Verification

- `pnpm verify`: green (oxlint clean, oxfmt 4 files clean, tsrs exit 0, vitest 62/62 on v5.0.5, vite build + PWA v2.0.0 generateSW 15 entries, Node v24.16.0)
- Review: PASS, no findings (`review.md`)
- Note: this PR is the first run to exercise the new workflow on the remote runner.

### Revert plan

Revert the squash-merge commit with `git revert`; CI-only change, single commit, no data impact.

### Follow-ups

None.
