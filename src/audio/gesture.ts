/**
 * First-gesture unlock and visibility handling (FR-2, FR-3, NFR-7). Both
 * installers are DOM-injectable so node tests drive them with a fake target
 * instead of jsdom, and both swallow a failed unlock: audio is a nicety, boot
 * is not.
 */

/** Minimal event target: `document` satisfies it, tests use a fake. */
export interface GestureTarget {
  addEventListener(type: string, listener: () => void, options?: { passive: boolean }): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** Just enough of a document to read tab visibility. */
export interface VisibilityDocument extends GestureTarget {
  readonly hidden: boolean;
}

/** Engine surface visibility handling needs, without importing the class. */
export interface VisibilityEngine {
  readonly unlocked: boolean;
  readonly muted: boolean;
  handleVisibility(hidden: boolean): void;
  resumeContext(): Promise<void>;
}

/** Options for `installGestureUnlock`. */
export interface GestureUnlockOptions {
  /** Runs at most once, on the first pointerdown or keydown. */
  onUnlock: () => void | Promise<void>;
  target?: GestureTarget;
}

/** Unlock audio on the first pointerdown or keydown anywhere on the target. */
export function installGestureUnlock({
  onUnlock,
  target = document,
}: GestureUnlockOptions): () => void {
  let fired = false;

  const handle = (): void => {
    if (fired) {
      return;
    }
    fired = true;
    cleanup();
    try {
      // Promise.resolve also covers a synchronous `onUnlock` that throws.
      void Promise.resolve(onUnlock()).catch((error: unknown) => {
        console.warn('Audio unlock failed; staying silent.', error);
      });
    } catch (error: unknown) {
      console.warn('Audio unlock failed; staying silent.', error);
    }
  };

  const cleanup = (): void => {
    target.removeEventListener('pointerdown', handle);
    target.removeEventListener('keydown', handle);
  };

  target.addEventListener('pointerdown', handle, { passive: true });
  target.addEventListener('keydown', handle, { passive: true });
  return cleanup;
}

/**
 * Pause music when the tab hides and resume when it returns: only if unlocked,
 * unmuted, and (for a device that slept) after a suspended context resumes.
 */
export function installVisibilityHandling(
  engine: VisibilityEngine,
  doc: VisibilityDocument = document,
): () => void {
  const onChange = (): void => {
    if (doc.hidden) {
      engine.handleVisibility(true);
      return;
    }
    if (!engine.unlocked || engine.muted) {
      return;
    }
    void engine
      .resumeContext()
      .then(() => {
        engine.handleVisibility(false);
      })
      .catch((error: unknown) => {
        console.warn('Audio resume failed; staying silent.', error);
      });
  };

  doc.addEventListener('visibilitychange', onChange);
  return (): void => {
    doc.removeEventListener('visibilitychange', onChange);
  };
}
