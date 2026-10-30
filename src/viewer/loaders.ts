import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BRACHIO_GAIT, DinoPlayer, STEGO_GAIT, TRIKE_GAIT } from '../ranch/dino-player.js';
import type { DustPool } from '../ranch/dust.js';
import type { GaitParams } from '../ranch/waddle.js';

/**
 * Model loading and the rigged-vs-placeholder swap targets: every baked Draco
 * GLB URL, the blush cheek pass, and the loaders that wrap a walk clip in a
 * DinoPlayer. DOM- and renderer-free, so tests drive it with a stubbed
 * GLTFLoader while the viewer owns the WebGL chrome.
 */

/**
 * Path of the baked Trike GLB (Phase 1 pastel baby variant, Draco, <150 KB).
 * The viewer paints the procedural placeholder instantly and swaps to this
 * rigged model as soon as it loads, so boot stays green even when the
 * fetch fails.
 */
/** Deploy base: "/" locally and in tests, subpath-safe under a future base. */
const BASE_URL = import.meta.env.BASE_URL;

export const TRIKE_MODEL_URL = `${BASE_URL}models/trike.glb`;

/**
 * Path of the baked Stego GLB (Phase 2 pastel baby variant, Draco). Loads
 * through the same Draco path and walk-clip contract as the Trike, wrapped in a
 * DinoPlayer with STEGO_GAIT.
 */
export const STEGO_MODEL_URL = `${BASE_URL}models/stego.glb`;

/**
 * Path of the baked Brachio GLB (Phase 3 pastel baby variant, Draco). Loads
 * through the same Draco path and walk-clip contract as the Trike and Stego,
 * wrapped in a DinoPlayer with BRACHIO_GAIT.
 */
export const BRACHIO_MODEL_URL = `${BASE_URL}models/brachio.glb`;

/**
 * Clip names a dino GLB may give its walk loop, most preferred first.
 *
 * Walk is what Polyfork's authored clips are called and what the re-baked
 * Stego and Brachio ship; Waddle is the donor-retarget name the Trike's bake
 * still carries. The first match wins.
 *
 * There is deliberately no `animations[0]` fallback. The re-bake that renamed the
 * clips shipped Idle first, and the old fallback walked both new species on a
 * breathing pose for a whole phase without a single test noticing - a GLB with no
 * walk clip is a bake that needs looking at, not something to guess around.
 */
const WALK_CLIP_NAMES = ['Walk', 'Waddle'];

/** The walk loop out of a loaded GLB, or undefined when it ships no walk clip. */
function findWalkClip(animations: THREE.AnimationClip[]): THREE.AnimationClip | undefined {
  for (const name of WALK_CLIP_NAMES) {
    const clip = THREE.AnimationClip.findByName(animations, name);
    if (clip != null) {
      return clip;
    }
  }
  return undefined;
}

/**
 * The resting loop the two-action blend plays whenever the walk weight is zero
 * (FR-1). One name for every species: the bake grafts Polyfork's authored `Idle`
 * onto all three rigs, so there is no donor-retarget alias to allow for.
 */
const IDLE_CLIP_NAME = 'Idle';

/** The resting loop out of a loaded GLB, or undefined when it ships none. */
function findIdleClip(animations: THREE.AnimationClip[]): THREE.AnimationClip | undefined {
  const clip = THREE.AnimationClip.findByName(animations, IDLE_CLIP_NAME);
  return clip ?? undefined;
}

/**
 * Per-species in-game size, in one place (FR-4).
 *
 * The rule: **keep real-life ratios and leave the Triceratops at the size the
 * child already knows.** The Trike's GLB was baked at Polyfork `size: 0.6`, so
 * its shipped body-axis length is 3.7080 m (POSITION bounds of
 * `public/models/trike.glb`, measured for phase 4). Polyfork's adult reference
 * for the same animal is 6.26 m (`size_m`), so the child's Trike already sits
 * at
 *
 *     S = 3.7080 m / 6.26 m = 0.59233
 *
 * of authored proportions. Every species baked at authored proportions
 * (`size: 1.0`: Stego 6.4906 m, Brachio 12.5325 m) is drawn at that same `S`,
 * uniformly on x/y/z, which lands them at 3.844 m and 7.423 m — ratios to the
 * Trike of 1.04 and 2.00. The Trike itself takes 1: it is the reference `S` was
 * derived from, so scaling it would move the one size we are preserving.
 *
 * A bake must never decide gameplay scale again (FR-4): `size` is shape-only,
 * and this table is the single knob. Values are body-axis (z) extents.
 */
export const TRIKE_IN_GAME_BODY_LENGTH_METRES = 3.708;
/** Polyfork's published adult reference length for `triceratops-base`. */
export const TRICERATOPS_REFERENCE_BODY_LENGTH_METRES = 6.26;
/** S: the uniform group scale shared by every authored-proportion model. */
export const DINO_GROUP_SCALE =
  TRIKE_IN_GAME_BODY_LENGTH_METRES / TRICERATOPS_REFERENCE_BODY_LENGTH_METRES;
/** Authored (`size: 1.0`) body lengths of the shipped GLBs, in metres. */
export const AUTHORED_BODY_LENGTH_METRES = {
  trike: TRICERATOPS_REFERENCE_BODY_LENGTH_METRES,
  stego: 6.4906,
  brachio: 12.5325,
} as const;
/** What each rigged model occupies in game, in metres along its body axis. */
export const IN_GAME_BODY_LENGTH_METRES = {
  trike: TRIKE_IN_GAME_BODY_LENGTH_METRES,
  stego: AUTHORED_BODY_LENGTH_METRES.stego * DINO_GROUP_SCALE,
  brachio: AUTHORED_BODY_LENGTH_METRES.brachio * DINO_GROUP_SCALE,
} as const;

/** Blush pink for the runtime cheek spheres. */
export const BLUSH_HEX = 0xf2a0ac;
/** Blush cheek sphere radius in metres. */
export const BLUSH_CHEEK_RADIUS_METRES = 0.03;
/**
 * Cheek offsets in Head-bone local space, in metres: symmetric, low, forward.
 */
export const BLUSH_CHEEK_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [-0.09, -0.02, 0.1],
  [0.09, -0.02, 0.1],
];

/**
 * Pin two pink cheek spheres under the Head bone. No-op when the head bone
 * is missing (stub scene); idempotent — re-pinning removes old cheeks first.
 */
export function attachBlushCheeks(head: THREE.Object3D | null): THREE.Mesh[] {
  if (head === null) {
    return [];
  }
  // Snapshot: removing cheeks mutates the live children array mid-loop.
  for (const old of head.children.slice()) {
    if (old.name === 'Blush_L' || old.name === 'Blush_R') {
      head.remove(old);
    }
  }
  const material = new THREE.MeshStandardMaterial({
    color: BLUSH_HEX,
    roughness: 0.8,
  });
  const geometry = new THREE.SphereGeometry(BLUSH_CHEEK_RADIUS_METRES, 12, 8);
  return BLUSH_CHEEK_OFFSETS.map(([x, y, z], index) => {
    const cheek = new THREE.Mesh(geometry, material);
    cheek.name = index === 0 ? 'Blush_L' : 'Blush_R';
    cheek.position.set(x, y, z);
    head.add(cheek);
    return cheek;
  });
}

/** Rigged model plus its player, ready to swap into the scene. */
export interface LoadedDino {
  model: THREE.Object3D;
  player: DinoPlayer;
}

/** Legacy Trike loader name: identical shape to LoadedDino. */
export type LoadedTrike = LoadedDino;

/**
 * Load a baked Draco GLB and wrap its walk and idle clips in a DinoPlayer with
 * the given gait. DOM- and renderer-free (loader boundary only), so tests can
 * drive it with a stubbed GLTFLoader while the real viewer owns the WebGL
 * chrome. An injected DustPool is shared (FR-9); omitted, the player keeps a
 * private pool exactly as before.
 *
 * The decoder is three's own: `DRACOLoader` pre-resolves `../libs/draco/*`
 * through `import.meta.url`, and Vite emits those files under `assets/`, so no
 * decoder path is configured here (pointing it at a copy would fetch a second).
 */
async function loadDinoPlayer(
  modelUrl: string,
  species: string,
  gait: GaitParams,
  groupScale: number,
  sharedDust?: DustPool,
  random?: () => number,
  blinkRandom?: () => number,
): Promise<LoadedDino> {
  const draco = new DRACOLoader();
  try {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    const gltf = await loader.loadAsync(modelUrl);
    const carried = gltf.animations.map((animation) => animation.name).join(', ') || 'none';
    const clip = findWalkClip(gltf.animations);
    if (clip === undefined) {
      throw new Error(
        `${species} GLB has no walk clip (expected "${WALK_CLIP_NAMES.join('" or "')}"; it carries ` +
          `${carried})`,
      );
    }
    // FR-1: both clips or a loud failure. A one-clip fallback is exactly the
    // silent regression this track exists to remove - the shipped Idle used to
    // be dropped on the floor and every pause became a statue.
    const idleClip = findIdleClip(gltf.animations);
    if (idleClip === undefined) {
      throw new Error(
        `${species} GLB has no ${IDLE_CLIP_NAME} clip (the walk/rest blend needs one; it carries ` +
          `${carried})`,
      );
    }
    // In-game size is a uniform group scale, applied before the player exists so
    // DinoPlayer captures it as its squash/sleepy base (FR-4). One scalar: x/y/z
    // never diverge, and the bake stays shape-only.
    gltf.scene.scale.setScalar(groupScale);
    // Baked pastel baby look: the GLB already carries the pastel palette in
    // its vertex colors, so no runtime recolor runs here. Only pin blush
    // cheeks to the blink Head bone. No-op on models without a Head node.
    const player = new DinoPlayer(gltf.scene, {
      clip,
      idleClip,
      gait: worldGait(gait, groupScale),
      dust: sharedDust,
      random,
      blinkRandom,
    });
    attachBlushCheeks(player.head);
    return { model: gltf.scene, player };
  } finally {
    draco.dispose();
  }
}

/**
 * Convert a gait measured on the baked file into the gait the viewer applies.
 *
 * A stride is measured on the group at authored size (scale 1), but
 * `DinoPlayer` advances the root in **world** metres on top of whatever scale
 * the model carries. A model drawn at `groupScale` therefore covers
 * `strideMetres x groupScale` of ground per loop while the root moves
 * `strideMetres`, so the planted feet slide by the difference - the very
 * defect this track removed, reintroduced by the size change. Every gait
 * passes through here, so a species added later cannot forget it; the Trike is
 * scale 1 (its bake is the reference `S` was derived from) and is unchanged.
 */
export function worldGait(gait: GaitParams, groupScale: number): GaitParams {
  if (groupScale === 1) return gait;
  return { ...gait, strideMetres: gait.strideMetres * groupScale };
}

/**
 * Load the baked Trike GLB with the Trike gait (FR-2 behaviour unchanged).
 * Scale 1: the Trike's own bake is the reference `S` was derived from (FR-4),
 * so it keeps exactly the size it has always had.
 * `random`/`blinkRandom` are the dev harness's seeded streams (FR-8); omitted,
 * the player generates with `Math.random` exactly as before.
 */
export function loadTrikePlayer(
  sharedDust?: DustPool,
  random?: () => number,
  blinkRandom?: () => number,
): Promise<LoadedTrike> {
  return loadDinoPlayer(TRIKE_MODEL_URL, 'Trike', TRIKE_GAIT, 1, sharedDust, random, blinkRandom);
}

/** Load the baked Stego GLB with the Stego gait (FR-4), drawn at `DINO_GROUP_SCALE`. */
export function loadStegoPlayer(
  sharedDust?: DustPool,
  random?: () => number,
  blinkRandom?: () => number,
): Promise<LoadedDino> {
  return loadDinoPlayer(
    STEGO_MODEL_URL,
    'Stego',
    STEGO_GAIT,
    DINO_GROUP_SCALE,
    sharedDust,
    random,
    blinkRandom,
  );
}

/** Load the baked Brachio GLB with the Brachio walk gait (FR-1), drawn at `DINO_GROUP_SCALE`. */
export function loadBrachioPlayer(
  sharedDust?: DustPool,
  random?: () => number,
  blinkRandom?: () => number,
): Promise<LoadedDino> {
  return loadDinoPlayer(
    BRACHIO_MODEL_URL,
    'Brachio',
    BRACHIO_GAIT,
    DINO_GROUP_SCALE,
    sharedDust,
    random,
    blinkRandom,
  );
}
