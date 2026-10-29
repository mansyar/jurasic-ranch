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

- `pnpm verify`: green locally AND on the CI runner (oxlint clean, oxfmt clean, tsrs exit 0, vitest 116/116 on v5.0.5 across 13 files, vite build + PWA v2.0.0 generateSW 16 entries, Node v24.16.0)
- Review: PASS, no findings (`review.md`)
- Note: this PR is the first run to exercise the new workflow on the remote runner. The first CI runs caught real drift the workflow was built to catch: oxfmt formatting (Windows oxfmt 0.75.0 and Linux oxfmt 0.75.0 disagree on one line — CI/Linux is authoritative) and vitest-5 arrow-mock constructability in `viewer.test.ts` / `dual-viewer.test.ts`. Both fixed (P2.T3/P2.T4); a temporary CI debug step that printed the Linux-expected format diff was removed before merge.
- Rebased onto `origin/main@12f8cd4` (PR #4 Stego merge) so CI validates the post-merge tree.

### Revert plan

Revert the squash-merge commit with `git revert`; CI-only change, single commit, no data impact.

### Follow-ups

None.
