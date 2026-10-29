# Phase 3 — Unlock timing, greeting and mute ordering

- **Track:** `20261030-ranch-audible` — The Ranch Answers Back
- **Phase:** 3 — Unlock timing, greeting and mute ordering
- **Date:** 2026-10-30
- **Branch:** `feat/20261030-ranch-audible`
- **Base commit:** `665c086`
- **Head commit:** `8a4fb12`
- **Result:** verified

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| static | `pnpm lint` (via `pnpm verify`) | 0 | oxlint clean across `src`, `tests`, `scripts` |
| static | `pnpm format --check` (via `pnpm verify`) | 0 | All 87 matched files already formatted |
| static | `pnpm typecheck` (via `pnpm verify`) | 0 | `tsrs --noEmit` reports no errors |
| unit | `pnpm coverage` (via `pnpm verify`) | 0 | 45 test files, 537 tests passed; 80.34 % lines overall (gate 60 %); `src/viewer/audio.ts` 84.31 % statements / 84.31 % lines / 87.50 % branches; `src/viewer/audio-controls.ts` 94.51 %; `src/viewer/hud.ts` 78.57 % lines (target > 50 %) |
| static | `node scripts/check-audio-pack.mjs` (via `pnpm verify`) | 0 | 15 assets (1 music, 6 sfx, 8 voice), 853,289 B; catalog untouched |
| static | `pnpm build` (via `pnpm verify`) | 0 | Vite build succeeded; 45 precache entries |
| static | `node scripts/check-dist-clean.mjs` (via `pnpm verify`) | 0 | `dist` carries no dev-harness markers |
| phase | `pnpm verify` | 0 | Whole chain passed exactly as written in the brief |

Visual and smoke layers are not applicable here: this phase is timing, ordering
and failure behaviour, all provable without a rendered page. The audible
listening check and the 1280×800 capture stay in Phase 4.

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-2 | On muting, the mute tap is dispatched before `setMuted(true)`; on unmuting, after `setMuted(false)` — both mute buttons. | `tests/viewer/audio-controls.test.ts` → `mute ordering (AC-2, FR-3)`: a shared `calls` log records `onSfx` / `onMutedChange` / `onUnlock`. Each button (`mute`, then `panelMute`) is clicked twice through its real listener; the first click asserts `['sfx', 'muted', 'unlock']`, the second asserts `['muted', 'unlock', 'sfx']`, and both assert `onSfx` received `'tap'`. | **Earned** for both buttons. |
| AC-5 | `hello` plays once per session, never before the 400 ms fade, and never while muted or after a mute-first unlock. | `tests/viewer/audio-controls-feedback.test.ts` → `greeting wiring (AC-5, FR-6)`, five tests: “flushes the held press, then greets once after the fade” (nothing at `GREETING_DELAY_MS - 1`, `hello` at `GREETING_DELAY_MS`, and a second `afterUnlock` plus later frames add nothing); “keeps exactly one timer when unlock resolves twice” (`clock.pending() === 1`); “stays silent when the ranch is muted at fire time” (and unmuting later does not resurrect it); “stays silent after a mute-first unlock, even once unmuted”; “schedules nothing until the unlock resolves”. The policy itself is Phase 1's `tests/audio/feedback.test.ts`; this phase proves the wiring. | **Earned at the wiring level.** The physical audibility of the fade and the parent's listening check are AC-10 (Phase 4). |
| AC-6 | The press that unlocks audio is heard once, after unlock; a rejected/failed unlock stays silent and is not retried. | `tests/viewer/audio-controls-feedback.test.ts` → `first-press queue (AC-6, FR-7)`, four tests: locked `playFeedback('tap')` reaches no engine; after `isAudioUnlocked()` turns true, `flushFeedback()` delivers `['tap']` and a second flush delivers nothing; a second held press replaces the first (`['coo-trike']`); a still-locked flush drops the press; an unlocked press delivers immediately. Wiring: `src/viewer/main.ts` flushes in both `onUnlock` paths (`installGestureUnlock` and the mute button's `onUnlock`). | **Earned.** |
| AC-7 | Gear hold completion, the panel Close button and the volume slider produce no tap. | `tests/viewer/audio-controls.test.ts` → `silent surfaces (AC-7, FR-8)`: completes the 2 s gear hold, asserts the panel opened, clicks Close, then drives the slider `input`; `onSfx` has zero calls while `onVolumeChange` fired once. The HUD-level counterpart in `tests/viewer/hud-audio.test.ts` → `silent surfaces (FR-8)` clicks gear, Close and slider and asserts the `playFeedback` stub was never called. | **Earned.** |
| AC-8 | A forced engine failure produces no sound and lets no error escape. | `tests/viewer/audio-controls-feedback.test.ts` → `failure path (AC-8, FR-9)`: with `playSfx` throwing, `playFeedback` (locked hold and unlocked delivery) and `flushFeedback` are each asserted not to throw and to deliver nothing (`played === []`). `tests/viewer/hud-audio.test.ts` → `failure path (FR-9)` keeps the Walk toggle completing when the facade throws. | **Earned.** |

Requirement coverage for this phase:

- **FR-3** — one `toggleMute` helper calls `onSfx('tap')` before `setMuted(true)`
  and after `setMuted(false)`, with `unlock()` last in both directions; the tap
  is the same `'tap'` asset the catalog already ships.
- **FR-6** — `createUnlockFeedback().afterUnlock()` records `firstGestureWasMute`
  once from `engine.muted` at the first resolved unlock, starts one
  `setTimeout(GREETING_DELAY_MS)` for the session, and asks `shouldGreet` at fire
  time; only an approving verdict delivers `GREETING_ASSET_ID` and sets
  `alreadyGreeted`.
- **FR-7** — `playFeedback` holds at most one id while locked; `flushFeedback`
  hands it back once, only when unlocked; `disposeAudio()` clears the slot.
- **FR-8** — the gear hold, Close button, volume slider and the Escape path were
  left untouched, so `onSfx` is never reached from them; no silent call was
  added.
- **FR-9** — every facade delivery goes through one `deliver()` with `try` /
  `catch`; `flushFeedback` also guards on `isAudioUnlocked()` before delivering.
  `unlock()` in the controls keeps swallowing a rejected unlock.
- **NFR-3/NFR-5** — `src/viewer/audio.ts` 84.31 % lines, `audio-controls.ts`
  94.51 %, global 80.34 % lines; no new interval, rAF, listener or retry was
  added (the greeting uses the one permitted timer, injectable in tests).

## Evidence paths

- `src/viewer/audio.ts` — `playFeedback` / `flushFeedback` over a single
  `createFirstPressSlot<AudioAssetId>()`, `createUnlockFeedback` (one timer,
  `GreetingClock` injectable), `disposeAudio` now clears the slot.
- `src/viewer/main.ts` — one `createUnlockFeedback()` per boot; `afterUnlock()`
  after `await unlockAudio()` in both unlock paths; `onSfx` passes through
  `playFeedback`; `onUnlock` became `async` so the flush happens after the
  engine is ready.
- `src/viewer/audio-controls.ts` — `onSfx?(assetId: AudioAssetId)` option and
  the shared `toggleMute` ordering.
- `src/viewer/hud.ts` — exactly two lines: the import is now
  `playFeedback as dispatchFeedback` from `./audio.js` (the local helper keeps
  its name and `try`/`catch`) and the helper calls it.
- `tests/viewer/audio-controls-feedback.test.ts` — 10 tests: first-press queue
  (4), failure path (1), greeting wiring (5). Engine class stubbed, manual
  greeting clock, no jsdom.
- `tests/viewer/audio-controls.test.ts` — harness gained `onSfx`, `calls`, and 3
  tests: mute ordering (2, one per button) and silent surfaces (1).
- `tests/viewer/hud-audio.test.ts` — the facade mock now exports `playFeedback`
  instead of `audioEngine`; every existing HUD assertion still runs unchanged.
- `conductor/tracks/20261030-ranch-audible/verification/phase-3.md` — this
  report.

## Deviations

| File | Reason |
| --- | --- |
| — | None. The diff from the phase base contains only the seven `Touches` paths (`src/viewer/audio.ts`, `main.ts`, `audio-controls.ts`, `hud.ts`, `tests/viewer/audio-controls.test.ts`, `tests/viewer/audio-controls-feedback.test.ts`, `tests/viewer/hud-audio.test.ts`). |

`src/audio/*` was not edited. No product or design decision was needed.

## Notes

- **Alias, not a rename.** `hud.ts` keeps its local `playFeedback` helper name
  (and its `try`/`catch`) as the brief requires, so the module binding is
  imported as `dispatchFeedback`; calling the bare `playFeedback` inside that
  arrow would recurse into itself.
- **`firstGestureWasMute` is recorded at the first resolved unlock**, exactly as
  the brief defines it: `engine.muted` at that moment. A session that starts
  persisted-muted and whose first press is *unmute* therefore records `false`
  and may greet after the fade; a session that unlocks on the *muting* press
  records `true` and stays silent for good. Suppression by the policy's `muted`
  flag and by `alreadyGreeted` is unchanged.
- **A still-locked flush drops the press** rather than keeping it, so a failed
  load cannot grow a queue or replay an old tap on a later unlock.
- **Commit mapping:** `b10df22` (P3.T1 — facade queue/flush, greeting helper and
  its wire-level tests; the helper has to live in `audio.ts` with the slot),
  `86faf42` (P3.T2 — `main.ts` wiring, one instance per boot), `3f0eb1f`
  (P3.T3 — adapter option, ordering and the adapter-level silence assertion in
  the same test file), `8a4fb12` (P3.T4 — HUD redirect and its test mock). This
  evidence file is committed separately.
- **No `.catch` was added** around `unlock()` or `unlockAudio()`; the greeting
  relies on `isAudioUnlocked()` at fire time, as the brief requires.
- **Tooling.** Direct `pnpm format --check`, `pnpm format`, and `git log` with a
  revision argument returned “permission denied”. None is an unmet need: the
  format layer runs inside `pnpm verify` and exited 0 on the final tree, and the
  commit list above comes from each commit's own output. They are not blockers.
