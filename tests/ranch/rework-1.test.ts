import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DRESSING_MANIFEST, TREELINE_PLACEMENTS } from '../../src/ranch/layout.js';
import {
  GROUND_GATE_PATH_HEX,
  GROUND_PATCHES,
  GROUND_PATCH_HEX,
  GROUND_PLAY_HEX,
} from '../../src/ranch/ground.js';
import { DRAW_CALL_CEILING, TRIANGLE_CEILING } from '../../src/ranch/dressing.js';
import { SKY_CLOUD_SPECS, cloudCentreMetres, createSky } from '../../src/viewer/sky.js';
import { GROUND_POV_ORDER, POV_FOV_DEGREES, applyPovPreset } from '../../src/viewer/pov.js';
import { CAMERA_FAR_METRES } from '../../src/viewer/scene.js';
import { readGlbFacts } from './dressing-files.js';

/**
 * Rework 1's own contract, in one place: the four things a capture can see that
 * no single module owns — a cloud in every ground lens's sky band, ground tones
 * off the field, treeline masses rather than singles, and the frame's budget.
 */

const WIDTH = 1280;
const HEIGHT = 800;

function lightness(hex: number): number {
  const colour = new THREE.Color(hex);
  return colour.getHSL({ h: 0, s: 0, l: 0 }).l;
}

/** Every cloud's centre, in ranch metres. */
function cloudCentres(): THREE.Vector3[] {
  return SKY_CLOUD_SPECS.map((spec) => {
    const centre = cloudCentreMetres(spec);
    return new THREE.Vector3(centre[0], centre[1], centre[2]);
  });
}

/** True when a point is inside the frame and above that lens's horizon row. */
function inSkyBand(id: (typeof GROUND_POV_ORDER)[number], point: THREE.Vector3): boolean {
  const camera = new THREE.PerspectiveCamera(1, WIDTH / HEIGHT, 0.1, CAMERA_FAR_METRES);
  applyPovPreset(camera, id);
  camera.updateMatrixWorld(true);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const pitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
  const halfFov = (POV_FOV_DEGREES[id] * Math.PI) / 360;
  const horizon = -Math.tan(pitch) / Math.tan(halfFov);
  const view = point.clone().applyMatrix4(camera.matrixWorldInverse);
  const ndc = point.clone().project(camera);
  return -view.z > 0 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.y > horizon;
}

/** Bearings of the treeline props, sorted, in degrees. */
function treelineBearings(): number[] {
  const bearings = TREELINE_PLACEMENTS.map((item) => {
    return (Math.atan2(item.position[2], item.position[0]) * 180) / Math.PI;
  });
  return bearings.sort((a, b) => a - b);
}

describe('rework 1: the frame the capture sees', () => {
  it('shows at least one cloud in every ground lens, above its horizon', () => {
    const centres = cloudCentres();
    for (const id of GROUND_POV_ORDER) {
      const visible = centres.filter((point) => inSkyBand(id, point));
      expect(visible.length, `${id} sees no cloud`).toBeGreaterThanOrEqual(1);
    }
  });

  it('lays tones a shade off the field, and a softer track', () => {
    const field = lightness(GROUND_PLAY_HEX);
    expect(GROUND_PATCHES.length).toBeGreaterThanOrEqual(3);
    const tones = new Set(GROUND_PATCHES.map((patch) => patch.tone));
    for (const tone of tones) {
      expect(Math.abs(lightness(GROUND_PATCH_HEX[tone]) - field)).toBeLessThan(0.15);
    }
    // Rework 2: a quarter toward the horizon tone read as fog on the grass, so
    // the bleached stretches sit under a tenth of the field's own lightness now.
    expect(Math.abs(lightness(GROUND_PATCH_HEX.bleach) - field)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(lightness(GROUND_GATE_PATH_HEX) - field)).toBeLessThan(0.11);
  });

  it('masses the treeline and keeps the frame inside its ceilings', () => {
    const bearings = treelineBearings();
    const masses: number[][] = [];
    for (const bearing of bearings) {
      const last = masses[masses.length - 1];
      if (last !== undefined && bearing - last[last.length - 1] <= 12) {
        last.push(bearing);
      } else {
        masses.push([bearing]);
      }
    }
    const full = masses.filter((mass) => mass.length >= 4);
    expect(full.length).toBeGreaterThanOrEqual(3);
    expect(DRESSING_MANIFEST.length + 3).toBeLessThan(DRAW_CALL_CEILING);
    expect(createSky().clouds.length).toBe(SKY_CLOUD_SPECS.length);
  });

  it('keeps the frame inside its ceilings at this placement count', () => {
    const facts = new Map<string, number>();
    let triangles = 0;
    for (const item of DRESSING_MANIFEST) {
      let count = facts.get(item.file);
      if (count === undefined) {
        const url = new URL(`../../public/models/dressing/${item.file}`, import.meta.url);
        count = readGlbFacts(url).triangles;
        facts.set(item.file, count);
      }
      triangles += count;
    }
    expect(triangles).toBeLessThan(TRIANGLE_CEILING);
  });
});
