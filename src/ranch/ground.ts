import * as THREE from 'three';
import { trioSpawnPositions } from './avoidance.js';
import { BRACHIO_GAIT, STEGO_GAIT, TRIKE_GAIT } from './dino-player.js';
import { DRESSING_MANIFEST } from './dressing.js';
import { DRESSING_CATALOGUE, GROUND_RADIUS_METRES } from './layout.js';
import type { GaitParams } from './waddle.js';

/**
 * The ground the ranch stands in (FR-3, FR-4): a two-tone meadow far wider than
 * the play disc, the wear the trio leaves in the middle of it, and the dirt
 * stub that joins the farm gate to that wear.
 *
 * Two things here are load-bearing rather than decorative:
 *
 * - **The apron outruns the frame.** `MEADOW_RADIUS_METRES` and the seam are
 *   derived from the play radius, and `CAMERA_FAR_METRES` from the meadow, so
 *   the far plane can never clip the ground the frame is looking at. The tests
 *   hold them against the live presets and the overlay maths in
 *   `frameEdgeGround()`: change a lens in phase 4 and the derivation is checked
 *   again instead of silently invalidated.
 * - **The seam is a tone change, not a cliff.** The apron carries a radial
 *   vertex-colour gradient that ends on exactly the sky's horizon tone, so the
 *   ground's own boundary lands on the same colour as the sky above it.
 *
 * Pure geometry construction: no `document`, no WebGL context, no work at
 * import time, so a Node test can build the whole meadow and measure it.
 */

/** Alpha segments in the ground discs: a 96 m circle still reads round. */
const GROUND_SEGMENTS = 128;

/**
 * How many play radii wide the two-tone meadow is. Four rather than the three
 * FR-3 asks for: the apron then stays one whole play radius wider than the seam
 * (`MEADOW_RADIUS_METRES - GROUND_SEAM_RADIUS_METRES > GROUND_RADIUS_METRES`),
 * so the near tone reads as the paddock and the far tone as the field, not as
 * two bands of a pie.
 */
const MEADOW_PLAY_RADII = 4;

/**
 * Meadow radius in metres (FR-3, AC-7): the ground every preset stands on, and
 * the radius `CAMERA_FAR_METRES` is derived from.
 */
export const MEADOW_RADIUS_METRES = GROUND_RADIUS_METRES * MEADOW_PLAY_RADII;

/**
 * Radius of the boundary between the play tone and the meadow tone, in metres
 * (FR-3). Two and a half play radii puts the seam outside every preset (the
 * lenses stand at 15.2-17.8 m), so the join that would cut across a shot is
 * behind the lens rather than in it. The tests assert that against the live
 * preset distances.
 */
const SEAM_PLAY_RADII = 2.5;
export const GROUND_SEAM_RADIUS_METRES = GROUND_RADIUS_METRES * SEAM_PLAY_RADII;

/**
 * Camera far plane in metres: twice the meadow. A preset looks across the
 * whole meadow from its own edge, so the apron must survive a lens standing a
 * meadow radius inside the rim — one meadow of slack is what guarantees that
 * (`CAMERA_FAR_METRES > MEADOW_RADIUS_METRES + preset distance`).
 */
const FAR_MEADOW_MULTIPLE = 2;
export const CAMERA_FAR_METRES = MEADOW_RADIUS_METRES * FAR_MEADOW_MULTIPLE;

/**
 * Play tone, unchanged from the disc the ranch has always stood on (NFR-4).
 * The apron is mixed towards the horizon tone instead of being a second flat
 * green, so the two tones stay related on purpose.
 */
export const GROUND_PLAY_HEX = 0x7ec850;

/**
 * The tone the meadow ends on and the sky begins on (FR-3, FR-17): pale, warm
 * white with a green cast. Both the apron's outer ring and the sky's horizon
 * use this one value, which is what makes the join read as distance rather
 * than as the edge of the world.
 */
export const HORIZON_HEX = 0xe9f1e6;

/**
 * Tone of the apron where it leaves the play disc: the play tone itself, so the
 * seam is a radius and not a line. Both sides of it share one authored colour
 * and one material light response, which makes the join zero-contrast at every
 * preset and under any light — the only way a 30 m boundary across a field can
 * honestly be called unseeable (FR-3).
 */
export const GROUND_APRON_INNER_HEX = GROUND_PLAY_HEX;

/** Tone of the apron where it meets the sky: the horizon tone itself. */
export const GROUND_APRON_OUTER_HEX = HORIZON_HEX;

/** Blend two authored sRGB tones in the renderer's working space. */
function mixHex(from: number, to: number, amount: number): number {
  return new THREE.Color(from).lerp(new THREE.Color(to), amount).getHex();
}

/** Discarded by foot traffic: the play green mixed towards dry earth. */
const WEAR_EARTH_HEX = 0x8a7a56;
const WEAR_EARTH_MIX = 0.4;

/** Dirt of the gate path, and the same tone for the trackways it carries. */
export const GROUND_DIRT_HEX = 0x9c7f52;

/** Tone of the worn middle (FR-4). */
export const GROUND_WEAR_HEX = mixHex(GROUND_PLAY_HEX, WEAR_EARTH_HEX, WEAR_EARTH_MIX);

/** A dino species a worn disc belongs to. */
export type WearSpecies = 'trike' | 'stego' | 'brachio';

/**
 * The three gaits by species. The worn disc radius is each gait's own
 * `wanderRadiusMetres`, so the wear is exactly the ground that species walks
 * (FR-4) and a gait retune moves the decal with it.
 */
const WEAR_GAITS: Readonly<Record<WearSpecies, GaitParams>> = {
  trike: TRIKE_GAIT,
  stego: STEGO_GAIT,
  brachio: BRACHIO_GAIT,
};

/**
 * Spawn order shared with `trioSpawnPositions()` and the boot placement. The
 * ground tests re-derive the pairing through `POV_FOCUS_SPAWN_INDEX`, so a
 * wrong order here cannot pass by agreeing with itself.
 */
const WEAR_SPECIES_ORDER: readonly WearSpecies[] = ['trike', 'stego', 'brachio'];

/** One worn disc: which dino, where its spawn is, how far it wanders. */
export interface WornDisc {
  species: WearSpecies;
  centre: readonly [number, number];
  radiusMetres: number;
}

/**
 * The wear trefoil (FR-4): one disc per dino, centred on that dino's spawn
 * position with the radius of its own gait wander circle.
 */
export const WORN_DISCS: readonly WornDisc[] = WEAR_SPECIES_ORDER.map((species, index) => {
  const spawn = trioSpawnPositions()[index];
  return {
    species,
    centre: [spawn.x, spawn.z] as const,
    radiusMetres: WEAR_GAITS[species].wanderRadiusMetres,
  };
});

/** GLB whose placement anchors the gate path. */
const FARM_GATE_FILE = 'farm-gate-8ab320.glb';

/** Fraction of the gate's footprint a footpath is drawn at. */
const PATH_WIDTH_OF_GATE = 0.5;

/**
 * Radius the gate stub reaches inwards to, as a fraction of the play radius.
 * A third of the play radius lands inside a worn disc on the gate's own bearing
 * (`GROUND_RADIUS_METRES / 3` against the wear boundary at 4.77 m), so the stub
 * visibly runs *into* the wear rather than stopping short of it.
 */
const PATH_INNER_PLAY_FRACTION = 1 / 3;

/** Two ruts, this far either side of the path centre line, as a fraction of its width. */
const TRACKWAY_OFFSET_OF_PATH = 0.22;

/** Rut length and width as fractions of the path width. */
const TRACKWAY_LENGTH_OF_PATH = 2;
const TRACKWAY_WIDTH_OF_PATH = 0.25;

/** The dirt stub from the farm gate into the wear (FR-4). */
export interface GateStub {
  /** Ground point at the gate itself. */
  start: readonly [number, number];
  /** Ground point where the stub reaches the wear. */
  end: readonly [number, number];
  /** Compass bearing of the stub, in radians (+X = 0, +Z = 90 deg). */
  bearingRadians: number;
  widthMetres: number;
  lengthMetres: number;
}

/**
 * The gate stub, derived from the farm gate's own placement in
 * `DRESSING_MANIFEST` (the 260 deg gate in the fence run), so moving the gate
 * moves the path with it. Throws when the manifest has lost the gate: a ranch
 * with no gate is a layout bug, not a state to render around.
 */
export function gateStub(): GateStub {
  const gate = DRESSING_MANIFEST.find((item) => item.file === FARM_GATE_FILE);
  if (gate === undefined) {
    throw new Error(`${FARM_GATE_FILE} is missing from the dressing manifest`);
  }
  const catalogue = DRESSING_CATALOGUE[FARM_GATE_FILE];
  if (catalogue === undefined) {
    throw new Error(`${FARM_GATE_FILE} is missing from the dressing catalogue`);
  }
  const [startX, , startZ] = gate.position;
  const bearing = Math.atan2(startZ, startX);
  const innerRadius = GROUND_RADIUS_METRES * PATH_INNER_PLAY_FRACTION;
  return {
    start: [startX, startZ] as const,
    end: [innerRadius * Math.cos(bearing), innerRadius * Math.sin(bearing)] as const,
    bearingRadians: bearing,
    widthMetres: catalogue.footprintMetres * PATH_WIDTH_OF_GATE,
    lengthMetres: Math.hypot(startX, startZ) - innerRadius,
  };
}

/** One trackway rut at the junction of the gate path and the wear (FR-4). */
export interface GroundTrackway {
  centre: readonly [number, number];
  rotationY: number;
  lengthMetres: number;
  widthMetres: number;
}

/**
 * The two trackways at the junction (FR-4): rut pairs either side of the gate
 * path's centre line, both rotated to the path so they read as marks left
 * walking in through the gate.
 */
export function groundTrackways(): readonly GroundTrackway[] {
  const stub = gateStub();
  const along: readonly [number, number] = [
    Math.cos(stub.bearingRadians),
    Math.sin(stub.bearingRadians),
  ];
  const across: readonly [number, number] = [-along[1], along[0]];
  const offset = stub.widthMetres * TRACKWAY_OFFSET_OF_PATH;
  const rotationY = -stub.bearingRadians;
  return [1, -1].map((side) => ({
    centre: [
      stub.end[0] + across[0] * offset * side,
      stub.end[1] + across[1] * offset * side,
    ] as const,
    rotationY,
    lengthMetres: stub.widthMetres * TRACKWAY_LENGTH_OF_PATH,
    widthMetres: stub.widthMetres * TRACKWAY_WIDTH_OF_PATH,
  }));
}

/** Where a decal sits relative to the ground: flush, offset forward, no depth write. */
const DECAL_OFFSET_FACTOR = -4;
const DECAL_OFFSET_UNITS = -4;
const DECAL_SEGMENTS = 64;

/** Draw order between the three flush decal layers. */
const WEAR_RENDER_ORDER = 1;
const PATH_RENDER_ORDER = 2;
const TRACKWAY_RENDER_ORDER = 3;

/** A flush ground decal material: polygon offset, and never into the depth buffer. */
function decalMaterial(hex: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: DECAL_OFFSET_FACTOR,
    polygonOffsetUnits: DECAL_OFFSET_UNITS,
    depthWrite: false,
  });
}

/** Paint a flat ring's vertices from `inner` at its inner edge to `outer` at its rim. */
function paintRadialGradient(
  geometry: THREE.BufferGeometry,
  innerRadiusMetres: number,
  outerRadiusMetres: number,
  inner: THREE.Color,
  outer: THREE.Color,
): void {
  const positions = geometry.getAttribute('position');
  const colours = new Float32Array(positions.count * 3);
  const scratch = new THREE.Color();
  const span = outerRadiusMetres - innerRadiusMetres;
  for (let index = 0; index < positions.count; index += 1) {
    const radius = Math.hypot(positions.getX(index), positions.getY(index));
    const amount = THREE.MathUtils.clamp((radius - innerRadiusMetres) / span, 0, 1);
    scratch.copy(inner).lerp(outer, amount);
    colours[index * 3] = scratch.r;
    colours[index * 3 + 1] = scratch.g;
    colours[index * 3 + 2] = scratch.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
}

/**
 * A flat quad on the ground plane from four (x, z) corners, wound so its face
 * points up whatever order the corners were written in.
 */
function groundQuad(corners: readonly (readonly [number, number])[]): THREE.BufferGeometry {
  const positions = new Float32Array(corners.length * 3);
  corners.forEach(([x, z], index) => {
    positions[index * 3] = x;
    positions[index * 3 + 1] = 0;
    positions[index * 3 + 2] = z;
  });
  const [a, b, c] = corners;
  // (B - A) x (C - A) in the ground plane: negative when the triangle already
  // faces +Y, positive when it has to be wound the other way.
  const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const indices = cross < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A rectangle on the ground, centred on `centre`, `length` along `bearing`. */
function groundRect(
  centre: readonly [number, number],
  bearingRadians: number,
  lengthMetres: number,
  widthMetres: number,
): THREE.BufferGeometry {
  const along: readonly [number, number] = [
    Math.cos(bearingRadians) * (lengthMetres / 2),
    Math.sin(bearingRadians) * (lengthMetres / 2),
  ];
  const across: readonly [number, number] = [
    -Math.sin(bearingRadians) * (widthMetres / 2),
    Math.cos(bearingRadians) * (widthMetres / 2),
  ];
  const corner = (alongSign: number, acrossSign: number): readonly [number, number] => [
    centre[0] + along[0] * alongSign + across[0] * acrossSign,
    centre[1] + along[1] * alongSign + across[1] * acrossSign,
  ];
  return groundQuad([corner(-1, -1), corner(-1, 1), corner(1, 1), corner(1, -1)]);
}

/** A rectangle running between two ground points along a constant width. */
function groundStrip(
  start: readonly [number, number],
  end: readonly [number, number],
  widthMetres: number,
): THREE.BufferGeometry {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const across: readonly [number, number] = [
    (-dz / length) * (widthMetres / 2),
    (dx / length) * (widthMetres / 2),
  ];
  return groundQuad([
    [start[0] - across[0], start[1] - across[1]],
    [start[0] + across[0], start[1] + across[1]],
    [end[0] + across[0], end[1] + across[1]],
    [end[0] - across[0], end[1] - across[1]],
  ]);
}

/** A flush, upward-facing decal mesh. */
function decal(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
  renderOrder: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  mesh.renderOrder = renderOrder;
  return mesh;
}

/**
 * Build the whole ground as one group: the play disc, the gradient apron, the
 * worn trefoil, the gate path and its two trackways.
 *
 * The two tones are adjacent geometries with separate radii rather than two
 * coplanar discs, so there is no overlap to z-fight; every decal is flush at
 * y = 0 and wins its depth against the ground with polygon offset plus a draw
 * order instead of a lift that would show at the lowest lens (FR-3, FR-4).
 */
export function createGround(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RanchGround';

  const play = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_SEAM_RADIUS_METRES, GROUND_SEGMENTS),
    new THREE.MeshStandardMaterial({ color: GROUND_PLAY_HEX, roughness: 1 }),
  );
  play.name = 'RanchGroundPlay';
  play.rotation.x = -Math.PI / 2;
  play.receiveShadow = true;
  group.add(play);

  const apronGeometry = new THREE.RingGeometry(
    GROUND_SEAM_RADIUS_METRES,
    MEADOW_RADIUS_METRES,
    GROUND_SEGMENTS,
    1,
  );
  paintRadialGradient(
    apronGeometry,
    GROUND_SEAM_RADIUS_METRES,
    MEADOW_RADIUS_METRES,
    new THREE.Color(GROUND_APRON_INNER_HEX),
    new THREE.Color(GROUND_APRON_OUTER_HEX),
  );
  const apron = new THREE.Mesh(
    apronGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
  apron.name = 'RanchGroundApron';
  apron.rotation.x = -Math.PI / 2;
  apron.receiveShadow = true;
  group.add(apron);

  const wearMaterial = decalMaterial(GROUND_WEAR_HEX);
  for (const disc of WORN_DISCS) {
    const mesh = decal(
      new THREE.CircleGeometry(disc.radiusMetres, DECAL_SEGMENTS),
      wearMaterial,
      `RanchGroundWear-${disc.species}`,
      WEAR_RENDER_ORDER,
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(disc.centre[0], 0, disc.centre[1]);
    group.add(mesh);
  }

  const dirtMaterial = decalMaterial(GROUND_DIRT_HEX);
  const stub = gateStub();
  group.add(
    decal(
      groundStrip(stub.start, stub.end, stub.widthMetres),
      dirtMaterial,
      'RanchGroundGatePath',
      PATH_RENDER_ORDER,
    ),
  );
  groundTrackways().forEach((trackway, index) => {
    group.add(
      decal(
        groundRect(
          trackway.centre,
          stub.bearingRadians,
          trackway.lengthMetres,
          trackway.widthMetres,
        ),
        dirtMaterial,
        `RanchGroundTrackway-${index + 1}`,
        TRACKWAY_RENDER_ORDER,
      ),
    );
  });

  return group;
}

/** One point where a frame-edge ray meets the ground plane, in ranch metres. */
export interface EdgeRayGroundHit {
  x: number;
  z: number;
  /** Horizontal distance from the lens to the hit, in metres. */
  distanceFromLensMetres: number;
  /** Distance from the ranch centre to the hit, in metres. */
  distanceFromOriginMetres: number;
}

/** What the frame's edges see of the ground plane. */
export interface FrameGround {
  /** Ground hits of the frame's downward edge rays, in edge order. */
  hits: readonly EdgeRayGroundHit[];
  /**
   * True when the top-centre ray points at or above the horizon, so the top of
   * the frame is sky and no ground extent can hide the meadow rim behind it.
   */
  topEdgeAboveHorizon: boolean;
}

/**
 * Intersect a preset's frame-edge rays with the ground plane `y = 0` (FR-3).
 *
 * This is the derivation behind "the ground reaches past the frame": the
 * farthest point of the plane a frame can show is where its downward edge rays
 * meet the ground, so the meadow must reach past every one of them. Rays at or
 * above the horizon never meet the plane and are reported as `hits: []`, with
 * `topEdgeAboveHorizon` saying so, rather than being folded into the result as
 * an infinity.
 *
 * Camera-space edge directions are `(x * aspect * tan(fov / 2),
 * y * tan(fov / 2), -1)`; the corner rays are the widest, which is why they
 * decide the horizon-adjacent extent.
 */
export function frameEdgeGround(
  lens: readonly [number, number, number],
  lookAt: readonly [number, number, number],
  verticalFovDegrees: number,
  horizontalAspect: number,
): FrameGround {
  const eye = new THREE.Vector3(lens[0], lens[1], lens[2]);
  const forward = new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]).sub(eye).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const tanY = Math.tan((verticalFovDegrees * Math.PI) / 360);
  const tanX = tanY * horizontalAspect;
  // Top centre, both top corners and both bottom corners, in that order.
  const edges: readonly (readonly [number, number])[] = [
    [0, 1],
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ];
  const hits: EdgeRayGroundHit[] = [];
  let topEdgeAboveHorizon = false;
  edges.forEach(([edgeX, edgeY], index) => {
    const direction = new THREE.Vector3()
      .addScaledVector(right, edgeX * tanX)
      .addScaledVector(up, edgeY * tanY)
      .add(forward)
      .normalize();
    const above = direction.y >= 0;
    if (index === 0) {
      topEdgeAboveHorizon = above;
    }
    if (above) {
      return;
    }
    const along = eye.y / -direction.y;
    const x = eye.x + direction.x * along;
    const z = eye.z + direction.z * along;
    hits.push({
      x,
      z,
      distanceFromLensMetres: along * Math.hypot(direction.x, direction.z),
      distanceFromOriginMetres: Math.hypot(x, z),
    });
  });
  return { hits, topEdgeAboveHorizon };
}
