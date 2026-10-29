/**
 * Deterministic RNG for the dev harness (FR-8): mulberry32 replays wander
 * jitter and dust for a given `?seed=`, including seed 0.
 */

const UINT32_MODULUS = 4294967296;
const MULBERRY_INCREMENT = 0x6d2b79f5;

/**
 * Create a mulberry32 generator returning floats in `[0, 1)`. The same seed
 * always yields the same stream; different seeds differ. Non-finite seeds fall
 * back to 0 so the stream is never NaN.
 */
export function seededRandom(seed: number): () => number {
  let state = (Number.isFinite(seed) ? Math.trunc(seed) : 0) >>> 0;
  return () => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_MODULUS;
  };
}
