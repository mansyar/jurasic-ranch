import { describe, expect, it } from "vitest";
import {
  AVOIDANCE_NUDGE_RADIANS,
  AVOIDANCE_TRIGGER_METRES,
  avoidanceNudges,
} from "../../src/ranch/avoidance.js";
import { wrapAngle } from "../../src/ranch/waddle.js";

/**
 * Soft-steer avoidance (FR-6): when the pair is closer than 0.4 m, each dino
 * gets a small bounded heading nudge away from the other. Never stops (pose
 * `moving` untouched), never bounces or teleports (continuous capped bias).
 */

describe("avoidance trigger (FR-6)", () => {
  it("biases headings apart inside 0.4 m", () => {
    expect(AVOIDANCE_TRIGGER_METRES).toBe(0.4);
  });

  it("returns zero nudges when the pair is far apart", () => {
    expect(avoidanceNudges(0, 0, 0, 5, 0, Math.PI)).toEqual({ aNudge: 0, bNudge: 0 });
  });

  it("returns zero nudges exactly at the trigger boundary", () => {
    expect(avoidanceNudges(0, 0, 0, AVOIDANCE_TRIGGER_METRES, 0, 0)).toEqual({
      aNudge: 0,
      bNudge: 0,
    });
  });
});

describe("avoidance direction (FR-6)", () => {
  it("pushes a head-on pair off collision course with small bounded nudges", () => {
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

  it("nudges a side-by-side pair apart laterally, never along the foe", () => {
    // A and B abreast 0.3 m apart, both walking +Z: each must gain lateral bias.
    const { aNudge, bNudge } = avoidanceNudges(-0.15, 0, 0, 0.15, 0, 0);
    expect(aNudge).toBeLessThan(0);
    expect(bNudge).toBeGreaterThan(0);
  });

  it("stays defined at coincidence: finite opposite splits, no NaN", () => {
    const { aNudge, bNudge } = avoidanceNudges(0, 0, 0, 0, 0, Math.PI);
    expect(Number.isFinite(aNudge)).toBe(true);
    expect(Number.isFinite(bNudge)).toBe(true);
    expect(aNudge).not.toBe(0);
    expect(bNudge).not.toBe(0);
    expect(Math.sign(aNudge)).not.toBe(Math.sign(bNudge));
  });
});
