import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GREETING_DELAY_MS } from '../../src/audio/feedback.js';
import {
  audioEngine,
  createUnlockFeedback,
  disposeAudio,
  flushFeedback,
  isAudioUnlocked,
  playFeedback,
  type GreetingClock,
  type UnlockFeedback,
} from '../../src/viewer/audio.js';

/**
 * Facade first-press queue and greeting wiring (FR-6, FR-7, FR-9, AC-5, AC-6,
 * AC-8). The engine class is stubbed, so the assertions land on the facade's
 * `playSfx` seam without Howler; the greeting timer is a manual clock, the same
 * way `audio-controls.test.ts` drives the hold ticker. The real greeting policy
 * is unit-tested in `tests/audio/feedback.test.ts`; here only the wiring.
 */

const { engineState } = vi.hoisted(() => ({
  engineState: {
    unlocked: false,
    muted: false,
    fail: false,
    played: [] as string[],
  },
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
      if (engineState.fail) {
        throw new Error('engine down');
      }
      engineState.played.push(id);
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

  /** How many greeting timers are still waiting. */
  pending(): number {
    return this.timers.size;
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

interface GreetingHarness {
  clock: ManualGreetingClock;
  feedback: UnlockFeedback;
}

function createGreetingHarness(): GreetingHarness {
  const clock = new ManualGreetingClock();
  return { clock, feedback: createUnlockFeedback({ clock }) };
}

beforeEach(() => {
  engineState.unlocked = false;
  engineState.muted = false;
  engineState.fail = false;
  engineState.played.length = 0;
  disposeAudio();
});

afterEach(() => {
  disposeAudio();
});

describe('first-press queue (AC-6, FR-7)', () => {
  it('holds a locked press and flushes it exactly once after unlock', () => {
    audioEngine();
    playFeedback('tap');
    expect(engineState.played).toEqual([]);

    engineState.unlocked = true;
    expect(isAudioUnlocked()).toBe(true);
    flushFeedback();
    expect(engineState.played).toEqual(['tap']);

    flushFeedback();
    expect(engineState.played).toEqual(['tap']);
  });

  it('replaces the held press instead of growing a queue', () => {
    audioEngine();
    playFeedback('tap');
    playFeedback('coo-trike');

    engineState.unlocked = true;
    flushFeedback();

    expect(engineState.played).toEqual(['coo-trike']);
  });

  it('drops the held press when the engine is still locked at flush', () => {
    audioEngine();
    playFeedback('tap');

    flushFeedback();
    engineState.unlocked = true;
    flushFeedback();

    expect(engineState.played).toEqual([]);
  });

  it('delivers immediately once the engine is unlocked', () => {
    audioEngine();
    engineState.unlocked = true;

    playFeedback('tap');

    expect(engineState.played).toEqual(['tap']);
  });
});

describe('failure path (AC-8, FR-9)', () => {
  it('throws nothing and delivers nothing when the engine fails', () => {
    audioEngine();
    engineState.fail = true;

    expect(() => {
      playFeedback('tap');
    }).not.toThrow();

    engineState.unlocked = true;
    expect(() => {
      flushFeedback();
    }).not.toThrow();
    expect(() => {
      playFeedback('tap');
    }).not.toThrow();

    expect(engineState.played).toEqual([]);
  });
});

describe('greeting wiring (AC-5, FR-6)', () => {
  it('flushes the held press, then greets once after the fade', () => {
    audioEngine();
    playFeedback('tap');
    const { clock, feedback } = createGreetingHarness();

    engineState.unlocked = true;
    feedback.afterUnlock();
    expect(engineState.played).toEqual(['tap']);
    expect(clock.pending()).toBe(1);

    clock.advanceTo(GREETING_DELAY_MS - 1);
    expect(engineState.played).toEqual(['tap']);

    clock.advanceTo(GREETING_DELAY_MS);
    expect(engineState.played).toEqual(['tap', 'hello']);

    // A second unlock and later frames never greet again.
    feedback.afterUnlock();
    clock.advanceTo(GREETING_DELAY_MS * 2);
    expect(engineState.played).toEqual(['tap', 'hello']);
    expect(clock.pending()).toBe(0);
  });

  it('keeps exactly one timer when unlock resolves twice', () => {
    audioEngine();
    const { clock, feedback } = createGreetingHarness();
    engineState.unlocked = true;

    feedback.afterUnlock();
    feedback.afterUnlock();

    expect(clock.pending()).toBe(1);
    clock.advanceTo(GREETING_DELAY_MS);
    expect(engineState.played).toEqual(['hello']);
  });

  it('stays silent when the ranch is muted at fire time', () => {
    audioEngine();
    const { clock, feedback } = createGreetingHarness();
    engineState.unlocked = true;

    feedback.afterUnlock();
    engineState.muted = true;
    clock.advanceTo(GREETING_DELAY_MS);
    expect(engineState.played).toEqual([]);

    // Unmuting later does not resurrect the greeting: the timer was the only one.
    engineState.muted = false;
    clock.advanceTo(GREETING_DELAY_MS * 2);
    expect(engineState.played).toEqual([]);
    expect(clock.pending()).toBe(0);
  });

  it('stays silent after a mute-first unlock, even once unmuted', () => {
    audioEngine();
    engineState.muted = true;
    const { clock, feedback } = createGreetingHarness();
    engineState.unlocked = true;

    feedback.afterUnlock();
    engineState.muted = false;
    clock.advanceTo(GREETING_DELAY_MS);

    expect(engineState.played).toEqual([]);
  });

  it('schedules nothing until the unlock resolves', () => {
    audioEngine();
    const { clock, feedback } = createGreetingHarness();

    clock.advanceTo(GREETING_DELAY_MS * 2);

    expect(clock.pending()).toBe(0);
    expect(engineState.played).toEqual([]);
    feedback.dispose();
  });
});
