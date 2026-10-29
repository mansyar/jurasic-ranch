import { describe, expect, it } from 'vitest';
import { BRACHIO_GAIT, STEGO_GAIT, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import { gaitSpeedMetresPerSecond } from '../../src/ranch/waddle.js';

/**
 * No species walks on another's numbers (FR-5, AC-5). The defect this track
 * fixed was hidden by a copy: `STEGO_GAIT` shipped the Trike's 0.29 m / 0.8 s
 * pair, so a Stego dragging its feet looked exactly like a correctly tuned
 * one. Each gait is now measured from its own shipped clip, so this gate holds
 * the *shape* of that fix: three distinct strides, three distinct loops, and no
 * pair of gaits that could be one copy of the other.
 *
 * The per-clip proof that each number is right lives beside the harnesses in
 * `tests/waddle/stego-gait.test.ts` and `tests/waddle/brachio-stride.test.ts`;
 * this file only forbids the copy ever coming back.
 */

const GAITS = [
  { name: 'trike', gait: TRIKE_GAIT },
  { name: 'stego', gait: STEGO_GAIT },
  { name: 'brachio', gait: BRACHIO_GAIT },
] as const;

describe('per-species gait constants (FR-5, AC-5)', () => {
  it('gives every species its own stride and loop, so no gait is a copy', () => {
    for (let i = 0; i < GAITS.length; i += 1) {
      for (let j = i + 1; j < GAITS.length; j += 1) {
        const a = GAITS[i];
        const b = GAITS[j];
        const sameStride = a.gait.strideMetres === b.gait.strideMetres;
        const sameLoop = a.gait.loopSeconds === b.gait.loopSeconds;
        expect(
          sameStride && sameLoop,
          `${a.name} and ${b.name} ship the same stride and loop (a copy)`,
        ).toBe(false);
        // Strides are the measured metres per loop, so they differ even where
        // the two animals are close (Stego 1.788 m, Brachio 1.767 m).
        expect(a.gait.strideMetres, `${a.name} vs ${b.name} stride`).not.toBe(b.gait.strideMetres);
      }
    }
  });

  it('keeps every species off the unchanged Trike pair', () => {
    expect(TRIKE_GAIT.strideMetres).toBe(0.29);
    expect(TRIKE_GAIT.loopSeconds).toBe(0.8);
    for (const { name, gait } of GAITS.slice(1)) {
      expect(gait.strideMetres, `${name} stride`).not.toBe(TRIKE_GAIT.strideMetres);
      expect(gait.loopSeconds, `${name} loop`).not.toBe(TRIKE_GAIT.loopSeconds);
    }
  });

  it('walks each species at its own measured speed, not one shared pace', () => {
    const speeds = GAITS.map(({ gait }) => gaitSpeedMetresPerSecond(gait));
    // Stego 0.745, Brachio 0.465, Trike 0.3625 m/s: all three differ, and the
    // two measured species differ by more than the 5 % the stride tests use.
    for (let i = 0; i < speeds.length; i += 1) {
      for (let j = i + 1; j < speeds.length; j += 1) {
        const ratio = Math.max(speeds[i], speeds[j]) / Math.min(speeds[i], speeds[j]);
        expect(ratio, `${GAITS[i].name} vs ${GAITS[j].name} speed`).toBeGreaterThan(1.2);
      }
    }
  });
});
