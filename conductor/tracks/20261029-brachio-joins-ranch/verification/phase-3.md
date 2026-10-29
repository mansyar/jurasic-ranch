# Phase 3 evidence — Trio ranch integration

- Track: 20261029-brachio-joins-ranch — Brachio Joins the Ranch
- Phase: 3 — Trio ranch integration (FR-5, FR-6, FR-7, FR-8, FR-9 / AC-3, AC-4, AC-5, AC-6, AC-8)
- Date: 2026-10-29
- Branch: feat/20261029-brachio-joins-ranch
- Base: 4a6faf3
- Head (code): 3c43d0b + <evidence SHA below>
  - P3.T1+T2 viewer: 6010c33 `feat(viewer): trio ranch with one Walk, shared FX, and Brachio fallback`
  - P3.T3 tests: 3c43d0b `test(viewer): cover trio ranch wiring, Brachio fallback, and three-way Walk`
  - Evidence: `docs(brachio): record phase-3 verification evidence` (this file)
- Result: verified

## Commands

| Layer | Command | Exit | Summary |
| ----- | ------- | ---- | ------- |
| Targeted | `pnpm test tests/waddle/trio-viewer.test.ts` | 0 | 21/21 pass (placeholder, loader, Walk×3, steering, shell) |
| Full | `pnpm verify` | 0 | oxlint + oxfmt check + tsrs + 175 tests (20 files) + vite build; precache 17 entries / 3292.66 KiB |

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| -- | --------- | -------- | ------ |
| FR-5 / AC-3 | Trio 30 s wander stays in-frame (≤ RADIUS + CYCLE) with min pairwise separation >0.25 m | `tests/waddle/trio-wander.test.ts` (unchanged, green under full suite); viewer spawns from `trioSpawnPositions()` with the locked staggered-entry headings and mirrors the test's avoid-then-update frame order | Met |
| FR-6 | Pairwise soft-steer across all three pairs (<0.4 m trigger), never stops, no bounce | `steerTrioApart` in `src/viewer/main.ts` (clamped-sum `trioAvoidanceNudges`); `tests/waddle/trio-viewer.test.ts` (crowded trio deflects, walking holds every frame; far-apart trio holds course); partial-load window steers whichever pairs are rigged yet | Met |
| FR-7 / AC-4 | One Walk toggles all three; aria-pressed + status + 3 pills; persists across reload | `setAllWalking` over three players; `walkStatusText` names all three with icon + word; `index.html` third pill `🦴 Brachio`; `walking` key via `readSetting`/`writeSetting` unchanged; trio-viewer Walk + shell tests | Met |
| FR-8 / AC-5 | Missing Brachio GLB → placeholder long-neck + warn; Trike + Stego keep walking | `createPlaceholderBrachio` (boxy lavender grazing fallback, feet y = 0, 2.3–3.1 m swap window); `console.warn("Rigged brachio unavailable; keeping the placeholder.")`; per-dino independent load promises; trio-viewer fallback tests | Met |
| FR-9 / AC-6 | Single shared DustPool + shared BlinkController class via generic player | One `new DustPool()` (default 48-particle budget) shared by all three loaders; `BlinkController` per-player inside `DinoPlayer` (unchanged); trio shares one pool and all three blink in `trio-wander.test.ts`; single-construction source test | Met |
| AC-8 | `pnpm verify` green; precache <22 MB reported | `pnpm verify` exit 0 (table above); precache 17 entries / 3292.66 KiB from build output (brachio.glb auto-included via workbox `glb` glob; no manifest/vite change needed); tablet screenshot is a manual follow-up for the primary (workflow human-only exception — no browser automation attempted) | Met |

## Evidence paths

- `src/viewer/main.ts` — `BRACHIO_MODEL_URL`, `BRACHIO_BODY_HEX` (0xb8a9d6, verbatim baked coat), `BRACHIO_BELLY_HEX` (0xf2e9d8, verbatim baked belly), `createPlaceholderBrachio`, `loadBrachioPlayer` (BRACHIO_GAIT), trio `walkStatusText`, `steerTrioApart`, `TRIO_SPAWN_HEADINGS_RADIANS`, triangle spawn + three-way frame loop
- `index.html` — third species pill + updated description
- `tests/waddle/trio-viewer.test.ts` — P3.T3 (21 tests: 5 placeholder, 5 loader, 3 Walk, 3 steering, 5 shell)
- `tests/waddle/trio-wander.test.ts`, `tests/waddle/trio-avoidance.test.ts` — Phase-1 30 s coexistence contract, green unchanged

## Deviations

None — all changes are inside the brief `Touches`. `public/manifest.webmanifest` and `vite.config.ts` needed no edit: the workbox `globPatterns` already precache `*.glb`, so `brachio.glb` has been in the precache since Phase 2 (17 entries). `SPAWN_OFFSET_METRES` stays exported (dual-viewer contract) while the trio spawns from `trioSpawnPositions()`.

## Notes

- **Precache total: 17 entries / 3292.66 KiB** (build output above), far under the 22 MB NFR-2 budget. Delta vs Phase 2 (3290.43 KiB) is the trio wiring in the JS bundle; no new assets.
- **Turn-arc actuals (no re-tune, per brief):** Brachio yaw-cap rate bound (π/2)/1.8 = 0.87 s (<1.0 s clip budget); full walking arc binds on curvature × speed (4.5 × 0.24 = 1.08 rad/s, 0.22 m radius) ≈ 1.45 s, then walks straight — asserted in `tests/waddle/brachio-gait.test.ts` (converges <2.5 s, holds heading, keeps walking). Gait math untouched.
- **Placeholder bob:** the Brachio fallback shares the generic 0.8 s `updatePlaceholderWalk` bob (same as the Stego fallback) while the rigged Brachio loops at 1.0 s — fallback-only visual, seamless either way; swap footprint is what matters and it matches (2.3–3.1 m).
- **Blush:** Brachio gets runtime blush cheeks twice-covered — the placeholder carries baked-in cheek spheres, and the rigged path pins `attachBlushCheeks` under Head via the shared `loadDinoPlayer` (no-op when Head is absent).
- **Screenshot manual follow-up for the primary:** tablet visual check (trio in-frame, lavender Brachio distinct, dust visible, three pills) plus `preview_scene` link belong in the track evidence per AC-8; tablet-touch-play is a workflow human-only exception and no browser automation was attempted.
