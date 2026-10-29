# Review — Ranch Warmth UI

- Track: 20261029-ranch-warmth-ui (feature, high)
- Branch: feat/20261029-ranch-warmth-ui
- Range: 502be829090e6f7e40579d99c29462c21c6f426a..4340dbe (code: P1 4b88642..2596cda, P2 f64709f..2e5976a, P3 2338ed3..293d2ae)
- Date: 2026-10-29
- Verdict: PASS
- Reviewer: conductor-reviewer subagent (read-only) + primary validation + primary re-review of R1 delta

## Summary

All three phases deliver their spec: fixed Ranch/Nest/Garden POV with 72px touch hardening (P1), 12 CC0 Valley+Farm GLBs precached offline at ~1.1MB (P2), visual-only sleepy cues with interrupt + reduced-motion guards (P3). `pnpm verify` green (174 tests). No Critical/High findings. Two Low findings in shared `src/viewer/main.ts` wiring — both accepted for a fix phase (R1) below.

## Verification

| Layer | Command | Result | Evidence |
|---|---|---|---|
| static | `pnpm lint` / `format --check` / `typecheck` | pass | phase evidence reports + `pnpm verify` re-runs |
| unit | `pnpm test` (vitest) | 174 pass, 17 files | integrated run 2026-10-29 |
| coverage | `pnpm coverage` | NOT RUN — pre-existing missing `@vitest/coverage-v8` (not caused by this diff) | n/a; new-code testing judged behaviorally, thorough |
| build | `pnpm build` (vite PWA) | pass, precache 28 entries / 4309.50 KiB | dist output |
| phase | `pnpm verify` | exit 0 | all of the above |
| visual/smoke | tablet screenshot + preview boot | human-only exceptions per workflow | manual: `tablet-touch-play` |

## Requirements

| ID | Implementation | Verification | Status |
|---|---|---|---|
| FR-1 fixed POV buttons | P1.T1–T2 (`pov.ts`, main wiring) | tests/viewer/pov.test.ts, phase-1 evidence | covered |
| FR-2 72px touch + hardening | P1.T2–T3 | pov tests, phase-1 evidence | covered |
| FR-3 Valley+Farm dressing | P2.T1–T4 (`dressing.ts`, 12 GLBs) | dressing.test.ts (16), size table, precache greps | covered |
| FR-4 sleepy cues 90s | P3.T1–T2 (`sleepy.ts`, overlay) | sleepy.test.ts, AC-4 end-to-end | covered |
| FR-5 5s hint glow | P1 | hint tests, phase-1 evidence | covered (see F1 nit) |
| FR-6 landscape/pinch/portrait | P1 | phase-1 evidence | covered |
| FR-7 interruptible, no stuck pose | P3.T3 | twin-restore tests, AC-7 | covered |
| FR-8 reduced-motion static | P3.T3 | frozen-swell/static-overlay tests | covered |
| NFR-1 60fps, NoToneMapping, pixelRatio | untouched render path | build + manual tablet check | covered (see F2 nit) |
| NFR-2 offline PWA + size | 28-entry precache, 1.1MB dressing | manifest greps, budget test | covered |
| NFR-3 instant feedback | POV cut, tap-wake | unit tests | covered |
| NFR-4 pastel one-material, no ACES, CC0 | vendored files untouched | content greps, no new deps | covered |
| NFR-5 no fail states | silent fallbacks everywhere | fallback tests | covered |
| AC-1..AC-7 | phase evidence per AC | phase-{1,2,3}.md | covered |

## Findings

### Low

- **F1** `src/viewer/main.ts:551-556` — hint-glow interval re-adds the hint class while drowsy/sleepy; the animation loop strips it every frame (1/s class churn, possible one-frame flash). Fix: guard the interval with the sleepy state (only add when not `hintSuppressedBySleepy`). Requirement: FR-5. → Fix phase R1.
- **F2** `src/viewer/main.ts:659` (+ `:553`) — fresh `window.matchMedia` object every animation frame on the hot render path. Fix: hoist one `MediaQueryList` const, read `.matches` per frame. Requirement: NFR-1. → Fix phase R1.

## Plan compliance

- Every phase has Result/Checkpoint/Evidence; all 13 tasks `[x]` and implemented; no dropped tasks.
- Diffs per phase stay within Touches except two recorded deviations (P2: none beyond plan update; P3: `src/viewer/main.ts` wiring — smallest necessary, recorded).
- Blast radius confirmed by primary: P1 4 files, P2 3 files + 12 GLBs, P3 6 files.

## Out of scope

- Lullaby/parent-gate (deferred to Cozy Sound track, recorded in spec + product.md).
- Tablet 60fps play check + parent voice review (workflow human-only exceptions).
- `pnpm coverage` infra gap (pre-existing missing dev dep; suggest adding `@vitest/coverage-v8` in a chore track).

## Debt

- None deferred — F1/F2 go to Phase R1. Coverage-dep suggestion recorded above, not filed (below `min_severity: medium`).

## History

- Round 1: PASS WITH FINDINGS, 0 Critical / 0 High / 0 Medium / 2 Low → R1 fixed both, re-reviewed by primary (fix delta read, `pnpm verify` 175 pass), verdict PASS.

## Doc sync

- `updated` — product.md Track 7 marked done with lullaby deferral (commit 4340dbe).
