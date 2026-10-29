import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  installGestureUnlock,
  installVisibilityHandling,
  type VisibilityDocument,
} from '../../src/audio/gesture.js';

/** DOM-free event target: listeners are stored and dispatched by hand. */
class FakeTarget {
  readonly listeners = new Map<string, Array<() => void>>();
  readonly passive = new Map<string, boolean>();

  addEventListener(type: string, listener: () => void, options?: { passive: boolean }): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
    this.passive.set(type, options?.passive ?? false);
  }

  removeEventListener(type: string, listener: () => void): void {
    const listeners = (this.listeners.get(type) ?? []).filter((entry) => entry !== listener);
    if (listeners.length === 0) {
      this.listeners.delete(type);
      return;
    }
    this.listeners.set(type, listeners);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  listenerCount(): number {
    let count = 0;
    for (const listeners of this.listeners.values()) {
      count += listeners.length;
    }
    return count;
  }
}

/** Fake document: a target plus the `hidden` flag visibility logic reads. */
class FakeDocument extends FakeTarget implements VisibilityDocument {
  hidden = false;
}

interface MutableEngine {
  unlocked: boolean;
  muted: boolean;
  handleVisibility(hidden: boolean): void;
  resumeContext(): Promise<void>;
}

interface EngineStub {
  engine: MutableEngine;
  calls: boolean[];
  resumeCalls(): number;
}

function createEngineStub(): EngineStub {
  const calls: boolean[] = [];
  let resumes = 0;
  return {
    engine: {
      unlocked: true,
      muted: false,
      handleVisibility(hidden: boolean): void {
        calls.push(hidden);
      },
      async resumeContext(): Promise<void> {
        resumes += 1;
      },
    },
    calls,
    resumeCalls: (): number => resumes,
  };
}

/** Let the visibility promise chain settle without a real timer. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('installGestureUnlock (FR-2, AC-2)', () => {
  it('unlocks exactly once on the first pointerdown', () => {
    const target = new FakeTarget();
    const onUnlock = vi.fn();
    installGestureUnlock({ target, onUnlock });

    target.dispatch('pointerdown');
    target.dispatch('pointerdown');
    target.dispatch('keydown');

    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('unlocks exactly once on the first keydown', () => {
    const target = new FakeTarget();
    const onUnlock = vi.fn();
    installGestureUnlock({ target, onUnlock });

    target.dispatch('keydown');
    target.dispatch('keydown');
    target.dispatch('pointerdown');

    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('registers passive listeners and removes both after the gesture', () => {
    const target = new FakeTarget();
    installGestureUnlock({ target, onUnlock: vi.fn() });

    expect(target.listenerCount()).toBe(2);
    expect(target.passive.get('pointerdown')).toBe(true);
    expect(target.passive.get('keydown')).toBe(true);

    target.dispatch('pointerdown');
    expect(target.listenerCount()).toBe(0);
  });

  it('cleanup removes the listeners before any gesture', () => {
    const target = new FakeTarget();
    const onUnlock = vi.fn();
    const cleanup = installGestureUnlock({ target, onUnlock });

    cleanup();
    target.dispatch('pointerdown');
    target.dispatch('keydown');

    expect(onUnlock).not.toHaveBeenCalled();
    expect(target.listenerCount()).toBe(0);
  });

  it('logs a synchronous unlock throw instead of propagating it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const target = new FakeTarget();
    installGestureUnlock({
      target,
      onUnlock: (): void => {
        throw new Error('no audio');
      },
    });

    expect(() => {
      target.dispatch('pointerdown');
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('logs a rejected unlock promise instead of leaving it unhandled', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const target = new FakeTarget();
    installGestureUnlock({
      target,
      onUnlock: (): Promise<void> => Promise.reject(new Error('no audio')),
    });

    target.dispatch('pointerdown');
    await settle();

    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('installVisibilityHandling (FR-3, NFR-7)', () => {
  it('pauses when hidden and resumes only on a visible, unmuted tab', async () => {
    const doc = new FakeDocument();
    const stub = createEngineStub();
    installVisibilityHandling(stub.engine, doc);

    doc.hidden = true;
    doc.dispatch('visibilitychange');
    expect(stub.calls).toEqual([true]);

    doc.hidden = false;
    doc.dispatch('visibilitychange');
    await settle();
    expect(stub.resumeCalls()).toBe(1);
    expect(stub.calls).toEqual([true, false]);
  });

  it('does not resume while muted', async () => {
    const doc = new FakeDocument();
    const stub = createEngineStub();
    stub.engine.muted = true;
    installVisibilityHandling(stub.engine, doc);

    doc.dispatch('visibilitychange');
    await settle();

    expect(stub.calls).toEqual([]);
    expect(stub.resumeCalls()).toBe(0);
  });

  it('does not resume before the first gesture unlocks the engine', async () => {
    const doc = new FakeDocument();
    const stub = createEngineStub();
    stub.engine.unlocked = false;
    installVisibilityHandling(stub.engine, doc);

    doc.dispatch('visibilitychange');
    await settle();

    expect(stub.calls).toEqual([]);
    expect(stub.resumeCalls()).toBe(0);
  });

  it('still resumes music when the context resume rejects', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const doc = new FakeDocument();
    const stub = createEngineStub();
    stub.engine.resumeContext = async (): Promise<void> => {
      throw new Error('denied');
    };
    installVisibilityHandling(stub.engine, doc);

    doc.dispatch('visibilitychange');
    await settle();

    expect(warn).toHaveBeenCalledTimes(1);
    // A failed resume is silence, not a stuck tab: no music call is attempted.
    expect(stub.calls).toEqual([]);
  });

  it('cleanup removes the visibility listener', () => {
    const doc = new FakeDocument();
    const stub = createEngineStub();
    const cleanup = installVisibilityHandling(stub.engine, doc);

    expect(doc.listenerCount()).toBe(1);
    cleanup();
    doc.dispatch('visibilitychange');

    expect(doc.listenerCount()).toBe(0);
    expect(stub.calls).toEqual([]);
  });
});
