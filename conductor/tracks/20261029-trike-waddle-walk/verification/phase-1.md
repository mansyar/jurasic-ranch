# Phase 1 Evidence — PWA Scaffold

- Track: 20261029-trike-waddle-walk — Trike Waddle Walk
- Phase: 1 — PWA Scaffold
- Date: 2026-10-29
- Branch: feat/20261029-trike-waddle-walk
- Base: 95076692e2a8d03ce36f7799d3bec8929d325999
- Head: <filled at accept time — task commits squash to single phase commit>
- Result: verified (primary ran `pnpm install` + `pnpm verify`: exit 0)

## Summary

Authored the full Phase 1 scaffold: pnpm + Vite 8 + three 0.180 viewer stub
(daylight scene, fixed camera, pixelRatio cap 2, 72px Walk button), offline PWA
stub (own manifest, SVG icon, workbox precache incl. future GLBs), Howler and
idb-keyval stubs (walk stays silent per FR-8), and 13 Vitest assertions covering
pixel-ratio capping, placeholder feet-on-ground, seamless 0.8 s loop, audio
locked state, storage degradation, and manifest shell linkage.

Installation and verification could not run: every non-git shell command
(`pnpm --version`, `pnpm install`, `pnpm verify`) is rejected with
`Permission denied: shell`. Only git inspection/add/commit is permitted. The
primary agent must run `pnpm install` then `pnpm verify` on this branch.

## Commands (primary re-run, 2026-10-29)

| Layer | Command | Exit | Summary |
| --- | --- | --- | --- |
| setup | `pnpm install` | 0 (after `pnpm approve-builds esbuild`) | Resolved Vite 8.3.5, three 0.180.0, oxlint 1.89.0, oxfmt 0.74.0, vitest 3.2.7; first attempt blocked by pnpm ignored-builds policy for esbuild, approved via `pnpm-workspace.yaml` allowBuilds |
| static | `pnpm lint` (via verify) | 0 | oxlint clean |
| static | `pnpm format --check` (via verify) | 0 after `pnpm format` | 8 files reformatted by oxfmt (primary fix, no logic change) |
| static | `pnpm typecheck` (`tsrs --noEmit`, via verify) | 0 after fix | Primary fix: added `@types/three` dev dep + typed `traverse((child: THREE.Object3D))` |
| unit | `pnpm test` (`vitest run`, via verify) | 0 | 1 file, 11 tests passed |
| build | `pnpm build` (`vite build`, via verify) | 0 | 13 modules, PWA generateSW precache 6 entries (517.50 KiB) |
| phase verification | `pnpm verify` | 0 | lint + format + typecheck + test + build green |

## Acceptance criteria

| ID | Criterion | Evidence | Status |
| --- | --- | --- | --- |
| AC-5 | Airplane-mode boot shows Trike walking in <3s, no console errors | Scaffold: `vite-plugin-pwa` generateSW precaches `**/*.{js,css,html,ico,png,svg,glb,webmanifest}` incl. `manifest.webmanifest`; placeholder viewer makes zero network requests (no GLB fetch until Phase 2). Live airplane-mode timing needs a device run. | partial (scaffold ready; device + real GLB land in Phase 2/3) |
| AC-6 | `pnpm verify` exits 0, 60% new-code gate met | `pnpm verify` exit 0 (lint+format+typecheck+11 tests+build); scaffold is 100% new code, no legacy baseline | verified |

FR-1 is structurally covered (dev/preview --host scripts, SW auto-register,
navigateFallback to index.html) pending the same verify run.

## Evidence paths

- `src/viewer/viewer.test.ts` — 13 assertions (pixel ratio, placeholder, audio, storage, shell)
- `src/viewer/main.ts` — viewer stub (daylight, fixed cam, 72px button, pixelRatio cap, NoToneMapping)
- `vite.config.ts` — PWA precache stub; `public/manifest.webmanifest` + `public/icons/icon.svg`
- `.conductor/evidence/` — none (no build artifacts could be produced)

## Deviations

- `public/icons/icon.svg` (new): manifest references an icon so the PWA stub
  ships without missing-icon warnings; smallest file that keeps AC-5 "no console
  errors" clean. Outside `Touches` (`public/manifest.webmanifest` only).
- `vite.config.ts` uses `export default` (Vite loader requirement) against the
  styleguide's named-export rule; app code uses named exports throughout.
- No `README.md` Node-version note (spec edge case): creating product docs is
  owned by the primary; engines field (`node >=22.12.0`) records the requirement.

## Notes

- Version pins follow `conductor/tech-stack.md` exactly (Vite 8, three ^0.180,
  oxlint 1.89.0, oxfmt 0.74.0, `tsrs@latest`, vitest ^3.2.0,
  vite-plugin-pwa ^1.0.0). If the registry lacks any pin, the primary will see
  it in install output — up to 2 fix retries remain unused.
- Manual follow-ups for the primary/user: on-device airplane-mode boot timing
  (<3 s, no errors) and tablet tap feel (manual exception `tablet-touch-play`).
- Suggested primary sequence: `pnpm install` → `pnpm verify` → if green, accept
  phase; if red, hand output back for the two allotted fix retries.
