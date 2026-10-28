# Phase 2 Verification — Major upgrades

Track: 20261029-upgrade-dependencies
Phase: 2 (typescript 7, @types/node 26, vitest 5, PWA 2.0)
Date: 2026-10-29
Branch: chore/20261029-upgrade-dependencies

## Changes
- package.json: typescript ^5.9.0→^7.0.0 (landed 7.0.2), @types/node ^22.0.0→^26.0.0 (landed 26.6.5), vitest ^3.2.0→^5.0.0 (landed 5.0.5), vite-plugin-pwa ^1.0.0→^2.0.0 (landed 2.0.0)
- pnpm-lock.yaml regenerated
- src/viewer/viewer.test.ts: GLTFLoader/DRACOLoader mocks changed from `vi.fn(() => ...)` arrow impl to `vi.fn(function ...)` so `new` construction works under vitest 5 (1 retry, minimal test-setup fix per FR-3)

## Verification command
`pnpm install` then `pnpm verify`

## Results
- pnpm install: exit 0, +17 -34, no peer/engines errors (Node v24.16.0 satisfies engines >=22.12.0, @types/node 26 types OK)
- pnpm typecheck (tsrs --noEmit): exit 0 with TS 7.0.2
- pnpm test (vitest 5.0.5): 6 files, 62/62 passed after mock fix (first run 6 failed with `... is not a constructor`, fixed in 1 retry)
- pnpm build (vite 8.3.5 + PWA 2.0.0): exit 0, built in ~1s, PWA mode generateSW, precache 15 entries (3077.61 KiB), dist/sw.js + workbox generated
- pnpm lint + format check: exit 0 (via verify chain, reached test stage clean)

## Revert decision (FR-5)
- None reverted. All 4 majors kept. Zero reverts needed.

## Conclusion
Phase 2 VERIFIED. All majors green with one minimal test-setup adaptation.
