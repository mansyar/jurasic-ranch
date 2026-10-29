import * as THREE from "three";
import type { DinoPlayer } from "../ranch/dino-player.js";
import { trioSpawnPositions } from "../ranch/avoidance.js";
import { buildDressing } from "../ranch/dressing.js";
import { DustPool } from "../ranch/dust.js";
import { unlockAudio } from "./audio.js";
import {
  CANVAS_ID,
  STATUS_ID,
  WALK_BUTTON_ID,
  WALK_SETTING_KEY,
  createHud,
  setStatus,
} from "./hud.js";
import {
  loadBrachioPlayer,
  loadStegoPlayer,
  loadTrikePlayer,
  type LoadedDino,
} from "./loaders.js";
import {
  TRIO_SPAWN_HEADINGS_RADIANS,
  setAllWalking,
  startLoop,
  type LoopStage,
} from "./loop.js";
import {
  createPlaceholderBrachio,
  createPlaceholderStego,
  createPlaceholderTrike,
} from "./placeholders.js";
import { createViewerScene, enableShadows } from "./scene.js";
import { readSetting, writeSetting } from "./storage.js";

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

  const viewer = createViewerScene(canvas);
  if (viewer === null) {
    setStatus(status, "WebGL is unavailable on this device.");
    return;
  }
  const { renderer, scene, camera } = viewer;

  // Instant boxy trio at the 120 deg triangle spawn (FR-5): each rigged GLB
  // swaps its own placeholder on load, so a slow fetch never blocks the rest.
  const spawn = trioSpawnPositions();
  const trike = createPlaceholderTrike();
  trike.position.set(spawn[0].x, 0, spawn[0].z);
  enableShadows(trike);
  scene.add(trike);
  const stego = createPlaceholderStego();
  stego.position.set(spawn[1].x, 0, spawn[1].z);
  enableShadows(stego);
  scene.add(stego);
  const brachio = createPlaceholderBrachio();
  brachio.position.set(spawn[2].x, 0, spawn[2].z);
  enableShadows(brachio);
  scene.add(brachio);

  // FR-9: one shared DustPool feeds all three players (single draw call).
  const sharedDust = new DustPool();
  scene.add(sharedDust.points);

  const stage: LoopStage = {
    players: [],
    trikePlayer: null,
    stegoPlayer: null,
    brachioPlayer: null,
    trikeModel: trike,
    stegoModel: stego,
    brachioModel: brachio,
  };
  const hud = createHud({
    camera,
    button,
    status,
    initialWalking: (await readSetting(WALK_SETTING_KEY)) === true,
    onWalkChange: (walking) => {
      setAllWalking(stage.players, walking);
      void unlockAudio();
      void writeSetting(WALK_SETTING_KEY, walking);
    },
  });

  // Swap one instant placeholder for its rigged GLB. Staggered-entry
  // headings (TRIO_SPAWN_HEADINGS_RADIANS) send the trio out on separated
  // legs early so avoidance visibly steers from the first seconds.
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
    loaded.player.setWalking(hud.isWalking());
    stage.players.push(loaded.player);
    assign(loaded.player, loaded.model);
  };

  // Swap the instant placeholders for the rigged GLBs once Draco decoding
  // finishes. A failed load keeps its placeholder walking (offline
  // first-visit safety) and surfaces the reason in the console; the other
  // dinos are unaffected.
  void loadTrikePlayer(sharedDust)
    .then((loaded) => {
      swapToRigged(trike, loaded, TRIO_SPAWN_HEADINGS_RADIANS[0], (player, model) => {
        stage.trikePlayer = player;
        stage.trikeModel = model;
      });
    })
    .catch((error: unknown) => {
      console.warn("Rigged trike unavailable; keeping the placeholder.", error);
    });

  void loadStegoPlayer(sharedDust)
    .then((loaded) => {
      swapToRigged(stego, loaded, TRIO_SPAWN_HEADINGS_RADIANS[1], (player, model) => {
        stage.stegoPlayer = player;
        stage.stegoModel = model;
      });
    })
    .catch((error: unknown) => {
      console.warn("Rigged stego unavailable; keeping the placeholder.", error);
    });

  void loadBrachioPlayer(sharedDust)
    .then((loaded) => {
      swapToRigged(brachio, loaded, TRIO_SPAWN_HEADINGS_RADIANS[2], (player, model) => {
        stage.brachioPlayer = player;
        stage.brachioModel = model;
      });
    })
    .catch((error: unknown) => {
      console.warn("Rigged brachio unavailable; keeping the placeholder.", error);
    });

  // FR-3: Valley + Farm dressing loads in parallel with the dinos; any GLB
  // failure falls back silently (offline first-visit safety) without
  // blocking boot, and the ground stays playable bare.
  void buildDressing(scene).catch((error: unknown) => {
    console.warn("Ranch dressing unavailable; ground stays playable.", error);
  });

  window.addEventListener("resize", () => {
    viewer.resize();
    hud.syncRotateHint();
  });

  startLoop({
    renderer,
    scene,
    camera,
    hud,
    stage,
    trike,
    stego,
    brachio,
  });
}

bootViewer().catch((error: unknown) => {
  // Boot failures must surface instead of failing silently.
  console.error("Viewer failed to boot:", error);
});
