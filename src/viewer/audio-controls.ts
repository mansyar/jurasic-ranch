/**
 * Bottom-right sound controls and the parent volume panel (FR-6, FR-7, FR-8,
 * NFR-4). Every element is injected, so the pointer, keyboard, and focus logic
 * runs in node without jsdom; `index.html` owns the markup, the 72 px targets,
 * and the placement CSS. Persistence lives in `audio/settings.ts` and is wired
 * by the caller, so this module only owns the in-memory UI state.
 */

import type { AudioAssetId } from '../audio/catalog.js';
import { HOLD_DURATION_MS, HoldGate } from '../audio/gate.js';
import { clampVolume } from '../audio/mix.js';

/** Element ids the viewer boots against (index.html owns the markup). */
export const AUDIO_CONTROLS_ID = 'audio-controls';
export const AUDIO_MUTE_ID = 'audio-mute';
export const AUDIO_PARENT_ID = 'audio-parent';
export const AUDIO_PANEL_ID = 'audio-panel';
export const AUDIO_PANEL_TITLE_ID = 'audio-panel-title';
export const AUDIO_PANEL_MUTE_ID = 'audio-panel-mute';
export const AUDIO_VOLUME_ID = 'audio-volume';
export const AUDIO_VOLUME_VALUE_ID = 'audio-volume-value';
export const AUDIO_PANEL_CLOSE_ID = 'audio-panel-close';

/** Icon + word labels: colour and sound alone never carry the state (NFR-4). */
export const SOUND_LABEL = '🔊 Sound';
export const MUTED_LABEL = '🔇 Muted';
export const VOLUME_LABEL = '⚙️ Volume';

/** The selector the first-gesture unlock ignores (FR-2 / AC-6 edge). */
const AUDIO_CONTROL_SELECTOR = `#${AUDIO_CONTROLS_ID}, #${AUDIO_PANEL_ID}`;

/** The subset of a DOM event the controls read; node tests pass plain objects. */
export interface AudioControlEvent {
  readonly key?: string;
  readonly repeat?: boolean;
  readonly target?: unknown;
  preventDefault?(): void;
}

/** A listener target: elements and `window` both satisfy this. */
export interface AudioListenerTarget {
  addEventListener(
    type: string,
    listener: (event: AudioControlEvent) => void,
    options?: { passive: boolean },
  ): void;
  removeEventListener(type: string, listener: (event: AudioControlEvent) => void): void;
}

/** The subset of an element the controls touch; real elements satisfy it. */
export interface AudioControlElement extends AudioListenerTarget {
  textContent: string | null;
  readonly style?: { setProperty(name: string, value: string): void };
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  focus(): void;
}

/** A panel can also be hidden; `hidden` mirrors the DOM's boolean|string. */
export interface AudioPanelElement extends AudioControlElement {
  hidden: boolean | string;
}

/** A range input exposes its value as a string. */
export interface AudioSliderElement extends AudioControlElement {
  value: string;
}

/** Frame clock for the visible hold ring; tests inject a manual one. */
export interface HoldTicker {
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(id: number): void;
}

/** Everything `createAudioControls` wires itself to. */
export interface AudioControlsOptions {
  muteButton: AudioControlElement;
  parentButton: AudioControlElement;
  panel: AudioPanelElement;
  panelMuteButton: AudioControlElement;
  slider: AudioSliderElement;
  closeButton: AudioControlElement;
  /** Optional `%` readout beside the slider. */
  volumeValue?: AudioControlElement | null;
  initialMuted: boolean;
  initialVolume: number;
  /** Apply a new mute state (engine + persistence). */
  onMutedChange(muted: boolean): void;
  /** Apply a new clamped master volume (engine + persistence). */
  onVolumeChange(volume: number): void;
  /** Kid-facing feedback for a press; the mute boundary depends on call order. */
  onSfx?(assetId: AudioAssetId): void;
  /** Fire-and-forget unlock; the first mute tap must stay silent (FR-2). */
  onUnlock(): void | Promise<void>;
  ticker?: HoldTicker;
  /** Window for the blur cancel; defaults to the real window when present. */
  windowTarget?: AudioListenerTarget | null;
  holdDurationMs?: number;
}

/** The controls' public surface for the HUD and the dev bridge. */
export interface AudioControls {
  isMuted(): boolean;
  volume(): number;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  isPanelOpen(): boolean;
  openPanel(): void;
  closePanel(): void;
  dispose(): void;
}

/** `80%` readout for a clamped master volume. */
export function formatVolumePercent(volume: number): string {
  return `${Math.round(clampVolume(volume) * 100)}%`;
}

/** Default frame clock: a plain rAF loop, no timer of its own (NFR-5). */
function defaultTicker(): HoldTicker {
  return {
    now: (): number => performance.now(),
    requestFrame: (callback: () => void): number => requestAnimationFrame(callback),
    cancelFrame: (id: number): void => cancelAnimationFrame(id),
  };
}

/**
 * Whether a gesture landed inside the sound controls. The first-gesture unlock
 * uses this so muting or opening the parent panel cannot start music behind the
 * child's back, while the next gesture elsewhere still unlocks.
 */
export function isAudioControlTarget(target: unknown): boolean {
  if (typeof target !== 'object' || target === null || !('closest' in target)) {
    return false;
  }
  const closest: unknown = target.closest;
  if (typeof closest !== 'function') {
    return false;
  }
  try {
    return Reflect.apply(closest, target, [AUDIO_CONTROL_SELECTOR]) !== null;
  } catch {
    return false;
  }
}

/** Wire the mute button, the parent gear, and the parent volume panel. */
export function createAudioControls(options: AudioControlsOptions): AudioControls {
  const {
    muteButton,
    parentButton,
    panel,
    panelMuteButton,
    slider,
    closeButton,
    volumeValue = null,
    onMutedChange,
    onVolumeChange,
    onUnlock,
    onSfx,
  } = options;
  const ticker = options.ticker ?? defaultTicker();
  const windowTarget =
    options.windowTarget === undefined
      ? typeof window === 'undefined'
        ? null
        : window
      : options.windowTarget;
  const gate = new HoldGate(options.holdDurationMs ?? HOLD_DURATION_MS);

  let muted = options.initialMuted;
  let volume = clampVolume(options.initialVolume);
  let panelOpen = false;
  let frameId: number | null = null;
  const cleanups: Array<() => void> = [];

  const on = (
    element: AudioListenerTarget,
    type: string,
    handler: (event: AudioControlEvent) => void,
    listenerOptions?: { passive: boolean },
  ): void => {
    element.addEventListener(type, handler, listenerOptions);
    cleanups.push(() => {
      element.removeEventListener(type, handler);
    });
  };

  const syncMute = (): void => {
    const label = muted ? MUTED_LABEL : SOUND_LABEL;
    const pressed = muted ? 'true' : 'false';
    muteButton.textContent = label;
    muteButton.setAttribute('aria-pressed', pressed);
    panelMuteButton.textContent = label;
    panelMuteButton.setAttribute('aria-pressed', pressed);
  };

  const syncVolume = (): void => {
    const percent = formatVolumePercent(volume);
    slider.value = String(Math.round(clampVolume(volume) * 100));
    slider.setAttribute('aria-valuetext', percent);
    if (volumeValue !== null) {
      volumeValue.textContent = percent;
    }
  };

  const setMuted = (next: boolean): void => {
    if (muted === next) {
      syncMute();
      return;
    }
    muted = next;
    syncMute();
    onMutedChange(muted);
  };

  const setVolume = (next: number): void => {
    volume = clampVolume(next);
    syncVolume();
    onVolumeChange(volume);
  };

  const unlock = (): void => {
    try {
      void Promise.resolve(onUnlock()).catch(() => {
        /* Audio is a nicety: a failed unlock stays silent (FR-9). */
      });
    } catch {
      /* A synchronous throw is the same silence. */
    }
  };

  const setRing = (progress: number): void => {
    parentButton.style?.setProperty('--hold-progress', String(progress));
  };

  const cancelFrame = (): void => {
    if (frameId !== null) {
      ticker.cancelFrame(frameId);
      frameId = null;
    }
  };

  const syncPanel = (): void => {
    panel.hidden = !panelOpen;
    parentButton.setAttribute('aria-expanded', panelOpen ? 'true' : 'false');
  };

  const stopHold = (): void => {
    gate.cancel();
    cancelFrame();
    setRing(0);
  };

  const closePanel = (): void => {
    if (!panelOpen) {
      return;
    }
    panelOpen = false;
    syncPanel();
    parentButton.focus();
  };

  const openPanel = (): void => {
    stopHold();
    if (panelOpen) {
      closeButton.focus();
      return;
    }
    panelOpen = true;
    syncPanel();
    closeButton.focus();
  };

  const stepHold = (): void => {
    frameId = null;
    if (gate.tick(ticker.now())) {
      openPanel();
      return;
    }
    setRing(gate.progress);
    frameId = ticker.requestFrame(stepHold);
  };

  const startHold = (): void => {
    if (gate.active) {
      return;
    }
    gate.start(ticker.now());
    setRing(0);
    cancelFrame();
    frameId = ticker.requestFrame(stepHold);
  };

  // FR-3: the tap lands on the audible side of the boundary - before muting
  // silences it, after unmuting lifts the silence - then unlock has its go.
  const toggleMute = (): void => {
    if (muted) {
      setMuted(false);
      unlock();
      onSfx?.('tap');
      return;
    }
    onSfx?.('tap');
    setMuted(true);
    unlock();
  };

  // FR-6: one tap mutes everything; the label, icon, and aria-pressed all move.
  on(muteButton, 'click', () => {
    toggleMute();
  });
  on(panelMuteButton, 'click', () => {
    toggleMute();
  });

  // FR-8: hold the gear for 2 s; any early release, cancel, or blur resets it.
  on(parentButton, 'pointerdown', () => {
    startHold();
  });
  on(parentButton, 'pointerup', () => {
    stopHold();
  });
  on(parentButton, 'pointerleave', () => {
    stopHold();
  });
  on(parentButton, 'pointercancel', () => {
    stopHold();
  });
  on(parentButton, 'keydown', (event) => {
    if (event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'Enter') {
      return;
    }
    if (event.repeat === true) {
      return;
    }
    event.preventDefault?.();
    startHold();
  });
  on(parentButton, 'keyup', (event) => {
    if (event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'Enter') {
      return;
    }
    stopHold();
  });
  if (windowTarget !== null) {
    on(windowTarget, 'blur', () => {
      stopHold();
    });
  }

  // FR-7: the slider applies live and clamps on the way into the engine.
  on(slider, 'input', () => {
    const percent = Number(slider.value);
    if (Number.isNaN(percent)) {
      return;
    }
    setVolume(clampVolume(percent / 100));
  });

  on(closeButton, 'click', () => {
    closePanel();
  });
  // AC-8: Escape works from anywhere while the panel is open, including after
  // focus leaves the panel; the panel is non-modal (no aria-modal claim).
  on(windowTarget ?? panel, 'keydown', (event) => {
    if (event.key !== 'Escape' || !panelOpen) {
      return;
    }
    event.preventDefault?.();
    closePanel();
  });

  syncMute();
  syncVolume();
  syncPanel();

  return {
    isMuted: (): boolean => muted,
    volume: (): number => volume,
    setMuted,
    setVolume,
    isPanelOpen: (): boolean => panelOpen,
    openPanel,
    closePanel,
    dispose: (): void => {
      stopHold();
      while (cleanups.length > 0) {
        cleanups.pop()?.();
      }
    },
  };
}
