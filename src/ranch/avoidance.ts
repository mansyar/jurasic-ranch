import { wrapAngle } from "./waddle.js";

/**
 * Soft-steer pair avoidance (FR-6): when Trike + Stego drift closer than the
 * trigger distance, each dino biases its heading away with a small capped
 * nudge. Pure heading math — the pose `moving` flag is never touched, so the
 * pair never stops, bounces, or teleports.
 */

/** Pair distance below which each dino steers away from the other. */
export const AVOIDANCE_TRIGGER_METRES = 0.4;
/** Largest single heading bias per application: a nudge, never a snap. */
export const AVOIDANCE_NUDGE_RADIANS = 0.2;

/** Per-dino heading biases for one avoidance step, in radians. */
export interface PairNudges {
  aNudge: number;
  bNudge: number;
}

function clampNudge(radians: number): number {
  if (radians > AVOIDANCE_NUDGE_RADIANS) {
    return AVOIDANCE_NUDGE_RADIANS;
  }
  if (radians < -AVOIDANCE_NUDGE_RADIANS) {
    return -AVOIDANCE_NUDGE_RADIANS;
  }
  return radians;
}

/**
 * Heading bias for a dino pair on the ground plane (x/z, +Z = 0 heading).
 * Returns zeros when the pair is at or beyond the trigger distance. At exact
 * coincidence the away bearing is undefined, so the pair splits with opposite
 * fixed nudges instead of NaN.
 */
export function avoidanceNudges(
  aX: number,
  aZ: number,
  aHeading: number,
  bX: number,
  bZ: number,
  bHeading: number,
): PairNudges {
  const dx = aX - bX;
  const dz = aZ - bZ;
  const distance = Math.hypot(dx, dz);
  if (distance >= AVOIDANCE_TRIGGER_METRES) {
    return { aNudge: 0, bNudge: 0 };
  }
  if (distance < 1e-6) {
    return { aNudge: AVOIDANCE_NUDGE_RADIANS, bNudge: -AVOIDANCE_NUDGE_RADIANS };
  }
  const awayA = Math.atan2(dx, dz);
  const awayB = Math.atan2(-dx, -dz);
  return {
    aNudge: clampNudge(wrapAngle(awayA - aHeading)),
    bNudge: clampNudge(wrapAngle(awayB - bHeading)),
  };
}
