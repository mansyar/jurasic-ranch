/**
 * Howler-backed audio engine (FR-2..FR-5, FR-9, NFR-7). Importing this module
 * is silent and server-safe: Howler is only reached through the injectable
 * `load` callback, and no `Howl` or `AudioContext` exists until `unlock()` runs
 * from the first pointerdown/keydown. Every public call degrades to a no-op
 * before unlock or after a failed load, so boot can never block on audio.
 */

import { AUDIO_CATALOG, assetUrl, getAudioAsset, type AudioBus } from './catalog.js';
import { DEFAULT_VOLUME, canPlaySfx, clampVolume, musicGain } from './mix.js';

/** Music fade-in budget from the spec: <=400 ms (FR-3). */
export const MUSIC_FADE_IN_MS = 400;

/** Howl options the engine sets; a subset of the Howler surface it relies on. */
export interface HowlOptionsLike {
  src: string[];
  loop: boolean;
  preload: boolean;
  html5: boolean;
  volume?: number;
  onend?: (soundId: number) => void;
  onstop?: (soundId: number) => void;
  onloaderror?: (soundId: number) => void;
  onplay?: (soundId: number) => void;
}

/** The Howl calls the engine makes; structural so tests can pass a fake. */
export interface HowlLike {
  play(id?: number): number;
  pause(id?: number): void;
  stop(id?: number): void;
  volume(value: number): void;
  fade(from: number, to: number, duration: number, id?: number): void;
  unload(): void;
}

/** The AudioContext calls the engine makes on resume after device sleep. */
export interface HowlerContextLike {
  readonly state: string;
  resume(): Promise<void>;
}

/** The global Howler calls the engine makes. */
export interface HowlerLike {
  readonly ctx?: HowlerContextLike | null;
  mute(muted: boolean): void;
  volume(volume: number): void;
  stop(): void;
  unload(): void;
}

/** The injected Howler module shape. */
export interface HowlerModuleLike {
  readonly Howl: new (options: HowlOptionsLike) => HowlLike;
  readonly Howler: HowlerLike;
}

/** Loader injected by tests so no real audio module is ever imported. */
export type HowlerLoader = () => Promise<HowlerModuleLike>;

/** Engine collaborators. Phase 4 supplies the persisted mute and volume. */
export interface AudioEngineOptions {
  load?: HowlerLoader;
  /** Current persisted mute, resolved before music starts (FR-2 edge case). */
  getMuted?: () => boolean;
  /** Current persisted master volume (FR-7). */
  getVolume?: () => number;
}

/** Lazy default loader: the real Howler module is fetched only on unlock. */
async function loadHowlerModule(): Promise<HowlerModuleLike> {
  const module = await import('howler');
  return { Howl: module.Howl, Howler: module.Howler };
}

/** Id of the single music asset, or `null` if the catalog ever drops it. */
function musicAssetId(): string | null {
  const music = AUDIO_CATALOG.find((asset) => asset.bus === 'music');
  return music === undefined ? null : music.id;
}

/** One-shot bookkeeping key: sound ids are unique per Howl, not globally. */
function sfxKey(assetId: string, soundId: number): string {
  return `${assetId}#${soundId}`;
}

/**
 * The three-bus engine: one looping music Howl, six one-shot SFX, eight voice
 * lines. Music carries the bus trim and duck factor, while the master volume
 * rides on Howler's global gain, so a volume change never touches the duck.
 */
export class AudioEngine {
  private readonly load: HowlerLoader;
  private getMuted: () => boolean;
  private getVolume: () => number;
  private readonly musicId: string | null;

  private howler: HowlerModuleLike | null = null;
  private howls = new Map<string, HowlLike>();
  private unlockPromise: Promise<void> | null = null;
  private loadFailed = false;
  private unlockedFlag = false;

  private mutedFlag = false;
  private volumeValue = DEFAULT_VOLUME;
  private ducked = false;
  private hidden = false;

  private musicSoundId: number | null = null;
  private musicPlayingFlag = false;
  private voiceId: string | null = null;
  private voiceSoundId: number | null = null;
  private voiceRequestedAtMs: number | null = null;
  private latencyMs = 0;
  private readonly activeSfx = new Set<string>();
  private readonly failed = new Set<string>();

  private readonly warned = new Set<string>();

  constructor(options: AudioEngineOptions = {}) {
    this.load = options.load ?? loadHowlerModule;
    this.getMuted = options.getMuted ?? ((): boolean => false);
    this.getVolume = options.getVolume ?? ((): number => DEFAULT_VOLUME);
    this.musicId = musicAssetId();
  }

  /**
   * Late-bind the persisted mute/volume providers (FR-6, FR-7). Boot installs
   * the gesture guard before the settings read, so the singleton can exist
   * before its providers do.
   */
  configure(options: AudioEngineOptions): void {
    if (options.getMuted !== undefined) {
      this.getMuted = options.getMuted;
    }
    if (options.getVolume !== undefined) {
      this.getVolume = options.getVolume;
    }
    this.mutedFlag = this.getMuted();
    this.volumeValue = clampVolume(this.getVolume());
    if (this.unlockedFlag) {
      this.applyMasterGain();
      this.applyMusicGain();
    }
  }

  /** Whether the first gesture finished unlocking audio. */
  get unlocked(): boolean {
    return this.unlockedFlag;
  }

  /** Whether the user muted the ranch. */
  get muted(): boolean {
    return this.mutedFlag;
  }

  /** Current clamped master volume (0..1). */
  get volume(): number {
    return this.volumeValue;
  }

  /** Whether the music loop is currently running (not paused or muted). */
  get musicPlaying(): boolean {
    return this.musicPlayingFlag;
  }

  /** Catalog id of the voice line currently ducking the music, or `null`. */
  get activeVoiceId(): string | null {
    return this.voiceId;
  }

  /**
   * Wall-clock time from the last `playVoice` request to Howler's `play` event:
   * the moment the line actually starts, not the synchronous `Howl.play` call.
   * It resets to 0 on `stopAll` and `dispose`.
   */
  get lastStartLatencyMs(): number {
    return this.latencyMs;
  }

  /**
   * Build the pack on the first gesture. Idempotent, never rejects, and warns
   * once if Howler is unavailable so the gesture handler has nothing to catch.
   */
  unlock(): Promise<void> {
    if (this.unlockedFlag || this.loadFailed) {
      return Promise.resolve();
    }
    this.unlockPromise ??= this.start();
    return this.unlockPromise;
  }

  /** Start or resume the loop when unlocked, visible, and unmuted (FR-3). */
  playMusic(): void {
    if (!this.unlockedFlag || this.mutedFlag || this.hidden) {
      return;
    }
    const howl = this.musicHowl();
    if (howl === undefined) {
      return;
    }
    if (this.musicSoundId !== null) {
      // Resume the paused loop in place so a hidden tab does not restart it.
      howl.play(this.musicSoundId);
      howl.volume(this.musicTargetGain());
      this.musicPlayingFlag = true;
      return;
    }
    howl.volume(0);
    const soundId = howl.play();
    this.musicSoundId = soundId;
    howl.fade(0, this.musicTargetGain(), MUSIC_FADE_IN_MS, soundId);
    this.musicPlayingFlag = true;
  }

  /** Pause the loop without forgetting its position (hidden tab, mute). */
  pauseMusic(): void {
    if (!this.musicPlayingFlag) {
      return;
    }
    const howl = this.musicHowl();
    if (howl !== undefined) {
      howl.pause(this.musicSoundId ?? undefined);
    }
    this.musicPlayingFlag = false;
  }

  /** Play one one-shot SFX, dropping the tap above the overlap cap (FR-4). */
  playSfx(id: string): void {
    const howl = this.readyHowl(id, 'sfx');
    if (howl === undefined || !canPlaySfx(this.activeSfx.size)) {
      return;
    }
    const soundId = howl.play();
    this.activeSfx.add(sfxKey(id, soundId));
  }

  /** Play a voice line, stopping the previous one first (FR-5 newest wins). */
  playVoice(id: string): void {
    const howl = this.readyHowl(id, 'voice');
    if (howl === undefined) {
      return;
    }
    this.detachVoice();
    // Duck before the line starts so the first syllable is never drowned out.
    this.ducked = true;
    this.applyMusicGain();
    this.voiceRequestedAtMs = performance.now();
    this.latencyMs = 0;
    const soundId = howl.play();
    this.voiceId = id;
    this.voiceSoundId = soundId;
  }

  /**
   * Play any catalog id on its own bus (dev harness, FR-10). Unknown ids are
   * ignored; the bus comes from the catalog, never from the caller.
   */
  play(id: string): void {
    const asset = getAudioAsset(id);
    if (asset === undefined) {
      return;
    }
    if (asset.bus === 'music') {
      this.playMusic();
    } else if (asset.bus === 'voice') {
      this.playVoice(asset.id);
    } else {
      this.playSfx(asset.id);
    }
  }

  /** Stop music, voice, and every SFX instance (dev harness action). */
  stopAll(): void {
    this.howler?.Howler.stop();
    this.voiceId = null;
    this.voiceSoundId = null;
    this.voiceRequestedAtMs = null;
    this.musicSoundId = null;
    this.musicPlayingFlag = false;
    this.latencyMs = 0;
    this.activeSfx.clear();
    this.ducked = false;
    this.applyMusicGain();
  }

  /** Mute or unmute everything; muting also stops any active voice (FR-6). */
  setMuted(muted: boolean): void {
    if (this.mutedFlag === muted) {
      return;
    }
    this.mutedFlag = muted;
    this.applyMasterGain();
    if (muted) {
      this.stopVoice();
      this.pauseMusic();
    }
    this.applyMusicGain();
    if (!muted) {
      this.playMusic();
    }
  }

  /** Apply a clamped master volume through Howler's global gain (FR-7). */
  setVolume(volume: number): void {
    this.volumeValue = clampVolume(volume);
    this.applyMasterGain();
    this.applyMusicGain();
  }

  /** Pause/resume the loop across hidden-tab transitions (FR-3, NFR-7). */
  handleVisibility(hidden: boolean): void {
    this.hidden = hidden;
    if (hidden) {
      this.pauseMusic();
      return;
    }
    if (!this.unlockedFlag || this.mutedFlag) {
      return;
    }
    this.playMusic();
  }

  /** Resume a context the OS suspended after device sleep (NFR-7). */
  async resumeContext(): Promise<void> {
    const context = this.howler?.Howler.ctx;
    if (context === undefined || context === null || context.state !== 'suspended') {
      return;
    }
    try {
      await context.resume();
    } catch {
      /* The next gesture retries; a failed resume must stay silent. */
    }
  }

  /** Stop everything and release every Howl; used by the test reset helper. */
  dispose(): void {
    this.stopAll();
    for (const howl of this.howls.values()) {
      howl.unload();
    }
    this.howls.clear();
    this.howler?.Howler.unload();
    this.howler = null;
    this.unlockedFlag = false;
    this.unlockPromise = null;
    this.loadFailed = false;
    this.warned.clear();
    this.failed.clear();
  }

  /** Build the 15 Howls once, then start music unless the ranch is muted. */
  private async start(): Promise<void> {
    try {
      const howler = await this.load();
      // Resolve mute before any playback: the first gesture can be the future
      // mute button, and a music start before this read would blip.
      this.mutedFlag = this.getMuted();
      this.volumeValue = clampVolume(this.getVolume());
      const howls = new Map<string, HowlLike>();
      for (const asset of AUDIO_CATALOG) {
        const isMusic = asset.bus === 'music';
        howls.set(
          asset.id,
          new howler.Howl({
            src: [assetUrl(asset.path)],
            loop: asset.loop,
            preload: true,
            html5: false,
            volume: isMusic ? 0 : asset.gain,
            onend: (soundId) => {
              this.handleEnd(asset.id, asset.bus, soundId);
            },
            onstop: (soundId) => {
              this.handleStop(asset.id, asset.bus, soundId);
            },
            onloaderror: (soundId) => {
              this.warnAsset(asset.id, soundId);
            },
            onplay: (soundId) => {
              this.handlePlay(asset.bus, asset.id, soundId);
            },
          }),
        );
      }
      this.howler = howler;
      this.howls = howls;
      this.unlockedFlag = true;
      this.applyMasterGain();
      this.applyMusicGain();
      await this.resumeContext();
      this.playMusic();
    } catch (error: unknown) {
      this.loadFailed = true;
      this.warnOnce('engine', 'Audio engine unavailable; staying silent.', error);
    }
  }

  /** The music Howl, or `undefined` when locked, disposed, failed, or music-less. */
  private musicHowl(): HowlLike | undefined {
    if (this.musicId === null || this.failed.has(this.musicId)) {
      return undefined;
    }
    return this.howls.get(this.musicId);
  }

  /** A playable Howl for `id` on `bus`, or `undefined` when unusable. */
  private readyHowl(id: string, bus: AudioBus): HowlLike | undefined {
    if (!this.unlockedFlag || this.mutedFlag || this.failed.has(id)) {
      return undefined;
    }
    const asset = getAudioAsset(id);
    if (asset === undefined || asset.bus !== bus) {
      return undefined;
    }
    return this.howls.get(id);
  }

  /**
   * Music gain on the Howl itself: bus trim times the duck state. The master
   * volume is applied globally by `applyMasterGain`, so it is not multiplied in
   * here and a volume slider never writes the duck ratio.
   */
  private musicTargetGain(): number {
    return musicGain(1, this.mutedFlag, this.ducked);
  }

  private applyMasterGain(): void {
    const howler = this.howler;
    if (howler === null) {
      return;
    }
    howler.Howler.mute(this.mutedFlag);
    howler.Howler.volume(this.volumeValue);
  }

  private applyMusicGain(): void {
    this.musicHowl()?.volume(this.musicTargetGain());
  }

  /** Detach the current voice before stopping it so its stop cannot un-duck. */
  private detachVoice(): void {
    const previousId = this.voiceId;
    const previousSoundId = this.voiceSoundId;
    if (previousId === null || previousSoundId === null) {
      this.voiceId = null;
      this.voiceSoundId = null;
      this.voiceRequestedAtMs = null;
      return;
    }
    this.voiceId = null;
    this.voiceSoundId = null;
    this.voiceRequestedAtMs = null;
    this.howls.get(previousId)?.stop(previousSoundId);
  }

  /** Stop the active line and restore music (mute, stopAll, dispose). */
  private stopVoice(): void {
    const hadVoice = this.voiceId !== null;
    this.detachVoice();
    if (hadVoice && this.ducked) {
      this.ducked = false;
      this.applyMusicGain();
    }
  }

  /** Natural end of a one-shot: restore music after the voice tail (FR-5). */
  private handleEnd(assetId: string, bus: AudioBus, soundId: number): void {
    if (bus === 'sfx') {
      this.activeSfx.delete(sfxKey(assetId, soundId));
      return;
    }
    if (bus === 'voice' && this.voiceId === assetId && this.voiceSoundId === soundId) {
      this.voiceId = null;
      this.voiceSoundId = null;
      this.voiceRequestedAtMs = null;
      this.ducked = false;
      this.applyMusicGain();
    }
  }

  /** Howler's `play` event: the line actually started (AC-5, NFR-2). */
  private handlePlay(bus: AudioBus, assetId: string, soundId: number): void {
    if (bus !== 'voice' || this.voiceId !== assetId || this.voiceSoundId !== soundId) {
      return;
    }
    if (this.voiceRequestedAtMs !== null) {
      this.latencyMs = Math.max(0, performance.now() - this.voiceRequestedAtMs);
      this.voiceRequestedAtMs = null;
    }
  }

  /** Explicit stop of a one-shot: the same bookkeeping as a natural end. */
  private handleStop(assetId: string, bus: AudioBus, soundId: number): void {
    this.handleEnd(assetId, bus, soundId);
  }

  /** One warning per failed asset; the rest of the pack stays playable. */
  private warnAsset(assetId: string, soundId: number): void {
    this.failed.add(assetId);
    for (const key of this.activeSfx) {
      if (key.startsWith(`${assetId}#`)) {
        this.activeSfx.delete(key);
      }
    }
    if (this.voiceId === assetId) {
      this.voiceId = null;
      this.voiceSoundId = null;
      this.voiceRequestedAtMs = null;
      if (this.ducked) {
        this.ducked = false;
        this.applyMusicGain();
      }
    }
    if (this.musicId === assetId) {
      this.musicSoundId = null;
      this.musicPlayingFlag = false;
    }
    this.warnOnce(
      assetId,
      `Audio asset "${assetId}" failed to load (sound ${soundId}); playing silence.`,
    );
  }

  private warnOnce(key: string, message: string, error?: unknown): void {
    if (this.warned.has(key)) {
      return;
    }
    this.warned.add(key);
    if (error === undefined) {
      console.warn(message);
      return;
    }
    console.warn(message, error);
  }
}
