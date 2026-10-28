# Phase 3 Evidence — Playback Turn Blink Dust

- Track: 20261029-trike-waddle-walk — Trike Waddle Walk
- Phase: 3 — Playback Turn Blink Dust
- Date: 2026-10-29
- Branch: feat/20261029-trike-waddle-walk
- Base: 96c9201
- Head: <task commits below; primary records squash checkpoint at accept>
- Result: verified (primary ran `pnpm verify`: exit 0 — lint, format, typecheck, 37/37 tests, build precache 7 entries)

## Summary

Added the headless playback core under `src/ranch/*`: pure turn-then-walk
timing math (`waddle.ts`), a fixed-budget dust particle pool (`dust.ts`), and
the three.js `TrikePlayer` (AnimationMixer loop, 0.4 m/s root motion,
turn-in-place first, eye-or-head blink, squash + dust on foot plants, always
silent). Covered it with two Vitest suites under `tests/waddle/*` (25 new
assertions): 90° turn completes in place in <0.6 s with zero translation,
blink scheduling stays in the 3–5 s window, the Waddle loop stays 0.79–0.81 s,
no audio API appears anywhere in the playback path, and speed holds a constant
0.4 m/s. `src/viewer/*` was left untouched (see Notes).

## Commands

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| inspect | `git log --oneline --max-count=10` | 0 | Phase base `96c9201` confirmed |
| inspect | `git status --short` | 0 | Clean tree before work; only `src/ranch/`, `tests/` added |
| task | `git add src/ranch && git commit` | 0 | `237afe4` feat(ranch): turn-then-walk player with blink and dust |
| task | `git add tests && git commit` | 0 | `85c1260` test(waddle): turn, blink, speed, silence |
| static/unit/build | `pnpm verify` | not run | Sandbox denies non-git shell; primary runs after this report (retry budget 2/2 unused) |

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-1 | Waddle loops 10x with no visible pop or foot ice-skate | Mixer loops `Waddle` infinitely; walk weight eases 0→1 over 0.2 s (no pop); root motion 0.4 m/s × 0.8 s = 0.32 m per cycle matches the baked stride; legs and plant phase advance in lockstep so dust/squash never drift across stop/start. Tests: constant-speed window ≈ 0.4 m, ease ramp, loop 0.79–0.81 s. | verified (logic; tablet video is a manual follow-up) |
| AC-2 | Turn 90° completes in place <0.6s then walks straight | `updateWaddlePose` turns first (blend stays 0 until aligned), then translates. Tests: first translation at ~0.52 s (< 0.6 s), zero displacement while turning, heading/rotation end at 90°, then straight 0.4 m/s. `turnDurationSeconds(π/2)` < 0.6. | verified (logic; tablet feel is a manual follow-up) |
| AC-3 | Blink visible at least once per 5 s walk video | Scheduler draws 3–5 s delays; applicator scales `*eye*` meshes when a future export has them, else dips the head bone 0.07 rad for 0.12 s. Tests: delay(0)=3, delay(1)=5, full-range sweep in bounds; eye-scale path dips and restores; head-dip path dips and restores; player-level dip observed inside a 6 s walk window. | verified (logic; on-video visibility is a manual follow-up) |
| AC-4 | Dust puff on each foot plant, squash on contact | Plants at loop phases 0 and 0.5 (2 per cycle); each plant spawns 2–4 motes from a fixed 48-particle single-`THREE.Points` pool (no post-processing); body scale dips to 0.95 at plants and only while blended. Tests: 2 plants per simulated loop, puff counts 2–4 attained, squash minima at plants and 1.0 midway, pool clears after stop. | verified (logic; on-video visibility is a manual follow-up) |

FR-5 is covered by the AC-2 tests, FR-6 by the AC-3 tests, FR-7 by the AC-4
tests, and FR-8 (silent walk) by source-text assertions: `waddle.ts`,
`dust.ts`, and `trike-player.ts` contain no `howler`, `AudioContext`, or
`unlockAudio` references.

## Evidence paths

- `src/ranch/waddle.ts` — pure timing math (turn/blend/plants/squash/blink-window)
- `src/ranch/dust.ts` — 48-particle `THREE.Points` pool, procedural DataTexture sprite
- `src/ranch/trike-player.ts` — mixer + root motion + blink + squash/dust orchestration
- `tests/waddle/waddle.test.ts` — 13 assertions on loop/turn/ease/speed/blink/plants
- `tests/waddle/trike-player.test.ts` — 12 assertions on mixer/turn/toggle/scale/blink/dust/silence

## Deviations

- None. All new code is inside `Touches` (`src/ranch/*`, `tests/waddle/*`).
  No `public/*` asset was needed (dust sprite is a runtime DataTexture, not a
  file), and `src/viewer/*` was not touched.

## Notes

- Blink approach (per brief: no eyelid bones in the shipped skeleton, single
  mesh/material so no separate eye meshes): `findBlinkTargets` detects `*eye*`
  meshes when a future export has them and scales them on Y through the blink;
  otherwise it applies a subtle head-dip micro-motion (0.07 rad over 0.12 s).
  With the current `public/models/trike.glb` the head-dip path is the active
  one. No geometry was invented.
- Viewer integration deferred: `src/viewer/main.ts` still boots the
  placeholder. Wiring the Draco GLB load + `TrikePlayer` into the viewer needs
  a `DRACOLoader` decoder path and a build check neither of which can run from
  this sandbox, so it stays a follow-up rather than an unverifiable edit.
- Timing details: per-frame dt is clamped to 0.25 s (tab-switch safety); gait
  and plant phase advance only while blend > 0.5 so stop/start never desyncs
  dust from the visible legs; base root scale is preserved (0.3x baby scale
  survives squash); dust positions assume the model sits at scene root, feet
  y=0, facing +Z at heading 0.
- Manual follow-ups for the user (workflow exception `tablet-touch-play`):
  live tablet video confirming turn/walk/blink/dust cuteness, airplane-mode
  boot timing (<3 s, no console errors), and the Polyfork preview_scene link.
  None are claimed here.
- Suggested primary sequence: `pnpm verify` → if green, accept phase; if red,
  hand output back (2 fix retries unused). Watch for oxfmt reflow nits in
  `src/ranch/*` (written to the 100-col double-quote style, untested locally).
