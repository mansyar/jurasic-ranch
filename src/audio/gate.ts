/**
 * Pure hold-gate state machine behind the parent volume gear (FR-8, NFR-4).
 * Pointer and keyboard holds share this one gate, so both inputs must reach the
 * same continuous threshold with the same cancel behaviour. No timers and no
 * DOM: the caller drives `tick` from the frame loop, which keeps the visible
 * progress ring testable without a browser.
 */

/** Continuous hold required before the parent panel may open (FR-8). */
export const HOLD_DURATION_MS = 2000;

/** Clamp a raw ratio into the progress range. */
function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}

/**
 * A single 2 s hold. `start` records the first press, `tick` advances the
 * elapsed time and reports completion exactly once, and `cancel` returns the
 * gate to idle without opening anything.
 */
export class HoldGate {
  private readonly durationMs: number;
  private startedAtMs: number | null = null;
  private lastTickMs = 0;
  private completed = false;

  constructor(durationMs = HOLD_DURATION_MS) {
    this.durationMs = durationMs;
  }

  /** Whether a hold is running and has not completed yet. */
  get active(): boolean {
    return this.startedAtMs !== null;
  }

  /** Progress in `0..1` at the last `tick`; `1` after completion, else `0` idle. */
  get progress(): number {
    if (this.completed) {
      return 1;
    }
    if (this.startedAtMs === null) {
      return 0;
    }
    return clampProgress((this.lastTickMs - this.startedAtMs) / this.durationMs);
  }

  /**
   * Begin a hold. A repeated `start` while active keeps the original start time,
   * so a pointerdown repeat during the same hold cannot extend the gate.
   */
  start(now: number): void {
    if (this.active) {
      return;
    }
    this.startedAtMs = now;
    this.lastTickMs = now;
    this.completed = false;
  }

  /** Advance the hold; returns true only on the tick that reaches the duration. */
  tick(now: number): boolean {
    if (this.startedAtMs === null) {
      return false;
    }
    this.lastTickMs = now;
    if ((now - this.startedAtMs) / this.durationMs < 1) {
      return false;
    }
    this.startedAtMs = null;
    this.completed = true;
    return true;
  }

  /** Early release, pointer cancel, or blur: back to idle with no completion. */
  cancel(): void {
    this.startedAtMs = null;
    this.lastTickMs = 0;
    this.completed = false;
  }

  /** Force the completed state (keyboard activation and tests). */
  complete(): void {
    this.startedAtMs = null;
    this.lastTickMs = 0;
    this.completed = true;
  }
}
