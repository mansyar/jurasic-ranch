# PR: Dev Harness for Debugging & Verification

- **Track:** 20261029-dev-harness
- **Type:** chore
- **Branch:** chore/20261029-dev-harness → main
- **Base:** main @ cb12399

## Summary

Adds a dev-only harness that makes the ranch inspectable without waiting 90 s for sleepy, guessing the 0.4 m avoidance ring, or screenshotting blind. It is dormant unless the URL carries `?dev=1`, and `pnpm verify` now fails if any of it reaches `dist/`.

**What you get**

- **Per-dino visibility plus solo presets** — hide Stego and Brachio, or solo one, to inspect a single model.
- **Pause / Step 1 / Step 10** — freeze a pose for captures, advance exactly N frames.
- **HUD** — fps, frame ms, draw calls, triangles, refreshed 4x a second.
- **Forced states** — Blink, Dust, Sleepy (from awake, without the 90 s wait), Hint glow, and POV Ranch/Nest/Garden.
- **Overlays** — the 0.8 m wander ring, 0.4 m avoidance rings and heading arrows, so soft steering is visible rather than inferred.
- **`window.__ranch`** — `snapshot()` (paused, walking, POV, sleepy stage, fps, per-dino visibility/position/heading, pairwise distances, `minSeparation`) plus `show`, `solo`, `walk`, `pause`, `step`, `setPov`, `blink`, `dust`, `sleepy`, `hint`.
- **`?seed=<integer>`** — reproducible draws. Combine with `&pause=1` for byte-identical captures: `/?dev=1&seed=42&pause=1`, then `step(n)`.

## Verification

`pnpm verify` green: oxlint, oxfmt, tsrs, **33 files / 313 tests** (79 new), vite build, then `scripts/check-dist-clean.mjs` → `dist clean: no dev harness markers in dist`. Precache 4428.51 → 4428.59 KiB (+0.08 KiB, production-side null checks only; the harness chunk is not emitted).

Independent failure proof for the guard: appending `window.__ranch=1;` to a built asset made it exit 1 naming the file and marker.

Live probe on `/?dev=1`: panel mounts, `snapshot()` returns the documented shape, the trio sits at the 120° spawn triangle (0.6928 m pairwise), `solo("stego")` → `[false, true, false]`, `setPov("garden")`, `hint()` → `hint-glow`; without `?dev=1`, `window.__ranch` is `undefined` and no panel exists.

## Review

Two rounds. Round 1 returned BLOCK on a real defect: one seeded generator served dust, wander and blink, so wall-clock blink draws made seeded poses irreproducible. Fixed with per-consumer streams keyed by dino id (never by load order), a non-vacuous determinism suite, a wiring guard on `main.ts` proven by falsification, independent per-dino toggles, a tested overlay projection, and `?dev=1` checked before the dynamic import. Round 2 returned PASS WITH FINDINGS with all findings closed.

## Known debt

- **Live frame checks are manual.** The in-app review pane never composites, so `requestAnimationFrame` never fires there; step/sleepy/fps were unit-verified but not observed live. Worth one pass in a real window.
- **Trio coexistence is draw-tuned.** Changing the blink stream revealed that the merged 30 s guarantee depends on blink draws polluting the movement stream (trike 1.118 m vs a 1.09 m bound, and 0.079 m separation once relaxed). This PR deliberately leaves gameplay RNG untouched and records the finding for a ranch track.

## Merge checklist

- [ ] `verify` green in CI
- [ ] `/?dev=1` panel usable in a real browser window
- [ ] `/?dev=1` absent → unchanged kid-facing app
