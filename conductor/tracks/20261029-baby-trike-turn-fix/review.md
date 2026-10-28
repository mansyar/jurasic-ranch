# Review: Baby Trike Turn Fix

- **Track:** `20261029-baby-trike-turn-fix`
- **Type:** `feature`
- **Branch:** `feat/20261029-baby-trike-turn-fix`
- **Range:** `d671821..fb388fd`
- **Date:** 2026-10-29
- **Verdict:** `PASS WITH FINDINGS`

## Summary

All three phases verified with `pnpm verify` green (62/62 tests): the baked
pastel baby GLB ships, stride is retimed to the baby legs, and turns are now
slow stroller arcs with a true stop-deadband halt. The reviewer found no
Critical or High issues. One Medium (the loading placeholder is still sized
to the old ~1.9 m footprint while the baked baby is ~3.8 m, so the swap pops)
and three Low doc/tolerance nits go to a fix phase.

## Verification

| Layer | Command | Result | Evidence |
| --- | --- | --- | --- |
| test | `pnpm test` | pass (62/62, 6 files) | verification/phase-3.md + primary re-run |
| coverage | `pnpm coverage` | not run (tooling missing) | `@vitest/coverage-v8` not installed; verify chain does not include coverage; extensive unit asserts stand in |
| lint | `pnpm lint` | pass, quiet | quote fix in package.json; 0 lines output |
| format | `pnpm format --check` | pass | verify transcript |
| typecheck | `pnpm typecheck` | pass | tsrs clean |
| build | `pnpm build` | pass | vite build, PWA precache 10 entries |

## Requirements

| ID | Implemented by | Verified by | Status |
| --- | --- | --- | --- |
| FR-1 | P1.T1 | `scripts/bake-trike-variant.js` + variant asserts | covered |
| FR-2 | P1.T2 | `viewer.test.ts` + baked GLB | covered |
| FR-3 | P1.T1 | `check-trike.test.ts` bounds + Head assert | covered |
| FR-4 | P3.T1 | 180° reversal arc test | covered |
| FR-5 | P3.T2 | deadband settle test (exactly-0) | covered |
| FR-6 | P2.T1/T2 | `stride.test.ts` (sampled stride 0.29 m) | covered |
| FR-7 | P1.T2 | blush-pin asserts | covered |
| NFR-1 | all | `pnpm verify` exit 0 | covered |
| NFR-2 | P1.T1 | Draco + single-material asserts | covered |
| NFR-3 | P3.T1/T2 | source-count test (alloc-free); tablet fps is human follow-up | partial |
| NFR-4 | P1.T1 | bake-time-only module, no runtime Polyfork import | covered |
| AC-1 | P1.T3 | variant color asserts (>50 verts/hex) | covered |
| AC-2 | P1.T3 | ratio 0.55–0.65 + bounds + Head assert | covered |
| AC-3 | P1.T3 | rayed frill + cream/leaf asserts | covered |
| AC-4 | P3.T1 | reversal arc test (>1 s, in frame) | covered |
| AC-5 | P3.T2 | 2 s settle, exactly-0 variance/displacement | covered |
| AC-6 | P2.T2 | slide test, 4 feet within tolerance | covered |
| AC-7 | P1.T2 | `pastel.ts` deleted, no remap ships (`pastel.test.ts` repurposed to variant suite) | covered |

## Findings

### Critical

- none

### High

- none

### Medium

- **F1 — Placeholder still sized to the old footprint**
  - **File:** `src/viewer/main.ts:172-176` (comments `87-91`)
  - **What:** Placeholder scaled 1.3× (~1.9 m) while the baked size-0.6 GLB
    is ~3.8 m, so the placeholder→rigged swap pops ~2×.
  - **Why:** The diff doubled the shipped model size but left the
    placeholder scale/comment untouched; the swap-no-pop invariant is false.
  - **Fix:** Rescale the placeholder into the 3.3–4.2 m window; update the
    ~1.9 m comments to the measured ~3.8 m.
  - **Requirement:** none (swap quality)
  - **Test gap:** viewer test asserting placeholder bounding z-length sits in
    the shipped-GLB bounds window.

### Low

- **F2 — Stale `turnTo()` doc**
  - **File:** `src/ranch/trike-player.ts:191`
  - **What:** Doc still says "Queue a turn-in-place" after Phase 3 replaced
    turn-in-place with walk arcs.
  - **Why:** Misdescribes the FR-4 arc contract; no behavioral effect.
  - **Fix:** Reword to arc-turn wording.
  - **Requirement:** FR-4
  - **Test gap:** none

- **F3 — Stale turn-rate number in doc**
  - **File:** `src/ranch/waddle.ts:134-139`
  - **What:** Doc says full speed turns at "~1.45 rad/s"; coded values give
    min(π, 4.5 × 0.3625) ≈ 1.63 rad/s.
  - **Why:** Misdocuments the tuned arc rate; evidence matches ~1.63.
  - **Fix:** Update to ~1.63 rad/s with the derivation.
  - **Requirement:** FR-4
  - **Test gap:** none

- **F4 — Unexplained tolerance slack**
  - **File:** `tests/waddle/stride.test.ts:181-183`
  - **What:** Per-foot assert uses `STRIDE_TOLERANCE_METRES + 0.01` (= 0.03)
    while the constant advertises 0.02, with no comment.
  - **Why:** Weakens the FR-6 honesty bound silently; harmless today
    (travels match within ~0.002).
  - **Fix:** Drop the `+ 0.01`, or add a one-line justification.
  - **Requirement:** FR-6
  - **Test gap:** none

## Overrides

- none

## Plan compliance

All 3 phases have Result/Checkpoint/Evidence; all 7 tasks implemented and
verified; diff stays within the union of phase Touches except reported
deviations (check-trike bounds update, `waddle.ts` turn home, stale
gait-block wording). No task dropped. Evidence files committed.

## Out of scope

- 60 fps on the real tablet (NFR-3 device half): recorded human follow-up,
  per workflow manual exceptions (tablet-touch-play).
- 4-beat gait finding (Phase 2 notes): future-tuning follow-up, not an AC.

## Debt

- none (all findings go to the fix phase below; no leftover for issues)

## Doc sync

`pending` — CREDITS.md already updated pre-review (size-0.6 variant);
re-check after review fixes.

## History

| Round | Verdict | Critical | High | Medium | Low | Fixed |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS WITH FINDINGS | 0 | 0 | 1 | 3 | 0 |
