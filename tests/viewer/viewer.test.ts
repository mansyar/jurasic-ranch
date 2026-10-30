import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MUD_ROLL_CLIP_NAME,
  loadBrachioPlayer,
  loadStegoPlayer,
  loadTrikePlayer,
} from '../../src/viewer/loaders.js';

/**
 * P5.T5 (FR-6, AC-6) and the viewer wiring P5.T1/P5.T2 add: the loader hands
 * Stego's `MudRoll` to its player and to nobody else, a stale GLB falls back to
 * `Idle` with a warning rather than a throw, and the tap calls a corner after
 * the sparkle has already gone up. No WebGL, no network, no browser.
 */

const loaderMocks = vi.hoisted(() => ({
  loadAsync: vi.fn(),
  setDRACOLoader: vi.fn(),
  setDecoderPath: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn(function (this: unknown) {
    return {
      loadAsync: loaderMocks.loadAsync,
      setDRACOLoader: loaderMocks.setDRACOLoader,
    };
  }),
}));

vi.mock('three/addons/loaders/DRACOLoader.js', () => ({
  DRACOLoader: vi.fn(function (this: unknown) {
    return {
      setDecoderPath: loaderMocks.setDecoderPath,
      dispose: loaderMocks.dispose,
    };
  }),
}));

const MAIN_SOURCE = readFileSync(new URL('../../src/viewer/main.ts', import.meta.url), 'utf8');
const LOOP_SOURCE = readFileSync(new URL('../../src/viewer/loop.ts', import.meta.url), 'utf8');
const TAP_LISTENER = "canvas.addEventListener('pointerdown'";

function createRig(): THREE.Group {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.name = 'Hips';
  const head = new THREE.Group();
  head.name = 'Head';
  root.add(hips);
  root.add(head);
  return root;
}

function createClip(name: string, seconds: number): THREE.AnimationClip {
  const track = new THREE.VectorKeyframeTrack(
    'Hips.position',
    [0, seconds / 2, seconds],
    [0, 0, 0, 0, 0.05, 0, 0, 0, 0],
  );
  return new THREE.AnimationClip(name, seconds, [track]);
}

/** A GLB stand-in carrying exactly the clips named. */
interface FakeGltf {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

function gltfWith(names: readonly string[]): FakeGltf {
  return {
    scene: createRig(),
    animations: names.map((name) => createClip(name, 1)),
  };
}

beforeEach(() => {
  loaderMocks.loadAsync.mockReset();
  loaderMocks.dispose.mockReset();
});

describe('the mud roll hand-off (P5.T5, FR-6, AC-6)', () => {
  it('names the clip the bake wrote, once', () => {
    expect(MUD_ROLL_CLIP_NAME).toBe('MudRoll');
  });

  it('gives Stego its roll, so the corner can play it', async () => {
    loaderMocks.loadAsync.mockResolvedValue(gltfWith(['Walk', 'Idle', 'MudRoll']));
    const stego = await loadStegoPlayer();
    expect(stego.player.arrivalClipPlaying).toBe(false);
    expect(stego.player.playArrivalClip()).toBe(true);
    // The request is buffered: the clip starts on the first frame the walk has
    // let go, not on the frame the corner asks for it.
    stego.player.update(0.016, 0.016);
    expect(stego.player.arrivalClipPlaying).toBe(true);
  });

  it('falls back to Idle with a warning when the GLB carries no roll', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    loaderMocks.loadAsync.mockResolvedValue(gltfWith(['Walk', 'Idle']));

    // A stale GLB must not white-screen the ranch: it loads, it rests on Idle,
    // and the child sees a dino that simply does not roll.
    const stego = await loadStegoPlayer();
    expect(stego.player.playArrivalClip()).toBe(false);
    expect(stego.player.arrivalClipPlaying).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('MudRoll');
    warn.mockRestore();
  });

  it('never asks the Trike or the Brachio for it, even when their GLB has one', async () => {
    loaderMocks.loadAsync.mockResolvedValue(gltfWith(['Walk', 'Idle', 'MudRoll']));
    const trike = await loadTrikePlayer();
    expect(trike.player.playArrivalClip()).toBe(false);

    loaderMocks.loadAsync.mockResolvedValue(gltfWith(['Walk', 'Idle', 'MudRoll']));
    const brachio = await loadBrachioPlayer();
    expect(brachio.player.playArrivalClip()).toBe(false);
  });
});

describe('the viewer wiring (P5.T1, P5.T2)', () => {
  it('adds the arrival pool to the scene and lets the director report each arrival', () => {
    expect(MAIN_SOURCE).toContain('new ArrivalEffects({');
    expect(MAIN_SOURCE).toContain('playSound: playFeedback');
    expect(MAIN_SOURCE).toContain('scene.add(arrivals.points)');
    expect(MAIN_SOURCE).toContain('onArrival: (species) => {');
    expect(MAIN_SOURCE).toContain('arrivals.arrive(species)');
    expect(MAIN_SOURCE).toContain('arrivals,');
  });

  it('ages the arrival dust on the same clamped frame, after the director', () => {
    expect(LOOP_SOURCE).toContain('arrivals?.update(dt, reducedMotion)');
    expect(LOOP_SOURCE.indexOf('updateDressing(')).toBeLessThan(
      LOOP_SOURCE.indexOf('arrivals?.update('),
    );
  });

  it('sparkles first and calls the corner after, in the same frame (AC-8)', () => {
    const tapBlock = MAIN_SOURCE.slice(MAIN_SOURCE.indexOf(TAP_LISTENER));
    const handler = tapBlock.slice(0, tapBlock.indexOf('\n  });'));
    expect(handler).toContain('cornerUnderProp(hit.prop)');
    expect(handler).toContain('callCooldowns.allows(corner, at)');
    expect(handler).toContain('visit.startVisit(corner)');
    // The sparkle is not behind the call: a refused call still sparkles, and a
    // call can never delay the sparkle past the frame the tap landed in.
    expect(handler.indexOf('dressing.sparkles.react(hit.prop, hit.point, at)')).toBeLessThan(
      handler.indexOf('visit.startVisit(corner)'),
    );
  });
});
