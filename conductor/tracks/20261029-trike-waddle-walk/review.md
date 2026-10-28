# Review — 20261029-trike-waddle-walk (Trike Waddle Walk)

- Track: 20261029-trike-waddle-walk
- Branch: feat/20261029-trike-waddle-walk
- Date: 2026-10-29
- Rounds: initial review BLOCK (6 findings) → fix round 1 → re-review
  PASS WITH FINDINGS (5 findings) → primary fix round 2 (trivials)
- Final verdict: PASS WITH FINDINGS (no open High/Critical)
- Checks: `pnpm verify` green — oxlint, oxfmt --check, tsrs --noEmit
  (src+tests+scripts), vitest 42/42 (4 files), vite build,
  PWA precache 10 entries (7 + 3 vendored Draco files)

## Round 1 (BLOCK) → fixed in 6374f1f

| ID | Sev | Issue | Resolution |
|----|-----|-------|------------|
| F1 | High | Viewer booted the procedural placeholder only; baked GLB never loaded | bootViewer loads /models/trike.glb via GLTFLoader + same-origin Draco decoder, swaps placeholder for TrikePlayer; placeholder kept as instant first paint + offline fallback |
| F2 | Med | tsconfig excluded tests/scripts from typecheck | include widened to src+tests+scripts |
| F3 | Med | Baby-scale drift (1.878 m vs spec ~0.9 m) | Spec amended: 0.3x of authored 6.26 m asset (~1.9 m on screen, reads as baby vs 6–9 m adult, fills fixed cam). User-confirmed choice pending at completion |
| F4 | Med | NFR-2 (Draco/one-material/flat) unasserted | GLB check asserts KHR_draco_mesh_compression + materials.length === 1 |
| F5 | Low | WADDLE_LOOP_SECONDS duplicated | Placeholder now imports the shared constant |
| F6 | Low | Placeholder bob lifted feet off y=0 | Body-only bob; placeholder replaced by F1 wiring |

## Round 2 (PASS WITH FINDINGS) → fixed in 4689542 / accepted

| ID | Sev | Issue | Resolution |
|----|-----|-------|------------|
| F7 | Med | Loader tests never locked the offline-safe decoder path | Added setDecoderPath('/draco/') + setDRACOLoader assertions; all loader mocks reset per test |
| F8 | Med | Flat-shading half of NFR-2 citation-only | Accepted manual-evidence exception: Phase-2 preview_scene renders + Polyfork one-material claim + NoToneMapping daylight (workflow human-only gate). Automated check covers Draco + single material |
| F9 | Low | Placeholder comment still said 0.9 m | Comment updated to 1.9 m swap-target footprint |
| F10 | Low | Placeholder/rigged heading + scale pop on swap | Placeholder rotated to +Z and scaled 1.3x (~1.9 m); test locks z-extent 1.5–2.2 m + heading |
| F11 | Low | Absolute /models + /draco URLs assume root base | Derived from import.meta.env.BASE_URL (subpath-safe) |

## Human follow-ups (workflow exception tablet-touch-play)

- Manual tablet video: tap Walk, confirm 60 fps waddle + audible silence
- Airplane-mode second visit: Trike still walks (precached GLB + Draco)
- Parent-voice review of status-pill wording ("Walking" / "Tap Walk to waddle")
