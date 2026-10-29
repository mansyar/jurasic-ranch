# Review: Brachio Joins the Ranch

- **Track:** `20261029-brachio-joins-ranch`
- **Type:** `feature`
- **Branch:** `feat/20261029-brachio-joins-ranch`
- **Range:** `502be829090e6f7e40579d99c29462c21c6f426a..f82117c`
- **Date:** `2026-10-29T06:35:00Z`
- **Verdict:** `PASS WITH FINDINGS`

## Summary

The trio track is correct and well-tested: BRACHIO_GAIT reuses the generic DinoPlayer math, the lavender bake meets the 1.2 m cap with a seamless 1.0 s Waddle, and one Walk drives all three babies with shared FX. No Critical or High findings. One Medium (tablet screenshot deferred as manual follow-up) and two Low stale-comment findings remain; the Lows go to a fix phase, the Medium to a follow-up issue.

## Verification

| Layer | Command | Result | Evidence |
| --- | --- | --- | --- |
| test | `pnpm test` | pass | 175 tests / 20 files |
| coverage | `pnpm coverage` | unavailable | `@vitest/coverage-v8` not installed — not treated as pass; adequacy assessed behaviorally |
| lint | `pnpm lint` | pass | oxlint, part of `pnpm verify` exit 0 |
| format | `pnpm format --check` | pass | oxfmt, part of `pnpm verify` exit 0 |
| typecheck | `pnpm typecheck` | pass | tsrs --noEmit, part of `pnpm verify` exit 0 |
| build | `pnpm build` | pass | vite, precache 17 entries / 3292.66 KiB |

## Requirements

| ID | Implemented by | Verified by | Status |
| --- | --- | --- | --- |
| FR-1 | P1.T1 | `tests/waddle/brachio-gait.test.ts` | covered |
| FR-2 | P1 | `tests/waddle/brachio-gait.test.ts`, full suite green | covered |
| FR-3 | P2.T1 | `scripts/check-brachio.test.ts`, `tests/waddle/brachio-pastel.test.ts` | covered |
| FR-4 | P2.T2 | `scripts/check-brachio.test.ts`, `tests/waddle/brachio-stride.test.ts` | covered |
| FR-5 | P1.T2, P3.T1 | `tests/waddle/trio-wander.test.ts` | covered |
| FR-6 | P1.T2, P3.T1 | `tests/waddle/trio-avoidance.test.ts`, `tests/waddle/trio-viewer.test.ts` | covered |
| FR-7 | P3.T2 | `tests/waddle/trio-viewer.test.ts` | covered |
| FR-8 | P3.T2 | `tests/waddle/trio-viewer.test.ts` | covered |
| FR-9 | P1.T1, P3.T1 | `tests/waddle/trio-wander.test.ts`, `tests/waddle/trio-viewer.test.ts` | covered |
| FR-10 | P1 | `tests/waddle/brachio-gait.test.ts`, `tests/waddle/trio-viewer.test.ts` | covered |
| NFR-1 | P3.T1 | renderer settings unchanged; no fps measurement | partial |
| NFR-2 | P2, P3 | `scripts/check-brachio.test.ts`, build precache 3292.66 KiB | covered |
| NFR-3 | — | `src/viewer/main.ts` NoToneMapping untouched | covered |
| NFR-4 | P3.T2 | `index.html`, `tests/waddle/trio-viewer.test.ts` | covered |
| NFR-5 | P2.T1 | `CREDITS.md` | covered |
| NFR-6 | P1, P2, P3 | `pnpm verify` exit 0; coverage tool unavailable | partial |
| AC-1 | P1 | full suite green | covered |
| AC-2 | P2 | `tests/waddle/brachio-stride.test.ts`, gait rate bound | covered |
| AC-3 | P1.T2, P3.T1 | `tests/waddle/trio-wander.test.ts` | covered |
| AC-4 | P3.T2 | `tests/waddle/trio-viewer.test.ts` | covered |
| AC-5 | P3.T2 | `tests/waddle/trio-viewer.test.ts` | covered |
| AC-6 | P1.T2, P3.T1 | `tests/waddle/trio-wander.test.ts` | covered |
| AC-7 | P1, P3 | `tests/waddle/brachio-gait.test.ts`, `tests/waddle/trio-viewer.test.ts` | covered |
| AC-8 | P3.T2 | `pnpm verify`; precache reported; screenshot deferred | partial |

## Findings

### Critical

- none

### High

- none

### Medium

- **F1 — Tablet screenshot + preview_scene link deferred**
  - **File:** `conductor/tracks/20261029-brachio-joins-ranch/verification/phase-3.md:30`
  - **What:** AC-8 visual evidence (tablet trio screenshot + Polyfork preview_scene link) recorded as manual follow-up, not attached.
  - **Why:** AC-8 explicitly requires screenshot + link; without it AC-8 is only partially evidenced. Tablet-touch-play is a workflow human-only exception, so this cannot be fixed in-phase.
  - **Fix:** Attach tablet screenshot + preview_scene link, or file a follow-up issue for the tablet visual pass.
  - **Requirement:** AC-8
  - **Test gap:** none (manual visual, not unit)

### Low

- **F2 — Misleading constant name in Brachio stride test [fixed in R1]**
  - **File:** `tests/waddle/brachio-stride.test.ts:19`
  - **What:** `SHIPPED_GLB` points at `public/models/trike.glb` (the donor), suggesting the shipped Brachio GLB is under test.
  - **Why:** Misleads future readers; only donor animation tracks are extracted.
  - **Fix:** Rename to `DONOR_TRIKE_GLB` with a comment that only donor tracks are extracted.
  - **Requirement:** none
  - **Test gap:** none
- **F3 — Stale post-scale value in pastel test header [fixed in R1]**
  - **File:** `tests/waddle/brachio-pastel.test.ts:18`
  - **What:** Header cites "extra 0.5 post-scale" but the shipped bake uses EXTRA_SCALE 0.27.
  - **Why:** Contradicts phase-2 evidence; misleads future bake tuning.
  - **Fix:** Update comment to 0.27 per `bake-brachio-variant.js` and phase-2 deviations.
  - **Requirement:** none
  - **Test gap:** none

## Overrides

- none

## Plan compliance

All three phases verified with Result/Checkpoint/Evidence; every [x] task implemented (diff matches Touches per phase); no dropped tasks; deviations recorded in phase evidence (P1 curvature 4.5, P2 EXTRA_SCALE 0.27 / PS 1.85). Scope inferred as the active `[~]` track — no separate Yes/No asked (single in-progress track, implement handoff).

## Out of scope

- none

## Debt

- F1 → follow-up issue for the tablet visual pass (to be filed after user confirmation gate).

## Doc sync

`updated` — product.md roadmap Track 3 marked joined (sort surprise deferred to feeding track); review fixes touch test comments only, no further doc change expected.

## History

| Round | Verdict | Critical | High | Medium | Low | Fixed |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS WITH FINDINGS | 0 | 0 | 1 | 2 | 0 |
| 2 | PASS WITH FINDINGS | 0 | 0 | 1 | 2 | 2 |
