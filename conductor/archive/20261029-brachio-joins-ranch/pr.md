# PR — 20261029-brachio-joins-ranch

- PR: https://github.com/mansyar/jurasic-ranch/pull/7
- State: open (awaiting CI + user merge confirm — never merge without confirm)
- Base: main | Head: feat/20261029-brachio-joins-ranch
- Title: feat(ranch): Brachio joins the ranch

## Summary

Third forever-baby joins the ranch: BRACHIO_GAIT (0.24 m stride, 1.0 s loop,
0.24 m/s seated shuffle) proves the generic DinoPlayer template stretches to a
long-necked body plan with zero player changes; lavender pastel baby Brachio
GLB vendored + baked (1.2 m cap, Waddle rebuilt from Trike donor, Draco);
trio triangle spawn with pairwise soft-steer avoidance, one Walk toggles all
three, shared DustPool, three species pills + status, Brachio placeholder
fallback.

## Verification

- oxlint + oxfmt --check + tsrs --noEmit: exit 0
- vitest: 20 files / 175 passed
- vite build: precache 17 entries / 3292.66 KiB (<22 MB NFR-2)
- Review Round 1: PASS WITH FINDINGS (no Critical/High); R1 re-review: F2/F3
  fixed, F1 (tablet visual) recorded as debt, no issue per user choice.
  Details in review.md.

## Visual proof

Local-only (gitignored): `.conductor/evidence/trio-ranch-proof.png` (headless
Blender CYCLES render of all three shipped GLBs at spawn triangle) via
`.conductor/evidence/render-trio-proof.py`. Tablet screenshot + fps still
require the human-only tablet-touch-play step (review F1, debt).

## Merge checklist for the user

1. CI green on the PR.
2. Confirm merge → then: archive track, product roadmap Track 3 already [x],
   record merge in metadata.
