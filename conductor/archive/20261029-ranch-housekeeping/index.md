# Ranch Housekeeping

- [Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Metadata](./metadata.json)

**Type:** `refactor`
**Priority:** `medium`
**Branch:** `refactor/20261029-ranch-housekeeping`
**Depends on:** none

## Artifacts

- `verification/` - phase evidence, created during implementation
- `review.md` - created by `conductor-review`
- `pr.md` - created by `conductor-implement` before opening a PR

## Summary

Behaviour-preserving cleanup before the gameplay tracks: split the 800-line
`src/viewer/main.ts` by responsibility, retire the completed Trike migration
shim, repair three holes in `pnpm verify` (the format glob checks only 4 files,
coverage cannot run at all), drop the duplicated 1.31 MB Draco decoder, and
refresh the stale PWA manifest so the installed app describes the trio ranch.
