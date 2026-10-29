/**
 * Machine-readable ranch snapshot (FR-7, AC-8): the DOM-free, renderer-free
 * projection behind `window.__ranch.snapshot()`.
 */

/** Species ids the trio reports. */
export type SpeciesId = 'trike' | 'stego' | 'brachio';

/** One dino's externally observable state. */
export interface SnapshotDino {
  id: SpeciesId;
  label: string;
  visible: boolean;
  rigged: boolean;
  x: number;
  z: number;
  heading: number;
  walking: boolean;
}

/** Ground-plane distance between one unordered dino pair. */
export interface SnapshotPair {
  a: SpeciesId;
  b: SpeciesId;
  distance: number;
}

/** Documented snapshot shape published on `window.__ranch`. */
export interface DevSnapshot {
  walking: boolean;
  paused: boolean;
  pov: 'ranch' | 'nest' | 'garden';
  sleepy: 'awake' | 'drowsy' | 'sleepy';
  fps: number;
  dinos: SnapshotDino[];
  pairs: SnapshotPair[];
  minSeparation: number | null;
}

/**
 * Project the scene fields plus live dino handles into the documented
 * snapshot shape. Every unordered pair appears once in `dinos` order, using
 * `Math.hypot` on x/z only (the ground plane); `minSeparation` is the smallest
 * pair distance, or null with fewer than two dinos. Inputs are copied, never
 * mutated.
 */
export function buildSnapshot(input: {
  walking: boolean;
  paused: boolean;
  pov: 'ranch' | 'nest' | 'garden';
  sleepy: 'awake' | 'drowsy' | 'sleepy';
  fps: number;
  dinos: SnapshotDino[];
}): DevSnapshot {
  const dinos = input.dinos.map((dino) => ({ ...dino }));
  const pairs: SnapshotPair[] = [];
  for (let i = 0; i < dinos.length; i += 1) {
    for (let j = i + 1; j < dinos.length; j += 1) {
      const a = dinos[i];
      const b = dinos[j];
      pairs.push({
        a: a.id,
        b: b.id,
        distance: Math.hypot(a.x - b.x, a.z - b.z),
      });
    }
  }
  let minSeparation: number | null = null;
  for (const pair of pairs) {
    if (minSeparation === null || pair.distance < minSeparation) {
      minSeparation = pair.distance;
    }
  }
  return {
    walking: input.walking,
    paused: input.paused,
    pov: input.pov,
    sleepy: input.sleepy,
    fps: input.fps,
    dinos,
    pairs,
    minSeparation,
  };
}
