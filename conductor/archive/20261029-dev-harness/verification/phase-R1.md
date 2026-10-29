# Phase R1 verification — Review Fixes (F1–F7)

| Field | Value |
| --- | --- |
| Track | `20261029-dev-harness` |
| Phase | R1 — Review Fixes |
| Date | 2026-10-29 |
| Branch | `chore/20261029-dev-harness` |
| Base | `a3a90b3` (`conductor(review): Add review fixes phase`) |
| Head | `4268ca5` |
| Result | **verified** — all seven findings fixed, each with a test that failed first |

## Fix commits

| Commit | Task | Finding | Summary |
| --- | --- | --- | --- |
| `b044529` | R1.T1 | F1 (High) | `seededStreams(seed)` gives dust, per-dino movement and per-dino blink their own generator; `DinoPlayer` accepts `blinkRandom` |
| `9fdb7a6` | R1.T2 | F2, F6 | Species buttons toggle independently; solo presets moved to their own group; `aria-live` removed from the 5 Hz HUD |
| `9ae39b0` | R1.T3 | F3 | Pure `overlayTransforms()` in `harness-state.ts`, wired into `createOverlays`; `integrated.md` AC-7 row corrected |
| `930021c` | R1.T4 | F4 | `?dev=1` is read and checked **before** the dynamic `import()` of the harness |
| `4268ca5` | R1.T5 | F5, F7 | Wander/avoidance radii derived from `TRIKE_GAIT` and `AVOIDANCE_TRIGGER_METRES`; seeds validated with `/^-?\d+$/` |

## Commands

| # | Command | When | Exit | Output |
| --- | --- | --- | --- | --- |
| 1 | `pnpm test tests/dev/seed-determinism.test.ts` | red (F1) | 1 | 6 failed — `TypeError: seededStreams is not a function` |
| 2 | `pnpm test tests/dev/harness-panel.test.ts` | red (F2/F6) | 1 | 5 failed — `setSolo` hid all three, no `Solo` row, HUD carried `aria-live` |
| 3 | `pnpm test tests/dev/harness-state.test.ts` | red (F3) | 1 | 4 failed — `overlayTransforms is not a function` |
| 4 | `pnpm test tests/viewer/dev-harness-gate.test.ts` | red (F4) | 1 | `consults ?dev=1 before fetching the harness module` failed; other 5 passed |
| 5 | `pnpm test tests/dev/harness-panel.test.ts` | red (F5) | 1 | 2 failed — `expected undefined to be an instance of Mesh` (rings unnamed) |
| 6 | `pnpm test tests/dev/dev-options.test.ts` | red (F7) | 1 | `expected 12 to be null` for `?dev=1&seed=12abc` |
| 7 | `pnpm test tests/dev/seed-determinism.test.ts` | green (F1) | 0 | 7 passed, incl. the non-vacuous guard that a shared stream diverges |
| 8 | `pnpm test tests/dev/harness-panel.test.ts tests/dev/dev-options.test.ts` | green (F2–F7) | 0 | 2 files, 23 tests passed |
| 9 | `pnpm verify` | green (final) | 0 | lint, format `--check`, typecheck, 33 files / **312 tests**, build (25 modules), dist guard `dist clean: no dev harness markers in dist` |

`pnpm verify` sub-steps: `oxlint` 0 · `oxfmt --check` 0 ("All matched files use the correct format") · `tsrs --noEmit` 0 · `vitest run` 0 (33 files / 312 tests) · `vite build` 0 (precache 29 entries, 4428.59 KiB) · `node scripts/check-dist-clean.mjs` 0.

## Findings

| ID | Severity | Finding | Fix | Test that fails without the fix |
| --- | --- | --- | --- | --- |
| F1 | High | One `random` fed `DustPool`, every `DinoPlayer` and every `BlinkController`, so wall-clock-gated blink draws and GLB resolution order shifted positions; `?seed=42` could not reproduce poses (AC-9, FR-8) | `seededStreams(seed)` in `harness-state.ts`: dust from `seed ^ 0x9e3779b9`, dino *i* movement from `seed + 1 + i`, blink from `seed + 101 + i`, indices fixed by `DEV_TRIO_ORDER`. `main.ts` builds the streams once and hands each loader its own pair; `DinoPlayerOptions.blinkRandom` keeps blink draws off the movement generator | `tests/dev/seed-determinism.test.ts` — identical poses for two runs of seed 42; extra blinks leave positions identical; streams bind to dino id not construction order; consumers equal the documented `seededRandom` calls; dust/movement/blink never share a stream; a deliberately shared stream **does** diverge (guards the assertions from being vacuous) |
| F2 | Medium | Species buttons called `setSolo`, so one press hid the other two while `aria-pressed` claimed an independent toggle (FR-2) | Visibility row uses `showDino(id, !visible[id])` with `data-dev-show` buttons and `aria-pressed` bound per dino; separate **Solo** row (All/Trike/Stego/Brachio) keeps `setSolo` and marks a preset pressed only when it is the sole visible dino. Buttons stay ≥ 34 px with `focus-visible` styling | `tests/dev/harness-panel.test.ts` — hides exactly the pressed dino, restores on second press, `aria-pressed` per dino, solo presets in their own group, two independent hides |
| F3 | Medium | `createOverlays` was untested and `integrated.md` credited a non-existent overlay toggle test (FR-6, AC-7) | Pure `overlayTransforms(dinos) → {id, ringX, ringZ, arrowYaw}[]` in `harness-state.ts` filters hidden dinos and maps heading to yaw; `createOverlays.update` feeds it live `model.position` / `player.heading` and hides ring+arrow per dino. AC-7 row now cites the real tests | `tests/dev/harness-state.test.ts` (`overlayTransforms (FR-6, AC-7)`) — projects ring centre and yaw, follows a dino that wandered (yaw = heading), renders nothing for hidden dinos, does not mutate its input |
| F4 | Medium | The harness module was fetched regardless of `?dev=1` (FR-10) | `const devRequested = import.meta.env.DEV && new URLSearchParams(window.location.search).get("dev") === "1";` evaluated before `const dev = devRequested ? await import(...) : null;`. Production folds `DEV` to `false`, so neither the query read nor the chunk survives | `tests/viewer/dev-harness-gate.test.ts` — `consults ?dev=1 before fetching the harness module` asserts the pattern and that the query read's index precedes the `import()` |
| F5 | Low | `0.8` / `0.4` were copied literals instead of the steering constants (FR-6) | `DEV_WANDER_RADIUS_METRES = TRIKE_GAIT.wanderRadiusMetres`, `DEV_AVOIDANCE_TRIGGER_METRES = AVOIDANCE_TRIGGER_METRES`; rings named `DevWanderRing` / `DevAvoidanceRing:<id>` so their geometry is inspectable | `tests/dev/harness-panel.test.ts` (`overlay metrics come from the simulation (F5)`) — wander circle at the gait radius (and all three gaits agree), each avoidance ring at the trigger distance |
| F6 | Low | `aria-live="polite"` on a 5 Hz HUD flooded screen readers | Attribute removed; HUD is visual-only, with a comment explaining why | `tests/dev/harness-panel.test.ts` — `does not announce the 5 Hz HUD to screen readers` |
| F7 | Low | `Number.parseInt` made `?seed=12abc` seed 12 (FR-8) | `parseSeed` requires `/^-?\d+$/` before parsing; anything else (including `42.5`, `1e3`, `%2042`) is `null` while the harness still activates | `tests/dev/dev-options.test.ts` — `rejects a partially numeric seed instead of truncating it (F7)` |

## Deviations

None. Every change stayed inside the phase `Touches` list; `review.md`, `plan.md`, `metadata.json` and `spec.md` were not modified. New test helper `tests/dev/fake-dom.ts` and test file `tests/dev/harness-panel.test.ts` live under `tests/dev/**`.

## Notes

- No dependency, config or `index.html` change; `pnpm verify` including the dist guard is green at `4268ca5`.
- The determinism suite steps players in fixed `1/60 s` increments, so it asserts AC-9 without a browser. The real `?seed=42` reload check still needs one manual smoke run, since two full page loads cannot run headless here.
- `seededStreams` is re-exported from `harness.ts` next to `seededRandom`, so `main.ts` keeps a single import site for seeded access.
- Stream offsets are fixed constants (`0x9e3779b9`, `+1`, `+101`); changing them changes every seeded capture and must be treated as a breaking change for recorded snapshots.
