import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DinoPlayer, STEGO_GAIT, TRIKE_GAIT } from "../ranch/dino-player.js";
import { avoidanceNudges } from "../ranch/avoidance.js";
import { buildDressing } from "../ranch/dressing.js";
import { DustPool } from "../ranch/dust.js";
import { SleepyController } from "../ranch/sleepy.js";
import { ensureSleepyOverlay, hintSuppressedBySleepy, setSleepyVisible } from "./sleepy-ui.js";
import { WADDLE_LOOP_SECONDS, wrapAngle, type GaitParams } from "../ranch/waddle.js";
import { unlockAudio } from "./audio.js";
import { resolvePixelRatio } from "./pixel-ratio.js";
import {
  HINT_IDLE_MS,
  applyPovPreset,
  hintModeFor,
  isPortraitViewport,
  shouldShowHint,
  type PovPresetId,
} from "./pov.js";
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
 * Path of the baked Stego GLB (Phase 2 pastel baby variant, Draco). Loads
 * through the same Draco path and prefer-Waddle-else-first contract as the
 * Trike, wrapped in a DinoPlayer with STEGO_GAIT.
 */
export const STEGO_MODEL_URL = `${BASE_URL}models/stego.glb`;

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
/** Boxy fallback Stego hide: dusty teal, verbatim the baked Stego hide zone. */
export const STEGO_BODY_HEX = 0x7fb5a3;
/** Boxy fallback Stego plates: peach, verbatim the baked Stego plate zone. */
export const STEGO_PLATE_HEX = 0xefa27e;
/** Lateral spawn offset in metres: Trike starts at -x, Stego at +x (FR-5). */
export const SPAWN_OFFSET_METRES = 0.4;
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
 * Build the Phase 3 boxy fallback Stego: dusty-teal body with a peach plate
 * row, about 3.8 m long facing +Z with its feet on y = 0 — the same footprint
 * window as the rigged swap target (baked size-0.6 GLB, ~3.9 m, 3.3–4.2 m per
 * scripts/check-stego.test.ts), so the swap does not pop. Deliberately boxy
 * (boxes only) so it never reads as a second Trike. Shares the placeholder
 * bob via the common PlaceholderBody part name.
 */
export function createPlaceholderStego(): THREE.Group {
  const hide = new THREE.MeshStandardMaterial({
    color: STEGO_BODY_HEX,
    flatShading: true,
    roughness: 0.9,
  });
  const plate = new THREE.MeshStandardMaterial({
    color: STEGO_PLATE_HEX,
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

  const stego = new THREE.Group();
  stego.name = "PlaceholderStego";

  /** Upper body: the only part the fallback bob may move (feet stay planted). */
  const upper = new THREE.Group();
  upper.name = PLACEHOLDER_BODY_NAME;
  stego.add(upper);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.46, 0.4), hide);
  torso.position.set(0, 0.5, 0);
  upper.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.28), hide);
  head.position.set(0.55, 0.6, 0);
  upper.add(head);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.2), hide);
  tail.position.set(-0.58, 0.52, 0);
  upper.add(tail);

  const plateGeo = new THREE.BoxGeometry(0.07, 0.3, 0.24);
  for (let index = 0; index < 5; index += 1) {
    const fin = new THREE.Mesh(plateGeo, plate);
    fin.position.set(-0.28 + index * 0.17, 0.85, 0);
    upper.add(fin);
  }

  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
  for (const z of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(eyeGeo, dark);
    eye.position.set(0.66, 0.64, z);
    upper.add(eye);
  }

  const cheekGeo = new THREE.SphereGeometry(0.04, 8, 8);
  for (const z of [-0.15, 0.15]) {
    const cheek = new THREE.Mesh(cheekGeo, blush);
    cheek.scale.set(0.5, 1, 0.4);
    cheek.position.set(0.62, 0.54, z);
    upper.add(cheek);
  }

  const legGeo = new THREE.BoxGeometry(0.16, 0.4, 0.16);
  for (const x of [-0.25, 0.25]) {
    for (const z of [-0.13, 0.13]) {
      const leg = new THREE.Mesh(legGeo, hide);
      leg.position.set(x, 0.2, z);
      stego.add(leg);
    }
  }

  // Same swap contract as the Trike placeholder: authored parts face +X at
  // ~1.46 m, so rotate onto +Z then scale by 2.6 into the 3.3–4.2 m
  // shipped-GLB window. Group origin sits at ground level, feet on y = 0.
  stego.rotation.y = -Math.PI / 2;
  stego.scale.setScalar(2.6);

  return stego;
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
export interface LoadedDino {
  model: THREE.Object3D;
  player: DinoPlayer;
}

/** Legacy Trike loader name: identical shape to LoadedDino. */
export type LoadedTrike = LoadedDino;

/**
 * Load a baked Draco GLB and wrap its `Waddle` clip in a DinoPlayer with the
 * given gait. DOM- and renderer-free (loader boundary only), so tests can
 * drive it with a stubbed GLTFLoader while the real viewer owns the WebGL
 * chrome. An injected DustPool is shared (FR-9); omitted, the player keeps a
 * private pool exactly as before.
 */
async function loadDinoPlayer(
  modelUrl: string,
  species: string,
  gait: GaitParams,
  sharedDust?: DustPool,
): Promise<LoadedDino> {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  try {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    const gltf = await loader.loadAsync(modelUrl);
    const clip: THREE.AnimationClip | undefined =
      THREE.AnimationClip.findByName(gltf.animations, WADDLE_CLIP_NAME) ?? gltf.animations[0];
    if (clip === undefined) {
      throw new Error(`${species} GLB has no animations (expected "${WADDLE_CLIP_NAME}")`);
    }
    // Baked pastel baby look: the GLB already carries the pastel palette in
    // its vertex colors, so no runtime recolor runs here. Only pin blush
    // cheeks to the blink Head bone. No-op on models without a Head node.
    const player = new DinoPlayer(gltf.scene, { clip, gait, dust: sharedDust });
    attachBlushCheeks(player.head);
    return { model: gltf.scene, player };
  } finally {
    draco.dispose();
  }
}

/** Load the baked Trike GLB with the Trike gait (FR-2 behaviour unchanged). */
export function loadTrikePlayer(sharedDust?: DustPool): Promise<LoadedTrike> {
  return loadDinoPlayer(TRIKE_MODEL_URL, "Trike", TRIKE_GAIT, sharedDust);
}

/** Load the baked Stego GLB with the Stego gait (FR-4). */
export function loadStegoPlayer(sharedDust?: DustPool): Promise<LoadedDino> {
  return loadDinoPlayer(STEGO_MODEL_URL, "Stego", STEGO_GAIT, sharedDust);
}

/** One Walk button drives every loaded player together (FR-7, AC-4). */
export function setAllWalking(players: DinoPlayer[], walking: boolean): void {
  for (const player of players) {
    player.setWalking(walking);
  }
}

/** Status pill copy: names both species while walking (NFR-4 icon + word). */
export function walkStatusText(walking: boolean): string {
  return walking ? "🦕 Trike + 🦖 Stego walking" : "Tap Walk to waddle";
}

/**
 * Soft-steer both players apart (FR-6): bias each heading away when the pair
 * is closer than 0.4 m. Never touches `moving`, so neither dino stops,
 * bounces, or teleports.
 */
export function steerPairApart(
  trike: DinoPlayer,
  trikeModel: THREE.Object3D,
  stego: DinoPlayer,
  stegoModel: THREE.Object3D,
): void {
  const { aNudge, bNudge } = avoidanceNudges(
    trikeModel.position.x,
    trikeModel.position.z,
    trike.heading,
    stegoModel.position.x,
    stegoModel.position.z,
    stego.heading,
  );
  if (aNudge !== 0) {
    trike.turnTo(wrapAngle(trike.heading + aNudge));
  }
  if (bNudge !== 0) {
    stego.turnTo(wrapAngle(stego.heading + bNudge));
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
  // Ranch is the boot view; the preset owns the numbers (FR-1).
  let activePov: PovPresetId = "ranch";
  applyPovPreset(camera, activePov);

  const enableShadows = (root: THREE.Object3D): void => {
    root.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
      }
    });
  };

  // Instant boxy pair at the ±0.4 m spawn (FR-5): each rigged GLB swaps its
  // own placeholder on load, so a slow Stego fetch never blocks the Trike.
  const trike = createPlaceholderTrike();
  trike.position.set(-SPAWN_OFFSET_METRES, 0, 0);
  enableShadows(trike);
  scene.add(trike);
  const stego = createPlaceholderStego();
  stego.position.set(SPAWN_OFFSET_METRES, 0, 0);
  enableShadows(stego);
  scene.add(stego);

  // FR-9: one shared DustPool feeds both players (single points draw call).
  const sharedDust = new DustPool();
  scene.add(sharedDust.points);

  let walking = (await readSetting(WALK_SETTING_KEY)) === true;
  const players: DinoPlayer[] = [];
  let trikePlayer: DinoPlayer | null = null;
  let stegoPlayer: DinoPlayer | null = null;
  let trikeModel: THREE.Object3D = trike;
  let stegoModel: THREE.Object3D = stego;
  const syncChrome = (): void => {
    button.textContent = walking ? "Stop" : "Walk";
    button.setAttribute("aria-pressed", walking ? "true" : "false");
    setStatus(status, walkStatusText(walking));
  };
  // FR-5: hint glow after 5 s of no interaction; any press clears it.
  // FR-4: the same press wakes the sleepy controller and hides the ZZZ.
  let lastInteractionMs = performance.now();
  const sleepy = new SleepyController(lastInteractionMs);
  const sleepyOverlay = ensureSleepyOverlay(document);
  let sleepyShown = false;
  const markInteraction = (): void => {
    lastInteractionMs = performance.now();
    document.body.classList.remove("hint-glow", "hint-static");
    sleepy.markInteraction(lastInteractionMs);
    if (sleepyShown) {
      setSleepyVisible(sleepyOverlay, false, false);
      sleepyShown = false;
    }
  };
  window.addEventListener("pointerdown", markInteraction, { passive: true });
  button.addEventListener("click", () => {
    walking = !walking;
    setAllWalking(players, walking);
    void unlockAudio();
    void writeSetting(WALK_SETTING_KEY, walking);
    markInteraction();
    syncChrome();
  });
  syncChrome();

  // FR-1: fixed POV buttons cut the camera instantly (no tween, AC-1).
  const povButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("#pov [data-pov]"),
  );
  const syncPov = (): void => {
    for (const povButton of povButtons) {
      povButton.setAttribute(
        "aria-pressed",
        povButton.dataset["pov"] === activePov ? "true" : "false",
      );
    }
  };
  for (const povButton of povButtons) {
    povButton.addEventListener("click", () => {
      const id = povButton.dataset["pov"];
      if (id !== "ranch" && id !== "nest" && id !== "garden") {
        return;
      }
      activePov = id;
      applyPovPreset(camera, activePov);
      markInteraction();
      syncPov();
    });
  }
  syncPov();

  window.setInterval(() => {
    if (shouldShowHint(lastInteractionMs, performance.now(), HINT_IDLE_MS)) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.body.classList.add(hintModeFor(reduced));
    }
  }, 1000);

  // FR-6: no pinch/double-tap zoom on the tablet stage.
  document.addEventListener("gesturestart", (event: Event) => {
    event.preventDefault();
  });
  document.addEventListener(
    "dblclick",
    (event: Event) => {
      event.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener(
    "touchmove",
    (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  // FR-6: portrait shows the rotate hint.
  const rotateHint = document.getElementById("rotate-hint");
  const syncRotateHint = (): void => {
    if (rotateHint) {
      rotateHint.hidden = !isPortraitViewport(window.innerWidth, window.innerHeight);
    }
  };
  syncRotateHint();

  // Swap one instant placeholder for its rigged GLB. Crossing initial
  // headings (+X for Trike, -X for Stego) send the pair past each other
  // early so avoidance visibly steers from the first seconds.
  const swapToRigged = (
    placeholder: THREE.Group,
    loaded: LoadedDino,
    initialHeading: number,
    assign: (player: DinoPlayer, model: THREE.Object3D) => void,
  ): void => {
    enableShadows(loaded.model);
    loaded.model.position.copy(placeholder.position);
    scene.remove(placeholder);
    scene.add(loaded.model);
    loaded.player.turnTo(initialHeading);
    loaded.player.setWalking(walking);
    players.push(loaded.player);
    assign(loaded.player, loaded.model);
  };

  // Swap the instant placeholders for the rigged GLBs once Draco decoding
  // finishes. A failed load keeps its placeholder walking (offline
  // first-visit safety) and surfaces the reason in the console; the other
  // dino is unaffected.
  void loadTrikePlayer(sharedDust)
    .then((loaded) => {
      swapToRigged(trike, loaded, Math.PI / 2, (player, model) => {
        trikePlayer = player;
        trikeModel = model;
      });
    })
    .catch((error: unknown) => {
      console.warn("Rigged trike unavailable; keeping the placeholder.", error);
    });

  void loadStegoPlayer(sharedDust)
    .then((loaded) => {
      swapToRigged(stego, loaded, -Math.PI / 2, (player, model) => {
        stegoPlayer = player;
        stegoModel = model;
      });
    })
    .catch((error: unknown) => {
      console.warn("Rigged stego unavailable; keeping the placeholder.", error);
    });

  // FR-3: Valley + Farm dressing loads in parallel with the dinos; any GLB
  // failure falls back silently (offline first-visit safety) without
  // blocking boot, and the ground stays playable bare.
  void buildDressing(scene).catch((error: unknown) => {
    console.warn("Ranch dressing unavailable; ground stays playable.", error);
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(resolvePixelRatio(window.devicePixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    syncRotateHint();
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.25);
    const now = clock.elapsedTime;
    // FR-4: sleepy cues after ~90 s idle; any tap already reset the
    // controller via markInteraction. Sleepy owns the stage over the hint
    // glow (FR-5 precedence), and the ZZZ overlay only plays at full sleepy.
    const sleepyState = sleepy.update(performance.now());
    if (hintSuppressedBySleepy(sleepyState)) {
      document.body.classList.remove("hint-glow", "hint-static");
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const player of players) {
      player.setSleepyWeight(sleepy.sleepyWeight);
    }
    const showSleepy = sleepyState === "sleepy";
    if (showSleepy !== sleepyShown) {
      setSleepyVisible(sleepyOverlay, showSleepy, reducedMotion);
      sleepyShown = showSleepy;
    }
    if (trikePlayer !== null && stegoPlayer !== null) {
      steerPairApart(trikePlayer, trikeModel, stegoPlayer, stegoModel);
    }
    if (trikePlayer !== null) {
      trikePlayer.update(dt, now, reducedMotion);
    } else if (walking) {
      updatePlaceholderWalk(trike, now);
    }
    if (stegoPlayer !== null) {
      stegoPlayer.update(dt, now, reducedMotion);
    } else if (walking) {
      updatePlaceholderWalk(stego, now);
    }
    renderer.render(scene, camera);
  });
}

bootViewer().catch((error: unknown) => {
  // Boot failures must surface instead of failing silently.
  console.error("Viewer failed to boot:", error);
});
