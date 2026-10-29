import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VOLUME,
  DUCK_FACTOR,
  MUSIC_BUS_GAIN,
  SFX_OVERLAP_CAP,
  VOICE_TAIL_SECONDS,
  canPlaySfx,
  clampVolume,
  duckGain,
  musicGain,
} from '../../src/audio/mix.js';

describe('mix defaults (FR-5, FR-6, FR-7)', () => {
  it('ships the tuned bus gains and budget defaults', () => {
    expect(DEFAULT_VOLUME).toBe(0.8);
    expect(MUSIC_BUS_GAIN).toBe(0.1);
    expect(DUCK_FACTOR).toBe(0.35);
    expect(VOICE_TAIL_SECONDS).toBe(0.3);
    expect(SFX_OVERLAP_CAP).toBe(4);
  });

  it('puts the music bus about 20 dB under voice', () => {
    expect(20 * Math.log10(MUSIC_BUS_GAIN)).toBeCloseTo(-20, 10);
  });
});

describe('clampVolume (FR-7, AC-7)', () => {
  it('passes through volumes already inside 0..1', () => {
    expect(clampVolume(0)).toBe(0);
    expect(clampVolume(0.42)).toBe(0.42);
    expect(clampVolume(1)).toBe(1);
  });

  it('clamps out-of-range volumes to the nearest bound', () => {
    expect(clampVolume(-0.5)).toBe(0);
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(clampVolume(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('falls back to the default for NaN instead of silencing the ranch', () => {
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_VOLUME);
  });
});

describe('musicGain (FR-3, FR-5, FR-6)', () => {
  it('is silent when muted, whatever the volume or duck state', () => {
    expect(musicGain(0.8, true, false)).toBe(0);
    expect(musicGain(1, true, true)).toBe(0);
    expect(musicGain(0, true, false)).toBe(0);
  });

  it('applies the master volume and the music bus trim', () => {
    expect(musicGain(1, false, false)).toBeCloseTo(0.1, 12);
    expect(musicGain(0.8, false, false)).toBeCloseTo(0.08, 12);
    expect(musicGain(0.5, false, false)).toBeCloseTo(0.05, 12);
  });

  it('applies live volume changes, clamped to 0..1', () => {
    expect(musicGain(0.3, false, false)).toBeCloseTo(0.03, 12);
    expect(musicGain(0.8, false, false)).toBeCloseTo(0.08, 12);
    expect(musicGain(1.4, false, false)).toBeCloseTo(0.1, 12);
    expect(musicGain(-1, false, false)).toBe(0);
  });

  it('ducks to 0.35x during a line and restores exactly afterwards', () => {
    const playing = musicGain(DEFAULT_VOLUME, false, false);
    const ducked = musicGain(DEFAULT_VOLUME, false, true);
    expect(ducked).toBeCloseTo(playing * DUCK_FACTOR, 12);
    expect(ducked).toBeLessThan(playing);
    expect(musicGain(DEFAULT_VOLUME, false, false)).toBe(playing);
  });

  it('drops straight to zero when mute flips mid-line', () => {
    expect(musicGain(DEFAULT_VOLUME, true, true)).toBe(0);
  });
});

describe('duckGain (FR-5)', () => {
  it('is the full music level normally and DUCK_FACTOR while speaking', () => {
    expect(duckGain(false)).toBe(1);
    expect(duckGain(true)).toBe(DUCK_FACTOR);
  });

  it('cannot compound when a second line starts', () => {
    // Ducking is a named boolean state, not a multiplier the caller pushes.
    const duckedOnce = musicGain(DEFAULT_VOLUME, false, true);
    const duckedAgain = musicGain(DEFAULT_VOLUME, false, true);
    expect(duckedAgain).toBe(duckedOnce);
    expect(duckedAgain).toBeGreaterThan(0);
  });
});

describe('canPlaySfx (FR-4, AC-4)', () => {
  it('allows another instance while under the cap', () => {
    for (let active = 0; active < SFX_OVERLAP_CAP; active += 1) {
      expect(canPlaySfx(active)).toBe(true);
    }
  });

  it('drops taps at the cap instead of queueing them', () => {
    expect(canPlaySfx(SFX_OVERLAP_CAP)).toBe(false);
    expect(canPlaySfx(SFX_OVERLAP_CAP + 5)).toBe(false);
  });

  it('caps overlap at four one-shots', () => {
    expect(SFX_OVERLAP_CAP).toBe(4);
  });
});
