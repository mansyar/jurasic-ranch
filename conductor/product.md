# Jurasic Ranch — Product Definition

## Vision

A cozy tablet PWA pet-raising game for a 4-year-old dino lover. Raise Trike + Stego + Brachio as forever-babies in a safe ranch. No fail, no reading, no death, no scare. Feed / wash / cuddle plus hidden educative surprises with sticker rewards. Warm low-poly Polyfork art, day only, endless sandbox with sleepy cues.

## Target Users

- Primary: 4-year-old son — solo taps, big 72px targets, fully voiced, one-finger drag/tap only.
- Secondary: Dad — co-play (counts aloud, names parts, records future voice lines).

## Core Use Cases

1. Daily care: feed (drag berry/leaf), wash (scrub mud), cuddle (tap for hearts/giggle).
2. Hidden edu surprises (60-90s, twinkle invite, never forced):
   - Snack counting 1-5 (feed extension)
   - Body tap: horns / plates / neck / tail / tummy / feet
   - Big leaf UP / little berry DOWN sort (Brachio vs Trike)
   - TSB bubble pop (light letters only)
3. Sticker book auto-saves moments. Nap anywhere. Endless sandbox.

## Goals & Success Metrics

- Goal: joy + daily ask within 1 month.
- Can play 7 min solo with no help, laughs at waddle/coos.
- Learns counting 1-5 and body words informally.

## Core Flows

Open → waddle hello + coo → feed (counting) → wash → cuddle (body vocab) → twinkle surprise → sticker → nap/repeat. Guided care-plus-surprise loop, free order, interruptible, sleepy cues (droopy eyes, yawns) not forced quits.

## Scope & Non-Goals

IN (MVP):
- 3 herbivores forever-babies (Trike, Stego, Brachio), species names only
- Fixed cozy cam + 3 POV buttons (Ranch / Nest / Garden), no orbit
- Real skeletal waddle walk first, 6 clips max (idle, waddle, eat_nom, blink, happy_wiggle, sleep_droop)
- CC0 kalimba + coos, Kokoro af_bella 0.85x pre-generated mp3s
- Offline PWA, English only

OUT:
- No store / ads / accounts / IAP ever
- No predators, roars, growth, death, timers, currency, reading quests, multiplayer

## Constraints

- Solo dad evenings build pace
- Newer tablet 60fps, landscape, airplane-mode OK
- Touch: 72px targets, tap/drag only, no pinch/double-tap/orbit
- Offline <15MB, pixelRatio cap 2, shadows low
- Licenses: MIT / Apache-2.0 / CC0 only

## Integrations & External Dependencies

- Polyfork Prehistoric Valley (dinos, nest, eggs) + Cozy Farm (barn, fences, trough) GLBs, lush/day only, no ACES tone-mapping
- Kokoro-82M ONNX local (Apache-2.0) for teacher voice, Audacity cleanup, Howler.js playback
- Vite + three.js + Service Worker manifest, Add-to-Homescreen
- Freesound / OpenGameArt / Pixabay CC0 for music + SFX (CREDITS kept)

## Risks & Unknowns

- Animation + audio pipeline heaviest for evenings — mitigate: Trike-first template, 6-clip cap, procedural fallback, copy rig to Stego/Brachio
- Boredom after week 1 — mitigate: 4 rotating surprises + sticker variety, cooldowns
- PWA cache/perf — mitigate: <15MB, Draco GLBs, one material, flat-shaded
- Brachio scale reads huge — mitigate: cap 1.2m, mostly seated shuffle

## Open Questions & Assumptions

- Assumptions: pastel baby scale 0.25-0.35x, blush via colorway, parent volume lock, 5s hint glow, all food works (favorite = extra hearts)
- Open: exact tablet model for final perf test, parent re-record pack in v2

## Roadmap

- [x] Track 1 — Trike Waddle Walk (offline PWA shell, pastel rigged waddle, stay-in-frame wander, silence)
- [x] Track 2 - Stego joins (reuse Trike pipeline: retime Waddle, plates pastel, wander)
- [x] Track 3 — Brachio joins (seated shuffle, 1.2 m scale cap; UP/DOWN size-sort surprise deferred to feeding track)
- [ ] Track 4 — Feed mini + snack counting 1-5 (drag berry/leaf, Kokoro counts, eat_nom clip)
- [ ] Track 5 — Wash + cuddle (scrub mud, tap hearts, body-tap vocab surprise)
- [ ] Track 6 — Surprises + sticker book (TSB bubbles, twinkle invites, auto-save moments)
- [ ] Track 7 — Ranch dressing (3 POV buttons, nest/garden, sleepy cues + lullaby closer)
- [ ] Track 8 — Tablet pass + release (real-device 60 fps, airplane-mode, parent-voice review, Add-to-Homescreen)
