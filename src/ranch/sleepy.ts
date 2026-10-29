/**
 * Sleepy idle cues (FR-4): a timestamp-driven awake->drowsy->sleepy state
 * machine plus the droopy/yawn pose math. Visual only — sleepy never forces
 * a nap or an exit, and every cue cancels on the next interaction with the
 * base pose restored.
 *
 * Timestamp-driven on purpose: the controller owns no timers, so nothing can
 * leak across POV switches. The viewer feeds it `performance.now()` from the
 * existing animation loop and calls `markInteraction` from the existing
 * pointer/key handlers.
 */

/** Milliseconds of no interaction before the dinos fall sleepy. */
export const IDLE_AFTER_MS = 90_000;

/** Milliseconds of no interaction before the half-mast drowsy stage. */
export const DROWSY_AFTER_MS = IDLE_AFTER_MS / 2;

/** Idle stage of the sleepy state machine. */
export type SleepyState = 'awake' | 'drowsy' | 'sleepy';

/**
 * Lid closure held by the droop at full sleepy weight (fraction of a full
 * blink). 0.6 reads clearly droopy on both the eye-scale and head-dip blink
 * paths without ever fully shutting the eyes.
 */
export const SLEEPY_DROOP_LID = 0.6;

/** Yawn swell period in seconds: one slow breath-sized pulse. */
export const SLEEPY_YAWN_PERIOD_SECONDS = 4;

/** Yawn swell depth as a fraction of model height at full sleepy weight. */
export const SLEEPY_YAWN_SCALE = 0.04;

/**
 * Overlay weight ease rate per second: full droop blooms over ~2 s of
 * drowsy/sleepy time, while a tap snaps it out instantly via
 * `markInteraction` (FR-7: no stuck droop).
 */
export const SLEEPY_WEIGHT_RATE_PER_SECOND = 0.5;

/**
 * Largest frame step the weight ease trusts: background-tab gaps must not
 * fast-forward the bloom (matches the player's 0.25 s dt clamp).
 */
const SLEEPY_MAX_DT_SECONDS = 0.25;

/** Overlay weight target per idle stage: awake 0, drowsy half, sleepy full. */
export function sleepyWeightTargetFor(state: SleepyState): number {
  if (state === 'sleepy') {
    return 1;
  }
  if (state === 'drowsy') {
    return 0.5;
  }
  return 0;
}

/**
 * Idle stage for the time since the last interaction. Thresholds default to
 * the tuned constants; pass explicit values to retune or to fast-forward in
 * tests.
 */
export function sleepyStateFor(
  lastInteractionMs: number,
  nowMs: number,
  idleMs: number = IDLE_AFTER_MS,
  drowsyMs: number = DROWSY_AFTER_MS,
): SleepyState {
  const idle = nowMs - lastInteractionMs;
  if (idle >= idleMs) {
    return 'sleepy';
  }
  if (idle >= drowsyMs) {
    return 'drowsy';
  }
  return 'awake';
}

/**
 * Yawn swell factor for the model height at a sleepy weight. Exactly 1 with
 * no weight, so awake frames render bit-identical with or without the sleepy
 * path. Under reduced motion the swell freezes into a static highlight at the
 * same depth (FR-8).
 */
export function yawnScaleFor(
  elapsedSeconds: number,
  weight: number,
  reducedMotion = false,
): number {
  const clamped = Math.min(Math.max(weight, 0), 1);
  if (clamped <= 0) {
    return 1;
  }
  if (reducedMotion) {
    return 1 + SLEEPY_YAWN_SCALE * clamped;
  }
  const phase = (elapsedSeconds * Math.PI * 2) / SLEEPY_YAWN_PERIOD_SECONDS;
  return 1 + SLEEPY_YAWN_SCALE * clamped * Math.sin(phase);
}

/**
 * Timestamp-driven sleepy controller. Call `update` every frame with the
 * current clock and `markInteraction` on any pointerdown, key, Walk toggle,
 * or POV switch. Interrupt snaps the weight to zero, so the next player
 * frame renders the base pose with no stuck droop.
 */
export class SleepyController {
  private lastInteractionMs: number;
  private lastUpdateMs: number;
  private currentState: SleepyState = 'awake';
  private weight = 0;

  constructor(nowMs = 0) {
    this.lastInteractionMs = nowMs;
    this.lastUpdateMs = nowMs;
  }

  /** Current idle stage. */
  get state(): SleepyState {
    return this.currentState;
  }

  /** Current overlay weight 0..1 driving droop and yawn depth. */
  get sleepyWeight(): number {
    return this.weight;
  }

  /** Any interaction wakes the dinos instantly with the pose restored. */
  markInteraction(nowMs: number): void {
    this.lastInteractionMs = nowMs;
    this.lastUpdateMs = nowMs;
    this.currentState = 'awake';
    this.weight = 0;
  }

  /** Advance the stage and ease the overlay weight toward its target. */
  update(nowMs: number): SleepyState {
    const rawDtSeconds = Math.max((nowMs - this.lastUpdateMs) / 1000, 0);
    const dtSeconds = Math.min(rawDtSeconds, SLEEPY_MAX_DT_SECONDS);
    this.lastUpdateMs = nowMs;
    this.currentState = sleepyStateFor(this.lastInteractionMs, nowMs);
    const target = sleepyWeightTargetFor(this.currentState);
    const step = SLEEPY_WEIGHT_RATE_PER_SECOND * dtSeconds;
    if (this.weight < target) {
      this.weight = Math.min(target, this.weight + step);
    } else if (this.weight > target) {
      this.weight = Math.max(target, this.weight - step);
    }
    return this.currentState;
  }
}
