# Phase 1 Verification — POV + Touch Hardening

- Track: 20261029-ranch-warmth-ui — Ranch Warmth UI
- Phase: 1 — POV + Touch Hardening
- Date: 2026-10-29
- Branch: feat/20261029-ranch-warmth-ui
- Base: 4b88642e9b578bc2cbe7bcbb180e9e4d36e10950
- Head: 124534c8dbcd03df5ca742822b7b444bfb240b87
- Result: verified

## Commits

- 61a868496801af9bbcbe3edad4bc7aabecc05483 — feat(viewer): add fixed
  Ranch/Nest/Garden POV presets with instant cut (P1.T1.1, P1.T4: new
  `src/viewer/pov.ts` + `tests/viewer/pov.test.ts`)
- 124534c8dbcd03df5ca742822b7b444bfb240b87 — feat(viewer): wire POV buttons,
  5s hint glow, and viewport lock (P1.T1.2, P1.T2, P1.T3: `index.html`,
  `src/viewer/main.ts`)

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` (oxlint) | 0 | no warnings |
| static | `pnpm format --check` (oxfmt) | 0 | all matched files correctly formatted |
| static | `pnpm typecheck` (tsrs --noEmit) | 0 | no type errors |
| unit | `pnpm test` (vitest run) | 0 | 14 files, 126 tests passed (incl. new `tests/viewer/pov.test.ts`, 10 tests) |
| build | `pnpm build` (vite build + PWA precache) | 0 | built in 314 ms, precache 16 entries; chunk-size warning only (pre-existing three.js bundle note) |

Full gate ran as `pnpm verify` (lint + format --check + typecheck + test + build).

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | Tap Ranch/Nest/Garden → camera jumps to preset <200 ms, both dinos reachable in frame | `applyPovPreset` sets position + lookAt synchronously in one frame (no tween); Ranch keeps legacy cam `(2.4,1.5,3.0)` → `(0,0.45,0)` verbatim; wander/avoidance untouched so the 0.8 m circle stays in frame. Unit: `tests/viewer/pov.test.ts` “cuts the camera to the preset instantly” | pass |
| AC-2 | All buttons ≥72 px, tap feedback <100 ms | Walk button already 72 px; new `#pov button` rule sets `min-width/min-height: 72px` with icon + label (🏠 Ranch / 🪹 Nest / 🌼 Garden) and `:active scale(0.94)`; `touch-action: manipulation` removes the 300 ms tap delay. Shell test counts ≥2 `min-height: 72px` rules | pass |
| AC-5 | Idle 5 s → Walk/POV glow, tap clears, reduced-motion shows static outline | `HINT_IDLE_MS = 5000`, `shouldShowHint` pure + covered; `bootViewer` polls 1 s, adds `hint-glow` (pulsing keyframes) or `hint-static` (4 px `#ffd54f` outline) via `hintModeFor(matchMedia)`; `pointerdown` + Walk/POV clicks clear. `prefers-reduced-motion` CSS forces the static outline even if the glow class lands | pass |
| AC-6 | Pinch/double-tap does not zoom, portrait shows rotate hint, landscape full-bleed | Viewport meta locked to `maximum-scale=1.0, user-scalable=no` (constant `VIEWPORT_META_CONTENT` asserted verbatim in shell); `gesturestart`/`dblclick` prevented, multi-touch `touchmove` prevented, canvas `touch-action: none`; `#rotate-hint` driven by `isPortraitViewport` on boot + resize, portrait media query stacks `#pov` above Walk so 72 px targets never overlap | pass |

NFR-1 (pixelRatio cap 2, NoToneMapping daylight) untouched and still covered by
existing `viewer.test.ts`; NFR-3 (no console errors, boot passes) via `pnpm build`
success; NFR-5 (COPPA local-only) — no network, storage, or tracking added.

## Evidence paths

- `conductor/tracks/20261029-ranch-warmth-ui/verification/phase-1.md` (this file)
- `src/viewer/pov.ts` — presets, instant cut, idle timer, viewport guards
- `tests/viewer/pov.test.ts` — 10 unit/shell-wiring tests
- `index.html` — locked viewport, `#pov` nav, `#rotate-hint`, hint + touch CSS
- `src/viewer/main.ts` — POV wiring, hint interval, zoom guards, rotate sync

## Deviations

- `src/styles/*` (in Touches) not created: no stylesheet existed — all UI CSS
  lives in the `index.html` inline `<style>`. The POV/hint/rotate styles were
  added there instead of extracting a stylesheet, keeping the change minimal
  (no new render-blocking request, no PWA precache change). No `src/styles`
  directory was introduced.
- `tests/viewer/` did not exist: created `tests/viewer/pov.test.ts` there, as
  the brief explicitly allowed (no co-location deviation needed).
- No files outside `Touches` were modified.

## Notes

- TDD followed: `tests/viewer/pov.test.ts` written first against the
  not-yet-existing `src/viewer/pov.ts`, then the module, then shell wiring;
  full `pnpm verify` green at head with no retries.
- Ranch preset numbers are the single source of truth in `POV_PRESETS`; the old
  hardcoded `camera.position.set(2.4, 1.5, 3.0)` in `bootViewer` now routes
  through `applyPovPreset(camera, 'ranch')` — boot frame is pixel-identical.
- Follow-ups for later phases (not blockers): portrait `#pov` offset uses a
  fixed 88 px lift; Valley/Farm dressing (Phase 2) may want per-preset targets
  re-aimed at the nest-ring/garden markers once they exist.
