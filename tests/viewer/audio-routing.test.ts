import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GREETING_DELAY_MS } from '../../src/audio/feedback.js';
import {
  audioEngine,
  createUnlockFeedback,
  disposeAudio,
  flushFeedback,
  playFeedback,
  type GreetingClock,
} from '../../src/viewer/audio.js';

/**
 * Bus routing through the viewer facade (FR-5, FR-6, FR-7). The engine is a
 * fake with separate `playSfx` / `playVoice` spies, but the catalog is real, so
 * `deliver` resolves the same bus the engine's `readyHowl` guard checks: a voice
 * line sent to `playSfx` is silence, never a greeting. This is the regression
 * the stubbed-engine tests could not see.
 */

const { engineState, playSfx, playVoice } = vi.hoisted(() => ({
  engineState: { unlocked: false, muted: false },
  playSfx: vi.fn<(id: string) => void>(),
  playVoice: vi.fn<(id: string) => void>(),
}));

vi.mock('../../src/audio/engine.js', () => {
  class FakeAudioEngine {
    get unlocked(): boolean {
      return engineState.unlocked;
    }

    get muted(): boolean {
      return engineState.muted;
    }

    configure(): void {}

    unlock(): Promise<void> {
      engineState.unlocked = true;
      return Promise.resolve();
    }

    playSfx(id: string): void {
      playSfx(id);
    }

    playVoice(id: string): void {
      playVoice(id);
    }

    dispose(): void {}
  }

  return { AudioEngine: FakeAudioEngine, MUSIC_FADE_IN_MS: 400 };
});

/** Manual timer queue: nothing fires until a test advances the clock. */
class ManualGreetingClock implements GreetingClock {
  current = 0;
  private nextId = 1;
  private readonly timers = new Map<number, { at: number; callback: () => void }>();

  now(): number {
    return this.current;
  }

  setTimer(callback: () => void, delayMs: number): number {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { at: this.current + delayMs, callback });
    return id;
  }

  clearTimer(handle: number): void {
    this.timers.delete(handle);
  }

  /** Advance to `ms` and fire every timer that is now due. */
  advanceTo(ms: number): void {
    this.current = ms;
    for (const [id, timer] of this.timers) {
      if (timer.at > this.current) {
        continue;
      }
      this.timers.delete(id);
      timer.callback();
    }
  }
}

beforeEach(() => {
  engineState.unlocked = false;
  engineState.muted = false;
  playSfx.mockReset();
  playVoice.mockReset();
  disposeAudio();
});

afterEach(() => {
  disposeAudio();
});

describe('feedback routes by catalog bus (FR-5, FR-6)', () => {
  it('sends the voice greeting to playVoice and never playSfx', () => {
    audioEngine();
    engineState.unlocked = true;

    playFeedback('hello');

    expect(playVoice.mock.calls).toEqual([['hello']]);
    expect(playSfx).not.toHaveBeenCalled();
  });

  it('sends one-shot sfx to playSfx and never playVoice', () => {
    audioEngine();
    engineState.unlocked = true;

    playFeedback('tap');
    playFeedback('coo-trike');

    expect(playSfx.mock.calls).toEqual([['tap'], ['coo-trike']]);
    expect(playVoice).not.toHaveBeenCalled();
  });

  it('routes a held press the same way once the engine unlocks', () => {
    audioEngine();
    playFeedback('hello');

    expect(playVoice).not.toHaveBeenCalled();

    engineState.unlocked = true;
    flushFeedback();

    expect(playVoice.mock.calls).toEqual([['hello']]);
    expect(playSfx).not.toHaveBeenCalled();
  });

  it('keeps the music loop off both one-shot buses', () => {
    audioEngine();
    engineState.unlocked = true;

    playFeedback('music-kalimba');

    expect(playSfx).not.toHaveBeenCalled();
    expect(playVoice).not.toHaveBeenCalled();
  });
});

describe('greeting under a relocked engine (FR-6, FR-7)', () => {
  it('greets through playVoice when the engine stays unlocked', () => {
    audioEngine();
    const clock = new ManualGreetingClock();
    const feedback = createUnlockFeedback({ clock });
    engineState.unlocked = true;

    feedback.afterUnlock();
    clock.advanceTo(GREETING_DELAY_MS);

    expect(playVoice.mock.calls).toEqual([['hello']]);
    expect(playSfx).not.toHaveBeenCalled();
    feedback.dispose();
  });

  it('drops the greeting at fire time instead of parking it for the next press', () => {
    audioEngine();
    const clock = new ManualGreetingClock();
    const feedback = createUnlockFeedback({ clock });
    engineState.unlocked = true;

    feedback.afterUnlock();
    engineState.unlocked = false;
    clock.advanceTo(GREETING_DELAY_MS);

    expect(playVoice).not.toHaveBeenCalled();
    expect(playSfx).not.toHaveBeenCalled();

    // Nothing was held either: a later tap must not surface the greeting.
    engineState.unlocked = true;
    flushFeedback();
    expect(playVoice).not.toHaveBeenCalled();
    expect(playSfx).not.toHaveBeenCalled();
    feedback.dispose();
  });
});
