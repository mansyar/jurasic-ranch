# Upgrade Dependencies — Implementation Plan

> **Branch:** `chore/20261029-upgrade-dependencies`
> **Base:** `main` @ `784d133a2144b62a159dc908e28cff77cb52efe3`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, or `blocked`.
> Only the primary agent writes this file. Phase subagents report results and the
> primary records them.

## Phase 1: Low-risk upgrades (oxlint, oxfmt, three)

- **Goal:** Minors plus three.js landed with clean install and static checks green.
- **Depends on:** none
- **Covers:** FR-1, FR-2, AC-1, AC-3
- **Touches:** `package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm install && pnpm lint && pnpm format --check`
- **Status:** verified
- **Result:** Low-risk bumps landed (three 0.186.1, oxfmt 0.75.0, oxlint 1.90.0); pnpm install exit 0 (+395), lint exit 0 (warnings only pre-existing vendor), format check exit 0.
- **Checkpoint:** `255c882`
- **Evidence:** `conductor/tracks/20261029-upgrade-dependencies/verification/phase-1.md`

- [x] **P1.T1: Update low-risk versions in package.json** — covers: FR-1
  - [x] **P1.T1.1: Bump oxlint 1.89.0→1.90.0 and oxfmt 0.74.0→0.75.0**
  - [x] **P1.T1.2: Bump three ^0.180.0→^0.186.1, verify @types/three ^0.186.0 still satisfies**
- [x] **P1.T2: Regenerate lockfile** — covers: FR-2
  - [x] **P1.T2.1: Run pnpm install, confirm no peer/engines errors**
- [x] **P1.T3: Run static checks** — covers: AC-1
  - [x] **P1.T3.1: Run lint + format check, fix only upgrade-caused findings**

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/20261029-upgrade-dependencies/verification/phase-1.md
-->

## Phase 2: Major upgrades with config adaptation

- **Goal:** Attempt TS 7, @types/node 26, vitest 5, PWA 2.0; adapt configs or revert failures with reason.
- **Depends on:** Phase 1
- **Covers:** FR-1, FR-3, FR-5, AC-2, AC-3, AC-4
- **Touches:** `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json`, `src/**`, `tests/**`
- **Verification:** `pnpm verify`
- **Status:** verified
- **Result:** All 4 majors landed (TS 7.0.2, node types 26.6.5, vitest 5.0.5, PWA 2.0.0); pnpm install exit 0, typecheck exit 0, tests 62/62 after 1 minimal mock fix, build exit 0 with SW precache 15 entries. Zero reverts.
- **Checkpoint:** `PENDING`
- **Evidence:** `conductor/tracks/20261029-upgrade-dependencies/verification/phase-2.md`

- [x] **P2.T1: Bump majors in package.json and install** — covers: FR-1
  - [x] **P2.T1.1: Bump typescript ^5.9.0→^7.0.0, @types/node ^22.0.0→^26.0.0**
  - [x] **P2.T1.2: Bump vitest ^3.2.0→^5.0.0, vite-plugin-pwa ^1.0.0→^2.0.0**
  - [x] **P2.T1.3: Run pnpm install, record any peer/engines failures**
- [x] **P2.T2: Adapt breaking configs** — covers: FR-3
  - [x] **P2.T2.1: Fix tsconfig / type errors for TS7 + @types/node 26 (or tsgo fallback)**
  - [x] **P2.T2.2: Fix vite PWA workbox + vitest config for v2/v5 breaking changes**
- [x] **P2.T3: Revert-or-keep decision** — covers: FR-5
  - [x] **P2.T3.1: Revert any major still red after 2 retries, record reason for evidence**

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/20261029-upgrade-dependencies/verification/phase-2.md
-->

## Phase 3: Doc sync and final verification

- **Goal:** tech-stack pins synced and full verify + smoke green.
- **Depends on:** Phase 2
- **Covers:** FR-4, AC-2, AC-5, AC-6
- **Touches:** `conductor/tech-stack.md`, `package.json`
- **Verification:** `pnpm verify && pnpm build`
- **Status:** pending

- [ ] **P3.T1: Sync tech-stack.md Upgrade Policy pins to landed versions** — covers: FR-4
- [ ] **P3.T2: Final verify + smoke (build + preview boot, bundle <15MB check)** — covers: AC-2

<!--
Review fixes are appended by `conductor-review` as:

## Phase R1: Review Fixes

- **Goal:** Resolve review findings ...
- **Depends on:** Phase 3
- **Covers:** review findings
- **Touches:** ...
- **Verification:** ...
- **Status:** pending

- [ ] **R1.T1: Resolve <finding ID>** — covers: <finding ID>
-->
