import type * as THREE from 'three';

/**
 * Pinned Polyfork params for the pastel Brachio variant (see
 * bake-brachio-variant.js): the colourway plus the authored size. Geometry knobs
 * are absent on purpose — they rebuild bones, and the authored clips apply
 * verbatim only to the module's default skeleton at size 1.0.
 */
export interface BrachioVariantParams {
  size: number;
  colorway: string;
  coat: string;
  flank: string;
  belly: string;
  mottle: string;
  muzzle: string;
  nail: string;
  eye: string;
}

export declare const BRACHIO_VARIANT_PARAMS: BrachioVariantParams;

/** Procedural variant group: the exact geometry the bake exports. */
export declare function createBrachioVariantGroup(): THREE.Group;

/** Adult reference group (all Polyfork defaults): proportion baseline. */
export declare function createBrachioDefaultGroup(): THREE.Group;

/**
 * Graft the official GLB's authored Idle/Walk/Run onto the baked skeleton.
 * Translation and rotation only, times and values verbatim; throws before the
 * bake writes anything when a clip names a bone the rig lacks.
 */
export declare function buildBrachioClips(
  skeletonRoot: THREE.Object3D,
  officialBytes: Uint8Array,
): THREE.AnimationClip[];

/** One grafted clip, as reported by the bake. */
export interface BakedClipSummary {
  name: string;
  durationSeconds: number;
  trackCount: number;
}

export interface BakeBrachioVariantOptions {
  officialGlbPath?: string;
  outPath?: string;
  blenderBin?: string;
  keepTemp?: boolean;
}

export interface BakeBrachioVariantSummary {
  outPath: string;
  clips: BakedClipSummary[];
}

/** Run the full bake (procedural variant + grafted authored clips + Blender Draco pass). */
export declare function bakeBrachioVariant(
  options?: BakeBrachioVariantOptions,
): Promise<BakeBrachioVariantSummary>;
