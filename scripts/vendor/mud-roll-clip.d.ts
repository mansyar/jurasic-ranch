import type * as THREE from 'three';

/**
 * Stego's bespoke wallow clip (track 20261030-wallow-nest-life, FR-6).
 *
 * Authored in Node rather than Blender because the bake injects clip channels
 * into the compressed GLB's JSON chunk - Blender's glTF round trip re-times
 * animation onto its own frame clock, so an action authored there never
 * reaches the shipped file.
 */
export const MUD_ROLL_ACTION_NAME: string;
export const MUD_ROLL_FPS: number;
export const MUD_ROLL_FRAMES: number;
export const MUD_ROLL_SECONDS: number;
export const MUD_ROLL_ROOT_BONE: string;
export const MUD_ROLL_SPINE_CHAIN: readonly string[];

/** `(frame, {bone: [rx, ry, rz] degrees}, root drop metres)`, spine cumulative. */
export const MUD_ROLL_KEYS: ReadonlyArray<
  readonly [number, Readonly<Record<string, readonly [number, number, number]>>, number]
>;

/** Every bone the table touches, plus the root, sorted. */
export function mudRollBones(): string[];

/**
 * Resolve cumulative spine targets into per-bone deltas. A chain bone missing
 * from the pose inherits its parent's cumulative value.
 */
export function resolveMudRollPose(
  poses: Readonly<Record<string, readonly [number, number, number]>>,
): Record<string, [number, number, number]>;

/** A glTF channel in the shape `injectGlbAnimations` consumes. */
export interface MudRollChannel {
  nodeName: string;
  path: 'translation' | 'rotation';
  interpolation: 'LINEAR' | 'STEP';
  times: Float32Array;
  values: Float32Array;
}

export interface MudRollClip {
  name: string;
  durationSeconds: number;
  channels: MudRollChannel[];
}

/**
 * Build the clip against a real baked rig: rotations are authored in armature
 * space and conjugated into each bone's local space, so `ry` means "roll the
 * body onto its left side" whatever axis the bone happens to have.
 */
export function buildMudRollClip(skeletonRoot: THREE.Object3D): MudRollClip;
