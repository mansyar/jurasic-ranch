import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BRACHIO_GAIT, DinoPlayer, STEGO_GAIT, TRIKE_GAIT } from '../ranch/dino-player.js';
import type { DustPool } from '../ranch/dust.js';
import type { GaitParams } from '../ranch/waddle.js';

/**
 * Model loading and the rigged-vs-placeholder swap targets: every baked Draco
 * GLB URL, the blush cheek pass, and the loaders that wrap a `Waddle` clip in
 * a DinoPlayer. DOM- and renderer-free, so tests drive it with a stubbed
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
 * through the same Draco path and prefer-Waddle-else-first contract as the
 * Trike, wrapped in a DinoPlayer with STEGO_GAIT.
 */
export const STEGO_MODEL_URL = `${BASE_URL}models/stego.glb`;

/**
 * Path of the baked Brachio GLB (Phase 3 pastel baby variant, Draco). Loads
 * through the same Draco path and prefer-Waddle-else-first contract as the
 * Trike and Stego, wrapped in a DinoPlayer with BRACHIO_GAIT.
 */
export const BRACHIO_MODEL_URL = `${BASE_URL}models/brachio.glb`;

/** Name of the baked seamless loop inside the Trike GLB. */
const WADDLE_CLIP_NAME = 'Waddle';

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
 * Load a baked Draco GLB and wrap its `Waddle` clip in a DinoPlayer with the
 * given gait. DOM- and renderer-free (loader boundary only), so tests can
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
  sharedDust?: DustPool,
): Promise<LoadedDino> {
  const draco = new DRACOLoader();
  try {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    const gltf = await loader.loadAsync(modelUrl);
    const clip: THREE.AnimationClip | undefined =
      THREE.AnimationClip.findByName(gltf.animations, WADDLE_CLIP_NAME) ?? gltf.animations[0];
    if (clip === undefined) {
      throw new Error(`${species} GLB has no animations (expected "${WADDLE_CLIP_NAME}")`);
    }
    // Baked pastel baby look: the GLB already carries the pastel palette in
    // its vertex colors, so no runtime recolor runs here. Only pin blush
    // cheeks to the blink Head bone. No-op on models without a Head node.
    const player = new DinoPlayer(gltf.scene, { clip, gait, dust: sharedDust });
    attachBlushCheeks(player.head);
    return { model: gltf.scene, player };
  } finally {
    draco.dispose();
  }
}

/** Load the baked Trike GLB with the Trike gait (FR-2 behaviour unchanged). */
export function loadTrikePlayer(sharedDust?: DustPool): Promise<LoadedTrike> {
  return loadDinoPlayer(TRIKE_MODEL_URL, 'Trike', TRIKE_GAIT, sharedDust);
}

/** Load the baked Stego GLB with the Stego gait (FR-4). */
export function loadStegoPlayer(sharedDust?: DustPool): Promise<LoadedDino> {
  return loadDinoPlayer(STEGO_MODEL_URL, 'Stego', STEGO_GAIT, sharedDust);
}

/** Load the baked Brachio GLB with the Brachio shuffle gait (FR-1). */
export function loadBrachioPlayer(sharedDust?: DustPool): Promise<LoadedDino> {
  return loadDinoPlayer(BRACHIO_MODEL_URL, 'Brachio', BRACHIO_GAIT, sharedDust);
}
