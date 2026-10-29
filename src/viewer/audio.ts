/**
 * Thin viewer facade over the shared engine (FR-2, FR-3). Importing this module
 * creates no engine and touches no audio library: the singleton is built on the
 * first gesture, so boot stays silent until a pointerdown or keydown.
 */

import { getAudioAsset, type AudioAssetId } from '../audio/catalog.js';
import {
  createFirstPressSlot,
  GREETING_ASSET_ID,
  GREETING_DELAY_MS,
  shouldGreet,
} from '../audio/feedback.js';
import { AudioEngine, type AudioEngineOptions } from '../audio/engine.js';

let engine: AudioEngine | null = null;
let engineOptions: AudioEngineOptions = {};

/**
 * Configure the lazily built engine with the persisted mute/volume providers
 * (FR-6, FR-7). Call it before the first gesture builds the singleton.
 */
export function configureAudio(options: AudioEngineOptions): void {
  engineOptions = options;
  engine?.configure(options);
}

/** The lazily built engine shared by unlock, visibility, and the dev bridge. */
export function audioEngine(): AudioEngine {
  engine ??= new AudioEngine(engineOptions);
  return engine;
}

/** Whether the first gesture finished unlocking audio. */
export function isAudioUnlocked(): boolean {
  return engine !== null && engine.unlocked;
}

/** Unlock audio on the first gesture; resolves once ready or safely silent. */
export async function unlockAudio(): Promise<void> {
  await audioEngine().unlock();
}

/** The one press allowed to wait for the unlocking gesture (FR-7). */
const firstPress = createFirstPressSlot<AudioAssetId>();

/** Deliver one asset; a locked, muted, failed or disposed engine is silence. */
function deliver(id: AudioAssetId): void {
  try {
    // The catalog bus picks the call, never the caller: `voice` gets the duck
    // and `activeLine` tracking, `sfx` the overlap cap. A wrong-bus call is
    // dropped by `readyHowl`, so 'hello' on `playSfx` would be silence.
    const asset = getAudioAsset(id);
    if (asset === undefined) {
      return;
    }
    if (asset.bus === 'voice') {
      audioEngine().playVoice(asset.id);
      return;
    }
    if (asset.bus === 'sfx') {
      audioEngine().playSfx(asset.id);
    }
  } catch {
    // FR-9: a child's tap never throws and is never retried.
  }
}

/**
 * Play a kid-facing feedback id now, or hold it if audio is still locked
 * (FR-7). The slot replaces, so a mash keeps at most one press.
 */
export function playFeedback(id: AudioAssetId): void {
  if (!isAudioUnlocked()) {
    firstPress.hold(id);
    return;
  }
  deliver(id);
}

/**
 * Play the press held during the unlocking gesture, once. A still-locked
 * engine drops it silently instead of growing a queue.
 */
export function flushFeedback(): void {
  const held = firstPress.flush();
  if (held !== null && isAudioUnlocked()) {
    deliver(held);
  }
}

/** Clock and timer source for the greeting; tests inject a manual one. */
export interface GreetingClock {
  now(): number;
  setTimer(callback: () => void, delayMs: number): number;
  clearTimer(handle: number): void;
}

const defaultGreetingClock: GreetingClock = {
  now: (): number => performance.now(),
  setTimer: (callback: () => void, delayMs: number): number => window.setTimeout(callback, delayMs),
  clearTimer: (handle: number): void => {
    window.clearTimeout(handle);
  },
};

/** Injectable greeting timer, mirroring the hold ticker in `audio-controls`. */
export interface UnlockFeedbackOptions {
  clock?: GreetingClock;
}

/** Session-wide aftermath of the unlock: the held press and the greeting. */
export interface UnlockFeedback {
  /** Call after `unlockAudio()` resolves; repeated calls add no timer. */
  afterUnlock(): void;
  /** Drop the pending greeting; never called at boot. */
  dispose(): void;
}

/**
 * The once-per-session greeting (FR-6). The first resolved unlock flushes the
 * queued press and starts the only greeting timer; at fire time the pure
 * policy decides, so a muted or mute-first session stays silent forever.
 */
export function createUnlockFeedback(options?: UnlockFeedbackOptions): UnlockFeedback {
  const clock = options?.clock ?? defaultGreetingClock;
  let scheduled = false;
  let greeted = false;
  let firstGestureWasMute = false;
  let unlockedAtMs = 0;
  let timer: number | null = null;

  return {
    afterUnlock(): void {
      flushFeedback();
      if (scheduled) {
        return;
      }
      scheduled = true;
      firstGestureWasMute = audioEngine().muted;
      unlockedAtMs = clock.now();
      timer = clock.setTimer(() => {
        timer = null;
        const mayGreet = shouldGreet({
          muted: audioEngine().muted,
          firstGestureWasMute,
          alreadyGreeted: greeted,
          sinceUnlockMs: clock.now() - unlockedAtMs,
        });
        if (!mayGreet) {
          return;
        }
        // A locked engine would park the greeting in the first-press slot,
        // where it would surface on a later tap: drop it instead.
        if (!isAudioUnlocked()) {
          return;
        }
        greeted = true;
        playFeedback(GREETING_ASSET_ID);
      }, GREETING_DELAY_MS);
    },
    dispose(): void {
      if (timer !== null) {
        clock.clearTimer(timer);
        timer = null;
      }
      scheduled = false;
      greeted = false;
      firstGestureWasMute = false;
    },
  };
}

/** Drop the singleton and its Howls; a test-only reset, never called at boot. */
export function disposeAudio(): void {
  engine?.dispose();
  engine = null;
  firstPress.clear();
}
