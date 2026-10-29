import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  DEV_TRIO_ORDER,
  seededStreams,
  type DevSeededStreams,
} from "../../src/dev/harness-state.js";
import type { DevSpeciesId } from "../../src/dev/dev-options.js";
import { seededRandom } from "../../src/dev/seeded-random.js";
import { trioSpawnPositions } from "../../src/ranch/avoidance.js";
import {
  BRACHIO_GAIT,
  DinoPlayer,
  STEGO_GAIT,
  TRIKE_GAIT,
} from "../../src/ranch/dino-player.js";
import { DustPool } from "../../src/ranch/dust.js";
import type { GaitParams } from "../../src/ranch/waddle.js";

/**
 * Seeded determinism (FR-8, AC-9): one generator per consumer, derived from
 * the seed by fixed index, so `?dev=1&seed=42` reproduces poses regardless of
 * GLB resolution order and of wall-clock-gated blink draws.
 */

const DT = 1 / 60;
/** 6 s: long enough for the 3-5 s blink schedule to close and redraw. */
const FRAMES = 6 * 60;
/** Viewer spawn headings (TRIO_SPAWN_HEADINGS_RADIANS). */
const SPAWN_HEADINGS: readonly number[] = [Math.PI - 0.35, 1.0472, 2.094];
const GAITS: Record<DevSpeciesId, GaitParams> = {
  trike: TRIKE_GAIT,
  stego: STEGO_GAIT,
  brachio: BRACHIO_GAIT,
};

function createRig(id: string): THREE.Group {
  const root = new THREE.Group();
  root.name = `${id}Root`;
  const hips = new THREE.Group();
  hips.name = "Hips";
  const head = new THREE.Group();
  head.name = "Head";
  root.add(hips);
  root.add(head);
  return root;
}

function createWaddleClip(loopSeconds: number): THREE.AnimationClip {
  const track = new THREE.VectorKeyframeTrack(
    "Hips.position",
    [0, loopSeconds / 2, loopSeconds],
    [0, 0, 0, 0, 0.05, 0, 0, 0, 0],
  );
  return new THREE.AnimationClip("Waddle", loopSeconds, [track]);
}

interface TrioRunOptions {
  /** Player construction order; streams stay bound to the dino id. */
  order?: readonly DevSpeciesId[];
  /** Force a blink on every dino every N frames (extra random draws). */
  blinkEvery?: number;
}

interface TrioPose {
  x: number;
  z: number;
  heading: number;
}

/** Build the seeded trio, step `FRAMES` frames, return positions by dino id. */
function runTrio(
  streams: DevSeededStreams,
  options: TrioRunOptions = {},
): Record<string, TrioPose> {
  const spawn = trioSpawnPositions();
  const dust = new DustPool({ random: streams.dust });
  const players = new Map<string, { player: DinoPlayer; rig: THREE.Group }>();
  for (const id of options.order ?? DEV_TRIO_ORDER) {
    const index = DEV_TRIO_ORDER.indexOf(id);
    const rig = createRig(id);
    rig.position.set(spawn[index].x, 0, spawn[index].z);
    const player = new DinoPlayer(rig, {
      clip: createWaddleClip(GAITS[id].loopSeconds),
      gait: GAITS[id],
      dust,
      random: streams.movement[id],
      blinkRandom: streams.blink[id],
    });
    player.turnTo(SPAWN_HEADINGS[index]);
    player.setWalking(true);
    players.set(id, { player, rig });
  }
  const all = [...players.values()];
  for (let frame = 0; frame < FRAMES; frame += 1) {
    if (options.blinkEvery !== undefined && frame % options.blinkEvery === 0) {
      for (const { player } of all) {
        player.forceBlink();
      }
    }
    for (const { player } of all) {
      player.update(DT, frame * DT, false);
    }
  }
  const poses: Record<string, TrioPose> = {};
  for (const [id, { player, rig }] of players) {
    poses[id] = { x: rig.position.x, z: rig.position.z, heading: player.heading };
  }
  return poses;
}

describe("seeded determinism (FR-8, AC-9)", () => {
  it("reproduces identical poses for two runs of the same seed", () => {
    const first = runTrio(seededStreams(42));
    const second = runTrio(seededStreams(42));
    expect(second).toEqual(first);
  });

  it("keeps positions identical when one run draws extra blinks", () => {
    const baseline = runTrio(seededStreams(42));
    const blinking = runTrio(seededStreams(42), { blinkEvery: 10 });
    expect(blinking).toEqual(baseline);
  });

  it("binds streams to the dino id, not the construction order", () => {
    const forward = runTrio(seededStreams(42));
    const reversed = runTrio(seededStreams(42), {
      order: [...DEV_TRIO_ORDER].reverse(),
    });
    expect(reversed).toEqual(forward);
  });

  it("derives every consumer from the seed by fixed index", () => {
    const streams = seededStreams(42);
    for (const [index, id] of DEV_TRIO_ORDER.entries()) {
      expect(streams.movement[id]()).toBe(seededRandom(42 + 1 + index)());
      expect(streams.blink[id]()).toBe(seededRandom(42 + 101 + index)());
    }
    expect(streams.dust()).toBe(seededRandom(42 ^ 0x9e3779b9)());
  });

  it("never shares a stream between dust, movement and blink", () => {
    const streams = seededStreams(7);
    const dustFirst = streams.dust();
    const movementFirst = streams.movement.trike();
    const blinkFirst = streams.blink.trike();
    expect(new Set([dustFirst, movementFirst, blinkFirst]).size).toBe(3);
  });

  it("does not move a run when only unrelated dinos blink", () => {
    const baseline = runTrio(seededStreams(42));
    const extra = runTrio(seededStreams(42), { blinkEvery: 25 });
    expect(extra.trike).toEqual(baseline.trike);
    expect(extra.stego).toEqual(baseline.stego);
    expect(extra.brachio).toEqual(baseline.brachio);
  });

  it("proves the extra-blink guard is not vacuous: a shared stream diverges", () => {
    const baseline = runTrio(seededStreams(42));
    const crossWired = seededStreams(42);
    const shared = runTrio({ ...crossWired, blink: crossWired.movement }, { blinkEvery: 10 });
    expect(shared).not.toEqual(baseline);
  });
});
