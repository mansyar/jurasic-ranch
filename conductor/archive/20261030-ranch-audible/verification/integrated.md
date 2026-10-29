# Integrated verification — The Ranch Answers Back

- **Track:** 20261030-ranch-audible
- **Branch:** `feat/20261030-ranch-audible`
- **Base:** `94178c4` (`main` when the track started)
- **Head:** `89073de` plus the doc-sync commit that follows it
- **Date:** 2026-10-30

## Branch shape

| Path | Change |
| --- | --- |
| `src/audio/feedback.ts` | new — pure decisions (surface map, coo gate, greeting rule, first-press slot) |
| `src/viewer/audio.ts` | new — facade: bus routing, first-press queue, greeting scheduler |
| `src/viewer/hud.ts` | Walk and POV dispatch, coo wiring, species validation |
| `src/viewer/main.ts` | unlock feedback wiring (flush + greeting + mute tap callback) |
| `src/viewer/audio-controls.ts` | `onSfx` hook, mute ordering |
| `index.html` | species list becomes three 72 px buttons, Brachio gets a long neck |
| tests | 5 new/extended suites, 88 new assertions |
| docs | `tech-stack.md` feedback bullet, track artifacts and evidence |

`git diff --stat 94178c4 HEAD` reported 21 files, +2316 / -15, of which 631 lines
are conductor artifacts and evidence.

## Checks

| Check | Command | Result |
| --- | --- | --- |
| Full pipeline | `pnpm verify` | exit 0 — 46 test files / 543 tests, 80.38 % lines, build 309 ms, dist clean |
| Audio pack | `pnpm audio:check` (inside verify) | 15 assets / 853,289 B, unchanged |
| Production bundle | `scripts/check-dist-clean.mjs` (inside verify) | no `__ranch`, `installDevHarness`, `parseDevQuery` or `data-dev-panel` in `dist/` |
| Offline shell | precache manifest | 45 entries / 5072.34 KiB, no new request |
| Dependencies | `package.json` | unchanged |
| Live smoke | `pnpm dev --host` + Chromium at `/?dev=1` | boots, unlocks on first gesture, four wired surfaces audible, coos gated |

## Criteria closed across phases

| Criterion | Closed by |
| --- | --- |
| AC-1, AC-3, AC-4 | Phase 2 unit tests + Phase 4 live gate probe |
| AC-2, AC-7, AC-8 | Phase 3 call-order and failure-path tests |
| AC-5, AC-6 | Phase 4 live greeting trace after the `f783c7e` routing rework |
| AC-9 | Phase 4 1280 × 800 layout measurement (screenshot substituted) |
| AC-11 | `pnpm verify` + per-file coverage |
| AC-10 | **open** — `tablet-touch-play` human pass, checklist in `phase-4.md` |

## Risk review

- **Regression surface.** The only shared code touched is `hud.ts` (two lines of
  delivery plus the new handlers) and `audio-controls.ts` (one optional hook).
  Both keep their existing signatures; `AudioControlsOptions.onSfx` is optional,
  so a caller that ignores it behaves exactly as before.
- **No new failure mode.** Every new path is wrapped: a missing catalog entry, a
  locked engine, a failed load or a throwing engine all end in silence. The
  greeting check was hardened after the routing rework so a relocked engine
  cannot park `hello` in the first-press slot.
- **Child-safety.** No new asset, no new dependency, no network, no timer that
  can fire after mute (the greeting re-reads `muted` when it fires), and nothing
  the child can press starts a loop that runs forever — the coo gate is bounded
  by each asset's own duration.
- **Debt carried forward (unchanged by this track).** `hud.ts` has no dedicated
  visual snapshot; the gear hold cannot be exercised in an automated browser
  session because `requestAnimationFrame` throttles when the desktop window is
  not visible.
