import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  DRESSING_CATALOGUE,
  DRESSING_MANIFEST,
  WALLOW_CENTRE_METRES,
  WALLOW_MUD_RADIUS_METRES,
  WATER_LINE_FLUSH_METRES,
  WATER_LINE_FROM_DEGREES,
  WATER_LINE_RADIUS_METRES,
  WATER_LINE_STONE_FILE,
  WATER_LINE_STONE_SINK_METRES,
  WATER_LINE_STONES,
  WATER_LINE_TO_DEGREES,
  WATER_LINE_WIDTH_METRES,
  WIND_PUMP_FILE,
} from './layout.js';
import type { DressingPlacement } from './layout.js';

/**
 * Ranch dressing (FR-1, FR-3, FR-5): the vendored Polyfork GLBs in
 * `public/models/dressing` placed around — never inside — the dino walk area.
 * Every file is ground-origin (y = 0), so each placement only sets a ground
 * position plus a facing rotation.
 *
 * Since the trio walks at real proportions (Brachio 7.42 m), the ring the
 * props stand on is derived, not authored: half the biggest body length plus
 * the ground it covers turning round (FR-6, FR-7). Phase 3 keeps that ring and
 * stages the three corners, the water line, the scatter and the treeline on top
 * of it (FR-13 to FR-18).
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

/** URL directory holding the vendored dressing GLBs. */
export const DRESSING_DIR_URL = `${BASE_URL}models/dressing`;

export type { DressingPlacement };
export { DRESSING_MANIFEST };

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

/** Height of each dressing GLB above its own ground origin, in metres (FR-6). */
export const DRESSING_HEIGHT_METRES: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(DRESSING_CATALOGUE).map(([file, entry]) => [file, entry.heightMetres]),
);

/** The band each vendored GLB belongs to, derived from the same catalogue. */
export const DRESSING_BAND_METRES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(DRESSING_CATALOGUE).map(([file, entry]) => [file, entry.band]),
);

/** The parent each scatter prop names, if it names one (FR-15). */
export const DRESSING_PARENT_FILE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(DRESSING_CATALOGUE).flatMap(([file, entry]) =>
    entry.parent === undefined ? [] : [[file, entry.parent]],
  ),
);

/** NFR-1: the whole vendored dressing set stays under this many bytes (4 MB). */
export const DRESSING_BUDGET_BYTES = 4_000_000;

/** NFR-1: the PWA precache — app, audio and dressing — stays under 15 MB. */
export const PRECACHE_BUDGET_BYTES = 15_000_000;

/** NFR-1 ceilings the dev snapshot is measured against. */
export const DRAW_CALL_CEILING = 150;
export const TRIANGLE_CEILING = 80_000;

/** FR-18: the windpump's fan turns at this rate, slow enough to read as weather. */
export const WIND_PUMP_RADIANS_PER_SECOND = 0.9;

/**
 * The hub sits this far up the tower, as a fraction of its measured height. A
 * windpump's fan is at the very top, a little below the vane.
 */
export const WIND_PUMP_HUB_HEIGHT_OF_TOWER = 0.88;

/** A built rotor: six blades, this long, in the plane the axle faces. */
export const WIND_PUMP_BLADE_COUNT = 6;
export const WIND_PUMP_BLADE_LENGTH_METRES = 0.55;
export const WIND_PUMP_BLADE_WIDTH_METRES = 0.14;
export const WIND_PUMP_BLADE_THICKNESS_METRES = 0.03;
/** The hub the blades turn on. */
export const WIND_PUMP_HUB_LENGTH_METRES = 0.08;
/** How far in front of the tower's centre the fan hangs, along its facing. */
export const WIND_PUMP_FAN_OFFSET_METRES = 0.25;

/** Wet stone the channel is cut into, a shade darker than the dry ring stones. */
const WATER_LINE_HEX = 0x6f7a6a;
/** How many segments the ring channel is cut into, for a smooth curve. */
const WATER_LINE_SEGMENTS = 120;
/** The channel's own render order, above the ground decals and below props. */
const WATER_LINE_RENDER_ORDER = 4;

/** Stego's wallow: wear earth, one tone wetter than the play disc (FR-13). */
const WALLOW_HEX = 0x7d6844;
/** How many segments the wallow disc is cut into, matching the wear discs. */
const WALLOW_SEGMENTS = 64;

const ROTOR_NAME_PATTERN = /(blade|rotor|fan|wheel|vane)/i;

/** The windpump's turning part, and which local axis it turns about. */
export interface DressingRotor {
  node: THREE.Object3D;
  axis: 'x' | 'y' | 'z';
}

/** A late-bound handle to the built dressing, so the render loop can spin it. */
export interface DressingFrame {
  dressing: DressingSummary | null;
}

/** Load outcome plus what the caller needs to keep the dressing animating. */
export interface DressingSummary {
  requested: number;
  placed: number;
  loadedFiles: number;
  failedFiles: string[];
  /** The `RanchDressing` group, already added to the scene. */
  group: THREE.Group;
  /** The water line, already added: channel plus its sunken stone tiles. */
  waterLine: THREE.Group | null;
  /** FR-18's turning fan, or null when the windpump failed to load. */
  rotor: DressingRotor | null;
  /** Draw calls the dressing adds, one per mesh and instance batch (NFR-1). */
  drawCalls: number;
  /** Triangles the dressing adds (NFR-1). */
  triangles: number;
}

function trianglesOf(mesh: THREE.Mesh | THREE.InstancedMesh): number {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const count = geometry.index !== null ? geometry.index.count : (position?.count ?? 0);
  const perInstance = mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
  return (count / 3) * perInstance;
}

/** Whole-set totals, for the budget test and the dev HUD (AC-8). */
export function measureDressing(root: THREE.Object3D): {
  drawCalls: number;
  triangles: number;
} {
  let drawCalls = 0;
  let triangles = 0;
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      drawCalls += 1;
      triangles += trianglesOf(child);
    }
  });
  return { drawCalls, triangles: Math.round(triangles) };
}

/**
 * The water line (FR-14): a ring channel, pump to trough to wallow, cut flush
 * into the ground. One mesh over 120 segments and one instanced batch of
 * sunken gutter stones — two draw calls for the whole run, against the sixteen
 * a cloned stone arc would cost.
 */
function buildWaterLine(cache: Map<string, THREE.Object3D>): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RanchWaterLine';

  const inner = WATER_LINE_RADIUS_METRES - WATER_LINE_WIDTH_METRES / 2;
  const outer = WATER_LINE_RADIUS_METRES + WATER_LINE_WIDTH_METRES / 2;
  const positions: number[] = [];
  const indices: number[] = [];
  const sweep = WATER_LINE_TO_DEGREES - WATER_LINE_FROM_DEGREES;
  for (let step = 0; step <= WATER_LINE_SEGMENTS; step += 1) {
    const degrees = WATER_LINE_FROM_DEGREES + (sweep * step) / WATER_LINE_SEGMENTS;
    const azimuth = (degrees * Math.PI) / 180;
    const cos = Math.cos(azimuth);
    const sin = Math.sin(azimuth);
    positions.push(inner * cos, 0, inner * sin, outer * cos, 0, outer * sin);
    if (step < WATER_LINE_SEGMENTS) {
      const start = step * 2;
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: WATER_LINE_HEX,
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    depthWrite: false,
  });
  const channel = new THREE.Mesh(geometry, material);
  channel.name = 'RanchWaterLineChannel';
  channel.receiveShadow = true;
  // AC-14: nothing the eye can find stands above the flush limit, and the
  // channel is a ribbon at y = 0 rather than a kerbed trough.
  channel.position.y = WATER_LINE_FLUSH_METRES / 2;
  channel.renderOrder = WATER_LINE_RENDER_ORDER;
  group.add(channel);

  const stoneSource = cache.get(WATER_LINE_STONE_FILE);
  const stoneMeshes: THREE.Mesh[] = [];
  stoneSource?.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      stoneMeshes.push(child);
    }
  });
  // One instanced batch per mesh the stone GLB is made of, so the tiling costs
  // a draw call per part rather than one per stone.
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  stoneMeshes.forEach((stone, partIndex) => {
    const tiles = new THREE.InstancedMesh(stone.geometry, stone.material, WATER_LINE_STONES.length);
    tiles.name = `RanchWaterLineStones-${partIndex}`;
    tiles.castShadow = true;
    tiles.receiveShadow = true;
    tiles.renderOrder = WATER_LINE_RENDER_ORDER + 1;
    WATER_LINE_STONES.forEach((tile, index) => {
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tile.rotationY);
      matrix.compose(
        new THREE.Vector3(tile.position[0], -WATER_LINE_STONE_SINK_METRES, tile.position[2]),
        quaternion,
        scale,
      );
      tiles.setMatrixAt(index, matrix);
    });
    tiles.instanceMatrix.needsUpdate = true;
    // The stones are sunk so their tops land on the flush limit, which is what
    // keeps the channel walkable at its stone edging too (AC-14).
    tiles.position.y = WATER_LINE_FLUSH_METRES / 2;
    group.add(tiles);
  });

  return group;
}

/**
 * Stego's wallow (FR-13, FR-14): a flush mud disc rimmed by the corner rocks and
 * the reeds, where the water line ends. Same flush recipe as the ground decals —
 * polygon offset, no depth write, an early render order.
 */
function buildWallow(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(WALLOW_MUD_RADIUS_METRES, WALLOW_SEGMENTS),
    new THREE.MeshStandardMaterial({
      color: WALLOW_HEX,
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      depthWrite: false,
    }),
  );
  mesh.name = 'RanchWallow';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(WALLOW_CENTRE_METRES[0], 0, WALLOW_CENTRE_METRES[1]);
  mesh.renderOrder = WATER_LINE_RENDER_ORDER - 1;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * One draw call per clone (NFR-1). Every Polyfork dressing GLB is a single
 * material over POSITION/NORMAL/COLOR_0 primitives, so the primitives bake into
 * one buffer with no visual change: 57 placements then cost 57 calls instead of
 * 224. Any file that does not fit that shape is left exactly as it came.
 */
function bakeToOneCall(root: THREE.Object3D): void {
  const meshes: THREE.Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshes.push(child);
    }
  });
  if (meshes.length <= 1) {
    return;
  }
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const local = new THREE.Matrix4();
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const mesh of meshes) {
    local.multiplyMatrices(rootInverse, mesh.matrixWorld);
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(local);
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (material === undefined) {
      return;
    }
    const group = byMaterial.get(material) ?? [];
    group.push(geometry);
    byMaterial.set(material, group);
  }
  const baked: THREE.Mesh[] = [];
  for (const [material, geometries] of byMaterial) {
    const geometry = mergeGeometries(geometries, false);
    if (geometry === null) {
      return;
    }
    baked.push(new THREE.Mesh(geometry, material));
  }
  for (const mesh of meshes) {
    mesh.removeFromParent();
  }
  for (const mesh of baked) {
    root.add(mesh);
  }
}

/** The fan node the windpump GLB ships with, if it names one. */
function findRotorNode(root: THREE.Object3D): THREE.Object3D | null {
  const matches: THREE.Object3D[] = [];
  root.traverse((child) => {
    if (child !== root && ROTOR_NAME_PATTERN.test(child.name)) {
      matches.push(child);
    }
  });
  return matches[0] ?? null;
}

/**
 * FR-18's fallback: a small fan of our own, standing in front of the tower's
 * vane, as one instanced batch plus a hub. It hangs off the scene rather than
 * the tower so its scale is 1 and it turns in a true circle.
 */
function buildRotor(
  scene: THREE.Scene,
  placement: DressingPlacement,
  heightMetres: number,
): DressingRotor {
  const rotor = new THREE.Group();
  rotor.name = 'RanchWindpumpRotor';
  const facing = placement.rotationY;
  rotor.position.set(
    placement.position[0] + Math.sin(facing) * WIND_PUMP_FAN_OFFSET_METRES,
    heightMetres * WIND_PUMP_HUB_HEIGHT_OF_TOWER,
    placement.position[2] + Math.cos(facing) * WIND_PUMP_FAN_OFFSET_METRES,
  );
  rotor.rotation.y = facing;

  const material = new THREE.MeshStandardMaterial({ color: 0xb9c2bb, roughness: 0.8 });
  const blades = new THREE.InstancedMesh(
    new THREE.BoxGeometry(
      WIND_PUMP_BLADE_WIDTH_METRES,
      WIND_PUMP_BLADE_LENGTH_METRES,
      WIND_PUMP_BLADE_THICKNESS_METRES,
    ),
    material,
    WIND_PUMP_BLADE_COUNT,
  );
  blades.name = 'RanchWindpumpBlades';
  blades.castShadow = true;
  blades.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let index = 0; index < WIND_PUMP_BLADE_COUNT; index += 1) {
    const angle = (index / WIND_PUMP_BLADE_COUNT) * Math.PI * 2;
    const radius = WIND_PUMP_BLADE_LENGTH_METRES / 2;
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
    matrix.compose(
      new THREE.Vector3(
        Math.cos(angle - Math.PI / 2) * radius,
        Math.sin(angle - Math.PI / 2) * radius,
        0,
      ),
      quaternion,
      scale,
    );
    blades.setMatrixAt(index, matrix);
  }
  blades.instanceMatrix.needsUpdate = true;

  const hubRadius = WIND_PUMP_BLADE_WIDTH_METRES / 2;
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(hubRadius, hubRadius, WIND_PUMP_HUB_LENGTH_METRES, 8),
    material,
  );
  hub.name = 'RanchWindpumpHub';
  hub.rotation.x = Math.PI / 2;
  hub.castShadow = true;
  hub.receiveShadow = true;

  rotor.add(blades, hub);
  scene.add(rotor);
  return { node: rotor, axis: 'z' };
}

/**
 * FR-18: turn the fan — slowly, and not at all under reduced motion. `dt` is
 * the clamped frame delta the loop already hands its other subsystems.
 */
export function updateDressing(
  dressing: DressingSummary | null | undefined,
  dt: number,
  reducedMotion: boolean,
): void {
  const rotor = dressing?.rotor;
  if (rotor === null || rotor === undefined || reducedMotion || dt <= 0) {
    return;
  }
  rotor.node.rotation[rotor.axis] -= WIND_PUMP_RADIANS_PER_SECOND * dt;
}

/**
 * Load every manifest GLB once, clone it per placement, and add the
 * `RanchDressing` group plus the `RanchWaterLine` group to the scene. Resolves
 * — never rejects — with a summary: failed files are skipped with a warning so
 * boot stays green offline (NFR-2). Loader-boundary only (DOM- and
 * renderer-free), so tests drive it with a stubbed GLTFLoader.
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
        bakeToOneCall(gltf.scene);
        cache.set(file, gltf.scene);
      } catch (error) {
        failedFiles.push(file);
        console.warn(`Ranch dressing unavailable: ${file}; skipping its props.`, error);
      }
    }),
  );

  let placed = 0;
  let rotor: DressingRotor | null = null;
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

    if (item.file === WIND_PUMP_FILE) {
      const bladeNode = findRotorNode(node);
      rotor =
        bladeNode === null
          ? buildRotor(scene, item, DRESSING_CATALOGUE[WIND_PUMP_FILE]?.heightMetres ?? 0)
          : { node: bladeNode, axis: 'z' };
    }
  }
  scene.add(group);

  const waterLine = buildWaterLine(cache);
  scene.add(waterLine);

  const wallow = buildWallow();
  scene.add(wallow);

  const measured = measureDressing(group);
  const waterLineMeasured = measureDressing(waterLine);
  const wallowMeasured = measureDressing(wallow);
  const rotorMeasured =
    rotor !== null && rotor.node.parent === scene ? measureDressing(rotor.node) : null;

  return {
    requested: DRESSING_MANIFEST.length,
    placed,
    loadedFiles: cache.size,
    failedFiles: failedFiles.sort(),
    group,
    waterLine: waterLine.children.length === 0 ? null : waterLine,
    rotor,
    drawCalls:
      measured.drawCalls +
      waterLineMeasured.drawCalls +
      wallowMeasured.drawCalls +
      (rotorMeasured?.drawCalls ?? 0),
    triangles:
      measured.triangles +
      waterLineMeasured.triangles +
      wallowMeasured.triangles +
      (rotorMeasured?.triangles ?? 0),
  };
}
