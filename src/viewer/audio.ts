/**
 * Thin viewer facade over the shared engine (FR-2, FR-3). Importing this module
 * creates no engine and touches no audio library: the singleton is built on the
 * first gesture, so boot stays silent until a pointerdown or keydown.
 */

import { AudioEngine } from '../audio/engine.js';

let engine: AudioEngine | null = null;

/** The lazily built engine shared by unlock, visibility, and the dev bridge. */
export function audioEngine(): AudioEngine {
  engine ??= new AudioEngine();
  return engine;
}

/** Whether the first gesture finished unlocking audio. */
export function isAudioUnlocked(): boolean {
  return engine !== null && engine.unlocked;
}

/** Unlock audio on the first gesture; resolves once ready or safely silent. */
export async function unlockAudio(): Promise<void> {
  await audioEngine().unlock();
}

/** Drop the singleton and its Howls; a test-only reset, never called at boot. */
export function disposeAudio(): void {
  engine?.dispose();
  engine = null;
}
