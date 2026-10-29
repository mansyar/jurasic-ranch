# Phase R1 Verification — Review Fixes (F2, F3)

- **Track:** 20261029-brachio-joins-ranch — Brachio Joins the Ranch
- **Phase:** R1 — Review Fixes (F2, F3)
- **Date:** 2026-10-29
- **Branch:** feat/20261029-brachio-joins-ranch
- **Base:** 2c1136e9ee161cf3f1d27c27063f838e729057c4
- **Head (code):** 6cc83a318b915d90186c53e0569f58eb3ed227b5
- **Result:** verified

## Commands

| Command | Exit | Evidence |
| --- | --- | --- |
| `pnpm verify` | 0 | lint, format check, typecheck, 175 tests / 20 files, vite build precache 17 entries / 3292.66 KiB |

## Findings

| F-id | Fix | Evidence | Status |
| --- | --- | --- | --- |
| F2 | Renamed `SHIPPED_GLB` → `DONOR_TRIKE_GLB` (declaration + usage) in `tests/waddle/brachio-stride.test.ts`, with a comment that only the Trike donor's animation tracks are extracted, not its geometry | c3dd825 `test(brachio): rename SHIPPED_GLB to DONOR_TRIKE_GLB in stride test` | fixed |
| F3 | Updated pastel test header comment "extra 0.5 post-scale" → "extra 0.27 post-scale" in `tests/waddle/brachio-pastel.test.ts`, matching `BRACHIO_EXTRA_SCALE` (0.27) in `scripts/vendor/bake-brachio-variant.js` | 6cc83a3 `test(brachio): correct post-scale value 0.5 to 0.27 in pastel header` | fixed |

## Evidence paths

- conductor/tracks/20261029-brachio-joins-ranch/verification/phase-R1.md (this file)

## Deviations

- none

## Notes

- Comment-only changes; no behavior change, no new tests needed.
- `pnpm verify` run after both edits: exit 0 (oxlint, oxfmt check, tsrs --noEmit, vitest 175/175, vite build).

## Primary verification

- Squashed c3dd825 + 6cc83a3 + 7782253 → 15f9674 (same author, conventional, non-empty — guard passes). Clean tree.
- `pnpm verify` exit 0 post-squash: 175 tests / 20 files, precache 17 entries / 3292.66 KiB.
- Diff 2c1136e..15f9674 = two test files (rename + comment) + this evidence — within R1 Touches, no behavior change.
