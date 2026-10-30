import type { PerspectiveCamera } from 'three';
import type { AudioAssetId } from '../audio/catalog.js';
import { createCooGate, sfxForSurface, type SpeciesId } from '../audio/feedback.js';
import { IDLE_AFTER_MS, SleepyController, type SleepyState } from '../ranch/sleepy.js';
import { playFeedback as dispatchFeedback } from './audio.js';
import type { AudioControls } from './audio-controls.js';
import {
  BOOT_POV_ID,
  HINT_IDLE_MS,
  applyPovPreset,
  hintModeFor,
  isPortraitViewport,
  isPovPresetId,
  shouldShowHint,
  type PovPresetId,
} from './pov.js';
import { ensureSleepyOverlay, hintSuppressedBySleepy, setSleepyVisible } from './sleepy-ui.js';

/** DOM ids the viewer boots against (index.html owns the markup). */
export const CANVAS_ID = 'scene';
export const WALK_BUTTON_ID = 'walk-button';
export const STATUS_ID = 'status';

/** Setting key that remembers the Walk toggle across reloads. */
export const WALK_SETTING_KEY = 'walking';

/** Set the status pill text when the element exists. */
export function setStatus(status: HTMLElement | null, text: string): void {
  if (status) {
    status.textContent = text;
  }
}

/** Status pill copy: names all three species while walking (NFR-4 icon + word). */
export function walkStatusText(walking: boolean): string {
  return walking ? '🦕 Trike + 🦖 Stego + 🦒 Brachio walking' : 'Tap Walk to waddle';
}

/** Narrow a `data-species` attribute to one of the three catalog species. */
function isSpeciesId(value: string | undefined): value is SpeciesId {
  return value === 'trike' || value === 'stego' || value === 'brachio';
}

/**
 * Sleepy cues the animation loop reads: the idle state machine, the ZZZ
 * overlay, and the media query that turns the cues static. The loop never
 * owns a timer — it asks this stage what to show each frame.
 */
export interface SleepyStage {
  readonly controller: SleepyController;
  readonly reducedMotionQuery: MediaQueryList;
  /** Whether the ZZZ overlay is currently shown. */
  readonly shown: boolean;
  /** Show or hide the ZZZ overlay, honouring the reduced-motion preference. */
  setShown(shown: boolean): void;
}

/** Handles boot keeps after the DOM chrome is wired. */
export interface Hud {
  /** Bottom-right mute button and parent volume panel; null if the shell lacks it. */
  readonly audio: AudioControls | null;
  /** Sleepy cues plus the hint-glow timer the render loop reads. */
  readonly sleepy: SleepyStage;
  /** Whether the Walk toggle is on. */
  isWalking(): boolean;
  /** Flip the Walk toggle through the same path the button takes. */
  setWalking(walking: boolean): void;
  /** The active POV preset id. */
  pov(): PovPresetId;
  /** Cut the camera to a preset through the same path the pills take. */
  setPov(id: PovPresetId): void;
  /** Push the sleepy controller past its idle threshold (dev harness only). */
  forceSleepy(): void;
  /** Pretend the last interaction was long ago, so the hint glow appears. */
  forceHint(): void;
  /** The sleepy state the last frame computed. */
  sleepyState(): SleepyState;
  /** Show the rotate hint while the viewport is portrait (FR-6). */
  syncRotateHint(): void;
}

/** Everything the DOM chrome wires itself to at boot. */
export interface HudOptions {
  camera: PerspectiveCamera;
  button: HTMLButtonElement;
  status: HTMLElement | null;
  /** Already-wired sound controls; null when the shell omitted them. */
  audio: AudioControls | null;
  /** Saved Walk state restored from storage (FR-7). */
  initialWalking: boolean;
  /** Apply a new Walk state to the players and storage. */
  onWalkChange(walking: boolean): void;
}

/**
 * Wire the whole DOM chrome: status pill, Walk button state, POV nav, hint
 * glow, sleepy overlay, rotate hint and the tablet zoom guards. Element ids,
 * class names and `aria-pressed` toggles stay exactly as index.html declares
 * them (NFR-2).
 */
export function createHud(options: HudOptions): Hud {
  const { camera, button, status, audio, initialWalking, onWalkChange } = options;
  let walking = initialWalking;
  const syncWalkChrome = (): void => {
    button.textContent = walking ? 'Stop' : 'Walk';
    button.setAttribute('aria-pressed', walking ? 'true' : 'false');
    setStatus(status, walkStatusText(walking));
  };

  // FR-5: hint glow after 5 s of no interaction; any press clears it.
  // FR-4: the same press wakes the sleepy controller and hides the ZZZ.
  let lastInteractionMs = performance.now();
  const controller = new SleepyController(lastInteractionMs);
  const overlay = ensureSleepyOverlay(document);
  let sleepyShown = false;
  const markInteraction = (): void => {
    lastInteractionMs = performance.now();
    document.body.classList.remove('hint-glow', 'hint-static');
    controller.markInteraction(lastInteractionMs);
    if (sleepyShown) {
      setSleepyVisible(overlay, false, false);
      sleepyShown = false;
    }
  };
  window.addEventListener('pointerdown', markInteraction, { passive: true });
  const setWalking = (next: boolean): void => {
    walking = next;
    onWalkChange(walking);
    markInteraction();
    syncWalkChrome();
  };
  /**
   * Local dispatch guard (FR-9): a locked, muted, failed or disposed engine is
   * silence, never an error thrown into a child's tap.
   */
  const playFeedback = (assetId: AudioAssetId): void => {
    try {
      dispatchFeedback(assetId);
    } catch {
      // FR-9: nothing to surface, nothing to retry.
    }
  };
  button.addEventListener('click', () => {
    // FR-1: sound the press even when it is the one that stops the walk.
    playFeedback(sfxForSurface('walk'));
    setWalking(!walking);
  });
  syncWalkChrome();

  // FR-1: fixed POV buttons cut the camera instantly (no tween, AC-1).
  // Ranch is the boot view; the preset owns the numbers.
  let activePov: PovPresetId = BOOT_POV_ID;
  applyPovPreset(camera, activePov);
  const povButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#pov [data-pov]'));
  const syncPov = (): void => {
    for (const povButton of povButtons) {
      povButton.setAttribute(
        'aria-pressed',
        povButton.dataset['pov'] === activePov ? 'true' : 'false',
      );
    }
  };
  const setPov = (id: PovPresetId): void => {
    activePov = id;
    applyPovPreset(camera, activePov);
    markInteraction();
    syncPov();
  };
  for (const povButton of povButtons) {
    povButton.addEventListener('click', () => {
      // FR-9: every lookup goes through the preset table, so adding a fourth
      // button is a data change rather than another id in a hardcoded list.
      const id = povButton.dataset['pov'];
      if (!isPovPresetId(id)) {
        return;
      }
      // FR-2: re-pressing the active view still answers with a tap.
      playFeedback(sfxForSurface('pov'));
      setPov(id);
    });
  }
  syncPov();

  // FR-4, FR-5: each baby coos through the one gate, so a mash is one sound.
  const cooGate = createCooGate();
  const speciesButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('#species button[data-species]'),
  );
  for (const speciesButton of speciesButtons) {
    speciesButton.addEventListener('click', () => {
      const species = speciesButton.dataset['species'];
      if (!isSpeciesId(species)) {
        return;
      }
      const assetId = cooGate.tryCoo(species, performance.now());
      if (assetId === null) {
        // FR-5: a refused press is swallowed, never queued or retried.
        return;
      }
      playFeedback(assetId);
    });
  }

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  window.setInterval(() => {
    if (!shouldShowHint(lastInteractionMs, performance.now(), HINT_IDLE_MS)) {
      return;
    }
    // FR-5 precedence: sleepy owns the stage once drowsy, so the interval
    // never re-adds the hint class the animation loop strips each frame.
    if (hintSuppressedBySleepy(controller.update(performance.now()))) {
      return;
    }
    document.body.classList.add(hintModeFor(reducedMotionQuery.matches));
  }, 1000);

  // FR-6: no pinch/double-tap zoom on the tablet stage.
  document.addEventListener('gesturestart', (event: Event) => {
    event.preventDefault();
  });
  document.addEventListener(
    'dblclick',
    (event: Event) => {
      event.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener(
    'touchmove',
    (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false },
  );

  // FR-6: portrait shows the rotate hint.
  const rotateHint = document.getElementById('rotate-hint');
  const syncRotateHint = (): void => {
    if (rotateHint) {
      rotateHint.hidden = !isPortraitViewport(window.innerWidth, window.innerHeight);
    }
  };
  syncRotateHint();

  const sleepy: SleepyStage = {
    controller,
    reducedMotionQuery,
    get shown(): boolean {
      return sleepyShown;
    },
    setShown(shown: boolean): void {
      setSleepyVisible(overlay, shown, reducedMotionQuery.matches);
      sleepyShown = shown;
    },
  };

  return {
    audio,
    sleepy,
    isWalking: (): boolean => walking,
    setWalking,
    pov: (): PovPresetId => activePov,
    setPov,
    forceSleepy: (): void => {
      controller.markInteraction(performance.now() - IDLE_AFTER_MS - 1);
    },
    forceHint: (): void => {
      lastInteractionMs = performance.now() - HINT_IDLE_MS - 1;
      document.body.classList.add(hintModeFor(reducedMotionQuery.matches));
    },
    sleepyState: (): SleepyState => controller.state,
    syncRotateHint,
  };
}
