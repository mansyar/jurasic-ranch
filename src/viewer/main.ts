import * as THREE from 'three';
import type { DinoPlayer } from '../ranch/dino-player.js';
import { trioSpawnPositions } from '../ranch/avoidance.js';
import { buildDressing } from '../ranch/dressing.js';
import { DustPool } from '../ranch/dust.js';
import { unlockAudio } from './audio.js';
import {
  CANVAS_ID,
  STATUS_ID,
  WALK_BUTTON_ID,
  WALK_SETTING_KEY,
  createHud,
  setStatus,
} from './hud.js';
import { loadBrachioPlayer, loadStegoPlayer, loadTrikePlayer, type LoadedDino } from './loaders.js';
import {
  TRIO_SPAWN_HEADINGS_RADIANS,
  setAllWalking,
  startLoop,
  type LoopStage,
  type RenderDtHook,
} from './loop.js';
import {
  createPlaceholderBrachio,
  createPlaceholderStego,
  createPlaceholderTrike,
} from './placeholders.js';
import { createViewerScene, enableShadows } from './scene.js';
import { readSetting, writeSetting } from './storage.js';
import type { DevBridge } from '../dev/harness.js';

/** Boot the offline viewer: daylight scene, fixed camera, 72px Walk button. */
export async function bootViewer(): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }
  // FR-1/FR-10: the harness is a dev-build-only dynamic import. Production
  // builds statically replace `import.meta.env.DEV` with false, so neither the
  // query read nor the chunk survives in `dist/`, and the kid-facing DOM, RNG
  // and bundle stay exactly as before. Read `dev=1` before the import: an
  // ordinary dev boot must not fetch the harness module (F4).
  const devRequested =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === '1';
  const dev = devRequested ? await import('../dev/harness.js') : null;
  const options = dev?.parseDevQuery(window.location.search) ?? null;
  // FR-8/AC-9: one generator per consumer, derived from `seed` by fixed index,
  // so GLB resolution order and wall-clock blink draws never shift poses.
  const streams =
    dev !== null && options?.enabled === true && options.seed !== null
      ? dev.seededStreams(options.seed)
      : null;
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
    setStatus(status, 'WebGL is unavailable on this device.');
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
  const sharedDust = new DustPool({ random: streams?.dust ?? Math.random });
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
  void loadTrikePlayer(sharedDust, streams?.movement.trike ?? Math.random, streams?.blink.trike)
    .then((loaded) => {
      swapToRigged(trike, loaded, TRIO_SPAWN_HEADINGS_RADIANS[0], (player, model) => {
        stage.trikePlayer = player;
        stage.trikeModel = model;
      });
    })
    .catch((error: unknown) => {
      console.warn('Rigged trike unavailable; keeping the placeholder.', error);
    });

  void loadStegoPlayer(sharedDust, streams?.movement.stego ?? Math.random, streams?.blink.stego)
    .then((loaded) => {
      swapToRigged(stego, loaded, TRIO_SPAWN_HEADINGS_RADIANS[1], (player, model) => {
        stage.stegoPlayer = player;
        stage.stegoModel = model;
      });
    })
    .catch((error: unknown) => {
      console.warn('Rigged stego unavailable; keeping the placeholder.', error);
    });

  void loadBrachioPlayer(
    sharedDust,
    streams?.movement.brachio ?? Math.random,
    streams?.blink.brachio,
  )
    .then((loaded) => {
      swapToRigged(brachio, loaded, TRIO_SPAWN_HEADINGS_RADIANS[2], (player, model) => {
        stage.brachioPlayer = player;
        stage.brachioModel = model;
      });
    })
    .catch((error: unknown) => {
      console.warn('Rigged brachio unavailable; keeping the placeholder.', error);
    });

  // FR-3: Valley + Farm dressing loads in parallel with the dinos; any GLB
  // failure falls back silently (offline first-visit safety) without
  // blocking boot, and the ground stays playable bare.
  void buildDressing(scene).catch((error: unknown) => {
    console.warn('Ranch dressing unavailable; ground stays playable.', error);
  });

  window.addEventListener('resize', () => {
    viewer.resize();
    hud.syncRotateHint();
  });

  // FR-1/FR-7: the bridge mirrors the kid-facing controls exactly, so a dev
  // press can never leave `walking` or `activePov` out of sync with the chrome.
  const devBridge: DevBridge | null =
    dev !== null && options !== null && options.enabled
      ? {
          scene,
          camera,
          renderer,
          dust: sharedDust,
          dinos: [
            {
              id: 'trike',
              label: 'Trike',
              getModel: () => stage.trikeModel,
              getPlayer: () => stage.trikePlayer,
            },
            {
              id: 'stego',
              label: 'Stego',
              getModel: () => stage.stegoModel,
              getPlayer: () => stage.stegoPlayer,
            },
            {
              id: 'brachio',
              label: 'Brachio',
              getModel: () => stage.brachioModel,
              getPlayer: () => stage.brachioPlayer,
            },
          ],
          getWalking: () => hud.isWalking(),
          setWalking: (next: boolean) => {
            hud.setWalking(next);
          },
          getPov: () => hud.pov(),
          setPov: (id) => {
            hud.setPov(id);
          },
          forceSleepy: () => {
            hud.forceSleepy();
          },
          forceHint: () => {
            hud.forceHint();
          },
          getSleepyState: () => hud.sleepyState(),
        }
      : null;

  // NFR-1: stays null without `?dev=1`, so the only cost is one null check.
  let devFrame: RenderDtHook | null = null;
  if (dev !== null && devBridge !== null && options !== null) {
    devFrame = dev.installDevHarness(devBridge, options);
  }

  startLoop({
    renderer,
    scene,
    camera,
    hud,
    stage,
    trike,
    stego,
    brachio,
    devFrame,
  });
}

bootViewer().catch((error: unknown) => {
  // Boot failures must surface instead of failing silently.
  console.error('Viewer failed to boot:', error);
});
