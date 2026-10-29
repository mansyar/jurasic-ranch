/**
 * Types for `inspect-dino-clips.mjs`, the GLB rig/clip inspector written for
 * Phase 1 of track 20261029-authored-dino-walk-clips.
 *
 * The module is vendored analysis tooling rather than app code: it is excluded
 * from `oxlint`, from `oxfmt` and from the coverage report, and `tsconfig.json`
 * does not enable `allowJs`. `scripts/check-dino-clips.test.ts` is TypeScript
 * and imports it, so the surface that test uses is declared here — the same
 * arrangement `bake-stego-variant.d.ts` uses for the bake script. Extend this
 * file when another consumer needs one of the module's other exports
 * (`readFloatAccessor`, `localTransform`, `quaternionAngleDegrees`,
 * `compareRigs`, `bakeModuleGlb`, `SPECIES`).
 */

/** One skin joint: its local rest TRS and the parent it hangs from. */
export interface RigJoint {
  /** Index into the glTF node array. */
  index: number;
  name: string;
  /** `null` on a joint no node parents, which the shipped rigs have none of. */
  parent: string | null;
  translation: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  /** |translation|: the rest distance to the parent, the FR-3 denominator. */
  restDistanceMetres: number;
}

/** The skeleton and container facts `readRig` resolves. */
export interface Rig {
  joints: RigJoint[];
  nodeCount: number;
  skinCount: number;
  meshCount: number;
  materialCount: number;
  animationNames: string[];
  /** False means the file carries no skin, so any joint-derived gate is vacuous. */
  hasSkin: boolean;
}

/** Read the skeleton, parents and rest TRS. Handles TRS and `matrix` nodes. */
export declare function readRig(bytes: Uint8Array): Rig;

/** One animation clip's name, authored duration and channel census. */
export interface ClipFacts {
  name: string;
  /** Longest sampler input time, in seconds: no frame rate is assumed. */
  durationSeconds: number;
  channelCount: number;
  keyframes: number;
  pathCounts: Record<string, number>;
  bones: string[];
}

export declare function clipFacts(bytes: Uint8Array): ClipFacts[];

/** One animated bone's first-frame translation against its rest translation. */
export interface DisplacementRow {
  name: string;
  restTranslation: [number, number, number];
  firstFrameTranslation: [number, number, number];
  delta: [number, number, number];
  deltaMetres: number;
  restDistanceMetres: number;
  /** `null` when the rest offset is exactly 0, where a ratio is meaningless. */
  deltaFractionOfRestDistance: number | null;
}

export interface DisplacementReport {
  clipName: string;
  /** Sorted worst first; only `translation` channels carry a row. */
  rows: DisplacementRow[];
}

/**
 * Per-bone frame-0 displacement for one clip: the clip's first translation
 * keyframe minus the bone's rest translation. Throws when the named clip or any
 * animation is absent.
 */
export declare function displacementRows(
  bytes: Uint8Array,
  options?: { clipName?: string },
): DisplacementReport;
