# Review — Ranch Housekeeping

- **Track:** `20261029-ranch-housekeeping`
- **Type:** refactor
- **Branch:** `refactor/20261029-ranch-housekeeping`
- **Range:** `cb123990caa72c10b7a99651e040a5e58eb50e62..87f0c60`
- **Date:** 2026-10-29
- **Verdict:** PASS WITH FINDINGS

## Summary

The refactor is what it claims to be. The Phase 2 move was rebuilt statement by
statement against `cb12399:src/viewer/main.ts` and holds: no dropped statement, no
changed constant, no reordered per-frame update. `scene.ts` reproduces every
renderer value verbatim (antialias, `PCFShadowMap`, `NoToneMapping`, `0x9fd4ef`,
`CircleGeometry(6,32)` / `0x7ec850`, `PerspectiveCamera(40, …, 0.1, 50)`,
pixel-ratio cap) and `loop.ts` keeps the exact order sleepy update → hint strip →
reduced motion → per-player sleepy weight → overlay → trio/pair steering →
per-species update-or-placeholder → render, with `dt = Math.min(clock.getDelta(),
0.25)`.

The Phase 3 write pass is verifiably cosmetic (sampled `pov.ts`, `dressing.ts`,
`sleepy.ts`, `sleepy-ui.ts`: quote flips only). The Phase 4 claim checks out
against `node_modules/three/examples/jsm/loaders/DRACOLoader.js:17-24,67-71` —
the constructor seeds its module-level `new URL('../libs/draco/…')` paths, so
dropping `setDecoderPath` is correct rather than a silent root-relative 404. The
gates now bite: 48 files format-checked, coverage in `verify`, 60 % line floor.

Four Low findings remain, none of them behavioural.

## Verification

| Layer | Command | Result | Evidence |
| --- | --- | --- | --- |
| Full gate | `pnpm verify` | pass, exit 0 | head `87f0c60` |
| Lint | `oxlint` | pass | gate transcript |
| Format | `oxfmt --check` | 48 files correct | gate transcript |
| Types | `tsrs --noEmit` | pass | gate transcript |
| Unit | `vitest run` | 23 files, 232 tests | gate transcript |
| Coverage | v8 | 77.47 % lines (717/923), floor 60 | gate transcript |
| Build | `vite build` | 396 ms, `dist/` 3,489,691 B | gate transcript |
| Visual | POV screenshots, base vs P2 head | Nest/Garden byte-identical, Ranch 0.999490 | `verification/phase-2.md` |
| Offline | reload with the server dead | 23 requests, 0 failures | `verification/phase-4.md` |
| Install | manifest + icons in a real browser | 4 icons 200, SW controlling | `verification/phase-5.md` |

## Requirements

Every FR/NFR/AC from `spec.md`, with the task that implements it and the evidence
that verifies it.

| ID | Requirement (short) | Implemented by | Verified by | Status |
| --- | --- | --- | --- | --- |
| FR-1 | `main.ts` is boot and wiring only | P2.T1–T5 | 171 lines, AC-1 grep, 232 tests, SSIM parity | covered |
| FR-2 | Focused modules, none over 300 lines | P2.T1–T4 | 74 / 194 / 143 / 294 / 188 lines | covered |
| FR-3 | Shim and its test gone, coverage kept | P1.T1 | guard at `dino-player.test.ts:487`, stride assertion at `:149` | covered |
| FR-4 | Format check covers src/tests/scripts and fails on drift | P3.T1.2, T1.3 | probe A 0 files vs probe B 47, exit 1 | covered (see F2) |
| FR-5 | `.oxfmtrc.json` pins settings, no warning | P3.T1.1 | config present, warning gone | covered |
| FR-6 | Coverage installed and fails below 60 % | P3.T2.1, T2.2 | 50.80 % failed → 77.47 % passes | covered |
| FR-7 | `verify` runs coverage | P3.T3.1 | `package.json:17` | covered |
| FR-8 | One decoder, no `setDecoderPath`, models load | P4.T1.1 | grep clean, only `/assets/draco_*` requested | covered |
| FR-9 | `dist/` at least 1.0 MiB smaller | P4.T1.2, T3 | 3,489,691 vs 4,553,881 B | covered |
| FR-10 | Manifest names the trio, declares raster/maskable/touch icons | P5.T2.1, T2.2 | manifest parse, 4 icons resolve | **partial** (F1) |
| FR-11 | Title, description and apple-touch link | P5.T3.1, T3.2 | `index.html:12,16,17`, 2-line diff | covered |
| FR-12 | Icon script deterministic and committed output matches | P5.T1.2, T1.3 | clean tree on re-run, identical SHA-256 | covered |
| NFR-1 | No new runtime dependency | P5.T1.1 | `sharp` dev-only, absent from `dist/` | covered |
| NFR-2 | No visual or behaviour change outside title/manifest | P2, P5 | SSIM 1.000000 / 1.000000 / 0.999490 | covered |
| NFR-3 | Offline boot still works | P4.T2.2 | dead server, 23 requests, 0 failures | covered |
| NFR-4 | Gate green, no material slowdown | P3–P5 | exit 0, build 396 ms | covered |
| NFR-5 | Styleguide met on changed lines | P2, P3 | lint/typecheck, `singleQuote: true` | covered |
| NFR-6 | Precache inside 15 MB | P4, P5 | 30 entries, 3,425.76 KiB | covered |
| AC-1 | `main.ts` under 300, no renderer/light/DRACOLoader | P2.T5.2 | 171 lines, grep 0 | covered |
| AC-2 | Modules under 300, tests pass unchanged except imports | P2.T5.4 | 232 pass; two assertions rewritten, ten guards re-pointed (reported) | **partial** |
| AC-3 | No shim, no importer, tests green | P1 | `ls-files` empty, grep, 232 pass | covered |
| AC-4 | At least 40 files checked, mis-format fails | P3.T1.4 | probe A vs B | covered |
| AC-5 | No "No config found" | P3.T1.1 | transcript | covered |
| AC-6 | Coverage at least 60 % and fails when lowered | P3.T2.2 | 77.47 % | covered |
| AC-7 | `verify` shows a coverage table and exits 0 | P3.T3.1, T3.2 | transcript | covered |
| AC-8 | No `public/draco/`, no `setDecoderPath`, models load | P4 | `ls-files` empty, browser 200s | covered |
| AC-9 | One decoder set, at least 1.0 MiB smaller | P4.T3 | two three-emitted wasm variants remain (−1,064,190 B) | **partial** (F4) |
| AC-10 | Manifest parses, trio named, 192/512/maskable | P5.T2.3 | parse + browser | covered |
| AC-11 | Title and description name the trio, touch icon resolves | P5.T3 | `index.html`, 200 `image/png` | covered |
| AC-12 | Icon script idempotent on a clean tree | P5.T1.3 | clean `git status` before and after | covered |

The branch base ran **234** tests and the head runs **232**; the two that are gone
are exactly the shim's `it` blocks that FR-3 asked for. No other test was lost.

## Findings

### Low

**F1 — `public/manifest.webmanifest:11-36`: no apple-touch entry in the manifest.**
FR-10 asks the manifest to declare the raster, maskable *and* apple-touch icons.
`apple-touch-icon.png` exists (180×180) but is referenced only from
`index.html:16`, so the requirement is half-met — the iOS path works, the
requirement does not. *Fix:* add
`{"src":"/icons/apple-touch-icon.png","sizes":"180x180","type":"image/png","purpose":"any"}`
to the array and assert it in `viewer.test.ts`. *Requirement:* FR-10.

**F2 — `package.json:14`: the repaired format gate cannot see a `.mjs` script.**
The globs are `"src/**/*.ts" "tests/**/*.ts" "scripts/**/*.ts"`, so
`scripts/build-icons.mjs` — 122 lines, added by Phase 5 — escapes the gate that
this track exists to make honest. *Fix:* add `"scripts/**/*.mjs"` and run the
write pass once. *Requirement:* FR-4 (spirit), AC-4.

**F3 — evidence bookkeeping drift.** `verification/integrated.md:29-60` maps
FR-11, FR-12 and NFR-1/2/5/6 to other requirements' text, and states
`main.ts = 158` (actual 171 — `Measure-Object -Line` undercounts; `phase-2.md`
says 181, which was the pre-format count). `metadata.json:18-24` reports
`tasks_done: 15/18` with all 18 boxes ticked, `doc_sync: "pending"` after the sync
commit, and `last_checkpoint: 608de48` while head is `87f0c60`. *Fix:* re-key the
table, correct the counts, set `tasks_done: 18`, `doc_sync: "synced"`,
`last_checkpoint: 87f0c60`. *Requirement:* process (`workflow.md` quality gates).

**F4 — `spec.md:110,138`: AC-9's "exactly one `draco_decoder*.wasm` pair set"
is not literally satisfiable.** `dist/assets` keeps two wasm decoders (the base
pair in use plus the `gltf/` variant three emits unconditionally) and the JS
fallback. The change is correct — no app-supplied copy ships — but the criterion
reads as a file count, so the evidence has to argue with its own spec. *Fix:*
restate the clause as "no app-supplied decoder; every decoder file present is
emitted by three". *Requirement:* AC-9, FR-9.

## Plan compliance

| Phase | Result / Checkpoint / Evidence | Tasks | Within `Touches` | Deviations |
| --- | --- | --- | --- | --- |
| 1 | present / `a3c5118` / `phase-1.md` | 5/5, no port needed | yes, plus `tech-stack.md` (reported) | reported |
| 2 | present / `20fae35` / `phase-2.md` | 10/10, capture closed by primary | yes (12 files) | 4 reported, accepted |
| 3 | present / `09c131b` / `phase-3.md` | 9/9, T2.3 correctly not triggered | yes, plus `.gitignore`, `vite.config.ts` (reported) | 5 reported |
| 4 | present / `ec54a06` / `phase-4.md` | 6/6, runtime half closed by primary | mostly — `package.json` lint-pattern removal is outside `Touches` and was listed under files changed, not deviations | 4 reported |
| 5 | present / `608de48` / `phase-5.md` | 8/8, the `blocked` header is superseded by the primary section | yes, plus `pnpm-workspace.yaml`, `viewer.test.ts` (reported) | 1 reported |
| Integration | `integrated.md` | — | yes | see F3 |

No task was silently dropped. Every `[x]` has an artefact in the tree.

## Out of scope

- The unused `gltf/` decoder variant and the JS fallback (~970 kB) that three
  emits and precaches; removing them needs a build-level decision.
- `THREE.Clock` deprecation warning on boot (pre-existing).
- POV presets framing badly at desktop aspect ratios (pre-existing UX).
- CI on Node 24 against `engines: >=22.12.0` (pre-existing drift).
- `tests/**` quote churn and `scripts/vendor/**.d.ts` reformatting (generated or
  vendored).

## Debt

| Item | Severity | Reason not fixed here | Issue |
| --- | --- | --- | --- |
| `hud.ts` 6.94 % and `loop.ts` 28 % line coverage | Medium | needs a DOM/canvas harness, out of this track's scope | pending batch decision |
| `package.json` description still says "Track 1: Trike Waddle Walk" | Low | one-line copy fix, not in any phase's `Touches` | pending batch decision |
| Pre-squash task commits (`c823d4b`, `6e4e913`, `ca8880e`, …) are not ancestors of the branch | Low | expected under `phase_squash: true`; evidence SHAs resolve from the object store only | n/a |

## History

| Round | Verdict | Critical | High | Medium | Low | Fixed |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS WITH FINDINGS | 0 | 0 | 0 | 4 | — |

## Doc sync

pending
