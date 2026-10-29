import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AUDIO_CATALOG } from '../../src/audio/catalog.js';
import {
  AudioEngine,
  MUSIC_FADE_IN_MS,
  type HowlLike,
  type HowlOptionsLike,
  type HowlerLike,
  type HowlerLoader,
  type HowlerModuleLike,
} from '../../src/audio/engine.js';
import {
  DEFAULT_VOLUME,
  DUCK_FACTOR,
  MUSIC_BUS_GAIN,
  SFX_OVERLAP_CAP,
} from '../../src/audio/mix.js';

/** Recording Howl stand-in: never decodes, never touches an AudioContext. */
class FakeHowl implements HowlLike {
  static instances: FakeHowl[] = [];

  readonly options: HowlOptionsLike;
  readonly played: number[] = [];
  readonly paused: number[] = [];
  readonly stopped: number[] = [];
  readonly fades: Array<{ from: number; to: number; duration: number; id?: number }> = [];
  volumeValue: number;
  unloaded = false;
  private nextSoundId = 1;

  constructor(options: HowlOptionsLike) {
    this.options = options;
    this.volumeValue = options.volume ?? 1;
    FakeHowl.instances.push(this);
  }

  play(id?: number): number {
    const soundId = id ?? this.nextSoundId++;
    this.played.push(soundId);
    return soundId;
  }

  pause(id?: number): void {
    this.paused.push(id ?? -1);
  }

  stop(id?: number): void {
    this.stopped.push(id ?? -1);
  }

  volume(value: number): void {
    this.volumeValue = value;
  }

  fade(from: number, to: number, duration: number, id?: number): void {
    this.fades.push({ from, to, duration, id });
    this.volumeValue = to;
  }

  unload(): void {
    this.unloaded = true;
  }

  /** Fire the natural end callback for one sound instance. */
  end(soundId: number): void {
    this.options.onend?.(soundId);
  }

  /** Fire the explicit stop callback for one sound instance. */
  stopEvent(soundId: number): void {
    this.options.onstop?.(soundId);
  }

  /** Fire a decode/404 failure for this asset. */
  fail(): void {
    this.options.onloaderror?.(1);
  }

  /** Fire Howler's play event for one sound instance. */
  playStarted(soundId: number): void {
    this.options.onplay?.(soundId);
  }
}

/** Recording global Howler stand-in with a controllable context state. */
class FakeHowler implements HowlerLike {
  readonly ctx = {
    state: 'running',
    resume: vi.fn(async (): Promise<void> => {
      this.ctx.state = 'running';
    }),
  };
  muted = false;
  masterVolume = 1;
  stopCalls = 0;
  unloaded = false;

  mute(muted: boolean): void {
    this.muted = muted;
  }

  volume(volume: number): void {
    this.masterVolume = volume;
  }

  stop(): void {
    this.stopCalls += 1;
  }

  unload(): void {
    this.unloaded = true;
  }
}

interface EngineFixture {
  engine: AudioEngine;
  load: Mock<HowlerLoader>;
  howler: FakeHowler;
}

function createEngine(options: { muted?: boolean; volume?: number } = {}): EngineFixture {
  const howler = new FakeHowler();
  const module: HowlerModuleLike = { Howl: FakeHowl, Howler: howler };
  const load = vi.fn<HowlerLoader>(async () => module);
  const engine = new AudioEngine({
    load,
    getMuted: () => options.muted ?? false,
    getVolume: () => options.volume ?? DEFAULT_VOLUME,
  });
  return { engine, load, howler };
}

/** The recorded Howl for a catalog id, found by its resolved source path. */
function howlFor(id: string): FakeHowl {
  const asset = AUDIO_CATALOG.find((entry) => entry.id === id);
  const howl = FakeHowl.instances.find((instance) =>
    instance.options.src[0]?.endsWith(asset?.path ?? '\u0000'),
  );
  if (howl === undefined) {
    throw new Error(`no Howl recorded for ${id}`);
  }
  return howl;
}

const MUSIC_GAIN = MUSIC_BUS_GAIN;
const DUCKED_GAIN = MUSIC_BUS_GAIN * DUCK_FACTOR;

beforeEach(() => {
  FakeHowl.instances = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('before the first gesture (FR-2, AC-2)', () => {
  it('loads no Howler and builds no Howl', () => {
    const { engine, load } = createEngine();
    expect(engine.unlocked).toBe(false);
    expect(engine.musicPlaying).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(FakeHowl.instances).toHaveLength(0);
  });

  it('ignores playback calls until unlock runs', () => {
    const { engine } = createEngine();
    engine.playMusic();
    engine.playSfx('tap');
    engine.playVoice('hello');
    expect(FakeHowl.instances).toHaveLength(0);
    expect(engine.musicPlaying).toBe(false);
  });
});

describe('unlock (FR-2, FR-3, AC-2)', () => {
  it('creates all 15 Howls and starts the loop with a bounded fade-in', async () => {
    const { engine, load } = createEngine();
    await engine.unlock();

    expect(load).toHaveBeenCalledTimes(1);
    expect(FakeHowl.instances).toHaveLength(AUDIO_CATALOG.length);
    expect(engine.unlocked).toBe(true);
    expect(engine.musicPlaying).toBe(true);

    const music = howlFor('music-kalimba');
    expect(music.options).toMatchObject({ loop: true, preload: true, html5: false });
    expect(music.played).toHaveLength(1);
    expect(music.fades).toHaveLength(1);
    const fade = music.fades[0];
    expect(fade?.from).toBe(0);
    expect(fade?.to).toBeCloseTo(MUSIC_GAIN, 12);
    expect(fade?.duration).toBeLessThanOrEqual(400);
    expect(MUSIC_FADE_IN_MS).toBe(400);

    expect(howlFor('tap').options.loop).toBe(false);
    expect(howlFor('hello').options.loop).toBe(false);
  });

  it('is idempotent: a repeated unlock neither reloads nor restarts music', async () => {
    const { engine, load } = createEngine();
    await engine.unlock();
    await engine.unlock();
    await engine.unlock();

    expect(load).toHaveBeenCalledTimes(1);
    expect(FakeHowl.instances).toHaveLength(AUDIO_CATALOG.length);
    expect(howlFor('music-kalimba').played).toHaveLength(1);
  });

  it('shares one in-flight unlock when two gestures race', async () => {
    const { engine, load } = createEngine();
    await Promise.all([engine.unlock(), engine.unlock()]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(FakeHowl.instances).toHaveLength(AUDIO_CATALOG.length);
    expect(howlFor('music-kalimba').played).toHaveLength(1);
  });

  it('starts silent when the first gesture is the mute button', async () => {
    const { engine, howler } = createEngine({ muted: true });
    await engine.unlock();

    expect(engine.unlocked).toBe(true);
    expect(engine.muted).toBe(true);
    expect(howler.muted).toBe(true);
    expect(engine.musicPlaying).toBe(false);
    expect(howlFor('music-kalimba').played).toHaveLength(0);
  });
});

describe('master volume (FR-7)', () => {
  it('rides Howler global gain while music keeps its bus trim', async () => {
    const { engine, howler } = createEngine();
    await engine.unlock();
    expect(engine.volume).toBeCloseTo(DEFAULT_VOLUME, 12);
    expect(howler.masterVolume).toBeCloseTo(DEFAULT_VOLUME, 12);
    expect(howlFor('music-kalimba').volumeValue).toBeCloseTo(MUSIC_GAIN, 12);

    engine.setVolume(0.5);
    expect(engine.volume).toBe(0.5);
    expect(howler.masterVolume).toBe(0.5);
    expect(howlFor('music-kalimba').volumeValue).toBeCloseTo(MUSIC_GAIN, 12);
  });

  it('clamps live changes and falls back from NaN', async () => {
    const { engine, howler } = createEngine();
    await engine.unlock();

    engine.setVolume(3);
    expect(engine.volume).toBe(1);
    expect(howler.masterVolume).toBe(1);

    engine.setVolume(-1);
    expect(engine.volume).toBe(0);

    engine.setVolume(Number.NaN);
    expect(engine.volume).toBe(DEFAULT_VOLUME);
  });

  it('late-binds providers installed after construction', async () => {
    const howler = new FakeHowler();
    const module: HowlerModuleLike = { Howl: FakeHowl, Howler: howler };
    const load = vi.fn<HowlerLoader>(async () => module);
    const engine = new AudioEngine({ load });

    engine.configure({ getMuted: () => true, getVolume: () => 0.4 });
    expect(engine.muted).toBe(true);
    expect(engine.volume).toBe(0.4);

    await engine.unlock();
    expect(howler.muted).toBe(true);
    expect(howler.masterVolume).toBe(0.4);
  });

  it('re-applies live gains when reconfigured after unlock', async () => {
    const { engine, howler } = createEngine();
    await engine.unlock();

    engine.configure({ getMuted: () => true, getVolume: () => 0.3 });
    expect(engine.muted).toBe(true);
    expect(howler.muted).toBe(true);
    expect(howler.masterVolume).toBe(0.3);
    expect(howlFor('music-kalimba').volumeValue).toBe(0);
  });
});

describe('voice ducking (FR-5, AC-3)', () => {
  it('ducks to DUCK_FACTOR while a line speaks and restores when it ends', async () => {
    const { engine } = createEngine();
    await engine.unlock();
    const music = howlFor('music-kalimba');

    engine.playVoice('hello');
    const voice = howlFor('hello');
    expect(voice.played).toHaveLength(1);
    expect(music.volumeValue).toBeCloseTo(DUCKED_GAIN, 12);

    voice.end(voice.played[0] ?? 0);
    expect(music.volumeValue).toBeCloseTo(MUSIC_GAIN, 12);
  });

  it('stops the previous line and keeps the duck until the newest ends', async () => {
    const { engine } = createEngine();
    await engine.unlock();
    const music = howlFor('music-kalimba');

    engine.playVoice('hello');
    const hello = howlFor('hello');
    const helloId = hello.played[0] ?? 0;
    engine.playVoice('nom');
    const nom = howlFor('nom');

    expect(hello.stopped).toEqual([helloId]);
    expect(music.volumeValue).toBeCloseTo(DUCKED_GAIN, 12);

    // A stale end from the replaced line cannot restore music under the new one.
    hello.end(helloId);
    expect(music.volumeValue).toBeCloseTo(DUCKED_GAIN, 12);

    nom.end(nom.played[0] ?? 0);
    expect(music.volumeValue).toBeCloseTo(MUSIC_GAIN, 12);
  });

  it('does not stack the duck when lines overlap in the same asset id', async () => {
    const { engine } = createEngine();
    await engine.unlock();
    const music = howlFor('music-kalimba');

    engine.playVoice('hello');
    const hello = howlFor('hello');
    const firstId = hello.played[0] ?? 0;
    engine.playVoice('hello');
    expect(hello.stopped).toEqual([firstId]);
    expect(music.volumeValue).toBeCloseTo(DUCKED_GAIN, 12);

    hello.end(firstId);
    expect(music.volumeValue).toBeCloseTo(DUCKED_GAIN, 12);
    hello.end(hello.played[1] ?? 0);
    expect(music.volumeValue).toBeCloseTo(MUSIC_GAIN, 12);
  });

  it('ignores ids on the wrong bus and unknown ids', async () => {
    const { engine } = createEngine();
    await engine.unlock();

    engine.playSfx('hello');
    engine.playVoice('tap');
    engine.playSfx('not-a-real-asset');
    engine.playVoice('not-a-real-asset');

    expect(howlFor('hello').played).toHaveLength(0);
    expect(howlFor('tap').played).toHaveLength(0);
    expect(howlFor('music-kalimba').volumeValue).toBeCloseTo(MUSIC_GAIN, 12);
  });
});

describe('SFX overlap (FR-4, AC-4)', () => {
  it('allows the cap, drops the extra tap, and frees a slot on end', async () => {
    const { engine } = createEngine();
    await engine.unlock();
    const tap = howlFor('tap');

    for (let index = 0; index < SFX_OVERLAP_CAP; index += 1) {
      engine.playSfx('tap');
    }
    expect(tap.played).toHaveLength(SFX_OVERLAP_CAP);

    engine.playSfx('tap');
    expect(tap.played).toHaveLength(SFX_OVERLAP_CAP);

    tap.end(tap.played[0] ?? 0);
    engine.playSfx('tap');
    expect(tap.played).toHaveLength(SFX_OVERLAP_CAP + 1);
  });

  it('frees a slot on an explicit stop too', async () => {
    const { engine } = createEngine();
    await engine.unlock();
    const tap = howlFor('tap');

    for (let index = 0; index < SFX_OVERLAP_CAP; index += 1) {
      engine.playSfx('tap');
    }
    tap.stopEvent(tap.played[0] ?? 0);
    engine.playSfx('tap');
    expect(tap.played).toHaveLength(SFX_OVERLAP_CAP + 1);
  });
});

describe('asset failures (FR-9, AC-9)', () => {
  it('warns once per failed asset and leaves the rest playable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine } = createEngine();
    await engine.unlock();

    howlFor('hello').fail();
    howlFor('hello').fail();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('hello');

    engine.playSfx('tap');
    expect(howlFor('tap').played).toHaveLength(1);
  });

  it('does not duck music or report a line when a failed voice is requested', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine } = createEngine();
    await engine.unlock();
    const music = howlFor('music-kalimba');
    const hello = howlFor('hello');

    hello.fail();
    engine.playVoice('hello');

    expect(hello.played).toHaveLength(0);
    expect(engine.activeVoiceId).toBeNull();
    expect(music.volumeValue).toBeCloseTo(MUSIC_GAIN, 12);
  });

  it('does not let a failed SFX fill the overlap cap for the rest of the bus', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine } = createEngine();
    await engine.unlock();
    const tap = howlFor('tap');

    tap.fail();
    for (let index = 0; index < SFX_OVERLAP_CAP + 2; index += 1) {
      engine.playSfx('tap');
    }
    engine.playSfx('heart');

    expect(tap.played).toHaveLength(0);
    expect(howlFor('heart').played).toHaveLength(1);
  });

  it('warns once and stays silent when Howler itself cannot load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const load = vi.fn<HowlerLoader>(async () => {
      throw new Error('offline');
    });
    const engine = new AudioEngine({ load });

    await expect(engine.unlock()).resolves.toBeUndefined();
    await engine.unlock();

    expect(load).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(engine.unlocked).toBe(false);
    expect(engine.musicPlaying).toBe(false);
    expect(FakeHowl.instances).toHaveLength(0);
  });
});

describe('visibility and device sleep (FR-3, NFR-7)', () => {
  it('pauses on hide and resumes on return while unmuted', async () => {
    const { engine } = createEngine();
    await engine.unlock();
    const music = howlFor('music-kalimba');

    engine.handleVisibility(true);
    expect(engine.musicPlaying).toBe(false);
    expect(music.paused).toHaveLength(1);

    engine.handleVisibility(false);
    expect(engine.musicPlaying).toBe(true);
    // The loop resumes the same sound instance instead of restarting from 0.
    expect(music.played).toHaveLength(2);
    expect(music.played[1]).toBe(music.played[0]);
  });

  it('does not resume a hidden-then-visible tab while muted', async () => {
    const { engine } = createEngine();
    await engine.unlock();

    engine.handleVisibility(true);
    engine.setMuted(true);
    engine.handleVisibility(false);

    expect(engine.musicPlaying).toBe(false);
  });

  it('resumes a suspended context once, then leaves a running one alone', async () => {
    const { engine, howler } = createEngine();
    await engine.unlock();
    expect(howler.ctx.resume).not.toHaveBeenCalled();

    howler.ctx.state = 'suspended';
    await engine.resumeContext();
    expect(howler.ctx.resume).toHaveBeenCalledTimes(1);
    expect(howler.ctx.state).toBe('running');

    await engine.resumeContext();
    expect(howler.ctx.resume).toHaveBeenCalledTimes(1);
  });
});

describe('mute, stop and dispose (FR-6, NFR-5)', () => {
  it('mute stops an active line, silences the pack, and unmute resumes music', async () => {
    const { engine, howler } = createEngine();
    await engine.unlock();
    engine.playVoice('hello');
    const hello = howlFor('hello');

    engine.setMuted(true);
    expect(engine.muted).toBe(true);
    expect(howler.muted).toBe(true);
    expect(hello.stopped).toEqual([hello.played[0] ?? 0]);
    expect(engine.musicPlaying).toBe(false);

    engine.setMuted(false);
    expect(engine.muted).toBe(false);
    expect(engine.musicPlaying).toBe(true);
  });

  it('stopAll halts every bus and clears the SFX cap', async () => {
    const { engine, howler } = createEngine();
    await engine.unlock();
    engine.playSfx('tap');
    engine.playVoice('hello');

    engine.stopAll();
    expect(howler.stopCalls).toBe(1);
    expect(engine.musicPlaying).toBe(false);

    engine.playSfx('tap');
    expect(howlFor('tap').played).toHaveLength(2);
  });

  it('dispose unloads every Howl and leaves the engine locked', async () => {
    const { engine, howler } = createEngine();
    await engine.unlock();

    engine.dispose();
    expect(FakeHowl.instances.every((howl) => howl.unloaded)).toBe(true);
    expect(howler.unloaded).toBe(true);
    expect(engine.unlocked).toBe(false);
    expect(engine.musicPlaying).toBe(false);

    engine.playMusic();
    expect(engine.musicPlaying).toBe(false);
  });
});

describe('dev harness audio surface (FR-10)', () => {
  it('routes a catalog id to its own bus and ignores unknown ids', async () => {
    const { engine } = createEngine();
    await engine.unlock();
    const music = howlFor('music-kalimba');

    engine.play('hello');
    expect(howlFor('hello').played).toHaveLength(1);
    expect(engine.activeVoiceId).toBe('hello');
    expect(music.volumeValue).toBeCloseTo(DUCKED_GAIN, 12);

    engine.play('tap');
    expect(howlFor('tap').played).toHaveLength(1);

    // Music id while already playing resumes the same loop in place.
    engine.play('music-kalimba');
    expect(music.played).toHaveLength(2);
    expect(engine.musicPlaying).toBe(true);

    const playsBefore = FakeHowl.instances.reduce((sum, howl) => sum + howl.played.length, 0);
    engine.play('not-an-asset');
    const playsAfter = FakeHowl.instances.reduce((sum, howl) => sum + howl.played.length, 0);
    expect(playsAfter).toBe(playsBefore);
  });

  it('tracks the active line until it ends', async () => {
    const { engine } = createEngine();
    await engine.unlock();

    engine.playVoice('hello');
    expect(engine.activeVoiceId).toBe('hello');

    const hello = howlFor('hello');
    hello.end(hello.played[0] ?? 0);
    expect(engine.activeVoiceId).toBeNull();
  });

  it('measures latency from the play request to Howler’s play event', async () => {
    const { engine } = createEngine();
    await engine.unlock();
    const hello = howlFor('hello');

    const now = vi.spyOn(performance, 'now').mockReturnValue(1_000);
    engine.playVoice('hello');
    expect(engine.lastStartLatencyMs).toBe(0);

    now.mockReturnValue(1_120);
    hello.playStarted(hello.played[0] ?? 0);
    expect(engine.lastStartLatencyMs).toBe(120);

    engine.stopAll();
    expect(engine.lastStartLatencyMs).toBe(0);
    expect(engine.activeVoiceId).toBeNull();
  });
});
