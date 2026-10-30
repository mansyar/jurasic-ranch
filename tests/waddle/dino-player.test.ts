import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  DINO_WALK_RADIUS_METRES,
  LARGEST_DINO_BODY_LENGTH_METRES,
} from '../../src/ranch/avoidance.js';
import { DUST_POOL_SIZE } from '../../src/ranch/dust.js';
import { seededRandom } from '../../src/dev/seeded-random.js';
import {
  BlinkController,
  DinoPlayer,
  findBlinkTargets,
  TRIKE_GAIT,
} from '../../src/ranch/dino-player.js';
import {
  TURN_ARC_CURVATURE_RADIANS_PER_METRE,
  TURN_RATE_RADIANS_PER_SECOND,
  WADDLE_CYCLE_METRES,
  WADDLE_LOOP_SECONDS,
  WADDLE_STRIDE_METRES,
  WALK_BLEND_SECONDS,
  WALK_SPEED_METRES_PER_SECOND,
  wrapAngle,
} from '../../src/ranch/waddle.js';

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

/** A 6 s rest loop that lifts the hips and sets them back down. */
function createIdleClip(): THREE.AnimationClip {
  const track = new THREE.VectorKeyframeTrack(
    'Hips.position',
    [0, 3, 6],
    [0, 0, 0, 0, 0.05, 0, 0, 0, 0],
  );
  return new THREE.AnimationClip('Idle', 6, [track]);
}

/** Both actions on one mixer, which is what the loader now always builds. */
function createBlendedPlayer(rig: THREE.Group): DinoPlayer {
  return new DinoPlayer(rig, {
    clip: createWaddleClip(),
    idleClip: createIdleClip(),
    random: () => 0.5,
  });
}

function findHead(root: THREE.Object3D): THREE.Object3D {
  const head = root.getObjectByName('Head');
  if (head === undefined) {
    throw new Error('test rig is missing its Head node');
  }
  return head;
}

describe('gait config (FR-1)', () => {
  it('ships the Trike tuning: 0.29 m stride, 0.8 s loop, PI turn, 4.5 curve', () => {
    expect(TRIKE_GAIT.strideMetres).toBeCloseTo(0.29, 12);
    expect(TRIKE_GAIT.loopSeconds).toBeCloseTo(0.8, 12);
    expect(TRIKE_GAIT.turnRateRadiansPerSecond).toBeCloseTo(Math.PI, 12);
    expect(TRIKE_GAIT.curvatureRadiansPerMetre).toBeCloseTo(4.5, 12);
    // FR-6: the circle is the ranch's, not the Trike's — all three share it.
    expect(TRIKE_GAIT.wanderRadiusMetres).toBeCloseTo(DINO_WALK_RADIUS_METRES, 12);
    expect(TRIKE_GAIT.wanderRadiusMetres).toBeCloseTo(LARGEST_DINO_BODY_LENGTH_METRES / 2, 12);
  });

  it('matches the waddle math constants so Trike behaviour is identical', () => {
    expect(TRIKE_GAIT.strideMetres).toBe(WADDLE_STRIDE_METRES);
    expect(TRIKE_GAIT.loopSeconds).toBe(WADDLE_LOOP_SECONDS);
    expect(TRIKE_GAIT.turnRateRadiansPerSecond).toBe(TURN_RATE_RADIANS_PER_SECOND);
    expect(TRIKE_GAIT.curvatureRadiansPerMetre).toBe(TURN_ARC_CURVATURE_RADIANS_PER_METRE);
  });

  it('defaults to the Trike gait when none is given', () => {
    const a = createTestRig();
    const b = createTestRig();
    const def = new DinoPlayer(a, { clip: createWaddleClip(), random: () => 0.5 });
    const explicit = new DinoPlayer(b, {
      clip: createWaddleClip(),
      random: () => 0.5,
      gait: TRIKE_GAIT,
    });
    def.turnTo(Math.PI / 2);
    explicit.turnTo(Math.PI / 2);
    def.setWalking(true);
    explicit.setWalking(true);
    let now = 0;
    for (let i = 0; i < 240; i += 1) {
      def.update(DT, now);
      explicit.update(DT, now);
      now += DT;
    }
    expect(a.position.distanceTo(b.position)).toBe(0);
    expect(def.heading).toBe(explicit.heading);
  });

  it('honours a custom stride: double stride covers double distance per loop', () => {
    const a = createTestRig();
    const b = createTestRig();
    const trike = new DinoPlayer(a, {
      clip: createWaddleClip(),
      random: () => 0.5,
      gait: TRIKE_GAIT,
    });
    const long = new DinoPlayer(b, {
      clip: createWaddleClip(),
      random: () => 0.5,
      gait: { ...TRIKE_GAIT, strideMetres: TRIKE_GAIT.strideMetres * 2 },
    });
    trike.setWalking(true);
    long.setWalking(true);
    let now = 0;
    for (let i = 0; i < 60; i += 1) {
      trike.update(DT, now);
      long.update(DT, now);
      now += DT;
    }
    // Settle the 0.2 s blend ramp first, then measure one full 0.8 s loop.
    a.position.set(0, 0, 0);
    b.position.set(0, 0, 0);
    const startA = a.position.clone();
    const startB = b.position.clone();
    for (let i = 0; i < 48; i += 1) {
      trike.update(DT, now);
      long.update(DT, now);
      now += DT;
    }
    const trikeStride = a.position.distanceTo(startA);
    const longStride = b.position.distanceTo(startB);
    expect(trikeStride).toBeCloseTo(WADDLE_STRIDE_METRES, 6);
    expect(longStride).toBeCloseTo(trikeStride * 2, 6);
  });

  it('honours a custom wander radius: a far spawn steers only inside it', () => {
    const near = createTestRig();
    const far = createTestRig();
    const trike = new DinoPlayer(near, {
      clip: createWaddleClip(),
      random: () => 0.5,
      gait: TRIKE_GAIT,
    });
    const roamer = new DinoPlayer(far, {
      clip: createWaddleClip(),
      random: () => 0.5,
      gait: { ...TRIKE_GAIT, wanderRadiusMetres: 10 },
    });
    near.position.set(2, 0, 0);
    far.position.set(2, 0, 0);
    trike.setWalking(true);
    roamer.setWalking(true);
    let now = 0;
    for (let i = 0; i < 120; i += 1) {
      trike.update(DT, now);
      roamer.update(DT, now);
      now += DT;
    }
    // 2 m out is inside the ranch circle (half the Brachio's body, ~3.7 m),
    // so the roamer never steers; a player spawned past its own circle bends
    // home. FR-6 sized the circle for the biggest animal, so this checks the
    // custom-radius path rather than the shipped 0.8 m Trike ring.
    const wide = createTestRig();
    const outsider = new DinoPlayer(wide, { clip: createWaddleClip(), random: () => 0.5 });
    wide.position.set(DINO_WALK_RADIUS_METRES + 1.5, 0, 0);
    outsider.setWalking(true);
    now = 0;
    for (let i = 0; i < 120; i += 1) {
      outsider.update(DT, now);
      now += DT;
    }
    expect(outsider.heading).not.toBe(0);
    expect(roamer.heading).toBe(0);
  });
});

describe('dino mixer', () => {
  it('loops the 0.8 s Waddle clip and starts stopped', () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    expect(player.clipDurationSeconds).toBeCloseTo(0.8, 5);
    expect(player.walking).toBe(false);
    player.update(DT, 0);
    expect(rig.position.length()).toBe(0);
  });

  it('bends a 90 deg turn into a walk arc, then walks one stride per loop', () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    player.turnTo(Math.PI / 2);
    player.setWalking(true);
    let now = 10;
    // Arc, not spin: the dino translates from the very first frame instead
    // of pausing to turn in place.
    player.update(DT, now);
    now += DT;
    expect(rig.position.lengthSq()).toBeGreaterThan(0);
    // Heading converges gradually at the arc-limited rate: slower than the
    // old 0.5 s snap spin, bounded so wander still steers back in frame.
    let elapsed = DT;
    while (elapsed < 4 && Math.abs(wrapAngle(player.heading - Math.PI / 2)) >= 0.02) {
      player.update(DT, now);
      now += DT;
      elapsed += DT;
    }
    expect(Math.abs(wrapAngle(player.heading - Math.PI / 2))).toBeLessThan(0.02);
    expect(elapsed).toBeGreaterThan(0.6);
    expect(rig.rotation.y).toBe(player.heading);
    // A real arc covers ground while turning; an in-place spin would not.
    expect(rig.position.length()).toBeGreaterThan(0.2);
    // Straight-segment stride check from a fresh origin, keeping the wander
    // steering out of the measurement window.
    rig.position.set(0, 0, 0);
    const start = rig.position.clone();
    for (let i = 0; i < 60; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    expect(rig.position.distanceTo(start)).toBeCloseTo(WALK_SPEED_METRES_PER_SECOND, 6);
  });

  it('resolves a 180 deg reversal while walking as a wide in-frame arc', () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    player.setWalking(true);
    let now = 20;
    for (let i = 0; i < 90; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    // Full blend, mid-stride: reverse course and keep walking through it.
    rig.position.set(0, 0, 0);
    player.turnTo(Math.PI);
    let elapsed = 0;
    let pausedFrames = 0;
    let maxAbsX = 0;
    let maxDistance = 0;
    let prevX = 0;
    let prevZ = 0;
    while (elapsed < 6 && Math.abs(wrapAngle(player.heading - Math.PI)) >= 0.02) {
      player.update(DT, now);
      now += DT;
      elapsed += DT;
      if (rig.position.x === prevX && rig.position.z === prevZ) {
        pausedFrames += 1;
      }
      prevX = rig.position.x;
      prevZ = rig.position.z;
      maxAbsX = Math.max(maxAbsX, Math.abs(rig.position.x));
      maxDistance = Math.max(maxDistance, Math.hypot(rig.position.x, rig.position.z));
    }
    expect(Math.abs(wrapAngle(player.heading - Math.PI))).toBeLessThan(0.02);
    expect(pausedFrames).toBe(0);
    expect(elapsed).toBeGreaterThan(1);
    expect(maxAbsX).toBeGreaterThan(0.15);
    expect(maxDistance).toBeLessThanOrEqual(TRIKE_GAIT.wanderRadiusMetres + WADDLE_CYCLE_METRES);
  });

  it('toggles walk/stop and freezes on stop', () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    expect(player.toggleWalk()).toBe(true);
    let now = 0;
    for (let i = 0; i < 90; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    expect(player.toggleWalk()).toBe(false);
    for (let i = 0; i < 30; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    const parked = rig.position.clone();
    for (let i = 0; i < 60; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    expect(rig.position.distanceTo(parked)).toBe(0);
  });

  it('preserves the 1.0x baby root scale while squashing on plants', () => {
    const rig = createTestRig();
    rig.scale.set(1, 1, 1);
    const player = createPlayer(rig);
    player.setWalking(true);
    let now = 0;
    let minY = Infinity;
    for (let i = 0; i < 120; i += 1) {
      player.update(DT, now);
      now += DT;
      minY = Math.min(minY, rig.scale.y);
    }
    expect(rig.scale.x).toBe(1);
    expect(rig.scale.z).toBe(1);
    expect(minY).toBeLessThan(1);
    expect(minY).toBeGreaterThan(0.93);
  });
});

describe('stop deadband (FR-5, AC-5)', () => {
  it('freezes heading with a pending turn and halts dead after settling', () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    player.setWalking(true);
    let now = 30;
    for (let i = 0; i < 90; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    // Mid-walk command, then Stop before the arc completes: the old bug kept
    // integrating heading in place after the halt.
    player.turnTo(player.heading + 1);
    for (let i = 0; i < 3; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    player.setWalking(false);
    // Graceful decel preserved: the model eases forward briefly, then parks.
    for (let i = 0; i < 60; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    const parked = rig.position.clone();
    const parkedHeading = player.heading;
    // The pending turn never completes after Stop: the frozen heading stays
    // a full radian short of the commanded target.
    expect(Math.abs(wrapAngle(player.heading - (parkedHeading + 1)))).toBeGreaterThan(0.5);
    // 2 s recording: heading variance ~zero, displacement exactly zero.
    let maxHeadingDeviation = 0;
    for (let i = 0; i < 120; i += 1) {
      player.update(DT, now);
      now += DT;
      maxHeadingDeviation = Math.max(
        maxHeadingDeviation,
        Math.abs(wrapAngle(player.heading - parkedHeading)),
      );
    }
    expect(maxHeadingDeviation).toBe(0);
    expect(rig.position.distanceTo(parked)).toBe(0);
    expect(rig.rotation.y).toBe(parkedHeading);
  });

  it('keeps turn and deadband math allocation-free (NFR-3)', async () => {
    const source = await readRanchSource('dino-player.ts');
    // Only the two constructor scratch temps; the per-frame update path
    // reuses them and allocates nothing.
    const vectors = source.match(/new THREE\.Vector3/g) ?? [];
    expect(vectors.length).toBeLessThanOrEqual(2);
  });
});

describe('blink', () => {
  it('finds eye meshes when present, else the head bone', () => {
    const eyed = findBlinkTargets(createEyedRig());
    expect(eyed.eyes.length).toBe(2);
    expect(eyed.head).not.toBeNull();
    const plain = findBlinkTargets(createTestRig());
    expect(plain.eyes.length).toBe(0);
    expect(plain.head).not.toBeNull();
    const empty = findBlinkTargets(new THREE.Group());
    expect(empty.eyes.length).toBe(0);
    expect(empty.head).toBeNull();
  });

  it('scales eye meshes through a 3-5 s blink', () => {
    const rig = createEyedRig();
    const targets = findBlinkTargets(rig);
    const blink = new BlinkController(() => 0);
    expect(blink.update(0, targets)).toBe(false);
    expect(blink.update(2.9, targets)).toBe(false);
    expect(blink.update(3.0, targets)).toBe(true);
    expect(blink.update(3.06, targets)).toBe(true);
    const eyeL = rig.getObjectByName('Eye_L') ?? rig;
    expect(eyeL.scale.y).toBeLessThan(0.5);
    expect(findHead(rig).rotation.x).toBe(0);
    expect(blink.update(3.2, targets)).toBe(false);
    expect(eyeL.scale.y).toBe(1);
    expect(blink.update(6.0, targets)).toBe(false);
  });

  it('dips the head when no eye meshes exist (single-mesh GLB)', () => {
    const rig = createTestRig();
    const targets = findBlinkTargets(rig);
    const blink = new BlinkController(() => 0);
    expect(blink.update(3.0, targets)).toBe(true);
    expect(blink.update(3.06, targets)).toBe(true);
    expect(findHead(rig).rotation.x).toBeGreaterThan(0);
    expect(blink.update(3.2, targets)).toBe(false);
    expect(findHead(rig).rotation.x).toBe(0);
  });

  it('blinks at least once per 5 s while walking the shipped shape', () => {
    const rig = createTestRig();
    const player = new DinoPlayer(rig, { clip: createWaddleClip(), random: () => 1 });
    player.setWalking(true);
    let now = 10;
    let maxDip = 0;
    for (let i = 0; i < 360; i += 1) {
      player.update(DT, now);
      now += DT;
      maxDip = Math.max(maxDip, findHead(rig).rotation.x);
    }
    expect(maxDip).toBeGreaterThan(0);
  });
});

describe('dust pool', () => {
  it('puffs on plants while walking and clears after stopping', () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    player.setWalking(true);
    let now = 0;
    for (let i = 0; i < 42; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    expect(player.dust.aliveCount).toBeGreaterThan(0);
    expect(player.dust.aliveCount).toBeLessThanOrEqual(DUST_POOL_SIZE);
    player.setWalking(false);
    for (let i = 0; i < 90; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    expect(player.dust.aliveCount).toBe(0);
  });
});

describe('stay-in-frame wander', () => {
  it('keeps a 30 s walk inside the radius plus one stride, steering at least once', () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    player.setWalking(true);
    let now = 0;
    let maxDistance = 0;
    let maxHeadingDeviation = 0;
    for (let i = 0; i < 30 * 60; i += 1) {
      player.update(DT, now);
      now += DT;
      maxDistance = Math.max(maxDistance, Math.hypot(rig.position.x, rig.position.z));
      maxHeadingDeviation = Math.max(maxHeadingDeviation, Math.abs(wrapAngle(player.heading)));
    }
    // It keeps walking (reaches the boundary) but never escapes it.
    expect(maxDistance).toBeGreaterThan(TRIKE_GAIT.wanderRadiusMetres - 0.3);
    expect(maxDistance).toBeLessThanOrEqual(TRIKE_GAIT.wanderRadiusMetres + WADDLE_CYCLE_METRES);
    expect(maxHeadingDeviation).toBeGreaterThan(0.3);
    expect(player.walking).toBe(true);
  });

  it('steers a far spawn back toward center and still halts on stop', () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    // Past the ranch circle, so the boundary steer must engage (FR-6).
    rig.position.set(DINO_WALK_RADIUS_METRES + 2, 0, 0);
    player.setWalking(true);
    let now = 0;
    for (let i = 0; i < 120; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    expect(player.heading).not.toBe(0);
    player.setWalking(false);
    for (let i = 0; i < 60; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    const parked = rig.position.clone();
    for (let i = 0; i < 60; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    expect(rig.position.distanceTo(parked)).toBe(0);
  });
});

describe('no TrikePlayer duplication (AC-7)', () => {
  it('wires only DinoPlayer into the viewer', async () => {
    const viewer = await readFile(new URL('src/viewer/loaders.ts', ROOT_URL), 'utf8');
    // The Trike loader keeps its species name (loadTrikePlayer), but the
    // player class it wires must be the generic one.
    expect(viewer).toMatch(/DinoPlayer/);
    expect(viewer).toMatch(/ranch\/dino-player\.js/);
    expect(viewer).not.toMatch(/trike-player\.js/);
    expect(viewer).not.toMatch(/new TrikePlayer/);
    expect(viewer).not.toMatch(/: TrikePlayer/);
    expect(viewer).not.toMatch(/instanceof TrikePlayer/);
  });
});

describe('silent cheap walk (FR-7, FR-8)', () => {
  it('never touches audio in the ranch playback path', async () => {
    for (const file of ['waddle.ts', 'dust.ts', 'dino-player.ts']) {
      const source = await readRanchSource(file);
      expect(source).not.toMatch(/howler/i);
      expect(source).not.toMatch(/AudioContext/i);
      expect(source).not.toMatch(/unlockAudio/);
    }
  });

  it('keeps dust cheap: a single points draw, no post-processing', async () => {
    const source = await readRanchSource('dust.ts');
    expect(source).toMatch(/THREE\.Points/);
    expect(source).not.toMatch(/EffectComposer/);
    expect(source).not.toMatch(/RenderPass|ShaderPass|UnrealBloom/);
    expect(source).not.toMatch(/post-?processing/i);
    const playerSource = await readRanchSource('dino-player.ts');
    expect(playerSource).not.toMatch(/EffectComposer/);
  });

  it('does not touch the shared viewer chrome', async () => {
    const playerSource = await readRanchSource('dino-player.ts');
    expect(playerSource).not.toMatch(/walk-button/);
    expect(playerSource).not.toMatch(/unlockAudio/);
  });
});

/**
 * A 60 s trajectory recorded from the pre-FR-3 player (phase base `3ebcecd`,
 * before the ring was parameterised): Trike gait, world origin, walking from
 * frame 0, one `seededRandom(0x51ee)` stream for wander + dust and
 * `seededRandom(0xb1a2c)` for blinks. Pinning these numbers is AC-3's proof:
 * any change that moves the ring default, reorders the centre subtraction, or
 * shifts when the steer draws its jitter moves at least one of them.
 */
const GOLDEN_WANDER_POSITIONS: readonly { t: number; x: number; z: number }[] = [
  { t: 1, x: 0, z: 0.32927083333333335 },
  { t: 2, x: 0, z: 0.69177083333333167 },
  { t: 5, x: 0, z: 1.779270833333336 },
  { t: 10, x: 0, z: 3.5917708333332943 },
  { t: 20, x: -0.5500812142270125, z: 1.0843760364497754 },
  { t: 30, x: -1.8521648132890887, z: -2.2986999752670219 },
  { t: 40, x: -0.51855034531869471, z: -1.4250202086968915 },
  { t: 50, x: 1.5107235709481892, z: 1.5787561432905279 },
  { t: 60, x: 1.4059488656971091, z: 1.8475159936385848 },
];
const GOLDEN_MAX_RADIUS_METRES = 3.9384440842210675;
const GOLDEN_FINAL_HEADING = -2.6991812750673865;

describe('wander ring (FR-3, AC-3)', () => {
  it('reports the world-origin gait circle until one is set', () => {
    const player = createPlayer(createTestRig());
    expect(player.wanderRing).toEqual({
      centre: { x: 0, z: 0 },
      radius: TRIKE_GAIT.wanderRadiusMetres,
    });
    const centre = { x: 5, z: -3 };
    player.setWanderRing(centre, 1.5);
    expect(player.wanderRing).toEqual({ centre: { x: 5, z: -3 }, radius: 1.5 });
    // The ring is copied in, so a caller's own point cannot drift underneath it.
    centre.x = 100;
    expect(player.wanderRing.centre).toEqual({ x: 5, z: -3 });
  });

  it('reproduces the pre-FR-3 60 s seeded positions with no ring override', () => {
    const rig = createTestRig();
    const player = new DinoPlayer(rig, {
      clip: createWaddleClip(),
      random: seededRandom(0x51ee),
      blinkRandom: seededRandom(0xb1a2c),
    });
    player.setWalking(true);
    let now = 0;
    let maxRadius = 0;
    let compared = 0;
    for (let step = 0; step < 60 * 60; step += 1) {
      player.update(DT, now);
      now += DT;
      maxRadius = Math.max(maxRadius, Math.hypot(rig.position.x, rig.position.z));
      const second = (step + 1) / 60;
      const golden = GOLDEN_WANDER_POSITIONS.find((sample) => sample.t === second);
      if (golden !== undefined) {
        expect(rig.position.x, `x at ${second} s`).toBeCloseTo(golden.x, 9);
        expect(rig.position.z, `z at ${second} s`).toBeCloseTo(golden.z, 9);
        compared += 1;
      }
    }
    // The whole 60 s is pinned, not just the frames a sample happens to hit.
    expect(compared).toBe(GOLDEN_WANDER_POSITIONS.length);
    expect(maxRadius).toBeCloseTo(GOLDEN_MAX_RADIUS_METRES, 9);
    expect(player.heading).toBeCloseTo(GOLDEN_FINAL_HEADING, 9);
  });

  it('walks bit-identically when the default ring is set explicitly', () => {
    const untouchedRig = createTestRig();
    const explicitRig = createTestRig();
    const untouched = new DinoPlayer(untouchedRig, {
      clip: createWaddleClip(),
      random: seededRandom(0x51ee),
      blinkRandom: seededRandom(0xb1a2c),
    });
    const explicit = new DinoPlayer(explicitRig, {
      clip: createWaddleClip(),
      random: seededRandom(0x51ee),
      blinkRandom: seededRandom(0xb1a2c),
    });
    explicit.setWanderRing({ x: 0, z: 0 }, TRIKE_GAIT.wanderRadiusMetres);
    untouched.setWalking(true);
    explicit.setWalking(true);
    let now = 0;
    for (let step = 0; step < 60 * 60; step += 1) {
      untouched.update(DT, now);
      explicit.update(DT, now);
      now += DT;
    }
    // Exactly equal, not close: centre (0, 0) must subtract exact zeros.
    expect(explicitRig.position.x).toBe(untouchedRig.position.x);
    expect(explicitRig.position.z).toBe(untouchedRig.position.z);
    expect(explicit.heading).toBe(untouched.heading);
  });

  it('holds the animal inside an overridden ring instead of the world origin', () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    const centre = { x: 5, z: -3 };
    const radius = 1.5;
    player.setWanderRing(centre, radius);
    rig.position.set(centre.x + 0.4, 0, centre.z);
    player.setWalking(true);
    // Same overshoot bound the trio test uses: past the rim a dino keeps
    // walking outward through a half turn, at its own measured speed.
    const speed = WALK_SPEED_METRES_PER_SECOND;
    const yawRate = Math.min(
      TRIKE_GAIT.turnRateRadiansPerSecond,
      TRIKE_GAIT.curvatureRadiansPerMetre * speed,
    );
    const ceiling = radius + speed * (Math.PI / yawRate + WALK_BLEND_SECONDS);
    let maxFromCentre = 0;
    let minFromOrigin = Number.POSITIVE_INFINITY;
    let now = 0;
    for (let step = 0; step < 60 * 60; step += 1) {
      player.update(DT, now);
      now += DT;
      maxFromCentre = Math.max(
        maxFromCentre,
        Math.hypot(rig.position.x - centre.x, rig.position.z - centre.z),
      );
      if (step >= 30 * 60) {
        minFromOrigin = Math.min(minFromOrigin, Math.hypot(rig.position.x, rig.position.z));
      }
    }
    // It roams out to its own rim and never past the overshoot.
    expect(maxFromCentre).toBeGreaterThan(radius - 0.3);
    expect(maxFromCentre).toBeLessThanOrEqual(ceiling);
    // The override ring sits wholly outside the world-origin gait circle, so an
    // animal still steering at the origin would have been pulled home.
    expect(minFromOrigin).toBeGreaterThan(TRIKE_GAIT.wanderRadiusMetres);
  });
});

describe('two-action blend (FR-2, AC-2)', () => {
  it('holds Idle at weight 1 and Walk at 0 while stopped', () => {
    const player = createBlendedPlayer(createTestRig());
    player.update(DT, 0);
    const weights = player.blendWeights;
    expect(weights.walk).toBeCloseTo(0, 9);
    expect(weights.idle).toBeCloseTo(1, 9);
  });

  it('splits the eased blend into two weights that sum to 1 mid-blend', () => {
    const player = createBlendedPlayer(createTestRig());
    player.setWalking(true);
    let sawMidBlend = false;
    for (let frame = 0; frame < 40; frame += 1) {
      player.update(DT, frame * DT);
      const { idle, walk } = player.blendWeights;
      // AC-2: the pair is a partition of unity on every frame, not just at rest.
      expect(idle + walk).toBeCloseTo(1, 6);
      if (walk > 0.01 && walk < 0.99) {
        sawMidBlend = true;
      }
    }
    expect(sawMidBlend).toBe(true);
  });

  it('advances the mixer while stopped instead of freezing the resting pose', () => {
    const rig = createTestRig();
    const player = createBlendedPlayer(rig);
    const hips = rig.getObjectByName('Hips');
    expect(hips).toBeDefined();
    if (hips === undefined) return;
    // Walk weight is 0 throughout, so only the Idle action can move the hips.
    // Before FR-2 the mixer was gated on `blend > 0.5` and this bone never moved.
    player.update(DT, 0);
    const first = hips.position.y;
    for (let frame = 1; frame <= 20; frame += 1) {
      player.update(DT, frame * DT);
    }
    expect(player.blendWeights.walk).toBe(0);
    expect(hips.position.y).not.toBeCloseTo(first, 6);
  });

  it('keeps a player built without an idle clip exactly as it was', () => {
    const player = createPlayer(createTestRig());
    player.update(DT, 0);
    // No second action exists, so nothing claims the complement.
    expect(player.blendWeights).toEqual({ idle: 0, walk: 0 });
  });
});

/* -------------------------------------------------------------------------- *
 * P5.T5 — the corner one-shot (FR-6, AC-6)
 * -------------------------------------------------------------------------- */

/** A 1 s roll that tips the hips over and sets them back down. */
function createRollClip(): THREE.AnimationClip {
  const track = new THREE.VectorKeyframeTrack(
    'Hips.position',
    [0, 0.5, 1],
    [0, 0, 0, 0, -0.2, 0, 0, 0, 0],
  );
  return new THREE.AnimationClip('MudRoll', 1, [track]);
}

function createRollingPlayer(rig: THREE.Group): DinoPlayer {
  return new DinoPlayer(rig, {
    clip: createWaddleClip(),
    idleClip: createIdleClip(),
    arrivalClip: createRollClip(),
    random: () => 0.5,
  });
}

describe('the corner one-shot (P5.T5, FR-6, AC-6)', () => {
  it('is a no-op for a player whose GLB carries no such clip', () => {
    const player = createBlendedPlayer(createTestRig());
    expect(player.arrivalClipPlaying).toBe(false);
    expect(player.playArrivalClip()).toBe(false);
    expect(player.arrivalClipPlaying).toBe(false);
    player.update(DT, 0);
    expect(player.blendWeights).toEqual({ idle: 1, walk: 0 });
  });

  it('plays once, owns the pose while it runs, and hands the weight back to Idle', () => {
    const player = createRollingPlayer(createTestRig());
    player.update(DT, 0);
    expect(player.blendWeights.idle).toBeCloseTo(1, 6);

    expect(player.playArrivalClip()).toBe(true);
    // FR-6: the request is buffered. `arrive` asks while the walk is still
    // blending out, so the roll starts on the first frame the walk has let go -
    // starting it immediately was killed by the walk guard before the mixer ever
    // evaluated a frame, and the clip never played at all.
    player.update(DT, DT);
    expect(player.arrivalClipPlaying).toBe(true);
    // Neither the walk nor the idle averages into the roll: a half-roll with
    // half a rest pose is not a roll.
    expect(player.blendWeights.walk).toBe(0);
    expect(player.blendWeights.idle).toBe(0);

    // LoopOnce: the clip ends on its own, and the rest pose takes over again.
    for (let frame = 1; frame <= 120; frame += 1) {
      player.update(DT, frame * DT);
    }
    expect(player.arrivalClipPlaying).toBe(false);
    expect(player.blendWeights.idle).toBeCloseTo(1, 6);
  });

  it('lets go the moment the animal strides, so the walk blend is never disturbed', () => {
    const player = createRollingPlayer(createTestRig());
    player.update(DT, 0);
    player.setWalking(true);
    player.update(DT, DT);
    expect(player.playArrivalClip()).toBe(true);

    for (let frame = 1; frame <= 30; frame += 1) {
      player.update(DT, frame * DT);
    }
    expect(player.arrivalClipPlaying).toBe(false);
    expect(player.blendWeights.walk).toBeCloseTo(1, 6);
    expect(player.blendWeights.idle).toBeCloseTo(0, 6);
  });
});
