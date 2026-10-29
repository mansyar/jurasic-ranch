# Project Workflow — Jurasic Ranch

## Guiding Principles

1. **The plan is the source of truth.** Every phase, task, result, checkpoint, and evidence link lives in `plan.md`.
2. **The tech stack is deliberate.** A change to the stack is recorded in `tech-stack.md` before the implementation depends on it.
3. **Verification is agent-executed.** The phase subagent runs the configured checks and writes evidence. The user is not asked to manually verify routine work.
4. **Evidence over assertion.** A phase is complete only when the configured checks pass and the evidence file exists.
5. **No silent debt.** A finding is fixed, explicitly accepted with a reason, or tracked as an issue. It is never quietly ignored.
6. **Stay inside the phase contract.** `Touches` defines the expected blast radius. A required deviation is allowed, recorded, and reviewed.
7. **Non-interactive and CI-aware.** Prefer commands that terminate. Use `CI=true` for watch-mode tools where the ecosystem supports it.

## Workflow Config

```yaml
project:
  type: "pwa-game"
  languages: ["TypeScript"]
commands:
  setup: "pnpm install"
  dev: "pnpm dev --host"
  test: "pnpm test"
  coverage: "pnpm coverage"
  lint: "pnpm lint"
  format: "pnpm format --check"
  typecheck: "pnpm typecheck"
  build: "pnpm build"
  verify_phase: "pnpm verify"
coverage:
  gate: 60
  scope: "new-code"
verification:
  layers: ["static", "unit", "visual", "smoke"]
  retry: 2
  manual_exceptions: ["tablet-touch-play", "parent-voice-review"]
git:
  base_branch: "main"
  fetch: true
  commit_style: "conventional"
  task_commits: true
  phase_squash: true
review:
  strict: false
  issues:
    enabled: true
    auto_create: false
    min_severity: "medium"
    group_low: true
    labels: ["tech-debt", "conductor"]
pr:
  enabled: true
  tool: "gh"
  base: "main"
  media: "always"
  watch_ci: true
  watch_timeout_minutes: 15
  merge_method: "squash"
```

CI runs `pnpm verify` on pull requests to `main` and on pushes to `main` (see `.github/workflows/ci.yml`).
Changes touching only `conductor/**` are excluded from CI via `paths-ignore`; mixed code+docs PRs still run.

### PR Media

`media: "always"` means a track that changes what the child can see or hear
carries pictures in its PR. Binaries never enter the repo: captures stay in the
gitignored `.conductor/evidence/<track-id>/`, and `gh` uploads them at PR time.

```bash
gh pr create --base main \
  --attach '.conductor/evidence/<track-id>/pov-ranch.jpg#Ranch view: low foreground, open midground, treeline backdrop' \
  --attach '.conductor/evidence/<track-id>/pov-nest.jpg#Nest view' \
  --attach '.conductor/evidence/<track-id>/pov-garden.jpg#Garden view' \
  --attach '.conductor/evidence/<track-id>/pov-sky.jpg#Sky view: the whole paddock from above'
```

- **Requires `gh >= 2.103`.** `--attach` exists on `gh pr create` and
  `gh pr comment`; an older CLI fails with `unknown flag`. Check `gh --version`
  first, and when it is older, link the evidence path in the body instead of
  attaching.
- **Syntax is `<file>#<alt text>`**, and alt text is written for a parent
  reading on a phone, not for the diff. Without it `gh` uses the filename, which
  explains nothing.
- **Up to 50 files per command.** A file the body already references
  (`![alt](./pov-sky.jpg)` relative to `--body-file`) is rewritten to the upload
  rather than appended, so a fixed shot order belongs in the body file.
- **Later rounds go on the PR**: `gh pr comment <n> --attach '<file>#<alt text>'`
  for a re-shoot after review, not an amended body.
- **What is required**: a visible change shows before and after; a change that
  alters more than one `#pov` camera shows one shot per camera; a change with no
  visible surface (a refactor whose frame is identical) says so in the body and
  attaches nothing.
- **A partial upload does not fail the PR.** `gh` creates the PR with the files
  that succeeded and exits non-zero; re-upload the missing shot with
  `gh pr comment` rather than reopening the PR.
- **Capture recipe**: dev harness at `/?dev=1&seed=42&pause=1`, 1280x800 tablet
  landscape, JPEG.

## Development Commands

### Setup

```bash
pnpm install
```

### Daily Development

```bash
# Start the app (LAN for tablet)
pnpm dev --host

# Run tests
pnpm test

# Run coverage
pnpm coverage

# Lint
pnpm lint

# Format
pnpm format --check

# Typecheck (tsrs primary, tsgo fallback)
pnpm typecheck

# Build
pnpm build
```

### Before Committing

```bash
pnpm verify
```

`pnpm verify` = oxlint + oxfmt check + tsrs typecheck + vitest + vite build.

## Phase & Task Workflow

Implementation is executed one phase at a time by a phase subagent. The primary
agent owns `plan.md`, `metadata.json`, the registry, and review artifacts.

### Task Lifecycle

1. Read the phase contract in `plan.md`, the relevant requirements in `spec.md`,
   and the applicable style guides.
2. Work through the phase's tasks in order.
3. If the project uses test-first development, write or update the failing test
   before the implementation. If it does not, add or update tests alongside the
   behavior change.
4. Implement the smallest change that satisfies the task.
5. Run the targeted checks for the task.
6. Commit the task with a conventional commit message.
7. Report the task's status and commit SHA to the primary agent.

The subagent does **not** edit `plan.md`. The primary marks tasks complete after
it accepts the phase.

### Deviations

- If the phase goal requires a file outside `Touches`, make the smallest
  necessary change and record it in the report under `deviations`.
- If the work requires a product or design decision, stop and report `blocked`.
- Do not silently expand scope, add a dependency, or migrate unrelated code.

### Phase Completion

1. Run the phase's `Verification` command exactly as written in `plan.md`.
2. Run `verify_phase` when it is configured and different from the phase command.
3. Write the evidence file using the configured evidence path.
4. Return the structured report to the primary agent.
5. Do not merge, rebase, reset, push, open a PR, or edit Conductor state files.

## Verification Strategy

### Layers

- **Static:** oxlint, oxfmt check, tsrs typecheck, vite build
- **Unit:** counting 1-5, big/little sort, sticker unlock logic (vitest)
- **Visual:** Polyfork preview_scene screenshot + tablet screenshot for waddle/eat/blink
- **Smoke:** PWA boots offline, first paint <3s, no console errors, audio unlocks on first tap

### Commands

| Layer | Command | Required |
| --- | --- | --- |
| static | `pnpm lint` + `pnpm format --check` + `pnpm typecheck` + `pnpm build` | yes |
| unit | `pnpm test` | yes |
| visual | tablet screenshot + preview_scene link in evidence | yes for rig/anim phases |
| smoke | `pnpm preview --host` boot + offline cache check | yes |

### Services and Fixtures

- **Services:** none (fully offline, no backend)
- **Containers:** none
- **Database:** IndexedDB via idb-keyval (stickers/settings), seed empty book in tests
- **Fixtures/seed data:** `fixtures/ranch-seed.json` (3 babies, empty stickers), sample `count-3` state
- **Environment variables:** none required
- **Start/stop commands:** `pnpm dev --host` / Ctrl-C, `pnpm preview --host` for smoke

### Pass Criteria

- Every required command exits `0`.
- The coverage gate (60% new-code) is met.
- Every acceptance criterion has a test or a documented evidence artifact.
- No new Critical or High review findings remain.

### Evidence

Write a report to:

```text
conductor/tracks/<track-id>/verification/phase-<n>.md
```

Include: title; track, phase, date, branch, base and head commits; result
(`verified`, `failed`, `blocked`, or `partial`); a commands table (layer,
command, exit, summary); an acceptance-criteria table (ID, criterion, evidence,
status); evidence paths; deviations; and notes. Put binaries, screenshots, and
large reports under `.conductor/evidence/`; that directory is gitignored. The
report itself is committed with the track.

### Fallback Ladder

1. Run the full configured layer.
2. If a service is missing, start it with the documented command.
3. If it still cannot run, run the narrowest reliable subset and mark the phase
   `partial` with the reason.
4. Stop and ask the user (via the question tool) only for credentials, hardware, or an external
   approval.

### Retry Policy

- A failed check may be fixed and re-run at most **2** times.
- If it still fails, report `failed` with the command and output.
- Never mark a phase `verified` when a required check did not run.

### Human-Only Exceptions

- tablet-touch-play: dad confirms tap/drag feel on real tablet, waddle cuteness
- parent-voice-review: dad approves Kokoro warmth, no scare

## Quality Gates

Before a phase is accepted:

- [ ] Required tests pass
- [ ] Coverage gate is met for the configured scope
- [ ] Lint and format checks pass
- [ ] Typecheck passes
- [ ] Build passes
- [ ] Code follows the applicable `conductor/code_styleguides/`
- [ ] No secrets, credentials, or PII are introduced
- [ ] Public behavior is documented when it changed
- [ ] Evidence is written and linked in `plan.md`

## Commit Guidelines

### Message Format

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: new feature
- `fix`: bug fix
- `docs`: documentation only
- `style`: formatting
- `refactor`: behavior-preserving change
- `test`: tests only
- `chore`: maintenance

### Examples

```bash
git commit -m "feat(ranch): add Trike waddle walk clip"
git commit -m "fix(audio): duck music under counting voice"
git commit -m "test(counting): cover 1-5 snack counting"
```

Task-level commits are made by the phase subagent. The primary squashes them
into one phase commit on acceptance, unless a foreign commit landed in the range.
The plan update is a separate state commit.

## Definition of Done

A track is complete when:

1. Every phase is `verified` with a checkpoint and evidence.
2. The integrated verification on the track branch passes.
3. Review is `PASS`, or every finding is fixed, accepted with a reason, or
   tracked as an issue. No Critical or High finding remains unresolved without an
   explicit user override recorded in `review.md`.
4. Post-review documentation sync is complete.
5. The registry and `metadata.json` show the track as complete.
6. When a remote exists, the branch is pushed. When `pr.enabled` is true, a PR
   is open or `pr_state: "unavailable"` records that PR creation could not run;
   when the track changed anything visible or audible, the shots are attached
   per [PR Media](#pr-media).
   When `pr.enabled` is false, no PR is expected.

## Emergency Procedures

### Critical Bug in Production

1. Create a hotfix branch from the configured base.
2. Write a failing regression test.
3. Implement the minimal fix.
4. Run the full verification strategy.
5. Open a PR immediately; do not batch unrelated work.

### Data Loss

1. Stop all write operations.
2. Restore from the latest verified backup.
3. Verify data integrity.
4. Document the incident and update the recovery procedure.

### Security Breach

1. Rotate all affected secrets.
2. Review access logs.
3. Patch the vulnerability.
4. Notify affected users when required.
5. Document the incident and update the security procedure.

## Deployment

Local-only MVP — no deployment target. Tablet testing via `pnpm preview --host` LAN URL + Add-to-Homescreen. Remove this note when static hosting is added.

## Continuous Improvement

- Review this workflow after each track.
- Update commands and verification layers when the tooling changes.
- Record recurring review findings as process improvements.
- Keep the process as small as the project allows.
