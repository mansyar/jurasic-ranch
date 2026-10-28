import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DinoPlayer, TRIKE_GAIT } from "../../src/ranch/dino-player.js";
import { TrikePlayer, WANDER_RADIUS_METRES } from "../../src/ranch/trike-player.js";
import { WADDLE_LOOP_SECONDS, WADDLE_STRIDE_METRES } from "../../src/ranch/waddle.js";

const DT = 1 / 60;

/**
 * Thin-alias contract (FR-10, AC-7): TrikePlayer adds no behaviour over
 * DinoPlayer. Full gait coverage lives in ./dino-player.test.ts; this suite
 * only pins the alias so old call sites keep waddling identically.
 */
describe("trike alias", () => {
  it("is a DinoPlayer that defaults to the Trike gait", () => {
    const rig = new THREE.Group();
    const hips = new THREE.Group();
    hips.name = "Hips";
    const head = new THREE.Group();
    head.name = "Head";
    rig.add(hips);
    rig.add(head);
    const track = new THREE.VectorKeyframeTrack(
      "Hips.position",
      [0, 0.4, 0.8],
      [0, 0, 0, 0, 0.05, 0, 0, 0, 0],
    );
    const clip = new THREE.AnimationClip("Waddle", WADDLE_LOOP_SECONDS, [track]);
    const player = new TrikePlayer(rig, { clip, random: () => 0.5 });
    expect(player).toBeInstanceOf(DinoPlayer);
    expect(player.clipDurationSeconds).toBeCloseTo(0.8, 5);
    player.setWalking(true);
    let now = 0;
    for (let i = 0; i < 60; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    rig.position.set(0, 0, 0);
    const start = rig.position.clone();
    for (let i = 0; i < 48; i += 1) {
      player.update(DT, now);
      now += DT;
    }
    // One full 0.8 s loop at full blend covers exactly one 0.29 m stride.
    expect(rig.position.distanceTo(start)).toBeCloseTo(WADDLE_STRIDE_METRES, 6);
  });

  it("re-exports the Trike wander radius from the gait config", () => {
    expect(WANDER_RADIUS_METRES).toBe(TRIKE_GAIT.wanderRadiusMetres);
    expect(WANDER_RADIUS_METRES).toBeCloseTo(0.8, 12);
  });
});
