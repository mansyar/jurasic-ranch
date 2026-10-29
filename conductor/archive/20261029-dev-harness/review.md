# Review — Dev Harness for Debugging & Verification

- **Track:** 20261029-dev-harness
- **Type:** chore
- **Branch:** chore/20261029-dev-harness
- **Range:** cb12399..HEAD (excluding `conductor/`)
- **Date:** 2026-10-29
- **Verdict:** PASS WITH FINDINGS

## Summary

The gating is genuinely production-safe: the harness is behind `import.meta.env.DEV`, the only static reference is an erased `import type`, the dist guard survives minification (`__ranch` and `data-dev-panel` are property access and a string literal), and the CLI exit codes are proven by spawning the process. `forceBlink` is additive and leaves the 3–5 s cadence intact, and the bridge mirrors the Walk button and POV pills rather than inventing a second source of truth.

Round 1 found two criteria failing as written; both are now closed (see History). The single seeded generator is shared by wander jitter, dust and blink, while blink draws are wall-clock gated and seeded in GLB-resolution order, so `?seed=42` cannot reproduce poses (AC-9). And the panel exposes only solo presets, so a dino cannot be hidden independently from the UI (AC-2). Two evidence defects follow from the same sloppiness: the overlay code has no test and `integrated.md` cites a test that does not exist, and the seeded determinism was marked covered by tests that only prove mulberry32 is deterministic in isolation.

## Verification

| Layer | Command | Result | Evidence |
| --- | --- | --- | --- |
| static | `pnpm lint` | pass | 0 warnings |
| static | `pnpm format --check` | pass | all matched files |
| static | `pnpm typecheck` | pass | tsrs clean |
| static | `pnpm build` | pass | 25 modules, 29 precache entries |
| static | `node scripts/check-dist-clean.mjs` | pass | `dist clean` |
| unit | `pnpm test` | pass | 31 files / 290 tests |
| unit | `pnpm coverage` | unavailable | `@vitest/coverage-v8` not installed (pre-existing); adequacy assessed behaviorally |
| smoke | `/?dev=1` live probe | partial | panel + `snapshot()` verified; rAF never fires in the review pane, so frame-driven behaviour unobserved |

## Requirements

| ID | Status | Evidence |
| --- | --- | --- |
| FR-1 | covered | `dev-options.ts` gate, `main.ts` import+install gate, live no-`?dev=1` probe |
| FR-2 | partial | solo presets only; independent toggle reachable via `__ranch.show` but not the panel (F2) |
| FR-3 | covered | `nextPausedFrame` + 15-frame test; loop returns on `dt <= 0` |
| FR-4 | covered | `formatHud` tests; HUD reads `renderer.info` at 4 Hz (live numbers unobserved) |
| FR-5 | covered | `blink.test.ts` (6 tests); POV/hint proven live |
| FR-6 | partial | overlays implemented but untested (F3) |
| FR-7 | covered | `buildSnapshot` tests; live shape and 0.6928 m separation |
| FR-8 | partial | seeded stream shared across consumers (F1) |
| FR-9 | covered | guard wired after build, CLI exit codes proven, survives minification |
| FR-10 | partial | no DOM/global/scene change without `?dev=1`, but the dev server still fetches the module (F4) |
| NFR-1 | covered | null-check only on the hot path; HUD at 4 Hz |
| NFR-2 | covered | panel clears the 72 px controls at both breakpoints; real buttons with focus-visible |
| NFR-3 | covered | no network from the harness |
| NFR-4 | partial | verify green; coverage gate unmeasurable (pre-existing) |
| AC-1 | covered | gate test + live reload |
| AC-2 | partial | F2 |
| AC-3 | covered | `applySolo` tests + live solo |
| AC-4 | covered | `nextPausedFrame` test; live observation blocked |
| AC-5 | partial | unit only |
| AC-6 | partial | blink unit-proven; dust/sleepy reasoned from code |
| AC-7 | missing | F3 |
| AC-8 | covered | `snapshot.test.ts` + live distances |
| AC-9 | missing | F1 |
| AC-10 | covered | CLI exit 0/1/1 tests + `pnpm verify` log |
| AC-11 | partial | 234 pre-existing tests green; precache +0.34 KiB, not literally unchanged |

## Findings

### High

**F1 — the seeded stream cannot reproduce poses** (`src/viewer/main.ts:583`, `src/ranch/dino-player.ts:95`)
One generator feeds `DustPool`, every `DinoPlayer` wander jitter/dust, and every `BlinkController`. Blink draws are wall-clock gated and seeded in GLB-resolution order, so extra blink draws shift the values that drive `steerInsideWanderRadius` and `puffCountForPlant`. Two loads of `?seed=42` therefore diverge with wall time and load order, so AC-9 and FR-8's purpose fail.
*Fix:* give each consumer its own generator derived from the seed by fixed index (dust, dino *i*, blink *i*), never from resolution order; keep blink's stream separate from the movement stream. Add a regression that builds the same seeded trio twice, steps an equal number of frames and asserts identical positions.
*Test gap:* no two-run determinism test exists.

### Medium

**F2 — no independent per-dino toggle in the panel** (`src/dev/harness.ts:332`)
Species buttons call `setSolo(key)`, so pressing Trike also hides Stego and Brachio while `aria-pressed` claims an independent toggle. FR-2 asks for both independent toggles and solo presets.
*Fix:* species buttons call `showDino(id, !visible)` with `aria-pressed` bound to that dino; add a separate "Solo" group for All/Trike/Stego/Brachio presets.

**F3 — overlays are untested and the evidence is misattributed** (`src/dev/harness.ts:193`, `verification/integrated.md:31`)
`createOverlays` has no test; `integrated.md` credits `harness-state.test.ts` with an overlay toggle test that does not exist. AC-7 is unverified.
*Fix:* extract the position projection (`overlayTransforms(dinos) → ring x/z + arrow yaw`) into `harness-state.ts`, unit-test it against fixed positions and visibility, and correct the evidence row.

**F4 — the harness module is fetched without `?dev=1`** (`src/viewer/main.ts:583`)
The import is gated on `import.meta.env.DEV` only, so every dev boot pays a module round trip even when the harness is not requested, contradicting FR-10's "no additional network request".
*Fix:* read the query parameter first (`new URLSearchParams(location.search).get("dev") === "1"`) and only then import; update the gate test to assert the parameter is checked before import.

### Low

**F5 — overlay geometry duplicates gameplay constants** (`src/dev/harness.ts:31`): `0.8` and `0.4` are copied instead of imported from `AVOIDANCE_TRIGGER_METRES` and the gait's `wanderRadiusMetres`; a retune silently falsifies every measurement taken from the rings.
**F6 — `aria-live="polite"` on a 5 Hz HUD** (`src/dev/harness.ts:400`): floods a screen reader; drop it or use `<output>` with a 1 s throttle.
**F7 — junk seeds are accepted** (`src/dev/dev-options.ts:32`): `seed=12abc` parses as 12; validate `/^-?\d+$/` first and add the test.

## Plan compliance

Phases ran in order with checkpoints (`76ba7b2`, `b566a4b`, `b8737ed`, `d5bf60c`) and Touches were respected; no gameplay constant, palette or kid-facing UI changed. P2.T2.1 promised "visibility/solo buttons" and delivered presets only (F2); P3.T1.3's AC-7 evidence points at a test that does not exist (F3).

## Out of scope / accepted

- Precache grows 0.34 KiB from production-side null-check plumbing; accepted as within noise for AC-11, which is a spec-wording problem rather than a defect.
- Coverage gate unmeasurable because `@vitest/coverage-v8` is not installed (pre-existing).

## Debt

- Live frame-driven confirmation (step, sleepy ZZZ, fps HUD, movement) is owed on a real browser window; the review pane never composites frames. To be re-checked by a human before release.
- **Trio coexistence is draw-tuned (ranch, not harness).** Round 2 showed that the merged 30 s trio guarantee depends on wall-clock blink draws being pulled from the movement stream: with a clean stream the trike reaches 1.118 m against the 1.09 m in-frame bound, and relaxing that bound exposes a 0.079 m minimum separation against the 0.25 m bar. `tests/waddle/trio-wander.test.ts` still passes because this track deliberately left gameplay RNG semantics untouched. A dedicated ranch track should re-tune the avoidance trigger/nudge or the wander boundary so the guarantee holds on clean streams.

## History

| Round | Verdict | Findings | Fixed |
| --- | --- | --- | --- |
| 1 | BLOCK | 1 High, 3 Medium, 3 Low | F1-F7 fixed in Phase R1 (`cb3a82f`) |
| 2 | PASS WITH FINDINGS | F1-GLUE Medium, F1-RESIDUAL Medium, F1-DEFAULT Low, DOC-SYNC Low | all four closed in Phase R2 (`6e26ca6`): wiring guard with a falsification run, canonical `&pause=1` URL, enforcement moved to the call site, evidence corrected |

### Round 2 notes

- F1's fix was verified as real, and the determinism test was confirmed non-vacuous: it fails when a stream is shared and when two dinos are aliased to one generator.
- F1-DEFAULT was closed by enforcement rather than by a default change. Switching the default to `Math.random` is correct in principle but changed which draws `DinoPlayer` consumes, which broke a merged-track guarantee — the minimal fix is the wiring guard plus a comment on the option.
- F1-RESIDUAL is accepted: determinism is defined for a fixed frame sequence, and the canonical URL now says so.

## Doc sync

pending
