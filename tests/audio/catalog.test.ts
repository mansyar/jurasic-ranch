import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { AUDIO_CATALOG, assetUrl, getAudioAsset } from '../../src/audio/catalog.js';

const ROOT_URL = new URL('../../', import.meta.url);

const SFX_IDS = ['coo-trike', 'coo-stego', 'coo-brachio', 'tap', 'heart', 'sparkle'];
const VOICE_IDS = [
  'hello',
  'nom',
  'all-done',
  'count-1',
  'count-2',
  'count-3',
  'count-4',
  'count-5',
];

function idsOn(bus: string): string[] {
  return AUDIO_CATALOG.filter((asset) => asset.bus === bus).map((asset) => asset.id);
}

describe('audio catalog shape (FR-1, AC-1)', () => {
  it('ships exactly 1 music, 6 SFX, and 8 voice entries', () => {
    expect(AUDIO_CATALOG).toHaveLength(15);
    expect(idsOn('music')).toHaveLength(1);
    expect(idsOn('sfx')).toHaveLength(6);
    expect(idsOn('voice')).toHaveLength(8);
  });

  it('has unique ids across the whole pack', () => {
    const ids = AUDIO_CATALOG.map((asset) => asset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares the spec ids on each bus', () => {
    expect(idsOn('music')).toEqual(['music-kalimba']);
    expect(idsOn('sfx')).toEqual(SFX_IDS);
    expect(idsOn('voice')).toEqual(VOICE_IDS);
  });

  it('loops only the music entry', () => {
    const looping = AUDIO_CATALOG.filter((asset) => asset.loop).map((asset) => asset.id);
    expect(looping).toEqual(['music-kalimba']);
    for (const asset of AUDIO_CATALOG.filter((entry) => entry.bus !== 'music')) {
      expect(asset.loop).toBe(false);
    }
  });

  it('keeps declared durations inside the spec budgets', () => {
    const music = getAudioAsset('music-kalimba');
    expect(music?.durationSeconds).toBeGreaterThanOrEqual(30);
    expect(music?.durationSeconds).toBeLessThanOrEqual(60);
    for (const asset of AUDIO_CATALOG.filter((entry) => entry.bus !== 'music')) {
      expect(asset.durationSeconds).toBeGreaterThan(0);
      expect(asset.durationSeconds).toBeLessThanOrEqual(2);
    }
  });

  it('keeps paths deploy-relative and grouped by bus', () => {
    expect(getAudioAsset('music-kalimba')?.path).toBe('audio/music/kalimba-loop.mp3');
    for (const asset of AUDIO_CATALOG) {
      expect(asset.path.startsWith('/')).toBe(false);
      expect(asset.path.endsWith('.mp3')).toBe(true);
    }
    for (const asset of AUDIO_CATALOG.filter((entry) => entry.bus !== 'music')) {
      expect(asset.path).toBe(`audio/${asset.bus}/${asset.id}.mp3`);
    }
  });

  it('keeps every per-asset trim inside 0..1', () => {
    for (const asset of AUDIO_CATALOG) {
      expect(asset.gain).toBeGreaterThanOrEqual(0);
      expect(asset.gain).toBeLessThanOrEqual(1);
    }
  });
});

describe('getAudioAsset (FR-1)', () => {
  it('finds assets by id on every bus', () => {
    expect(getAudioAsset('music-kalimba')?.bus).toBe('music');
    expect(getAudioAsset('tap')?.bus).toBe('sfx');
    expect(getAudioAsset('count-5')?.bus).toBe('voice');
  });

  it('returns undefined for unknown ids instead of throwing', () => {
    expect(getAudioAsset('coo-sauropod')).toBeUndefined();
    expect(getAudioAsset('')).toBeUndefined();
    expect(getAudioAsset('TAP')).toBeUndefined();
  });
});

describe('assetUrl (FR-1, sub-path safety)', () => {
  it('joins the catalog path onto the deploy base without doubling slashes', () => {
    expect(assetUrl('audio/sfx/tap.mp3', '/')).toBe('/audio/sfx/tap.mp3');
    expect(assetUrl('audio/sfx/tap.mp3', '/ranch/')).toBe('/ranch/audio/sfx/tap.mp3');
    expect(assetUrl('audio/sfx/tap.mp3', '/ranch')).toBe('/ranch/audio/sfx/tap.mp3');
  });

  it('does not invent a leading slash for a relative base', () => {
    expect(assetUrl('audio/sfx/tap.mp3', '')).toBe('audio/sfx/tap.mp3');
    expect(assetUrl('audio/sfx/tap.mp3', './')).toBe('./audio/sfx/tap.mp3');
  });

  it('tolerates a leading slash in the asset path', () => {
    expect(assetUrl('/audio/sfx/tap.mp3', '/ranch/')).toBe('/ranch/audio/sfx/tap.mp3');
  });

  it('defaults to the Vite base URL', () => {
    const base = import.meta.env.BASE_URL;
    expect(assetUrl('audio/voice/hello.mp3')).toBe(`${base}audio/voice/hello.mp3`);
  });

  it('produces a usable url for every catalog entry', () => {
    for (const asset of AUDIO_CATALOG) {
      const url = assetUrl(asset.path);
      expect(url.startsWith('//')).toBe(false);
      expect(url).toContain(asset.path);
    }
  });
});

describe('catalog stays pure (NFR-5)', () => {
  it('never imports Howler or reaches for the DOM', async () => {
    for (const file of ['catalog.ts', 'mix.ts']) {
      const source = await readFile(new URL(`src/audio/${file}`, ROOT_URL), 'utf8');
      expect(source).not.toMatch(/from\s+['"]howler['"]/);
      expect(source).not.toMatch(/new\s+Howl\b/);
      expect(source).not.toMatch(/AudioContext/);
      expect(source).not.toMatch(/document\./);
      expect(source).not.toMatch(/window\./);
      expect(source).not.toMatch(/setTimeout|setInterval/);
    }
  });
});
