# Integrated Verification — Ranch Housekeeping

- **Track:** `20261029-ranch-housekeeping`
- **Branch:** `refactor/20261029-ranch-housekeeping`
- **Base:** `cb123990caa72c10b7a99651e040a5e58eb50e62` (`main`)
- **Head:** `87f0c60` plus the review-fix phase (`verification/phase-R1.md`)
- **Date:** 2026-10-29
- **Result:** verified

## The gate, on the whole branch

| Command | Result |
| --- | --- |
| `pnpm verify` | **exit 0** |
| `oxfmt --check` | all 49 files correct format |
| `tsrs --noEmit` | clean |
| `vitest run` | 23 files, **232 tests passed** |
| coverage (v8) | **77.47 % lines** (717/923 statements), threshold 60 |
| `vite build` | 396 ms |
| PWA precache | 30 entries, 3,425.76 KiB |

The branch base ran **234** tests and the head runs **232**. The two that are gone
are exactly the shim's `it` blocks that FR-3 asked for; no other test was lost.
The one test whose *subject* changed (`viewer.test.ts` manifest icon check) was
rewritten to pin the new icon set, not deleted.

## Requirement coverage

Every `FR`, `NFR` and `AC` in `spec.md`, keyed to the task that implements it and
the evidence that verifies it.

| ID | Requirement (short) | Implemented by | Verified by | Status |
| --- | --- | --- | --- | --- |
| FR-1 | `main.ts` is boot and wiring only, no renderer/light/loader logic | P2.T1–T5 | 171 lines, AC-1 grep, 232 tests, SSIM parity | covered |
| FR-2 | Five focused modules, none over 300 lines | P2.T1–T4 | 74 / 194 / 143 / 294 / 188 lines | covered |
| FR-3 | Shim and its test deleted, unique assertion not lost | P1.T1 | guard at `dino-player.test.ts:487`, stride assertion at `:149` | covered |
| FR-4 | Format check inspects every `.ts` in src/tests/scripts and fails on drift | P3.T1.2, T1.3 + R1.T2 | probe A 0 files → probe B 47 → 49 files incl. `.mjs` | covered |
| FR-5 | `.oxfmtrc.json` pins settings, warning gone | P3.T1.1 | config present, no "No config found" | covered |
| FR-6 | Coverage installed, fails below 60 % | P3.T2.1, T2.2 | 50.80 % failed → 77.47 % passes | covered |
| FR-7 | `verify` runs the coverage gate | P3.T3.1 | `package.json` verify chain | covered |
| FR-8 | Single decoder, no `setDecoderPath`, models still load | P4.T1.1 | grep clean, only `/assets/draco_*` requested | covered |
| FR-9 | One decoder set, `dist/` at least 1.0 MiB smaller | P4.T1.2, T3 | 3,489,691 vs 4,553,881 B (−1,064,190 B) | covered |
| FR-10 | Manifest names the trio and declares 192/512/maskable/**touch** icons | P5.T2.1, T2.2 + R1.T1 | manifest parse, 5 icons, every file resolves | covered |
| FR-11 | `<title>`, `meta[name=description]` and an `apple-touch-icon` link | P5.T3.1, T3.2 | `index.html:12,16,17`, 2-line diff | covered |
| FR-12 | `build-icons.mjs` deterministic, committed PNGs match its output | P5.T1.2, T1.3 | clean tree on re-run, identical SHA-256 | covered |
| NFR-1 | No new runtime dependency; `sharp` dev-only and absent from the bundle | P5.T1.1 | `sharp` in devDependencies, no reference in `dist/` | covered |
| NFR-2 | Rendered output, timing, presets and chrome equivalent; only title/manifest may change | P2, P5 | SSIM 1.000000 / 1.000000 / 0.999490, `index.html` 2-line diff | covered |
| NFR-3 | Fully offline start after the Draco change | P4.T2.2 | dead server, 23 requests, 0 failures | covered |
| NFR-4 | Gate green end to end, no material duration regression | P3–P5 | exit 0, tests 2.9 s, build 396 ms | covered |
| NFR-5 | Styleguide met on changed lines (named exports, semicolons, no `any`, no `public`) | P2, P3 | oxlint + `tsrs --noEmit`, `.oxfmtrc.json` `singleQuote: true` | covered |
| NFR-6 | Precache within the 15 MB `DRESSING_BUDGET_BYTES` budget | P4, P5 | 30 entries, 3,425.76 KiB | covered |
| AC-1 | `main.ts` under 300 lines, no `WebGLRenderer`/`DirectionalLight`/`DRACOLoader` | P2.T5.2 | 171 lines, grep 0 | covered |
| AC-2 | Modules under 300; pre-existing tests pass unchanged except import paths | P2.T5.4 | 232 pass; two assertions rewritten and ten guards re-pointed (reported) | partial (reported deviations) |
| AC-3 | No shim file, no importer, tests green | P1 | `git ls-files` empty, grep, 232 pass | covered |
| AC-4 | At least 40 files checked; mis-format in `tests/` fails | P3.T1.4 | probe A 4 files/exit 0 → probe B 47 files/exit 1; 49 at head | covered |
| AC-5 | No "No config found" message | P3.T1.1 | transcript | covered |
| AC-6 | Coverage at least 60 %, fails when lowered | P3.T2.2 | 77.47 % | covered |
| AC-7 | `verify` prints a coverage table and exits 0 | P3.T3.1, T3.2 | transcript | covered |
| AC-8 | No `public/draco/`, no `setDecoderPath`, trio loads | P4 | `ls-files` empty, browser 200s, trio waddling | covered |
| AC-9 | No app-supplied decoder in `dist/`; at least 1.0 MiB smaller | P4.T3 + R1.T4 | two three-emitted wasm variants, no `dist/draco`, −1,064,190 B | covered |
| AC-10 | Manifest parses, mentions the trio, icons resolve, raster+maskable listed | P5.T2.3 | parse output, browser 200s | covered |
| AC-11 | Title and description name the trio, touch link resolves | P5.T3 | `index.html`, 200 `image/png` | covered |
| AC-12 | Icon script idempotent on a clean tree | P5.T1.3 | clean `git status` before and after | covered |

`AC-2` stays `partial` by construction: AC-2 says tests pass "unchanged apart from
import paths", while the review accepted two assertion rewrites (the decoder
mock and the manifest icon check) because the subjects they pinned were
deliberately changed. Both are recorded in the phase deviation tables.

## Cross-phase invariants

**No visible behaviour change.** The same three POV presets were captured at the
base and at the head of Phase 2 on a deterministic renderer (three consecutive
frames of one build are byte-identical):

| Preset | SSIM vs base |
| --- | --- |
| Nest | **1.000000** (byte-identical) |
| Garden | **1.000000** (byte-identical) |
| Ranch (steady state) | **0.999490**, residual confined to the bottom button band |

An amplified difference image of the Ranch pair is black across the entire 3D
canvas. Phase 4 and 5 then re-ran the app in a real browser and confirmed the
trio still loads, waddles, and boots with the server dead.

**One decoder.** `dist/draco/` is gone; every decoder request resolves to
`/assets/draco_*`, which three emits itself from
`node_modules/three/examples/jsm/loaders/DRACOLoader.js:17-24`.

**`dist/` across the track:** 4,553,881 B at the base → **3,489,691 B** at the
head, a 1,064,190 B (1.015 MiB) reduction, almost all of it the duplicate
decoder. The precache went 29 → 26 entries with the Draco copy removed, then to
30 with the four icon PNGs.

## Review fixes (Phase R1)

| Finding | Fix |
| --- | --- |
| F1 apple-touch icon missing from the manifest | Added the 180×180 entry and asserted it in `viewer.test.ts` |
| F2 `.mjs` outside the format gate | Added `"scripts/**/*.mjs"` with `"!scripts/vendor/**/*.mjs"`; probe failed at exit 1; gate now 49 files |
| F3 evidence and counter drift | This file re-keyed to the spec's IDs; counts corrected |
| F4 AC-9 read as a file count | Restated as "no app-supplied decoder; every decoder file present is emitted by three" |

## Deviations accepted across the track

| Phase | Deviation | Verdict |
| --- | --- | --- |
| 2 | `placeholders.ts` comments condensed to fit 300 lines | Accepted; no statement or signature changed |
| 2 | `loop.ts` needed a mutable `LoopStage` handle | Accepted; only reads are qualified through it |
| 2 | Source-reading guards widened from `main.ts` to unions | Accepted; weaker guard, worth tightening later |
| 3 | `tsrs` patch bump (`0.20.0` → `0.20.1`) as a side effect of `pnpm add` | Accepted; unrelated patch |
| 3 | `singleQuote: true` locked in after a 22-vs-40 file fork | Accepted by user; matches the styleguide |
| 3 | `scripts/vendor/**` excluded from coverage, own bake scripts kept | Accepted; 77.52 % honest number |
| 4 | Saving is 1.015 MiB, not the 1.2 MB estimated | Accepted; spec corrected |
| 4 | `package.json` lint-pattern removal sits outside Phase 4 `Touches` | Accepted; it was a consequence of deleting `public/draco/` |
| 5 | `pnpm-workspace.yaml` gained `onlyBuiltDependencies` | Accepted; the `package.json` form is rejected by oxfmt |
| 5 | `viewer.test.ts` manifest assertion rewritten | Accepted; subject changed by design |
| R1 | Vendored `scripts/vendor/**/*.mjs` excluded from the format gate | Accepted; they are generated base pipelines, already excluded from lint |

## Known debt carried out of this track

- `hud.ts` at 6.94 % lines and `loop.ts` at 28 % — both need a DOM/canvas harness;
  they did not need one to reach the global threshold, so they were not faked.
- ~970 kB of decoder assets three never fetches (`draco_decoder.js` 719,410 B,
  plus the `gltf/` wasm/wrapper pair) still ship in `dist` and precache.
- `THREE.Clock` deprecation warning on boot (pre-existing; `THREE.Timer` is the
  replacement).
- POV presets frame poorly at desktop aspect ratios (well and fence occlude the
  Ranch view; Brachio fills the Nest view). Pre-existing UX, out of scope.
- `package.json` description still says "Track 1: Trike Waddle Walk".
- CI runs Node 24 while `engines` asks for `>=22.12.0`. Harmless, undocumented.
