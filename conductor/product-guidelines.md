# Jurasic Ranch — Product Guidelines

## Voice & Tone

- Playful dad: short, silly, warm. Example: "Nom nom! Trike says thank you!"
- Slow pace, rising pitch on counts (One… Two… THREE!), always celebrates, never scolds or says wrong.
- Voice lines <2s + 0.3s tail, Kokoro af_bella 0.85x MVP, parent re-record swap same filenames in v2.

## UX Principles

- Instant feedback always: every tap <100ms hearts + wiggle + sound.
- 5s hint glow if stuck, all anims interruptible, no fail states, no timers.
- Care-plus-surprise loop, twinkle invites (not forced), sticker every 60-90s play.
- Sleepy cues (droopy eyes, yawn) not forced quits. Fixed cozy cam + 3 POV buttons, no orbit.

## Accessibility

- Motor + color safe: 72px+ targets, tap/drag only, left/right-hand OK, landscape.
- Never color-only: icon + English word + sound. Colorblind-safe palette.
- Sensory safe: no flashing >3Hz, mute big button + parent volume lock, kalimba -20dB under voice.
- No reading required, fully voiced, 0.3s gaps between prompts.

## Design System

- Chunky pastel rounded UI, day/golden light only, lush climate, no ACES tone-mapping.
- Polyfork one-material flat-shaded dinos (Trike/Stego/Brachio 0.25-0.35x babies), Cozy Farm fences/barn.
- Particles: hearts, sparkles, crumbs, ZZZ. Species names only, big icons.

## Content Style & Terminology

- English only MVP, strings externalized in `strings/en.json` for future ID.
- Words: horns/plates/neck/tail/tummy/feet + One-Five + Big/Little/Up/Down + T/S/B + Trike/Stego/Brachio.
- No predators, roars, death, growth talk. "Sleepy" not "tired", "all done!" not "no".

## Platform Conventions (Tablet PWA)

- Landscape locked, disable pinch/double-tap zoom, Add-to-Homescreen fullscreen.
- Offline-first (<15MB), pixelRatio cap 2, shadows low, 60fps newer tablet.
- `vite preview --host` LAN test, IndexedDB stickers, CacheStorage GLB/mp3.

## Internationalization

- EN only MVP. No hard-coded strings in scenes. RTL not needed. Future `strings/id.json` toggle in parent corner.

## Legal / Privacy

- Fully offline: no data leaves tablet, no accounts/ads/tracking/IAP — COPPA-safe by design.
- Licenses MIT/Apache-2.0/CC0 only. Keep `CREDITS.md` for CC0 music/SFX + Polyfork.
- Parent gate (hold 2s) for settings/voice volume, no external links.

## Consistency Notes

- Matches product.md (forever-babies, endless sandbox) and tech-stack.md (pnpm 12, Vite 8, three 0.180, tsrs, oxlint/oxfmt).
