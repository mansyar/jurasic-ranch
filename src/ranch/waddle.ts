/**
 * Pure waddle-walk timing math (FR-5 turn-then-walk, FR-6 blink, FR-7 plants).
 * DOM- and renderer-free so the whole timing contract is unit-testable.
 */

/** Length of one Waddle loop in seconds; must match the baked GLB clip. */
export const WADDLE_LOOP_SECONDS = 0.8;

/** Forward speed while walking at full blend. */
export const WALK_SPEED_METRES_PER_SECOND = 0.4;

/** Yaw rate for turn-in-place; a 90 deg turn completes in 0.5 s (< 0.6 s). */
export const TURN_RATE_RADIANS_PER_SECOND = Math.PI;

/** Upper bound for a 90 deg turn-in-place (FR-5). */
export const TURN_90_MAX_SECONDS = 0.6;

/** Heading tolerance treated as "facing the target". */
export const TURN_ALIGN_RADIANS = 0.02;

/** Blend ramp for walk start/stop so there is no pop. */
export const WALK_BLEND_SECONDS = 0.2;

/** Distance covered per full-speed waddle cycle (speed x loop). */
export const WADDLE_CYCLE_METRES = WALK_SPEED_METRES_PER_SECOND * WADDLE_LOOP_SECONDS;

/** Blink scheduling window (FR-6). */
export const BLINK_MIN_SECONDS = 3;
export const BLINK_MAX_SECONDS = 5;

/** How long the lid stays closed per blink. */
export const BLINK_CLOSE_SECONDS = 0.12;

/** Foot-plant phases within one loop (diagonal pairs for a 4-leg waddle). */
export const FOOT_PLANT_PHASES: readonly number[] = [0, 0.5];

/** Dust puffs spawned per foot plant (FR-7). */
export const DUST_PUFFS_MIN = 2;
export const DUST_PUFFS_MAX = 4;

/** Body squash depth applied at each foot plant. */
export const SQUASH_DEPTH = 0.05;

/** Phase window each side of a plant over which squash applies. */
const SQUASH_HALF_WIDTH_PHASE = 0.125;

/** Pose controller state: turn-in-place first, then translate. */
export interface WaddlePose {
  heading: number;
  targetHeading: number;
  /** 0 = standing, 1 = full-speed walk; eased over WALK_BLEND_SECONDS. */
  blend: number;
  /** Desired walk state (Walk button). */
  moving: boolean;
}

/** Wrap an angle into [-PI, PI]. */
export function wrapAngle(radians: number): number {
  const twoPi = Math.PI * 2;
  let wrapped = (radians + Math.PI) % twoPi;
  if (wrapped < 0) {
    wrapped += twoPi;
  }
  return wrapped - Math.PI;
}

/** Seconds a turn-in-place of the given angle takes at the fixed yaw rate. */
export function turnDurationSeconds(angleRadians: number): number {
  return Math.abs(angleRadians) / TURN_RATE_RADIANS_PER_SECOND;
}

/** Map a 0..1 random draw onto the 3..5 s blink scheduling window. */
export function nextBlinkDelaySeconds(random01: number): number {
  const clamped = Math.min(Math.max(random01, 0), 1);
  return BLINK_MIN_SECONDS + clamped * (BLINK_MAX_SECONDS - BLINK_MIN_SECONDS);
}

/** Smoothstep 0..1; the walk blend ramp shape. */
export function smoothstep01(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

/** Walk blend 0..1 for the time since the last walk toggle (no pop). */
export function walkBlendFactor(elapsedSeconds: number): number {
  return smoothstep01(elapsedSeconds / WALK_BLEND_SECONDS);
}

/** Fresh pose controller facing the given heading, standing still. */
export function createWaddlePose(targetHeadingRadians = 0): WaddlePose {
  return {
    heading: wrapAngle(targetHeadingRadians),
    targetHeading: wrapAngle(targetHeadingRadians),
    blend: 0,
    moving: false,
  };
}

/**
 * Advance the pose by dt. The heading turns in place first; forward blend
 * only ramps up once aligned, and ramps back to 0 on stop — so translation
 * (see displacementMetres) never slides through a turn or pops.
 */
export function updateWaddlePose(pose: WaddlePose, dtSeconds: number): void {
  if (!(dtSeconds > 0)) {
    return;
  }
  const remaining = wrapAngle(pose.targetHeading - pose.heading);
  const maxStep = TURN_RATE_RADIANS_PER_SECOND * dtSeconds;
  if (Math.abs(remaining) > 0.0001) {
    const step = Math.sign(remaining) * Math.min(Math.abs(remaining), maxStep);
    pose.heading = wrapAngle(pose.heading + step);
  }
  const aligned = Math.abs(wrapAngle(pose.targetHeading - pose.heading)) < TURN_ALIGN_RADIANS;
  const target = pose.moving && aligned ? 1 : 0;
  const blendStep = dtSeconds / WALK_BLEND_SECONDS;
  const delta = target - pose.blend;
  pose.blend += Math.sign(delta) * Math.min(Math.abs(delta), blendStep);
}

/** Metres covered this frame: constant 0.4 m/s scaled by the eased blend. */
export function displacementMetres(pose: WaddlePose, dtSeconds: number): number {
  return pose.blend * WALK_SPEED_METRES_PER_SECOND * Math.max(dtSeconds, 0);
}

/** Loop phase 0..1 for an elapsed gait time. */
export function loopPhase(elapsedSeconds: number): number {
  const wrapped =
    ((elapsedSeconds % WADDLE_LOOP_SECONDS) + WADDLE_LOOP_SECONDS) % WADDLE_LOOP_SECONDS;
  return wrapped / WADDLE_LOOP_SECONDS;
}

/** How many foot plants are crossed going from one loop phase to the next. */
export function plantsCrossed(prevPhase01: number, nextPhase01: number): number {
  let crossed = 0;
  const wrapped = nextPhase01 < prevPhase01;
  for (const plant of FOOT_PLANT_PHASES) {
    if (!wrapped && prevPhase01 < plant && nextPhase01 >= plant) {
      crossed += 1;
    } else if (wrapped && (plant > prevPhase01 || plant <= nextPhase01)) {
      crossed += 1;
    }
  }
  return crossed;
}

/** Vertical body scale for a loop phase: dips to 1 - SQUASH_DEPTH at plants. */
export function squashScaleY(phase01: number): number {
  let influence = 0;
  for (const plant of FOOT_PLANT_PHASES) {
    const raw = Math.abs(phase01 - plant);
    const distance = Math.min(raw, 1 - raw);
    const local = Math.max(0, 1 - distance / SQUASH_HALF_WIDTH_PHASE);
    const smooth = local * local * (3 - 2 * local);
    influence = Math.max(influence, smooth);
  }
  return 1 - SQUASH_DEPTH * influence;
}

/** Dust puff count for one plant from a 0..1 random draw: 2..4 puffs. */
export function puffCountForPlant(random01: number): number {
  const clamped = Math.min(Math.max(random01, 0), 1);
  const count = DUST_PUFFS_MIN + Math.floor(clamped * (DUST_PUFFS_MAX - DUST_PUFFS_MIN + 1));
  return Math.min(count, DUST_PUFFS_MAX);
}
