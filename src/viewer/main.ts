import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DinoPlayer, TRIKE_GAIT } from "../ranch/dino-player.js";
import { WADDLE_LOOP_SECONDS } from "../ranch/waddle.js";
import { unlockAudio } from "./audio.js";
import { resolvePixelRatio } from "./pixel-ratio.js";
import { readSetting, writeSetting } from "./storage.js";

/**
 * Path of the baked Trike GLB (Phase 1 pastel baby variant, Draco, <150 KB).
 * The viewer paints the procedural placeholder instantly and swaps to this
 * rigged model as soon as it loads, so boot stays green even when the
 * fetch fails.
 */
/** Deploy base: "/" locally and in tests, subpath-safe under a future base. */
const BASE_URL = import.meta.env.BASE_URL;

export const TRIKE_MODEL_URL = `${BASE_URL}models/trike.glb`;

/**
 * Same-origin Draco decoder vendored under `public/draco` (offline-first:
 * never the Google CDN default decoder path).
 */
const DRACO_DECODER_PATH = `${BASE_URL}draco/`;

/** Name of the baked seamless loop inside the Trike GLB. */
const WADDLE_CLIP_NAME = "Waddle";

/** Placeholder part that may bob; the legs stay planted (body-only bob). */
export const PLACEHOLDER_BODY_NAME = "PlaceholderBody";

/**
 * Baked pastel baby look (Phase 1): the shipped GLB already carries the
 * pastel palette in its vertex colors, so the viewer applies no runtime
 * recolor. These constants stay in sync with the bake by construction:
 * the placeholder body matches the baked hide zone, and only the pink
 * blush cheeks stay runtime — they pin under the Head bone after load.
 */
/** Baby-green body, verbatim the baked GLB hide zone. */
export const PLACEHOLDER_BODY_HEX = 0x9ed68a;
/** Blush pink for the runtime cheek spheres. */
export const BLUSH_HEX = 0xf2a0ac;
/** Blush cheek sphere radius in metres. */
export const BLUSH_CHEEK_RADIUS_METRES = 0.03;
/**
 * Cheek offsets in Head-bone local space, in metres: symmetric, low, forward.
 */
export const BLUSH_CHEEK_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [-0.09, -0.02, 0.1],
  [0.09, -0.02, 0.1],
];

/**
 * Pin two pink cheek spheres under the Head bone. No-op when the head bone
 * is missing (stub scene); idempotent — re-pinning removes old cheeks first.
 */
export function attachBlushCheeks(head: THREE.Object3D | null): THREE.Mesh[] {
  if (head === null) {
    return [];
  }
  // Snapshot: removing cheeks mutates the live children array mid-loop.
  for (const old of head.children.slice()) {
    if (old.name === "Blush_L" || old.name === "Blush_R") {
      head.remove(old);
    }
  }
  const material = new THREE.MeshStandardMaterial({
    color: BLUSH_HEX,
    roughness: 0.8,
  });
  const geometry = new THREE.SphereGeometry(BLUSH_CHEEK_RADIUS_METRES, 12, 8);
  return BLUSH_CHEEK_OFFSETS.map(([x, y, z], index) => {
    const cheek = new THREE.Mesh(geometry, material);
    cheek.name = index === 0 ? "Blush_L" : "Blush_R";
    cheek.position.set(x, y, z);
    head.add(cheek);
    return cheek;
  });
}

const CANVAS_ID = "scene";
const WALK_BUTTON_ID = "walk-button";
const STATUS_ID = "status";
const WALK_SETTING_KEY = "walking";

/**
 * Build the Phase 1 placeholder Trike: a pastel flat-shaded baby about
 * 3.7 m long facing +Z with its feet on y = 0 — the same footprint as the
 * rigged swap target (baked size-0.6 GLB, ~3.8 m, 3.3–4.2 m window per
 * scripts/check-trike.test.ts), so the swap does not pop. It paints
 * instantly while the rigged GLB loads, then leaves the scene on a
 * successful swap.
 */
export function createPlaceholderTrike(): THREE.Group {
  const body = new THREE.MeshStandardMaterial({
    color: PLACEHOLDER_BODY_HEX,
    flatShading: true,
    roughness: 0.9,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x3a4a3a,
    flatShading: true,
    roughness: 0.9,
  });
  const blush = new THREE.MeshStandardMaterial({
    color: BLUSH_HEX,
    flatShading: true,
    roughness: 0.9,
  });

  const trike = new THREE.Group();
  trike.name = "PlaceholderTrike";

  /** Upper body: the only part the fallback bob may move (feet stay planted). */
  const upper = new THREE.Group();
  upper.name = PLACEHOLDER_BODY_NAME;
  trike.add(upper);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), body);
  torso.scale.set(1.6, 1.0, 1.0);
  torso.position.set(0, 0.42, 0);
  upper.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), body);
  head.position.set(0.5, 0.56, 0);
  upper.add(head);

  const frill = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 12), body);
  frill.rotation.z = Math.PI / 2;
  frill.position.set(0.34, 0.62, 0);
  upper.add(frill);

  const hornGeo = new THREE.ConeGeometry(0.035, 0.12, 8);
  for (const z of [-0.08, 0.08]) {
    const horn = new THREE.Mesh(hornGeo, dark);
    horn.position.set(0.62, 0.74, z);
    upper.add(horn);
  }
  const noseHorn = new THREE.Mesh(hornGeo, dark);
  noseHorn.rotation.z = -Math.PI / 3;
  noseHorn.position.set(0.66, 0.6, 0);
  upper.add(noseHorn);

  const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
  for (const z of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(eyeGeo, dark);
    eye.position.set(0.62, 0.6, z);
    upper.add(eye);
  }

  const blushGeo = new THREE.SphereGeometry(0.045, 8, 8);
  for (const z of [-0.16, 0.16]) {
    const cheek = new THREE.Mesh(blushGeo, blush);
    cheek.scale.set(0.5, 1, 0.4);
    cheek.position.set(0.58, 0.52, z);
    upper.add(cheek);
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
  upper.add(tail);

  // Match the rigged DinoPlayer footprint (faces +Z, ~3.7 m baked baby
  // scale): the authored parts face +X at ~1.44 m, so rotate onto +Z then
  // scale by 2.6 into the 3.3–4.2 m shipped-GLB window.
  // Group origin sits at ground level, so feet stay on y = 0.
  trike.rotation.y = -Math.PI / 2;
  trike.scale.setScalar(2.6);

  return trike;
}

/**
 * Pose the placeholder for a walk time. Only the upper body bobs (feet stay
 * planted) and the pose at the loop end matches the loop start, so the 0.8 s
 * loop is seamless.
 */
export function updatePlaceholderWalk(trike: THREE.Group, elapsedSeconds: number): void {
  const phase = (elapsedSeconds % WADDLE_LOOP_SECONDS) / WADDLE_LOOP_SECONDS;
  const swing = phase * Math.PI * 2;
  const upper = trike.getObjectByName(PLACEHOLDER_BODY_NAME) ?? trike;
  upper.position.y = Math.abs(Math.sin(swing)) * 0.03;
  upper.rotation.z = Math.sin(swing) * 0.05;
}

/** Rigged model plus its player, ready to swap into the scene. */
export interface LoadedTrike {
  model: THREE.Object3D;
  player: DinoPlayer;
}

/**
 * Load the baked Draco GLB and wrap its `Waddle` clip in a DinoPlayer.
 * DOM- and renderer-free (loader boundary only), so tests can drive it with
 * a stubbed GLTFLoader while the real viewer owns the WebGL chrome.
 */
export async function loadTrikePlayer(): Promise<LoadedTrike> {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  try {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    const gltf = await loader.loadAsync(TRIKE_MODEL_URL);
    const clip: THREE.AnimationClip | undefined =
      THREE.AnimationClip.findByName(gltf.animations, WADDLE_CLIP_NAME) ?? gltf.animations[0];
    if (clip === undefined) {
      throw new Error(`Trike GLB has no animations (expected "${WADDLE_CLIP_NAME}")`);
    }
    // Baked pastel baby look: the GLB already carries the pastel palette in
    // its vertex colors, so no runtime recolor runs here. Only pin blush
    // cheeks to the blink Head bone. No-op on models without a Head node.
    const player = new DinoPlayer(gltf.scene, { clip, gait: TRIKE_GAIT });
    attachBlushCheeks(player.head);
    return { model: gltf.scene, player };
  } finally {
    draco.dispose();
  }
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
  let player: DinoPlayer | null = null;
  const syncChrome = (): void => {
    button.textContent = walking ? "Stop" : "Walk";
    button.setAttribute("aria-pressed", walking ? "true" : "false");
    setStatus(status, walking ? "Walking" : "Tap Walk to waddle");
  };
  button.addEventListener("click", () => {
    walking = !walking;
    player?.setWalking(walking);
    void unlockAudio();
    void writeSetting(WALK_SETTING_KEY, walking);
    syncChrome();
  });
  syncChrome();

  // Swap the instant placeholder for the rigged GLB once Draco decoding
  // finishes. A failed load keeps the placeholder walking (offline first-visit
  // safety) and surfaces the reason in the console.
  void loadTrikePlayer()
    .then(({ model, player: rigged }) => {
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
        }
      });
      scene.remove(trike);
      scene.add(model);
      scene.add(rigged.dust.points);
      rigged.setWalking(walking);
      player = rigged;
    })
    .catch((error: unknown) => {
      console.warn("Rigged trike unavailable; keeping the placeholder.", error);
    });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(resolvePixelRatio(window.devicePixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.25);
    const now = clock.elapsedTime;
    if (player !== null) {
      player.update(dt, now);
    } else if (walking) {
      updatePlaceholderWalk(trike, now);
    }
    renderer.render(scene, camera);
  });
}

bootViewer().catch((error: unknown) => {
  // Boot failures must surface instead of failing silently.
  console.error("Viewer failed to boot:", error);
});
