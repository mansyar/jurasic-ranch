/**
 * Phase 1 audio stub. The waddle walk is silent (FR-8); Howler music and
 * voice sprites land in a later track. The dynamic import keeps the Howler
 * dependency in the offline precache so the unlock path is proven early.
 */

let unlocked = false;

/** Whether the first tap has unlocked audio. */
export function isAudioUnlocked(): boolean {
  return unlocked;
}

/** Unlock audio on first tap; resolves once Howler is available offline. */
export async function unlockAudio(): Promise<void> {
  await import('howler');
  unlocked = true;
}
