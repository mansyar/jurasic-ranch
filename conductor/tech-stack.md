# Jurasic Ranch — Tech Stack (Oct 2026 latest)

## Languages & Runtimes

- TypeScript 7.0 (ES2022 browser target, landed 7.0.2) + tsgo Go-native stable fallback
- Node 22.12+ (for Vite 8), pnpm 12.15.0 Rust-native package manager
- Python 3.10+ (Kokoro-ONNX voice gen only, not runtime)

## Frameworks & Libraries

- three.js 0.180+ ESM (native Polyfork GLB, no engine wrapper)
- Vite 8 + vite-plugin-pwa (offline Service Worker, <15MB cache)
- Howler.js 2.2 (audio sprites, ducking, mute lock)
- idb-keyval (IndexedDB stickers/settings wrapper)

## Package Manager & Build

- pnpm 12.15.0 + pnpm-lock.yaml
- `pnpm install` / `pnpm dev --host` (tablet LAN test) / `pnpm build` / `pnpm preview --host`
- Draco GLB compression for dinos, mp3 128k for voice/SFX

## Data Stores

- IndexedDB (stickers, settings, volume lock) via idb-keyval
- CacheStorage (GLB/mp3 offline PWA), LocalStorage fallback for flags
- No backend, no accounts

## External Services & APIs

- Polyfork Prehistoric Valley + Cozy Farm (Apache/CC0 GLBs, vendored local)
- Kokoro-82M ONNX local (Apache-2.0, af_bella 0.85x) + Edge-TTS audition only
- Freesound / OpenGameArt / Pixabay CC0 music + SFX (CREDITS file)

## Hosting & Deployment

- MVP: local only (`vite preview --host` for tablet)
- Later: static GitHub Pages, Add-to-Homescreen PWA, landscape locked

## Test / Typecheck / Lint / Format

- Typecheck: tsrs (Oct 2026 Rust port, primary) with tsgo TS7 fallback `tsgo --noEmit`
- Lint: oxlint v1.90.0 (`pnpm lint`, ignores `public/draco/**` + `scripts/vendor/**`)
- Format: oxfmt v0.75.0 Prettier-compatible (`pnpm format --check`)
- Unit: Vitest for counting/sort/sticker logic (`pnpm test`)
- Visual: manual tablet play + Polyfork preview_scene, pixelRatio cap 2

## Local Dev Env

- pnpm 12, Node 22, Python 3.10 + espeak-ng + kokoro-onnx, Blender 4.x (rigs), Audacity (normalize -16 LUFS)
- `.env` not needed (no keys), seed stickers in IndexedDB
- Dev harness (2026-10-29): `pnpm dev --host`, then open `/?dev=1` — `?dev=1` is the only way to load it, and it is dev-only behind `import.meta.env.DEV`, so the production bundle never carries it. Add `&seed=<integer>` for deterministic wander jitter and dust. `window.__ranch` exposes `snapshot()` (walking, paused, POV, sleepy stage, fps, per-dino visibility/position/heading, pairwise distances, `minSeparation`) plus visibility, solo, walk, pause, step, POV and forced-state controls. `pnpm verify` runs `scripts/check-dist-clean.mjs` after `vite build` and fails if `__ranch`, `data-dev-panel`, `installDevHarness` or `parseDevQuery` reach `dist/`.

## Constraints

- Licenses MIT / Apache-2.0 / CC0 only (no XTTS-v2 CPML, no F5 CC-BY-NC)
- Offline-first, airplane-mode OK, 60fps newer tablet, 72px targets
- No ACES tone-mapping (Polyfork muddy), use stage() daylight

## Rejected Alternatives

- Bun: fast but pnpm 12 Rust now matches + wider Vite/PWA plugin compat
- Godot/Unity: extra import pipeline / heavy vs three-native Polyfork
- ESLint+Prettier: 56x slower vs oxlint+oxfmt, same rules
- tsc classic: 10x slower vs tsrs/tsgo native
- Live SpeechSynthesis / cloud TTS runtime: voice inconsistency + needs internet

## Upgrade Policy

- Pin pnpm 12, Vite 8, three 0.186.1, oxlint 1.90.0, oxfmt 0.75.0, typescript 7.0.2, @types/node 26.6.5, vitest 5.0.5, vite-plugin-pwa 2.0.0, tsrs latest Oct 2026
- Monthly `pnpm update` check, keep lockfile, test waddle clip perf after three bumps

## Open Questions & Assumptions

- Assumption: pnpm 12 standalone install OK on dad machine, tsrs experimental — fallback tsgo documented
- Open: exact tablet model string for final perf gate
