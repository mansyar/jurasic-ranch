# Phase 1 — Audio Catalog & Pure Mix Logic

- **Track:** `20261029-cozy-sound-voice` — Cozy Sound & Voice Foundation
- **Phase:** 1 — Audio Catalog & Pure Mix Logic
- **Date:** 2026-10-29
- **Branch:** `feat/20261029-cozy-sound-voice`
- **Base commit:** `d5d3573`
- **Head commit:** `492e56a`
- **Result:** verified

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` (via `pnpm verify`) | 0 | oxlint clean across `src`, `tests`, `scripts` |
| static | `pnpm format --check` (via `pnpm verify`) | 0 | 69 files match oxfmt config |
| static | `pnpm typecheck` (via `pnpm verify`) | 0 | `tsrs --noEmit` reports no errors |
| unit | `pnpm coverage` (via `pnpm verify`) | 0 | 34 test files, 341 tests passed; 77.22% lines (gate 60%) |
| static | `pnpm build` (via `pnpm verify`) | 0 | Vite build succeeded; 30 precache entries |
| static | `node scripts/check-dist-clean.mjs` (via `pnpm verify`) | 0 | `dist` contains no dev-harness markers |
| phase | `pnpm verify` | 0 | Whole chain passed exactly as written in the brief |

Visual and smoke layers are not applicable to this phase: it adds data and pure
functions only, with no UI, runtime audio, or boot-path change.

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | Catalog has exactly 1 music, 6 SFX, and 8 voice entries; every entry resolves to a committed file; pack check exits 0. | `tests/audio/catalog.test.ts` — exact counts, unique ids, spec ids per bus, loop-only-music, durations, deploy-relative `audio/<bus>/…` paths, and `assetUrl` joins under `/`, `/ranch/`, `/ranch`, `''`, and the default `BASE_URL`. | Partial — counts and path resolution verified here; committed files and the pack check belong to Phase 2. |
| AC-4 | Each SFX id plays on demand; rapid repeats respect the overlap cap with no console errors. | `tests/audio/mix.test.ts` — `canPlaySfx` allows 0–3 active instances, rejects 4 and above, and `SFX_OVERLAP_CAP` is 4. | Partial — cap logic verified; actual overlap needs the Phase 3 engine. |
| AC-6 | Mute toggles all sound instantly. | `tests/audio/mix.test.ts` — `musicGain` returns `0` when muted for every volume/duck combination, including mid-line. | Partial — mix-level mute verified; button, `aria-pressed`, and persistence belong to Phase 4. |
| AC-7 | Volume changes apply live and clamp to `0..1`. | `tests/audio/mix.test.ts` — `clampVolume` bounds, infinities, and NaN fallback; `musicGain` tracks 0.3/0.8/1.4 input as clamped live values. | Partial — clamp and live gain verified; slider and persistence belong to Phase 4. |

Requirement coverage for this phase: FR-1 (catalog and `assetUrl`), FR-5 (duck
arithmetic via `duckGain`/`musicGain`, `VOICE_TAIL_SECONDS`), FR-6 (mute→zero
gain), FR-7 (`DEFAULT_VOLUME`, clamping, live gain), NFR-5 (pure modules, no
timers or listeners, source-level purity test).

## Evidence paths

- `src/audio/catalog.ts` — `AudioBus`, `AudioAsset`, `AUDIO_CATALOG` (15
  entries), `AudioAssetId`, `getAudioAsset`, `assetUrl`.
- `src/audio/mix.ts` — `DEFAULT_VOLUME = 0.8`, `MUSIC_BUS_GAIN = 0.1`,
  `DUCK_FACTOR = 0.35`, `VOICE_TAIL_SECONDS = 0.3`, `SFX_OVERLAP_CAP = 4`,
  `clampVolume`, `duckGain`, `musicGain`, `canPlaySfx`.
- `tests/audio/catalog.test.ts` — catalog shape, lookup, base-path resolution,
  and a source-level guard that neither module imports Howler or touches the
  DOM.
- `tests/audio/mix.test.ts` — defaults, volume bounds/mute, duck/restore
  arithmetic, overlap cap.

## Deviations

None. All code and tests are inside the phase's `Touches` paths; this evidence
file is the only file written outside them, as the brief allows.

## Notes

- `durationSeconds` values are declared budgets: music 40 s (within 30–60 s),
  SFX 0.2–1.5 s, voice 0.7–1.2 s. Phase 2 validates the real files against
  them.
- Catalog paths carry no leading slash; `assetUrl` normalises the base to one
  trailing slash and strips a leading slash from the path, so a sub-path deploy
  joins without doubling.
- `catalog.ts` uses `as const satisfies readonly AudioAsset[]` so
  `AudioAssetId` is a literal union of the 15 ids for later `play(id)` typing.
- `clampVolume(NaN)` falls back to `DEFAULT_VOLUME` so a corrupt stored value
  cannot silence the ranch through a NaN gain.
- Commits: `cfdf305` (mix logic), `492e56a` (catalog); this evidence file is
  committed separately.
