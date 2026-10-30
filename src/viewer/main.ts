import * as THREE from 'three';
import type { DinoPlayer } from '../ranch/dino-player.js';
import { BRACHIO_GAIT, STEGO_GAIT, TRIKE_GAIT } from '../ranch/dino-player.js';
import type { CornerSpecies } from '../ranch/layout.js';
import { VisitDirector } from '../ranch/visit.js';
import type { GaitParams } from '../ranch/waddle.js';
import { trioSpawnPositions } from '../ranch/avoidance.js';
import { buildDressing } from '../ranch/dressing.js';
import type { DressingFrame } from '../ranch/dressing.js';
import {
  DEFAULT_SWAY_SEED,
  CallCooldowns,
  allowsPropTap,
  cornerUnderProp,
  propUnderPointer,
} from '../ranch/ambient.js';
import { DustPool, createDustTexture } from '../ranch/dust.js';
import { ArrivalEffects } from '../ranch/visit-effects.js';
import { installGestureUnlock, installVisibilityHandling } from '../audio/gesture.js';
import { loadAudioSettings, saveMuted, saveVolume } from '../audio/settings.js';
import {
  AUDIO_MUTE_ID,
  AUDIO_PANEL_CLOSE_ID,
  AUDIO_PANEL_ID,
  AUDIO_PANEL_MUTE_ID,
  AUDIO_PARENT_ID,
  AUDIO_VOLUME_ID,
  AUDIO_VOLUME_VALUE_ID,
  createAudioControls,
  isAudioControlTarget,
  type AudioControls,
} from './audio-controls.js';
import {
  audioEngine,
  configureAudio,
  createUnlockFeedback,
  isAudioUnlocked,
  playFeedback,
  unlockAudio,
} from './audio.js';
import {
  CANVAS_ID,
  STATUS_ID,
  WALK_BUTTON_ID,
  WALK_SETTING_KEY,
  createHud,
  setStatus,
} from './hud.js';
import {
  DINO_GROUP_SCALE,
  loadBrachioPlayer,
  loadStegoPlayer,
  loadTrikePlayer,
  worldGait,
  type LoadedDino,
} from './loaders.js';
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
import { createSky } from './sky.js';
import { readSetting, writeSetting } from './storage.js';
import type { DevBridge } from '../dev/harness.js';

/**
 * The gaits the loader actually applies (FR-4): Stego and Brachio are drawn at
 * `DINO_GROUP_SCALE`, so their strides — and with them every duration a visit
 * derives — are the world gaits, not the authored ones.
 */
const VISIT_GAITS: Readonly<Record<CornerSpecies, GaitParams>> = {
  trike: TRIKE_GAIT,
  stego: worldGait(STEGO_GAIT, DINO_GROUP_SCALE),
  brachio: worldGait(BRACHIO_GAIT, DINO_GROUP_SCALE),
};

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

  // FR-17: the sky is built once at boot — dome plus four clouds — and added
  // before anything else so it is behind every later layer. Its drift is wired
  // through `startLoop`, not a second render path.
  const sky = createSky();
  scene.add(sky.group);

  let audio: AudioControls | null = null;
  const audioReadyControl = { resolve: (): void => {} };
  const audioReady = new Promise<void>((resolve) => {
    audioReadyControl.resolve = resolve;
  });
  // FR-6/FR-7: one flush and one greeting timer for the whole session, shared
  // by the first gesture and the mute button's unlock.
  const unlockFeedback = createUnlockFeedback();

  // FR-2: install the first-gesture listener before any awaited settings read,
  // so a tap during boot is not lost. It waits for the controls and engine
  // settings to exist, then unlocks. A tap on the sound controls is ignored so
  // mute can unlock silently (AC-6 edge) and the parent gate cannot start music.
  installGestureUnlock({
    onUnlock: async () => {
      await audioReady;
      if (audio !== null) {
        await unlockAudio();
        unlockFeedback.afterUnlock();
      }
    },
    shouldIgnore: (event) => isAudioControlTarget(event.target),
  });
  installVisibilityHandling(audioEngine());

  // FR-6/FR-7/FR-12: the sound controls are part of the shell. If the markup
  // and the viewer disagree, keep the ranch alive (silent) instead of aborting
  // after the scene exists; only the audio block is skipped.
  const muteButton = document.getElementById(AUDIO_MUTE_ID);
  const parentButton = document.getElementById(AUDIO_PARENT_ID);
  const panel = document.getElementById(AUDIO_PANEL_ID);
  const panelMuteButton = document.getElementById(AUDIO_PANEL_MUTE_ID);
  const slider = document.getElementById(AUDIO_VOLUME_ID);
  const volumeValue = document.getElementById(AUDIO_VOLUME_VALUE_ID);
  const closeButton = document.getElementById(AUDIO_PANEL_CLOSE_ID);
  if (
    muteButton instanceof HTMLButtonElement &&
    parentButton instanceof HTMLButtonElement &&
    panel instanceof HTMLElement &&
    panelMuteButton instanceof HTMLButtonElement &&
    slider instanceof HTMLInputElement &&
    closeButton instanceof HTMLButtonElement
  ) {
    // Read both settings before the engine exists, so the first gesture already
    // knows whether to start music and at which volume (FR-2, FR-6, FR-7).
    const audioSettings = await loadAudioSettings();
    configureAudio({
      getMuted: () => audioSettings.muted,
      getVolume: () => audioSettings.volume,
    });
    audio = createAudioControls({
      muteButton,
      parentButton,
      panel,
      panelMuteButton,
      slider,
      closeButton,
      volumeValue: volumeValue instanceof HTMLElement ? volumeValue : null,
      initialMuted: audioSettings.muted,
      initialVolume: audioSettings.volume,
      // Mirrored twice: the mutable object feeds the engine providers, while the
      // engine calls apply the change to already-built Howls immediately.
      onMutedChange: (muted) => {
        audioSettings.muted = muted;
        audioEngine().setMuted(muted);
        void saveMuted(muted);
      },
      onVolumeChange: (volume) => {
        audioSettings.volume = volume;
        audioEngine().setVolume(volume);
        void saveVolume(volume);
      },
      onSfx: (assetId) => {
        playFeedback(assetId);
      },
      onUnlock: async () => {
        await unlockAudio();
        // FR-6: a mute control unlocked, so the greeting stays suppressed.
        unlockFeedback.afterUnlock({ viaMuteControl: true });
      },
    });
  } else {
    console.warn('Audio controls are missing from the shell; continuing without sound.');
    setStatus(status, 'Sound unavailable');
  }
  audioReadyControl.resolve();

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
  const dustTexture = createDustTexture();
  const sharedDust = new DustPool({ texture: dustTexture, random: streams?.dust ?? Math.random });
  scene.add(sharedDust.points);
  // FR-12: the arrival payoff is its own pool — one more draw call, the same
  // sprite — so a ripple can never recycle a footfall particle mid-stride.
  const arrivals = new ArrivalEffects({
    playSound: playFeedback,
    texture: dustTexture,
    random: streams?.dust ?? Math.random,
  });
  scene.add(arrivals.points);

  const stage: LoopStage = {
    players: [],
    trikePlayer: null,
    stegoPlayer: null,
    brachioPlayer: null,
    trikeModel: trike,
    stegoModel: stego,
    brachioModel: brachio,
  };
  // FR-4/FR-9: one director owns the three visits, fed each player as its GLB
  // lands so a slow fetch never holds up the other two timers. The jitter
  // stream is seeded from `?seed=`, so a seeded run replays the same schedule.
  // FR-12/FR-13: the director reports each arrival, and the payoff fires there.
  const visit = new VisitDirector({
    seed: options?.seed ?? null,
    onArrival: (species) => {
      arrivals.arrive(species);
    },
  });
  const hud = createHud({
    camera,
    button,
    status,
    audio,
    initialWalking: (await readSetting(WALK_SETTING_KEY)) === true,
    onWalkChange: (walking) => {
      setAllWalking(stage.players, walking);
      void writeSetting(WALK_SETTING_KEY, walking);
    },
  });

  // Swap one instant placeholder for its rigged GLB. Staggered-entry
  // headings (TRIO_SPAWN_HEADINGS_RADIANS) send the trio out on separated
  // legs early so avoidance visibly steers from the first seconds.
  const swapToRigged = (
    species: CornerSpecies,
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
    visit.register({
      species,
      actor: loaded.player,
      body: loaded.model,
      gait: VISIT_GAITS[species],
    });
  };

  // Swap the instant placeholders for the rigged GLBs once Draco decoding
  // finishes. A failed load keeps its placeholder walking (offline
  // first-visit safety) and surfaces the reason in the console; the other
  // dinos are unaffected.
  void loadTrikePlayer(sharedDust, streams?.movement.trike ?? Math.random, streams?.blink.trike)
    .then((loaded) => {
      swapToRigged('trike', trike, loaded, TRIO_SPAWN_HEADINGS_RADIANS[0], (player, model) => {
        stage.trikePlayer = player;
        stage.trikeModel = model;
      });
    })
    .catch((error: unknown) => {
      console.warn('Rigged trike unavailable; keeping the placeholder.', error);
    });

  void loadStegoPlayer(sharedDust, streams?.movement.stego ?? Math.random, streams?.blink.stego)
    .then((loaded) => {
      swapToRigged('stego', stego, loaded, TRIO_SPAWN_HEADINGS_RADIANS[1], (player, model) => {
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
      swapToRigged('brachio', brachio, loaded, TRIO_SPAWN_HEADINGS_RADIANS[2], (player, model) => {
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
  // FR-18: the handle is filled in when the load lands, so the loop can turn
  // the windpump's fan without waiting for it.
  // FR-11: the sway takes its phases from the same seed the harness fixes, so a
  // capture replays one ripple; a plain boot uses the default seed.
  const swaySeed = streams === null ? DEFAULT_SWAY_SEED : (options?.seed ?? DEFAULT_SWAY_SEED);
  const dressingFrame: DressingFrame = { dressing: null };
  void buildDressing(scene, { swaySeed })
    .then((built) => {
      dressingFrame.dressing = built;
    })
    .catch((error: unknown) => {
      console.warn('Ranch dressing unavailable; ground stays playable.', error);
    });

  // FR-12: a tap on any dressed prop earns one sparkle — decoration only, never
  // gameplay. The listener sits on the canvas, so chrome the HUD owns never
  // reaches it (review F8: no target check needed), and only the sleepy guard
  // stands between the tap and the raycast.
  // FR-8: the call cooldown is per corner, so two corners can be called back to
  // back and only a second tap on the same one is refused.
  const callCooldowns = new CallCooldowns();
  const tapPointer = new THREE.Vector2();
  canvas.addEventListener('pointerdown', (event: PointerEvent) => {
    const dressing = dressingFrame.dressing;
    if (dressing === null) {
      return;
    }
    const guards = { sleepy: hud.sleepy.shown || hud.sleepyState() === 'sleepy' };
    if (!allowsPropTap(guards)) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    tapPointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const hit = propUnderPointer(dressing.group, camera, tapPointer);
    if (hit === null) {
      return;
    }
    const at = performance.now();
    if (!dressing.sparkles.allows(hit.prop, at)) {
      return;
    }
    const burst = (): void => {
      dressing.sparkles.react(hit.prop, hit.point, at);
      audioEngine().play('sparkle');
    };
    // AC-9 edge: the first tap unlocks the engine and *then* sparkles, in that
    // order, so the chime is not lost to a still-silent context. The promise is
    // held rather than unlocked bare, so boot still never touches audio.
    if (isAudioUnlocked()) {
      burst();
    } else {
      const unlocking = unlockAudio();
      void unlocking.then(burst, burst);
    }
    // FR-8: a tap on any prop of a corner calls that corner's animal — the hay
    // bale and the berry bush both call the Trike. The sparkle above is already
    // in this frame; nothing is awaited before it, and the journey starts from
    // here rather than replacing it. A refused call still sparkled: only the
    // journey is skipped.
    const corner = cornerUnderProp(hit.prop);
    if (corner !== null && callCooldowns.allows(corner, at)) {
      callCooldowns.record(corner, at);
      visit.startVisit(corner);
    }
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
          // FR-10: state comes from the engine and the kid-facing controls;
          // mute and volume go through `hud.audio` so label, aria-pressed and
          // persistence move exactly as a real tap would.
          getAudioState: () => {
            const engine = audioEngine();
            return {
              unlocked: engine.unlocked,
              muted: audio?.isMuted() ?? engine.muted,
              volume: audio?.volume() ?? engine.volume,
              musicPlaying: engine.musicPlaying,
              activeLine: engine.activeVoiceId,
              lastStartLatencyMs: engine.lastStartLatencyMs,
            };
          },
          mute: (muted: boolean) => {
            audio?.setMuted(muted);
          },
          setVolume: (volume: number) => {
            audio?.setVolume(volume);
          },
          play: (id) => {
            audioEngine().play(id);
          },
          stopAll: () => {
            audioEngine().stopAll();
          },
          // FR-14: the tap's own path — same cooldown map, same director entry
          // point, nothing overridden. A harness call therefore cannot put an
          // animal in a state the child's tap could not reach, and a refused
          // call answers false instead of lying.
          callVisit: (species: CornerSpecies) => {
            const at = performance.now();
            if (!callCooldowns.allows(species, at)) {
              return false;
            }
            callCooldowns.record(species, at);
            return visit.startVisit(species);
          },
          // FR-14: registered animals only, straight from the director.
          getVisitState: () => visit.getSnapshots(),
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
    sky,
    dressing: dressingFrame,
    visit,
    arrivals,
  });
}

bootViewer().catch((error: unknown) => {
  // Boot failures must surface instead of failing silently.
  console.error('Viewer failed to boot:', error);
});
