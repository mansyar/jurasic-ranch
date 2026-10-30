/**
 * Pure feedback policy (FR-5, FR-6, FR-7, FR-11): which asset a tap plays, when
 * a coo may repeat, whether the ranch may greet, and the single slot that holds
 * the unlocking press until audio resolves. No DOM, no Howler, no engine
 * instance and no timers - the caller supplies the clock, so every rule here is
 * provable in a node test.
 */

import { getAudioAsset, type AudioAssetId } from './catalog.js';
import { MUSIC_FADE_IN_MS } from './engine.js';

/** The kid-facing surfaces that answer a press with a tap. */
export type TapSurface = 'walk' | 'pov' | 'mute';

/** The one SFX every tappable surface plays. */
export const TAP_ASSET_ID: AudioAssetId = 'tap';

/**
 * Surface table (FR-11). Gear, Close and the volume slider are deliberately
 * absent: their silence is the absence of a mapping, not a listed exception.
 */
const TAP_SURFACE_ASSETS: Readonly<Record<TapSurface, AudioAssetId>> = {
  walk: TAP_ASSET_ID,
  pov: TAP_ASSET_ID,
  mute: TAP_ASSET_ID,
};

/** Asset the given surface plays on every press. */
export function sfxForSurface(surface: TapSurface): AudioAssetId {
  return TAP_SURFACE_ASSETS[surface];
}

/** The three babies, by the suffix of their catalog coo. */
export type SpeciesId = 'trike' | 'stego' | 'brachio';

/** Species to coo table; ids are catalog ids, so a missing entry fails to compile. */
const COO_ASSETS: Readonly<Record<SpeciesId, AudioAssetId>> = {
  trike: 'coo-trike',
  stego: 'coo-stego',
  brachio: 'coo-brachio',
};

/** Asset the given species coos with. */
export function cooAssetForSpecies(species: SpeciesId): AudioAssetId {
  return COO_ASSETS[species];
}

/** Coo admission control: one coo across the trio, then a per-species rest. */
export interface CooGate {
  tryCoo(species: SpeciesId, nowMs: number): AudioAssetId | null;
}

/**
 * Retrigger window for one species, in whole milliseconds, taken from its
 * catalog duration so a re-cut file stays correct without a second number.
 */
function cooWindowMs(species: SpeciesId): number {
  const asset = getAudioAsset(cooAssetForSpecies(species));
  return asset === undefined ? 0 : Math.ceil(asset.durationSeconds * 1000);
}

/**
 * A gate shared by all three species (FR-5). A refused call changes nothing, so
 * a mash neither extends nor resets the window and no queue can grow.
 * `options.now` is the fallback clock for a caller with no timing source.
 */
export function createCooGate(options?: { now?: () => number }): CooGate {
  const clock = options?.now ?? Date.now;
  let gateEndsAtMs = Number.NEGATIVE_INFINITY;

  return {
    tryCoo(species: SpeciesId, nowMs: number): AudioAssetId | null {
      const atMs = Number.isFinite(nowMs) ? nowMs : clock();
      if (atMs < gateEndsAtMs) {
        return null;
      }
      const assetId = cooAssetForSpecies(species);
      gateEndsAtMs = atMs + cooWindowMs(species);
      return assetId;
    },
  };
}

/** The single greeting line. */
export const GREETING_ASSET_ID: AudioAssetId = 'hello';

/** The greeting waits out the music fade, so it never talks over the kalimba. */
export const GREETING_DELAY_MS: number = MUSIC_FADE_IN_MS;

/** Session facts the greeting decision reads. */
export interface GreetState {
  muted: boolean;
  firstGestureWasMute: boolean;
  alreadyGreeted: boolean;
  sinceUnlockMs: number;
}

/**
 * Whether the ranch may say hello now (FR-6): once per session, after the fade,
 * and never while muted or after a gesture that was itself a mute control.
 */
export function shouldGreet(state: GreetState): boolean {
  if (state.muted || state.firstGestureWasMute || state.alreadyGreeted) {
    return false;
  }
  return state.sinceUnlockMs >= GREETING_DELAY_MS;
}

/** The one press that may be waiting for audio to unlock. */
export interface FirstPressSlot<T> {
  hold(value: T): void;
  flush(): T | null;
  clear(): void;
}

/**
 * A single-slot queue (FR-7): a second press replaces the first, `flush` hands
 * the value back once, and `flush` on an empty slot is `null`. It never grows.
 */
export function createFirstPressSlot<T>(): FirstPressSlot<T> {
  let held: { value: T } | null = null;

  return {
    hold(value: T): void {
      held = { value };
    },
    flush(): T | null {
      if (held === null) {
        return null;
      }
      const { value } = held;
      held = null;
      return value;
    },
    clear(): void {
      held = null;
    },
  };
}
