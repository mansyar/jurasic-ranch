# Ranch Housekeeping - Implementation Plan

> **Branch:** `refactor/20261029-ranch-housekeeping`
> **Base:** `main` @ `cb12399`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, or `blocked`.
> Only the primary agent writes this file. Phase subagents report results and the
> primary records them.

## Phase 1: Retire the completed migration shim

- **Goal:** `src/ranch/trike-player.ts` and its contract test are gone, with no loss of test coverage.
- **Depends on:** none
- **Covers:** FR-3, AC-3
- **Touches:** `src/ranch/trike-player.ts`, `tests/waddle/trike-player.test.ts`, `tests/waddle/dino-player.test.ts`
- **Verification:** `pnpm test` (green at 174+ tests) then `pnpm verify`
- **Status:** pending

- [ ] **P1.T1: Port the unique assertion, then delete the shim** - covers: FR-3
  - [ ] **P1.T1.1:** Confirm `tests/waddle/dino-player.test.ts` already asserts one 0.8 s loop covers `WADDLE_STRIDE_METRES`; if not, add that assertion there before deleting anything
  - [ ] **P1.T1.2:** Delete `src/ranch/trike-player.ts` and `tests/waddle/trike-player.test.ts`
  - [ ] **P1.T1.3:** Grep `src/`, `tests/`, `scripts/` for `trike-player` and `TrikePlayer`; the only surviving hit must be the guard assertion in `dino-player.test.ts`
- [ ] **P1.T2: Record the retirement** - covers: FR-3
  - [ ] **P1.T2.1:** Add a one-line note to `conductor/tech-stack.md` that `DinoPlayer` is the single player class, so a future track does not reintroduce a species shim
  - [ ] **P1.T2.2:** Confirm `pnpm verify` exits 0 and the test count drop matches the two deleted `it` blocks

## Phase 2: Decompose the viewer

- **Goal:** `src/viewer/main.ts` is under 300 lines of boot and wiring, with behaviour unchanged and all tests green.
- **Depends on:** Phase 1
- **Covers:** FR-1, FR-2, AC-1, AC-2, NFR-2, NFR-5
- **Touches:** `src/viewer/main.ts`, `src/viewer/scene.ts`, `src/viewer/hud.ts`, `src/viewer/loaders.ts`, `src/viewer/placeholders.ts`, `src/viewer/loop.ts`, `src/viewer/viewer.test.ts`, `tests/**/*.ts`
- **Verification:** `pnpm verify` plus a side-by-side screenshot against `cb12399` recorded in the phase evidence
- **Status:** pending

- [ ] **P2.T1: Extract scene construction** - covers: FR-1
  - [ ] **P2.T1.1:** Move renderer, camera, lights, ground, background, pixel-ratio and resize handling into `src/viewer/scene.ts`, exporting a `createScene()`-style factory returning the pieces the loop needs
  - [ ] **P2.T1.2:** Keep renderer settings byte-identical (`antialias`, `PCFShadowMap`, `NoToneMapping`, background `0x9fd4ef`, ground `0x7ec850`, `PerspectiveCamera(40)`)
- [ ] **P2.T2: Extract DOM chrome** - covers: FR-1, FR-2
  - [ ] **P2.T2.1:** Move status text, species list, walk-button state, POV nav wiring, hint-glow timing and rotate-hint handling into `src/viewer/hud.ts`
  - [ ] **P2.T2.2:** Keep every element id, class name and `aria-pressed` toggle identical so the existing DOM-chrome tests pass unchanged
- [ ] **P2.T3: Extract model loading and placeholders** - covers: FR-1, FR-2
  - [ ] **P2.T3.1:** Move `loadDinoPlayer`, `loadTrikePlayer`, `loadStegoPlayer`, `loadBrachioPlayer`, `DustPool` wiring and the `*_MODEL_URL` constants into `src/viewer/loaders.ts`
  - [ ] **P2.T3.2:** Move `createPlaceholderTrike`, `createPlaceholderStego`, `createPlaceholderBrachio`, `updatePlaceholderWalk` and the placeholder/shared colour constants into `src/viewer/placeholders.ts`
  - [ ] **P2.T3.3:** Update the import paths in `viewer.test.ts`, `dual-viewer.test.ts`, `trio-viewer.test.ts` and any other suite that imports these from `main.ts`; no assertion text changes
- [ ] **P2.T4: Extract the render loop** - covers: FR-1
  - [ ] **P2.T4.1:** Move the rAF loop, `dt` clamp, sleepy-weight propagation, blink/squash updates, pair-avoidance steering and dust emission into `src/viewer/loop.ts`
  - [ ] **P2.T4.2:** Confirm the loop reads the same state it did before — no reordering that changes which subsystem sees which `dt`
- [ ] **P2.T5: Slim `main.ts` and prove parity** - covers: FR-1, AC-1, AC-2, NFR-2
  - [ ] **P2.T5.1:** Reduce `src/viewer/main.ts` to boot: create scene, build HUD, kick off the three loads, start the loop, register lifecycle listeners
  - [ ] **P2.T5.2:** Prove `main.ts` is under 300 lines and contains no `new THREE.WebGLRenderer`, `new THREE.DirectionalLight`, or `DRACOLoader` construction (AC-1)
  - [ ] **P2.T5.3:** Capture a screenshot at each POV preset before and after the split and store both in the phase evidence, confirming they match
  - [ ] **P2.T5.4:** Confirm every extracted module is under 300 lines (AC-2)

## Phase 3: Repair the verify gate

- **Goal:** `pnpm verify` really checks formatting everywhere and blocks on coverage below 60%.
- **Depends on:** Phase 2
- **Covers:** FR-4, FR-5, FR-6, FR-7, AC-4, AC-5, AC-6, AC-7, NFR-4, NFR-5
- **Touches:** `package.json`, `.oxfmtrc.json`, `src/**/*.ts`, `tests/**/*.ts`, `scripts/**/*.ts`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`
- **Verification:** `pnpm verify` (must now include a coverage report) and a deliberate mis-format probe
- **Status:** pending

- [ ] **P3.T1: Make the formatter explicit and complete** - covers: FR-4, FR-5
  - [ ] **P3.T1.1:** Add `.oxfmtrc.json` with the project's chosen settings and confirm the "No config found" message disappears (AC-5)
  - [ ] **P3.T1.2:** Rewrite the `format` script to quote globs covering `src/**/*.ts`, `tests/**/*.ts`, `scripts/**/*.ts` plus the existing root config files, keeping the `public/draco` exclusion only if that directory still exists after Phase 4
  - [ ] **P3.T1.3:** Run the formatter once across the tree and commit the resulting formatting-only diff separately from logic changes
  - [ ] **P3.T1.4:** Prove the gate bites: temporarily mis-format a file under `tests/`, confirm `pnpm format --check` exits non-zero, then revert it (AC-4)
- [ ] **P3.T2: Turn coverage on** - covers: FR-6
  - [ ] **P3.T2.1:** Add `@vitest/coverage-v8` as a devDependency and configure the v8 provider in `vite.config.ts` with `thresholds.lines = 60`
  - [ ] **P3.T2.2:** Run `pnpm coverage` and record the measured global number in the phase evidence (AC-6)
  - [ ] **P3.T2.3:** If the measured number is below 60, add tests for the untested modules touched by this track rather than lowering the threshold; record the decision either way
- [ ] **P3.T3: Wire coverage into the gate** - covers: FR-7, AC-7
  - [ ] **P3.T3.1:** Replace the plain `test` step in the verify chain with the coverage run so a regression fails CI
  - [ ] **P3.T3.2:** Confirm `.github/workflows/ci.yml` still calls `pnpm verify` and needs no change, then confirm a full local `pnpm verify` exits 0 and its output contains the coverage table (AC-7)

## Phase 4: Ship one Draco decoder

- **Goal:** the app loads models through three's bundled decoder and the duplicate `public/draco/` payload is gone.
- **Depends on:** Phase 2
- **Covers:** FR-8, FR-9, AC-8, AC-9, NFR-3, NFR-6
- **Touches:** `public/draco/**`, `src/viewer/loaders.ts`, `vite.config.ts`
- **Verification:** `pnpm verify`, a browser load of all three dinos, plus a recorded before/after `dist/` size comparison
- **Status:** pending

- [ ] **P4.T1: Drop the redundant copy** - covers: FR-8
  - [ ] **P4.T1.1:** Remove the `setDecoderPath` call and the `DRACO_DECODER_PATH` constant from the loader module
  - [ ] **P4.T1.2:** Delete `public/draco/` (5 files) and remove its exclusion from the format/lint scripts if it is now moot
- [ ] **P4.T2: Verify the decoder still works** - covers: FR-8, NFR-3
  - [ ] **P4.T2.1:** Run `pnpm dev --host` and confirm Trike, Stego and Brachio all load and waddle, with the network panel showing no request to a `draco/` path (AC-8)
  - [ ] **P4.T2.2:** Reload with the network throttled to offline after first visit and confirm models still load from precache (NFR-3)
- [ ] **P4.T3: Measure the win** - covers: FR-9, AC-9
  - [ ] **P4.T3.1:** Build the base commit and this branch, record both `dist/` totals and the precache entry counts in the phase evidence (AC-9)
  - [ ] **P4.T3.2:** Confirm `dist/` holds exactly one decoder wasm/wrapper pair and the total dropped by at least 1.2 MB; if it did not, stop and report rather than trimming elsewhere

## Phase 5: Tell the truth about the ranch

- **Goal:** the installed app and the browser tab describe the trio ranch, with real installable icons.
- **Depends on:** Phase 3
- **Covers:** FR-10, FR-11, FR-12, AC-10, AC-11, AC-12, NFR-1
- **Touches:** `public/manifest.webmanifest`, `public/icons/**`, `index.html`, `scripts/build-icons.mjs`, `package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm verify` plus a manifest parse and a script-rerun cleanliness check
- **Status:** pending

- [ ] **P5.T1: Generate the icon set** - covers: FR-12, NFR-1
  - [ ] **P5.T1.1:** Add `sharp` as a devDependency only, and confirm it appears nowhere in the client bundle
  - [ ] **P5.T1.2:** Write `scripts/build-icons.mjs` to rasterize `public/icons/icon.svg` into `icon-192.png`, `icon-512.png`, a maskable 512 with safe-area padding, and `apple-touch-icon.png`
  - [ ] **P5.T1.3:** Run it, commit the PNGs, then re-run on a clean tree and confirm `git status` stays clean (AC-12)
- [ ] **P5.T2: Rewrite the manifest** - covers: FR-10, AC-10
  - [ ] **P5.T2.1:** Update `name`, `short_name` and `description` to describe Trike, Stego and Brachio on the ranch
  - [ ] **P5.T2.2:** Declare the 192 and 512 raster icons, add a `purpose: "maskable"` entry, and keep the SVG entry for scalable contexts
  - [ ] **P5.T2.3:** Parse the manifest and assert every icon `src` resolves to a file that exists (AC-10)
- [ ] **P5.T3: Update the document head** - covers: FR-11, AC-11
  - [ ] **P5.T3.1:** Replace the `<title>` and `meta[name=description]` with trio-accurate copy
  - [ ] **P5.T3.2:** Add an `apple-touch-icon` link and confirm it resolves (AC-11)
  - [ ] **P5.T3.3:** Confirm no other `index.html` change slipped in — layout, styles and element ids stay identical (NFR-2)

<!--
The primary appends after acceptance:
**Result:** verified
**Checkpoint:** <short-sha>
**Evidence:** conductor/tracks/20261029-ranch-housekeeping/verification/phase-<n>.md
-->

<!--
Review fixes are appended by `conductor-review` as:

## Phase R1: Review Fixes

- **Goal:** Resolve review findings ...
- **Depends on:** Phase 5
- **Covers:** review findings
- **Touches:** ...
- **Verification:** ...
- **Status:** pending

- [ ] **R1.T1: Resolve <finding ID>** - covers: <finding ID>
-->
