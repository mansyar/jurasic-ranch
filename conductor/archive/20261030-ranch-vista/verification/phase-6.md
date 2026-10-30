# Phase 6 verification — Captures, docs and PR

- Track: `20261030-ranch-vista`
- Phase: 6 — Captures, docs and PR
- Date: 2026-10-30
- Branch: `feat/20261030-ranch-vista`
- Head: `f090cf9` (captures), PR opened at `f090cf9` + `docs(conductor): record the review round and the PR body`
- Result: **PASS**

## Tasks

| Task | State | What it produced |
| --- | --- | --- |
| P6.T1.1 Before/after for Ranch, Nest, Garden, plus Sky | done | seven shots in `.conductor/evidence/ranch-vista/` (`before/` at `aa43e2d`, `after5/` at `f090cf9`) |
| P6.T1.2 Unobstructed canvas | done | dev panel hidden and the HUD kept — the HUD is the app, the panel is not |
| P6.T2.1 `product.md` and `product-guidelines.md` | done | "4 POV buttons (Ranch / Nest / Garden / Sky)", the Sky description, the Track 9 roadmap line |
| P6.T2.2 `tech-stack.md` and `CREDITS.md` | done | the staging architecture bullet, the `vertexColors` bake rule, nineteen prop rows |
| P6.T3.1 PR body with per-camera changes and the shots attached | done | PR #15, seven attachments rewritten to hosted URLs by `gh` |
| P6.T4.1 Integrated verification | done | `verification/integrated.md` |

## Commands

| Command | Result |
| --- | --- |
| `pnpm verify` | exit 0 — 621 tests / 50 files, 82.44 % statements, audio pack 15 assets / 853,289 B, build ok, `dist clean` |
| `node .conductor/tools/capture-povs.mjs <url> <out> 9339` | exit 0 — four PNGs at 1280×800, dev panel hidden, snapshot dumped |
| `gh pr create … --attach` | PR #15 open; all seven references rewritten to `user-attachments` URLs |

## How the shots were taken

The desktop browser refuses to capture while its window is hidden and headless
Chrome's `--screenshot` returns a blank canvas for this app, so the shots come
from Chrome's own DevTools protocol: headless Chrome with
`--remote-debugging-port`, and `.conductor/tools/capture-povs.mjs` driving
`Page.navigate` → wait for `window.__ranch` → `setPov` → wait 1,200 ms →
`Page.captureScreenshot`. That keeps the capture reproducible instead of
hand-made: same seed, same viewport, same wait, four cameras in a row.

Five rounds were captured in total — `after/` (first honest look), `after2…4`
(each rework) and `after5` (post-review). The first round is what made the
rework briefs possible; the PR shows `before/` against the last.

## What changed in this phase

Nothing in `src/`. The phase's work is the captures, the doc sync and the PR
body — the code was frozen at `f090cf9` so the shots and the body describe the
same build.

## Doc sync

| File | Change |
| --- | --- |
| `conductor/product.md` | 3 POV buttons → 4, with the Sky description; roadmap Track 9 |
| `conductor/product-guidelines.md` | 4 POV buttons |
| `conductor/tech-stack.md` | `layout.ts` / `ground.ts` / `sky.ts` / `ambient.ts` responsibilities and the `vertexColors` bake rule |
| `CREDITS.md` | the nineteenth prop row; the intro says nineteen |

## Result

PASS. Every AC in the spec is traced to an implementation, a test or a
recorded limit in `verification/integrated.md`; the four cameras are shown,
before and after, in the PR.
