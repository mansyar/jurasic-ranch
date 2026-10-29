import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VOLUME } from '../../src/audio/mix.js';
import {
  AUDIO_MUTED_KEY,
  AUDIO_VOLUME_KEY,
  loadAudioSettings,
  saveMuted,
  saveVolume,
} from '../../src/audio/settings.js';

/**
 * Persisted sound settings (FR-6, FR-7, FR-12). `../viewer/storage.js` is
 * mocked, so no test touches IndexedDB, and the failure cases prove boot and
 * taps fall back to in-memory defaults instead of throwing.
 */

const storage = vi.hoisted(() => ({
  readSetting: vi.fn(),
  writeSetting: vi.fn(),
}));

vi.mock('../../src/viewer/storage.js', () => storage);

beforeEach(() => {
  storage.readSetting.mockReset();
  storage.writeSetting.mockReset();
  storage.readSetting.mockResolvedValue(undefined);
  storage.writeSetting.mockResolvedValue(undefined);
});

describe('loadAudioSettings (FR-6, FR-7, FR-12)', () => {
  it('reads both keys and defaults to unmuted at 0.8', async () => {
    await expect(loadAudioSettings()).resolves.toEqual({ muted: false, volume: DEFAULT_VOLUME });
    expect(storage.readSetting).toHaveBeenCalledWith(AUDIO_MUTED_KEY);
    expect(storage.readSetting).toHaveBeenCalledWith(AUDIO_VOLUME_KEY);
    expect(storage.readSetting).toHaveBeenCalledTimes(2);
  });

  it('restores a persisted mute and volume', async () => {
    storage.readSetting.mockImplementation((key: string): Promise<unknown> =>
      Promise.resolve(key === AUDIO_MUTED_KEY ? true : 0.35),
    );
    await expect(loadAudioSettings()).resolves.toEqual({ muted: true, volume: 0.35 });
  });

  it('treats a non-boolean mute and a non-numeric volume as defaults', async () => {
    storage.readSetting.mockImplementation((key: string): Promise<unknown> =>
      Promise.resolve(key === AUDIO_MUTED_KEY ? 'yes' : '0.5'),
    );
    await expect(loadAudioSettings()).resolves.toEqual({ muted: false, volume: DEFAULT_VOLUME });
  });

  it('clamps an out-of-range volume and keeps zero usable', async () => {
    storage.readSetting.mockImplementation((key: string): Promise<unknown> =>
      Promise.resolve(key === AUDIO_MUTED_KEY ? 0 : key === AUDIO_VOLUME_KEY ? 1.7 : undefined),
    );
    await expect(loadAudioSettings()).resolves.toMatchObject({ volume: 1 });

    storage.readSetting.mockImplementation((key: string): Promise<unknown> =>
      Promise.resolve(key === AUDIO_VOLUME_KEY ? -0.4 : undefined),
    );
    await expect(loadAudioSettings()).resolves.toMatchObject({ volume: 0 });

    storage.readSetting.mockImplementation((key: string): Promise<unknown> =>
      Promise.resolve(key === AUDIO_VOLUME_KEY ? Number.NaN : undefined),
    );
    await expect(loadAudioSettings()).resolves.toMatchObject({ volume: DEFAULT_VOLUME });
  });

  it('falls back per key when one read rejects', async () => {
    storage.readSetting.mockImplementation((key: string): Promise<unknown> =>
      key === AUDIO_MUTED_KEY ? Promise.reject(new Error('blocked')) : Promise.resolve(0.4),
    );
    await expect(loadAudioSettings()).resolves.toEqual({ muted: false, volume: 0.4 });
  });

  it('falls back to defaults when both reads reject', async () => {
    storage.readSetting.mockRejectedValue(new Error('private mode'));
    await expect(loadAudioSettings()).resolves.toEqual({ muted: false, volume: DEFAULT_VOLUME });
  });
});

describe('saveMuted / saveVolume (FR-6, FR-7, FR-12)', () => {
  it('writes the mute state under the muted key', async () => {
    await saveMuted(true);
    expect(storage.writeSetting).toHaveBeenCalledWith(AUDIO_MUTED_KEY, true);

    await saveMuted(false);
    expect(storage.writeSetting).toHaveBeenLastCalledWith(AUDIO_MUTED_KEY, false);
  });

  it('writes a clamped volume under the volume key', async () => {
    await saveVolume(0.55);
    expect(storage.writeSetting).toHaveBeenCalledWith(AUDIO_VOLUME_KEY, 0.55);

    await saveVolume(2);
    expect(storage.writeSetting).toHaveBeenLastCalledWith(AUDIO_VOLUME_KEY, 1);

    await saveVolume(-1);
    expect(storage.writeSetting).toHaveBeenLastCalledWith(AUDIO_VOLUME_KEY, 0);

    await saveVolume(Number.NaN);
    expect(storage.writeSetting).toHaveBeenLastCalledWith(AUDIO_VOLUME_KEY, DEFAULT_VOLUME);
  });

  it('never rejects when the write fails', async () => {
    storage.writeSetting.mockRejectedValue(new Error('quota'));
    await expect(saveMuted(true)).resolves.toBeUndefined();
    await expect(saveVolume(0.2)).resolves.toBeUndefined();
  });
});
