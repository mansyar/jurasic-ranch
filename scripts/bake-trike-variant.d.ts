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

/** Extract the first animation's channels from raw GLB bytes, plus its validated root scale. */
export declare function extractAnimationTracks(bytes: Uint8Array): GlbAnimationData;

/** One authored clip read out of a GLB: name, duration and every channel. */
export interface AuthoredClip {
  name: string;
  durationSeconds: number;
  channels: GlbAnimationChannel[];
}

/** Every animation in raw GLB bytes, in file order. */
export declare function extractAnimationClips(bytes: Uint8Array): AuthoredClip[];

/** Clips Polyfork publishes on the dino GLBs; only the source set is checked against it. */
export declare const PUBLISHED_CLIP_NAMES: string[];

/** Clips the shipped GLBs carry, in order: Idle and Walk. Run is withdrawn. */
export declare const SHIPPED_CLIP_NAMES: string[];

/**
 * Keep only the clips that ship, after asserting the download still carries the
 * full published set. Returns them in `PUBLISHED_CLIP_NAMES` order.
 */
export declare function selectShippedClips(
  authored: AuthoredClip[],
  names?: string[],
): AuthoredClip[];

export interface GraftAuthoredClipsOptions {
  /** Clip names the GLB must carry exactly; defaults to `SHIPPED_CLIP_NAMES`. */
  requiredClipNames?: string[];
}

/**
 * Graft authored clips onto a baked skeleton: translation and rotation only,
 * times and values verbatim. Throws before anything is written when a clip
 * names a bone the rig lacks or the GLB's clip set is unexpected.
 */
export declare function graftAuthoredClips(
  skeletonRoot: THREE.Object3D,
  animations: AuthoredClip[],
  options?: GraftAuthoredClipsOptions,
): THREE.AnimationClip[];

export interface InjectGlbAnimationsOptions {
  /** Clip names the authored set must be exactly; defaults to `SHIPPED_CLIP_NAMES`. */
  requiredClipNames?: string[];
}

/**
 * Inject authored clips into an exported GLB by editing its JSON chunk: key
 * times, values and interpolation verbatim, `target.node` remapped by joint
 * name, translation and rotation only. Throws before anything is written when
 * the exported rig lacks an animated bone.
 */
export declare function injectGlbAnimations(
  glbBytes: Uint8Array,
  authored: AuthoredClip[],
  options?: InjectGlbAnimationsOptions,
): Uint8Array;

/** Serialise a glTF document and its BIN chunk into a deterministic GLB. */
export declare function writeGlb(json: Record<string, unknown>, bin: Uint8Array): Uint8Array;

/**
 * Read a written GLB back and assert the authored clips survived unchanged
 * (names, order, channel count, keyframe count, duration, paths only
 * translation + rotation). Returns the clips it read.
 */
export declare function assertAuthoredClipsPreserved(
  glbBytes: Uint8Array,
  authored: AuthoredClip[],
): AuthoredClip[];

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
