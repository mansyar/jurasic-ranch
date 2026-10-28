# PR — Trike Waddle Walk (20261029-trike-waddle-walk)

- Base: main | Head: feat/20261029-trike-waddle-walk
- Type: feature (first playable: rigged baby Trike waddles in an offline PWA)

## Summary

Minimal offline-first PWA viewer (fixed daylight cam, 72 px Walk button,
pixel-ratio cap, IndexedDB setting, installable precache) plus the first real
skeletal animation: a vendored Polyfork Triceratops baked to a 0.8 s seamless
Waddle loop (85.8 KB Draco GLB), played through TrikePlayer with
turn-then-walk (<0.6 s 90° turns), auto-blink head-dip, pooled foot dust, and
a silent walk. Placeholder paints instantly; rigged GLB swaps in on load.

## Test report

- `pnpm verify` green: oxlint + oxfmt --check + tsrs --noEmit
  (src+tests+scripts) + vitest 55/55 (5 files) + vite build
- PWA precache 10 entries (app shell + trike.glb + 3 Draco decoder files)
- Coverage gate: 60% new-code (track is 100% new code, no legacy baseline)
- Review: PASS WITH FINDINGS, no open High/Critical (see review.md)

## Media

No automated screenshots in this environment (headless). Human follow-up:
manual tablet video (walk toggle, airplane-mode reload) to be attached by
the parent-reviewer before merge.

## Human follow-ups before merge

- Manual tablet video: 60 fps waddle, silent walk, 72 px button taps
- Airplane-mode second visit walks from precache
- Parent-voice review of status-pill wording
- Confirm F3 spec call: 1.9 m baby scale (0.3x of authored asset)
