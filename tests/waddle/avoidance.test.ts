import { describe, expect, it } from 'vitest';
import {
  AVOIDANCE_NUDGE_RADIANS,
  AVOIDANCE_REACTION_SECONDS,
  AVOIDANCE_TRIGGER_METRES,
  LARGEST_DINO_BODY_LENGTH_METRES,
  MAX_CLOSING_SPEED_METRES_PER_SECOND,
  PAIR_BODY_CLEARANCE_METRES,
  avoidanceNudges,
} from '../../src/ranch/avoidance.js';
import { wrapAngle } from '../../src/ranch/waddle.js';

/**
 * Soft-steer avoidance (FR-6): when the pair is closer than the trigger, each
 * dino gets a small bounded heading nudge away from the other. Never stops
 * (pose `moving` untouched), never bounces or teleports (continuous capped
 * bias). Since phase 5 the trigger is derived from the biggest body on the
 * ranch rather than tuned to the 0.36 m/s Trike, because the Brachio alone
 * halves the warning a meeting gets.
 */

describe('avoidance trigger (FR-6)', () => {
  it('clears the biggest flank plus the ground a pair covers reacting', () => {
    // Half a body length of beam each side is what two bodies need before a
    // steer must start; phase 4 measured 1.21 m/s as the fastest pair.
    expect(PAIR_BODY_CLEARANCE_METRES).toBe(LARGEST_DINO_BODY_LENGTH_METRES / 6);
    expect(AVOIDANCE_TRIGGER_METRES).toBe(
      PAIR_BODY_CLEARANCE_METRES + MAX_CLOSING_SPEED_METRES_PER_SECOND * AVOIDANCE_REACTION_SECONDS,
    );
    expect(AVOIDANCE_TRIGGER_METRES).toBeCloseTo(1.842, 3);
  });

  it('starts steering while the flanks are still apart', () => {
    // The phase-4 requirement (a 0.6 m trigger for 1.21 m/s and 0.5 s) is the
    // floor; the body clearance is what the old tuned 0.4 m lacked.
    expect(AVOIDANCE_TRIGGER_METRES).toBeGreaterThanOrEqual(0.6);
    expect(AVOIDANCE_TRIGGER_METRES).toBeLessThan(LARGEST_DINO_BODY_LENGTH_METRES);
  });

  it('returns zero nudges when the pair is far apart', () => {
    expect(avoidanceNudges(0, 0, 0, 5, 0, Math.PI)).toEqual({ aNudge: 0, bNudge: 0 });
  });

  it('returns zero nudges exactly at the trigger boundary', () => {
    expect(avoidanceNudges(0, 0, 0, AVOIDANCE_TRIGGER_METRES, 0, 0)).toEqual({
      aNudge: 0,
      bNudge: 0,
    });
  });
});

describe('avoidance direction (FR-6)', () => {
  it('pushes a head-on pair off collision course with small bounded nudges', () => {
    // A at the origin facing +X, B 0.35 m ahead facing -X: closing head-on.
    const foeBearingA = Math.atan2(0.35, 0);
    const foeBearingB = Math.atan2(-0.35, 0);
    const { aNudge, bNudge } = avoidanceNudges(0, 0, Math.PI / 2, 0.35, 0, -Math.PI / 2);
    for (const nudge of [aNudge, bNudge]) {
      expect(Math.abs(nudge)).toBeGreaterThan(0);
      expect(Math.abs(nudge)).toBeLessThanOrEqual(AVOIDANCE_NUDGE_RADIANS);
    }
    // Each biased target sits farther from its foe bearing than before.
    const beforeA = Math.abs(wrapAngle(Math.PI / 2 - foeBearingA));
    const afterA = Math.abs(wrapAngle(Math.PI / 2 + aNudge - foeBearingA));
    expect(afterA).toBeGreaterThan(beforeA);
    const beforeB = Math.abs(wrapAngle(-Math.PI / 2 - foeBearingB));
    const afterB = Math.abs(wrapAngle(-Math.PI / 2 + bNudge - foeBearingB));
    expect(afterB).toBeGreaterThan(beforeB);
  });

  it('nudges a side-by-side pair apart laterally, never along the foe', () => {
    // A and B abreast 0.3 m apart, both walking +Z: each must gain lateral bias.
    const { aNudge, bNudge } = avoidanceNudges(-0.15, 0, 0, 0.15, 0, 0);
    expect(aNudge).toBeLessThan(0);
    expect(bNudge).toBeGreaterThan(0);
  });

  it('stays defined at coincidence: finite opposite splits, no NaN', () => {
    const { aNudge, bNudge } = avoidanceNudges(0, 0, 0, 0, 0, Math.PI);
    expect(Number.isFinite(aNudge)).toBe(true);
    expect(Number.isFinite(bNudge)).toBe(true);
    expect(aNudge).not.toBe(0);
    expect(bNudge).not.toBe(0);
    expect(Math.sign(aNudge)).not.toBe(Math.sign(bNudge));
  });
});
