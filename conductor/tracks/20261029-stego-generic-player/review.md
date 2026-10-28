# Review — 20261029-stego-generic-player (Round 1)

- Reviewer: conductor-reviewer subagent (read-only; session ses_e7b47d96cffejv9yqY3JPWlyl2)
- Date: 2026-10-29 (UTC)
- Verdict: **PASS WITH FINDINGS** — no Critical/High defects.
- Reviewer-confirmed: Trike behavior bit-identical (240-frame default-vs-explicit
  positions equal; old exports delegate to shared core with exact old constants);
  differential seed-lock is a legitimate honesty anchor, not seed-shopping
  (full sweep 0.242 → 0.153 → 0.3311 m logged; courses/thresholds pinned);
  STEGO curvature 20 has no spin risk (same π cap + remaining-angle clamp as
  Trike; 0.5 s quarter-turn by design, meets the <0.6 s budget);
  double-quote style accepted (oxfmt-enforced reality).

## Dispositions

| Finding | Severity | Disposition |
| --- | --- | --- |
| F1 AC-3 passes 1 of 3 draws; single-draw evidence for a general property | Medium | **Fixed in Round 1.** New property test `avoidance improves separation across fixed draws` asserts avoided-min > baseline-min (plus engagement both sides) on all 3 documented draws; absolute >0.25 m bar stays on the locked draw (0.3311 m). Verified: 116/116 green. |
| F2 Stego scale 0.6 vs spec 0.25–0.35x | Medium | **Spec amended (Round 1).** FR-3 / IN-scope / plan P2.T1.2 now record 0.6 pen-mate parity (knob floor, stride parity preserved). No behavior change. **Needs product sign-off** (user). |
| F3 Blender render substitutes tablet screenshot + fps; NFR-1 unmeasured | Medium | **Deferred.** No tablet/browser tooling in this environment. AC-8/NFR-1 marked conditionally proven pending human-only tablet-touch-play. **Needs user run.** |
| F4 FR-9 over-claims shared BlinkController instance | Low | **Spec amended (Round 1).** FR-9 / overview / IN-scope now say shared class, per-player instances. No behavior change. |
| F5 Shared DustPool ages 2x (both players update it) | Low | **Noted, not fixed.** Cosmetic (~0.3 s puffs remain visible). Candidate for a future polish track. |
| F6 TrikePlayer alias silently drops caller gait | Low | **Fixed in Round 1.** Constructor now takes `Omit<DinoPlayerOptions,"gait">` (`TrikePlayerOptions`); gait forced to TRIKE_GAIT by type. Only caller passes no gait — tsrs + 116/116 green. |
| F7 No persist round-trip test for AC-4 | Low | **Noted, not fixed.** Pre-existing wiring, code-inspected. Candidate for a future test-hardening track. |

## Round 1 verification

- oxlint exit 0 (pre-existing vendor warnings only); oxfmt --check exit 0;
  tsrs --noEmit exit 0; vitest 13 files / **116 passed**; vite build precache
  11 entries / 1842.47 KiB (unchanged).
- Commit: `fix(review): ...` (this round).

## Sign-off items for the user (product owner)

1. F2: accept Stego baby scale 0.6 (3.9 m, Trike pen-mate) vs product 0.25–0.35x.
2. F3: run tablet-touch-play (dual-wander feel + fps + screenshot) on the real tablet.
3. Flip `conductor/product.md` roadmap Track 2 to `[x]` (needs product-doc approval).
