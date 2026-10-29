import * as THREE from 'three';
import { avoidanceNudges, trioAvoidanceNudges } from '../ranch/avoidance.js';
import type { DinoPlayer } from '../ranch/dino-player.js';
import { wrapAngle } from '../ranch/waddle.js';
import type { Hud } from './hud.js';
import { updatePlaceholderWalk } from './placeholders.js';
import { hintSuppressedBySleepy } from './sleepy-ui.js';
import type { SkyDrift } from './sky.js';

/** One Walk button drives every loaded player together (FR-7, AC-4). */
export function setAllWalking(players: DinoPlayer[], walking: boolean): void {
  for (const player of players) {
    player.setWalking(walking);
  }
}

/**
 * Soft-steer both players apart (FR-6): bias each heading away when the pair
 * is closer than the avoidance trigger (`AVOIDANCE_TRIGGER_METRES`, derived
 * from the biggest body length in src/ranch/avoidance.ts). Never touches
 * `moving`, so neither dino stops, bounces, or teleports.
 */
export function steerPairApart(
  trike: DinoPlayer,
  trikeModel: THREE.Object3D,
  stego: DinoPlayer,
  stegoModel: THREE.Object3D,
): void {
  const { aNudge, bNudge } = avoidanceNudges(
    trikeModel.position.x,
    trikeModel.position.z,
    trike.heading,
    stegoModel.position.x,
    stegoModel.position.z,
    stego.heading,
  );
  if (aNudge !== 0) {
    trike.turnTo(wrapAngle(trike.heading + aNudge));
  }
  if (bNudge !== 0) {
    stego.turnTo(wrapAngle(stego.heading + bNudge));
  }
}

/**
 * Soft-steer all three dinos apart (FR-6): applies the pairwise avoidance to
 * each of the 3 pairs and clamps the summed bias per dino, so a dino crowded
 * on both sides still gets a small bounded steer. Never touches `moving`,
 * so the trio never stops, bounces, or teleports.
 */
export function steerTrioApart(
  trike: DinoPlayer,
  trikeModel: THREE.Object3D,
  stego: DinoPlayer,
  stegoModel: THREE.Object3D,
  brachio: DinoPlayer,
  brachioModel: THREE.Object3D,
): void {
  const nudges = trioAvoidanceNudges(
    trikeModel.position.x,
    trikeModel.position.z,
    trike.heading,
    stegoModel.position.x,
    stegoModel.position.z,
    stego.heading,
    brachioModel.position.x,
    brachioModel.position.z,
    brachio.heading,
  );
  if (nudges.aNudge !== 0) {
    trike.turnTo(wrapAngle(trike.heading + nudges.aNudge));
  }
  if (nudges.bNudge !== 0) {
    stego.turnTo(wrapAngle(stego.heading + nudges.bNudge));
  }
  if (nudges.cNudge !== 0) {
    brachio.turnTo(wrapAngle(brachio.heading + nudges.cNudge));
  }
}

/**
 * Staggered-entry spawn headings in radians (+Z = 0): the locked trio-wander
 * draw (tests/waddle/trio-wander.test.ts) — Trike near-center, Stego central,
 * Brachio on a radial-outward leg — so the trio never piles up three-deep
 * and every leg stays central/radial inside the wander circle.
 */
export const TRIO_SPAWN_HEADINGS_RADIANS: readonly [number, number, number] = [
  Math.PI - 0.35,
  1.0472,
  2.094,
];

/**
 * The live player/model slots the loop animates. The boot code fills each
 * slot as its rigged GLB swaps in, so the loop always reads the current pair
 * without re-registering a callback.
 */
export interface LoopStage {
  players: DinoPlayer[];
  trikePlayer: DinoPlayer | null;
  stegoPlayer: DinoPlayer | null;
  brachioPlayer: DinoPlayer | null;
  trikeModel: THREE.Object3D;
  stegoModel: THREE.Object3D;
  brachioModel: THREE.Object3D;
}

/**
 * Per-frame hook that may rewrite the delta the simulation advances by. The
 * dev harness installs one to pause and step; with no hook the loop uses the
 * frame delta unchanged.
 */
export type RenderDtHook = (dt: number, now: number) => number;

/** Everything the render loop reads from the booted viewer. */
export interface LoopView {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hud: Hud;
  stage: LoopStage;
  trike: THREE.Group;
  stego: THREE.Group;
  brachio: THREE.Group;
  /** Dev-harness pause/step hook; absent in production. */
  devFrame?: RenderDtHook | null;
  /**
   * Optional sky drift (FR-17). It is advanced by the same clamped `dt` as the
   * dinos — so the paused clock stops the clouds with everything else — and it
   * is a no-op under reduced motion, which it is told about every frame.
   */
  sky?: SkyDrift | null;
}

/** Start the rAF loop: the one place that decides which subsystem sees `dt`. */
export function startLoop(view: LoopView): void {
  const { renderer, scene, camera, hud, stage, trike, stego, brachio, devFrame, sky } = view;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const rawDt = Math.min(clock.getDelta(), 0.25);
    const now = clock.elapsedTime;
    // FR-3: a paused harness frame still renders but advances nothing.
    // NFR-1: with no hook `dt` is bit-identical to `rawDt`.
    const dt = devFrame == null ? rawDt : devFrame(rawDt, now);
    if (dt <= 0) {
      renderer.render(scene, camera);
      return;
    }
    // FR-4: sleepy cues after ~90 s idle; any tap already reset the
    // controller via markInteraction. Sleepy owns the stage over the hint
    // glow (FR-5 precedence), and the ZZZ overlay only plays at full sleepy.
    const sleepyState = hud.sleepy.controller.update(performance.now());
    if (hintSuppressedBySleepy(sleepyState)) {
      document.body.classList.remove('hint-glow', 'hint-static');
    }
    const reducedMotion = hud.sleepy.reducedMotionQuery.matches;
    for (const player of stage.players) {
      player.setSleepyWeight(hud.sleepy.controller.sleepyWeight);
    }
    const showSleepy = sleepyState === 'sleepy';
    if (showSleepy !== hud.sleepy.shown) {
      hud.sleepy.setShown(showSleepy);
    }
    if (stage.trikePlayer !== null && stage.stegoPlayer !== null && stage.brachioPlayer !== null) {
      steerTrioApart(
        stage.trikePlayer,
        stage.trikeModel,
        stage.stegoPlayer,
        stage.stegoModel,
        stage.brachioPlayer,
        stage.brachioModel,
      );
    } else {
      // Partial load window: steer whichever pairs are rigged yet.
      if (stage.trikePlayer !== null && stage.stegoPlayer !== null) {
        steerPairApart(stage.trikePlayer, stage.trikeModel, stage.stegoPlayer, stage.stegoModel);
      }
      if (stage.trikePlayer !== null && stage.brachioPlayer !== null) {
        steerPairApart(
          stage.trikePlayer,
          stage.trikeModel,
          stage.brachioPlayer,
          stage.brachioModel,
        );
      }
      if (stage.stegoPlayer !== null && stage.brachioPlayer !== null) {
        steerPairApart(
          stage.stegoPlayer,
          stage.stegoModel,
          stage.brachioPlayer,
          stage.brachioModel,
        );
      }
    }
    if (stage.trikePlayer !== null) {
      stage.trikePlayer.update(dt, now, reducedMotion);
    } else if (hud.isWalking()) {
      updatePlaceholderWalk(trike, now);
    }
    if (stage.stegoPlayer !== null) {
      stage.stegoPlayer.update(dt, now, reducedMotion);
    } else if (hud.isWalking()) {
      updatePlaceholderWalk(stego, now);
    }
    if (stage.brachioPlayer !== null) {
      stage.brachioPlayer.update(dt, now, reducedMotion);
    } else if (hud.isWalking()) {
      updatePlaceholderWalk(brachio, now);
    }
    // FR-17: cloud drift rides the same `dt` as the dinos, so a paused harness
    // frame freezes it and reduced motion stops it outright.
    sky?.update(dt, reducedMotion);
    renderer.render(scene, camera);
  });
}
