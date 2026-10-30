import * as THREE from 'three';
import type { AudioAssetId } from '../audio/catalog.js';
import { DUST_LIFETIME_SECONDS, DustPool } from './dust.js';
import { CORNER_ANCHORS } from './layout.js';
import type { CornerSpecies } from './layout.js';

/**
 * The arrival payoff (FR-7, FR-12, FR-13): what a corner throws up, and what it
 * says, the moment its animal gets there.
 *
 * Three shapes come out of one pool — a ripple ring plus a splash at the wallow,
 * a straw puff at the hay nest, a leaf drift under the browse tree — so the
 * corner reads differently in silhouette as well as in colour (NFR-6). They are
 * decoration: nothing here moves a dino or changes any state the child can see.
 *
 * Everything is driven by the frame's own `dt`, exactly as the dust and the
 * sparkle pool are, so a paused frame (`dt` of 0) freezes it and a reduced-motion
 * frame settles it instead of animating it (FR-15). One burst per arrival, and
 * never a second while the first is still in the air (AC-12).
 *
 * No DOM, no renderer and no audio engine: the sound goes out through the sink
 * the caller supplies, which is the viewer's `playFeedback`, so the gesture gate,
 * mute and the ducking all stay in the one place that already owns them.
 */

/** The shape a corner's arrival throws up (FR-12). */
export type ArrivalEffect = 'ripple' | 'straw' | 'leaf';

/**
 * One shape per corner: the wallow ripples, the nest puffs straw, the browse
 * tree drops leaves (FR-7, FR-12).
 */
export const ARRIVAL_EFFECTS: Readonly<Record<CornerSpecies, ArrivalEffect>> = {
  trike: 'straw',
  stego: 'ripple',
  brachio: 'leaf',
};

/** FR-13: the coo each species answers its arrival with, once. */
export const ARRIVAL_COO: Readonly<Record<CornerSpecies, AudioAssetId>> = {
  trike: 'coo-trike',
  stego: 'coo-stego',
  brachio: 'coo-brachio',
};

/** FR-13: the splash at the wallow rides the existing tap SFX. */
export const SPLASH_SOUND: AudioAssetId = 'tap';

/** Where an arrival's sound goes: the viewer's `playFeedback`. */
export type ArrivalSoundSink = (id: AudioAssetId) => void;

/** Points around the mud ripple's ring. */
export const RIPPLE_RING_POINTS = 12;
/** How far out the ripple's ring starts, in metres — inside the 1.25 m mud disc. */
export const RIPPLE_RING_RADIUS_METRES = 0.6;
/** Particles per ripple point: enough for a line, few enough to read. */
export const RIPPLE_PARTICLES_PER_POINT = 2;
/** Droplets thrown up from the middle of the splash. */
export const SPLASH_PARTICLES = 12;

/** Straw in the middle of the nest. */
export const STRAW_PUFF_PARTICLES = 10;
/** Points ringing the straw puff, and particles at each. */
export const STRAW_RING_POINTS = 4;
export const STRAW_RING_RADIUS_METRES = 0.35;
export const STRAW_PARTICLES_PER_POINT = 2;

/** Leaves fall along an arc rather than in a ring: wind carries them one way. */
export const LEAF_DRIFT_POINTS = 5;
export const LEAF_DRIFT_PARTICLES_PER_POINT = 4;
export const LEAF_DRIFT_NEAR_METRES = 0.5;
export const LEAF_DRIFT_FAR_METRES = 1.1;
/** The arc's own start and sweep, in radians. */
export const LEAF_DRIFT_ARC_START_RADIANS = -Math.PI / 3;
export const LEAF_DRIFT_ARC_RADIANS = (Math.PI * 2) / 3;

/**
 * The most particles one arrival may ask of the pool, which is the wallow's
 * ring plus its splash. It must stay inside the pool's fixed budget: an arrival
 * that overran it would recycle the ring's own particles mid-burst.
 */
export const ARRIVAL_PEAK_PARTICLES =
  RIPPLE_RING_POINTS * RIPPLE_PARTICLES_PER_POINT + SPLASH_PARTICLES;

export interface ArrivalEffectsOptions {
  /** Where the coo and the splash go; the viewer passes `playFeedback`. */
  readonly playSound: ArrivalSoundSink;
  /**
   * The dust sprite, so this pool and the shared walk dust are one texture and
   * one image rather than two (NFR-3). Omitted, the pool bakes its own.
   */
  readonly texture?: THREE.Texture;
  /** Seeded stream for the particle scatter, so a seeded run replays it. */
  readonly random?: () => number;
}

/**
 * The three corners' arrival effects (FR-12), all from one preallocated pool:
 * a single extra draw call, a fixed particle budget, no new asset.
 */
export class ArrivalEffects {
  /** The pool's single `THREE.Points`, for the scene to add once. */
  readonly pool: DustPool;
  private readonly playSound: ArrivalSoundSink;
  /** Scratch ground point: an arrival allocates no vector. */
  private readonly scratch = new THREE.Vector3();
  private reducedMotion = false;
  private lastEffect: ArrivalEffect | null = null;

  constructor(options: ArrivalEffectsOptions) {
    this.playSound = options.playSound;
    this.pool = new DustPool({ texture: options.texture, random: options.random });
    // Named so the harness, the draw-call count and the walk dust can be told
    // apart: `RanchDust` is the trio's footfall pool, this one is the payoff.
    this.pool.points.name = 'RanchArrivalDust';
    this.pool.points.renderOrder = 5;
  }

  /** The one draw call these effects cost. */
  get points(): THREE.Points {
    return this.pool.points;
  }

  /** How many arrival particles are in the air right now (AC-12). */
  get aliveCount(): number {
    return this.pool.aliveCount;
  }

  /** The shape the last arrival asked for, or null before the first one. */
  get effect(): ArrivalEffect | null {
    return this.lastEffect;
  }

  /**
   * One animal has arrived: say its coo, and throw up its corner's shape.
   *
   * The sound always goes out — a second animal arriving while the first
   * animal's particles are still in the air still gets its own coo — but the
   * burst is skipped when one is already alive, so a burst can never be
   * restarted on top of itself (AC-12). Under reduced motion nothing is emitted
   * at all: the arrival settles in the same frame the animal stops (FR-15).
   *
   * Returns whether a burst was emitted, which is what the tests read.
   */
  arrive(species: CornerSpecies): boolean {
    this.playSound(ARRIVAL_COO[species]);
    const effect = ARRIVAL_EFFECTS[species];
    this.lastEffect = effect;
    if (this.reducedMotion || this.pool.aliveCount > 0) {
      return false;
    }
    const anchor = CORNER_ANCHORS[species].anchor;
    if (effect === 'ripple') {
      this.ring(
        anchor[0],
        anchor[1],
        RIPPLE_RING_RADIUS_METRES,
        RIPPLE_RING_POINTS,
        RIPPLE_PARTICLES_PER_POINT,
      );
      this.at(anchor[0], anchor[1], SPLASH_PARTICLES);
      this.playSound(SPLASH_SOUND);
      return true;
    }
    if (effect === 'straw') {
      this.at(anchor[0], anchor[1], STRAW_PUFF_PARTICLES);
      this.ring(
        anchor[0],
        anchor[1],
        STRAW_RING_RADIUS_METRES,
        STRAW_RING_POINTS,
        STRAW_PARTICLES_PER_POINT,
      );
      return true;
    }
    this.arc(anchor[0], anchor[1]);
    return true;
  }

  /**
   * Advance the effects by one frame. A reduced-motion frame retires whatever is
   * still in the air instead of animating it — one call, and the pool is empty
   * on that frame rather than a ripple frozen mid-spread (FR-15).
   */
  update(dtSeconds: number, reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    if (reducedMotion) {
      if (this.pool.aliveCount > 0) {
        // Past every particle's lifetime, so the pool retires all of them at
        // once: the arrival is over the moment motion is off.
        this.pool.update(DUST_LIFETIME_SECONDS);
      }
      return;
    }
    this.pool.update(dtSeconds);
  }

  /** One puff at a ground point. */
  private at(x: number, z: number, count: number): void {
    this.scratch.set(x, 0, z);
    this.pool.puff(this.scratch, count);
  }

  /** Puffs evenly around a circle on the ground. */
  private ring(x: number, z: number, radiusMetres: number, points: number, perPoint: number): void {
    for (let index = 0; index < points; index += 1) {
      const angle = (index / points) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      this.at(x + cos * radiusMetres, z + sin * radiusMetres, perPoint);
    }
  }

  /** Puffs along an arc that widens outward, which is how leaves fall. */
  private arc(x: number, z: number): void {
    for (let index = 0; index < LEAF_DRIFT_POINTS; index += 1) {
      const along = index / (LEAF_DRIFT_POINTS - 1);
      const angle = LEAF_DRIFT_ARC_START_RADIANS + along * LEAF_DRIFT_ARC_RADIANS;
      const radius =
        LEAF_DRIFT_NEAR_METRES + along * (LEAF_DRIFT_FAR_METRES - LEAF_DRIFT_NEAR_METRES);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      this.at(x + cos * radius, z + sin * radius, LEAF_DRIFT_PARTICLES_PER_POINT);
    }
  }
}
