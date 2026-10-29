# Conductor — Jurasic Ranch

<!-- template-version: 2 -->

## Definition

Cozy tablet PWA dino ranch for 4yo. Source of truth for product vision, stack, and workflow.

## Workflow

- Product: `./product.md`
- Tech stack: `./tech-stack.md`
- Guidelines: `./product-guidelines.md`
- Workflow: `./workflow.md`
- Code style: `./code_styleguides/typescript.md`

## Tracks

- [Tracks Registry](./tracks.md)
- [Tracks Directory](./tracks/)

## Capabilities

- PWA offline game, real skeletal waddle first (each species on its own authored clip), Kokoro voice, CC0 music
- Commands: `pnpm verify` (oxlint + oxfmt + tsrs + coverage + build); `pnpm icons` rasterizes `public/icons/icon.svg` into the PWA and touch icons via `sharp`
- Evidence: `conductor/tracks/<id>/verification/` + `.conductor/evidence/` (gitignored)
