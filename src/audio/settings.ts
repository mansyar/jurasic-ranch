/**
 * Persisted sound settings (FR-6, FR-7, FR-12). Reads and writes reuse the
 * IndexedDB stub, which already swallows storage failures, and every exported
 * helper adds its own guard so a private-mode tablet keeps working from the
 * in-memory defaults instead of throwing during boot or a tap.
 */

import { DEFAULT_VOLUME, clampVolume } from './mix.js';
import { readSetting, writeSetting } from '../viewer/storage.js';

/** Setting key that remembers the mute button across reloads (FR-6). */
export const AUDIO_MUTED_KEY = 'audio-muted';

/** Setting key that remembers the master volume across reloads (FR-7). */
export const AUDIO_VOLUME_KEY = 'audio-volume';

/** The persisted sound state the viewer boots with. */
export interface AudioSettings {
  muted: boolean;
  volume: number;
}

/** Read both sound settings, falling back to `false` and `DEFAULT_VOLUME`. */
export async function loadAudioSettings(): Promise<AudioSettings> {
  const [muted, volume] = await Promise.all([
    readSetting(AUDIO_MUTED_KEY).catch(() => undefined),
    readSetting(AUDIO_VOLUME_KEY).catch(() => undefined),
  ]);
  return {
    muted: typeof muted === 'boolean' ? muted : false,
    volume: typeof volume === 'number' ? clampVolume(volume) : DEFAULT_VOLUME,
  };
}

/** Persist the mute state; a storage failure is silence, never a throw. */
export async function saveMuted(muted: boolean): Promise<void> {
  try {
    await writeSetting(AUDIO_MUTED_KEY, muted === true);
  } catch {
    /* IndexedDB unavailable: the in-memory state stays authoritative. */
  }
}

/** Persist a clamped master volume; a storage failure is silence, never a throw. */
export async function saveVolume(volume: number): Promise<void> {
  try {
    await writeSetting(AUDIO_VOLUME_KEY, clampVolume(volume));
  } catch {
    /* IndexedDB unavailable: the in-memory state stays authoritative. */
  }
}
