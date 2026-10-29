import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { arc, cluster, DRESSING_CATALOGUE, ring, row } from './layout.js';
import type { DressingPlacement } from './layout.js';

/**
 * Valley + Farm dressing (FR-3, AC-3): the 12 vendored Polyfork CC0 GLBs in
 * `public/models/dressing` placed around — never inside — the dino walk area.
 * Every file is ground-origin (y = 0) with a single pastel material, so each
 * placement only sets a ground position plus a facing rotation.
 *
 * Since the trio walks at real proportions (Brachio 7.42 m), the ring the
 * props stand on is derived, not authored: half the biggest body length plus
 * the ground it covers turning round (FR-6, FR-7). Props keep the ranch
 * composition — a fence run with a gate, the trough/pump/well cluster on the
 * Ranch side, two corn rows as the garden marker and river stones ringing the
 * nest — but every one of them now clears the biggest animal's nose.
 *
 * The positions themselves are written as layout data in `layout.ts` (FR-1):
 * this module only composes them and turns them into scene objects.
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

export type { DressingPlacement };

export {
  GROUND_RADIUS_METRES,
  IN_FRAME_OVERSHOOT_METRES,
  WALK_CLEARANCE_METRES,
} from './layout.js';

/**
 * Widest footprint of each dressing GLB, in metres, measured across the
 * ground plane at the scale the manifest places it. Derived from the
 * `DRESSING_CATALOGUE` so the two can never disagree (FR-1, NFR-5). The
 * layout tests use these to keep props from overlapping each other and —
 * with the presets — to keep tall props out of a POV's sightline.
 */
export const DRESSING_FOOTPRINT_METRES: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(DRESSING_CATALOGUE).map(([file, entry]) => [file, entry.footprintMetres]),
);

/** PWA offline budget in bytes: the whole dressing set must stay under it. */
export const DRESSING_BUDGET_BYTES = 15_000_000;

/** Load outcome: counts plus the files skipped when their GLB failed. */
export interface DressingSummary {
  requested: number;
  placed: number;
  loadedFiles: number;
  failedFiles: string[];
}

/**
 * Valley backdrop: three pastel trees plus a boulder and a stump, spaced
 * around the rim so each of the three POV presets gets a backdrop and none of
 * them stands between a camera and the animal it names.
 */
const VALLEY_PLACEMENTS: readonly DressingPlacement[] = [
  ring('ginkgo-tree-baa895.glb', 28, 9.6, 'inward'),
  ring('dawn-redwood-001c29.glb', 200, 9.8, 'inward'),
  ring('flowering-magnolia-dd76cb.glb', 113, 9.7, 'inward'),
  ring('fern-covered-boulder-2e0375.glb', 180, 9.0, 'inward'),
  ring('moss-covered-stump-7253ab.glb', 70, 9.4, 'inward'),
];

/**
 * Farm set: a curved fence run with a farm-gate gap along the back rim, the
 * trough/pump/well cluster on the Brachio's corner (the Ranch view), two short
 * corn rows as the garden marker on the Stego's corner, and a river-stone ring
 * as the nest marker on the Trike's corner.
 *
 * The fence panels sit 12 deg apart on a 9.2 m ring — a 1.9 m chord, the width
 * of one panel — so the run reads as a continuous fence.
 */
const FARM_PLACEMENTS: readonly DressingPlacement[] = [
  ring('farm-gate-8ab320.glb', 260, 9.2, 'tangent'),
  ...arc('wooden-fence-section-d72055.glb', 272, 296, 3, 9.2),
  ring('water-trough-df3ced.glb', 338, 8.7, 'inward'),
  ring('hand-water-pump-448037.glb', 350, 9.1, 'inward'),
  ring('stone-well-b2dfcd.glb', 2, 9.0, 'inward'),
  // Two corn rows of three: a line of constant z each, the way a planted row
  // reads, with an authored spin per stalk so the rows never look stamped.
  ...row('corn-crop-b71f2f.glb', [-3.4, -8.55], 3, 'x', 0.3, [2.6, 1.9, 2.4]),
  ...row('corn-crop-b71f2f.glb', [-3.4, -9.05], 3, 'x', 0.3, [3.6, 2.9, 3.4]),
  // Four stones ringing a nest spot 18 deg along the rim from the Nest
  // preset, 0.43 m from its centre — a ring a child reads as "the nest",
  // beside the animal rather than in front of it.
  ...cluster('river-stone-cluster-0b55bc.glb', [-8.505, 3.095], 0.43, [
    { azimuthDegrees: 0, rotationY: 0.4 },
    { azimuthDegrees: 180, rotationY: 2.0 },
    { azimuthDegrees: 90, rotationY: 3.5 },
    { azimuthDegrees: 270, rotationY: 5.1 },
  ]),
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
