# PR — 20261029-stego-generic-player

- PR: https://github.com/mansyar/jurasic-ranch/pull/4
- State: open (awaiting CI + user merge confirm — never merge without confirm)
- Base: main | Head: feat/20261029-stego-generic-player
- Title: Stego joins via generic DinoPlayer

## Summary

Second forever-baby joins the ranch: generic DinoPlayer extraction (Trike
bit-identical), pastel Stego GLB vendored + baked, dual independent wander with
soft-steer avoidance, one Walk toggles both, shared DustPool, Stego placeholder
fallback.

## Verification

- oxlint + oxfmt --check + tsrs --noEmit: exit 0
- vitest: 13 files / 116 passed
- vite build: precache 11 entries / 1842.47 KiB (<18 MB NFR-2)
- Review Round 1: PASS WITH FINDINGS (no Critical/High; details in review.md)

## Visual proof

Local-only (gitignored): `.conductor/evidence/dual-ranch-proof.png` (headless
Blender CYCLES render of both shipped GLBs at spawn) via
`.conductor/evidence/render-dual-proof.py`. Tablet screenshot + fps still
require the human-only tablet-touch-play step (review F3).

## Merge checklist for the user

1. CI green on PR #4.
2. Sign off review F2 (Stego scale 0.6 vs product 0.25–0.35x).
3. Confirm merge → then: archive track, flip product roadmap Track 2 to [x],
   record merge in metadata.
