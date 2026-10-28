# PR — Upgrade Dependencies (20261029-upgrade-dependencies)

## Summary
Bump all 7 outdated deps to latest stable with zero reverts:
three ^0.180.0→^0.186.1, oxlint 1.89.0→1.90.0, oxfmt 0.74.0→0.75.0,
typescript ^5.9.0→^7.0.0, @types/node ^22.0.0→^26.0.0,
vitest ^3.2.0→^5.0.0, vite-plugin-pwa ^1.0.0→^2.0.0.
Lockfile regenerated. `pnpm outdated` clean.

## Changes
- `package.json` + `pnpm-lock.yaml`: 7 version bumps (P1 low-risk, P2 majors)
- `src/viewer/viewer.test.ts`: GLTFLoader/DRACOLoader mocks
  arrow → `function` so `new` works under vitest 5 (only prod-adjacent change, test-only)
- `package.json` lint: ignore `scripts/vendor/**` (vendor warnings silenced, lint clean)
- `conductor/tech-stack.md`: Upgrade Policy + Languages/Lint/Format pins synced
  (TS 7.0.2, three 0.186.1, oxlint 1.90.0, oxfmt 0.75.0, node 26.6.5, vitest 5.0.5, PWA 2.0.0)
- Evidence: `verification/phase-{1,2,3}.md` (tsrs resolved 0.20.0-ts7.1.0-beta recorded)

## Verification
- `pnpm lint`: clean, zero warnings (vendor ignored)
- `pnpm verify`: exit 0 — format 4 files clean, tsrs --noEmit ok,
  vitest 6 files / 62 tests passed on v5.0.5,
  vite v8.3.5 build ok, PWA v2.0.0 generateSW 15 entries (3077.61 KiB)
- dist ~3.02MB < 15MB budget; no behavior change (no src prod-code edits)
- Review: PASS WITH FINDINGS (F1 stale doc refs, F2 tsrs evidence) — both resolved in R1

## Reverts
None — all 7 latest-stable majors landed (spec revert-fallback not needed).
