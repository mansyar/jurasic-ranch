import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../src/dev/seeded-random.js';

/** Deterministic RNG (FR-8): the same seed replays the same poses. */

function draw(seed: number, count: number): number[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => random());
}

describe('seededRandom (FR-8)', () => {
  it('replays the same stream for the same seed', () => {
    expect(draw(42, 25)).toEqual(draw(42, 25));
  });

  it('stays inside [0, 1)', () => {
    for (const value of draw(7, 250)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('produces different streams for different seeds', () => {
    expect(draw(1, 10)).not.toEqual(draw(2, 10));
  });

  it('does not degenerate for seed 0', () => {
    const values = draw(0, 10);
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});
