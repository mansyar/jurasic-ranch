import { wrapAngle } from './waddle.js';

/**
 * Soft-steer pair avoidance (FR-6): when two dinos drift closer than the
 * trigger distance, each biases its heading away with a small capped nudge.
 * Pure heading math — the pose `moving` flag is never touched, so the pair
 * never stops, bounces, or teleports.
 *
 * Every distance on the ranch is a multiple of one number,
 * `LARGEST_DINO_BODY_LENGTH_METRES`: the walk circle, the spawn ring, the
 * avoidance trigger and the dressing clearance all derive from it, so the next
 * size change moves the whole ranch instead of six independent literals.
 */

/**
 * Longest animal in game, in metres: the Brachiosaurus at the trio's uniform
 * group scale (`IN_GAME_BODY_LENGTH_METRES.brachio`, derived in
 * `src/viewer/loaders.ts` from the Triceratops the child already knows).
 *
 * Declared here rather than imported so this module — and the ranch layout
 * built on it — stays free of the model loaders. `tests/ranch/dressing.test.ts`
 * asserts it equals the loaders' value, so the two cannot drift apart silently.
 */
export const LARGEST_DINO_BODY_LENGTH_METRES = 7.4234;

/**
 * Radius of the circle a dino's body centre wanders inside: half the largest
 * body length. A 7.42 m animal therefore covers the walk circle from its
 * middle outwards, so it can complete a full turn with its tail inside the
 * walkable area and only its nose outside it.
 */
export const DINO_WALK_RADIUS_METRES = LARGEST_DINO_BODY_LENGTH_METRES / 2;

/**
 * Beam clearance two bodies need between their centres: a dino is roughly a
 * sixth of its length across, so the biggest animal needs ~1.24 m before its
 * flank reaches a neighbour's.
 */
export const PAIR_BODY_CLEARANCE_METRES = LARGEST_DINO_BODY_LENGTH_METRES / 6;

/**
 * Fastest a pair can close on each other, in m/s: the Stego's measured 0.745
 * plus the Brachio's 0.465 (phase-4 sweep). The Trike pairing closes slower.
 */
export const MAX_CLOSING_SPEED_METRES_PER_SECOND = 1.21;

/**
 * Seconds of warning a meeting needs: half a second covers the yaw-limited
 * half turn (PI rad/s) plus the 0.2 s walk blend. Phase 4 derived 0.6 m from
 * it alone; the body clearance above is what the old 0.4 m trigger lacked.
 */
export const AVOIDANCE_REACTION_SECONDS = 0.5;

/**
 * Pair distance below which each dino steers away from the other: the beam
 * clearance its body needs plus the ground the pair covers during the
 * reaction window, so a steer starts while the flanks are still apart.
 */
export const AVOIDANCE_TRIGGER_METRES =
  PAIR_BODY_CLEARANCE_METRES + MAX_CLOSING_SPEED_METRES_PER_SECOND * AVOIDANCE_REACTION_SECONDS;
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

/**
 * Spawn ring for the trio triangle: also half the largest body length, so
 * three points 120 deg apart sit 6.43 m apart — 0.87 of one body length, or
 * 0.05 of one before this phase. Even the two longest animals nose to tail
 * cannot start inside each other (FR-6); 0.4 m was a Trike-sized spawn.
 */
export const TRIO_SPAWN_RADIUS_METRES = LARGEST_DINO_BODY_LENGTH_METRES / 2;

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
 * 120 deg offsets, so every pair starts 1.73 x the radius apart — several
 * times the avoidance trigger on the very first frame.
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
