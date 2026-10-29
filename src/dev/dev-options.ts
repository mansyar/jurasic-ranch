/**
 * Dev harness URL options (FR-1, FR-8): the harness activates only for
 * `dev=1`, and every other value degrades to a safe default instead of
 * throwing, so a hand-typed URL can never break boot.
 */

/** Species ids a solo preset can isolate. */
export type DevSpeciesId = 'trike' | 'stego' | 'brachio';

/** Parsed harness options; the defaults are fully inert. */
export interface DevOptions {
  /** True only when the query contains `dev=1`. */
  enabled: boolean;
  /** Deterministic RNG seed, or null for unseeded randomness. */
  seed: number | null;
  /** Single-visible-dino preset, or null for the full trio. */
  solo: DevSpeciesId | null;
  /** True when the query contains `pause=1`. */
  paused: boolean;
  /** True unless the query contains `overlays=0`. */
  overlays: boolean;
}

const SOLO_IDS: readonly DevSpeciesId[] = ['trike', 'stego', 'brachio'];

/** A seed is a whole base-10 integer, optionally negative — nothing else. */
const SEED_PATTERN = /^-?\d+$/;

/** Parse `seed` as a base-10 integer; empty and junk values mean "unseeded". */
function parseSeed(params: URLSearchParams): number | null {
  const raw = params.get('seed');
  if (raw === null || !SEED_PATTERN.test(raw)) {
    return null;
  }
  // A regex-validated digit string parses to a finite number unless it is far
  // beyond `Number.MAX_SAFE_INTEGER`, where it still stays finite (F7).
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Match `solo` against the three species ids, case-insensitively. */
function parseSolo(params: URLSearchParams): DevSpeciesId | null {
  const raw = params.get('solo');
  if (raw === null) {
    return null;
  }
  const normalized = raw.toLowerCase();
  return SOLO_IDS.find((id) => id === normalized) ?? null;
}

/**
 * Parse a full `location.search` (`?dev=1&seed=42`) or a bare query
 * (`dev=1&seed=42`). Never throws: unknown params and malformed values are
 * ignored.
 */
export function parseDevQuery(search: string): DevOptions {
  const params = new URLSearchParams(search);
  return {
    enabled: params.get('dev') === '1',
    seed: parseSeed(params),
    solo: parseSolo(params),
    paused: params.get('pause') === '1',
    overlays: params.get('overlays') !== '0',
  };
}
