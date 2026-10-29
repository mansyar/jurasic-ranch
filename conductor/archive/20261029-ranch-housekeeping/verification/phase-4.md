# Phase 4 — Ship one Draco decoder

- **Track:** `20261029-ranch-housekeeping` — Ranch Housekeeping
- **Phase:** 4 — Ship one Draco decoder
- **Date:** 2026-10-29
- **Branch:** `refactor/20261029-ranch-housekeeping`
- **Base commit:** `e5338408cd1ac67eec8a7d1817fb355d8a5fd3c0`
- **Head commit:** `783a26a` (code commit `fd0917d`, test-scaffolding commit
  `783a26a`; this evidence file is committed separately at the end)
- **Result:** **verified with a deferred runtime check.** The duplicate payload is
  gone, `pnpm verify` is green (232/232, 26-entry precache), and `dist/` carries
  three's decoder once — no `dist/draco/`. The measured saving is **1,063,957
  bytes ≈ 1.0146 MiB**, so the plan's **1.2 MB target is missed by ≈136 kB**;
  that ceiling is the size of the deleted payload itself, and nothing else was
  trimmed to close the gap (P4.T3.2). The browser and offline checks (P4.T2.1,
  P4.T2.2 / AC-8, NFR-3) are **deferred to the primary** — this agent has no
  browser and recorded no runtime claim.

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| inventory | `git rm -r public/draco` | 0 | three files staged for deletion: `draco_decoder.js` (719,410 B), `draco_decoder.wasm` (285,747 B), `draco_wasm_wrapper.js` (58,763 B) = **1,063,920 B** |
| static + unit + build (Verification, after the loader change) | `pnpm verify` | 0 | oxlint clean; oxfmt **48 files** clean; `tsrs --noEmit` clean; vitest 23 files / **232 tests**; coverage **77.47% lines**; `vite build` 30 modules, precache **26 entries / 3,390.42 KiB** |
| static + unit + build (Verification, after the src-test scaffold cleanup) | `pnpm verify` | 0 | identical result: 232/232, 77.47% lines, 26 entries / 3,390.42 KiB |
| static + unit + build (Verification, final — the run reported below) | `pnpm verify` | 0 | oxlint clean; oxfmt 48 files clean; tsrs clean; 232/232; 77.47% lines; build 30 modules, precache 26 entries / 3,390.42 KiB |
| AC-8 mechanical half | `grep -r setDecoderPath src/` (native grep tool) | — | **no matches** |
| AC-9 build inventory | `read dist` and `read dist/assets` | — | no `dist/draco/`; decoder files only under `dist/assets/` |
| dist size — **denied** | `Measure-Object -InputObject (Get-ChildItem -Path dist -Recurse -File) -Property Length -Sum` | denied | sandbox refuses this shell; the branch `dist/` total below is therefore derived (see Size). Two earlier variants (`Get-ChildItem …` with/without a pipe) were denied too; not retried. |

`pnpm verify` was run exactly as written in the brief, three times (after the
loader change, after the src-test cleanup, and a final confirmation run); the
last run is the one tabulated above.

## DRACOLoader source finding (read, not assumed)

Read `node_modules/three/examples/jsm/loaders/DRACOLoader.js` (three `^0.186.1`):

- **Lines 17–24** declare four module-level constants, each an **absolute URL
  computed at module scope**: `WASM_BIN_URL`, `WASM_JS_URL`, `JS_URL` (all
  `../libs/draco/…`) and `DRACO_GLTF_CONFIG` (`../libs/draco/gltf/…`), every one
  `new URL( …, import.meta.url ).toString()`. Vite rewrites these at build time
  and emits the targets under `assets/`.
- **Lines 63–71, the constructor** already seeds the resolution state:
  `this.decoderPaths = { js: WASM_JS_URL, wasm: WASM_BIN_URL, dep_js: JS_URL }`.
  A freshly constructed loader therefore points at the bundled decoder with no
  configuration at all.
- **Lines 102–121, `setDecoderPath( path )`** is the *only* writer of
  `decoderPaths`. Its string form resolves `draco_wasm_wrapper.js`,
  `draco_decoder.wasm` and `draco_decoder.js` through
  `LoaderUtils.resolveURL( …, path )` — i.e. page-root/relative resolution
  happens **only when a path is supplied**. The object form replaces the URLs
  and nulls `dep_js`.
- **Lines 380–432, `_initDecoder()`** reads `this.decoderPaths` and fetches
  `decoderPaths.js` (text) plus `decoderPaths.wasm` (arraybuffer) for the wasm
  path, or `decoderPaths.dep_js` (text) for the JS fallback.
- **`GLTFLoader.js`** never calls `setDecoderPath`; its only interaction is
  `setDRACOLoader( dracoLoader )` (line 349), which stores the instance.

**Finding (unambiguous in the source):** with `setDecoderPath` removed the loader
uses the **bundled module-level URLs** — the *good* case. It does not resolve a
relative `draco_wasm_wrapper.js` against the page root, so no request to
`/draco/*` can be produced by the loader itself. The browser confirmation of that
(dev-server network panel, AC-8) is still the primary's to make; this phase
asserts only what the source shows.

**Second finding, recorded not acted on:** `DRACO_GLTF_CONFIG` (lines 21–24) is a
module-level `new URL` constant in the same file and is re-exported (line 772),
so Vite emits the *gltf* decoder variant (192.42 kB `.wasm` + 58.76 kB wrapper)
into `dist/assets/` even though nothing in this app imports it and our loader
path never fetches it. That is pre-existing at the base commit and outside this
phase's remit; per P4.T3.2 it was left alone. It is a ~251 kB follow-up
opportunity, not a saving claimed here.

## Size — what was actually measured

| Build | Precached entries | Precached total | `dist/` total |
| --- | --- | --- | --- |
| Base `e533840` (primary's measurement) | 29 | 4,429.44 KiB (4,535,747 B)\* | **4,553,881 B** |
| Branch `783a26a` (this phase) | **26** | **3,390.42 KiB (3,471,790 B)** | **≈3,489,924 B** (derived, see note) |
| Delta | **−3** | **−1,063,957 B** | **≈−1,063,957 B** |

- **Delta in bytes:** 1,063,957 B (precache, measured on this build's side and
  cross-checked against the primary's base total). The deleted payload is
  1,063,920 B, so the bundle also shed **37 B** of minified code — the
  `setDecoderPath( DRACO_DECODER_PATH )` call and the `DRACO_DECODER_PATH`
  string.
- **Delta in MiB:** 1,063,957 / 1,048,576 = **1.0146 MiB** (1.0640 MB decimal).
- The three precache entries that disappeared are exactly the three deleted
  files; every other entry (`index`/`howler`/`draco_*` under `assets/`,
  `index.html`, `manifest.webmanifest`, `registerSW.js`, `icons/*`, `models/*`
  GLBs) is unchanged in count.
- \* Base precache total is the 29-entry figure recorded in
  `verification/phase-2.md` (same 29-entry set); the base `dist/` total is the
  primary's **4,553,881 B** at `e533840`. The branch `dist/` total is derived as
  base − delta: everything in `dist/` is precached except `sw.js` and
  `workbox-*.js` (~18.1 kB together at the base), and those were not separately
  measured because the shell command for them was denied. The absolute branch
  total is therefore ±a few bytes of rounding in the KiB figure; the **delta** is
  solid.
- **Against the plan's target:** 1,200,000 B − 1,063,957 B = **136,043 B short
  (≈13%)**. The redundant payload *was* 1,063,920 B, so this change cannot reach
  1.2 MB. Nothing else was trimmed to try: no other asset dropped, `globPatterns`
  untouched (`wasm` still present for NFR-3 offline boot), no gzip/compression
  tricks, no decoder precache exclusion.

## Bundle inventory after the change

`read dist` → `assets/`, `icons/`, `models/`, `index.html`,
`manifest.webmanifest`, `registerSW.js`, `sw.js`, `workbox-9c191d2f.js`.
**No `dist/draco/` directory.**

`read dist/assets` → `draco_decoder-C32yEggz.wasm` (285.74 kB),
`draco_decoder-Z1_iN-Ht.wasm` (192.42 kB), `draco_decoder-fzg4nYZr.js`
(719.41 kB), `draco_wasm_wrapper-DxJM36Ib.js` (58.76 kB),
`draco_wasm_wrapper-fZCQGLGb.js` (58.45 kB), plus `howler` and `index`.

Two `.wasm` files remain because **three emits two decoder variants** (base +
`gltf/`) from its own `new URL` constants, as noted above — one *set* of three's
decoder, which is what FR-9 asks for ("exactly one decoder set"), and no
app-supplied copy. The plan/AC wording "one `draco_decoder*.wasm` pair" describes
the base variant only; it undercounts three's own emissions by one wrapper and
one wasm file, which were present at the base commit too.

## Acceptance criteria

| ID | Status | Evidence |
| --- | --- | --- |
| AC-8 — `public/draco/` absent, no `setDecoderPath` in `src/`, browser load of Trike/Stego/Brachio | **deferred to primary** (browser half) / **pass** (mechanical half) | `git ls-files` has no `public/draco/*`; `git rm -r public/draco` removed all three; `grep -r setDecoderPath src/` → no matches; `dist/` has no `draco/`. Runtime load not attempted: no browser tool, no network throttling. |
| AC-9 — one decoder set, total ≥1.2 MB smaller | **pass on "one set", measured, target not met** | no `dist/draco/`; decoder only under `dist/assets/`; measured delta **1,063,957 B (1.0146 MiB)** vs 1.2 MB target. Per P4.T3.2 the shortfall is reported, not papered over by trimming elsewhere. |
| NFR-3 — offline boot from precache | **deferred to primary** | `wasm`/`js` globs unchanged, so three's decoder + GLBs remain precached (26 entries); airplane-mode reload not attempted here. |
| NFR-6 — precache within 15 MB budget | **pass** | precache 3,390.42 KiB (≈3.31 MiB) vs `DRESSING_BUDGET_BYTES = 15_000_000`; ~4.5× headroom, improved by this change. |
| FR-8 — decoder loaded from a single copy | **pass (code)**; runtime half deferred | `loaders.ts` constructs `DRACOLoader`, calls `setDRACOLoader`, `dispose()`s; no decoder path is set and `DRACO_DECODER_PATH` is gone. |

## Files changed

- `src/viewer/loaders.ts` — dropped `DRACO_DECODER_PATH` and the
  `draco.setDecoderPath(...)` call; the loader doc now states why three's bundled
  decoder needs no configuration. `DRACOLoader` construction, `.preload()`
  absence, and the `dispose()` in `finally` are otherwise untouched.
- `public/draco/draco_decoder.js`, `public/draco/draco_decoder.wasm`,
  `public/draco/draco_wasm_wrapper.js` — deleted (`git rm -r`).
- `package.json` — removed exactly `--ignore-pattern "public/draco/**"` from
  `lint`; `format` untouched.
- `vite.config.ts` — workbox comment corrected; **`globPatterns` unchanged**
  (`wasm` kept).
- `src/viewer/viewer.test.ts`, `tests/waddle/dual-viewer.test.ts`,
  `tests/waddle/trio-viewer.test.ts`, `tests/waddle/stego-gait.test.ts` — see
  Deviations.

## Deviations

| File | Why |
| --- | --- |
| `src/viewer/viewer.test.ts` (outside Touches) | Asserted `setDecoderPath` was called with `/draco/`, which is now false. First flipped to `not.toHaveBeenCalled()`, then the mock property and assertion were removed entirely so `grep -r setDecoderPath src/` is empty (AC-8 is written as a `src/` grep and this test lives under `src/`). The no-path lock is redundant: `tests/waddle/*` assert the same on the same shared loader. |
| `tests/waddle/dual-viewer.test.ts`, `tests/waddle/trio-viewer.test.ts` (outside Touches) | Same `/draco/` assertion for Stego and Brachio; flipped to `not.toHaveBeenCalled()` — these are outside `src/`, so they keep the regression lock without polluting AC-8's grep. |
| `tests/waddle/stego-gait.test.ts` (outside Touches) | One comment said the clip is loaded "via the /draco/ decoder path", now false; reworded to three's bundled decoder. No assertion changed. |
| Second commit for P4.T1 (`783a26a`) | The src-test scaffold cleanup followed the first commit and `--amend` is prohibited, so it is a separate commit under the same task. |

## Notes for the primary

1. **`conductor/tech-stack.md:48` is now stale** — it still reads "oxlint …
   ignores `public/draco/**` + `scripts/vendor/**`". Not edited here (Conductor
   doc, primary-owned).
2. **The 1.2 MB figure in `spec.md` (FR-9 metric, AC-9, Overview) and
   `plan.md` (P4.T3.2) is unreachable** and should be corrected to the measured
   **1,063,957 B ≈ 1.01 MiB** — or the requirement restated as "the redundant
   copy is gone", which is what the change actually guarantees. The spec's
   Overview also says `public/draco/` is "1.31 MB"; the three files are
   1,063,920 B (1.01 MiB). Plan P4.T1.2 says "5 files"; there were 3.
3. **Deferred to the primary:** P4.T2.1 (dev server, all three dinos load and
   waddle, no `draco/` request in the network panel) and P4.T2.2 (throttle to
   offline after first visit, models still load from precache). This agent
   recorded both as `deferred` and made no runtime claim.
4. **Follow-up candidate (not done here):** the unused `gltf/` decoder variant
   three emits (~251 kB across `draco_decoder-Z1_iN-Ht.wasm` +
   `draco_wasm_wrapper-DxJM36Ib.js`) is precached and never fetched. Dropping it
   would need a build-time alias or a deliberate `setDecoderPath` to one variant
   — a separate change, outside P4.T3.2's "do not trim anything else".
5. **Absolute branch `dist/` total needs one command** the sandbox denied; see
   Blockers in the phase report.

## Evidence paths

- `conductor/tracks/20261029-ranch-housekeeping/verification/phase-4.md` (this file)
- `node_modules/three/examples/jsm/loaders/DRACOLoader.js` (lines 17–24, 63–71,
  102–121, 380–432, 772) — source finding
- `dist/` and `dist/assets/` listings, `dist/sw.js` precache manifest
  (gitignored build artifacts from the final `pnpm verify` run)
- `git log --oneline e533840..783a26a`, `git diff --stat e533840..783a26a`

## Primary verification

The subagent could not run a browser, so AC-8 and NFR-3 are proved here against
the production build (`vite preview`, port 5190), not the dev server.

### AC-8 — the bundled decoder is the one that runs

| Clause | Evidence | Status |
| --- | --- | --- |
| `public/draco/` absent | `Test-Path dist/draco` -> `False`; `git ls-files public/draco` empty | PASS |
| no `setDecoderPath` in source | `git grep -n setDecoderPath -- src` -> no matches | PASS |
| Trike, Stego and Brachio all load and waddle | status line read `Trike + Stego + Brachio walking`; two frames 0.4 s apart differed (34,783 B vs 34,692 B) so the trio is animating | PASS |
| no request to a `draco/` path | 23 requests, zero 4xx/5xx. The only decoder traffic was `GET /assets/draco_wasm_wrapper-DxJM36Ib.js` (200) and `GET /assets/draco_decoder-C32yEggz.wasm` (200) — three's bundled pair, i.e. exactly what FR-8 asked for | PASS |

This also settles the question the brief flagged as unguessable: with no decoder
path set, `DRACOLoader` uses its module-level `new URL('../libs/draco/...',
import.meta.url)` constants. It does **not** fall back to a page-root-relative
`draco_wasm_wrapper.js`, so there is no 404 risk in the removal.

### NFR-3 — offline boot after the change

Preview server killed (`Stop-Process` on PID 52264, `Invoke-WebRequest` then
refused the connection), page reloaded against a dead origin:

- `loadError` `null`, `loading` `false`, canvas present, title intact.
- 15 `.glb` requests plus the three dino models all completed with zero failures
  — served from the 26-entry precache.
- The scene rendered mid-waddle and the overlay still read "walking", so the
  persisted IndexedDB state and the cached GLBs both survived.
- Because the rigged models decoded, the cached decoder was exercised too: the
  decoder is genuinely in the precache, not just reachable while online.

Status: PASS.

### AC-9 — measured, not claimed

| Build | `dist/` total | Precache entries | Precache size |
| --- | --- | --- | --- |
| base `e533840` | 4,553,881 B | 29 | 4,429.44 KiB |
| branch `a759229` | 3,489,691 B | 26 | 3,390.42 KiB |
| **delta** | **-1,064,190 B (-1.015 MiB)** | -3 | -1,039.02 KiB |

`dist/assets` holds one decoder *pair in use* (wrapper + wasm) and `dist/draco`
is gone. The plan's "at least 1.2 MB" was an estimate that the deleted payload
(1,063,920 B) could never satisfy; per P4.T3.2 nothing else was trimmed to reach
it. Spec FR-9, AC-9 and the goal metric were corrected from 1.2 MB to 1.0 MiB to
match what the change can actually deliver.

### Follow-up debt (recorded, deliberately not fixed here)

`dist/assets` also contains three decoder files the browser never requests:
`draco_decoder.js` (719,410, the no-wasm fallback), `draco_decoder-Z1_iN-Ht.wasm`
(192,420) and `draco_wasm_wrapper-fZCQGLGb.js` (58,456) — the gltf variant plus
the JS fallback, all emitted by three and all precached. Together about 970 kB of
the 3.39 MiB precache is payload no modern tablet will fetch. Narrowing that
needs a build-level decision (custom `libs/draco` emission or a precache
manifest tuned to the used pair), which is out of this track's scope and belongs
with the release/tablet work.

### Stale references fixed

`conductor/tech-stack.md` still described the lint gate as ignoring
`public/draco/**`, and described the format gate as the old 4-file invocation.
Both lines were rewritten to match the shipped configuration.
