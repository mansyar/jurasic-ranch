import type * as THREE from 'three';

/** Pinned Polyfork params for the pastel baby variant (see bake-trike-variant.js). */
export interface TrikeVariantParams {
  size: number;
  horns: number;
  noseHorn: number;
  frill: string;
  hide: string;
  belly: string;
  horn: string;
  mark: string;
  shieldTrim: string;
  shieldMark: string;
}

export declare const TRIKE_VARIANT_PARAMS: TrikeVariantParams;

/** Position-track scale applied when retargeting Waddle onto the variant skeleton. */
export declare const POSITION_TRACK_SCALE: number;

export interface GlbAnimationChannel {
  nodeName: string;
  path: string;
  interpolation: string;
  times: Float32Array;
  values: Float32Array;
  itemSize: number;
}

export interface GlbAnimationData {
  name: string;
  durationSeconds: number;
  rootScale: number | null;
  channels: GlbAnimationChannel[];
}

/** Procedural variant group: the exact geometry the bake exports. */
export declare function createVariantGroup(): THREE.Group;

/** Adult reference group (all Polyfork defaults): proportion baseline. */
export declare function createDefaultGroup(): THREE.Group;

/** Extract the first animation's channels from raw GLB bytes. */
export declare function extractAnimationTracks(bytes: Uint8Array): GlbAnimationData;

/** Rebuild the Waddle clip on a new skeleton (quaternions verbatim, positions scaled). */
export declare function buildRetargetedClip(
  skeletonRoot: THREE.Object3D,
  animation: GlbAnimationData,
): THREE.AnimationClip;

export interface BakeTrikeVariantOptions {
  prevGlbPath?: string;
  outPath?: string;
  blenderBin?: string;
  keepTemp?: boolean;
}

export interface BakeTrikeVariantSummary {
  outPath: string;
  durationSeconds: number;
  trackCount: number;
}

/** Run the full bake (procedural variant + retargeted Waddle + Blender Draco pass). */
export declare function bakeTrikeVariant(
  options?: BakeTrikeVariantOptions,
): Promise<BakeTrikeVariantSummary>;
