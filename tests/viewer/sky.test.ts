import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DRESSING_HEIGHT_METRES } from '../../src/ranch/dressing.js';
import {
  LANDMARK_PLACEMENTS,
  TREELINE_MIN_HEIGHT_METRES,
  WIND_PUMP_FILE,
} from '../../src/ranch/layout.js';
import { MEADOW_RADIUS_METRES } from '../../src/ranch/ground.js';
import { HORIZON_HEX } from '../../src/ranch/ground.js';
import {
  CLOUD_BASE_HEX,
  CLOUD_DRIFT_BOUND_METRES,
  CLOUD_SPEEDS_METRES_PER_SECOND,
  CLOUD_TOP_HEX,
  SKY_CLOUD_COUNT,
  SKY_CLOUD_SPECS,
  SKY_DOME_RADIUS_METRES,
  SKY_ZENITH_HEX,
  cloudCentreMetres,
  createSky,
  skyToneAt,
} from '../../src/viewer/sky.js';
import { CAMERA_FAR_METRES } from '../../src/viewer/scene.js';
import {
  GROUND_POV_ORDER,
  POV_FOV_DEGREES,
  POV_ORDER,
  POV_PRESETS,
  applyPovPreset,
} from '../../src/viewer/pov.js';

/**
 * FR-17 (gradient sky, four drifting clouds, no cloud shadows, still under
 * reduced motion) and AC-17. The sky is built once, unlit and texture-free, so
 * its tones survive the renderer's `NoToneMapping` (NFR-4) unchanged.
 */

/** The three lenses that stand on the ground: the sky they see is a narrow band. */
const GROUND_LENSES = GROUND_POV_ORDER;

/** Capture framing, the same 1280x800 the evidence sheet uses. */
const FRAME_WIDTH_PX = 1280;
const FRAME_HEIGHT_PX = 800;

/** Where a cloud's centre lands in one preset, and whether it is in the visible band. */
interface CloudPixels {
  readonly x: number;
  readonly y: number;
  readonly inFrame: boolean;
  readonly aboveHorizon: boolean;
}

/**
 * Projects a world point through a live ground preset. The horizon line is the
 * screen row a ray parallel to the ground lands on: for a lens pitched down by
 * `p`, that is `-tan(p) / tan(halfFov)` in normalised device height.
 */
function cloudPixels(
  id: (typeof GROUND_LENSES)[number],
  centre: readonly [number, number, number],
): CloudPixels {
  const camera = new THREE.PerspectiveCamera(
    1,
    FRAME_WIDTH_PX / FRAME_HEIGHT_PX,
    0.1,
    CAMERA_FAR_METRES,
  );
  applyPovPreset(camera, id);
  camera.updateMatrixWorld(true);
  const point = new THREE.Vector3(centre[0], centre[1], centre[2]);
  const view = point.clone().applyMatrix4(camera.matrixWorldInverse);
  const ndc = point.clone().project(camera);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const pitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
  const halfFov = (POV_FOV_DEGREES[id] * Math.PI) / 360;
  const horizonY = -Math.tan(pitch) / Math.tan(halfFov);
  const depth = -view.z;
  return {
    x: ndc.x,
    y: ndc.y,
    inFrame: depth > 0 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1,
    aboveHorizon: ndc.y > Math.max(horizonY, -1),
  };
}

/** Farthest a preset stands from the ranch centre, in metres. */
function farthestPresetMetres(): number {
  return Math.max(
    ...POV_ORDER.map((id) => {
      const [x, , z] = POV_PRESETS[id].position;
      return Math.hypot(x, z);
    }),
  );
}

/** Lightness of a tone, for the pale-horizon check. */
function lightnessOf(colour: THREE.Color): number {
  return colour.getHSL({ h: 0, s: 0, l: 0 }).l;
}

/** The dome mesh, or a failure that names what is missing. */
function domeOf(group: THREE.Object3D): THREE.Mesh {
  const found = group.children.find((child) => child.name === 'RanchSkyDome');
  expect(found, 'RanchSkyDome is missing').toBeDefined();
  return found as THREE.Mesh;
}

describe('sky dome (FR-17)', () => {
  it('fits inside the far plane and stands outside the visible ground', () => {
    expect(SKY_DOME_RADIUS_METRES).toBeLessThan(CAMERA_FAR_METRES);
    expect(SKY_DOME_RADIUS_METRES).toBeGreaterThan(MEADOW_RADIUS_METRES + farthestPresetMetres());
  });

  it('is drawn from inside, unlit and texture-free', () => {
    const dome = domeOf(createSky().group);
    const material = dome.material as THREE.MeshBasicMaterial;
    expect(material.side).toBe(THREE.BackSide);
    expect(material.vertexColors).toBe(true);
    expect(material.map).toBeNull();
    expect(material.toneMapped).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(dome.renderOrder).toBeLessThan(0);
    expect(dome.castShadow).toBe(false);
    expect(dome.receiveShadow).toBe(false);
  });

  it('paints the horizon tone at the equator and the zenith tone overhead', () => {
    const horizon = skyToneAt(0);
    expect(horizon.r).toBeCloseTo(new THREE.Color(HORIZON_HEX).r, 10);
    expect(horizon.g).toBeCloseTo(new THREE.Color(HORIZON_HEX).g, 10);
    expect(horizon.b).toBeCloseTo(new THREE.Color(HORIZON_HEX).b, 10);
    const zenith = skyToneAt(1);
    expect(zenith.r).toBeCloseTo(new THREE.Color(SKY_ZENITH_HEX).r, 10);
    expect(zenith.g).toBeCloseTo(new THREE.Color(SKY_ZENITH_HEX).g, 10);
    expect(zenith.b).toBeCloseTo(new THREE.Color(SKY_ZENITH_HEX).b, 10);
  });

  it('is pale at the horizon and darker overhead, and holds below the horizon', () => {
    expect(lightnessOf(skyToneAt(0))).toBeGreaterThan(lightnessOf(skyToneAt(1)));
    expect(lightnessOf(skyToneAt(0.5))).toBeGreaterThan(lightnessOf(skyToneAt(1)));
    expect(lightnessOf(skyToneAt(0.5))).toBeLessThan(lightnessOf(skyToneAt(0)));
    // The sliver the meadow's rim exposes is the same pale tone as the field.
    expect(skyToneAt(-1).getHex()).toBe(skyToneAt(0).getHex());
  });

  it('bakes that gradient into the dome vertices', () => {
    const dome = domeOf(createSky().group);
    const positions = dome.geometry.getAttribute('position');
    const colours = dome.geometry.getAttribute('color') as THREE.BufferAttribute;
    let lowest = 0;
    let highest = 0;
    for (let index = 0; index < positions.count; index += 1) {
      if (positions.getY(index) < positions.getY(lowest)) {
        lowest = index;
      }
      if (positions.getY(index) > positions.getY(highest)) {
        highest = index;
      }
    }
    const horizon = new THREE.Color(HORIZON_HEX);
    const zenith = new THREE.Color(SKY_ZENITH_HEX);
    expect(colours.getX(lowest)).toBeCloseTo(horizon.r, 5);
    expect(colours.getY(lowest)).toBeCloseTo(horizon.g, 5);
    expect(colours.getZ(lowest)).toBeCloseTo(horizon.b, 5);
    expect(colours.getX(highest)).toBeCloseTo(zenith.r, 5);
    expect(colours.getY(highest)).toBeCloseTo(zenith.g, 5);
    expect(colours.getZ(highest)).toBeCloseTo(zenith.b, 5);
  });
});

describe('clouds (FR-17, AC-17)', () => {
  it('ships four of them, inside the dome and above the treeline', () => {
    const sky = createSky();
    expect(SKY_CLOUD_COUNT).toBe(4);
    expect(sky.clouds.length).toBe(4);
    for (const cloud of sky.clouds) {
      // They no longer clear the tallest redwood: a cloud is placed by the angle
      // it subtends from a lens, and at 58-66 m out an 11-16 m cloud sits 8-11
      // deg above the horizon — the only band these downward lenses can see.
      expect(cloud.position.y).toBeGreaterThan(TREELINE_MIN_HEIGHT_METRES);
      expect(Math.hypot(cloud.position.x, cloud.position.z)).toBeLessThan(SKY_DOME_RADIUS_METRES);
    }
  });

  it('builds each cloud from a handful of unlit two-tone boxes (rework 2)', () => {
    const sky = createSky();
    for (const cloud of sky.clouds) {
      expect(cloud.children.length).toBeGreaterThan(1);
      expect(cloud.children.length).toBeLessThanOrEqual(6);
      for (const child of cloud.children) {
        const mesh = child as THREE.Mesh;
        expect(mesh.isMesh).toBe(true);
        const material = mesh.material as THREE.MeshBasicMaterial;
        // Unlit and self-coloured: a lit material is what let the meadow's green
        // bounce turn a cream cloud into a concrete slab.
        expect(material.isMeshBasicMaterial).toBe(true);
        expect(material.vertexColors).toBe(true);
        expect(material.toneMapped).toBe(false);
        expect(mesh.geometry.getAttribute('color')).toBeDefined();
      }
    }
  });

  it('authors the clouds warm, with a cooler underside (rework 2)', () => {
    const tops = new THREE.Color(CLOUD_TOP_HEX);
    const bases = new THREE.Color(CLOUD_BASE_HEX);
    // Cream: red highest, blue lowest. No green cast, which is the whole defect.
    expect(tops.r).toBeGreaterThan(tops.g);
    expect(tops.g).toBeGreaterThan(tops.b);
    expect(tops.b).toBeGreaterThan(0.85);
    // The underside is cooler (blue at least red) and still light, never slate.
    expect(bases.b).toBeGreaterThanOrEqual(bases.r);
    expect(lightnessOf(bases)).toBeGreaterThan(0.8);
    expect(lightnessOf(tops)).toBeGreaterThan(lightnessOf(bases));
  });

  it('keeps the windpump inside the Sky frame (rework 2)', () => {
    const pump = LANDMARK_PLACEMENTS.find((item) => item.file === WIND_PUMP_FILE);
    expect(pump, 'the windpump has a placement').toBeDefined();
    if (pump === undefined) {
      return;
    }
    const height = DRESSING_HEIGHT_METRES[WIND_PUMP_FILE] ?? 0;
    const camera = new THREE.PerspectiveCamera(
      1,
      FRAME_WIDTH_PX / FRAME_HEIGHT_PX,
      0.1,
      CAMERA_FAR_METRES,
    );
    applyPovPreset(camera, 'sky');
    camera.updateMatrixWorld(true);
    const [x, , z] = pump.position;
    const points: THREE.Vector3[] = [new THREE.Vector3(x, 0, z), new THREE.Vector3(x, height, z)];
    const projected = points.map((point) => point.clone().project(camera));
    // FR-18 asks for a landmark a camera can see. 28 m put it past the Sky
    // preset's own ground footprint; 22 m at 142 deg stands it well inside.
    for (const point of projected) {
      expect(Math.abs(point.x), `windpump x ${point.x}`).toBeLessThan(0.9);
      expect(Math.abs(point.y), `windpump y ${point.y}`).toBeLessThan(0.9);
    }
  });

  it('keeps every cloud out of the shadow map', () => {
    const sky = createSky();
    for (const cloud of sky.clouds) {
      for (const child of cloud.children) {
        expect(child.castShadow, `${child.name} casts no shadow`).toBe(false);
        expect(child.receiveShadow).toBe(false);
      }
      expect(cloud.castShadow).toBe(false);
    }
  });

  it('keeps every cloud inside the dome and above the meadow', () => {
    const sky = createSky();
    for (const cloud of sky.clouds) {
      const reach = Math.hypot(cloud.position.x, cloud.position.z);
      expect(reach + CLOUD_DRIFT_BOUND_METRES).toBeGreaterThan(0);
      expect(reach).toBeLessThan(SKY_DOME_RADIUS_METRES);
      expect(cloud.position.y).toBeLessThan(SKY_DOME_RADIUS_METRES);
    }
  });

  it('puts a cloud in the visible sky band of every ground lens (rework 1)', () => {
    // The assertion the first pass was missing: a cloud above the top of the
    // frame is a cloud nobody sees. Each ground lens must show at least one
    // cloud's centre inside its frame and above its own horizon line.
    const findings: string[] = [];
    for (const id of GROUND_LENSES) {
      const visible = SKY_CLOUD_SPECS.map((spec) =>
        cloudPixels(id, cloudCentreMetres(spec)),
      ).filter((point) => point.inFrame && point.aboveHorizon);
      if (visible.length === 0) {
        findings.push(`${id}: no cloud inside the frame above the horizon`);
      }
    }
    expect(findings, findings.join('\n')).toEqual([]);
  });
});

describe('cloud drift (FR-17, NFR-8)', () => {
  it('advances on the supplied dt, one derived speed per cloud', () => {
    const sky = createSky();
    const before = sky.clouds.map((cloud) => cloud.position.x);
    sky.update(1, false);
    sky.clouds.forEach((cloud, index) => {
      expect(cloud.position.x).toBeCloseTo(
        before[index] + CLOUD_SPEEDS_METRES_PER_SECOND[index],
        10,
      );
    });
  });

  it('is bit-static under reduced motion', () => {
    const sky = createSky();
    const before = sky.clouds.map((cloud) => cloud.position.clone());
    sky.update(5, true);
    sky.clouds.forEach((cloud, index) => {
      expect(cloud.position.x).toBe(before[index].x);
      expect(cloud.position.y).toBe(before[index].y);
      expect(cloud.position.z).toBe(before[index].z);
    });
  });

  it('is static on a paused or negative clock', () => {
    const sky = createSky();
    const before = sky.clouds.map((cloud) => cloud.position.x);
    sky.update(0, false);
    sky.update(-1, false);
    sky.clouds.forEach((cloud, index) => {
      expect(cloud.position.x).toBe(before[index]);
    });
  });

  it('wraps a cloud back over the ranch instead of drifting away', () => {
    const sky = createSky();
    const cloud = sky.clouds[0];
    cloud.position.x = CLOUD_DRIFT_BOUND_METRES + 1;
    sky.update(0.01, false);
    expect(Math.abs(cloud.position.x)).toBeLessThanOrEqual(CLOUD_DRIFT_BOUND_METRES);
  });

  it('is deterministic: the same frames give the same sky', () => {
    const first = createSky();
    const second = createSky();
    for (let frame = 0; frame < 8; frame += 1) {
      first.update(1 / 60, false);
      second.update(1 / 60, false);
    }
    first.clouds.forEach((cloud, index) => {
      expect(cloud.position.x).toBe(second.clouds[index].position.x);
      expect(cloud.position.z).toBe(second.clouds[index].position.z);
    });
  });
});
