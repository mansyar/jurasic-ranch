# Upgrade Dependencies — Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

Bring all npm dependencies to their latest stable versions that keep `pnpm verify` green, per the monthly `pnpm update` policy in `tech-stack.md`. No product behavior changes.

## Problem / Motivation

`pnpm outdated` (2026-10-29) shows 7 packages behind: oxfmt 0.74.0→0.75.0, oxlint 1.89.0→1.90.0, three 0.180.0→0.186.1, @types/node 22.20.5→26.6.5, typescript 5.9.3→7.0.2, vite-plugin-pwa 1.3.0→2.0.0, vitest 3.2.7→5.0.5. Stale deps risk security issues, three.js drift from Polyfork authoring, and PWA/vitest major drift. If not solved, future features build on outdated APIs and security patches are missed.

## Goals & Success Metrics

- **Goal:** All deps at latest stable-if-green with no behavior change and docs synced.
- **Metric:** `pnpm outdated` shows none (except explicitly reverted with reason), `pnpm verify` exits 0, PWA boots offline with no console errors, bundle stays <15MB.

## Scope

### In Scope

- Update `package.json` versions for the 7 outdated packages (plus transitive `vite`, `howler`, `idb-keyval`, `@types/howler`, `@types/three`, `tsrs` if new stable exists).
- Regenerate `pnpm-lock.yaml` via clean `pnpm install`.
- Adapt breaking configs for majors (TS 7, vitest 5, PWA 2.0, @types/node 26) with minimal changes to `vite.config.ts`, `tsconfig.json`, test config.
- Update `conductor/tech-stack.md` Upgrade Policy pins to new versions.
- Document any reverted major with reason.

### Out of Scope

- No feature changes, no waddle/rig tuning, no asset/content changes.
- No Node.js or pnpm major migration (engines stays `>=22.12.0`, packageManager stays pnpm 12.x unless patch-only).
- No backend, hosting, or release process changes.
- No Godot/Unity, Bun, ESLint/Prettier, or tsc-classic switches.

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | `package.json` versions updated to latest stable targets attempted (oxfmt 0.75, oxlint 1.90, three 0.186.1, @types/node 26, typescript 7, vite-plugin-pwa 2.0, vitest 5) | must |
| FR-2 | `pnpm-lock.yaml` regenerated via `pnpm install` with no install errors | must |
| FR-3 | Breaking config changes for adopted majors kept minimal and confined to `vite.config.ts`, `tsconfig.json`, test setup | must |
| FR-4 | `conductor/tech-stack.md` pins updated to landed versions | must |
| FR-5 | Any failing major reverted to current pinned version with reason recorded in plan evidence | should |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | `pnpm verify` (oxlint + oxfmt check + tsrs typecheck + vitest + vite build) exits 0 |
| NFR-2 | No observable product behavior change (waddle, feed/wash/cuddle, PWA offline, audio) |
| NFR-3 | Offline bundle stays <15MB, 60fps newer tablet, pixelRatio cap 2 preserved |
| NFR-4 | Licenses stay MIT / Apache-2.0 / CC0 only |

## Acceptance Criteria

| ID | Criterion | Verifies |
| --- | --- | --- |
| AC-1 | `pnpm install` completes with no errors on Node >=22.12 | FR-2 |
| AC-2 | `pnpm verify` exits 0 on track branch | FR-1, FR-2, FR-3 |
| AC-3 | `pnpm outdated` shows none, or only packages explicitly reverted with reason | FR-1, FR-5 |
| AC-4 | `pnpm build` succeeds and `pnpm preview --host` boots with no console errors | FR-3 |
| AC-5 | `conductor/tech-stack.md` pins match landed `package.json` versions | FR-4 |
| AC-6 | Git diff limited to `package.json`, `pnpm-lock.yaml`, minimal config fixes, `conductor/tech-stack.md` + track artifacts | FR-3 |

## Edge Cases

- three 0.180→0.186 API break changes waddle rendering — revert three, keep rest, record reason.
- vite-plugin-pwa 2.0 workbox config breaks offline precache — revert to 1.x, record reason.
- vitest 5 config/coverage breaks `pnpm test` — adapt config, else revert to 3.x.
- typescript 7 stricter checks fail `tsrs --noEmit` — fix types, else revert to 5.9.
- @types/node 26 requires Node 26 runtime vs engines >=22.12 — revert to ^22 if install/typecheck fails on Node 22/24.
- `tsrs: latest` drifts (currently 0.20.0-ts7.1.0-beta) — pin landed resolved version in evidence, do not pin in package.json.
- pnpm lockfile merge conflicts on rebase — regenerate via `pnpm install`.

## Dependencies

- **Tracks:** none
- **External:** npm registry access for `pnpm install`; no services, credentials, or hardware required

## Open Questions & Assumptions

- **Assumption:** Node v24.16.0 (current) can typecheck with @types/node 26; if not, revert per FR-5.
- **Assumption:** pnpm 12.15.0 is latest stable 12.x; no packageManager bump needed unless `pnpm --version` check shows newer 12.x patch.
- **Assumption:** `tsrs latest` beta already supports TS 7; fallback to `tsgo --noEmit` per tech-stack if needed.
- **Assumption:** No tablet-touch-play or parent-voice-review required (chore, smoke + build only per user choice).

## References

- `package.json`, `pnpm-lock.yaml`, `conductor/tech-stack.md`, `conductor/workflow.md`
- `pnpm outdated` output 2026-10-29 (7 packages listed above)
