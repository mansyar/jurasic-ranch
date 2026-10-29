import { describe, expect, it } from 'vitest';
import {
  AVOIDANCE_NUDGE_RADIANS,
  AVOIDANCE_TRIGGER_METRES,
  avoidanceNudges,
  TRIO_SPAWN_RADIUS_METRES,
  trioAvoidanceNudges,
  trioSpawnPositions,
} from '../../src/ranch/avoidance.js';
import { wrapAngle } from '../../src/ranch/waddle.js';

/**
 * Trio avoidance (FR-6): the pairwise soft-steer extends to three dinos by
 * applying the dual logic to each of the 3 pairs and clamping the summed bias
 * per dino. Pure heading math — `moving` is never touched, so the trio never
 * stops, bounces, or teleports.
 */

function clampNudge(radians: number): number {
  if (radians > AVOIDANCE_NUDGE_RADIANS) {
    return AVOIDANCE_NUDGE_RADIANS;
  }
  if (radians < -AVOIDANCE_NUDGE_RADIANS) {
    return -AVOIDANCE_NUDGE_RADIANS;
  }
  return radians;
}

describe('trio spawn (FR-5)', () => {
  it('starts the trio on a 0.4 m triangle so all three clear the trigger', () => {
    expect(TRIO_SPAWN_RADIUS_METRES).toBe(0.4);
    const spawn = trioSpawnPositions();
    expect(spawn).toHaveLength(3);
    for (const [first, second] of [
      [spawn[0], spawn[1]],
      [spawn[1], spawn[2]],
      [spawn[0], spawn[2]],
    ] as const) {
      const distance = Math.hypot(first.x - second.x, first.z - second.z);
      expect(distance).toBeGreaterThan(AVOIDANCE_TRIGGER_METRES);
    }
  });

  it('spaces the triangle at 120 deg offsets on the spawn circle', () => {
    const spawn = trioSpawnPositions();
    for (const point of spawn) {
      expect(Math.hypot(point.x, point.z)).toBeCloseTo(TRIO_SPAWN_RADIUS_METRES, 12);
    }
    const angles = spawn.map((point) => Math.atan2(point.x, point.z));
    const sorted = [...angles].sort((a, b) => a - b);
    const gaps = [
      sorted[1] - sorted[0],
      sorted[2] - sorted[1],
      sorted[0] + Math.PI * 2 - sorted[2],
    ];
    for (const gap of gaps) {
      expect(gap).toBeCloseTo((Math.PI * 2) / 3, 9);
    }
  });
});

describe('trio avoidance direction (FR-6)', () => {
  it('returns zero nudges when all three are far apart', () => {
    expect(trioAvoidanceNudges(0, 0, 0, 5, 0, 0, 0, 5, Math.PI)).toEqual({
      aNudge: 0,
      bNudge: 0,
      cNudge: 0,
    });
  });

  it('nudges only the close pair, leaving the far third alone', () => {
    // A and B abreast 0.3 m apart walking +Z; C far away.
    const trio = trioAvoidanceNudges(-0.15, 0, 0, 0.15, 0, 0, 5, 5, 0);
    expect(trio.aNudge).toBeLessThan(0);
    expect(trio.bNudge).toBeGreaterThan(0);
    expect(trio.cNudge).toBe(0);
  });

  it('matches the clamped sum of the three pairwise nudges', () => {
    const a = { x: 0.1, z: 0.2, heading: 0.5 };
    const b = { x: -0.1, z: 0.05, heading: -0.4 };
    const c = { x: 0.05, z: -0.15, heading: 2.1 };
    const ab = avoidanceNudges(a.x, a.z, a.heading, b.x, b.z, b.heading);
    const ac = avoidanceNudges(a.x, a.z, a.heading, c.x, c.z, c.heading);
    const bc = avoidanceNudges(b.x, b.z, b.heading, c.x, c.z, c.heading);
    const trio = trioAvoidanceNudges(a.x, a.z, a.heading, b.x, b.z, b.heading, c.x, c.z, c.heading);
    expect(trio.aNudge).toBeCloseTo(clampNudge(ab.aNudge + ac.aNudge), 12);
    expect(trio.bNudge).toBeCloseTo(clampNudge(ab.bNudge + bc.aNudge), 12);
    expect(trio.cNudge).toBeCloseTo(clampNudge(ac.bNudge + bc.bNudge), 12);
  });

  it('keeps every nudge within the snap-free cap when all three crowd', () => {
    const trio = trioAvoidanceNudges(0, 0, 0, 0.1, 0, 1, -0.1, 0.05, 2);
    for (const nudge of [trio.aNudge, trio.bNudge, trio.cNudge]) {
      expect(Math.abs(nudge)).toBeLessThanOrEqual(AVOIDANCE_NUDGE_RADIANS);
    }
    expect(Math.abs(trio.aNudge) + Math.abs(trio.bNudge) + Math.abs(trio.cNudge)).toBeGreaterThan(
      0,
    );
  });

  it('stays defined at coincidence: finite splits, no NaN', () => {
    const trio = trioAvoidanceNudges(0, 0, 0, 0, 0, Math.PI, 5, 5, 0);
    for (const nudge of [trio.aNudge, trio.bNudge]) {
      expect(Number.isFinite(nudge)).toBe(true);
    }
    expect(trio.cNudge).toBe(0);
  });

  it('biases a head-on pair apart inside the trio, never toward the foe', () => {
    const foeBearingA = Math.atan2(0.35, 0);
    const trio = trioAvoidanceNudges(0, 0, Math.PI / 2, 0.35, 0, -Math.PI / 2, 5, 5, 0);
    expect(Math.abs(trio.aNudge)).toBeGreaterThan(0);
    expect(Math.abs(trio.bNudge)).toBeGreaterThan(0);
    const beforeA = Math.abs(wrapAngle(Math.PI / 2 - foeBearingA));
    const afterA = Math.abs(wrapAngle(Math.PI / 2 + trio.aNudge - foeBearingA));
    expect(afterA).toBeGreaterThan(beforeA);
    expect(trio.cNudge).toBe(0);
  });
});
