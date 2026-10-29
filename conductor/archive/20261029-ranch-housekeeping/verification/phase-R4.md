# Phase R4 Verification — Merge origin/main (dev harness)

- **Track:** 20261029-ranch-housekeeping
- **Phase:** R4 — Merge origin/main (dev harness)
- **Date:** 2026-10-29
- **Branch:** `refactor/20261029-ranch-housekeeping`
- **Base:** `471b2c3` (last housekeeping commit) with `origin/main` at `4bcd0c2`
- **Head:** `7ac0967` (merge commit)
- **Result:** verified

## Why this phase exists

`gh pr merge 8 --squash` was refused with `Pull Request has merge conflicts`. `origin/main` had moved from `cb12399` to `4bcd0c2` because PR #9 (`20261029-dev-harness`) merged in the meantime. That track added `src/dev/**` (+3.5k lines), a `scripts/check-dist-clean.mjs` gate, and wired a dev harness into `src/viewer/main.ts` — the exact file this track decomposed.

The merge therefore had to prove two things at once: the harness still works, and the decomposition still holds.

## Conflicts and how they were resolved

`git merge-tree HEAD origin/main` reported three conflicted files.

| File | Conflict | Resolution |
| --- | --- | --- |
| `conductor/tracks.md` | both tracks appended a registry line at the same offset | kept both lines; the registry is an append-only ledger |
| `package.json` | `verify` differed: ours runs `pnpm coverage`, theirs runs `pnpm test && node scripts/check-dist-clean.mjs` | combined into one script: `lint && format --check && typecheck && coverage && build && check-dist-clean.mjs` |
| `src/viewer/main.ts` | theirs is the 884-line pre-split viewer with harness wiring; ours is the 171-line boot | took ours and ported the harness wiring into the modules that now own each concern |

### Where the harness wiring went

The harness needs a live handle on the viewer, so the port followed the module boundaries rather than copying the old block:

| Harness need | Now lives in | Change |
| --- | --- | --- |
| consult `?dev=1`, dynamic-import the harness, derive seeded streams | `main.ts` | the same `import.meta.env.DEV` guard, query read before the import, `streams` passed to `DustPool` and all three loaders |
| `getWalking` / `setWalking` | `hud.ts` | new `setWalking` the button click handler also uses, so a dev press takes the identical path (audio unlock, storage write, interaction reset) |
| `getPov` / `setPov` | `hud.ts` | new `pov()` getter and `setPov(id)`; the POV pills call the same setter |
| `forceSleepy` / `forceHint` / `getSleepyState` | `hud.ts` | `markInteraction(now - IDLE_AFTER_MS - 1)`, a backdated `lastInteractionMs`, and `controller.state` |
| `devFrame` pause/step hook | `loop.ts` | new `RenderDtHook` type on `LoopView`; a paused frame renders and returns before any subsystem sees `dt` |
| seeded `random`/`blinkRandom` per species | `loaders.ts` | optional parameters forwarded to `DinoPlayer` |

`loop.ts` declares its own `RenderDtHook` type instead of importing `DevFrameHook` from `src/dev/harness.ts`, so no production module names the harness path even in a type import.

## Gate damage from the merge, and the repair

The first `pnpm test` after the merge failed 5 assertions in `tests/viewer/dev-harness-gate.test.ts`. Every one of them pinned a **double-quoted** literal in source text:

```
expect(viewer).toMatch(/...\.get\("dev"\) === "1"/)
expect(harness).toMatch(/document\.createElement\("style"\)/)
expect(harness).toMatch(/export \{ parseDevQuery \} from "\.\/dev-options\.js";/)
```

The dev-harness track was written before this track locked `singleQuote: true` into `.oxfmtrc.json`, so the mandatory format pass rewrote those files to single quotes and the guards stopped matching. The guards were right to exist and wrong to be quote-sensitive: the fix widens every regex to `['"]` and re-points the one `devFrame` assertion at `loop.ts`, where the hook now lives. No assertion lost its claim.

`pnpm format` also reformatted the whole of `src/dev/**` and `tests/dev/**` to the house style; that is formatting-only churn on files this track did not otherwise touch.

## Commands

| Command | Result |
| --- | --- |
| `git merge-tree --write-tree HEAD origin/main` | 3 conflicts: `tracks.md`, `package.json`, `src/viewer/main.ts` |
| `pnpm test` (after the first resolution) | 5 failed / 306 passed in `tests/viewer/dev-harness-gate.test.ts` |
| `pnpm format` | 65 files checked, dev-harness files rewritten to single quotes |
| `pnpm typecheck` | clean |
| `pnpm test` (after the guard repair) | **32 files / 311 tests passed** in 2.66 s |
| `pnpm verify` | **exit 0** — 65 files formatted, 311 tests, coverage **76.91 % lines (1023/1330)**, build 355 ms, `dist clean: no dev harness markers in dist` |
| production boot (`vite preview`, `dist/`) | title, status pill, trio list, Walk button and POV pills render; 23 requests, **0 failures**; clicking Walk flips the pill to `🦕 Trike + 🦖 Stego + 🦴 Brachio walking` and the dinos animate |
| dev boot (`vite dev`, `?dev=1&seed=42`) | panel renders with FPS/draw calls/triangles, visibility, solo, All, Pause, Step 1/10, Blink/Dust/Sleepy/Hint, Ranch/Nest/Garden and Overlays; 31 requests, 0 failures |
| `window.__ranch` probe | `snapshot()` reports `walking`, `paused`, `pov`, `sleepy`, `fps`, per-dino `x/z/heading/walking`; `pause(true)` + `step(10)` advances the trio, `step(0)` does not, `pause(false)` resumes; `setPov('nest')` and `setWalking(true)` mirror the chrome |

## Acceptance criteria

| Criterion | Verdict | How |
| --- | --- | --- |
| FR-1 — `main.ts` stays boot and wiring | pass | 199 lines; the harness block is the only addition and it is the dev gate |
| FR-2 — behaviour unchanged | pass | production bundle renders and walks exactly as before; no `?dev=1` means `devFrame` is null and `dt` is bit-identical to `rawDt` |
| NFR-2 — no visual change | pass | the harness panel only exists behind the dev flag; `dist` has no panel markers |
| NFR-1 — no new runtime dependency | pass | the harness is a dynamic import erased from production builds |

## Notes

- `dist/` after the merge: precache **30 entries (3,426.56 KiB)**, `index-B2WvJYSo.js` 662.89 kB. The harness adds nothing to the bundle — `check-dist-clean.mjs` confirms it.
- Coverage fell from 77.47 % to **76.91 %** because `src/dev/harness.ts` (DOM glue, ~650 lines) joins the measured set while only its pure helpers are tested. The floor is 60 %, so the gate still passes.
- `THREE.Clock` still warns as deprecated in the dev console. Pre-existing, unchanged, still debt.
- The merge is a merge commit on the branch, not a rebase: the pre-merge history is preserved so the PR diff stays reviewable, and the PR itself is squash-merged.
