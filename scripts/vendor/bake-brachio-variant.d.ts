import type * as THREE from 'three';
import type { GlbAnimationData } from '../bake-trike-variant.js';

/** Pinned Polyfork params for the pastel baby Brachio variant (see bake-brachio-variant.js). */
export interface BrachioVariantParams {
  size: number;
  neck: number;
  head: number;
  tail: number;
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

/** Extra uniform scale applied to the variant group (knob floor 0.6 cannot reach the cap alone). */
export declare const BRACHIO_EXTRA_SCALE: number;

/** Position-track scale applied when rebuilding Waddle onto the Brachio skeleton. */
export declare const BRACHIO_POSITION_TRACK_SCALE: number;

/** Retime target: the rebuilt Waddle loop length in seconds (matches BRACHIO_GAIT). */
export declare const BRACHIO_LOOP_SECONDS: number;

/** Procedural variant group: the exact geometry the bake exports. */
export declare function createBrachioVariantGroup(): THREE.Group;

/** Adult reference group (all Polyfork defaults): proportion baseline. */
export declare function createBrachioDefaultGroup(): THREE.Group;

/**
 * Rebuild the Trike donor Waddle clip on the Brachio skeleton (retimed to
 * 1.0 s, positions scaled, quaternions verbatim). Donor channels with no
 * Brachio counterpart (ear bones) are dropped and recorded on the clip's
 * userData.dropped.
 */
export declare function buildBrachioWaddleClip(
  skeletonRoot: THREE.Object3D,
  animation: GlbAnimationData,
): THREE.AnimationClip;

export interface BakeBrachioVariantOptions {
  donorGlbPath?: string;
  outPath?: string;
  blenderBin?: string;
  keepTemp?: boolean;
}

export interface BakeBrachioVariantSummary {
  outPath: string;
  durationSeconds: number;
  trackCount: number;
}

/** Run the full bake (procedural variant + rebuilt Waddle + Blender Draco pass). */
export declare function bakeBrachioVariant(options?: BakeBrachioVariantOptions): Promise<BakeBrachioVariantSummary>;
