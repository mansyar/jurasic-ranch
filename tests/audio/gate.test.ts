import { describe, expect, it } from 'vitest';
import { HOLD_DURATION_MS, HoldGate } from '../../src/audio/gate.js';

/**
 * The parent gear's 2 s gate (FR-8, AC-8). The gate is pure, so a hold that
 * completes at 2 s, an early release at 1.9 s, repeated presses, and progress
 * clamping are all provable without a browser or timers.
 */

describe('HoldGate (FR-8, AC-8)', () => {
  it('uses a 2 s hold and starts idle at progress 0', () => {
    expect(HOLD_DURATION_MS).toBe(2000);
    const gate = new HoldGate();
    expect(gate.active).toBe(false);
    expect(gate.progress).toBe(0);
    expect(gate.tick(2000)).toBe(false);
  });

  it('completes exactly at 2 s with a full progress ring', () => {
    const gate = new HoldGate();
    gate.start(0);
    expect(gate.active).toBe(true);

    expect(gate.tick(1000)).toBe(false);
    expect(gate.progress).toBe(0.5);

    expect(gate.tick(HOLD_DURATION_MS)).toBe(true);
    expect(gate.active).toBe(false);
    expect(gate.progress).toBe(1);
    // Completion fires once; later ticks are idle no-ops.
    expect(gate.tick(4000)).toBe(false);
  });

  it('cancels at 1.9 s without opening anything', () => {
    const gate = new HoldGate();
    gate.start(0);
    expect(gate.tick(1900)).toBe(false);
    gate.cancel();

    expect(gate.active).toBe(false);
    expect(gate.progress).toBe(0);
    expect(gate.tick(2000)).toBe(false);
    expect(gate.progress).toBe(0);
  });

  it('does not reset the elapsed time on a repeated start', () => {
    const gate = new HoldGate();
    gate.start(0);
    gate.tick(1000);
    gate.start(1500);

    expect(gate.progress).toBe(0.5);
    expect(gate.tick(1999)).toBe(false);
    expect(gate.tick(2000)).toBe(true);
  });

  it('clamps progress into 0..1 across overshoot and negative time', () => {
    const gate = new HoldGate();
    gate.start(0);
    expect(gate.tick(-200)).toBe(false);
    expect(gate.progress).toBe(0);

    expect(gate.tick(9999)).toBe(true);
    expect(gate.progress).toBe(1);
  });

  it('completes on demand and starts a fresh hold afterwards', () => {
    const gate = new HoldGate();
    gate.start(0);
    gate.complete();

    expect(gate.active).toBe(false);
    expect(gate.progress).toBe(1);
    expect(gate.tick(2000)).toBe(false);

    gate.start(3000);
    expect(gate.active).toBe(true);
    expect(gate.progress).toBe(0);
    expect(gate.tick(4999)).toBe(false);
    expect(gate.tick(5000)).toBe(true);
  });

  it('honours an injected duration for keyboard parity tests', () => {
    const gate = new HoldGate(500);
    gate.start(0);
    expect(gate.tick(499)).toBe(false);
    expect(gate.tick(500)).toBe(true);
  });
});
