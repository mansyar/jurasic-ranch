import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Valley + Farm dressing (FR-3, AC-3): the 12 vendored Polyfork CC0 GLBs in
 * `public/models/dressing` placed around — never inside — the dino walk area.
 * Every file is ground-origin (y = 0) with a single pastel material, so each
 * placement only sets a ground position plus a facing rotation.
 *
 * Loading is best-effort per file (NFR-2 offline safety): any GLB that fails
 * to fetch is skipped with a console warning and the ranch still boots.
 * The vendored dressing carries no Draco extensions, so a plain GLTFLoader
 * suffices — no decoder download, no extra dependency.
 */

/** Deploy base: '/' locally and in tests, subpath-safe under a future base. */
const BASE_URL = import.meta.env.BASE_URL;

/** URL directory holding the 12 vendored dressing GLBs. */
export const DRESSING_DIR_URL = `${BASE_URL}models/dressing`;

/**
 * Dino stay-in-frame wander radius in metres (mirrors the Trike/Stego gaits):
 * every prop must sit outside this circle around the origin.
 */
export const WALK_CLEARANCE_METRES = 0.8;

/** Viewer ground circle radius in metres (mirrors the CircleGeometry in main). */
export const GROUND_RADIUS_METRES = 6;

/** PWA offline budget in bytes: the whole dressing set must stay under it. */
export const DRESSING_BUDGET_BYTES = 15_000_000;

/** One prop instance: which GLB, where on the ground, which way it faces. */
export interface DressingPlacement {
  file: string;
  position: readonly [number, number, number];
  rotationY: number;
}

/** Load outcome: counts plus the files skipped when their GLB failed. */
export interface DressingSummary {
  requested: number;
  placed: number;
  loadedFiles: number;
  failedFiles: string[];
}

/**
 * Valley backdrop (P2.T2): three pastel trees plus a boulder and a stump
 * scattered near the ground rim, all outside the 0.8 m walk circle and clear
 * of the fixed POV cameras.
 */
const VALLEY_PLACEMENTS: readonly DressingPlacement[] = [
  { file: 'ginkgo-tree-baa895.glb', position: [-3.0, 0, -2.5], rotationY: 0.6 },
  { file: 'dawn-redwood-001c29.glb', position: [3.1, 0, -2.2], rotationY: -0.4 },
  { file: 'flowering-magnolia-dd76cb.glb', position: [-0.5, 0, -4.2], rotationY: 2.1 },
  { file: 'fern-covered-boulder-2e0375.glb', position: [4.0, 0, 0.8], rotationY: 1.2 },
  { file: 'moss-covered-stump-7253ab.glb', position: [-4.0, 0, 0.6], rotationY: -1.0 },
];

/**
 * Farm set (P2.T3): a fence run with a farm-gate gap along the back rim, a
 * Ranch-side trough/pump/well cluster, 2 short corn rows as the garden
 * marker, and a river-stone ring as the nest marker. All outside the 0.8 m
 * walk circle and clear of the fixed POV cameras.
 */
const FARM_PLACEMENTS: readonly DressingPlacement[] = [
  { file: 'wooden-fence-section-d72055.glb', position: [-3.4, 0, -3.2], rotationY: 0 },
  { file: 'wooden-fence-section-d72055.glb', position: [-1.4, 0, -3.2], rotationY: 0 },
  { file: 'wooden-fence-section-d72055.glb', position: [0.6, 0, -3.2], rotationY: 0 },
  { file: 'farm-gate-8ab320.glb', position: [2.6, 0, -3.2], rotationY: 0 },
  { file: 'water-trough-df3ced.glb', position: [2.2, 0, 1.6], rotationY: -0.5 },
  { file: 'hand-water-pump-448037.glb', position: [2.9, 0, 0.9], rotationY: -0.9 },
  { file: 'stone-well-b2dfcd.glb', position: [1.4, 0, 2.3], rotationY: 0.3 },
  { file: 'corn-crop-b71f2f.glb', position: [-1.4, 0, 2.0], rotationY: 0.1 },
  { file: 'corn-crop-b71f2f.glb', position: [-0.9, 0, 2.0], rotationY: -0.1 },
  { file: 'corn-crop-b71f2f.glb', position: [-0.4, 0, 2.0], rotationY: 0.1 },
  { file: 'corn-crop-b71f2f.glb', position: [-1.4, 0, 2.8], rotationY: -0.1 },
  { file: 'corn-crop-b71f2f.glb', position: [-0.9, 0, 2.8], rotationY: 0.1 },
  { file: 'corn-crop-b71f2f.glb', position: [-0.4, 0, 2.8], rotationY: -0.1 },
  { file: 'river-stone-cluster-0b55bc.glb', position: [-1.75, 0, -0.6], rotationY: 0 },
  { file: 'river-stone-cluster-0b55bc.glb', position: [-2.2, 0, -0.15], rotationY: 1.6 },
  { file: 'river-stone-cluster-0b55bc.glb', position: [-2.65, 0, -0.6], rotationY: 3.1 },
  { file: 'river-stone-cluster-0b55bc.glb', position: [-2.2, 0, -1.05], rotationY: 4.7 },
];

/**
 * Full ranch dressing manifest: valley backdrop plus the Farm set.
 */
export const DRESSING_MANIFEST: readonly DressingPlacement[] = [
  ...VALLEY_PLACEMENTS,
  ...FARM_PLACEMENTS,
];

/**
 * Load every manifest GLB once, clone it per placement, and add the
 * `RanchDressing` group to the scene. Resolves — never rejects — with a
 * summary: failed files are skipped with a warning so boot stays green
 * offline (NFR-2). Loader-boundary only (DOM- and renderer-free), so tests
 * drive it with a stubbed GLTFLoader.
 */
export async function buildDressing(scene: THREE.Scene): Promise<DressingSummary> {
  const group = new THREE.Group();
  group.name = 'RanchDressing';

  const loader = new GLTFLoader();
  const cache = new Map<string, THREE.Object3D>();
  const failedFiles: string[] = [];
  const uniqueFiles = [...new Set(DRESSING_MANIFEST.map((item) => item.file))];
  await Promise.all(
    uniqueFiles.map(async (file) => {
      try {
        const gltf = await loader.loadAsync(`${DRESSING_DIR_URL}/${file}`);
        cache.set(file, gltf.scene);
      } catch (error) {
        failedFiles.push(file);
        console.warn(`Ranch dressing unavailable: ${file}; skipping its props.`, error);
      }
    }),
  );

  let placed = 0;
  for (const item of DRESSING_MANIFEST) {
    const source = cache.get(item.file);
    if (source === undefined) {
      continue;
    }
    const node = source.clone(true);
    node.position.set(item.position[0], item.position[1], item.position[2]);
    node.rotation.y = item.rotationY;
    node.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    group.add(node);
    placed += 1;
  }
  scene.add(group);

  return {
    requested: DRESSING_MANIFEST.length,
    placed,
    loadedFiles: cache.size,
    failedFiles: failedFiles.sort(),
  };
}
