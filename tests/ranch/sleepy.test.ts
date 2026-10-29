import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  BlinkController,
  DinoPlayer,
  findBlinkTargets,
  TRIKE_GAIT,
} from '../../src/ranch/dino-player.js';
import {
  DROWSY_AFTER_MS,
  IDLE_AFTER_MS,
  SLEEPY_DROOP_LID,
  SLEEPY_WEIGHT_RATE_PER_SECOND,
  SLEEPY_YAWN_PERIOD_SECONDS,
  SLEEPY_YAWN_SCALE,
  SleepyController,
  sleepyStateFor,
  yawnScaleFor,
} from '../../src/ranch/sleepy.js';
import { WADDLE_CYCLE_METRES, WADDLE_LOOP_SECONDS } from '../../src/ranch/waddle.js';

const DT = 1 / 60;
const ROOT_URL = new URL('../../', import.meta.url);

async function readRanchSource(fileName: string): Promise<string> {
  return readFile(new URL(`src/ranch/${fileName}`, ROOT_URL), 'utf8');
}

/** Minimal rig: Hips (clip target) + Head (blink fallback), no eye meshes. */
function createTestRig(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'TrikeRoot';
  const hips = new THREE.Group();
  hips.name = 'Hips';
  const head = new THREE.Group();
  head.name = 'Head';
  root.add(hips);
  root.add(head);
  return root;
}

/** Rig with separate eye meshes plus a Head bone. */
function createEyedRig(): THREE.Group {
  const root = createTestRig();
  const head = root.getObjectByName('Head') ?? root;
  const eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
  const eyeMat = new THREE.MeshBasicMaterial();
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.name = 'Eye_L';
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.name = 'Eye_R';
  head.add(eyeL);
  head.add(eyeR);
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

function createPlayer(rig: THREE.Group): DinoPlayer {
  return new DinoPlayer(rig, { clip: createWaddleClip(), random: () => 0.5 });
}

function findHead(root: THREE.Object3D): THREE.Object3D {
  const head = root.getObjectByName('Head');
  if (head === undefined) {
    throw new Error('test rig is missing its Head node');
  }
  return head;
}

function eyeL(root: THREE.Object3D): THREE.Object3D {
  const eye = root.getObjectByName('Eye_L');
  if (eye === undefined) {
    throw new Error('test rig is missing its Eye_L node');
  }
  return eye;
}

describe('idle sleepy state machine (FR-4, P3.T1)', () => {
  it('waits ~90s of no interaction, tunable via a single const', () => {
    expect(IDLE_AFTER_MS).toBe(90_000);
    expect(DROWSY_AFTER_MS).toBe(IDLE_AFTER_MS / 2);
  });

  it('moves awake -> drowsy -> sleepy on idle time alone', () => {
    expect(sleepyStateFor(0, 0)).toBe('awake');
    expect(sleepyStateFor(0, DROWSY_AFTER_MS - 1)).toBe('awake');
    expect(sleepyStateFor(0, DROWSY_AFTER_MS)).toBe('drowsy');
    expect(sleepyStateFor(0, IDLE_AFTER_MS - 1)).toBe('drowsy');
    expect(sleepyStateFor(0, IDLE_AFTER_MS)).toBe('sleepy');
    expect(sleepyStateFor(0, IDLE_AFTER_MS + 60_000)).toBe('sleepy');
  });

  it('lets the idle threshold move for tests and tuning', () => {
    expect(sleepyStateFor(0, 9_999, 10_000)).toBe('awake');
    expect(sleepyStateFor(0, 10_000, 10_000)).toBe('sleepy');
    expect(sleepyStateFor(5_000, 6_000, 10_000)).toBe('awake');
  });

  it('resets to awake on any interaction at any stage', () => {
    const sleepy = new SleepyController(0);
    expect(sleepy.update(50_000)).toBe('drowsy');
    sleepy.markInteraction(50_000);
    expect(sleepy.state).toBe('awake');
    expect(sleepy.sleepyWeight).toBe(0);
    expect(sleepy.update(140_000)).toBe('sleepy');
    sleepy.markInteraction(140_000);
    expect(sleepy.state).toBe('awake');
    expect(sleepy.sleepyWeight).toBe(0);
    expect(sleepy.update(140_001)).toBe('awake');
  });

  it('eases the overlay weight in and snaps it out on tap', () => {
    const sleepy = new SleepyController(0);
    // Step through the drowsy window in 100 ms frames: the weight blooms
    // gradually instead of popping to the half-mast target.
    let midWeight = -1;
    for (let now = 45_000; now <= 46_000; now += 100) {
      sleepy.update(now);
      if (now === 45_500) {
        midWeight = sleepy.sleepyWeight;
      }
    }
    expect(sleepy.state).toBe('drowsy');
    expect(midWeight).toBeGreaterThan(0);
    expect(midWeight).toBeLessThan(0.5);
    expect(sleepy.sleepyWeight).toBeCloseTo(0.5, 5);
    // A tap mid-bloom restores the wide-awake pose immediately.
    sleepy.markInteraction(46_000);
    expect(sleepy.sleepyWeight).toBe(0);
  });

  it('reaches full weight after a long sleepy idle', () => {
    const sleepy = new SleepyController(0);
    for (let now = 90_000; now <= 93_000; now += 100) {
      sleepy.update(now);
    }
    expect(sleepy.state).toBe('sleepy');
    expect(sleepy.sleepyWeight).toBeCloseTo(1, 5);
    expect(SLEEPY_WEIGHT_RATE_PER_SECOND).toBeGreaterThan(0);
  });

  it('drives only on timestamps, never on timers that could leak', async () => {
    const source = await readRanchSource('sleepy.ts');
    expect(source).not.toMatch(/setTimeout/);
    expect(source).not.toMatch(/setInterval/);
    expect(source).not.toMatch(/requestAnimationFrame/);
  });
});

describe('yawn swell math (P3.T2)', () => {
  it('is exactly 1 with no sleepy weight, so awake frames are bit-identical', () => {
    expect(yawnScaleFor(0, 0)).toBe(1);
    expect(yawnScaleFor(123.456, 0)).toBe(1);
    expect(yawnScaleFor(123.456, -1)).toBe(1);
  });

  it('breathes on a slow ~4s pulse while sleepy', () => {
    expect(SLEEPY_YAWN_PERIOD_SECONDS).toBe(4);
    expect(SLEEPY_YAWN_SCALE).toBeGreaterThan(0);
    const trough = yawnScaleFor(0, 1);
    const peak = yawnScaleFor(SLEEPY_YAWN_PERIOD_SECONDS / 4, 1);
    expect(trough).toBeCloseTo(1, 10);
    expect(peak).toBeCloseTo(1 + SLEEPY_YAWN_SCALE, 10);
    expect(yawnScaleFor(SLEEPY_YAWN_PERIOD_SECONDS / 2, 1)).toBeCloseTo(1, 10);
  });

  it('freezes the yawn into a static highlight under reduced motion', () => {
    const a = yawnScaleFor(0.25, 1, true);
    const b = yawnScaleFor(37.75, 1, true);
    expect(a).toBe(b);
    expect(a).toBeCloseTo(1 + SLEEPY_YAWN_SCALE, 10);
  });
});

describe('droopy extended blink (P3.T2)', () => {
  it('holds the lids half-shut while sleepy, even outside blink windows', () => {
    const rig = createEyedRig();
    const targets = findBlinkTargets(rig);
    const blink = new BlinkController(() => 0.5);
    // 1s is before the first scheduled blink: pure droop, no blink yet.
    expect(blink.update(1.0, targets, SLEEPY_DROOP_LID)).toBe(true);
    expect(eyeL(rig).scale.y).toBeLessThan(1);
    expect(findHead(rig).rotation.x).toBe(0);
  });

  it('dips the head bone when the GLB has no eye meshes', () => {
    const rig = createTestRig();
    const targets = findBlinkTargets(rig);
    const blink = new BlinkController(() => 0.5);
    expect(blink.update(1.0, targets, SLEEPY_DROOP_LID)).toBe(true);
    expect(findHead(rig).rotation.x).toBeGreaterThan(0);
  });

  it('restores the base pose the frame the droop clears', () => {
    const rig = createEyedRig();
    const targets = findBlinkTargets(rig);
    const blink = new BlinkController(() => 0.5);
    blink.update(1.0, targets, SLEEPY_DROOP_LID);
    expect(eyeL(rig).scale.y).toBeLessThan(1);
    expect(blink.update(1.1, targets, 0)).toBe(false);
    expect(eyeL(rig).scale.y).toBe(1);
  });

  it('keeps the default blink bit-identical when no droop is passed', () => {
    const rig = createEyedRig();
    const targets = findBlinkTargets(rig);
    const blink = new BlinkController(() => 0);
    expect(blink.update(0, targets)).toBe(false);
    expect(blink.update(3.0, targets)).toBe(true);
    expect(blink.update(3.2, targets)).toBe(false);
    expect(eyeL(rig).scale.y).toBe(1);
  });
});

describe('sleepy end-to-end idle (AC-4, P3.T4)', () => {
  it('drives 90s idle into droop, then restores on tap', () => {
    const sleepy = new SleepyController(0);
    const rig = createEyedRig();
    const player = createPlayer(rig);
    // 90 s idle in 100 ms frames, like the viewer's animation loop.
    for (let now = 0; now <= 92_000; now += 100) {
      sleepy.update(now);
      player.setSleepyWeight(sleepy.sleepyWeight);
      player.update(DT, now / 1000);
    }
    expect(sleepy.state).toBe('sleepy');
    expect(player.sleepyWeight).toBeCloseTo(1, 1);
    expect(eyeL(rig).scale.y).toBeLessThan(1);
    // Tap: the controller snaps awake, the weight clears, and within a
    // second the lids open fully again — no stuck droop.
    sleepy.markInteraction(92_000);
    player.setSleepyWeight(sleepy.sleepyWeight);
    let maxLid = 0;
    for (let i = 1; i <= 60; i += 1) {
      player.update(DT, 92 + i * DT);
      maxLid = Math.max(maxLid, eyeL(rig).scale.y);
    }
    expect(sleepy.state).toBe('awake');
    expect(maxLid).toBe(1);
  });
});

describe('sleepy player overlay (FR-4, FR-7)', () => {
  it('clamps the sleepy weight into 0..1', () => {
    const player = createPlayer(createTestRig());
    expect(player.sleepyWeight).toBe(0);
    player.setSleepyWeight(2);
    expect(player.sleepyWeight).toBe(1);
    player.setSleepyWeight(-1);
    expect(player.sleepyWeight).toBe(0);
    player.setSleepyWeight(0.5);
    expect(player.sleepyWeight).toBe(0.5);
    player.clearSleepy();
    expect(player.sleepyWeight).toBe(0);
  });

  it('droops the eyes and swells the yawn while sleepy', () => {
    const rig = createEyedRig();
    const player = createPlayer(rig);
    player.setSleepyWeight(1);
    // Before the first scheduled blink: pure sleepy overlay.
    player.update(DT, 1.0);
    expect(eyeL(rig).scale.y).toBeLessThan(1);
    expect(rig.scale.y).not.toBe(1);
  });

  it('restores the exact awake pose on interrupt, matching a never-sleepy twin', () => {
    const rigA = createEyedRig();
    const rigB = createEyedRig();
    const sleepy = createPlayer(rigA);
    const control = createPlayer(rigB);
    sleepy.setSleepyWeight(1);
    let now = 0;
    for (let i = 0; i < 120; i += 1) {
      sleepy.update(DT, now);
      control.update(DT, now);
      now += DT;
    }
    expect(eyeL(rigA).scale.y).not.toBe(eyeL(rigB).scale.y);
    // Any tap clears mid-flight: the very next frames match the twin again.
    sleepy.clearSleepy();
    for (let i = 0; i < 30; i += 1) {
      sleepy.update(DT, now);
      control.update(DT, now);
      now += DT;
    }
    expect(eyeL(rigA).scale.y).toBe(eyeL(rigB).scale.y);
    expect(findHead(rigA).rotation.x).toBe(findHead(rigB).rotation.x);
    expect(rigA.scale.y).toBe(rigB.scale.y);
    expect(rigA.scale.y).toBe(1);
  });

  it('freezes the yawn swell under reduced motion but keeps the droop', () => {
    const rig = createEyedRig();
    const player = createPlayer(rig);
    player.setSleepyWeight(1);
    player.update(DT, 1.0, true);
    const frozen = rig.scale.y;
    player.update(DT, 2.0, true);
    expect(rig.scale.y).toBe(frozen);
    expect(eyeL(rig).scale.y).toBeLessThan(1);
  });

  it('stays visual-only: silence, no DOM, no stuck pose in the ranch path', async () => {
    for (const file of ['sleepy.ts', 'dino-player.ts']) {
      const source = await readRanchSource(file);
      expect(source).not.toMatch(/howler/i);
      expect(source).not.toMatch(/AudioContext/i);
      expect(source).not.toMatch(/unlockAudio/);
    }
    const sleepySource = await readRanchSource('sleepy.ts');
    expect(sleepySource).not.toMatch(/document\./);
    expect(sleepySource).not.toMatch(/window\./);
  });

  it('keeps the wander clamp at 0.8m while sleepy and walking', () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    player.setSleepyWeight(1);
    player.setWalking(true);
    let now = 100;
    let maxDistance = 0;
    for (let i = 0; i < 30 * 60; i += 1) {
      player.update(DT, now);
      now += DT;
      maxDistance = Math.max(maxDistance, Math.hypot(rig.position.x, rig.position.z));
    }
    expect(maxDistance).toBeLessThanOrEqual(TRIKE_GAIT.wanderRadiusMetres + WADDLE_CYCLE_METRES);
    expect(player.walking).toBe(true);
  });
});
