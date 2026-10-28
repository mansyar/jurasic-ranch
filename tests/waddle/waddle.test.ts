import { describe, expect, it } from "vitest";
import {
  BLINK_MAX_SECONDS,
  BLINK_MIN_SECONDS,
  createWaddlePose,
  displacementMetres,
  loopPhase,
  nextBlinkDelaySeconds,
  plantsCrossed,
  puffCountForPlant,
  squashScaleY,
  turnDurationSeconds,
  updateWaddlePose,
  WADDLE_LOOP_SECONDS,
  WALK_SPEED_METRES_PER_SECOND,
} from "../../src/ranch/waddle.js";

const DT = 1 / 60;

describe("waddle loop", () => {
  it("stays a 0.79-0.81 s loop", () => {
    expect(WADDLE_LOOP_SECONDS).toBeGreaterThanOrEqual(0.79);
    expect(WADDLE_LOOP_SECONDS).toBeLessThanOrEqual(0.81);
  });

  it("wraps the loop phase", () => {
    expect(loopPhase(0)).toBe(0);
    expect(loopPhase(0.4)).toBeCloseTo(0.5, 9);
    expect(loopPhase(WADDLE_LOOP_SECONDS)).toBe(0);
    expect(loopPhase(1.2)).toBeCloseTo(0.5, 9);
  });
});

describe("turn-then-walk", () => {
  it("completes a 90 deg turn in place in under 0.6 s with no translation", () => {
    expect(turnDurationSeconds(Math.PI / 2)).toBeLessThan(0.6);
    const pose = createWaddlePose(Math.PI / 2);
    pose.moving = true;
    let time = 0;
    let movedWhileTurning = 0;
    let firstBlendAt = -1;
    while (time < 2) {
      updateWaddlePose(pose, DT);
      time += DT;
      if (pose.blend <= 0) {
        movedWhileTurning += displacementMetres(pose, DT);
      } else if (firstBlendAt < 0) {
        firstBlendAt = time;
      }
    }
    expect(movedWhileTurning).toBe(0);
    expect(firstBlendAt).toBeGreaterThan(0);
    expect(firstBlendAt).toBeLessThan(0.6);
    expect(pose.heading).toBeCloseTo(Math.PI / 2, 5);
  });

  it("eases walk start and stop over ~0.2 s (no pop)", () => {
    const pose = createWaddlePose(0);
    pose.moving = true;
    for (let i = 0; i < 6; i += 1) {
      updateWaddlePose(pose, DT);
    }
    expect(pose.blend).toBeGreaterThan(0);
    expect(pose.blend).toBeLessThan(1);
    for (let i = 0; i < 12; i += 1) {
      updateWaddlePose(pose, DT);
    }
    expect(pose.blend).toBe(1);
    pose.moving = false;
    for (let i = 0; i < 12; i += 1) {
      updateWaddlePose(pose, DT);
    }
    expect(pose.blend).toBe(0);
    expect(displacementMetres(pose, DT)).toBe(0);
  });

  it("holds a constant 0.4 m/s once blended", () => {
    expect(WALK_SPEED_METRES_PER_SECOND).toBe(0.4);
    const pose = createWaddlePose(0);
    pose.moving = true;
    for (let i = 0; i < 60; i += 1) {
      updateWaddlePose(pose, DT);
    }
    expect(pose.blend).toBe(1);
    let distance = 0;
    for (let i = 0; i < 60; i += 1) {
      updateWaddlePose(pose, DT);
      distance += displacementMetres(pose, DT);
    }
    expect(distance).toBeCloseTo(0.4, 6);
  });

  it("ignores non-positive time steps", () => {
    const pose = createWaddlePose(1);
    pose.moving = true;
    updateWaddlePose(pose, 0);
    updateWaddlePose(pose, -1);
    expect(pose.blend).toBe(0);
    expect(displacementMetres(pose, -1)).toBe(0);
  });
});

describe("blink schedule", () => {
  it("stays within the 3-5 s window", () => {
    expect(BLINK_MIN_SECONDS).toBe(3);
    expect(BLINK_MAX_SECONDS).toBe(5);
    expect(nextBlinkDelaySeconds(0)).toBe(3);
    expect(nextBlinkDelaySeconds(0.5)).toBe(4);
    expect(nextBlinkDelaySeconds(1)).toBe(5);
    let previous = 0;
    for (let i = 0; i <= 100; i += 1) {
      const delay = nextBlinkDelaySeconds(i / 100);
      expect(delay).toBeGreaterThanOrEqual(3);
      expect(delay).toBeLessThanOrEqual(5);
      expect(delay).toBeGreaterThanOrEqual(previous);
      previous = delay;
    }
  });
});

describe("foot plants and squash", () => {
  it("fires two plants per loop", () => {
    expect(plantsCrossed(0.1, 0.6)).toBe(1);
    expect(plantsCrossed(0.6, 0.9)).toBe(0);
    expect(plantsCrossed(0.9, 0.1)).toBe(1);
    let total = 0;
    let prev = 0;
    for (let i = 1; i <= 60; i += 1) {
      const next = loopPhase(i * (WADDLE_LOOP_SECONDS / 60));
      total += plantsCrossed(prev, next);
      prev = next;
    }
    expect(total).toBe(2);
  });

  it("squashes only on contact", () => {
    expect(squashScaleY(0)).toBeCloseTo(0.95, 5);
    expect(squashScaleY(0.5)).toBeCloseTo(0.95, 5);
    expect(squashScaleY(0.25)).toBe(1);
    expect(squashScaleY(0.75)).toBe(1);
    for (let i = 0; i < 100; i += 1) {
      const scale = squashScaleY(i / 100);
      expect(scale).toBeGreaterThanOrEqual(0.95 - 1e-9);
      expect(scale).toBeLessThanOrEqual(1);
    }
  });

  it("puffs 2-4 dust motes per plant", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i <= 100; i += 1) {
      const count = puffCountForPlant(i / 100);
      min = Math.min(min, count);
      max = Math.max(max, count);
    }
    expect(min).toBe(2);
    expect(max).toBe(4);
  });
});
