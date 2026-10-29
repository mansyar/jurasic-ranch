# Track: Stego and Brachio Walk on Their Own Bones

- [Specification](./spec.md)
- [Implementation Plan](./plan.md)
- [Metadata](./metadata.json)

**Type:** bug
**Priority:** high
**Branch:** `fix/20261029-authored-dino-walk-clips`
**Depends on:** none

## Summary

Stego and Brachio walk on the Trike's animation clip: the bake copies every channel of `trike.glb`'s `Waddle` onto their skeletons and scales the position tracks by one constant, but glTF translation channels are absolute, so each bone is dragged off its rest offset every frame. This track re-bakes both pastel GLBs from the vendored Polyfork module at authored proportions, grafts the `Idle`/`Walk`/`Run` clips Polyfork actually authored, moves in-game size to a per-species group scale, re-measures both gait configs, and enlarges the ranch so the trio can hold real-life proportions.

## Artifacts

- [verification/](./verification/) — phase evidence
- review.md — written by `conductor-review`
- pr.md — written when the pull request opens
