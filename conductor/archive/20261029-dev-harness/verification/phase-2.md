# Phase 2 Verification — Harness module and viewer wiring

- Track: 20261029-dev-harness — Dev Harness for Debugging & Verification
- Phase: 2 — Harness module and viewer wiring
- Date: 2026-10-29
- Branch: chore/20261029-dev-harness
- Base: bf178fa5a75eb6bd273e21a496c0f59c2b9784ff
- Head: aba10093b40629c6337963c2a8bbfd081d482309 (code head; this evidence file
  is committed on top)
- Result: verified (browser-level confirmation deferred to the primary agent,
  see Notes)

## Commits

- `608fc9420eccfaea7c854d64a0f4519997a3b149` — feat(ranch): add forceable
  blink for the dev harness (`src/ranch/dino-player.ts`, P2.T1)
- `d64e41e92bf246135591ef5cc6ca4dbbbc6193ec` — feat(dev): add the runtime dev
  harness panel and `window.__ranch` (`src/dev/harness-state.ts`,
  `src/dev/harness.ts`, P2.T2)
- `aba10093b40629c6337963c2a8bbfd081d482309` — feat(viewer): wire the DEV-gated
  harness into the ranch boot loop (`src/viewer/main.ts`, P2.T3)

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` (oxlint) | 0 | no warnings |
| static | `pnpm format --check` (oxfmt) | 0 | all matched files correctly formatted |
| static | `pnpm typecheck` (tsrs --noEmit) | 0 | no type errors |
| unit | `pnpm test` (vitest run) | 0 | 30 files, 281 tests passed (24 new) |
| build | `pnpm build` (vite build + PWA precache) | 0 | 25 modules, single `index-*.js` chunk, no harness chunk emitted; precache 29 entries (4428.51 KiB); chunk-size warning pre-existing |
| dist scan | `grep -r "__ranch\|data-dev-panel\|installDevHarness\|parseDevQuery" dist/` | no matches | harness markers absent from the production build (FR-9 preview; the automated guard is Phase 3) |

Full gate ran as `pnpm verify` (lint + format --check + typecheck + test +
build), exit 0, no retries. Targeted runs during the work:
`pnpm test tests/ranch/blink.test.ts` (6 passed) and
`pnpm test tests/dev/harness-state.test.ts` (13 passed).

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | No `?dev=1` leaves `window.__ranch` undefined and no `[data-dev-panel]` node | `src/viewer/main.ts` only imports the harness behind `import.meta.env.DEV ? await import("../dev/harness.js") : null`; the bridge and `installDevHarness` run only when `options.enabled` (`dev !== null && options !== null && options.enabled`), and `window.__ranch` is written only inside `src/dev/harness.ts`. Production build: single `index-*.js` chunk, `dist/` scan for `__ranch`, `data-dev-panel`, `installDevHarness`, `parseDevQuery` → no matches. `tests/viewer/dev-harness-gate.test.ts` asserts the flag guard, the absence of any value import, and that `index.html` carries no panel markup. | pass (structural; runtime confirmation deferred) |
| AC-2 | `?dev=1` shows the panel; hiding Stego removes it from the scene while the others keep walking | Panel is built entirely at runtime (`document.createElement("div")` with `data-dev-panel`, one `document.createElement("style")` with `data-dev-panel-style`); visibility row is All/Trike/Stego/Brachio and `window.__ranch.show(id, visible)`. Visibility is applied with `model.visible = false` on each dino's *current* model every frame, so nothing is removed from the scene graph, paused, or reset — Trike and Brachio keep `player.update()` running (FR-2). Asserted structurally in the gate test (runtime panel, real buttons, `aria-pressed`); live DOM check deferred. | partial (browser half deferred) |
| AC-3 | Solo presets leave exactly one visible; All restores three without moving them | `applySolo(solo, ids)` returns `{ trike, stego, brachio }` with exactly one `true` per preset and all `true` for `null`; asserted in `tests/dev/harness-state.test.ts` (4 tests, including a subset-id call and non-mutation). `installDevHarness` applies `options.solo` on install and the panel/`__ranch.solo()` route through the same helper; visibility never touches positions or players. | pass (logic layer) |
| AC-4 | Pause freezes positions across 1 s; `step(10)` advances the equivalent of ten frames | `nextPausedFrame(paused, stepFrames)` never advances while paused with an empty queue, decrements exactly once per advanced frame, and returns to `{ paused: true, stepFrames: 0, advance: false }` after `n` frames; asserted with a 15-frame loop in `tests/dev/harness-state.test.ts`. The viewer loop calls the hook first and, on `dt <= 0`, only `renderer.render` + `return` — no `sleepy.update`, no player update. Stepped frames use `DEV_STEP_DT_SECONDS = 1/60` so ten steps equal ten fixed frames, independent of wall clock. | pass (logic layer) |
| AC-5 | HUD shows numeric fps, draw calls and triangles that change while animating | `formatHud(fps, drawCalls, triangles)` renders `"60 fps · 16.7 ms · 12 calls · 3456 tris"` (rounding, `— ms` for a dead fps); asserted in `tests/dev/harness-state.test.ts` (3 tests). The frame hook smooths fps (`fps * 0.9 + instant * 0.1`), reads `bridge.renderer.info.render.calls/.triangles` (last rendered frame) and repaints at most every 0.2 s. | pass (logic layer; numbers observed in browser by the primary) |
| AC-6 | Each forced action changes state immediately | Blink: `BlinkController.forceBlink()` starts a blink on the next `update()` (returns `true`), re-arms the 3–5 s schedule from that blink's close, and leaves an in-flight blink alone — `tests/ranch/blink.test.ts` (6 tests), including `DinoPlayer.forceBlink()` head-dip and the no-target no-op. Dust: `bridge.dust.puff(centroid, 4)` at the visible dinos' centroid, origin when all are hidden. Sleepy: `sleepy.markInteraction(performance.now() - IDLE_AFTER_MS - 1)` so the next loop `sleepy.update` returns `"sleepy"` and the ZZZ overlay plays. Hint: `lastInteractionMs` rewound past `HINT_IDLE_MS` plus `hintModeFor(reducedMotionQuery.matches)` on `<body>`. POV: the bridge mirrors a pill click (`activePov`, `applyPovPreset`, `markInteraction`, `syncPov`). None of them touches `walking` or `writeSetting`. | pass (logic layer; live ZZZ/puff confirmation deferred) |
| AC-7 | Overlays toggle on and off and follow live positions | One `THREE.Group` holds the 0.8 m shared wander ring at the origin, a 0.4 m avoidance trigger ring and a heading arrow per dino; a single `overlaysVisible` flag drives `group.visible` and the arrows are re-positioned from `getModel().position` / `getPlayer().heading` every frame while visible. Toggled by the panel button and `?overlays=0`; asserted structurally in the gate test. | partial (browser half deferred) |
| AC-8 | `snapshot()` returns all documented fields; pairwise distances match `hypot`; `minSeparation` is the smallest pair | Phase 1 `buildSnapshot` already proves the shape and distances (`tests/dev/snapshot.test.ts`); this phase feeds it live data — `renderer.info` fps, smoothed fps, bridge walking/pov/sleepy, per-dino visibility/rigged/position/heading/walking — and a new test asserts the solo visibility flags reach the snapshot with all three pairs (`tests/dev/harness-state.test.ts`). `window.__ranch.snapshot()` on a live scene is browser-only. | partial (wiring proven; live numbers deferred) |
| AC-9 | Two loads of `?dev=1&seed=42` report identical positions after the same stepped frames | Wiring completed here: `?dev=1&seed=<n>` builds `seededRandom(n)` and passes the same generator into `new DustPool({ random })`, `loadDinoPlayer(..., random)` and each `DinoPlayer` (`random` in options), which also feeds `BlinkController`, wander jitter and dust puffs; without a seed the generator is `Math.random` (unchanged). Determinism of the generator itself is Phase 1 evidence. Cross-load position comparison is browser-only. | partial (wiring proven; two-load comparison deferred) |

NFR-1: with no `?dev=1` the per-frame harness cost is exactly one null check
(`devFrame === null ? rawDt : devFrame(rawDt, now)`); overlays and the HUD only
exist inside the installed harness, and the HUD repaints at 4 Hz, not 60 Hz.
NFR-2: the panel is `position: fixed` top-right below the `#species` pills (the
72 px Walk button is bottom-centre, POV pills bottom-left, status chip top-left,
rotate hint top-centre); at ≤ 720 px it moves to bottom-right above the Walk row
and boots collapsed, showing only the `Dev` toggle. Every control is a real
`<button>` with `:focus-visible` outline, `aria-pressed` on toggles,
`aria-expanded`/`aria-controls` on the collapse button and `role="group"` +
`aria-label` on each row; there is no focus trap.
NFR-3: the harness only adds DOM nodes and a `three` group already in the
bundle; it fetches nothing.

## Deviations

- `src/viewer/main.ts` line ~583: the brief's snippet
  `await import("./dev/harness.js")` resolves to `src/viewer/dev/harness.js`,
  which does not exist. The import uses `../dev/harness.js`; the gate test
  asserts that literal. Same file also carries the erased
  `import type { DevBridge } from "../dev/harness.js"` the brief asks for.
- `src/dev/harness.ts` re-exports `parseDevQuery` and `seededRandom` from the
  Phase 1 modules so the single dynamic import in `main.ts` supplies both the
  parser and the RNG, exactly as the brief's snippet calls them
  (`dev.parseDevQuery`, `dev.seededRandom`). No Phase 1 file was modified.
- `src/viewer/main.ts` grew a `let sleepyState` and the sleepy import gained
  `IDLE_AFTER_MS` / `type SleepyState`; both are required by the brief's bridge
  contract (`getSleepyState`, `forceSleepy`).

## Notes

- **Browser-level confirmation is deferred to the primary agent.** Open
  `http://localhost:5173/?dev=1` after `pnpm dev` to see the panel; add
  `&seed=42&solo=stego` for a deterministic single-dino load, `?dev=1&pause=1`
  to boot paused and `?overlays=0` to boot with overlays off. Suggested checks:
  `window.__ranch.snapshot()` returns moving numbers, `__ranch.pause(true)` then
  `__ranch.step(10)` changes positions by ten fixed frames, `__ranch.blink()`
  dips the head within one frame, `__ranch.sleepy()` shows the ZZZ overlay,
  `__ranch.dust()` shows a puff, and `__ranch.show("stego", false)` hides Stego
  while the others keep walking. Then reload the same dev server **without**
  `?dev=1` and confirm `window.__ranch === undefined` and no
  `[data-dev-panel]` node.
- In a dev build the guarded `await import("../dev/harness.js")` fetches the
  harness module even when `?dev=1` is absent (the options parser lives in the
  same chunk). Production is unaffected: `import.meta.env.DEV` is statically
  false, the dynamic import is dropped, and `dist/` contains no harness marker
  (see the dist scan above). The extra dev-only module request is the price of
  the brief's mandated wiring and never reaches the shipped app.
- Idempotence: `installDevHarness` disposes the previous installation first
  (panel node, style node, overlay group/disposal, `window.__ranch` delete), so
  a hot reload or a second install replaces rather than duplicates.
- Placeholders: `getPlayer()` returns `null` until the GLB swap, so
  `snapshot()` reports `rigged: false` and `heading: 0` (the placeholders keep
  an authored −90° yaw for orientation) instead of throwing; `forceBlink` and
  `forceDust` are no-ops or pool-only, never errors.
- Paused forces land on the next step, matching the spec's "paused before load"
  edge case: the loop returns before `player.update`, so a queued blink/dust
  applies on the next stepped frame.
- `BlinkController.forceBlink` never rewinds an in-flight blink: a forced
  request while a blink is open leaves `blinkStartedAt` untouched, so the close
  and the following 3–5 s schedule stay on their original timeline.

## Evidence paths

- `conductor/tracks/20261029-dev-harness/verification/phase-2.md` (this file)
- `src/dev/harness-state.ts` — `applySolo`, `nextPausedFrame`, `formatHud`,
  `DEV_STEP_DT_SECONDS`
- `src/dev/harness.ts` — panel DOM, style, overlays, `installDevHarness`,
  `DevBridge`, `DevRanchApi`, `window.__ranch`
- `src/viewer/main.ts` — DEV-gated dynamic import, seeded RNG threading, bridge,
  frame hook in the animation loop
- `src/ranch/dino-player.ts` — `BlinkController.forceBlink`,
  `DinoPlayer.forceBlink`
- `tests/dev/harness-state.test.ts` — 13 tests
- `tests/ranch/blink.test.ts` — 6 tests
- `tests/viewer/dev-harness-gate.test.ts` — 5 tests

## Primary verification

- Squash guard: 4 commits (same author, conventional, no merge commit) squashed to `b566a4b`.
- Working tree clean; `git diff --name-only bf178fa..HEAD` reported exactly 8 paths, all inside Touches plus this evidence file.
- `pnpm verify` re-run by the primary: exit 0 — oxlint clean, oxfmt clean, tsrs clean, vitest 30 files / 281 tests, vite build OK. Precache moved 4428.17 → 4428.51 KiB (+0.34 KiB) from the production-side null-check plumbing; no harness chunk is emitted.
- Live probe in the dev server (http://localhost:5174/?dev=1) via `window.__ranch`:
  - `[data-dev-panel]` present; panel exposes All/Trike/Stego/Brachio, Pause/Step 1/Step 10, Blink/Dust/Sleepy/Hint, Ranch/Nest/Garden, Overlays.
  - `snapshot()` returned the documented shape with all three dinos rigged and pairwise distances `0.6928` each — exactly the 120 deg triangle at r=0.4 (`trioSpawnPositions`), and `minSeparation` matched.
  - `solo("stego")` flipped visibility to `[false, true, false]`; `solo(null)` restored all three without moving them.
  - `setPov("garden")` reported `pov: "garden"`; `hint()` added `hint-glow` to `<body>`.
  - Reloading without `?dev=1` left `window.__ranch` undefined and no `[data-dev-panel]` node.
- **Environment limitation:** the in-app review pane never composites frames here (`requestAnimationFrame` never fires — `rafFired: 0`; `browser.screenshot` refuses with "needs a visible tab"), so rAF-gated behavior could not be observed live: movement, `step()`, the sleepy stage and the fps HUD all read as static. Those paths are covered by the pure-logic tests (`harness-state.test.ts`: step consumes exactly N frames then re-pauses) and by `blink.test.ts`; live confirmation of movement/step/sleepy is deferred to a human browser session.
- AC table reviewed: AC-1, AC-2, AC-3, AC-6 (pov/hint), AC-8 pass live or by unit; AC-4, AC-5, AC-6 (blink/dust/sleepy) are unit-proven with live observation deferred by the compositor limitation.
