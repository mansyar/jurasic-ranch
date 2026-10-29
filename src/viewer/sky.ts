import * as THREE from 'three';
import { GROUND_RADIUS_METRES } from '../ranch/layout.js';
import { HORIZON_HEX } from '../ranch/ground.js';

/**
 * Sky with depth (FR-17): a vertical gradient that runs pale at the horizon to
 * the shipped daylight blue overhead, plus four chunky clouds drifting on the
 * loop's clock.
 *
 * The gradient is a vertex-coloured dome rather than a background texture. A
 * texture would need a canvas (so no Node test), a colour space to declare
 * (NFR-4: the renderer runs `NoToneMapping`, so a wrong space shifts the whole
 * sky), and it would pin the pale band to a screen row instead of the horizon.
 * The dome's tone is a function of world height, so it stays anchored to the
 * horizon from every preset, and its lowest tone is the meadow's own
 * `HORIZON_HEX`, which is what makes the ground end on the sky's colour.
 *
 * Everything here is renderer-free: `createSky()` builds objects and the
 * geometry maths; the drift update mutates cloud positions by the `dt` the
 * render loop hands it, and allocates nothing.
 */

/** The shipped flat sky (NFR-4): unchanged at the top of the dome. */
export const SKY_ZENITH_HEX = 0x9fd4ef;

/**
 * Dome radius in metres: six play radii. Far enough that the camera never
 * leaves it and that its own horizon sits above the meadow's rim (so the rim
 * overlaps sky, never a gap), and inside the far plane so it is never clipped.
 */
const DOME_PLAY_RADII = 6;
export const SKY_DOME_RADIUS_METRES = GROUND_RADIUS_METRES * DOME_PLAY_RADII;

/** Segments of the dome: a 72 m sphere reads smooth at 48 x 24. */
const DOME_SEGMENTS = 48;
const DOME_RINGS = 24;

/**
 * Sky tone at a normalised height: 0 at the horizon, 1 at the zenith. Below the
 * dome's equator the horizon tone is held flat, so the sliver the meadow's rim
 * exposes just above itself is the same pale tone as the field.
 */
export function skyToneAt(elevation: number): THREE.Color {
  const amount = THREE.MathUtils.clamp(elevation, 0, 1);
  return new THREE.Color(HORIZON_HEX).lerp(new THREE.Color(SKY_ZENITH_HEX), amount);
}

/** One cloud's authored shape: offsets and box sizes as fractions of its half width. */
interface CloudBox {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

/**
 * A cloud is one lumpy stack of four boxes, so a handful of draw calls buys a
 * silhouette that reads from far below. Values are fractions of the half width.
 */
const CLOUD_BOXES: readonly CloudBox[] = [
  { x: 0, y: 0, z: 0, width: 1, height: 0.52, depth: 0.62 },
  { x: -0.58, y: -0.06, z: 0.04, width: 0.56, height: 0.36, depth: 0.5 },
  { x: 0.54, y: -0.04, z: -0.03, width: 0.62, height: 0.4, depth: 0.52 },
  { x: 0.06, y: 0.3, z: 0.01, width: 0.46, height: 0.3, depth: 0.44 },
];

/** Cloud altitude in metres: well above the tallest treeline prop on the apron. */
const CLOUD_ALTITUDE_METRES = GROUND_RADIUS_METRES * 2.4;

/** Half the width of the reference cloud, in metres. */
const CLOUD_HALF_WIDTH_METRES = GROUND_RADIUS_METRES * 0.25;

/** How long a cloud takes to cross the meadow, expressed as a base speed. */
const CLOUD_DRIFT_METRES_PER_SECOND = 0.35;

/** Clouds wrap inside this many play radii of the ranch centre. */
const CLOUD_DRIFT_PLAY_RADII = 3.2;
export const CLOUD_DRIFT_BOUND_METRES = GROUND_RADIUS_METRES * CLOUD_DRIFT_PLAY_RADII;

/** One authored cloud: where it starts, and how it moves. */
interface CloudSpec {
  readonly x: number;
  readonly z: number;
  readonly altitude: number;
  readonly scale: number;
  readonly drift: number;
}

/**
 * Four clouds, spread so no two share a bearing and none sits over the middle
 * of the ranch: `x`/`z` are play radii, `altitude`/`scale`/`drift` are
 * multipliers on the derived base values.
 */
const CLOUD_SPECS: readonly CloudSpec[] = [
  { x: -0.9, z: -1.4, altitude: 1, scale: 1.15, drift: 0.9 },
  { x: 1.6, z: 0.2, altitude: 1.12, scale: 0.85, drift: 0.7 },
  { x: -0.2, z: 1.9, altitude: 0.92, scale: 1, drift: 1.1 },
  { x: 2.6, z: -2.4, altitude: 1.05, scale: 0.75, drift: 0.8 },
];

/** How many clouds the sky ships: FR-17 asks for four. */
export const SKY_CLOUD_COUNT = CLOUD_SPECS.length;

/** Eastward drift per cloud, in metres per second, derived from the specs. */
export const CLOUD_SPEEDS_METRES_PER_SECOND: readonly number[] = CLOUD_SPECS.map(
  (spec) => CLOUD_DRIFT_METRES_PER_SECOND * spec.drift,
);

/** What the render loop needs from the sky: one drift step on its own `dt`. */
export interface SkyDrift {
  update(dtSeconds: number, reducedMotion: boolean): void;
}

/** The built sky: one group to add, and the drift to hand the loop. */
export interface Sky extends SkyDrift {
  group: THREE.Group;
  clouds: readonly THREE.Group[];
}

/**
 * Build the dome and the four clouds.
 *
 * Nothing in here casts or receives a shadow: the sun's shadow map covers the
 * play area, and a 30 m cloud inside it would flatten the ranch's own shadows.
 * Reduced motion is honoured by the drift update, which stops the clouds
 * outright while the sparkle and every other cue stay live.
 */
export function createSky(): Sky {
  const group = new THREE.Group();
  group.name = 'RanchSky';

  const domeGeometry = new THREE.SphereGeometry(SKY_DOME_RADIUS_METRES, DOME_SEGMENTS, DOME_RINGS);
  const positions = domeGeometry.getAttribute('position');
  const colours = new Float32Array(positions.count * 3);
  const tone = new THREE.Color();
  for (let index = 0; index < positions.count; index += 1) {
    tone.copy(skyToneAt(positions.getY(index) / SKY_DOME_RADIUS_METRES));
    colours[index * 3] = tone.r;
    colours[index * 3 + 1] = tone.g;
    colours[index * 3 + 2] = tone.b;
  }
  domeGeometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const dome = new THREE.Mesh(
    domeGeometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  dome.name = 'RanchSkyDome';
  dome.renderOrder = -1;
  dome.castShadow = false;
  dome.receiveShadow = false;
  group.add(dome);

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xf7fbff,
    roughness: 1,
    flatShading: true,
  });
  const clouds: THREE.Group[] = [];
  CLOUD_SPECS.forEach((spec, cloudIndex) => {
    const cloud = new THREE.Group();
    cloud.name = `RanchSkyCloud-${cloudIndex + 1}`;
    cloud.position.set(
      spec.x * GROUND_RADIUS_METRES,
      CLOUD_ALTITUDE_METRES * spec.altitude,
      spec.z * GROUND_RADIUS_METRES,
    );
    const halfWidth = CLOUD_HALF_WIDTH_METRES * spec.scale;
    for (const box of CLOUD_BOXES) {
      const mesh = new THREE.Mesh(boxGeometry, cloudMaterial);
      mesh.scale.set(halfWidth * box.width, halfWidth * box.height, halfWidth * box.depth);
      mesh.position.set(halfWidth * box.x, halfWidth * box.y, halfWidth * box.z);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      cloud.add(mesh);
    }
    clouds.push(cloud);
    group.add(cloud);
  });

  const update = (dtSeconds: number, reducedMotion: boolean): void => {
    if (reducedMotion || !(dtSeconds > 0)) {
      return;
    }
    clouds.forEach((cloud, index) => {
      const speed = CLOUD_SPEEDS_METRES_PER_SECOND[index] ?? 0;
      const next = cloud.position.x + speed * dtSeconds;
      cloud.position.x =
        next > CLOUD_DRIFT_BOUND_METRES ? next - CLOUD_DRIFT_BOUND_METRES * 2 : next;
    });
  };

  return { group, clouds, update };
}
