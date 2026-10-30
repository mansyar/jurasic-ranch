import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { trioSpawnPositions } from '../../src/ranch/avoidance.js';
import { BRACHIO_GAIT, STEGO_GAIT, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import { DRESSING_MANIFEST } from '../../src/ranch/dressing.js';
import { DRESSING_CATALOGUE, GROUND_RADIUS_METRES } from '../../src/ranch/layout.js';
import {
  CAMERA_FAR_METRES,
  GROUND_APRON_INNER_HEX,
  GROUND_APRON_OUTER_HEX,
  GROUND_DIRT_HEX,
  GROUND_PATCHES,
  GROUND_PATCH_HEX,
  GROUND_GATE_PATH_HEX,
  GROUND_PLAY_HEX,
  GROUND_SEAM_RADIUS_METRES,
  GROUND_WEAR_HEX,
  HORIZON_HEX,
  MEADOW_RADIUS_METRES,
  WORN_DISCS,
  createGround,
  frameEdgeGround,
  gateStub,
  groundTrackways,
} from '../../src/ranch/ground.js';
import { CAMERA_FAR_METRES as SCENE_FAR_METRES } from '../../src/viewer/scene.js';
import {
  GROUND_POV_ORDER,
  POV_FOCUS_SPECIES,
  POV_FOCUS_SPAWN_INDEX,
  POV_ORDER,
  POV_PRESETS,
} from '../../src/viewer/pov.js';
import type { PovPresetId } from '../../src/viewer/pov.js';
import type { GaitParams } from '../../src/ranch/waddle.js';

/**
 * FR-3 (no visible world edge), FR-4 (wear derived from where the trio lives)
 * and AC-6/AC-7/AC-17. Every number asserted here comes from the live preset,
 * spawn and gait constants rather than a copy of them, so moving a lens in
 * phase 4 re-checks the derivation instead of invalidating it silently.
 */

type Species = 'trike' | 'stego' | 'brachio';

const GAITS: Readonly<Record<Species, GaitParams>> = {
  trike: TRIKE_GAIT,
  stego: STEGO_GAIT,
  brachio: BRACHIO_GAIT,
};

/** Aspect ratios a preset can be framed at, portrait through ultrawide. */
const ASPECTS: readonly number[] = [0.46, 1, 1.78, 2.4];

const GATE_FILE = 'farm-gate-8ab320.glb';

/** How far a preset stands from the ranch centre, in metres. */
function presetDistanceMetres(id: PovPresetId): number {
  const [x, , z] = POV_PRESETS[id].position;
  return Math.hypot(x, z);
}

/** A named child mesh, or a failure that says which one is missing. */
function meshNamed(group: THREE.Object3D, name: string): THREE.Mesh {
  const found = group.children.find((child) => child.name === name);
  expect(found, `${name} is missing from the ground group`).toBeDefined();
  return found as THREE.Mesh;
}

/** One vertex of a buffer attribute as a vector. */
function vertexAt(positions: THREE.BufferAttribute, index: number): THREE.Vector3 {
  const x = positions.getX(index);
  const y = positions.getY(index);
  const z = positions.getZ(index);
  return new THREE.Vector3(x, y, z);
}

/** Upward component of an indexed quad's face normal, from its first triangle. */
function faceNormalY(geometry: THREE.BufferGeometry): number {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const indices = geometry.getIndex();
  expect(indices, 'ground decals are indexed quads').not.toBeNull();
  if (indices === null) {
    return 0;
  }
  const a = vertexAt(positions, indices.getX(0));
  const b = vertexAt(positions, indices.getX(1));
  const c = vertexAt(positions, indices.getX(2));
  const normal = new THREE.Vector3();
  normal.crossVectors(b.sub(a), c.sub(a));
  return normal.normalize().y;
}

/** Lightness of an authored tone, for the "wear is duller" check. */
function lightnessOf(hex: number): number {
  return new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }).l;
}

describe('meadow apron (FR-3, AC-7)', () => {
  it('reaches at least three play radii', () => {
    const threeRadii = GROUND_RADIUS_METRES * 3;
    expect(MEADOW_RADIUS_METRES).toBeGreaterThanOrEqual(threeRadii);
  });

  it('stays wider than the seam by a whole play radius', () => {
    const spare = MEADOW_RADIUS_METRES - GROUND_SEAM_RADIUS_METRES;
    expect(spare).toBeGreaterThan(GROUND_RADIUS_METRES);
  });

  it('puts the far plane beyond the meadow from every preset', () => {
    for (const id of POV_ORDER) {
      const needed = MEADOW_RADIUS_METRES + presetDistanceMetres(id);
      expect(CAMERA_FAR_METRES).toBeGreaterThan(needed);
    }
    // The scene camera is the plane that actually clips, so it must agree.
    expect(SCENE_FAR_METRES).toBe(CAMERA_FAR_METRES);
  });

  it('puts the seam beyond every preset lens', () => {
    for (const id of POV_ORDER) {
      expect(GROUND_SEAM_RADIUS_METRES).toBeGreaterThan(presetDistanceMetres(id));
    }
  });

  it('is tone-continuous at the seam and horizon-toned at the rim', () => {
    expect(GROUND_APRON_INNER_HEX).toBe(GROUND_PLAY_HEX);
    expect(GROUND_APRON_OUTER_HEX).toBe(HORIZON_HEX);
    expect(HORIZON_HEX).not.toBe(GROUND_PLAY_HEX);
  });
});

describe('ground reach from the live presets (FR-3, AC-6)', () => {
  it('reaches past every frame-edge ground hit', () => {
    // Ground presets only: the overhead frame reaches further from its lens by
    // construction, and its all-ground claim is proved in `pov.test.ts` against
    // the meadow radius instead.
    for (const id of GROUND_POV_ORDER) {
      const preset = POV_PRESETS[id];
      const standoff = presetDistanceMetres(id);
      for (const aspect of ASPECTS) {
        const frame = frameEdgeGround(preset.position, preset.lookAt, preset.fov, aspect);
        // A ground-level lens always shows ground along its lower edge.
        expect(frame.hits.length, `${id} at aspect ${aspect}`).toBeGreaterThan(0);
        for (const hit of frame.hits) {
          expect(hit.distanceFromOriginMetres).toBeLessThan(MEADOW_RADIUS_METRES);
          // The brief's phrasing: the meadow outruns the frame exit measured
          // from the lens, plus the lens's own standoff from the centre.
          const reach = hit.distanceFromLensMetres + standoff;
          expect(reach).toBeLessThan(MEADOW_RADIUS_METRES);
        }
      }
    }
  });

  it('keeps the top of every ground preset frame above the horizon', () => {
    // The reach argument leans on this: a downward top edge would put the
    // plane's far intersection back in play. The overhead preset is the one
    // frame that is allowed to tilt past the horizon, and it must not see sky
    // while doing it (`pov.test.ts`, AC-2).
    for (const id of GROUND_POV_ORDER) {
      const preset = POV_PRESETS[id];
      const frame = frameEdgeGround(preset.position, preset.lookAt, preset.fov, 1.78);
      expect(frame.topEdgeAboveHorizon, `${id} top edge`).toBe(true);
    }
  });

  it('reports no ground hit for a frame that only sees sky', () => {
    const frame = frameEdgeGround([0, 12, 0], [0, 40, 0], 60, 1.78);
    expect(frame.topEdgeAboveHorizon).toBe(true);
    expect(frame.hits.length).toBe(0);
  });
});

describe('worn trefoil (FR-4, AC-6)', () => {
  it('has one disc per dino, on its live spawn and gait radius', () => {
    const spawns = trioSpawnPositions();
    expect(WORN_DISCS.length).toBe(3);
    expect(new Set(WORN_DISCS.map((disc) => disc.species)).size).toBe(3);
    // Cross-checked through the preset table rather than by list position, so
    // a reordered species list cannot pass by agreeing with itself. The worn
    // trefoil is drawn around the trio's spawns, so it is a ground-preset
    // question; the overhead preset frames the same three animals at once.
    for (const id of GROUND_POV_ORDER) {
      const species = POV_FOCUS_SPECIES[id] as Species;
      const disc = WORN_DISCS.find((entry) => entry.species === species);
      expect(disc, `${id} species ${species}`).toBeDefined();
      if (disc === undefined) {
        continue;
      }
      const spawn = spawns[POV_FOCUS_SPAWN_INDEX[id]];
      expect(disc.centre[0]).toBeCloseTo(spawn.x, 10);
      expect(disc.centre[1]).toBeCloseTo(spawn.z, 10);
      const radius = GAITS[species].wanderRadiusMetres;
      expect(disc.radiusMetres).toBeCloseTo(radius, 10);
    }
  });

  it('sits inside the play disc it is drawn on', () => {
    for (const disc of WORN_DISCS) {
      const reach = Math.hypot(disc.centre[0], disc.centre[1]) + disc.radiusMetres;
      expect(reach).toBeLessThan(GROUND_SEAM_RADIUS_METRES);
    }
  });
});

describe('gate path and trackways (FR-4)', () => {
  it('starts at the farm gate the dressing manifest places', () => {
    const gate = DRESSING_MANIFEST.find((item) => item.file === GATE_FILE);
    const stub = gateStub();
    expect(gate).toBeDefined();
    if (gate === undefined) {
      return;
    }
    expect(stub.start[0]).toBeCloseTo(gate.position[0], 10);
    expect(stub.start[1]).toBeCloseTo(gate.position[2], 10);
    const bearing = Math.atan2(gate.position[2], gate.position[0]);
    expect(stub.bearingRadians).toBeCloseTo(bearing, 10);
    const footprint = DRESSING_CATALOGUE[GATE_FILE].footprintMetres;
    expect(stub.widthMetres).toBeCloseTo(footprint / 2, 10);
  });

  it('ends inside the wear, not short of it', () => {
    const stub = gateStub();
    let nearest = Infinity;
    for (const disc of WORN_DISCS) {
      const dx = stub.end[0] - disc.centre[0];
      const dz = stub.end[1] - disc.centre[1];
      nearest = Math.min(nearest, Math.hypot(dx, dz) / disc.radiusMetres);
    }
    expect(nearest).toBeLessThan(1);
    expect(stub.lengthMetres).toBeGreaterThan(0);
  });

  it('carries two trackways rotated to the path', () => {
    const stub = gateStub();
    const trackways = groundTrackways();
    expect(trackways.length).toBe(2);
    for (const trackway of trackways) {
      expect(trackway.rotationY).toBeCloseTo(-stub.bearingRadians, 10);
      expect(trackway.lengthMetres).toBeCloseTo(stub.widthMetres * 2, 10);
      expect(trackway.widthMetres).toBeCloseTo(stub.widthMetres / 4, 10);
    }
    const [first, second] = trackways;
    // Symmetric about the path's junction point, either side of it.
    const midX = (first.centre[0] + second.centre[0]) / 2;
    const midZ = (first.centre[1] + second.centre[1]) / 2;
    expect(midX).toBeCloseTo(stub.end[0], 10);
    expect(midZ).toBeCloseTo(stub.end[1], 10);
    const dx = first.centre[0] - second.centre[0];
    const dz = first.centre[1] - second.centre[1];
    expect(Math.hypot(dx, dz)).toBeGreaterThan(0);
  });
});

describe('the built ground group (FR-3, FR-4)', () => {
  it('is two ground tones with separate radii', () => {
    const ground = createGround();
    const seam = GROUND_SEAM_RADIUS_METRES;
    const meadow = MEADOW_RADIUS_METRES;
    expect(ground.name).toBe('RanchGround');
    const play = meshNamed(ground, 'RanchGroundPlay');
    const apron = meshNamed(ground, 'RanchGroundApron');
    const playGeometry = play.geometry as THREE.CircleGeometry;
    const apronGeometry = apron.geometry as THREE.RingGeometry;
    expect(playGeometry.parameters.radius).toBeCloseTo(seam, 10);
    expect(apronGeometry.parameters.innerRadius).toBeCloseTo(seam, 10);
    expect(apronGeometry.parameters.outerRadius).toBeCloseTo(meadow, 10);
    for (const mesh of [play, apron]) {
      expect(mesh.receiveShadow).toBe(true);
      expect(mesh.position.y).toBe(0);
    }
  });

  it('paints the apron from the play tone to the horizon tone', () => {
    const apron = meshNamed(createGround(), 'RanchGroundApron');
    const positions = apron.geometry.getAttribute('position');
    const colours = apron.geometry.getAttribute('color') as THREE.BufferAttribute;
    expect(colours).toBeDefined();
    const play = new THREE.Color(GROUND_PLAY_HEX);
    const horizon = new THREE.Color(HORIZON_HEX);
    let innerRadius = Infinity;
    let outerRadius = 0;
    for (let i = 0; i < positions.count; i += 1) {
      const radius = Math.hypot(positions.getX(i), positions.getY(i));
      innerRadius = Math.min(innerRadius, radius);
      outerRadius = Math.max(outerRadius, radius);
    }
    for (let i = 0; i < positions.count; i += 1) {
      const radius = Math.hypot(positions.getX(i), positions.getY(i));
      // Classified by position along the gradient, not by an absolute epsilon:
      // the buffer is float32, so a 30 m radius carries ~4e-6 of rounding.
      const amount = (radius - innerRadius) / (outerRadius - innerRadius);
      const expected = amount < 0.5 ? play : horizon;
      expect(colours.getX(i)).toBeCloseTo(expected.r, 5);
      expect(colours.getY(i)).toBeCloseTo(expected.g, 5);
      expect(colours.getZ(i)).toBeCloseTo(expected.b, 5);
    }
    expect(innerRadius).toBeCloseTo(GROUND_SEAM_RADIUS_METRES, 4);
    expect(outerRadius).toBeCloseTo(MEADOW_RADIUS_METRES, 4);
  });

  it('draws a flush decal per worn disc, path and two ruts', () => {
    const ground = createGround();
    const names = ground.children.map((child) => child.name);
    for (const disc of WORN_DISCS) {
      const name = `RanchGroundWear-${disc.species}`;
      expect(names).toContain(name);
      const mesh = meshNamed(ground, name);
      expect(mesh.position.x).toBeCloseTo(disc.centre[0], 10);
      expect(mesh.position.z).toBeCloseTo(disc.centre[1], 10);
      const geometry = mesh.geometry as THREE.RingGeometry;
      // The disc carries a generated radial ramp, so it is a ring with phi
      // segments whose outer radius is the wear radius (P5.T9).
      expect(geometry.parameters.innerRadius).toBe(0);
      expect(geometry.parameters.outerRadius).toBeCloseTo(disc.radiusMetres, 10);
    }
    expect(names).toContain('RanchGroundGatePath');
    expect(names).toContain('RanchGroundTrackway-1');
    expect(names).toContain('RanchGroundTrackway-2');
    // Play and apron, a wear disc per species, a ground patch per entry, the
    // gate path with its two hoof spots, and two ruts (rework 1, 2).
    const expectedCount = 2 + WORN_DISCS.length + GROUND_PATCHES.length + 1 + 2 + 2;
    expect(ground.children.length).toBe(expectedCount);
  });

  it('lays a few low-contrast tones over the field (rework 1)', () => {
    const ground = createGround();
    // Two or three tones: a bleached stretch, a shadier one, and the dirt yard
    // the farm fittings stand in. Enough to turn a disc into land.
    expect(GROUND_PATCHES.length).toBeGreaterThanOrEqual(3);
    expect(GROUND_PATCHES.length).toBeLessThanOrEqual(6);
    expect(GROUND_PATCHES.some((patch) => patch.tone === 'yard')).toBe(true);
    const field = lightnessOf(GROUND_PLAY_HEX);
    for (const tone of new Set(GROUND_PATCHES.map((patch) => patch.tone))) {
      const colour = new THREE.Color(GROUND_PATCH_HEX[tone]);
      expect(colour.getHex(), `${tone} differs from the field`).not.toBe(GROUND_PLAY_HEX);
      // A meadow, not a quilt: within a sixth of the field's own lightness.
      const delta = Math.abs(lightnessOf(GROUND_PATCH_HEX[tone]) - field);
      expect(delta, `${tone} stays a shade`).toBeLessThan(0.15);
    }
    GROUND_PATCHES.forEach((patch, index) => {
      const mesh = meshNamed(ground, `RanchGroundPatch-${patch.tone}-${index + 1}`);
      expect(mesh.position.y).toBe(0);
      expect(mesh.position.x).toBeCloseTo(patch.centre[0], 10);
      expect(mesh.position.z).toBeCloseTo(patch.centre[1], 10);
      expect(mesh.renderOrder).toBeLessThan(1);
    });
  });

  it('paints the gate road as a track with an edge, not a smear (rework 2)', () => {
    const ground = createGround();
    const stub = gateStub();
    const path = meshNamed(ground, 'RanchGroundGatePath');
    const material = path.material as THREE.MeshStandardMaterial;
    // A strip reads by its shoulder: the ramp is solid across the middle and only
    // softens at the sides, where a blur faded from the centre line outward.
    expect(material.alphaMap).not.toBeNull();
    expect(material.transparent).toBe(true);
    const field = lightnessOf(GROUND_PLAY_HEX);
    const delta = Math.abs(lightnessOf(GROUND_GATE_PATH_HEX) - field);
    expect(delta, 'the track is still visible').toBeGreaterThan(0.04);
    expect(delta, 'the track is not a stain').toBeLessThan(0.15);
    // The ruts wear from the same ramp, so all three read as one road.
    for (const name of ['RanchGroundTrackway-1', 'RanchGroundTrackway-2']) {
      const rut = meshNamed(ground, name);
      expect((rut.material as THREE.MeshStandardMaterial).alphaMap).toBe(material.alphaMap);
    }
    // Hoof wear sits *inside* the track, down its middle, not wiped beside it.
    const [x0, z0] = stub.start;
    const [x1, z1] = stub.end;
    const alongX = x1 - x0;
    const alongZ = z1 - z0;
    const lengthSquared = alongX * alongX + alongZ * alongZ;
    for (const name of ['RanchGroundTrackWear-1', 'RanchGroundTrackWear-2']) {
      const spot = meshNamed(ground, name);
      const offsetX = spot.position.x - x0;
      const offsetZ = spot.position.z - z0;
      const along = (offsetX * alongX + offsetZ * alongZ) / lengthSquared;
      expect(along, `${name} stays on the road`).toBeGreaterThan(0);
      expect(along).toBeLessThan(1);
      const across = Math.abs(offsetX * alongZ - offsetZ * alongX) / Math.sqrt(lengthSquared);
      expect(across, `${name} keeps within the track`).toBeLessThan(stub.widthMetres / 2);
    }
  });

  it('offsets decals out of the ground instead of lifting them', () => {
    const ground = createGround();
    const tones = ['RanchGroundPlay', 'RanchGroundApron'];
    const decals = ground.children.filter((child) => !tones.includes(child.name));
    expect(decals.length).toBe(WORN_DISCS.length + GROUND_PATCHES.length + 1 + 2 + 2);
    for (const child of decals) {
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(mesh.position.y, `${mesh.name} is flush`).toBe(0);
      expect(material.polygonOffset, `${mesh.name} offsets`).toBe(true);
      expect(material.polygonOffsetFactor).toBeLessThan(0);
      expect(material.polygonOffsetUnits).toBeLessThan(0);
      expect(material.depthWrite).toBe(false);
      expect(mesh.receiveShadow).toBe(true);
    }
    expect(meshNamed(ground, 'RanchGroundWear-trike').renderOrder).toBe(1);
    expect(meshNamed(ground, 'RanchGroundGatePath').renderOrder).toBe(2);
    expect(meshNamed(ground, 'RanchGroundTrackway-1').renderOrder).toBe(3);
  });

  it('keeps the wear duller than the grass it covers', () => {
    expect(GROUND_WEAR_HEX).not.toBe(GROUND_PLAY_HEX);
    const wear = lightnessOf(GROUND_WEAR_HEX);
    const grass = lightnessOf(GROUND_PLAY_HEX);
    expect(wear).toBeLessThan(grass);
    expect(GROUND_DIRT_HEX).not.toBe(GROUND_WEAR_HEX);
  });

  it('winds the gate path and ruts so their faces point up', () => {
    const ground = createGround();
    const names = ['RanchGroundGatePath', 'RanchGroundTrackway-1'];
    for (const name of names) {
      const upward = faceNormalY(meshNamed(ground, name).geometry);
      expect(upward, `${name} faces up`).toBeGreaterThan(0.99);
    }
    const rut = faceNormalY(meshNamed(ground, 'RanchGroundTrackway-2').geometry);
    expect(rut).toBeGreaterThan(0.99);
  });
});
