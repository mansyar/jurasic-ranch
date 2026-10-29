# Phase 2 — The child hears what they touch

- **Track:** `20261030-ranch-audible` — The Ranch Answers Back
- **Phase:** 2 — The child hears what they touch
- **Date:** 2026-10-30
- **Branch:** `feat/20261030-ranch-audible`
- **Base commit:** `61a0520`
- **Head commit:** `98c715d`
- **Result:** verified

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` (via `pnpm verify`) | 0 | oxlint clean across `src`, `tests`, `scripts` |
| static | `pnpm format --check` (via `pnpm verify`) | 0 | All 86 matched files already formatted |
| static | `pnpm typecheck` (via `pnpm verify`) | 0 | `tsrs --noEmit` reports no errors |
| unit | `pnpm coverage` (via `pnpm verify`) | 0 | 44 test files, 524 tests passed; 80.15 % lines overall (gate 60 %); `src/viewer/hud.ts` 78.57 % statements / 78.57 % lines / 65.62 % branches, above the > 50 % target |
| static | `node scripts/check-audio-pack.mjs` (via `pnpm verify`) | 0 | 15 assets (1 music, 6 sfx, 8 voice), 853,289 B; catalog untouched |
| static | `pnpm build` (via `pnpm verify`) | 0 | Vite build succeeded; 45 precache entries |
| static | `node scripts/check-dist-clean.mjs` (via `pnpm verify`) | 0 | `dist` carries no dev-harness markers |
| phase | `pnpm verify` | 0 | Whole chain passed exactly as written in the brief |

Visual and smoke layers are not applicable here: this phase wires dispatch and
markup. The real-device listening and the 1280×800 screenshot belong to Phase 4.

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | Pressing Walk, each POV pill and each mute button dispatches `tap` exactly once per press, asserted against a stubbed engine. | `tests/viewer/hud-audio.test.ts` → `Walk toggle (AC-1, FR-1)`: “plays exactly one tap on the press that starts walking” (`calls === [['tap']]`), “plays again on the press that stops walking” (`[['tap'], ['tap']]`). `POV pills (AC-1, FR-2)`: “plays a tap on each pill and again on the active pill” (Ranch re-press, Nest, Garden, Nest again → four `tap` calls, exact call array asserted). The engine facade is stubbed with `vi.mock('../../src/viewer/audio.js')` and `playSfx: vi.fn()`; no Howler. | **Walk + POV half earned.** The two mute buttons are `audio-controls.ts`, outside this phase's `Touches`; their tap ordering is P3.T3 (AC-2). |
| AC-3 | Tapping each species button dispatches `coo-trike` / `coo-stego` / `coo-brachio` respectively. | `tests/viewer/hud-audio.test.ts` → `species buttons (AC-3, FR-4)`: “plays each baby its own coo asset” clicks Trike, Stego, Brachio through the real listeners and asserts `[['coo-trike'], ['coo-stego'], ['coo-brachio']]` exactly. The id set is the catalog set, not a literal copied into the HUD. | **Earned.** |
| AC-9 | The species buttons measure ≥ 72 px in a 1280×800 landscape screenshot, each has a non-empty accessible name, and Brachio's icon is not a bone. | `tests/viewer/hud-audio.test.ts` → `species target and label contract (AC-9, P2.T4)`: reads `index.html`, finds exactly three `<button data-species=…>` elements inside `#species`, asserts the visible Trike/Stego/Brachio text is inside each button and that no `aria-label` duplicates it; reads the `#species button { … }` rule and asserts `min-inline-size: 72px`, `min-height: 72px` and `pointer-events: auto`; asserts the list holds `🦒 Brachio` and no `🦴`. | **DOM half earned; pixel half deferred to Phase 4.** A stylesheet declaration is not a measurement in a rendered 1280×800 viewport, so P4.T2.1 must capture the screenshot and measure the painted boxes. |
| FR-10 | The Brachio entry no longer uses the bone emoji. | `index.html` species list: `<button type="button" data-species="brachio">🦒 Brachio</button>`; the AC-9 test fails if `🦴` returns to the list. | **Earned.** |

Requirement coverage for this phase:

- **FR-1** — the Walk listener dispatches `sfxForSurface('walk')` on every click,
  before `setWalking(!walking)`, so the press that stops the walk still sounds.
- **FR-2** — the POV listener dispatches `sfxForSurface('pov')` on every click
  that passes the id guard, before `setPov(id)`, including a re-press of the
  active view.
- **FR-4** — the three list entries are `<button type="button" data-species>`
  elements with the visible emoji + word as the accessible name, a 72 px
  minimum target, and their own coo.
- **FR-5** — one `createCooGate()` instance per HUD, fed `performance.now()`;
  a `null` result is swallowed. Tests: three rapid Trike presses → one
  `coo-trike`; Trike then Stego in the same tick → only `coo-trike`.
- **FR-9** — one local `playFeedback` helper wraps `audioEngine().playSfx()` in
  `try`/`catch`; the test throws from the stub and asserts the Walk toggle still
  completes and nothing escapes the click handler.
- **FR-11** — `hud.ts` stays an adapter: asset choice, gating and species
  mapping all come from `src/audio/feedback.ts`; the HUD owns no table.
- **NFR-3** — `hud.ts` reports 78.57 % lines, above the > 50 % target for the
  adapter; the global line floor still holds at 80.15 %.

## Evidence paths

- `index.html` — species `<li>` wrappers now hold `data-species` buttons
  (`trike` / `stego` / `brachio`), the Brachio glyph is `🦒`, and the pill look
  moved from `#species li` to `#species button` with a 72 px minimum and
  `pointer-events: auto`.
- `src/viewer/hud.ts` — `playFeedback` guard; `sfxForSurface('walk')` and
  `sfxForSurface('pov')` dispatch; `isSpeciesId` narrowing; one `createCooGate`
  and the `#species button[data-species]` wiring.
- `tests/viewer/hud-audio.test.ts` — 10 tests: Walk (2), POV (1), species (1),
  coo gating (2), target/label contract (2), silent surfaces (1), failure path
  (1). DOM is a hand-rolled fake; the engine facade is mocked, not Howler.
- `conductor/tracks/20261030-ranch-audible/verification/phase-2.md` — this
  report.

## Deviations

| File | Reason |
| --- | --- |
| `tests/waddle/trio-viewer.test.ts` | Not in `Touches`. Its `trio ranch shell` test read `index.html` and asserted the old `🦴` glyph; that assertion now expects `🦒`. This is the only assertion changed, it is not weakened (an icon glyph is still required), and no other line in the file moved. The sibling status-copy assertion (line 321) was left alone because `walkStatusText` is unchanged. |

No other file outside `index.html`, `src/viewer/hud.ts` and
`tests/viewer/hud*.test.ts` was edited by this phase. `plan.md` appears in the
base-to-head diff only because the primary marked the phase in progress at
`9778980`; this phase did not write it.

## Notes

- **Engine access without touching `main.ts`.** `createHud` receives no play
  function and `main.ts` is not in `Touches`, so the HUD calls the existing
  `audioEngine()` facade from `./audio.js` at press time. Importing the module
  builds no engine; the singleton still appears on the first gesture, exactly as
  before, and `createHud`'s return shape is unchanged.
- **Imports differ slightly from the brief's illustrative block.** `TAP_ASSET_ID`
  and `cooAssetForSpecies` are not imported: `sfxForSurface('walk' | 'pov')`
  already returns the tap id, and the gate returns the catalog coo id, so
  importing either would be an unused binding that oxlint rejects.
- **FR-8 path used.** The gear, Close and slider live in
  `src/viewer/audio-controls.ts`, which this phase may not edit. As the brief
  allows, the test therefore builds a HUD with those elements alive in the fake
  document and asserts their clicks produce zero `playSfx` calls. Phase 3 owns
  the stricter adapter-level assertion.
- **One glyph, two surfaces.** The species list is now `🦒 Brachio`, but
  `walkStatusText(true)` still composes `🦴 Brachio walking`. The spec scopes
  FR-10 to “the species list” and plan P2.T1.2 to the entries, and an existing
  test pins the status copy, so it was not widened here. If the primary wants a
  single consistent Brachio glyph across the shell, that is a one-line follow-up
  (`src/viewer/hud.ts:31`) plus the `trio-viewer` status assertion.
- **Gate clock.** Tests drive a manual `performance.now` spy; the production
  path reads the real clock at press time. No timer, interval or rAF was added.
- **Tooling.** Direct `pnpm format --check` and a ranged `git log` invocation
  returned “permission denied”. Neither is an unmet need: the format layer runs
  inside `pnpm verify` and exited 0, and the commit map below comes from the
  commit's own output. They are not blockers.
- **Commits:** `7ed7ccf` (P2.T1 buttons + 72 px pill), `7f830e4` (P2.T2 Walk and
  POV taps), `210d784` (P2.T3 species coos through the gate), `98c715d` (P2.T4
  target/label contract). This evidence file is committed separately.

## Rework

- **Gap:** FR-10 / P2.T1.2. `walkStatusText(true)` still composed
  `🦕 Trike + 🦖 Stego + 🦴 Brachio walking`, so the child met the bone again
  every time the trio walked — the same surface class as the species list.
- **Change:** one glyph in `src/viewer/hud.ts` — that string now reads
  `🦒 Brachio`; copy, spacing, punctuation and the not-walking branch
  (`Tap Walk to waddle`) are untouched. `tests/waddle/trio-viewer.test.ts`
  swapped its `🦴` expectation for `🦒` in the same “requires an icon” style;
  no assertion was weakened or removed.
- **Commit:** `8d28e6b` `fix(viewer): use the long-neck glyph in the walk status`.
- **Verify:** `pnpm verify` exit 0 after the change — 44 test files, 524 tests,
  80.15 % lines overall, `src/viewer/hud.ts` 78.57 % lines, 15 audio assets,
  production build and dist-clean check green.
- **Supersedes** the earlier “One glyph, two surfaces” note above: the follow-up
  it described is done, so `🦴` no longer appears in `index.html` or
  `walkStatusText`.

## Primary verification

- Command: `pnpm verify`
- Exit code: 0
- Result: 44 test files / 524 tests passed; `src/viewer/hud.ts` 78.57 % lines (up from 6.17 %), `src/audio/feedback.ts` 100 %; 15 audio assets; build and dist-clean green.
- Diff reviewed: `git diff --name-only 9778980..HEAD` returned the three Touches paths plus the one declared deviation (`tests/waddle/trio-viewer.test.ts`, two glyph expectations) and this evidence file.
- Glyph check by code point: `hud.ts:34` holds U+1F995, U+1F996, U+1F992; no U+1F9B4 remains under `src/` or `index.html`.
- Rework attempt 1 was required: `walkStatusText` still carried the bone, which P2.T1.2 covers. Squash guard then passed over seven reported commits with no merges; phase squashed to `ab596ed`.
- Deferred by design: AC-9's pixel half moves to Phase 4.T2.1.