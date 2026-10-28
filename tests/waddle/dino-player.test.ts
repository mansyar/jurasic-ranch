import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DUST_POOL_SIZE } from "../../src/ranch/dust.js";
import {
  BlinkController,
  DinoPlayer,
  findBlinkTargets,
  TRIKE_GAIT,
} from "../../src/ranch/dino-player.js";
import {
  TURN_ARC_CURVATURE_RADIANS_PER_METRE,
  TURN_RATE_RADIANS_PER_SECOND,
  WADDLE_CYCLE_METRES,
  WADDLE_LOOP_SECONDS,
  WADDLE_STRIDE_METRES,
  WALK_SPEED_METRES_PER_SECOND,
  wrapAngle,
} from "../../src/ranch/waddle.js";

const DT = 1 / 60;
const ROOT_URL = new URL("../../", import.meta.url);

async function readRanchSource(fileName: string): Promise<string> {
  return readFile(new URL(`src/ranch/${fileName}`, ROOT_URL), "utf8");
}

/** Minimal rig: Hips (clip target) + Head (blink fallback), no eye meshes. */
function createTestRig(): THREE.Group {
  const root = new THREE.Group();
  root.name = "TrikeRoot";
  const hips = new THREE.Group();
  hips.name = "Hips";
  const head = new THREE.Group();
  head.name = "Head";
  root.add(hips);
  root.add(head);
  return root;
}

/** Rig with separate eye meshes plus a Head bone. */
function createEyedRig(): THREE.Group {
  const root = createTestRig();
  const head = root.getObjectByName("Head") ?? root;
  const eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
  const eyeMat = new THREE.MeshBasicMaterial();
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.name = "Eye_L";
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.name = "Eye_R";
  head.add(eyeL);
  head.add(eyeR);
  return root;
}

function createWaddleClip(): THREE.AnimationClip {
  const track = new THREE.VectorKeyframeTrack(
    "Hips.position",
    [0, 0.4, 0.8],
    [0, 0, 0, 0, 0.05, 0, 0, 0, 0],
  );
  return new THREE.AnimationClip("Waddle", WADDLE_LOOP_SECONDS, [track]);
}

function createPlayer(rig: THREE.Group): DinoPlayer {
  return new DinoPlayer(rig, { clip: createWaddleClip(), random: () => 0.5 });
}

function findHead(root: THREE.Object3D): THREE.Object3D {
  const head = root.getObjectByName("Head");
  if (head === undefined) {
    throw new Error("test rig is missing its Head node");
  }
  return head;
}

describe("gait config (FR-1)", () => {
  it("ships the Trike tuning: 0.29 m stride, 0.8 s loop, PI turn, 4.5 curve, 0.8 m wander", () => {
    expect(TRIKE_GAIT.strideMetres).toBeCloseTo(0.29, 12);
    expect(TRIKE_GAIT.loopSeconds).toBeCloseTo(0.8, 12);
    expect(TRIKE_GAIT.turnRateRadiansPerSecond).toBeCloseTo(Math.PI, 12);
    expect(TRIKE_GAIT.curvatureRadiansPerMetre).toBeCloseTo(4.5, 12);
    expect(TRIKE_GAIT.wanderRadiusMetres).toBeCloseTo(0.8, 12);
  });

  it("matches the waddle math constants so Trike behaviour is identical", () => {
    expect(TRIKE_GAIT.strideMetres).toBe(WADDLE_STRIDE_METRES);
    expect(TRIKE_GAIT.loopSeconds).toBe(WADDLE_LOOP_SECONDS);
    expect(TRIKE_GAIT.turnRateRadiansPerSecond).toBe(TURN_RATE_RADIANS_PER_SECOND);
    expect(TRIKE_GAIT.curvatureRadiansPerMetre).toBe(TURN_ARC_CURVATURE_RADIANS_PER_METRE);
  });

  it("defaults to the Trike gait when none is given", () => {
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

  it("honours a custom stride: double stride covers double distance per loop", () => {
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

  it("honours a custom wander radius: a far spawn steers only inside it", () => {
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
    // 2 m out is past the 0.8 m Trike circle, so it bends home; the 10 m
    // circle never triggers and the roamer holds its heading.
    expect(trike.heading).not.toBe(0);
    expect(roamer.heading).toBe(0);
  });
});

describe("dino mixer", () => {
  it("loops the 0.8 s Waddle clip and starts stopped", () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    expect(player.clipDurationSeconds).toBeCloseTo(0.8, 5);
    expect(player.walking).toBe(false);
    player.update(DT, 0);
    expect(rig.position.length()).toBe(0);
  });

  it("bends a 90 deg turn into a walk arc, then walks one stride per loop", () => {
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

  it("resolves a 180 deg reversal while walking as a wide in-frame arc", () => {
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

  it("toggles walk/stop and freezes on stop", () => {
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

  it("preserves the 1.0x baby root scale while squashing on plants", () => {
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

describe("stop deadband (FR-5, AC-5)", () => {
  it("freezes heading with a pending turn and halts dead after settling", () => {
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

  it("keeps turn and deadband math allocation-free (NFR-3)", async () => {
    const source = await readRanchSource("dino-player.ts");
    // Only the two constructor scratch temps; the per-frame update path
    // reuses them and allocates nothing.
    const vectors = source.match(/new THREE\.Vector3/g) ?? [];
    expect(vectors.length).toBeLessThanOrEqual(2);
  });
});

describe("blink", () => {
  it("finds eye meshes when present, else the head bone", () => {
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

  it("scales eye meshes through a 3-5 s blink", () => {
    const rig = createEyedRig();
    const targets = findBlinkTargets(rig);
    const blink = new BlinkController(() => 0);
    expect(blink.update(0, targets)).toBe(false);
    expect(blink.update(2.9, targets)).toBe(false);
    expect(blink.update(3.0, targets)).toBe(true);
    expect(blink.update(3.06, targets)).toBe(true);
    const eyeL = rig.getObjectByName("Eye_L") ?? rig;
    expect(eyeL.scale.y).toBeLessThan(0.5);
    expect(findHead(rig).rotation.x).toBe(0);
    expect(blink.update(3.2, targets)).toBe(false);
    expect(eyeL.scale.y).toBe(1);
    expect(blink.update(6.0, targets)).toBe(false);
  });

  it("dips the head when no eye meshes exist (single-mesh GLB)", () => {
    const rig = createTestRig();
    const targets = findBlinkTargets(rig);
    const blink = new BlinkController(() => 0);
    expect(blink.update(3.0, targets)).toBe(true);
    expect(blink.update(3.06, targets)).toBe(true);
    expect(findHead(rig).rotation.x).toBeGreaterThan(0);
    expect(blink.update(3.2, targets)).toBe(false);
    expect(findHead(rig).rotation.x).toBe(0);
  });

  it("blinks at least once per 5 s while walking the shipped shape", () => {
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

describe("dust pool", () => {
  it("puffs on plants while walking and clears after stopping", () => {
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

describe("stay-in-frame wander", () => {
  it("keeps a 30 s walk inside the radius plus one stride, steering at least once", () => {
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

  it("steers a far spawn back toward center and still halts on stop", () => {
    const rig = createTestRig();
    const player = createPlayer(rig);
    rig.position.set(2, 0, 0);
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

describe("no TrikePlayer duplication (AC-7)", () => {
  it("wires only DinoPlayer into the viewer", async () => {
    const viewer = await readFile(new URL("src/viewer/main.ts", ROOT_URL), "utf8");
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

describe("silent cheap walk (FR-7, FR-8)", () => {
  it("never touches audio in the ranch playback path", async () => {
    for (const file of ["waddle.ts", "dust.ts", "dino-player.ts"]) {
      const source = await readRanchSource(file);
      expect(source).not.toMatch(/howler/i);
      expect(source).not.toMatch(/AudioContext/i);
      expect(source).not.toMatch(/unlockAudio/);
    }
  });

  it("keeps dust cheap: a single points draw, no post-processing", async () => {
    const source = await readRanchSource("dust.ts");
    expect(source).toMatch(/THREE\.Points/);
    expect(source).not.toMatch(/EffectComposer/);
    expect(source).not.toMatch(/RenderPass|ShaderPass|UnrealBloom/);
    expect(source).not.toMatch(/post-?processing/i);
    const playerSource = await readRanchSource("dino-player.ts");
    expect(playerSource).not.toMatch(/EffectComposer/);
  });

  it("does not touch the shared viewer chrome", async () => {
    const playerSource = await readRanchSource("dino-player.ts");
    expect(playerSource).not.toMatch(/walk-button/);
    expect(playerSource).not.toMatch(/unlockAudio/);
  });
});
