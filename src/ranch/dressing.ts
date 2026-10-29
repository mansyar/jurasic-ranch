import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DINO_WALK_RADIUS_METRES, LARGEST_DINO_BODY_LENGTH_METRES } from './avoidance.js';

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
 * Margin between the walk circle and the furthest a body centre actually
 * reaches, in metres. The per-gait bound is
 * `speed x (PI / min(turnRate, curvature x speed) + WALK_BLEND_SECONDS)`, which
 * phase 4 evaluated at 0.771 m (trike), 0.894 m (stego) and 0.904 m (brachio)
 * over a 0.8 m circle, and measured 1.347 / 1.414 / 1.099 m from the origin.
 * Rounded up so the ring never has to be re-measured unless a stride or a turn
 * rate changes; the dressing test recomputes all three bounds.
 */
export const IN_FRAME_OVERSHOOT_METRES = 0.91;

/**
 * Dino walk clearance in metres (FR-7): the circle the body centres wander
 * inside, the ground a dino covers overshooting it, and half the largest body
 * length of nose and tail around that centre. Nothing may be placed inside
 * this, so no prop can touch the Brachio at any point of its loop.
 */
export const WALK_CLEARANCE_METRES =
  DINO_WALK_RADIUS_METRES + IN_FRAME_OVERSHOOT_METRES + LARGEST_DINO_BODY_LENGTH_METRES / 2;

/**
 * Viewer ground circle radius in metres: the walk clearance plus half a body
 * length of grass beyond the prop ring, so the dressing rings a clearing
 * rather than a cliff and every prop still stands on the ground it belongs to.
 */
export const GROUND_RADIUS_METRES = WALK_CLEARANCE_METRES + LARGEST_DINO_BODY_LENGTH_METRES / 2;

/**
 * Widest footprint of each dressing GLB, in metres, measured across the
 * ground plane at the scale the manifest places it. The layout tests use these
 * to keep props from overlapping each other and — with the presets — to keep
 * tall props out of a POV's sightline (FR-8, AC-7). Only the widest of each is
 * recorded: the tests ask "could this cover the animal", never "by how much".
 */
export const DRESSING_FOOTPRINT_METRES: Readonly<Record<string, number>> = {
  'ginkgo-tree-baa895.glb': 3.4,
  'dawn-redwood-001c29.glb': 3.4,
  'flowering-magnolia-dd76cb.glb': 3.6,
  'fern-covered-boulder-2e0375.glb': 2.4,
  'moss-covered-stump-7253ab.glb': 1.3,
  'wooden-fence-section-d72055.glb': 2.0,
  'farm-gate-8ab320.glb': 1.7,
  'water-trough-df3ced.glb': 2.0,
  'hand-water-pump-448037.glb': 1.2,
  'stone-well-b2dfcd.glb': 1.7,
  'corn-crop-b71f2f.glb': 1.3,
  'river-stone-cluster-0b55bc.glb': 1.6,
};

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

/** Which way a ring placement turns: the models are authored facing +Z. */
type RingFacing = 'inward' | 'outward' | 'tangent';

/**
 * Place a prop on the dressing ring.
 *
 * `azimuthDegrees` is the compass angle around the ranch (+X = 0, +Z = 90),
 * which is what makes the composition readable: the farm cluster sits on the
 * Brachio's corner, the corn on the Stego's, the nest stones on the Trike's.
 * `facing` is derived from the same azimuth rather than hand-tuned, so a prop
 * that moves around the rim still points the way it should:
 *
 * - `inward`/`outward` — the model's own +Z points at or away from the middle.
 * - `tangent` — its long axis (local X, which is how the fence panels are
 *   baked: 2 m of width along x at rotationY 0) follows the rim, so a run of
 *   panels reads as one curved fence.
 */
function onRing(
  file: string,
  azimuthDegrees: number,
  radiusMetres: number,
  facing: RingFacing,
): DressingPlacement {
  const azimuth = (azimuthDegrees * Math.PI) / 180;
  const rotationY =
    facing === 'tangent'
      ? -azimuth - Math.PI / 2
      : facing === 'inward'
        ? azimuth + Math.PI
        : azimuth;
  return {
    file,
    position: [radiusMetres * Math.cos(azimuth), 0, radiusMetres * Math.sin(azimuth)],
    rotationY,
  };
}

/**
 * Valley backdrop: three pastel trees plus a boulder and a stump, spaced
 * around the rim so each of the three POV presets gets a backdrop and none of
 * them stands between a camera and the animal it names.
 */
const VALLEY_PLACEMENTS: readonly DressingPlacement[] = [
  onRing('ginkgo-tree-baa895.glb', 28, 9.6, 'inward'),
  onRing('dawn-redwood-001c29.glb', 200, 9.8, 'inward'),
  onRing('flowering-magnolia-dd76cb.glb', 113, 9.7, 'inward'),
  onRing('fern-covered-boulder-2e0375.glb', 180, 9.0, 'inward'),
  onRing('moss-covered-stump-7253ab.glb', 70, 9.4, 'inward'),
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
  onRing('farm-gate-8ab320.glb', 260, 9.2, 'tangent'),
  onRing('wooden-fence-section-d72055.glb', 272, 9.2, 'tangent'),
  onRing('wooden-fence-section-d72055.glb', 284, 9.2, 'tangent'),
  onRing('wooden-fence-section-d72055.glb', 296, 9.2, 'tangent'),
  onRing('water-trough-df3ced.glb', 338, 8.7, 'inward'),
  onRing('hand-water-pump-448037.glb', 350, 9.1, 'inward'),
  onRing('stone-well-b2dfcd.glb', 2, 9.0, 'inward'),
  // Two corn rows of three. Literal x/z (not ring angles) so each row is a
  // straight line of constant z, the way a planted row actually reads.
  { file: 'corn-crop-b71f2f.glb', position: [-3.4, 0, -8.55], rotationY: 2.6 },
  { file: 'corn-crop-b71f2f.glb', position: [-3.1, 0, -8.55], rotationY: 1.9 },
  { file: 'corn-crop-b71f2f.glb', position: [-2.8, 0, -8.55], rotationY: 2.4 },
  { file: 'corn-crop-b71f2f.glb', position: [-3.4, 0, -9.05], rotationY: 3.6 },
  { file: 'corn-crop-b71f2f.glb', position: [-3.1, 0, -9.05], rotationY: 2.9 },
  { file: 'corn-crop-b71f2f.glb', position: [-2.8, 0, -9.05], rotationY: 3.4 },
  // Four stones ringing a nest spot 18 deg along the rim from the Nest
  // preset, 0.43 m from its centre — a ring a child reads as "the nest",
  // beside the animal rather than in front of it.
  { file: 'river-stone-cluster-0b55bc.glb', position: [-8.075, 0, 3.095], rotationY: 0.4 },
  { file: 'river-stone-cluster-0b55bc.glb', position: [-8.935, 0, 3.095], rotationY: 2.0 },
  { file: 'river-stone-cluster-0b55bc.glb', position: [-8.505, 0, 3.525], rotationY: 3.5 },
  { file: 'river-stone-cluster-0b55bc.glb', position: [-8.505, 0, 2.665], rotationY: 5.1 },
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
