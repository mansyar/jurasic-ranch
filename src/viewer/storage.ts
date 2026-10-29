import { del, get, set } from 'idb-keyval';

/**
 * Minimal IndexedDB settings stub. Reads and writes survive reloads when
 * IndexedDB is available; in contexts without it (unit tests, private mode
 * quirks) the stub degrades to in-memory silence instead of throwing.
 */

/** Read a persisted setting; resolves undefined when storage is unavailable. */
export async function readSetting(key: string): Promise<unknown> {
  try {
    return await get(key);
  } catch {
    /* IndexedDB unavailable: treat as empty. */
    return undefined;
  }
}

/** Persist a setting; silently ignores failures when storage is unavailable. */
export async function writeSetting(key: string, value: unknown): Promise<void> {
  try {
    await set(key, value);
  } catch {
    /* IndexedDB unavailable: stub ignores writes. */
  }
}

/** Delete a persisted setting; silently ignores failures. */
export async function clearSetting(key: string): Promise<void> {
  try {
    await del(key);
  } catch {
    /* IndexedDB unavailable: stub ignores deletes. */
  }
}
