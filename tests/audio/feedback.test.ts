import { describe, expect, it } from 'vitest';
import { getAudioAsset } from '../../src/audio/catalog.js';
import { MUSIC_FADE_IN_MS } from '../../src/audio/engine.js';
import {
  GREETING_ASSET_ID,
  GREETING_DELAY_MS,
  TAP_ASSET_ID,
  cooAssetForSpecies,
  createCooGate,
  createFirstPressSlot,
  sfxForSurface,
  shouldGreet,
  type GreetState,
  type SpeciesId,
} from '../../src/audio/feedback.js';

const SPECIES: SpeciesId[] = ['trike', 'stego', 'brachio'];

/** Window derived from the catalog, which is the only source the module reads. */
function catalogWindowMs(species: SpeciesId): number {
  const asset = getAudioAsset(cooAssetForSpecies(species));
  if (asset === undefined) {
    return 0;
  }
  return Math.ceil(asset.durationSeconds * 1000);
}

/** A clear session: unmuted, never greeted, fade complete. */
function clearSession(): GreetState {
  return {
    muted: false,
    firstGestureWasMute: false,
    alreadyGreeted: false,
    sinceUnlockMs: GREETING_DELAY_MS,
  };
}

describe('sfxForSurface (P1.T1, FR-11)', () => {
  it('answers every kid-facing surface with tap', () => {
    expect(sfxForSurface('walk')).toBe('tap');
    expect(sfxForSurface('pov')).toBe('tap');
    expect(sfxForSurface('mute')).toBe('tap');
    expect(TAP_ASSET_ID).toBe('tap');
  });

  it('names three distinct catalog coos for the trio', () => {
    const ids: string[] = [];
    for (const species of SPECIES) {
      ids.push(cooAssetForSpecies(species));
    }
    expect(ids).toEqual(['coo-trike', 'coo-stego', 'coo-brachio']);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(getAudioAsset(id)?.bus).toBe('sfx');
    }
  });
});

describe('createCooGate (P1.T2, FR-5, AC-4)', () => {
  it('turns ten taps in one second into exactly one coo', () => {
    const gate = createCooGate();
    let coos = 0;
    for (let nowMs = 0; nowMs < 1000; nowMs += 100) {
      if (gate.tryCoo('trike', nowMs) !== null) {
        coos += 1;
      }
    }
    expect(coos).toBe(1);
  });

  it('lets only one coo sound when two species are tapped together', () => {
    const gate = createCooGate();
    expect(gate.tryCoo('trike', 500)).toBe('coo-trike');
    expect(gate.tryCoo('stego', 500)).toBeNull();
    expect(gate.tryCoo('brachio', 500)).toBeNull();
  });

  it('allows a species again once its own catalog window elapses', () => {
    for (const species of SPECIES) {
      const gate = createCooGate();
      const windowMs = catalogWindowMs(species);
      const coo = cooAssetForSpecies(species);
      expect(gate.tryCoo(species, 0)).toBe(coo);
      expect(gate.tryCoo(species, windowMs - 1)).toBeNull();
      expect(gate.tryCoo(species, windowMs)).toBe(coo);
    }
  });

  it('takes each window from the catalog duration, not a fixed number', () => {
    const windows: number[] = [];
    for (const species of SPECIES) {
      const durationSeconds = getAudioAsset(cooAssetForSpecies(species))?.durationSeconds ?? 0;
      const windowMs = catalogWindowMs(species);
      expect(windowMs).toBe(Math.ceil(durationSeconds * 1000));
      const gate = createCooGate();
      gate.tryCoo(species, 0);
      expect(gate.tryCoo(species, windowMs - 1)).toBeNull();
      expect(gate.tryCoo(species, windowMs)).not.toBeNull();
      windows.push(windowMs);
    }
    // The three coos differ, so one shared hard-coded window could not fit all.
    expect(new Set(windows).size).toBe(3);
  });

  it('does not extend the window when a call is gated', () => {
    const gate = createCooGate();
    expect(gate.tryCoo('trike', 0)).toBe('coo-trike');
    expect(gate.tryCoo('trike', 500)).toBeNull();
    expect(gate.tryCoo('trike', 900)).toBeNull();
    expect(gate.tryCoo('trike', 999)).toBeNull();
    expect(gate.tryCoo('trike', 1000)).toBe('coo-trike');
  });

  it('reads the injected clock when a caller has no timestamp', () => {
    const gate = createCooGate({ now: () => 5000 });
    expect(gate.tryCoo('stego', Number.NaN)).toBe('coo-stego');
    expect(gate.tryCoo('stego', 5000)).toBeNull();
  });
});

describe('shouldGreet (P1.T3, FR-6, AC-5)', () => {
  it('waits at least the music fade before saying hello', () => {
    expect(GREETING_ASSET_ID).toBe('hello');
    expect(GREETING_DELAY_MS).toBeGreaterThanOrEqual(MUSIC_FADE_IN_MS);
  });

  it('greets when the session is clear and the fade has passed', () => {
    expect(shouldGreet(clearSession())).toBe(true);
    const later = clearSession();
    later.sinceUnlockMs = GREETING_DELAY_MS + 1;
    expect(shouldGreet(later)).toBe(true);
  });

  it('stays quiet while muted', () => {
    const state = clearSession();
    state.muted = true;
    expect(shouldGreet(state)).toBe(false);
  });

  it('stays quiet when the unlocking gesture was a mute control', () => {
    const state = clearSession();
    state.firstGestureWasMute = true;
    expect(shouldGreet(state)).toBe(false);
  });

  it('stays quiet when the ranch has already greeted', () => {
    const state = clearSession();
    state.alreadyGreeted = true;
    expect(shouldGreet(state)).toBe(false);
  });

  it('stays quiet before the fade completes', () => {
    const nearly = clearSession();
    nearly.sinceUnlockMs = GREETING_DELAY_MS - 1;
    expect(shouldGreet(nearly)).toBe(false);
    const instantly = clearSession();
    instantly.sinceUnlockMs = 0;
    expect(shouldGreet(instantly)).toBe(false);
  });

  it('stays quiet when suppressions overlap', () => {
    const mutedAndGreeted = clearSession();
    mutedAndGreeted.muted = true;
    mutedAndGreeted.alreadyGreeted = true;
    expect(shouldGreet(mutedAndGreeted)).toBe(false);
    const muteFirstAndLate = clearSession();
    muteFirstAndLate.firstGestureWasMute = true;
    muteFirstAndLate.sinceUnlockMs = 10_000;
    expect(shouldGreet(muteFirstAndLate)).toBe(false);
  });
});

describe('createFirstPressSlot (P1.T4, FR-7, AC-6)', () => {
  it('flushes an empty slot as null', () => {
    const slot = createFirstPressSlot<string>();
    expect(slot.flush()).toBeNull();
    expect(slot.flush()).toBeNull();
  });

  it('holds one value and hands it back exactly once', () => {
    const slot = createFirstPressSlot<string>();
    slot.hold('tap');
    expect(slot.flush()).toBe('tap');
    expect(slot.flush()).toBeNull();
  });

  it('replaces the first value instead of growing a queue', () => {
    const slot = createFirstPressSlot<string>();
    slot.hold('tap');
    slot.hold('coo-trike');
    expect(slot.flush()).toBe('coo-trike');
    expect(slot.flush()).toBeNull();
  });

  it('drops the held value on clear', () => {
    const slot = createFirstPressSlot<string>();
    slot.hold('tap');
    slot.clear();
    expect(slot.flush()).toBeNull();
  });

  it('accepts a value again after a flush or a clear', () => {
    const slot = createFirstPressSlot<string>();
    slot.hold('tap');
    expect(slot.flush()).toBe('tap');
    slot.hold('heart');
    expect(slot.flush()).toBe('heart');
    slot.hold('sparkle');
    slot.clear();
    slot.hold('nom');
    expect(slot.flush()).toBe('nom');
  });
});
