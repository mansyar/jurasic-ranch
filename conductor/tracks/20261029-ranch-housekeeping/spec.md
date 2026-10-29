# Ranch Housekeeping - Specification

> Requirements are stable. Once an `FR`, `NFR`, or `AC` ID is approved, do not
> renumber it. If a requirement is removed, mark it `Withdrawn` instead of
> deleting it.

## Overview

A behaviour-preserving cleanup pass on Jurasic Ranch before the gameplay tracks
(Feed, Wash, Stickers) land. It splits the 800-line `src/viewer/main.ts` into
cohesive modules, retires the completed Trike migration shim, repairs three
holes in the verify gate that let regressions through unnoticed, and removes a
duplicated Draco decoder payload from the shipped bundle. It also refreshes the
stale PWA manifest so the installed app describes the trio ranch that exists
today. No new user-facing behaviour is introduced.

## Problem / Motivation

The ranch currently works and every check is green, so this is protective work
rather than a repair. Four problems make it urgent now:

1. **`src/viewer/main.ts` is 800 lines** and grows every track (627 after
   Track 1 → 800 after Track 3). It mixes renderer/scene construction, DOM chrome
   wiring, three async model-loading orchestrations, placeholder factories, and
   the render loop. Feed and Wash each need to add tap/drag handling and asset
   loading into this file; doing that before it is split multiplies the merge
   surface for both tracks and makes each one harder to review.
2. **The format gate silently checks almost nothing.** `pnpm format --check`
   passes `src public '!public/draco/**'` to oxfmt, which does **not** expand
   bare directory arguments: it checks 4 files. An explicit
   `oxfmt --check "src/**/*.ts"` checks 14. All 14 source files, every test, and
   every script currently sit outside the gate while `pnpm verify` reports
   success. There is also no `.oxfmtrc.json`, so "using defaults" is an implicit
   contract that a future oxfmt release can change under us.
3. **The coverage gate is configured but unrunnable.** `conductor/workflow.md`
   promises a 60% coverage gate; `package.json` has a `coverage` script;
   `@vitest/coverage-v8` is not installed, so the script fails. The review of the
   previous track had to record coverage as "unavailable — not treated as pass".
   A gate that cannot run is worse than no gate, because it reads as green.
4. **The shipped bundle carries the Draco decoder twice.** `three`'s
   `DRACOLoader` statically resolves `../libs/draco/*` through `import.meta.url`,
   so Vite always emits `draco_wasm_wrapper` (58 kB), `draco_decoder.wasm`
   (286 kB), the gltf wasm variant (192 kB) and `draco_decoder.js` (719 kB).
   The app *additionally* ships `public/draco/` (1.31 MB) and points
   `setDecoderPath` at it. Only the `public/draco/` copy is ever fetched, so
   ~1.31 MB of dist and precache is dead weight inside a 15 MB budget.

If these are not solved: every later track pays the 800-line tax, unformatted
code keeps merging while CI says "format OK", the coverage promise stays
fictional, and the offline precache spends a third of its budget on a decoder
nobody loads.

## Goals & Success Metrics

- **Goal:** land Feed/Wash/Stickers on a codebase where the viewer is split by
  responsibility and every check that claims to run actually runs.
- **Metric:** `src/viewer/main.ts` under 300 lines with no behaviour change;
  every pre-existing test still passes (234 at the base commit);
  `pnpm format --check` covers ≥ 40 files
  (source + tests + scripts); `pnpm coverage` exits 0 with a 60% threshold;
  `dist/` total shrinks by ≥ 1.2 MB; zero new runtime dependencies.

## Scope

### In Scope

- Split `src/viewer/main.ts` into responsibility-focused modules under
  `src/viewer/` (scene, HUD/DOM chrome, model loaders, placeholders, render
  loop), leaving `main.ts` as boot and wiring only.
- Delete `src/ranch/trike-player.ts` and `tests/waddle/trike-player.test.ts`,
  after confirming the unique assertions they carry are covered elsewhere.
- Add `.oxfmtrc.json` and repair the `format` script so it glob-expands every
  TypeScript file in `src/`, `tests/`, and `scripts/`.
- Install `@vitest/coverage-v8`, enable coverage with a 60% global threshold,
  and make the verify chain run it.
- Delete `public/draco/` and stop calling `setDecoderPath`, relying on three's
  bundled decoder.
- Refresh `public/manifest.webmanifest` (name, description, icons) and the
  document `<title>`/`meta description`; add a committed
  `scripts/build-icons.mjs` (sharp devDependency) that derives 192, 512,
  maskable and apple-touch PNGs from `public/icons/icon.svg`.

### Out of Scope

- Any new gameplay: feeding, washing, cuddling, stickers, surprises, audio.
- Visual, animation, camera, gait, or colour changes of any kind.
- `PLACEHOLDER_BODY_HEX` and `WADDLE_STRIDE_METRES` are **not** removed — they
  are load-bearing test constants, not dead code.
- Localisation extraction of UI strings (`conductor/product-guidelines.md`
  defers this); strings stay where they are.
- Splitting `src/ranch/` modules; `dino-player.ts` (350 lines) and
  `waddle.ts` (243 lines) are cohesive and stay as they are.
- Adding any sound, mute control, or parent gate (Cozy Sound track).
- Real-device 60 fps measurement (Track 8 tablet pass).

## Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | `src/viewer/main.ts` is reduced to boot and wiring: it constructs the scene through the extracted modules, wires DOM controls, and starts the loop, and contains no renderer/material/light setup, no model-loader implementation, and no placeholder geometry authoring. | must |
| FR-2 | The extracted viewer modules each own a single responsibility — scene/renderer construction, HUD and DOM chrome, model loading, placeholder bodies, and the render loop — and no extracted module exceeds 300 lines. | must |
| FR-3 | `src/ranch/trike-player.ts` and `tests/waddle/trike-player.test.ts` are deleted, no module under `src/` or `tests/` imports `trike-player.js`, and any assertion unique to the deleted test is ported to `tests/waddle/dino-player.test.ts`. | must |
| FR-4 | `pnpm format --check` inspects every `.ts` file in `src/`, `tests/`, and `scripts/`, reports a file count consistent with the repository, and fails if any of them is unformatted. | must |
| FR-5 | A `.oxfmtrc.json` exists and pins the formatter settings explicitly, removing the "No config found, using defaults" warning. | must |
| FR-6 | `@vitest/coverage-v8` is installed as a devDependency, `pnpm coverage` produces a report, and the command exits non-zero when global coverage falls below 60%. | must |
| FR-7 | The configured verify chain (`pnpm verify`) executes the coverage gate, so a coverage regression fails CI rather than being silently skipped. | must |
| FR-8 | The Draco decoder is loaded from a single copy: `public/draco/` is deleted, no `setDecoderPath` call remains, and every rigged model still loads in a browser. | must |
| FR-9 | The produced bundle contains exactly one decoder set, and total `dist/` size is at least 1.2 MB smaller than at the track's base commit. | must |
| FR-10 | `public/manifest.webmanifest` names and describes the trio ranch rather than the original Trike-only walk, and declares 192×192, 512×512, maskable, and apple-touch icons that exist in `public/icons/`. | must |
| FR-11 | `index.html`'s `<title>` and `meta[name=description]` describe the trio ranch, and the page declares an `apple-touch-icon` link. | must |
| FR-12 | `scripts/build-icons.mjs` regenerates every PNG icon from `public/icons/icon.svg` deterministically, and the committed PNGs match its output. | should |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | No new runtime dependency. `sharp` is a devDependency only and must not appear in the client bundle. |
| NFR-2 | Rendered output, animation timing, camera presets, colours, and DOM chrome are byte-for-byte equivalent in behaviour to the base commit; the only permitted visual change is the document title and manifest metadata. |
| NFR-3 | The app still starts fully offline after the Draco change: airplane-mode load and first paint work with no network, from precache alone. |
| NFR-4 | `pnpm verify` remains green end to end and does not materially regress in duration. |
| NFR-5 | Code follows `conductor/code_styleguides/typescript.md`: named exports only, no default exports, `private` over `#private`, explicit semicolons, no `any`. |
| NFR-6 | The PWA precache stays within the existing `DRESSING_BUDGET_BYTES` (15 MB) with headroom. |

## Acceptance Criteria

| ID | Criterion | Verifies |
| --- | --- | --- |
| AC-1 | `src/viewer/main.ts` is under 300 lines and a grep finds no `new THREE.WebGLRenderer`, `new THREE.DirectionalLight`, or `DRACOLoader` construction inside it. | FR-1 |
| AC-2 | Every extracted viewer module is under 300 lines and every pre-existing test (234 at the branch base) passes unchanged apart from import paths. | FR-2 |
| AC-3 | `git ls-files` shows no `src/ranch/trike-player.ts`, no test imports `trike-player.js`, and `pnpm test` is green. | FR-3 |
| AC-4 | `pnpm format --check` reports checking at least 40 files, and deliberately mis-formatting a file in `tests/` makes it exit non-zero. | FR-4 |
| AC-5 | `.oxfmtrc.json` exists and `pnpm format --check` emits no "No config found" message. | FR-5 |
| AC-6 | `pnpm coverage` exits 0 on the current tree and reports a global total ≥ 60%; lowering a file's coverage below the threshold makes it exit non-zero. | FR-6 |
| AC-7 | `pnpm verify` runs the coverage gate — its output contains the coverage report — and still exits 0. | FR-7 |
| AC-8 | `public/draco/` is absent, `grep -r setDecoderPath src/` returns nothing, and a preview load of Trike, Stego and Brachio succeeds in a browser. | FR-8 |
| AC-9 | `dist/` contains exactly one `draco_decoder*.wasm` pair set and its total size is ≥ 1.2 MB smaller than the base commit's build. | FR-9 |
| AC-10 | `public/manifest.webmanifest` mentions the trio and its icon entries point at files that exist; a parse of the manifest lists 192 and 512 raster icons plus a maskable entry. | FR-10 |
| AC-11 | `index.html` `<title>` and `meta[name=description]` mention Trike, Stego and Brachio, and an `apple-touch-icon` link resolves. | FR-11 |
| AC-12 | Running `node scripts/build-icons.mjs` on a clean tree leaves `git status` clean, proving the committed PNGs match generated output. | FR-12 |

## Edge Cases

- **three.js decoder drift:** a future `three` upgrade could change the bundled
  decoder layout. The spec's acceptance is a working browser load, not a
  hardcoded path, so the check survives an upgrade.
- **Coverage below 60% today:** if the measured global coverage is under the
  threshold, the phase must report the measured number and raise coverage for
  the untested modules it touches rather than lowering the number.
- **sharp on CI:** `sharp` ships prebuilt binaries; if install fails on a CI
  runner the icons phase must not block the other phases, because committed
  PNGs already satisfy `FR-10`.
- **Windows path separators:** the format glob must work on both Windows and the
  Linux CI runner; quoting the globs is required so the shell does not expand
  them differently.
- **`dist/` is gitignored:** the size comparison must be computed from two local
  builds (base commit vs branch), not from committed artefacts.
- **Deleting the shim breaks an unexpected consumer:** if any file outside the
  known set imports `trike-player.js`, the phase stops and reports rather than
  patching around it.

## Dependencies

- **Tracks:** none — Tracks 1, 2, 3 and 7 are merged on `main` at `cb12399`;
  Track 8 (tablet/release) consumes this track's outcome.
- **External:** none. No network, no credentials, no new services. `sharp` is a
  devDependency resolved at install time.

## Open Questions & Assumptions

- **Assumption:** three's bundled Draco decoder (`three/examples/jsm/libs/draco/`)
  decodes the compressed GLBs in `public/models/` correctly, so `public/draco/`
  is genuinely redundant. Verified by the browser load in AC-8; if it fails, the
  fallback is to keep `public/draco/` and accept the duplication.
- **Assumption:** global coverage is at or above 60% today. The pure-math
  modules (`waddle`, `sleepy`, `avoidance`, `pov`) are heavily tested, so this
  is likely; AC-6 forces the measured number into the evidence either way.
- **Assumption:** the 300-line ceiling per module is achievable without moving
  logic into `src/ranch/`, which this track leaves alone.
- **Question:** should the extracted viewer modules live in `src/viewer/`
  alongside `main.ts`, or in a `src/viewer/scene/` subdirectory? Assumed:
  flat in `src/viewer/` to match the existing flat layout.
- **Question:** does the project want the `LoadedTrike` type alias renamed to
  `LoadedDino`? Assumed no — it is a one-line alias with no dead-code cost, and
  renaming it adds diff noise to a behaviour-preserving track.

## References

- `conductor/product.md` — Roadmap Tracks 4-8; Open Questions.
- `conductor/workflow.md` — `## Workflow Config`: coverage gate 60, verify chain.
- `conductor/product-guidelines.md` — offline-first, 15 MB budget, no online links.
- `conductor/code_styleguides/typescript.md` — style rules for the split.
- `conductor/archive/20261029-stego-generic-player/` — origin of the
  `TrikePlayer` thin-alias contract this track retires.
- `node_modules/three/examples/jsm/loaders/DRACOLoader.js` — bundled decoder
  resolution via `import.meta.url`.
