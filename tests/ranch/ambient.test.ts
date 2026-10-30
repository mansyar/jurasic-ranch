import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  AmbientSway,
  DEFAULT_SWAY_SEED,
  SPARKLE_BURST_PARTICLES,
  SPARKLE_COOLDOWN_MS,
  SWAY_FILE_CLASSES,
  SWAY_TUNING,
  allowsPropTap,
  createSparkleTexture,
  propUnderPointer,
  SparkleReactions,
} from '../../src/ranch/ambient.js';
import { DRESSING_MANIFEST, createSeededStream } from '../../src/ranch/layout.js';

/**
 * FR-11 (quiet sway), FR-12 (one sparkle per tap), AC-9 and AC-10, plus NFR-7.
 * Pure maths: a fake dressing group, a fake camera and a supplied `dt`. No
 * renderer, no browser, no timers — the sway advances only when the test hands
 * it a delta, exactly as the paused clock does in a capture (NFR-8).
 */

/** A stand-in for the built `RanchDressing` group: one empty node per entry. */
function fakeDressing(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'RanchDressing';
  for (const item of DRESSING_MANIFEST) {
    const node = new THREE.Object3D();
    node.userData['file'] = item.file;
    node.position.set(item.position[0], item.position[1], item.position[2]);
    node.rotation.y = item.rotationY;
    group.add(node);
  }
  return group;
}

const SWAYING_ENTRIES = DRESSING_MANIFEST.filter(
  (item) => SWAY_FILE_CLASSES[item.file] !== undefined,
);

function swaying(group: THREE.Group): THREE.Object3D[] {
  return group.children.filter((child) => SWAY_FILE_CLASSES[child.userData['file'] as string]);
}

describe('ambient sway (FR-11)', () => {
  it('sways the corn, the reeds and the litter, and nothing else', () => {
    const group = fakeDressing();
    const sway = new AmbientSway(group, 42);
    // Six corn stalks, two wallow reeds and three litter patches, and not one
    // stone, fence, tree or dino in the set.
    expect(SWAYING_ENTRIES.length).toBe(11);
    expect(sway.swayedProps).toBe(SWAYING_ENTRIES.length);
    const files = new Set(sway.props.map((prop) => prop.node.userData['file'] as string));
    expect([...files].sort()).toEqual([
      'corn-crop-b71f2f.glb',
      'ginkgo-leaf-litter-9784e9.glb',
      'river-reed-cluster-cba87e.glb',
    ]);
  });

  it('keeps every class quiet: under 3 deg, one wave every 3 to 6 s', () => {
    for (const class_ of ['corn', 'reeds', 'litter'] as const) {
      const tuning = SWAY_TUNING[class_];
      expect(tuning.amplitudeRadians).toBeGreaterThan(0);
      expect(tuning.amplitudeRadians).toBeLessThan((3 * Math.PI) / 180);
      expect(tuning.periodSeconds).toBeGreaterThanOrEqual(3);
      expect(tuning.periodSeconds).toBeLessThanOrEqual(6);
      expect(tuning.crossAxis).toBeGreaterThan(0);
      expect(tuning.crossAxis).toBeLessThanOrEqual(1);
    }
  });

  it('takes one phase per prop from the seeded stream, and replays it', () => {
    const first = new AmbientSway(fakeDressing(), 42);
    const again = new AmbientSway(fakeDressing(), 42);
    const other = new AmbientSway(fakeDressing(), 43);
    const phases = first.props.map((prop) => prop.phaseRadians);
    expect(again.props.map((prop) => prop.phaseRadians)).toEqual(phases);
    expect(other.props.map((prop) => prop.phaseRadians)).not.toEqual(phases);
    // Neighbours must not lean in lockstep: the corn row is six stalks in a line.
    expect(new Set(phases).size).toBe(phases.length);
    for (const phase of phases) {
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(Math.PI * 2);
    }
  });

  it('leans on a supplied dt and holds still on a zero or negative one', () => {
    const group = fakeDressing();
    const sway = new AmbientSway(group, 42);
    const corn = swaying(group)[0] as THREE.Object3D;
    const facing = corn.rotation.y;
    sway.update(0, false);
    expect(corn.rotation.x).toBe(0);
    sway.update(-1, false);
    expect(corn.rotation.x).toBe(0);
    sway.update(0.25, false);
    expect(sway.isLeaning).toBe(true);
    expect(Math.abs(corn.rotation.x)).toBeGreaterThan(0);
    expect(corn.rotation.y).toBe(facing);
    // A second frame keeps advancing the wind instead of restarting it.
    const before = corn.rotation.x;
    sway.update(0.25, false);
    expect(corn.rotation.x).not.toBe(before);
    expect(sway.elapsed).toBeCloseTo(0.5, 10);
  });

  it('never leans a prop past its class amplitude', () => {
    const group = fakeDressing();
    const sway = new AmbientSway(group, 42);
    for (let frame = 0; frame < 240; frame += 1) {
      sway.update(1 / 60, false);
      for (const prop of sway.props) {
        expect(Math.abs(prop.node.rotation.x)).toBeLessThanOrEqual(
          prop.tuning.amplitudeRadians + 1e-12,
        );
        expect(Math.abs(prop.node.rotation.z)).toBeLessThanOrEqual(
          prop.tuning.amplitudeRadians * prop.tuning.crossAxis + 1e-12,
        );
      }
    }
  });

  it('settles upright under reduced motion, including a live flip', () => {
    const group = fakeDressing();
    const sway = new AmbientSway(group, 42);
    sway.update(0.7, false);
    expect(sway.isLeaning).toBe(true);
    const elapsed = sway.elapsed;
    // AC-10: a reduced-motion frame puts every prop back on its ground axis
    // instead of freezing it mid-lean, and stops the wind's clock.
    sway.update(0.7, true);
    expect(sway.isLeaning).toBe(false);
    for (const prop of sway.props) {
      expect(prop.node.rotation.x).toBe(0);
      expect(prop.node.rotation.z).toBe(0);
    }
    expect(sway.elapsed).toBe(elapsed);
    // A live media-query flip back resumes the same wind.
    sway.update(0.1, false);
    expect(sway.isLeaning).toBe(true);
  });

  it('is inert when the dressing loaded nothing', () => {
    const sway = new AmbientSway(new THREE.Group(), DEFAULT_SWAY_SEED);
    expect(sway.swayedProps).toBe(0);
    expect(() => sway.update(0.5, false)).not.toThrow();
    expect(sway.isLeaning).toBe(false);
  });

  it('draws its phases from the ranch stream, one draw per swaying prop', () => {
    const stream = createSeededStream(42);
    const sway = new AmbientSway(fakeDressing(), 42);
    const expected = sway.props.map(() => stream() * Math.PI * 2);
    expect(sway.props.map((prop) => prop.phaseRadians)).toEqual(expected);
    // Only the swaying props advance the stream, so a later furniture file in
    // the manifest cannot shift a stalk's phase.
    expect(Object.keys(SWAY_FILE_CLASSES).length).toBe(3);
  });
});

describe('tap reactions (FR-12, AC-9, AC-10)', () => {
  it('opens no sparkle while the sleepy overlay is up', () => {
    // Review F8: the HUD half of this guard was dead — the listener is on the
    // canvas, so a tap the HUD owns never arrives. The sleepy half still bites.
    expect(allowsPropTap({ sleepy: false })).toBe(true);
    expect(allowsPropTap({ sleepy: true })).toBe(false);
  });

  it('bursts once per prop per 250 ms and again after the cooldown', () => {
    const sparkles = new SparkleReactions(createSeededStream(7));
    const prop = new THREE.Object3D();
    const other = new THREE.Object3D();
    const point = new THREE.Vector3(1, 0.5, 2);
    expect(sparkles.react(prop, point, 1_000)).toBe(true);
    expect(sparkles.aliveCount).toBe(SPARKLE_BURST_PARTICLES);
    expect(sparkles.react(prop, point, 1_000 + SPARKLE_COOLDOWN_MS - 1)).toBe(false);
    expect(sparkles.aliveCount).toBe(SPARKLE_BURST_PARTICLES);
    // A second prop is its own cooldown: one sparkle each, not one between them.
    expect(sparkles.react(other, point, 1_010)).toBe(true);
    expect(sparkles.aliveCount).toBe(SPARKLE_BURST_PARTICLES * 2);
    expect(sparkles.react(prop, point, 1_000 + SPARKLE_COOLDOWN_MS)).toBe(true);
  });

  it('costs one draw call and lets the sparkles die on their own', () => {
    const sparkles = new SparkleReactions(createSeededStream(7));
    expect(sparkles.points).toBeInstanceOf(THREE.Points);
    sparkles.react(new THREE.Object3D(), new THREE.Vector3(0, 0.4, 0), 0);
    expect(sparkles.aliveCount).toBeGreaterThan(0);
    // NFR-7: the sparkle may animate with reduced motion on, so its update is
    // never gated — a paused frame is what freezes it.
    sparkles.update(0);
    expect(sparkles.aliveCount).toBeGreaterThan(0);
    sparkles.update(1);
    expect(sparkles.aliveCount).toBe(0);
  });

  it('bakes a sparkle sprite with no canvas and no image file', () => {
    const texture = createSparkleTexture(32);
    expect(texture).toBeInstanceOf(THREE.DataTexture);
    const image = texture.image as { data: Uint8Array; width: number };
    expect(image.width).toBe(32);
    expect(image.data.length).toBe(32 * 32 * 4);
  });

  it('picks the prop under a tap and ignores everything outside the group', () => {
    const group = new THREE.Group();
    const near = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    near.position.set(0, 0.5, -6);
    const far = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    far.position.set(0, 0.5, -12);
    group.add(near, far);
    // A dino-shaped box standing in front of both: never a candidate, because
    // the raycast only walks the dressing group's own children.
    const outside = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1), new THREE.MeshBasicMaterial());
    outside.position.set(0, 0.5, -2);

    const camera = new THREE.PerspectiveCamera(50, 16 / 10, 0.1, 100);
    camera.position.set(0, 0.5, 0);
    camera.lookAt(0, 0.5, -10);
    camera.updateMatrixWorld(true);
    group.updateMatrixWorld(true);

    const hit = propUnderPointer(group, camera, new THREE.Vector2(0, 0));
    expect(hit?.prop).toBe(near);
    expect(hit?.point.z).toBeCloseTo(-5.5, 3);

    // Off to the side of a 1 m box the ray misses the group entirely.
    expect(propUnderPointer(group, camera, new THREE.Vector2(0.9, 0.9))).toBeNull();
  });
});

describe('tap reaction wiring (AC-9)', () => {
  const source = readFileSync(new URL('../../src/viewer/main.ts', import.meta.url), 'utf8');

  it('raycasts only the dressing group, behind the sleepy guard', () => {
    expect(source).toContain('propUnderPointer(dressing.group');
    expect(source).toContain('allowsPropTap(guards)');
    expect(source).toContain("canvas.addEventListener('pointerdown'");
    // Review F8: no DOM target check to assert any more — the canvas listener
    // already means a tap the HUD owns never gets here.
    expect(source).not.toContain('hudOwnsPointer');
  });

  it('answers with one chime and no gameplay state of its own', () => {
    expect(source).toContain("audioEngine().play('sparkle')");
    expect(source).toContain('dressing.sparkles.react(hit.prop, hit.point, at)');
    const tapBlock = source.slice(source.indexOf("canvas.addEventListener('pointerdown'"));
    const handler = tapBlock.slice(0, tapBlock.indexOf('\n  });'));
    // No hearts, no voice line, no counter and no walk/POV/sleepy change: the
    // tap handler talks to the sparkle pool and the sfx bus and nothing else.
    for (const forbidden of ['setWalking', 'setPov', 'forceSleepy', 'forceHint', 'playHeart']) {
      expect(handler).not.toContain(forbidden);
    }
    expect(handler).not.toContain("'heart'");
    expect(handler).not.toContain("'voice'");
  });
});
