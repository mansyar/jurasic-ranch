import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DUST_POOL_SIZE } from '../../src/ranch/dust.js';
import { CORNER_ANCHORS } from '../../src/ranch/layout.js';
import type { CornerSpecies } from '../../src/ranch/layout.js';
import {
  ARRIVAL_COO,
  ARRIVAL_EFFECTS,
  ARRIVAL_PEAK_PARTICLES,
  ArrivalEffects,
  LEAF_DRIFT_NEAR_METRES,
  RIPPLE_RING_RADIUS_METRES,
  SPLASH_SOUND,
  STRAW_RING_RADIUS_METRES,
} from '../../src/ranch/visit-effects.js';

const DT = 1 / 60;
const SPECIES: readonly CornerSpecies[] = ['trike', 'stego', 'brachio'];

/** Two seconds, in frames: the ceiling AC-12 puts on a burst's life. */
const TWO_SECONDS_OF_FRAMES = 120;

function createEffects(sink: string[] = []): ArrivalEffects {
  return new ArrivalEffects({
    playSound: (id) => {
      sink.push(id);
    },
    random: () => 0.5,
  });
}

/** The farthest live particle from a corner's anchor, in metres. */
function spreadMetres(effects: ArrivalEffects, species: CornerSpecies): number {
  const anchor = CORNER_ANCHORS[species].anchor;
  const attribute = effects.points.geometry.getAttribute('position');
  let farthest = 0;
  for (let index = 0; index < attribute.count; index += 1) {
    // Parked particles sit far below the ground plane; live ones are above it.
    if (attribute.getY(index) < 0) {
      continue;
    }
    const offX = attribute.getX(index) - anchor[0];
    const offZ = attribute.getZ(index) - anchor[1];
    farthest = Math.max(farthest, Math.hypot(offX, offZ));
  }
  return farthest;
}

function settledSpread(species: CornerSpecies): number {
  const effects = createEffects();
  effects.update(DT, false);
  effects.arrive(species);
  return spreadMetres(effects, species);
}

describe('arrival effects (P5.T2, FR-12, AC-12)', () => {
  it('gives each corner its own shape and its own coo (FR-7, FR-13)', () => {
    expect(ARRIVAL_EFFECTS.trike).toBe('straw');
    expect(ARRIVAL_EFFECTS.stego).toBe('ripple');
    expect(ARRIVAL_EFFECTS.brachio).toBe('leaf');
    expect(ARRIVAL_COO.trike).toBe('coo-trike');
    expect(ARRIVAL_COO.stego).toBe('coo-stego');
    expect(ARRIVAL_COO.brachio).toBe('coo-brachio');
  });

  it('throws up one burst per arrival, and the pool is empty inside 2 s', () => {
    const effects = createEffects();
    effects.update(DT, false);
    expect(effects.arrive('stego')).toBe(true);
    expect(effects.aliveCount).toBe(ARRIVAL_PEAK_PARTICLES);

    let frames = 0;
    while (effects.aliveCount > 0 && frames < TWO_SECONDS_OF_FRAMES) {
      effects.update(DT, false);
      frames += 1;
    }
    expect(frames).toBeLessThanOrEqual(TWO_SECONDS_OF_FRAMES);
    expect(effects.aliveCount).toBe(0);

    // AC-12's second half: nothing emits once the burst has died.
    for (let index = 0; index < TWO_SECONDS_OF_FRAMES; index += 1) {
      effects.update(DT, false);
    }
    expect(effects.aliveCount).toBe(0);
  });

  it('never restarts a burst that is still in the air', () => {
    const sink: string[] = [];
    const effects = createEffects(sink);
    effects.update(DT, false);
    expect(effects.arrive('stego')).toBe(true);
    const alive = effects.aliveCount;

    // A second animal arrives while the wallow's ring is still up: it gets its
    // own coo, but the burst is not restarted on top of itself.
    expect(effects.arrive('trike')).toBe(false);
    expect(effects.aliveCount).toBe(alive);
    expect(sink).toEqual(['coo-stego', SPLASH_SOUND, 'coo-trike']);
  });

  it('keeps one arrival inside the pool budget, so a burst never recycles itself', () => {
    expect(ARRIVAL_PEAK_PARTICLES).toBeLessThanOrEqual(DUST_POOL_SIZE);
    const effects = createEffects();
    effects.update(DT, false);
    effects.arrive('stego');
    expect(effects.aliveCount).toBe(ARRIVAL_PEAK_PARTICLES);
  });

  it('says the species coo once, and the splash only at the wallow (FR-13)', () => {
    for (const species of SPECIES) {
      const sink: string[] = [];
      const effects = createEffects(sink);
      effects.update(DT, false);
      effects.arrive(species);
      const coo = ARRIVAL_COO[species];
      const expected = species === 'stego' ? [coo, SPLASH_SOUND] : [coo];
      expect(sink, species).toEqual(expected);
      expect(effects.effect).toBe(ARRIVAL_EFFECTS[species]);
    }
  });

  it('reads as three different shapes, not one shape in three places', () => {
    const straw = settledSpread('trike');
    const ripple = settledSpread('stego');
    const leaf = settledSpread('brachio');

    // Each shape keeps its own radius, and each is wider than the one inside it:
    // a tight puff at the nest, a ring across the mud, leaves falling further out.
    expect(straw).toBeGreaterThanOrEqual(STRAW_RING_RADIUS_METRES);
    expect(ripple).toBeGreaterThanOrEqual(RIPPLE_RING_RADIUS_METRES);
    expect(leaf).toBeGreaterThanOrEqual(LEAF_DRIFT_NEAR_METRES);
    expect(ripple).toBeGreaterThan(straw);
    expect(leaf).toBeGreaterThan(ripple);
  });

  it('settles the arrival in a single reduced-motion frame (FR-15)', () => {
    const sink: string[] = [];
    const effects = createEffects(sink);
    effects.update(DT, true);

    // Reduced motion: no ripple, no drift — but the coo still answers the child.
    expect(effects.arrive('stego')).toBe(false);
    expect(effects.aliveCount).toBe(0);
    expect(sink).toEqual(['coo-stego']);

    // A burst already in the air is retired on the frame motion goes off, not
    // left frozen mid-spread.
    const live = createEffects();
    live.update(DT, false);
    live.arrive('brachio');
    expect(live.aliveCount).toBeGreaterThan(0);
    live.update(DT, true);
    expect(live.aliveCount).toBe(0);
  });

  it('holds still on a paused frame, like the rest of the ranch', () => {
    const effects = createEffects();
    effects.update(DT, false);
    effects.arrive('stego');
    const alive = effects.aliveCount;
    for (let index = 0; index < 30; index += 1) {
      effects.update(0, false);
    }
    expect(effects.aliveCount).toBe(alive);
  });

  it('shares the walk dust sprite and carries a name of its own', () => {
    const texture = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const effects = new ArrivalEffects({ playSound: () => {}, texture });
    expect(effects.points.name).toBe('RanchArrivalDust');
    const material = effects.points.material;
    expect(material instanceof THREE.PointsMaterial).toBe(true);
    if (material instanceof THREE.PointsMaterial) {
      expect(material.map).toBe(texture);
    }
  });
});
