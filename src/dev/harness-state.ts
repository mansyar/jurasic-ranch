/**
 * Pure dev-harness logic (FR-2, FR-3, FR-4, FR-6, FR-8): visibility presets,
 * pause/step transitions, the HUD string, seeded stream derivation and the
 * overlay projection. No `three` and no DOM, so the panel's decisions are
 * unit-testable without WebGL.
 */

import { seededRandom } from './seeded-random.js';
import type { VisitState } from '../ranch/visit.js';
import type { DevSpeciesId } from './dev-options.js';

/** Fixed simulation delta per stepped frame (1/60 s, spec assumption). */
export const DEV_STEP_DT_SECONDS = 1 / 60;

/** Fixed dino order every seeded stream index is derived from. */
export const DEV_TRIO_ORDER: readonly DevSpeciesId[] = ['trike', 'stego', 'brachio'];

/** Seed offset mixed into the dust stream so it never aliases a dino stream. */
const DUST_SEED_OFFSET = 0x9e3779b9;
/** First dino movement stream index offset (`seed + 1 + i`). */
const MOVEMENT_SEED_OFFSET = 1;
/** First blink stream index offset (`seed + 101 + i`). */
const BLINK_SEED_OFFSET = 101;

/** One independent generator per consumer (FR-8, AC-9). */
export interface DevSeededStreams {
  /** Shared particle pool: dust counts only. */
  dust: () => number;
  /** Wander jitter and per-plant puff counts, keyed by dino id. */
  movement: Record<DevSpeciesId, () => number>;
  /** Blink schedule, keyed by dino id; never shared with movement. */
  blink: Record<DevSpeciesId, () => number>;
}

/**
 * Derive every seeded stream from the same seed by fixed index (FR-8): dust
 * gets `seed ^ 0x9e3779b9`, dino *i* of the fixed trio order `seed + 1 + i`
 * and blink *i* `seed + 101 + i`. Because the index is the species id's slot
 * in `DEV_TRIO_ORDER` (never the GLB resolution order), `?seed=42` replays
 * the same poses however the models load and however long the wall clock runs
 * between blink draws.
 */
export function seededStreams(seed: number): DevSeededStreams {
  return {
    dust: seededRandom(seed ^ DUST_SEED_OFFSET),
    movement: {
      trike: movementStream(seed, 'trike'),
      stego: movementStream(seed, 'stego'),
      brachio: movementStream(seed, 'brachio'),
    },
    blink: {
      trike: blinkStream(seed, 'trike'),
      stego: blinkStream(seed, 'stego'),
      brachio: blinkStream(seed, 'brachio'),
    },
  };
}

/** Fixed slot of a species in `DEV_TRIO_ORDER`; the stream index. */
function streamIndex(id: DevSpeciesId): number {
  return DEV_TRIO_ORDER.indexOf(id);
}

function movementStream(seed: number, id: DevSpeciesId): () => number {
  return seededRandom(seed + MOVEMENT_SEED_OFFSET + streamIndex(id));
}

function blinkStream(seed: number, id: DevSpeciesId): () => number {
  return seededRandom(seed + BLINK_SEED_OFFSET + streamIndex(id));
}

/**
 * Visibility for every species after applying a solo preset. `null` shows the
 * whole trio; a species id leaves exactly that one visible. Ids a caller omits
 * stay visible, so the map is always total.
 */
export function applySolo(
  solo: DevSpeciesId | null,
  ids: readonly DevSpeciesId[],
): Record<DevSpeciesId, boolean> {
  const visible: Record<DevSpeciesId, boolean> = { trike: true, stego: true, brachio: true };
  for (const id of ids) {
    visible[id] = solo === null || id === solo;
  }
  return visible;
}

/** What the frame hook should do for one animation frame while paused/stepping. */
export interface PausedFrameDecision {
  /** Pause state to keep after this frame. */
  paused: boolean;
  /** Frames still queued; `step(n)` decrements once per advanced frame. */
  stepFrames: number;
  /** True when the simulation may advance this frame. */
  advance: boolean;
}

/**
 * One pause/step transition (FR-3): running always advances, a paused frame
 * advances only while frames are queued, and `step(n)` therefore advances
 * exactly `n` frames before pausing again. Inputs are never mutated.
 */
export function nextPausedFrame(paused: boolean, stepFrames: number): PausedFrameDecision {
  const queued = Number.isFinite(stepFrames) ? Math.max(0, Math.floor(stepFrames)) : 0;
  if (!paused) {
    return { paused: false, stepFrames: 0, advance: true };
  }
  if (queued > 0) {
    return { paused: true, stepFrames: queued - 1, advance: true };
  }
  return { paused: true, stepFrames: 0, advance: false };
}

/** How far a visit-targeted step has got; carried from frame to frame. */
export interface VisitStepProgress {
  /** True once the animal has been seen in the target state. Sticky. */
  reached: boolean;
  /** Frames the seek may still spend before giving up. */
  budget: number;
  /** Frames still to advance *after* the target was reached. */
  extra: number;
}

/** What one frame of a visit-targeted step should do. */
export interface VisitStepDecision extends VisitStepProgress {
  /** True when the simulation may advance this frame. */
  advance: boolean;
  /** True when the step is over and its caller may be answered. */
  done: boolean;
}

/** Clamp a frame count to a whole number of frames, never negative. */
function frames(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * One frame of "step until this animal is in that state" (FR-14, AC-14).
 *
 * A capture cannot guess how many frames an approach takes — it depends on
 * where the animal started and how it steered — so the queue runs until the
 * director reports the state instead of until a number runs out. `budget`
 * bounds the wait (a missing rig or a refused call can never hang a caller),
 * and `extra` then runs on past the transition so a caller can land *inside* a
 * dwell rather than on its first frame.
 *
 * The state is read before the frame advances, so the moment the target is
 * seen the simulation stops: the caller's next screenshot is the frame the
 * state was entered on, not one beyond it. Inputs are copied, never mutated.
 */
export function nextVisitStep(
  current: VisitState | 'unknown' | null,
  target: VisitState,
  progress: VisitStepProgress,
): VisitStepDecision {
  const budget = frames(progress.budget);
  const extra = frames(progress.extra);
  if (progress.reached || current === target) {
    if (extra > 0) {
      return { advance: true, done: false, reached: true, budget, extra: extra - 1 };
    }
    return { advance: false, done: true, reached: true, budget, extra: 0 };
  }
  if (budget > 0) {
    return { advance: true, done: false, reached: false, budget: budget - 1, extra };
  }
  return { advance: false, done: true, reached: false, budget: 0, extra };
}

/** One dino's live ground state, as the overlay projection needs it. */
export interface OverlayDino {
  id: DevSpeciesId;
  visible: boolean;
  x: number;
  z: number;
  heading: number;
}

/** Ring centre plus heading arrow yaw for one visible dino (FR-6). */
export interface OverlayTransform {
  id: DevSpeciesId;
  ringX: number;
  ringZ: number;
  arrowYaw: number;
}

/**
 * Project live dino state into overlay transforms (FR-6, AC-7): the avoidance
 * ring sits under the model on the ground plane and the heading arrow shares
 * that centre with the player's yaw. Hidden dinos produce no transform, so
 * their ring and arrow stay off. Inputs are copied, never mutated.
 */
export function overlayTransforms(dinos: readonly OverlayDino[]): OverlayTransform[] {
  return dinos
    .filter((dino) => dino.visible)
    .map((dino) => ({
      id: dino.id,
      ringX: dino.x,
      ringZ: dino.z,
      arrowYaw: dino.heading,
    }));
}

/**
 * HUD line (FR-4): rounded fps, the frame time it implies, renderer draw
 * calls and triangles for the last rendered frame. A dead or invalid fps
 * renders a dash instead of `Infinity ms`.
 */
export function formatHud(fps: number, drawCalls: number, triangles: number): string {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 0;
  const frameMs = safeFps > 0 ? (1000 / safeFps).toFixed(1) : '—';
  const calls = Number.isFinite(drawCalls) ? Math.round(drawCalls) : 0;
  const tris = Number.isFinite(triangles) ? Math.round(triangles) : 0;
  return `${Math.round(safeFps)} fps · ${frameMs} ms · ${calls} calls · ${tris} tris`;
}
