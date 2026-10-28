import type * as THREE from 'three';
import type { GlbAnimationData } from '../bake-trike-variant.js';

/** Pinned Polyfork params for the pastel baby Stego variant (see bake-stego-variant.js). */
export interface StegoVariantParams {
  size: number;
  plates: number;
  plateSize: number;
  tail: number;
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

/** Position-track scale applied when rebuilding Waddle onto the Stego skeleton. */
export declare const STEGO_POSITION_TRACK_SCALE: number;

/** Procedural variant group: the exact geometry the bake exports. */
export declare function createStegoVariantGroup(): THREE.Group;

/** Adult reference group (all Polyfork defaults): proportion baseline. */
export declare function createStegoDefaultGroup(): THREE.Group;

/**
 * Rebuild the Trike donor Waddle clip on the Stego skeleton (quaternions
 * verbatim, positions scaled). Donor channels with no Stego counterpart are
 * dropped and recorded on the clip's userData.dropped.
 */
export declare function buildStegoWaddleClip(
  skeletonRoot: THREE.Object3D,
  animation: GlbAnimationData,
): THREE.AnimationClip;

export interface BakeStegoVariantOptions {
  donorGlbPath?: string;
  outPath?: string;
  blenderBin?: string;
  keepTemp?: boolean;
}

export interface BakeStegoVariantSummary {
  outPath: string;
  durationSeconds: number;
  trackCount: number;
}

/** Run the full bake (procedural variant + rebuilt Waddle + Blender Draco pass). */
export declare function bakeStegoVariant(options?: BakeStegoVariantOptions): Promise<BakeStegoVariantSummary>;
