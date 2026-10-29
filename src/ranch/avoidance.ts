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

/** Spawn radius for the trio triangle: every pair starts clear of TRIGGER. */
export const TRIO_SPAWN_RADIUS_METRES = 0.4;

/** Triangle spawn offsets in radians: 120 deg apart (90, 210, 330 deg). */
export const TRIO_SPAWN_ANGLES_RADIANS: readonly number[] = [
  Math.PI / 2,
  (Math.PI * 7) / 6,
  (Math.PI * 11) / 6,
];

/** Ground-plane spawn point on the trio triangle (x/z, +Z = 0 heading). */
export interface TrioSpawnPoint {
  x: number;
  z: number;
}

/**
 * Triangle spawn positions on a circle of the given radius: three points at
 * 120 deg offsets, so every pair starts ~0.69 m apart — clear of the
 * avoidance trigger on the very first frame.
 */
export function trioSpawnPositions(
  radiusMetres: number = TRIO_SPAWN_RADIUS_METRES,
): TrioSpawnPoint[] {
  return TRIO_SPAWN_ANGLES_RADIANS.map((angle) => ({
    x: radiusMetres * Math.cos(angle),
    z: radiusMetres * Math.sin(angle),
  }));
}

/** Per-dino heading biases for one trio avoidance step, in radians. */
export interface TrioNudges {
  aNudge: number;
  bNudge: number;
  cNudge: number;
}

/**
 * Heading biases for three dinos on the ground plane (x/z, +Z = 0 heading).
 * Extends the dual logic: applies avoidanceNudges to each of the 3 pairs and
 * clamps the summed bias per dino, so a dino crowded on both sides still gets
 * a small bounded steer. Never touches `moving` — the trio never stops,
 * bounces, or teleports.
 */
export function trioAvoidanceNudges(
  aX: number,
  aZ: number,
  aHeading: number,
  bX: number,
  bZ: number,
  bHeading: number,
  cX: number,
  cZ: number,
  cHeading: number,
): TrioNudges {
  const ab = avoidanceNudges(aX, aZ, aHeading, bX, bZ, bHeading);
  const ac = avoidanceNudges(aX, aZ, aHeading, cX, cZ, cHeading);
  const bc = avoidanceNudges(bX, bZ, bHeading, cX, cZ, cHeading);
  return {
    aNudge: clampNudge(ab.aNudge + ac.aNudge),
    bNudge: clampNudge(ab.bNudge + bc.aNudge),
    cNudge: clampNudge(ac.bNudge + bc.bNudge),
  };
}
