/** Pixel-ratio helpers (NFR-1: renderer pixel ratio is capped). */

/** Maximum renderer pixel ratio; higher values cost frames on tablets. */
export const MAX_PIXEL_RATIO = 2;

/** Safe fallback when no usable device pixel ratio is reported. */
export const FALLBACK_PIXEL_RATIO = 1;

/**
 * Clamp a device pixel ratio into the range the renderer supports.
 * Non-numeric, non-finite, and sub-1 values fall back to 1; anything
 * above the cap returns the cap.
 */
export function resolvePixelRatio(devicePixelRatio: unknown): number {
  if (typeof devicePixelRatio !== 'number') {
    return FALLBACK_PIXEL_RATIO;
  }
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio < 1) {
    return FALLBACK_PIXEL_RATIO;
  }
  return Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
}
