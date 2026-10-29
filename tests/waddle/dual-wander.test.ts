import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { avoidanceNudges } from '../../src/ranch/avoidance.js';
import { DinoPlayer, STEGO_GAIT, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import { DustPool } from '../../src/ranch/dust.js';
import {
  gaitSpeedMetresPerSecond,
  WADDLE_LOOP_SECONDS,
  WALK_BLEND_SECONDS,
} from '../../src/ranch/waddle.js';
import type { GaitParams } from '../../src/ranch/waddle.js';

/**
 * Dual ranch coexistence (FR-5, FR-6, FR-9, AC-3, AC-6): Trike + Stego wander
 * independently from a ±0.4 m spawn with soft-steer avoidance, share one
 * DustPool, and both blink while walking. Mirrors the viewer frame loop
 * (avoid → update) at 60 fps for a simulated 30 s.
 */

/**
 * In-frame ceiling for one gait: the stay-in-frame circle plus the furthest a
 * dino can stray before it can turn around. Past the rim it keeps walking
 * outward through a full half turn — yaw capped at min(turn rate, curvature x
 * speed), plus the 0.2 s blend ramp — so the overshoot scales with the gait's
 * own measured speed rather than with a fixed byte of the old tuning.
 */
function inFrameCeilingMetres(gait: GaitParams): number {
  const speed = gaitSpeedMetresPerSecond(gait);
  const yawRate = Math.min(gait.turnRateRadiansPerSecond, gait.curvatureRadiansPerMetre * speed);
  return gait.wanderRadiusMetres + speed * (Math.PI / yawRate + WALK_BLEND_SECONDS);
}

const DT = 1 / 60;
const STEPS = 30 * 60;
/**
 * Deliberately the tightest boom the old ranch allowed: two bodies starting
 * 0.8 m apart, i.e. both already inside the 1.84 m avoidance trigger on frame
 * zero. The trio spawns 6.43 m apart in production, so this pair is the harder
 * case, not a mirror of boot.
 */
const SPAWN_OFFSET_METRES = 0.4;
/**
 * Design bar for the closest two bodies may come (FR-6). It was temporarily
 * lowered to 0.15 m in phase 4: at the measured strides the pair closes at
 * 1.11 m/s, so the trike-tuned 0.4 m trigger bought 0.36 s — less than the
 * yaw-limited half turn it needs — and the locked draw bottomed out at 0.240 m.
 * Phase 5 raised the trigger to 1.84 m (body clearance plus the ground covered
 * reacting), so the bar is back where it always belonged.
 */
const MIN_SEPARATION_METRES = 0.25;

/**
 * Deterministic PRNG (mulberry32): the sim needs the wander-jitter spread
 * production gets from Math.random — with a constant random the pair flies
 * an exact sustained head-on that no yaw-rate-limited steer can resolve.
 * Fixed seeds keep the run reproducible while drawing representative
 * headings, one independent stream per consumer.
 */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function createRig(name: string): THREE.Group {
  const root = new THREE.Group();
  root.name = name;
  const hips = new THREE.Group();
  hips.name = 'Hips';
  const head = new THREE.Group();
  head.name = 'Head';
  root.add(hips);
  root.add(head);
  return root;
}

function createWaddleClip(): THREE.AnimationClip {
  const track = new THREE.VectorKeyframeTrack(
    'Hips.position',
    [0, 0.4, 0.8],
    [0, 0, 0, 0, 0.05, 0, 0, 0, 0],
  );
  return new THREE.AnimationClip('Waddle', WADDLE_LOOP_SECONDS, [track]);
}

interface DualStats {
  maxDistanceMetres: number;
  minSeparationMetres: number;
  sharedDust: boolean;
  maxDustAlive: number;
}

function runDualWander(
  avoid = true,
  seeds: { dust: number; trike: number; stego: number } = {
    dust: 0xd057,
    trike: 0x7216,
    stego: 0x57e62,
  },
): {
  stats: DualStats;
  trikeDip: number[];
  stegoDip: number[];
  avoidanceFrames: number;
} {
  const trikeRig = createRig('TrikeRoot');
  const stegoRig = createRig('StegoRoot');
  trikeRig.position.set(-SPAWN_OFFSET_METRES, 0, 0);
  stegoRig.position.set(SPAWN_OFFSET_METRES, 0, 0);
  const shared = new DustPool({ random: prng(seeds.dust) });
  const trike = new DinoPlayer(trikeRig, {
    clip: createWaddleClip(),
    gait: TRIKE_GAIT,
    dust: shared,
    random: prng(seeds.trike),
  });
  const stego = new DinoPlayer(stegoRig, {
    clip: createWaddleClip(),
    gait: STEGO_GAIT,
    dust: shared,
    random: prng(seeds.stego),
  });
  // Production-faithful courses: both dinos start on near-parallel +Z tracks
  // with a gentle convergence, the way wander meetings actually happen (an
  // oblique mid-circle crossing, not a sustained dead head-on — no
  // yaw-rate-limited steer can resolve the latter inside a 0.4 m trigger,
  // and the viewer never flies it: both models spawn at heading 0).
  trike.turnTo(0.5);
  stego.turnTo(-0.4);
  trike.setWalking(true);
  stego.setWalking(true);

  let maxDistanceMetres = 0;
  let minSeparationMetres = Number.POSITIVE_INFINITY;
  let maxDustAlive = 0;
  let avoidanceFrames = 0;
  const trikeDip: number[] = [];
  const stegoDip: number[] = [];
  let now = 0;
  for (let step = 0; step < STEPS; step += 1) {
    // Viewer frame order: soft-steer first, then advance both players.
    // With avoid=false the nudges are measured but not applied, so the same
    // draw yields the no-avoidance baseline for the differential proof.
    const { aNudge, bNudge } = avoidanceNudges(
      trikeRig.position.x,
      trikeRig.position.z,
      trike.heading,
      stegoRig.position.x,
      stegoRig.position.z,
      stego.heading,
    );
    if (avoid) {
      if (aNudge !== 0) {
        trike.turnTo(trike.heading + aNudge);
      }
      if (bNudge !== 0) {
        stego.turnTo(stego.heading + bNudge);
      }
    }
    if (aNudge !== 0 || bNudge !== 0) {
      avoidanceFrames += 1;
    }
    trike.update(DT, now);
    stego.update(DT, now);
    now += DT;
    expect(trike.walking).toBe(true);
    expect(stego.walking).toBe(true);
    maxDistanceMetres = Math.max(
      maxDistanceMetres,
      Math.hypot(trikeRig.position.x, trikeRig.position.z),
      Math.hypot(stegoRig.position.x, stegoRig.position.z),
    );
    minSeparationMetres = Math.min(
      minSeparationMetres,
      trikeRig.position.distanceTo(stegoRig.position),
    );
    maxDustAlive = Math.max(maxDustAlive, shared.aliveCount);
    const trikeHead = trikeRig.getObjectByName('Head') ?? trikeRig;
    const stegoHead = stegoRig.getObjectByName('Head') ?? stegoRig;
    trikeDip.push(trikeHead.rotation.x);
    stegoDip.push(stegoHead.rotation.x);
  }
  return {
    stats: {
      maxDistanceMetres,
      minSeparationMetres,
      sharedDust: trike.dust === stego.dust && trike.dust === shared,
      maxDustAlive,
    },
    trikeDip,
    stegoDip,
    avoidanceFrames,
  };
}

describe('dual wander coexistence (FR-5, FR-6, AC-3)', () => {
  it('starts from a ±0.4 m spawn with independent poses', () => {
    const a = createRig('A');
    const b = createRig('B');
    a.position.set(-SPAWN_OFFSET_METRES, 0, 0);
    b.position.set(SPAWN_OFFSET_METRES, 0, 0);
    expect(a.position.distanceTo(b.position)).toBeCloseTo(0.8, 12);
  });

  it('keeps both dinos in-frame over 30 s and clear of each other', () => {
    const { stats, avoidanceFrames } = runDualWander(true);
    // The run must actually exercise avoidance, not stroll two empty lanes.
    expect(avoidanceFrames).toBeGreaterThan(0);
    // Both reach out and roam (not parked), but never escape the circle.
    expect(stats.maxDistanceMetres).toBeGreaterThan(TRIKE_GAIT.wanderRadiusMetres - 0.3);
    const bound = Math.max(inFrameCeilingMetres(TRIKE_GAIT), inFrameCeilingMetres(STEGO_GAIT));
    expect(stats.maxDistanceMetres).toBeLessThanOrEqual(bound);
    expect(stats.minSeparationMetres).toBeGreaterThan(MIN_SEPARATION_METRES);
    // Differential proof: the same draw without avoidance must come closer,
    // so the locked seeds prove avoidance helps in-draw (not a lucky draw).
    const baseline = runDualWander(false);
    expect(baseline.avoidanceFrames).toBeGreaterThan(0);
    expect(stats.minSeparationMetres).toBeGreaterThan(baseline.stats.minSeparationMetres);
  });

  it('avoidance improves separation across fixed draws (review F1)', () => {
    // The absolute >0.25 m bar above applies to the locked draw; this
    // property holds avoidance to a relative bar on every documented draw,
    // so AC-3 rests on more than one geometry. Extra draws carry no absolute
    // bar — they only prove avoidance helps wherever meetings happen.
    const draws = [
      { dust: 0xd057, trike: 0x7216, stego: 0x57e62 },
      { dust: 0xd057, trike: 0x7214, stego: 0x57e60 },
      { dust: 0xd057, trike: 0x7215, stego: 0x57e61 },
    ];
    for (const seeds of draws) {
      const avoided = runDualWander(true, seeds);
      const baseline = runDualWander(false, seeds);
      expect(avoided.avoidanceFrames).toBeGreaterThan(0);
      expect(baseline.avoidanceFrames).toBeGreaterThan(0);
      expect(avoided.stats.minSeparationMetres).toBeGreaterThan(baseline.stats.minSeparationMetres);
    }
  });

  it('shares one DustPool that puffs for both dinos (FR-9, AC-6)', () => {
    const { stats } = runDualWander();
    expect(stats.sharedDust).toBe(true);
    expect(stats.maxDustAlive).toBeGreaterThan(0);
  });

  it('blinks both dinos at least once per 6 s window while walking (AC-6)', () => {
    const { trikeDip, stegoDip } = runDualWander();
    const windowSteps = 6 * 60;
    for (let start = 0; start < STEPS; start += windowSteps) {
      const trikeMax = Math.max(...trikeDip.slice(start, start + windowSteps));
      const stegoMax = Math.max(...stegoDip.slice(start, start + windowSteps));
      expect(trikeMax).toBeGreaterThan(0);
      expect(stegoMax).toBeGreaterThan(0);
    }
  });
});
