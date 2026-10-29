import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BlinkController, DinoPlayer, findBlinkTargets } from '../../src/ranch/dino-player.js';
import {
  BLINK_MAX_SECONDS,
  BLINK_MIN_SECONDS,
  WADDLE_LOOP_SECONDS,
} from '../../src/ranch/waddle.js';

/** Minimal rig: Hips (clip target) + Head (blink fallback), no eye meshes. */
function createTestRig(): THREE.Group {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.name = 'Hips';
  const head = new THREE.Group();
  head.name = 'Head';
  root.add(hips);
  root.add(head);
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

function findHead(root: THREE.Object3D): THREE.Object3D {
  const head = root.getObjectByName('Head');
  if (head === undefined) {
    throw new Error('test rig is missing its Head node');
  }
  return head;
}

/** Timestamps of every visible blink frame between `from` and `to` seconds. */
function visibleBlinkTimes(
  blink: BlinkController,
  targets: ReturnType<typeof findBlinkTargets>,
  from: number,
  to: number,
): number[] {
  const times: number[] = [];
  for (let now = from; now <= to; now += 1 / 60) {
    if (blink.update(now, targets)) {
      times.push(now);
    }
  }
  return times;
}

describe('forced blink (FR-5)', () => {
  it('starts a blink on the very next update', () => {
    const targets = findBlinkTargets(createTestRig());
    const blink = new BlinkController(() => 0, 0);
    // The natural schedule would not fire for 3 s.
    expect(blink.update(1, targets)).toBe(false);
    blink.forceBlink();
    expect(blink.update(1.016, targets)).toBe(true);
  });

  it('restores the lids and re-arms the normal 3-5 s schedule after the forced blink', () => {
    const targets = findBlinkTargets(createTestRig());
    const blink = new BlinkController(() => 0, 0);
    blink.forceBlink();
    expect(blink.update(1, targets)).toBe(true);
    // Blink closes 0.12 s after it starts.
    const closeAt = 1.2;
    expect(blink.update(closeAt, targets)).toBe(false);
    // The next scheduled blink is 3 s after the forced one closed (random 0).
    expect(blink.update(closeAt + BLINK_MIN_SECONDS - 0.1, targets)).toBe(false);
    const following = visibleBlinkTimes(
      blink,
      targets,
      closeAt + BLINK_MIN_SECONDS,
      closeAt + BLINK_MAX_SECONDS + 0.1,
    );
    expect(following.length).toBeGreaterThan(0);
    expect(following[0]).toBeGreaterThanOrEqual(closeAt + BLINK_MIN_SECONDS);
    expect(following[0]).toBeLessThanOrEqual(closeAt + BLINK_MAX_SECONDS);
  });

  it('keeps blinking on the 3-5 s cadence after a forced blink', () => {
    const targets = findBlinkTargets(createTestRig());
    const blink = new BlinkController(() => 0.5, 0);
    blink.forceBlink();
    const times = visibleBlinkTimes(blink, targets, 0, 20);
    expect(times.length).toBeGreaterThan(0);
    const starts = times.filter((time, index) => index === 0 || time - times[index - 1] > 0.5);
    expect(starts.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < starts.length; i += 1) {
      const gap = starts[i] - starts[i - 1];
      expect(gap).toBeGreaterThanOrEqual(BLINK_MIN_SECONDS - 0.2);
      expect(gap).toBeLessThanOrEqual(BLINK_MAX_SECONDS + 0.2);
    }
  });

  it('does not disturb a blink that is already in flight', () => {
    const targets = findBlinkTargets(createTestRig());
    const blink = new BlinkController(() => 0, 0);
    expect(blink.update(3.04, targets)).toBe(true);
    blink.forceBlink();
    expect(blink.update(3.08, targets)).toBe(true);
    // The in-flight blink still closes on its original schedule.
    expect(blink.update(3.2, targets)).toBe(false);
  });

  it('delegates from DinoPlayer and dips the head bone', () => {
    const rig = createTestRig();
    const player = new DinoPlayer(rig, { clip: createWaddleClip(), random: () => 0 });
    player.forceBlink();
    player.update(1 / 60, 5);
    player.update(1 / 60, 5.06);
    expect(findHead(rig).rotation.x).toBeGreaterThan(0);
  });

  it('is a no-op, not a throw, when the model has no blink target', () => {
    const player = new DinoPlayer(new THREE.Group(), {
      clip: createWaddleClip(),
      random: () => 0,
    });
    expect(() => {
      player.forceBlink();
      player.update(1 / 60, 0);
    }).not.toThrow();
  });
});
