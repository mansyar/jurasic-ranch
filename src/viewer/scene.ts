import * as THREE from 'three';
import { GROUND_RADIUS_METRES } from '../ranch/dressing.js';
import { resolvePixelRatio } from './pixel-ratio.js';

/**
 * The fixed daylight stage the render loop draws: renderer, scene, lights,
 * ground and the perspective camera, plus the resize helper the boot code
 * wires to the window event.
 */

/**
 * Camera far plane in metres: four ground radii. A preset stands on the walk
 * circle (inside the prop ring) and must still see the tallest tree on the far
 * rim, so the plane is derived from the ground the ranch actually occupies —
 * 48.2 m for the 12.05 m circle the trio needs, against a fixed 50 m before.
 * A nearer plane is also more depth precision, never less.
 */
export const CAMERA_FAR_METRES = GROUND_RADIUS_METRES * 4;
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
  scene.background = new THREE.Color(0x9fd4ef);

  const sun = new THREE.DirectionalLight(0xfff2d9, 2.2);
  sun.position.set(3, 5, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x7ec850, 0.9));

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_RADIUS_METRES, 64),
    new THREE.MeshStandardMaterial({ color: 0x7ec850, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(
    40,
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
