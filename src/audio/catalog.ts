/**
 * The typed audio catalog (FR-1): one place that names every mp3 the ranch
 * ships. Paths are deploy-relative (`audio/...`, no leading slash) and resolve
 * through `assetUrl`, so a future sub-path deploy keeps working. Pure data: the
 * module never imports the audio library or touches the DOM, so tests and the
 * mixer can read it cheaply.
 */

/** Bus an asset plays on: the kalimba loop, one-shot SFX, or spoken lines. */
export type AudioBus = 'music' | 'sfx' | 'voice';

/** One starter-pack asset. */
export interface AudioAsset {
  readonly id: string;
  readonly bus: AudioBus;
  /** Deploy-relative mp3 path, resolved by `assetUrl`. */
  readonly path: string;
  readonly loop: boolean;
  /** Per-asset trim in 0..1. Bus gains live in `mix.ts`. */
  readonly gain: number;
  /** Measured length in seconds, rounded up so it never undercuts the file. */
  readonly durationSeconds: number;
}

/**
 * The 15-asset starter pack, grouped by bus: one kalimba loop, six one-shot
 * SFX, eight voice lines. `durationSeconds` is the measured length of the
 * shipped file rounded up to the next centisecond, so a duck timer or overlap
 * budget never cuts a line short.
 */
export const AUDIO_CATALOG = [
  {
    id: 'music-kalimba',
    bus: 'music',
    path: 'audio/music/kalimba-loop.mp3',
    loop: true,
    gain: 1,
    durationSeconds: 40,
  },
  {
    id: 'coo-trike',
    bus: 'sfx',
    path: 'audio/sfx/coo-trike.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 1,
  },
  {
    id: 'coo-stego',
    bus: 'sfx',
    path: 'audio/sfx/coo-stego.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 1.2,
  },
  {
    id: 'coo-brachio',
    bus: 'sfx',
    path: 'audio/sfx/coo-brachio.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 1.4,
  },
  {
    id: 'tap',
    bus: 'sfx',
    path: 'audio/sfx/tap.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.18,
  },
  {
    id: 'heart',
    bus: 'sfx',
    path: 'audio/sfx/heart.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.75,
  },
  {
    id: 'sparkle',
    bus: 'sfx',
    path: 'audio/sfx/sparkle.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.9,
  },
  {
    id: 'hello',
    bus: 'voice',
    path: 'audio/voice/hello.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.93,
  },
  {
    id: 'nom',
    bus: 'voice',
    path: 'audio/voice/nom.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 1.12,
  },
  {
    id: 'all-done',
    bus: 'voice',
    path: 'audio/voice/all-done.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 1.02,
  },
  {
    id: 'count-1',
    bus: 'voice',
    path: 'audio/voice/count-1.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.79,
  },
  {
    id: 'count-2',
    bus: 'voice',
    path: 'audio/voice/count-2.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.85,
  },
  {
    id: 'count-3',
    bus: 'voice',
    path: 'audio/voice/count-3.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.85,
  },
  {
    id: 'count-4',
    bus: 'voice',
    path: 'audio/voice/count-4.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.86,
  },
  {
    id: 'count-5',
    bus: 'voice',
    path: 'audio/voice/count-5.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.91,
  },
] as const satisfies readonly AudioAsset[];

/** Id of any catalog entry; ids outside the pack fail at compile time. */
export type AudioAssetId = (typeof AUDIO_CATALOG)[number]['id'];

/**
 * Catalog entry for `id`, or `undefined` when the id is outside the pack.
 * Callers degrade to silence instead of throwing (FR-9).
 */
export function getAudioAsset(id: string): AudioAsset | undefined {
  return AUDIO_CATALOG.find((asset) => asset.id === id);
}

/**
 * URL for a deploy-relative asset path under Vite's base. The base is
 * normalised to a single trailing slash and any leading slash on `path` is
 * dropped, so `'/'`, `'/ranch/'`, and `'/ranch'` all join without doubling.
 * The result is a plain path, ready for a Howler `src`.
 */
export function assetUrl(path: string, baseUrl: string = import.meta.env.BASE_URL): string {
  const relative = path.startsWith('/') ? path.slice(1) : path;
  const base = baseUrl === '' || baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${relative}`;
}
