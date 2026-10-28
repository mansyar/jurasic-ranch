import * as THREE from "three";
import { unlockAudio } from "./audio.js";
import { resolvePixelRatio } from "./pixel-ratio.js";
import { readSetting, writeSetting } from "./storage.js";

/** Length of one waddle loop in seconds; matches the baked clip cadence. */
export const WADDLE_LOOP_SECONDS = 0.8;

/**
 * Model path for the baked Trike. Phase 2 vendors the real GLB here; until
 * then the viewer shows the procedural placeholder below so boot stays green
 * with no failed requests in the console.
 */
export const TRIKE_MODEL_URL = "/models/trike.glb";

const CANVAS_ID = "scene";
const WALK_BUTTON_ID = "walk-button";
const STATUS_ID = "status";
const WALK_SETTING_KEY = "walking";

/**
 * Build the Phase 1 placeholder Trike: a pastel flat-shaded baby about
 * 0.9 m long with its feet on y = 0. Phase 2 replaces it with the rigged GLB.
 */
export function createPlaceholderTrike(): THREE.Group {
  const body = new THREE.MeshStandardMaterial({
    color: 0x9ed68a,
    flatShading: true,
    roughness: 0.9,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x3a4a3a,
    flatShading: true,
    roughness: 0.9,
  });
  const blush = new THREE.MeshStandardMaterial({
    color: 0xf2a0ac,
    flatShading: true,
    roughness: 0.9,
  });

  const trike = new THREE.Group();

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), body);
  torso.scale.set(1.6, 1.0, 1.0);
  torso.position.set(0, 0.42, 0);
  trike.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), body);
  head.position.set(0.5, 0.56, 0);
  trike.add(head);

  const frill = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 12), body);
  frill.rotation.z = Math.PI / 2;
  frill.position.set(0.34, 0.62, 0);
  trike.add(frill);

  const hornGeo = new THREE.ConeGeometry(0.035, 0.12, 8);
  for (const z of [-0.08, 0.08]) {
    const horn = new THREE.Mesh(hornGeo, dark);
    horn.position.set(0.62, 0.74, z);
    trike.add(horn);
  }
  const noseHorn = new THREE.Mesh(hornGeo, dark);
  noseHorn.rotation.z = -Math.PI / 3;
  noseHorn.position.set(0.66, 0.6, 0);
  trike.add(noseHorn);

  const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
  for (const z of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(eyeGeo, dark);
    eye.position.set(0.62, 0.6, z);
    trike.add(eye);
  }

  const blushGeo = new THREE.SphereGeometry(0.045, 8, 8);
  for (const z of [-0.16, 0.16]) {
    const cheek = new THREE.Mesh(blushGeo, blush);
    cheek.scale.set(0.5, 1, 0.4);
    cheek.position.set(0.58, 0.52, z);
    trike.add(cheek);
  }

  const legGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.34, 8);
  for (const x of [-0.25, 0.25]) {
    for (const z of [-0.16, 0.16]) {
      const leg = new THREE.Mesh(legGeo, body);
      leg.position.set(x, 0.17, z);
      trike.add(leg);
    }
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 8), body);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.55, 0.4, 0);
  trike.add(tail);

  return trike;
}

/**
 * Pose the placeholder for a walk time. The lift peaks mid-stride and the
 * pose at the loop end matches the loop start, so the 0.8 s loop is seamless.
 */
export function updatePlaceholderWalk(trike: THREE.Group, elapsedSeconds: number): void {
  const phase = (elapsedSeconds % WADDLE_LOOP_SECONDS) / WADDLE_LOOP_SECONDS;
  const swing = phase * Math.PI * 2;
  trike.position.y = Math.abs(Math.sin(swing)) * 0.03;
  trike.rotation.z = Math.sin(swing) * 0.05;
}

/** Set the status pill text when the element exists. */
function setStatus(status: HTMLElement | null, text: string): void {
  if (status) {
    status.textContent = text;
  }
}

/** Boot the offline viewer: daylight scene, fixed camera, 72px Walk button. */
export async function bootViewer(): Promise<void> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }
  const canvas = document.getElementById(CANVAS_ID);
  const button = document.getElementById(WALK_BUTTON_ID);
  const status = document.getElementById(STATUS_ID);
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    setStatus(status, "WebGL is unavailable on this device.");
    return;
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
    new THREE.CircleGeometry(6, 32),
    new THREE.MeshStandardMaterial({ color: 0x7ec850, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.position.set(2.4, 1.5, 3.0);
  camera.lookAt(0, 0.45, 0);

  const trike = createPlaceholderTrike();
  trike.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
    }
  });
  scene.add(trike);

  let walking = (await readSetting(WALK_SETTING_KEY)) === true;
  const syncChrome = (): void => {
    button.textContent = walking ? "Stop" : "Walk";
    button.setAttribute("aria-pressed", walking ? "true" : "false");
    setStatus(status, walking ? "Walking" : "Tap Walk to waddle");
  };
  button.addEventListener("click", () => {
    walking = !walking;
    void unlockAudio();
    void writeSetting(WALK_SETTING_KEY, walking);
    syncChrome();
  });
  syncChrome();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(resolvePixelRatio(window.devicePixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (walking) {
      updatePlaceholderWalk(trike, clock.getElapsedTime());
    }
    renderer.render(scene, camera);
  });
}

bootViewer().catch((error: unknown) => {
  // Boot failures must surface instead of failing silently.
  console.error("Viewer failed to boot:", error);
});
