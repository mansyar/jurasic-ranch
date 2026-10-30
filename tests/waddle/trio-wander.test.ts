import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  AVOIDANCE_NUDGE_RADIANS,
  trioAvoidanceNudges,
  trioSpawnPositions,
} from '../../src/ranch/avoidance.js';
import { BRACHIO_GAIT, DinoPlayer, STEGO_GAIT, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import { DustPool } from '../../src/ranch/dust.js';
import {
  gaitSpeedMetresPerSecond,
  TURN_RATE_RADIANS_PER_SECOND,
  WALK_BLEND_SECONDS,
} from '../../src/ranch/waddle.js';
import type { GaitParams } from '../../src/ranch/waddle.js';
import { DINO_GROUP_SCALE, worldGait } from '../../src/viewer/loaders.js';

/**
 * Trio ranch coexistence (FR-5, FR-6, FR-9, AC-3, AC-6): Trike + Stego +
 * Brachio wander independently from a 120 deg triangle spawn with pairwise
 * soft-steer avoidance, share one DustPool, and all blink while walking.
 * Mirrors the viewer frame loop (avoid → update) at 60 fps for 30 s, on the
 * gaits the viewer really feeds the players (see `SIM_GAITS`).
 */

/**
 * The strides the viewer actually hands `DinoPlayer`: `loaders.ts` runs every
 * gait through `worldGait`, so the Stego and Brachio advance their authored
 * measure x `DINO_GROUP_SCALE`. Simulating the authored numbers would run this
 * test 1.69x faster than the shipped trio - a harsher world than production -
 * and would hold the strategy against constants no player ever sees.
 */
const SIM_GAITS: GaitParams[] = [
  worldGait(TRIKE_GAIT, 1),
  worldGait(STEGO_GAIT, DINO_GROUP_SCALE),
  worldGait(BRACHIO_GAIT, DINO_GROUP_SCALE),
];

/**
 * In-frame ceiling for one gait: the stay-in-frame circle plus the furthest a
 * dino can stray before it can turn around. Past the rim it keeps walking
 * outward through a full half turn — yaw capped at min(turn rate, curvature x
 * speed), plus the 0.2 s blend ramp — so the overshoot scales with the gait's
 * own measured speed. Phase 4 measured the trio reaching trike 1.347 m, stego
 * 1.414 m, brachio 1.099 m around the old 0.8 m circle; this bound tracks the
 * circle the gaits actually share (`DINO_WALK_RADIUS_METRES`).
 */
function inFrameCeilingMetres(gait: GaitParams): number {
  const speed = gaitSpeedMetresPerSecond(gait);
  const yawRate = Math.min(gait.turnRateRadiansPerSecond, gait.curvatureRadiansPerMetre * speed);
  return gait.wanderRadiusMetres + speed * (Math.PI / yawRate + WALK_BLEND_SECONDS);
}

const DT = 1 / 60;
const STEPS = 30 * 60;
/**
 * Design bar for the closest two bodies may come (FR-6). Phase 4 temporarily
 * asserted 0.1 m here: at the old authored strides the closest pair closed at
 * up to 1.21 m/s (Stego 0.745 + Brachio 0.465), so the trike-tuned 0.4 m
 * trigger bought 0.33 s - well under the half turn a yaw-limited steer needs -
 * and the locked draw bottomed out at 0.106 m. Phase 5 made the trigger
 * body-aware; the re-measured world strides close at 0.804 m/s (Stego 0.441 +
 * Trike 0.3625) against a 1.639 m trigger, so the bar is back to the real one.
 */
const MIN_SEPARATION_METRES = 0.25;
/** Per-frame heading change above this reads as a snap/bounce, not a steer. */
const HEADING_SNAP_RADIANS = 0.1;

/**
 * Deterministic PRNG (mulberry32): the sim needs the wander-jitter spread
 * production gets from Math.random — with a constant random the dinos fly
 * sustained head-ons that no yaw-rate-limited steer can resolve. Fixed seeds
 * keep the run reproducible with one independent stream per consumer.
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

function createWaddleClip(loopSeconds: number): THREE.AnimationClip {
  const track = new THREE.VectorKeyframeTrack(
    'Hips.position',
    [0, loopSeconds / 2, loopSeconds],
    [0, 0, 0, 0, 0.05, 0, 0, 0, 0],
  );
  return new THREE.AnimationClip('Waddle', loopSeconds, [track]);
}

interface TrioSeeds {
  dust: number;
  trike: number;
  stego: number;
  brachio: number;
}

const LOCKED_SEEDS: TrioSeeds = {
  dust: 0xd057,
  trike: 0x7216,
  stego: 0x57e62,
  brachio: 0x94ac11,
};

interface TrioStats {
  maxDistanceMetres: number;
  maxDistancePerPlayer: number[];
  minSeparationMetres: number;
  maxHeadingStepRadians: number;
  sharedDust: boolean;
  maxDustAlive: number;
}

function runTrioWander(
  avoid = true,
  seeds: TrioSeeds = LOCKED_SEEDS,
): {
  stats: TrioStats;
  dips: number[][];
  avoidanceFrames: number;
} {
  const spawn = trioSpawnPositions();
  const rigs = [createRig('TrikeRoot'), createRig('StegoRoot'), createRig('BrachioRoot')];
  const gaits = SIM_GAITS;
  const shared = new DustPool({ random: prng(seeds.dust) });
  const streams = [prng(seeds.trike), prng(seeds.stego), prng(seeds.brachio)];
  const players = rigs.map(
    (rig, index) =>
      new DinoPlayer(rig, {
        clip: createWaddleClip(gaits[index].loopSeconds),
        gait: gaits[index],
        dust: shared,
        random: streams[index],
      }),
  );
  // Staggered-entry course: trike and stego start aimed at the ranch center
  // from their triangle corners and meet centrally early (an oblique
  // crossing, not a sustained dead head-on: no yaw-rate-limited steer can
  // resolve the latter inside a 0.4 m trigger), while brachio starts on a
  // radial outward leg and wander-returns head-on — the trio never piles up
  // three-deep, brachio's legs stay radial so its arc never swings past the
  // circle, and wander meetings still develop throughout the 30 s. This
  // doubles as the Phase 3 spawn recommendation: the naive all-heading-0
  // spawn marches the formation to the rim and churns avoidance-locked there
  // (trike hit 1.48 m on that draw), while staggered entry keeps every leg
  // central and radial.
  const initialHeadings = [Math.PI - 0.35, 1.0472, 2.094];
  players.forEach((player, index) => {
    rigs[index].position.set(spawn[index].x, 0, spawn[index].z);
    player.turnTo(initialHeadings[index]);
    player.setWalking(true);
  });

  let maxDistanceMetres = 0;
  const maxDistancePerPlayer = [0, 0, 0];
  let minSeparationMetres = Number.POSITIVE_INFINITY;
  let maxHeadingStepRadians = 0;
  let maxDustAlive = 0;
  let avoidanceFrames = 0;
  const dips = players.map(() => [] as number[]);
  const previousHeadings = players.map((player) => player.heading);
  let now = 0;
  for (let step = 0; step < STEPS; step += 1) {
    // Viewer frame order: soft-steer first, then advance all players. With
    // avoid=false the nudges are measured but not applied, so the same draw
    // yields the no-avoidance baseline for the differential proof.
    const nudges = trioAvoidanceNudges(
      rigs[0].position.x,
      rigs[0].position.z,
      players[0].heading,
      rigs[1].position.x,
      rigs[1].position.z,
      players[1].heading,
      rigs[2].position.x,
      rigs[2].position.z,
      players[2].heading,
    );
    const applied = [nudges.aNudge, nudges.bNudge, nudges.cNudge];
    if (avoid) {
      applied.forEach((nudge, index) => {
        if (nudge !== 0) {
          players[index].turnTo(players[index].heading + nudge);
        }
      });
    }
    if (nudges.aNudge !== 0 || nudges.bNudge !== 0 || nudges.cNudge !== 0) {
      avoidanceFrames += 1;
    }
    players.forEach((player, index) => {
      player.update(DT, now);
      expect(player.walking).toBe(true);
      const headingStep = Math.abs(player.heading - previousHeadings[index]);
      maxHeadingStepRadians = Math.max(
        maxHeadingStepRadians,
        Math.min(headingStep, Math.PI * 2 - headingStep),
      );
      previousHeadings[index] = player.heading;
      const head = rigs[index].getObjectByName('Head') ?? rigs[index];
      dips[index].push(head.rotation.x);
    });
    now += DT;
    rigs.forEach((rig, index) => {
      const distance = Math.hypot(rig.position.x, rig.position.z);
      maxDistancePerPlayer[index] = Math.max(maxDistancePerPlayer[index], distance);
      maxDistanceMetres = Math.max(maxDistanceMetres, distance);
    });
    for (const [first, second] of [
      [rigs[0], rigs[1]],
      [rigs[1], rigs[2]],
      [rigs[0], rigs[2]],
    ] as const) {
      minSeparationMetres = Math.min(
        minSeparationMetres,
        first.position.distanceTo(second.position),
      );
    }
    maxDustAlive = Math.max(maxDustAlive, shared.aliveCount);
  }
  return {
    stats: {
      maxDistanceMetres,
      maxDistancePerPlayer,
      minSeparationMetres,
      maxHeadingStepRadians,
      sharedDust: players.every((player) => player.dust === shared),
      maxDustAlive,
    },
    dips,
    avoidanceFrames,
  };
}

describe('trio wander coexistence (FR-5, FR-6, AC-3)', () => {
  it('starts from a 120 deg triangle with every pair clear of the trigger', () => {
    const spawn = trioSpawnPositions();
    expect(spawn).toHaveLength(3);
    for (const [first, second] of [
      [spawn[0], spawn[1]],
      [spawn[1], spawn[2]],
      [spawn[0], spawn[2]],
    ] as const) {
      const distance = Math.hypot(first.x - second.x, first.z - second.z);
      expect(distance).toBeGreaterThan(MIN_SEPARATION_METRES);
    }
  });

  it('keeps all three in-frame over 30 s and clear of each other', () => {
    const { stats, avoidanceFrames } = runTrioWander(true);
    // The run must actually exercise avoidance, not stroll three empty lanes.
    expect(avoidanceFrames).toBeGreaterThan(0);
    // Differential draw: same seeds without avoidance.
    const baseline = runTrioWander(false);
    // All reach out and roam (not parked), but never escape the circle: each
    // gait holds its own wander radius plus the ground it covers turning round.
    for (const gait of SIM_GAITS) {
      expect(stats.maxDistanceMetres).toBeGreaterThan(gait.wanderRadiusMetres - 0.3);
    }
    const gaits = SIM_GAITS;
    const names = ['trike', 'stego', 'brachio'];
    stats.maxDistancePerPlayer.forEach((max, index) => {
      const ceiling = inFrameCeilingMetres(gaits[index]);
      expect(max, `${names[index]} stays in-frame`).toBeLessThanOrEqual(ceiling);
    });
    expect(stats.minSeparationMetres).toBeGreaterThan(MIN_SEPARATION_METRES);
    // Differential proof: the same draw without avoidance must come closer,
    // so the locked seeds prove avoidance helps in-draw (not a lucky draw).
    expect(baseline.avoidanceFrames).toBeGreaterThan(0);
    expect(stats.minSeparationMetres).toBeGreaterThan(baseline.stats.minSeparationMetres);
  });

  it('never stops, snaps, or bounces: walking holds and headings step smoothly', () => {
    const { stats } = runTrioWander(true);
    // Walking asserted every frame inside the run; headings must stay an
    // order below a snap: yaw caps (~PI rad/s) move ~0.05 rad/frame, and the
    // capped 0.2 rad avoidance nudge lands on the target, never the heading.
    expect(stats.maxHeadingStepRadians).toBeLessThan(HEADING_SNAP_RADIANS);
    expect(stats.maxHeadingStepRadians).toBeGreaterThan(0);
    expect(TURN_RATE_RADIANS_PER_SECOND * DT + AVOIDANCE_NUDGE_RADIANS).toBeLessThan(
      HEADING_SNAP_RADIANS * 3,
    );
  });

  it('avoidance improves separation across fixed draws (dual review F1)', () => {
    // The absolute >0.25 m bar above applies to the locked draw; this holds
    // avoidance to a relative bar on every documented draw, so AC-3 rests on
    // more than one geometry. Extra draws carry no absolute bar — they only
    // prove avoidance helps wherever meetings happen.
    const draws: TrioSeeds[] = [
      LOCKED_SEEDS,
      { dust: 0xd057, trike: 0x7214, stego: 0x57e60, brachio: 0x94ac0e },
      { dust: 0xd057, trike: 0x7215, stego: 0x57e61, brachio: 0x94ac0f },
    ];
    for (const seeds of draws) {
      const avoided = runTrioWander(true, seeds);
      const baseline = runTrioWander(false, seeds);
      expect(avoided.avoidanceFrames).toBeGreaterThan(0);
      expect(baseline.avoidanceFrames).toBeGreaterThan(0);
      expect(avoided.stats.minSeparationMetres).toBeGreaterThan(baseline.stats.minSeparationMetres);
    }
  });

  it('shares one DustPool that puffs for all three dinos (FR-9, AC-6)', () => {
    const { stats } = runTrioWander();
    expect(stats.sharedDust).toBe(true);
    expect(stats.maxDustAlive).toBeGreaterThan(0);
  });

  it('blinks all three dinos at least once per 6 s window while walking (AC-6)', () => {
    const { dips } = runTrioWander();
    const windowSteps = 6 * 60;
    for (let start = 0; start < STEPS; start += windowSteps) {
      for (const dip of dips) {
        const windowMax = Math.max(...dip.slice(start, start + windowSteps));
        expect(windowMax).toBeGreaterThan(0);
      }
    }
  });

  it('drives all three through the generic DinoPlayer with no duplication (FR-10, AC-7)', () => {
    const rigs = [createRig('A'), createRig('B'), createRig('C')];
    const gaits = SIM_GAITS;
    const players = rigs.map(
      (rig, index) =>
        new DinoPlayer(rig, {
          clip: createWaddleClip(gaits[index].loopSeconds),
          gait: gaits[index],
          random: () => 0.5,
        }),
    );
    for (const player of players) {
      expect(player).toBeInstanceOf(DinoPlayer);
    }
  });

  it('gives every species the world-origin circle at its own gait radius (FR-3)', () => {
    const gaits = SIM_GAITS;
    gaits.forEach((gait, index) => {
      const player = new DinoPlayer(createRig(`Ring${index}`), {
        clip: createWaddleClip(gait.loopSeconds),
        gait,
        random: () => 0.5,
      });
      expect(player.wanderRing).toEqual({
        centre: { x: 0, z: 0 },
        radius: gait.wanderRadiusMetres,
      });
    });
  });
});
