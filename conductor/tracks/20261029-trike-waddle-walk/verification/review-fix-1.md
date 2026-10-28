# Review Fix Round 1 — Evidence

- Track: 20261029-trike-waddle-walk — Trike Waddle Walk
- Date: 2026-10-29
- Branch: feat/20261029-trike-waddle-walk
- Base: d59eba3
- Head (code): b500a15 (`test(trike): assert NFR-2 draco and single-material contract`)
- Result: VERIFIED by primary — `pnpm verify` green end-to-end (oxlint with
  public/draco ignore; oxfmt check; tsrs --noEmit over src+tests+scripts;
  vitest 42/42 across 4 files incl. 4 new viewer loader tests + 1 new NFR-2
  GLB test; vite build, PWA precache 10 entries = 7 + 3 vendored Draco files).
  Fix-range commit after squash: 6374f1f.

## Commits

| SHA | Message | Finding |
| --- | --- | --- |
| ff2827f | fix(viewer): wire rigged trike GLB with local draco loader and body-only fallback bob | F1, F5, F6 |
| 3a2a421 | fix(config): include tests and scripts in tsconfig typecheck | F2 |
| b500a15 | test(trike): assert NFR-2 draco and single-material contract | F4 |

## Per-finding table

| Finding | Fix applied | Files | Tests |
| --- | --- | --- | --- |
| F1 (High) viewer GLB wiring | `bootViewer` paints the procedural placeholder instantly, then `loadTrikePlayer()` fetches `/models/trike.glb` via `GLTFLoader` + `DRACOLoader` (`setDecoderPath('/draco/')`, same-origin vendored decoder, never the Google CDN default), wraps the `Waddle` clip in a `TrikePlayer`, swaps placeholder → rigged model (+ `dust.points`), drives `setWalking` from the existing 72px Walk button (pre-load state re-applied on swap), and calls `player.update(dt, now)` in the animation loop. Load failure keeps the placeholder walking and logs a `console.warn` (offline first-visit safety). | `src/viewer/main.ts`, `vite.config.ts` | `src/viewer/viewer.test.ts`: new `rigged trike loader` block asserts `loadAsync` is called with `/models/trike.glb`, the result wraps the scene in a `TrikePlayer` with a ~0.8 s clip, prefers the `Waddle` clip, and rejects on load failure / missing animations (viewer keeps placeholder). Loaders mocked via `vi.mock` at the loader boundary; no WebGL, no network. |
| F5 (dissolves in F1) viewer `WADDLE_LOOP_SECONDS` duplicate | Deleted the viewer-side duplicate; `src/viewer/main.ts` imports the shared constant from `src/ranch/waddle.ts`. | `src/viewer/main.ts`, `src/viewer/viewer.test.ts` (import now from `../ranch/waddle.js`) | Existing 0.8 s loop assertions unchanged, now against the shared source. |
| F6 (dissolves in F1) foot-lifting bob | Placeholder restructured: upper body (torso/head/frill/horns/eyes/cheeks/tail) lives in an inner `PlaceholderBody` group, legs stay on the outer group; `updatePlaceholderWalk` bobs/rolls only the inner group, feet stay planted at y = 0, loop stays seamless. | `src/viewer/main.ts`, `src/viewer/viewer.test.ts` | Seamless-loop test now compares the body group; new assertion: body lifts mid-stride while outer `position.y`/`rotation.z` stay 0. |
| F2 (Medium) typecheck the tests | `tsconfig.json` include widened to `["src", "tests", "scripts", "vite.config.ts"]`; `types` unchanged (`node`, `vite/client` cover the `node:fs/promises`, `TextDecoder`, `import.meta.url`, and explicit `vitest` imports). Manually reviewed `tests/waddle/*.test.ts`, `src/viewer/viewer.test.ts`, and `scripts/check-trike.test.ts` for strict-mode issues (indexing, `??` fallbacks, `Mock` typing, `catch (error: unknown)`); no source changes needed. | `tsconfig.json` | None (config only; `pnpm verify` by primary). |
| F4 (Medium) NFR-2 contract | `scripts/check-trike.test.ts` extended: `GlbJson` gains `extensionsUsed?`, `extensionsRequired?`, `materials?`; new test asserts the declared extensions include `KHR_draco_mesh_compression` and `materials.length === 1`. Flat shading is cited, not parsed: glTF carries no flat-shading flag; comment cites the Polyfork triceratops-base flat-shaded low-poly source, Phase 2 evidence (1 mesh / 1 material), and the viewer's `NoToneMapping` daylight. | `scripts/check-trike.test.ts` | New `meets the NFR-2 offline contract` test (runs in `pnpm test` via vitest discovery). |
| F3 | NOT MINE — spec decision owned by primary. No change; `spec.md` untouched. | — | — |

## Precaching

- `vite.config.ts` workbox `globPatterns` gains `wasm`, so the vendored decoder
  (`public/draco/*` → `dist/draco/*`: JS + WASM) is precached alongside the GLB
  for airplane-mode boot.

## Deviations

- `Touches` expansion as pre-allowed by the brief: `src/viewer/*`, `tsconfig.json`,
  `vite.config.ts`, `public/draco/*` (plus evidence file and `.conductor` artifacts).
- No files outside the brief's allowed areas were touched.
- `public/draco/*` decoder files are NOT yet vendored (blocker below); the code
  points at `/draco/` and the workbox pattern already covers them, so the primary's
  single copy command completes F1 with no further code changes.

## Notes

- `node_modules` is absent in this checkout, so the decoder files could not be
  confirmed or copied here; Phase 2 evidence already confirms the GLB side
  (85,780-byte Draco export, 1 mesh / 1 material).
- No verification commands were run: the sandbox permits git only and denies
  pnpm/node/vite/vitest. Primary runs `pnpm verify` (lint + format --check +
  typecheck + test + build) after unblocking the decoder copy.
- Format risk reviewed by hand: added lines kept ≤ ~97 chars to match the
  existing `oxfmt`-gated style (`src`, `vite.config.ts`); `scripts/` is outside
  the format script's path list but kept tidy anyway.
- State ownership: the Walk button keeps a single viewer-owned `walking` boolean
  and drives the player via `setWalking` (pre-load toggles re-applied at swap);
  `toggleWalk` remains available on `TrikePlayer` for future callers.
