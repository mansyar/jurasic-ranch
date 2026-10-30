import * as THREE from 'three';
import { CAMERA_FAR_METRES, createGround } from '../ranch/ground.js';
import { resolvePixelRatio } from './pixel-ratio.js';
import { BOOT_POV_ID, POV_PRESETS } from './pov.js';
import { SKY_ZENITH_HEX } from './sky.js';

/**
 * The fixed daylight stage the render loop draws: renderer, scene, lights,
 * ground and the perspective camera, plus the resize helper the boot code
 * wires to the window event.
 */

/**
 * Camera far plane in metres, derived from the meadow the ranch stands in
 * (`CAMERA_FAR_METRES` in `src/ranch/ground.ts`): twice the meadow radius, so
 * no preset can see the far plane clip the apron. Re-exported here because the
 * camera is the thing the plane belongs to.
 */
export { CAMERA_FAR_METRES };

/**
 * Vertical field of view the camera is built with, in degrees — the boot
 * preset's lens (FR-10). The lens now belongs to the preset rather than to the
 * camera, so a cut re-projects it; `src/ranch/ground.ts` derives the ground's
 * reach from whichever lens a preset carries, and the frame-edge rays are
 * re-checked per preset rather than against one copied fov.
 */
export const CAMERA_VERTICAL_FOV_DEGREES = POV_PRESETS[BOOT_POV_ID].fov;

export interface ViewerScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  /** Re-apply the viewport size after a resize (camera aspect + renderer). */
  resize(): void;
}

/** Enable shadow casting on every mesh under `root` (FR-5 stage lighting). */
export function enableShadows(root: THREE.Object3D): void {
  root.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
    }
  });
}

/**
 * Build the daylight ranch stage. Returns null when the device cannot create
 * a WebGL context, so boot can show the status-pill fallback instead of
 * throwing.
 */
export function createViewerScene(canvas: HTMLCanvasElement): ViewerScene | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(resolvePixelRatio(window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // NFR-3: Polyfork colours go muddy under ACES, so daylight stays unmapped.
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_ZENITH_HEX);

  const sun = new THREE.DirectionalLight(0xfff2d9, 2.2);
  sun.position.set(3, 5, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x7ec850, 0.9));

  // FR-3: the meadow, the wear and the gate path are one derived group — two
  // ground tones with separate radii (no coplanar overlap) plus flush decals.
  scene.add(createGround());

  const camera = new THREE.PerspectiveCamera(
    CAMERA_VERTICAL_FOV_DEGREES,
    window.innerWidth / window.innerHeight,
    0.1,
    CAMERA_FAR_METRES,
  );

  const resize = (): void => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(resolvePixelRatio(window.devicePixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  return { renderer, scene, camera, sun, resize };
}
