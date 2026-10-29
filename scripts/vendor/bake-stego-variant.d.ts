import type * as THREE from 'three';

/**
 * Pinned Polyfork params for the pastel Stego variant (see bake-stego-variant.js):
 * the colourway plus the authored size. Geometry knobs are absent on purpose —
 * they rebuild bones, and the authored clips apply verbatim only to the module's
 * default skeleton at size 1.0.
 */
export interface StegoVariantParams {
  size: number;
  plateColour: string;
  hide: string;
  belly: string;
  blend: string;
  feet: string;
  mark: string;
  plate: string;
  plateTrim: string;
  spike: string;
}

export declare const STEGO_VARIANT_PARAMS: StegoVariantParams;

/** Procedural variant group: the exact geometry the bake exports. */
export declare function createStegoVariantGroup(): THREE.Group;

/** Adult reference group (all Polyfork defaults): proportion baseline. */
export declare function createStegoDefaultGroup(): THREE.Group;

/**
 * Graft the official GLB's authored Idle/Walk/Run onto the baked skeleton.
 * Translation and rotation only, times and values verbatim; throws before the
 * bake writes anything when a clip names a bone the rig lacks.
 */
export declare function buildStegoClips(
  skeletonRoot: THREE.Object3D,
  officialBytes: Uint8Array,
): THREE.AnimationClip[];

/** One grafted clip, as reported by the bake. */
export interface BakedClipSummary {
  name: string;
  durationSeconds: number;
  trackCount: number;
}

export interface BakeStegoVariantOptions {
  officialGlbPath?: string;
  outPath?: string;
  blenderBin?: string;
  keepTemp?: boolean;
}

export interface BakeStegoVariantSummary {
  outPath: string;
  clips: BakedClipSummary[];
}

/** Run the full bake (procedural variant + grafted authored clips + Blender Draco pass). */
export declare function bakeStegoVariant(
  options?: BakeStegoVariantOptions,
): Promise<BakeStegoVariantSummary>;
