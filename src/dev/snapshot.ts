/**
 * Machine-readable ranch snapshot (FR-7, AC-8): the DOM-free, renderer-free
 * projection behind `window.__ranch.snapshot()`.
 */

import type { VisitSnapshot, VisitState } from '../ranch/visit.js';
import type { PovPresetId } from '../viewer/pov.js';

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

/**
 * One animal's visit state (FR-14, AC-14).
 *
 * Every field is either the director's own reading or measured from the
 * reported position — nothing here is inferred. An animal whose rig has not
 * registered with the director yet reports `state: 'unknown'` and nulls rather
 * than a confident `idle` it cannot back up: a snapshot that says an animal is
 * home while it stands at its corner is worse than no field at all.
 */
export interface SnapshotVisit {
  species: SpeciesId;
  /** The director's state, or 'unknown' while the animal is not registered. */
  state: VisitState | 'unknown';
  /** Seconds spent in the current state; null while unknown. */
  secondsInState: number | null;
  /** Seeded seconds until this animal's next autonomous visit; null while unknown. */
  secondsUntilVisit: number | null;
  /** Journeys begun since boot; null while unknown. */
  visitsStarted: number | null;
  /** Arrivals reached since boot; null while unknown. */
  arrivals: number | null;
  /** The corner this animal owns, in ground metres; null while unknown. */
  corner: { x: number; z: number } | null;
  /** The corner's published arrival radius, in metres; null while unknown. */
  arrivalRadiusMetres: number | null;
  /** Ground distance from the animal to that corner, in metres; null while unknown. */
  distanceToCorner: number | null;
}

/** Ground-plane distance between one unordered dino pair. */
export interface SnapshotPair {
  a: SpeciesId;
  b: SpeciesId;
  distance: number;
}

/** Audio state published beside the scene fields (FR-10). */
export interface SnapshotAudio {
  unlocked: boolean;
  muted: boolean;
  volume: number;
  musicPlaying: boolean;
  activeLine: string | null;
  /** Dispatch latency of the last voice start, in ms (not DAC onset). */
  lastStartLatencyMs: number;
}

/** Documented snapshot shape published on `window.__ranch`. */
export interface DevSnapshot {
  walking: boolean;
  paused: boolean;
  pov: PovPresetId;
  sleepy: 'awake' | 'drowsy' | 'sleepy';
  fps: number;
  /** Draw calls the renderer issued for the last frame (AC-8, measured). */
  drawCalls: number;
  /** Triangles the renderer submitted for the last frame (AC-8, measured). */
  triangles: number;
  dinos: SnapshotDino[];
  /** One record per animal, in `dinos` order (FR-14, AC-14). */
  visits: SnapshotVisit[];
  pairs: SnapshotPair[];
  minSeparation: number | null;
  audio: SnapshotAudio;
}

/** One animal the projection can describe: where it stands, and its corner. */
export interface VisitBody {
  readonly id: SpeciesId;
  readonly x: number;
  readonly z: number;
}

/**
 * Project the director's own snapshots plus the live positions into the
 * documented visit block (FR-14, AC-14).
 *
 * `bodies` decides the output: every animal the harness can see gets a record,
 * whether or not the director knows it yet, so the block is always total and a
 * missing registration reads as `unknown` rather than vanishing. `corner` is
 * the director's anchor and `distanceToCorner` is measured from the position
 * the same snapshot reports, so a caller can check "at the corner" with
 * `distanceToCorner <= arrivalRadiusMetres` instead of trusting a boolean.
 */
export function visitStates(
  snapshots: readonly VisitSnapshot[],
  bodies: readonly VisitBody[],
): SnapshotVisit[] {
  return bodies.map((body) => {
    const snapshot = snapshots.find((item) => item.species === body.id);
    if (snapshot === undefined) {
      return {
        species: body.id,
        state: 'unknown',
        secondsInState: null,
        secondsUntilVisit: null,
        visitsStarted: null,
        arrivals: null,
        corner: null,
        arrivalRadiusMetres: null,
        distanceToCorner: null,
      };
    }
    const corner = { x: snapshot.corner.anchor[0], z: snapshot.corner.anchor[1] };
    return {
      species: body.id,
      state: snapshot.state,
      secondsInState: snapshot.secondsInState,
      secondsUntilVisit: snapshot.secondsUntilVisit,
      visitsStarted: snapshot.visitsStarted,
      arrivals: snapshot.arrivals,
      corner,
      arrivalRadiusMetres: snapshot.corner.arrivalRadiusMetres,
      distanceToCorner: Math.hypot(body.x - corner.x, body.z - corner.z),
    };
  });
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
  pov: PovPresetId;
  sleepy: 'awake' | 'drowsy' | 'sleepy';
  fps: number;
  drawCalls: number;
  triangles: number;
  dinos: SnapshotDino[];
  visits: SnapshotVisit[];
  audio: SnapshotAudio;
}): DevSnapshot {
  const dinos = input.dinos.map((dino) => ({ ...dino }));
  const visits = input.visits.map((visit) => ({
    ...visit,
    corner: visit.corner === null ? null : { ...visit.corner },
  }));
  const audio: SnapshotAudio = { ...input.audio };
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
    drawCalls: input.drawCalls,
    triangles: input.triangles,
    dinos,
    visits,
    pairs,
    minSeparation,
    audio,
  };
}
