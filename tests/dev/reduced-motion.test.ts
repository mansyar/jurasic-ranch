import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AmbientSway, SparkleReactions } from '../../src/ranch/ambient.js';
import { DinoPlayer, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import { DustPool } from '../../src/ranch/dust.js';
import { updateDressing, type DressingSummary } from '../../src/ranch/dressing.js';
import type { CornerSpecies } from '../../src/ranch/layout.js';
import { ArrivalEffects } from '../../src/ranch/visit-effects.js';

/**
 * FR-15, AC-15: under reduced motion the *decoration* settles in one frame —
 * the arrival ripple/splash and the tap sparkle — while the clip the animal is
 * playing keeps running. An animal that freezes is broken, not accessible, so
 * the split is by what is decoration, not by "stop everything".
 */

const SPECIES: readonly CornerSpecies[] = ['trike', 'stego', 'brachio'];
const DT = 1 / 60;

function createRig(): THREE.Group {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.name = 'Hips';
  const head = new THREE.Group();
  head.name = 'Head';
  root.add(hips, head);
  return root;
}

function createClip(name: string, seconds: number, height: number): THREE.AnimationClip {
  return new THREE.AnimationClip(name, seconds, [
    new THREE.VectorKeyframeTrack('Hips.position', [0, seconds], [0, 0, 0, 0, height, 0]),
  ]);
}

function createPlayer(): { player: DinoPlayer; rig: THREE.Group } {
  const rig = createRig();
  const player = new DinoPlayer(rig, {
    clip: createClip('Walk', 0.8, 0.1),
    arrivalClip: createClip('MudRoll', 1, 0.5),
    gait: TRIKE_GAIT,
    dust: new DustPool(),
  });
  return { player, rig };
}

function createEffects(): ArrivalEffects {
  return new ArrivalEffects({ playSound: () => undefined, random: () => 0.5 });
}

function createDressing(sparkles: SparkleReactions): DressingSummary {
  return {
    requested: 0,
    placed: 0,
    loadedFiles: 0,
    failedFiles: [],
    group: new THREE.Group(),
    waterLine: null,
    rotor: null,
    sway: new AmbientSway(new THREE.Group()),
    sparkles,
    drawCalls: 0,
    triangles: 0,
  };
}

describe('reduced motion settles decoration but not the animal (FR-15, AC-15)', () => {
  it('keeps the arrival clip running while the arrival burst retires in one frame', () => {
    const { player, rig } = createPlayer();
    const hips = rig.getObjectByName('Hips');
    expect(hips).toBeDefined();
    expect(player.playArrivalClip()).toBe(true);

    player.update(DT, 0, true);
    const firstY = hips?.position.y ?? 0;
    player.update(DT, DT, true);
    const secondY = hips?.position.y ?? 0;

    // The clip advanced under reduced motion: the animal is alive, not frozen.
    expect(secondY).toBeGreaterThan(firstY);
    expect(player.arrivalClipPlaying).toBe(true);
  });

  it.each(SPECIES)('settles the %s arrival in a single reduced-motion frame', (species) => {
    const effects = createEffects();

    expect(effects.arrive(species)).toBe(true);
    expect(effects.aliveCount).toBeGreaterThan(0);

    effects.update(DT, true);

    expect(effects.aliveCount).toBe(0);
  });

  it('does not settle the arrival early when reduced motion is off', () => {
    // The control that keeps the test above from passing vacuously: the same
    // one frame leaves the burst in the air on the normal path.
    const effects = createEffects();

    expect(effects.arrive('stego')).toBe(true);
    effects.update(DT, false);

    expect(effects.aliveCount).toBeGreaterThan(0);
  });

  it('settles a tap sparkle in one frame through the dressing update', () => {
    const sparkles = new SparkleReactions(() => 0.5);
    const summary = createDressing(sparkles);
    const prop = new THREE.Object3D();

    expect(sparkles.react(prop, new THREE.Vector3(0, 0.5, 0), 0)).toBe(true);
    expect(sparkles.aliveCount).toBeGreaterThan(0);

    updateDressing(summary, DT, true);

    expect(sparkles.aliveCount).toBe(0);
  });

  it('leaves the sparkle in the air when reduced motion is off', () => {
    const sparkles = new SparkleReactions(() => 0.5);
    const summary = createDressing(sparkles);

    expect(sparkles.react(new THREE.Object3D(), new THREE.Vector3(), 0)).toBe(true);
    updateDressing(summary, DT, false);

    expect(sparkles.aliveCount).toBeGreaterThan(0);
  });

  it('still freezes the sparkle on a paused frame', () => {
    // NFR-8: `?pause=1` freezes decoration too, reduced motion or not.
    const sparkles = new SparkleReactions(() => 0.5);
    const summary = createDressing(sparkles);

    expect(sparkles.react(new THREE.Object3D(), new THREE.Vector3(), 0)).toBe(true);
    updateDressing(summary, 0, false);

    expect(sparkles.aliveCount).toBeGreaterThan(0);
  });
});
