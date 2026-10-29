/**
 * Pure mix math for the three audio buses (FR-5, FR-6, FR-7). Every function is
 * total and side-effect free: no Howler, no DOM, no timers. The engine reads
 * these values when it sets a Howl's volume, so mute, master volume, ducking,
 * and the SFX overlap cap are provable in unit tests without a browser.
 */

/** Master volume used when settings are missing or unreadable (FR-7). */
export const DEFAULT_VOLUME = 0.8;

/** Music bus trim: 0.1 is approx -20 dB under the voice bus (FR-3, NFR-3). */
export const MUSIC_BUS_GAIN = 0.1;

/** Music multiplier while a voice line speaks (FR-5). */
export const DUCK_FACTOR = 0.35;

/**
 * Documentation of the 0.3 s silence baked into each voice mp3, in seconds.
 * The engine does not read it: music restores on the line's `end` event, after
 * that baked-in tail has already played.
 */
export const VOICE_TAIL_SECONDS = 0.3;

/** Distinct SFX instances allowed to overlap; later taps are dropped (FR-4). */
export const SFX_OVERLAP_CAP = 4;

/**
 * Clamp a master volume into 0..1. NaN (a corrupt stored value) falls back to
 * the default instead of silencing the ranch through a NaN gain.
 */
export function clampVolume(volume: number): number {
  if (Number.isNaN(volume)) {
    return DEFAULT_VOLUME;
  }
  return Math.min(Math.max(volume, 0), 1);
}

/** Music multiplier for the duck state: 1 normally, DUCK_FACTOR while speaking. */
export function duckGain(ducked: boolean): number {
  return ducked ? DUCK_FACTOR : 1;
}

/**
 * Final music gain: silent when muted, otherwise the clamped master volume
 * times the music bus trim, ducked under a voice line (FR-3, FR-5, FR-6).
 */
export function musicGain(volume: number, muted = false, ducked = false): number {
  if (muted) {
    return 0;
  }
  return clampVolume(volume) * MUSIC_BUS_GAIN * duckGain(ducked);
}

/** Whether one more SFX instance may start; at the cap, taps are dropped (FR-4). */
export function canPlaySfx(activeCount: number): boolean {
  return activeCount < SFX_OVERLAP_CAP;
}
