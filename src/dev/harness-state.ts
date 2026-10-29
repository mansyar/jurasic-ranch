/**
 * Pure dev-harness logic (FR-2, FR-3, FR-4): visibility presets, pause/step
 * transitions and the HUD string. No `three` and no DOM, so the panel's
 * decisions are unit-testable without WebGL.
 */

import type { DevSpeciesId } from "./dev-options.js";

/** Fixed simulation delta per stepped frame (1/60 s, spec assumption). */
export const DEV_STEP_DT_SECONDS = 1 / 60;

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

/**
 * HUD line (FR-4): rounded fps, the frame time it implies, renderer draw
 * calls and triangles for the last rendered frame. A dead or invalid fps
 * renders a dash instead of `Infinity ms`.
 */
export function formatHud(fps: number, drawCalls: number, triangles: number): string {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 0;
  const frameMs = safeFps > 0 ? (1000 / safeFps).toFixed(1) : "—";
  const calls = Number.isFinite(drawCalls) ? Math.round(drawCalls) : 0;
  const tris = Number.isFinite(triangles) ? Math.round(triangles) : 0;
  return `${Math.round(safeFps)} fps · ${frameMs} ms · ${calls} calls · ${tris} tris`;
}
