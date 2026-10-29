# Review — Cozy Sound & Voice Foundation

- **Track:** `20261029-cozy-sound-voice`
- **Type:** feature
- **Branch:** `feat/20261029-cozy-sound-voice`
- **Range:** `1a96d6b0ba63f3f9e08d0a9592a3ad746fe4960e..e0659bb`
- **Date:** 2026-10-29
- **Verdict:** PASS

## Summary

The track replaces the silent audio stub with a typed 15-asset pack, a lazily
loaded Howler engine, first-gesture unlock, voice ducking with newest-wins,
six SFX with an overlap cap, persisted mute/master volume, a 2 s parent gate,
offline precache, and a dev-only audio bridge. It stays inside the product
constraints: no runtime TTS, no accounts, no external requests, ≤2.5 MB pack,
controls ≥72 px with icon + word.

Round 1 reviewed the feature as a BLOCK: a failed Howl could still be played
(F1), leaving music ducked or SFX slots consumed; the parent panel claimed
`aria-modal` without trapping focus or hearing Escape outside the panel (F2);
the latency metric measured synchronous dispatch (F3); a missing audio element
aborted the whole boot (F4); AC-14 was signed off on a throttled software
renderer (F5); and five Low documentation/ordering/tail issues followed. All ten
were fixed in Phase R1 with regression tests. Round 2 confirmed every fix and
raised one Medium evidence wording issue (SFX dispatch presented as onset) and
four Lows (stale comments, a latent post-unlock `configure` contract, and a
missing test for the boot fallback). All five were fixed in Phase R2 and
`pnpm verify` is green at the reviewed head. The only remaining gaps are the
two human/hardware acceptance criteria, recorded as debt for the Track 8 device
pass.

## Verification

| Layer | Command | Result | Evidence |
| --- | --- | --- | --- |
| Full gate | `pnpm verify` | pass, exit 0 | head `e0659bb` |
| Lint | `oxlint` | pass | gate transcript |
| Format | `oxfmt --check` | 81 files correct | gate transcript |
| Types | `tsrs --noEmit` | pass | gate transcript |
| Unit | `vitest run` | 40 files, 455 tests | gate transcript |
| Coverage | v8 | 81.73 % lines (1,615/1,976), floor 60 | gate transcript |
| Build | `vite build` | 288 ms, precache 45 / 4,274.94 KiB | gate transcript |
| Pack | `check-audio-pack` | 15 assets, 853,289 B | gate transcript |
| Dist | `check-dist-clean` | no dev harness markers | gate transcript |
| Offline | server stopped, SW reload | shell + 15 audio files 200, same origin | `verification/phase-5.md` |
| Device | 60 fps / parent-voice | not run | debt, Track 8 |

## Requirements

| ID | Requirement (short) | Implemented by | Verified by | Status |
| --- | --- | --- | --- | --- |
| FR-1 | Typed catalog, 1 music / 6 SFX / 8 voice, deploy-relative paths | P1.T1, P2.T3 | catalog unit suite, pack check | covered |
| FR-2 | First gesture unlocks exactly once, no AudioContext before | P3.T2, R1.T5.1 | gesture/engine suites, browser `Howler undefined` before tap | covered |
| FR-3 | Looping music, fade-in, hidden pause/resume | P3.T1 | engine visibility/fade suites, offline browser | covered |
| FR-4 | Six SFX with overlap cap | P3.T1.3 | overlap suite, browser 20 taps | covered |
| FR-5 | Eight lines, newest wins, duck 0.35, 0.3 s tail, ≤2 s | P3.T1, R1.T6 | engine/mix suites, re-rendered mp3s | covered |
| FR-6 | 72 px mute, icon + word, aria, persisted | P4.T2/T3 | audio-controls/settings suites | covered |
| FR-7 | Master volume 0..1, default 0.8, live, persisted | P4.T2/T3 | settings/audio-controls suites, browser clamp | covered |
| FR-8 | 2 s hold gate, panel, Escape, focus return, no links | P4.T1/T3, R1.T2 | gate/audio-controls suites | covered |
| FR-9 | Missing asset: one warning, silence, boot continues | P3.T1.1, R1.T1/T4, R2.T4 | failure suite, boot fallback assertion | covered |
| FR-10 | Dev `__ranch.audio` state and actions, dev-only | P5.T1 | harness/snapshot suites, `check-dist-clean` | covered |
| FR-11 | Same-origin audio only | P5.T2.1 | offline network log | covered |
| FR-12 | Storage failure falls back without throwing | P4.T2.2 | settings/storage suites | covered |
| NFR-1 | Pack ≤2.5 MB, precache <15 MB | P2.T3, P5.T2 | 853,289 B / 4,274.94 KiB | covered |
| NFR-2 | Voice ≤100 ms, SFX ≤50 ms, unlock ≤300 ms, 60 fps | P3.T1, P5.T2.2 | request→`onplay` 0.2 ms browser; SFX onset and fps deferred | partial (hardware) |
| NFR-3 | −16 LUFS ±1.2 dB, 0.3 s tail, no clipping | P2.T1, R1.T6 | loudness table, per-line report | covered |
| NFR-4 | 72 px, icon + word, keyboard, focus, no reading | P4.T3 | audio-controls suite, markup | covered |
| NFR-5 | No determinism change, no leaked timers/listeners | P1.T2, P3.T1, P4.T1 | mix/gate/dispose suites | covered |
| NFR-6 | Licenses + CREDITS | P2.T2.3, R1.T5.2 | 15 CREDITS rows | covered |
| NFR-7 | Tablet Safari/Chrome suspended context and hidden tab | P3.T2.3 | unit visibility/suspended-context suites | partial (device debt) |
| NFR-8 | Offline, COPPA-safe, no data leaves | P5.T2 | offline reload + origin log | covered |
| AC-1 | Catalog counts, files, pack check | P2.T3 | `phase-2.md` | covered |
| AC-2 | No Howl before gesture, one unlock, no duplicates | P3.T2 | `phase-5.md` browser table | covered |
| AC-3 | Loop, hidden pause, duck, restore | P3.T1 | engine suite | covered |
| AC-4 | Every SFX plays, cap, no console errors | P3.T1.3 | engine suite, browser | covered |
| AC-5 | Newest wins, ≤100 ms, line length | P3.T1, R1.T3 | engine latency test, browser 0.2 ms | covered |
| AC-6 | Mute 72 px, immediate, persisted | P4.T3 | audio-controls/settings suites | covered |
| AC-7 | Volume live, clamped, persisted | P4.T2/T3 | settings/audio-controls, browser | covered |
| AC-8 | Hold 2 s, early release cancels, Escape/focus | P4.T1/T3, R1.T2 | gate/audio-controls suites | covered |
| AC-9 | Rename → one warning, silence, boot | P3.T1.1, R1.T1 | failure suite | covered at unit level |
| AC-10 | Airplane reload plays music/SFX/voice, no external | P5.T2.1 | `phase-5.md` | covered |
| AC-11 | Harness + absence from dist | P5.T1 | harness suite, dist check | covered |
| AC-12 | Pack ≤2.5 MB, precache <15 MB, CREDITS | P2.T3, P5.T3 | gate output | covered |
| AC-13 | Parent-voice review + tablet touch play | P4.T3 | — | **missing (human-only)** |
| AC-14 | fps before/after no regression | P5.T2.2 | — | **unmet pending hardware** |

## Findings

All findings are resolved. Each fix is in Phase R1 or R2 with a regression test
or corrected evidence.

| ID | Sev | Round | Issue | Fix |
| --- | --- | --- | --- | --- |
| F1 | High | 1 | Failed Howl still playable; music stayed ducked; SFX cap filled | `failed` set rejects ids; duck only after play; `warnAsset` clears slots/voice/duck |
| F2 | Medium | 1 | `aria-modal` without focus trap; Escape only on panel | drop `aria-modal`; Escape on `windowTarget` gated on open |
| F3 | Medium | 1 | Latency measured synchronous `play()` | request time → Howler `onplay`; unit 120 ms, browser 0.2 ms |
| F4 | Medium | 1 | Missing audio element aborted boot | warn, `Sound unavailable`, continue; nullable `Hud.audio` |
| F5 | Medium | 1 | AC-14 signed off on throttled renderer | recorded unmet pending hardware |
| F6 | Low | 1 | 0.5 dB docstrings | 1.2 dB + tail explanation |
| F7 | Low | 1 | `VOICE_TAIL_SECONDS` looked live | documented baked-in; tech-stack aligned |
| F8 | Low | 1 | Gesture installed after IDB awaits | gesture first; `audioReady`; late-bound providers |
| F9 | Low | 1 | CREDITS claimed all assets −16 LUFS | voice ±1.2 dB; short SFX peak-normalized |
| F10 | Low | 1 | Double-padded tail | pad `max(0, tail - guard)`; voice re-rendered |
| F11 | Medium | 2 | SFX dispatch presented as onset | relabelled dispatch; onset deferred |
| F12 | Low | 2 | Dangling gesture comment | removed |
| F13 | Low | 2 | `onWalkChange` still claimed audio unlock | docstring corrected |
| F14 | Low | 2 | `configure` after unlock desynced howler | re-applies master/music gains; tested |
| F15 | Low | 2 | Boot fallback untested | source assertion added |

## Plan compliance

| Phase | Result / Checkpoint | Tasks | Within `Touches` | Deviations |
| --- | --- | --- | --- | --- |
| 1 | catalog + mix | 2/2 | yes | none |
| 2 | assets + pack check + precache | 3/3 | yes, plus `scripts/audio` synth fallback and `CREDITS.md` | reported, accepted |
| 3 | engine + gesture + boot | 3/3 | yes, plus `audio.ts` facade | reported, accepted |
| 4 | gate + settings + controls | 3/3 | yes, plus `viewer.test.ts`/gesture test updates | reported, accepted |
| 5 | dev bridge + offline + docs | 3/3 | yes | reported; docs applied by primary |
| R1 | round-1 fixes | 6/6 | yes | F1-F10 |
| R2 | round-2 fixes | 4/4 | yes | F11-F15 |

No task was silently dropped; every `[x]` has an artefact in the tree.

## Out of scope

- Care gameplay (feeding, washing, cuddling) and body-part voice lines.
- Parent re-recording of the voice set and a language toggle.
- Separate music/SFX/voice sliders (single master volume by assumption).
- Runtime TTS or a CDN voice (rejected by `tech-stack.md`).
- Additional music tracks or ambience beyond the 40 s kalimba loop.

## Debt

| Item | Severity | Reason not fixed here | Follow-up |
| --- | --- | --- | --- |
| AC-13 parent-voice and tablet-touch review | High | requires the parent and the target tablet | Track 8 device pass |
| AC-14 60 fps before/after playback | Medium | available browser is a throttled software renderer (4-25 fps) | Track 8 device pass |
| SFX onset and first-unlock ≤300 ms | Low | needs a real audio device | Track 8 device pass |
| `hud.ts` 6.17 % / `loop.ts` 25.92 % lines | Low | pre-existing DOM/canvas harness gap | housekeeping batch |
| Unused Draco decoder variants (~1.25 MB) | Low | pre-existing build-level decision | housekeeping batch |
| `THREE.Clock` deprecation, POV desktop framing, CI Node 24 drift | Low | pre-existing, unrelated | housekeeping batch |

## History

| Round | Verdict | Critical | High | Medium | Low | Fixed |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | BLOCK | 0 | 1 | 4 | 5 | F1-F10 in R1 |
| 2 | PASS WITH FINDINGS | 0 | 0 | 1 | 4 | F11-F15 in R2 |

## Doc sync

pending — this review is recorded before the final doc-sync commit
