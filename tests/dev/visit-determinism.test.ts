import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { trioSpawnPositions } from '../../src/ranch/avoidance.js';
import { BRACHIO_GAIT, DinoPlayer, STEGO_GAIT, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import { DustPool } from '../../src/ranch/dust.js';
import type { CornerSpecies } from '../../src/ranch/layout.js';
import { VisitDirector, type VisitState } from '../../src/ranch/visit.js';
import type { GaitParams } from '../../src/ranch/waddle.js';
import { seededStreams } from '../../src/dev/harness-state.js';
import {
  installDevHarness,
  parseDevQuery,
  type DevBridge,
  type DevDinoHandle,
  type DevRanchApi,
} from '../../src/dev/harness.js';
import { installFakeDom } from './fake-dom.js';

/**
 * AC-16, NFR-5, FR-16: two runs of the same seed on a `?pause=1` page produce
 * the same visit schedule and the same positions, frame for frame. The whole
 * point of the director being driven by the frame's `dt` is that no wall clock
 * can leak into the schedule; this is the test that would catch it if one did.
 */

const IDS: readonly CornerSpecies[] = ['trike', 'stego', 'brachio'];
const LABELS: Readonly<Record<CornerSpecies, string>> = {
  trike: 'Trike',
  stego: 'Stego',
  brachio: 'Brachio',
};
const GAITS: Readonly<Record<CornerSpecies, GaitParams>> = {
  trike: TRIKE_GAIT,
  stego: STEGO_GAIT,
  brachio: BRACHIO_GAIT,
};
const SPAWN_HEADINGS = [Math.PI - 0.35, 1.0472, 2.094];

/** 90 simulated seconds: long enough for a seeded timer to fire and arrive. */
const FRAMES = 90 * 60;

interface PassResult {
  /** `frame:species:state` for every state change, in frame order. */
  schedule: string[];
  positions: Record<CornerSpecies, { x: number; z: number; heading: number }>;
}

/** One registered animal: the model is the body the director reads. */
interface BuiltWalker {
  species: CornerSpecies;
  model: THREE.Group;
  player: DinoPlayer;
}

function createRig(): THREE.Group {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.name = 'Hips';
  const head = new THREE.Group();
  head.name = 'Head';
  root.add(hips, head);
  return root;
}

function createWaddleClip(): THREE.AnimationClip {
  return new THREE.AnimationClip('Walk', 0.8, [
    new THREE.VectorKeyframeTrack('Hips.position', [0, 0.8], [0, 0, 0, 0, 0.1, 0]),
  ]);
}

function statesOf(visit: VisitDirector): Record<CornerSpecies, VisitState | 'unknown'> {
  const states: Record<CornerSpecies, VisitState | 'unknown'> = {
    trike: 'unknown',
    stego: 'unknown',
    brachio: 'unknown',
  };
  for (const snapshot of visit.getSnapshots()) {
    states[snapshot.species] = snapshot.state;
  }
  return states;
}

/** One whole seeded page: streams, players, director, harness, frames. */
function runPass(): PassResult {
  const dom = installFakeDom();
  const streams = seededStreams(42);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const dust = new DustPool({ random: streams.dust });
  const visit = new VisitDirector({ seed: 42 });
  const spawn = trioSpawnPositions();
  const built: BuiltWalker[] = [];
  const dinos: DevDinoHandle[] = [];

  IDS.forEach((species, index) => {
    const model = createRig();
    const point = spawn[index];
    model.position.set(point.x, 0, point.z);
    const player = new DinoPlayer(model, {
      clip: createWaddleClip(),
      gait: GAITS[species],
      dust,
      random: streams.movement[species],
      blinkRandom: streams.blink[species],
    });
    player.turnTo(SPAWN_HEADINGS[index]);
    player.setWalking(true);
    visit.register({ species, actor: player, body: model, gait: GAITS[species] });
    built.push({ species, model, player });
    dinos.push({
      id: species,
      label: LABELS[species],
      getModel: () => model,
      getPlayer: () => player,
    });
  });
  // Structural stand-in: no WebGL context in Node, and no frame is rendered.
  const renderer = {
    info: { render: { calls: 0, triangles: 0 } },
  } as unknown as THREE.WebGLRenderer;
  const bridge: DevBridge = {
    scene,
    camera,
    renderer,
    dust,
    dinos,
    getWalking: () => true,
    setWalking: () => undefined,
    getPov: () => 'ranch',
    setPov: () => undefined,
    forceSleepy: () => undefined,
    forceHint: () => undefined,
    getSleepyState: () => 'awake',
    getAudioState: () => ({
      unlocked: false,
      muted: false,
      volume: 0.8,
      musicPlaying: false,
      activeLine: null,
      lastStartLatencyMs: 0,
    }),
    mute: () => undefined,
    setVolume: () => undefined,
    play: () => undefined,
    stopAll: () => undefined,
    callVisit: (species: CornerSpecies) => visit.startVisit(species),
    getVisitState: () => visit.getSnapshots(),
  };

  const frame = installDevHarness(bridge, parseDevQuery('?dev=1&seed=42&pause=1'));
  const api = dom.window['__ranch'] as DevRanchApi | undefined;
  if (api === undefined) {
    throw new Error('harness did not publish window.__ranch');
  }
  // FR-16: a paused page only moves when it is stepped, in fixed deltas.
  api.step(FRAMES);

  const schedule: string[] = [];
  let previous = statesOf(visit);
  let now = 0;
  for (let index = 0; index < FRAMES; index += 1) {
    const dt = frame(1 / 60, now);
    if (dt <= 0) {
      continue;
    }
    now += dt;
    // The loop's order: the director decides, then the players move.
    visit.update(dt, true);
    for (const walker of built) {
      walker.player.update(dt, now, false);
    }
    const current = statesOf(visit);
    for (const species of IDS) {
      if (current[species] !== previous[species]) {
        schedule.push(`${index}:${species}:${current[species]}`);
      }
    }
    previous = current;
  }

  const positions: PassResult['positions'] = {
    trike: { x: 0, z: 0, heading: 0 },
    stego: { x: 0, z: 0, heading: 0 },
    brachio: { x: 0, z: 0, heading: 0 },
  };
  for (const walker of built) {
    positions[walker.species] = {
      x: walker.model.position.x,
      z: walker.model.position.z,
      heading: walker.player.heading,
    };
  }

  dom.restore();
  return { schedule, positions };
}

describe('seeded visits are reproducible (AC-16, NFR-5, FR-16)', () => {
  it('reproduces the same schedule and the same positions at seed 42', () => {
    const first = runPass();
    const second = runPass();

    expect(second.schedule).toEqual(first.schedule);
    expect(second.positions).toEqual(first.positions);
  });

  it('is not vacuous: the trio starts a visit, arrives, and moves', () => {
    const { schedule, positions } = runPass();
    const states = schedule.map((entry) => entry.split(':')[2]);

    expect(states).toContain('approach');
    expect(states).toContain('dwell');
    expect(positions.trike.x === 0 && positions.trike.z === 0).toBe(false);
  });
});
