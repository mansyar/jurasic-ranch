import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BRACHIO_GAIT, DinoPlayer, STEGO_GAIT, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import {
  createWaddlePose,
  displacementMetresWithGait,
  DUST_PUFFS_MAX,
  DUST_PUFFS_MIN,
  gaitSpeedMetresPerSecond,
  loopPhaseWithGait,
  puffCountForPlant,
  SQUASH_DEPTH,
  squashScaleY,
  TURN_ALIGN_RADIANS,
  wrapAngle,
} from '../../src/ranch/waddle.js';

/**
 * Brachio gait tuning (FR-1): a slower seated-shuffle through the generic
 * DinoPlayer — stride 0.24 m per 1.0 s loop (~0.24 m/s), 1.8 rad/s yaw cap,
 * 3.0 rad/m curvature, 0.8 m wander circle. No new player class, no waddle
 * math changes: loopPhase/squash/dust reuse the shared helpers.
 */

const DT = 1 / 60;
const ROOT_URL = new URL('../../', import.meta.url);

async function readRanchSource(fileName: string): Promise<string> {
  return readFile(new URL(`src/ranch/${fileName}`, ROOT_URL), 'utf8');
}

/** Minimal rig: Hips (clip target) + Head (blink fallback), no eye meshes. */
function createTestRig(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'BrachioRoot';
  const hips = new THREE.Group();
  hips.name = 'Hips';
  const head = new THREE.Group();
  head.name = 'Head';
  root.add(hips);
  root.add(head);
  return root;
}

/** Stand-in 1.0 s Waddle clip: the shipped Brachio bake sets the real one. */
function createBrachioClip(): THREE.AnimationClip {
  const track = new THREE.VectorKeyframeTrack(
    'Hips.position',
    [0, 0.5, 1.0],
    [0, 0, 0, 0, 0.05, 0, 0, 0, 0],
  );
  return new THREE.AnimationClip('Waddle', 1.0, [track]);
}

function createBrachioPlayer(rig: THREE.Group): DinoPlayer {
  return new DinoPlayer(rig, {
    clip: createBrachioClip(),
    gait: BRACHIO_GAIT,
    random: () => 0.5,
  });
}

describe('brachio gait config (FR-1)', () => {
  it('ships the Brachio shuffle tuning: 0.24 m stride, 1.0 s loop, 1.8 turn, 4.5 curve, 0.8 m wander', () => {
    expect(BRACHIO_GAIT.strideMetres).toBe(0.24);
    expect(BRACHIO_GAIT.loopSeconds).toBe(1.0);
    expect(BRACHIO_GAIT.turnRateRadiansPerSecond).toBe(1.8);
    // Deviation from the plan's assumed 3.0: at 3.0 the yaw rate binds on
    // curvature x speed (0.72 rad/s, 0.33 m turn radius) and even a solo
    // Brachio swings past the AC-3 in-frame bound on outward rim crossings.
    // 4.5 (the trike-proven stroller curvature) is the smallest change that
    // contains the trio — see the phase-1 evidence for the data.
    expect(BRACHIO_GAIT.curvatureRadiansPerMetre).toBe(4.5);
    expect(BRACHIO_GAIT.wanderRadiusMetres).toBe(0.8);
  });

  it('shuffles slower than Trike/Stego at ~0.24 m/s', () => {
    expect(gaitSpeedMetresPerSecond(BRACHIO_GAIT)).toBeCloseTo(0.24, 12);
    expect(gaitSpeedMetresPerSecond(BRACHIO_GAIT)).toBeLessThan(
      gaitSpeedMetresPerSecond(TRIKE_GAIT),
    );
    expect(gaitSpeedMetresPerSecond(BRACHIO_GAIT)).toBeLessThan(
      gaitSpeedMetresPerSecond(STEGO_GAIT),
    );
  });

  it('rates a 90 deg turn inside 1.0 s at the gait yaw cap', () => {
    const bound = Math.PI / 2 / BRACHIO_GAIT.turnRateRadiansPerSecond;
    expect(bound).toBeLessThan(1.0);
  });

  it('bends a commanded 90 deg into a walk arc, then walks straight', () => {
    const rig = createTestRig();
    const player = createBrachioPlayer(rig);
    player.setWalking(true);
    player.turnTo(Math.PI / 2);
    let now = 0;
    let elapsed = 0;
    while (elapsed < 4 && Math.abs(wrapAngle(player.heading - Math.PI / 2)) >= TURN_ALIGN_RADIANS) {
      player.update(DT, now);
      now += DT;
      elapsed += DT;
    }
    // The walking arc converges (never stalls or orbits): the arc rate binds
    // on curvature x speed (4.5 x 0.24 = 1.08 rad/s, 0.22 m turn radius), so
    // the full 90 deg arc takes ~1.45 s while the 1.8 rad/s yaw cap alone
    // rates 0.87 s (see the rate test above). Phase 2 owns the AC-2
    // turn-budget call; the plan's assumed 3.0 curvature (~2.3 s arc) could
    // not meet the AC-3 in-frame bound even solo — see the gait test above.
    expect(Math.abs(wrapAngle(player.heading - Math.PI / 2))).toBeLessThan(TURN_ALIGN_RADIANS);
    expect(elapsed).toBeLessThan(2.5);
    const before = rig.position.clone();
    for (let i = 0; i < 60; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    expect(Math.abs(wrapAngle(player.heading - Math.PI / 2))).toBeLessThan(TURN_ALIGN_RADIANS);
    expect(rig.position.distanceTo(before)).toBeGreaterThan(0.05);
  });

  it('walks the Brachio shuffle through the generic player with dust + squash', () => {
    const rig = createTestRig();
    const player = createBrachioPlayer(rig);
    player.setWalking(true);
    let now = 0;
    let minScaleY = Infinity;
    for (let i = 0; i < 120; i += 1) {
      player.update(DT, now);
      now += DT;
      minScaleY = Math.min(minScaleY, rig.scale.y);
    }
    expect(rig.position.length()).toBeGreaterThan(0.1);
    expect(minScaleY).toBeLessThan(1);
    expect(player.dust.aliveCount).toBeGreaterThan(0);
  });

  it('reuses the shared waddle math unchanged (loop/squash/dust)', () => {
    expect(loopPhaseWithGait(0.25, BRACHIO_GAIT)).toBeCloseTo(0.25, 12);
    expect(loopPhaseWithGait(1.0, BRACHIO_GAIT)).toBeCloseTo(0, 12);
    expect(loopPhaseWithGait(1.25, BRACHIO_GAIT)).toBeCloseTo(0.25, 12);
    const striding = createWaddlePose();
    striding.moving = true;
    striding.blend = 1;
    expect(displacementMetresWithGait(striding, 1.0, BRACHIO_GAIT)).toBeCloseTo(0.24, 12);
    expect(squashScaleY(0)).toBeLessThan(1);
    expect(squashScaleY(0)).toBeGreaterThanOrEqual(1 - SQUASH_DEPTH);
    expect(puffCountForPlant(0)).toBeGreaterThanOrEqual(DUST_PUFFS_MIN);
    expect(puffCountForPlant(1)).toBeLessThanOrEqual(DUST_PUFFS_MAX);
  });

  it('leaves Trike/Stego behaviour bit-identical (FR-2)', () => {
    expect(TRIKE_GAIT.strideMetres).toBe(0.29);
    expect(TRIKE_GAIT.loopSeconds).toBe(0.8);
    expect(TRIKE_GAIT.turnRateRadiansPerSecond).toBe(Math.PI);
    expect(TRIKE_GAIT.curvatureRadiansPerMetre).toBe(4.5);
    expect(TRIKE_GAIT.wanderRadiusMetres).toBe(0.8);
    expect(STEGO_GAIT.strideMetres).toBe(0.29);
    expect(STEGO_GAIT.loopSeconds).toBe(0.8);
    expect(STEGO_GAIT.turnRateRadiansPerSecond).toBe(Math.PI);
    expect(STEGO_GAIT.curvatureRadiansPerMetre).toBe(20);
    expect(STEGO_GAIT.wanderRadiusMetres).toBe(0.8);
  });

  it('adds no new player class: only DinoPlayer drives gaits (FR-1, FR-10, AC-7)', async () => {
    const source = await readRanchSource('dino-player.ts');
    expect(source).toMatch(/export const BRACHIO_GAIT/);
    expect(source).toMatch(/export const TRIKE_GAIT/);
    expect(source).toMatch(/export const STEGO_GAIT/);
    expect(source).not.toMatch(/class TrikePlayer/);
    expect(source).not.toMatch(/class StegoPlayer/);
    expect(source).not.toMatch(/class BrachioPlayer/);
  });
});
