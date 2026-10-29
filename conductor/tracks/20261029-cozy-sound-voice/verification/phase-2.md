# Phase 2 — Starter Pack Assets & Offline Precache

- **Track:** `20261029-cozy-sound-voice` — Cozy Sound & Voice Foundation
- **Phase:** 2 — Starter Pack Assets & Offline Precache
- **Date:** 2026-10-29
- **Branch:** `feat/20261029-cozy-sound-voice`
- **Base commit:** `f2bd082`
- **Head commit:** `4e3c5e4` (this evidence file is committed separately)
- **Result:** verified, with one flagged quality gap — see [Known gaps](#known-gaps)

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| asset | `.conductor/kokoro-venv/Scripts/python.exe scripts/voice/generate.py` | 0 | 8 voice mp3s; report `.conductor/evidence/voice-report.json` |
| asset | `.conductor/kokoro-venv/Scripts/python.exe scripts/audio/synth-starter-pack.py` | 0 | 7 music/SFX mp3s; report `.conductor/evidence/starter-pack-report.json` |
| static | `pnpm lint` (via `pnpm verify`) | 0 | oxlint clean across `src`, `tests`, `scripts` |
| static | `pnpm format --check` (via `pnpm verify`) | 0 | 71 files match oxfmt config |
| static | `pnpm typecheck` (via `pnpm verify`) | 0 | `tsrs --noEmit` reports no errors |
| unit | `pnpm coverage` (via `pnpm verify`) | 0 | 35 files, 361 tests passed; 77.33 % lines (gate 60 %) |
| phase | `node scripts/check-audio-pack.mjs` (via `pnpm verify`) | 0 | `audio pack ok: 15 assets (1 music, 6 sfx, 8 voice), 859977 bytes` |
| static | `pnpm build` (via `pnpm verify`) | 0 | Vite build ok; PWA precache 45 entries (4266.38 KiB) |
| static | `node scripts/check-dist-clean.mjs` (via `pnpm verify`) | 0 | `dist` contains no dev-harness markers |
| phase | `pnpm verify` | 0 | Whole chain passed exactly as written in the brief |

The two asset commands were run once by the primary agent: the phase subagent's
shell only permits `git` and `pnpm verify`, so `python`, `ffmpeg`, `ffprobe`,
`curl`, and `node` invocations were reported as blockers and executed upstream.

Visual and smoke layers are not applicable to this phase: it adds binary assets,
a build-time guard, and one build-config line, with no UI or runtime audio. Both
acceptance exceptions that depend on the media itself — `parent-voice-review`
(warmth/no-scare, AC-13) and `tablet-touch-play` — stay human-only.

## Per-asset measurements

Byte sizes are from both generation reports; durations are `ffprobe` values and
loudness is measured integrated LUFS of the shipped mp3 (FFmpeg `ebur128`).

| Id | Path | Bus | Bytes | Duration (s) | Loudness (LUFS) | Source / license |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `music-kalimba` | `public/audio/music/kalimba-loop.mp3` | music | 641,193 | 40.000 | −16.4 | Original for Jurasic Ranch, dedicated CC0 1.0 |
| `coo-trike` | `public/audio/sfx/coo-trike.mp3` | sfx | 17,180 | 1.000 | −16.4 | Original, dedicated CC0 1.0 |
| `coo-stego` | `public/audio/sfx/coo-stego.mp3` | sfx | 20,106 | 1.200 | −16.4 | Original, dedicated CC0 1.0 |
| `coo-brachio` | `public/audio/sfx/coo-brachio.mp3` | sfx | 23,449 | 1.400 | −16.4 | Original, dedicated CC0 1.0 |
| `tap` | `public/audio/sfx/tap.mp3` | sfx | 3,805 | 0.180 | −70.0¹ | Original, dedicated CC0 1.0 |
| `heart` | `public/audio/sfx/heart.mp3` | sfx | 13,000 | 0.750 | −18.8 | Original, dedicated CC0 1.0 |
| `sparkle` | `public/audio/sfx/sparkle.mp3` | sfx | 15,508 | 0.900 | −16.4 | Original, dedicated CC0 1.0 |
| `hello` | `public/audio/voice/hello.mp3` | voice | 15,926 | 0.928 | −17.4 | Kokoro-82M `af_bella`, Apache-2.0 |
| `nom` | `public/audio/voice/nom.mp3` | voice | 18,852 | 1.112 | −16.4 | Kokoro-82M `af_bella`, Apache-2.0 |
| `all-done` | `public/audio/voice/all-done.mp3` | voice | 17,598 | 1.020 | −17.8 | Kokoro-82M `af_bella`, Apache-2.0 |
| `count-1` | `public/audio/voice/count-1.mp3` | voice | 13,836 | 0.790 | −18.9 | Kokoro-82M `af_bella`, Apache-2.0 |
| `count-2` | `public/audio/voice/count-2.mp3` | voice | 14,672 | 0.841 | −18.3 | Kokoro-82M `af_bella`, Apache-2.0 |
| `count-3` | `public/audio/voice/count-3.mp3` | voice | 14,672 | 0.845 | −17.6 | Kokoro-82M `af_bella`, Apache-2.0 |
| `count-4` | `public/audio/voice/count-4.mp3` | voice | 14,672 | 0.859 | −18.5 | Kokoro-82M `af_bella`, Apache-2.0 |
| `count-5` | `public/audio/voice/count-5.mp3` | voice | 15,508 | 0.903 | −22.1 | Kokoro-82M `af_bella`, Apache-2.0 |

¹ `tap` is 0.18 s of tick; `ebur128` gates it down to its −70 LUFS floor, so the
number is a measurement floor, not a level. The file was peak-normalized instead
(the pipeline falls back when integrated loudness is unmeasurable).

- **Pack total:** 859,977 bytes = 125,736 B voice + 734,241 B music/SFX
  (budget 2,500,000 B, so 34.4 % used).
- **Format:** every file mono 44.1 kHz 128 kbps mp3; music loop 40.0 s (30–60 s
  band); longest SFX 1.4 s; longest voice 1.112 s (2 s budget).
- **Precache:** 45 entries / 4,266.38 KiB (was 30 / 3,426.56 KiB before the 15
  audio files, +839.82 KiB), well under the 15 MB NFR-1 ceiling.
- **Dist total:** Vite and `vite-plugin-pwa` print only precached payload plus
  the emitted asset sizes, never a tree total, and the phase shell has no `du`.
  The measured offline payload is the 4,266.38 KiB precache total; the only
  non-precached files are `sw.js`, `registerSW.js` (0.13 kB) and the Workbox
  runtime.

Catalog `durationSeconds` now equals the measured duration rounded **up** to the
next centisecond (`0.845 → 0.85`, `1.112 → 1.12`), so a duck timer or overlap
budget can never cut a line short.

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | Exactly 1 music / 6 SFX / 8 voice; every entry resolves to a committed file; the pack check exits 0. | `node scripts/check-audio-pack.mjs` → `audio pack ok: 15 assets (1 music, 6 sfx, 8 voice), 859977 bytes`, exit 0; the same 15 paths are committed under `public/audio/`; `tests/scripts/check-audio-pack.test.ts` covers counts, missing/empty files, orphans, and the CLI exit codes. | Met |
| AC-2 | No Howl and no AudioContext before the first gesture. | Not applicable in this phase: it adds data files and a build-time guard, constructs no audio. Phase 3 (`src/audio/engine.ts`, `gesture.ts`) owns it. | Deferred |
| AC-5 | Second line stops the first; start ≤100 ms; each line ≤2 s with a 0.3 s tail. | Asset half verified: every voice file is ≤1.112 s and the pipeline appends a 0.3 s `apad` tail, so 2 s cannot be exceeded. Stop/start latency needs the Phase 3 engine. | Partial (assets) |
| AC-10 | Airplane-mode reload plays everything with no external requests. | `mp3` joined the Workbox `globPatterns`, so all 15 files are in the 45-entry precache manifest and no audio is fetched cross-origin. The airplane-mode play-through smoke belongs to Phase 5. | Partial (precache) |
| AC-12 | Pack ≤2.5 MB, precache <15 MB, CREDITS covers every asset. | 859,977 B pack; 4,266.38 KiB precache; 15-row CREDITS table with source/license/processing. | Met |
| NFR-1 | Pack ≤2.5 MB; precache <15 MB; 128 kbps; music 30–60 s. | Pack check + build figures above. | Met |
| NFR-3 | Voice normalized to −16 LUFS, ≤0.3 s trailing silence, no clipping or startling transients. | Tail: 0.3 s by construction; peaks limited by `loudnorm` TP −1.5 dBTP; soft coos and short taps, no roars. Loudness: **not met** — measured −16.4 … −22.1 LUFS, see Known gaps. | Partial |
| NFR-6 | Music/SFX CC0, Kokoro Apache-2.0, CREDITS row per asset, no unclear licenses. | Original synthesis dedicated CC0 1.0 in `CREDITS.md`; Kokoro-82M Apache-2.0; the model weights are not redistributed. | Met |

## Evidence paths

- `public/audio/music/kalimba-loop.mp3`, `public/audio/sfx/*.mp3` (6),
  `public/audio/voice/*.mp3` (8) — the committed pack.
- `scripts/voice/lines.json`, `scripts/voice/generate.py`,
  `scripts/voice/README.md` — voice contract, pipeline, model download and
  license notes.
- `scripts/audio/synth-starter-pack.py` — committed recipe for the music and SFX.
- `scripts/check-audio-pack.mjs`, `scripts/check-audio-pack.d.mts`,
  `tests/scripts/check-audio-pack.test.ts` — pack guard and its unit/CLI tests.
- `vite.config.ts` — `mp3` in the precache glob; `package.json` — `audio:check`
  and the guard wired into `verify` before `build`.
- `CREDITS.md` — per-asset source, license, and processing table.
- `.conductor/evidence/voice-report.json`,
  `.conductor/evidence/starter-pack-report.json` — raw generation reports
  (gitignored; byte sizes above come from them).

## Deviations

1. **`src/audio/catalog.ts` edited** (outside the phase `Touches`). The brief
   asked for declared durations to match the measured files; only the
   `durationSeconds` literals and the two doc comments changed. Phase 1 tests
   bound ranges, so they stay green.
2. **`scripts/audio/synth-starter-pack.py` added** (outside `Touches`). No
   reachable CC0 40 s kalimba loop with a verifiable seamless loop point, and no
   single clearly-licensed coo source, was available; the brief's fallback
   applies: original assets with the committed generation script, declared CC0,
   recorded in `CREDITS.md`.
3. **`scripts/check-audio-pack.d.mts` added** (outside `Touches`, inside
   `scripts/`). `tsrs --noEmit` type-checks tests that import the `.mjs` guard,
   so it needs a sibling declaration, mirroring `check-dist-clean.d.mts`.
4. **`auditPack` total semantics corrected.** The first revision summed every
   file under `public/` and reported 2,350,804 bytes; it now sums only the
   declared catalog paths (859,977 B), with a unit test and a 2.6 MB GLB in the
   CLI fixture proving non-audio files cannot consume the audio budget.
5. **`CREDITS.md` section added** — an NFR-6 deliverable of this phase.

## Known gaps

- **Voice loudness is off target (NFR-3).** The committed lines measure −16.4
  (`nom`) to −22.1 (`count-5`) LUFS against a −16 LUFS target; the four middle
  counts sit within 1.3 dB of each other, but `count-5` drops ~3.6 dB below
  `count-4`, which would be audible in the 1→5 sequence. Hypothesis: the
  sub-second lines fell through to `loudnorm`'s single-pass dynamic mode, which
  undershoots on short speech. `tap` shows the same fallback path. A
  deterministic fix is to measure the encoded file with `ebur128`, apply a fixed
  `volume=<target − measured>dB` plus a peak limiter, and re-render with
  `python scripts/voice/generate.py`; the durations would shift by <20 ms and the
  rounded-up catalog values would still hold. Needs a primary decision because
  it means re-rendering committed assets.
- **Loop seam on mp3.** The source loop is sample-accurate (bar-16 tails wrap
  into bar 1, no edge fades), but LAME adds encoder delay/padding. Browser
  decoders normally honour the gapless metadata; the Phase 5 offline smoke
  should confirm the seam is inaudible.
- **Dist total** is not printed by the toolchain; the 4,266.38 KiB precache
  figure is the measured offline payload.
- Commit trail: `821354d` voice pipeline, `cb99193` synthesis helper, `04570da`
  pack guard + precache, `f8e9dd0` CREDITS + verify wiring, `824172d` voice
  files, `a6323c7` music/SFX files, `affa7f7` budget fix, `4e3c5e4` catalog
  reconciliation, this evidence file.
