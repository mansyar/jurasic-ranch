# Phase 1 — Feedback decisions as pure data

- **Track:** `20261030-ranch-audible` — The Ranch Answers Back
- **Phase:** 1 — Feedback decisions as pure data
- **Date:** 2026-10-30
- **Branch:** `feat/20261030-ranch-audible`
- **Base commit:** `17d0c10`
- **Head commit:** `6a9f42c`
- **Result:** verified

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` (via `pnpm verify`) | 0 | oxlint clean across `src`, `tests`, `scripts` |
| static | `pnpm format --check` (via `pnpm verify`) | 0 | All 85 matched files already formatted |
| static | `pnpm typecheck` (via `pnpm verify`) | 0 | `tsrs --noEmit` reports no errors |
| unit | `pnpm coverage` (via `pnpm verify`) | 0 | 43 test files, 514 tests passed; 77.4 % lines overall (gate 60 %); `src/audio/feedback.ts` 100 % statements, 100 % lines, 93.33 % branches |
| static | `node scripts/check-audio-pack.mjs` (via `pnpm verify`) | 0 | 15 assets (1 music, 6 sfx, 8 voice), 853,289 B; catalog untouched |
| static | `pnpm build` (via `pnpm verify`) | 0 | Vite build succeeded; 45 precache entries |
| static | `node scripts/check-dist-clean.mjs` (via `pnpm verify`) | 0 | `dist` carries no dev-harness markers |
| phase | `pnpm verify` | 0 | Whole chain passed exactly as written in the brief |

Visual and smoke layers are not applicable to this phase: it adds one pure module
and its node tests, with no UI, no runtime audio path and no boot change.

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-4 | Ten taps on one species inside 1 s produce one coo, and two different species tapped together produce one coo. | `tests/audio/feedback.test.ts` → `createCooGate (P1.T2, FR-5, AC-4)`: “turns ten taps in one second into exactly one coo” (10 calls at 0–900 ms, exactly 1 non-null); “lets only one coo sound when two species are tapped together” (trike then stego then brachio at 500 ms, 1 coo); “allows a species again once its own catalog window elapses”; “takes each window from the catalog duration, not a fixed number”; “does not extend the window when a call is gated”; “reads the injected clock when a caller has no timestamp”. | **Earned.** The gate is the whole of AC-4; Phase 2 only routes button presses into it. |
| AC-5 | `hello` fires exactly once per session, not before the fade, and never while muted or after a mute-first gesture. | `tests/audio/feedback.test.ts` → `shouldGreet (P1.T3, FR-6, AC-5)`: “waits at least the music fade before saying hello” (`GREETING_DELAY_MS >= MUSIC_FADE_IN_MS`); “greets when the session is clear and the fade has passed”; “stays quiet while muted”; “stays quiet when the unlocking gesture was a mute control”; “stays quiet when the ranch has already greeted”; “stays quiet before the fade completes”; “stays quiet when suppressions overlap”. | **Policy half earned.** The decision rule is complete and tested; the session wiring, the `alreadyGreeted` flag and the actual `hello` dispatch belong to Phase 3. |
| AC-6 | A first press on Walk while locked plays one `tap` after unlock resolves, and none when unlock rejects. | `tests/audio/feedback.test.ts` → `createFirstPressSlot (P1.T4, FR-7, AC-6)`: “flushes an empty slot as null”; “holds one value and hands it back exactly once”; “replaces the first value instead of growing a queue”; “drops the held value on clear”; “accepts a value again after a flush or a clear”. | **Policy half earned.** The single-slot semantics are complete and tested; the `unlockAudio()` promise wiring and the reject path belong to Phase 3. |

Requirement coverage for this phase:

- **FR-5** — `createCooGate`: per-species window from the catalog, one coo
  across the trio, gated calls change nothing.
- **FR-6** — `GREETING_ASSET_ID`, `GREETING_DELAY_MS`, `shouldGreet` with all
  four suppression conditions.
- **FR-7** — `createFirstPressSlot`: exactly one held value, flush-once, clear.
- **FR-11** — the module is pure data and functions: no DOM, no Howler, no
  engine instance, no timers. `hud.ts` and `audio-controls.ts` import decisions
  from it in Phase 2/3 instead of owning rules.
- **NFR-3** — `src/audio/feedback.ts` is at 100 % statements / 100 % lines,
  above the ≥ 90 % target, and the global 60 % line floor still holds (77.4 %).

## Evidence paths

- `src/audio/feedback.ts` — `TapSurface`, `TAP_ASSET_ID`, `sfxForSurface`,
  `SpeciesId`, `cooAssetForSpecies`, `CooGate`, `createCooGate`,
  `GREETING_ASSET_ID`, `GREETING_DELAY_MS`, `GreetState`, `shouldGreet`,
  `FirstPressSlot`, `createFirstPressSlot`.
- `tests/audio/feedback.test.ts` — 20 tests across the four task describes
  (`sfxForSurface`, `createCooGate`, `shouldGreet`, `createFirstPressSlot`).
- `conductor/tracks/20261030-ranch-audible/verification/phase-1.md` — this
  report.

## Deviations

None. All code and tests are inside the phase's `Touches` paths
(`src/audio/feedback.ts`, `tests/audio/feedback.test.ts`); this evidence file is
the only file written outside them, as the brief allows. No barrel file was
added to `src/audio/`.

## Notes

- The brief forbids a speculative “silent surfaces” table, while the plan’s
  P1.T1.1 wording mentions “an explicit silent set for gear, close and slider”.
  The brief wins: the surface table is a private
  `Record<TapSurface, AudioAssetId>` and gear/Close/slider are silent by having
  no mapping at all. Phase 3 asserts that by showing those adapters never call
  the module.
- `./catalog.js` is imported for `AudioAssetId` **and** `getAudioAsset`, the one
  function the brief itself names in rule 2 (“that asset’s `durationSeconds`
  from `getAudioAsset()`”). `catalog.ts` is pure data with no DOM or audio
  import, so the module stays node-testable and loads nothing at import time.
- `MUSIC_FADE_IN_MS` is the only thing imported from `./engine.js`, as allowed.
  `engine.ts` reaches Howler only through its injected loader, so importing it
  in a node test creates no `AudioContext`. `GREETING_DELAY_MS` is exactly
  `MUSIC_FADE_IN_MS` (zero extra offset), so the greeting never talks over the
  fade without a second magic number.
- Window arithmetic is `Math.ceil(durationSeconds * 1000)` per species
  (1000 / 1200 / 1400 ms today) and is re-derived at every allowed call, so a
  re-cut mp3 keeps the gate correct. The only uncovered branch is the
  `asset === undefined` fallback in `cooWindowMs`, which cannot happen with an
  `AudioAssetId`.
- `createCooGate` takes the timestamp from the caller; the brief-mandated
  `options.now` clock is used only as the fallback when a caller passes a
  non-finite timestamp, so the option is live rather than dead API.
- Commits: `0c0215b` (P1.T1 surface table), `bcac667` (P1.T2 coo gate),
  `c61a9aa` (P1.T3 greeting policy), `6a9f42c` (P1.T4 first-press slot). This
  evidence file is committed separately.
