import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DUST_POOL_SIZE } from "../../src/ranch/dust.js";
import {
  BlinkController,
  findBlinkTargets,
  TrikePlayer,
  WANDER_RADIUS_METRES,
} from "../../src/ranch/trike-player.js";
import { WADDLE_CYCLE_METRES, WADDLE_LOOP_SECONDS, wrapAngle } from "../../src/ranch/waddle.js";

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

function findHead(root: THREE.Object3D): THREE.Object3D {
  const head = root.getObjectByName("Head");
  if (head === undefined) {
    throw new Error("test rig is missing its Head node");
  }
  return head;
}

describe("trike mixer", () => {
  it("loops the 0.8 s Waddle clip and starts stopped", () => {
    const rig = createTestRig();
    const player = new TrikePlayer(rig, { clip: createWaddleClip(), random: () => 0.5 });
    expect(player.clipDurationSeconds).toBeCloseTo(0.8, 5);
    expect(player.walking).toBe(false);
    player.update(DT, 0);
    expect(rig.position.length()).toBe(0);
  });

  it("turns 90 deg in place before translating, then walks 0.4 m/s", () => {
    const rig = createTestRig();
    const player = new TrikePlayer(rig, { clip: createWaddleClip(), random: () => 0.5 });
    player.turnTo(Math.PI / 2);
    player.setWalking(true);
    let now = 10;
    let time = 0;
    let firstMoveAt = -1;
    // Short window on purpose: the stay-in-frame wander steers back past
    // WANDER_RADIUS_METRES, so a multi-second straight walk no longer exists.
    while (time < 0.8) {
      player.update(DT, now);
      now += DT;
      time += DT;
      if (firstMoveAt < 0 && rig.position.lengthSq() > 0) {
        firstMoveAt = time;
      }
    }
    expect(firstMoveAt).toBeGreaterThan(0);
    expect(firstMoveAt).toBeLessThan(0.6);
    expect(player.heading).toBeCloseTo(Math.PI / 2, 5);
    expect(rig.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    for (let i = 0; i < 30; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    const start = rig.position.clone();
    for (let i = 0; i < 60; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    expect(rig.position.distanceTo(start)).toBeCloseTo(0.4, 6);
  });

  it("toggles walk/stop and freezes on stop", () => {
    const rig = createTestRig();
    const player = new TrikePlayer(rig, { clip: createWaddleClip(), random: () => 0.5 });
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

  it("preserves the 0.3x baby root scale while squashing on plants", () => {
    const rig = createTestRig();
    rig.scale.set(0.3, 0.3, 0.3);
    const player = new TrikePlayer(rig, { clip: createWaddleClip(), random: () => 0.5 });
    player.setWalking(true);
    let now = 0;
    let minY = Infinity;
    for (let i = 0; i < 120; i += 1) {
      player.update(DT, now);
      now += DT;
      minY = Math.min(minY, rig.scale.y);
    }
    expect(rig.scale.x).toBe(0.3);
    expect(rig.scale.z).toBe(0.3);
    expect(minY).toBeLessThan(0.3);
    expect(minY).toBeGreaterThan(0.28);
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
    const player = new TrikePlayer(rig, { clip: createWaddleClip(), random: () => 1 });
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
    const player = new TrikePlayer(rig, { clip: createWaddleClip(), random: () => 0.5 });
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
    const player = new TrikePlayer(rig, { clip: createWaddleClip(), random: () => 0.5 });
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
    expect(maxDistance).toBeGreaterThan(WANDER_RADIUS_METRES - 0.3);
    expect(maxDistance).toBeLessThanOrEqual(WANDER_RADIUS_METRES + WADDLE_CYCLE_METRES);
    expect(maxHeadingDeviation).toBeGreaterThan(0.3);
    expect(player.walking).toBe(true);
  });

  it("steers a far spawn back toward center and still halts on stop", () => {
    const rig = createTestRig();
    const player = new TrikePlayer(rig, { clip: createWaddleClip(), random: () => 0.5 });
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

describe("silent cheap walk (FR-7, FR-8)", () => {
  it("never touches audio in the ranch playback path", async () => {
    for (const file of ["waddle.ts", "dust.ts", "trike-player.ts"]) {
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
    const playerSource = await readRanchSource("trike-player.ts");
    expect(playerSource).not.toMatch(/EffectComposer/);
  });

  it("does not touch the shared viewer chrome", async () => {
    const playerSource = await readRanchSource("trike-player.ts");
    expect(playerSource).not.toMatch(/walk-button/);
    expect(playerSource).not.toMatch(/unlockAudio/);
  });
});
