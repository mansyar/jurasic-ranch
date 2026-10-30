import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  DINO_WALK_RADIUS_METRES,
  PAIR_BODY_CLEARANCE_METRES,
  trioAvoidanceNudges,
  trioSpawnPositions,
} from '../../src/ranch/avoidance.js';
import { BRACHIO_GAIT, DinoPlayer, STEGO_GAIT, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import { CALL_COOLDOWN_MS, CallCooldowns } from '../../src/ranch/ambient.js';
import {
  BROWSE_TREE_FOOT_METRES,
  CORNER_ANCHORS,
  CORNER_AZIMUTH_DEGREES,
  CORNER_FRAME_HALF_ANGLE_DEGREES,
  DRESSING_CATALOGUE,
  HAY_NEST_CENTRE_METRES,
  WALLOW_CENTRE_METRES,
  WALLOW_MUD_RADIUS_METRES,
  cornerPlacements,
} from '../../src/ranch/layout.js';
import type { CornerSpecies } from '../../src/ranch/layout.js';
import { gaitSpeedMetresPerSecond, wrapAngle } from '../../src/ranch/waddle.js';
import type { GaitParams } from '../../src/ranch/waddle.js';
import {
  VISIT_DWELL_SECONDS,
  VISIT_STATE_ORDER,
  VISIT_TIMER_BASE_SECONDS,
  VISIT_TIMER_SLOTS,
  VISIT_TIMER_WINDOW_SECONDS,
  VisitDirector,
  visitCorner,
} from '../../src/ranch/visit.js';
import type { VisitActor, VisitState } from '../../src/ranch/visit.js';
import { GROUND_POV_ORDER, POV_PRESETS } from '../../src/viewer/pov.js';

const DT = 1 / 60;
const SPECIES: readonly CornerSpecies[] = ['trike', 'stego', 'brachio'];

/**
 * The shipped gaits as authored. The viewer feeds the director the *world*
 * gaits (`worldGait(gait, DINO_GROUP_SCALE)` for Stego and Brachio), which
 * only scale the stride — and with it the derived seconds and the drift
 * budget. Every claim below is a relation the director derives from whatever
 * gait it is handed, so the authored numbers prove it without pulling
 * `src/viewer/loaders.ts` (and its GLB loader) into this suite.
 */
const GAITS: Readonly<Record<CornerSpecies, GaitParams>> = {
  trike: TRIKE_GAIT,
  stego: STEGO_GAIT,
  brachio: BRACHIO_GAIT,
};

/** How far a corner's props may stand beyond the place and still frame it. */
const CORNER_PROP_FRAME_METRES = 0.5;

/* -------------------------------------------------------------------------- *
 * Geometry helpers (the same reading as tests/ranch/layout.test.ts)
 * -------------------------------------------------------------------------- */

const DEGREES_PER_RADIAN = 180 / Math.PI;

/** Compass bearing from one ground point to another, +X = 0, +Z = 90. */
function bearingDegrees(from: readonly [number, number], to: readonly [number, number]): number {
  const degrees = Math.atan2(to[1] - from[1], to[0] - from[0]) * DEGREES_PER_RADIAN;
  return ((degrees % 360) + 360) % 360;
}

/** Shortest angle between two bearings, in degrees. */
function apartDegrees(first: number, second: number): number {
  return Math.abs(((((first - second) % 360) + 540) % 360) - 180);
}

function groundXZ(position: readonly [number, number, number]): readonly [number, number] {
  return [position[0], position[2]];
}

function gapMetres(from: readonly [number, number], to: readonly [number, number]): number {
  return Math.hypot(to[0] - from[0], to[1] - from[1]);
}

/** Perpendicular distance from a point to the segment between two others. */
function segmentClearanceMetres(
  point: readonly [number, number],
  start: readonly [number, number],
  end: readonly [number, number],
): number {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const projection = (point[0] - start[0]) * dx + (point[1] - start[1]) * dz;
  const along = projection / (lengthSquared === 0 ? 1 : lengthSquared);
  const clamped = Math.min(1, Math.max(0, along));
  return gapMetres(point, [start[0] + dx * clamped, start[1] + dz * clamped]);
}

/* -------------------------------------------------------------------------- *
 * A player-shaped stub: it records the three verbs and follows a heading
 * -------------------------------------------------------------------------- */

interface StubBody {
  position: { x: number; z: number };
}

function stubBodyAt(x: number, z: number): StubBody {
  return { position: { x, z } };
}

class StubActor implements VisitActor {
  heading = 0;
  walking = false;
  ring = { centre: { x: 0, z: 0 }, radius: DINO_WALK_RADIUS_METRES };
  readonly calls: string[] = [];

  setWalking(walking: boolean): void {
    this.walking = walking;
    this.calls.push(`walking:${walking}`);
  }

  turnTo(radians: number): void {
    this.heading = radians;
    this.calls.push(`turnTo:${radians}`);
  }

  setWanderRing(centre: { readonly x: number; readonly z: number }, radius: number): void {
    this.ring = { centre: { x: centre.x, z: centre.z }, radius };
    this.calls.push(`ring:${radius}`);
  }
}

/** The stub walks the way the player does: along its own heading at gait speed. */
function walkStub(actor: StubActor, body: StubBody, gait: GaitParams, dt: number): void {
  if (!actor.walking) {
    return;
  }
  const step = gaitSpeedMetresPerSecond(gait) * dt;
  body.position.x += Math.sin(actor.heading) * step;
  body.position.z += Math.cos(actor.heading) * step;
}

function stateOf(director: VisitDirector, species: CornerSpecies): VisitState {
  const state = director.getState(species);
  if (state === null) {
    throw new Error(`${species} is not registered`);
  }
  return state;
}

/* -------------------------------------------------------------------------- *
 * A real player, without a GLB: the rig and two synthetic clips
 * -------------------------------------------------------------------------- */

function createRig(): THREE.Group {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.name = 'Hips';
  root.add(hips);
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

function createPlayer(gait: GaitParams): { player: DinoPlayer; model: THREE.Group } {
  const model = createRig();
  const player = new DinoPlayer(model, {
    clip: createClip('Waddle', gait.loopSeconds),
    idleClip: createClip('Idle', 6),
    gait,
    random: () => 0.5,
  });
  return { player, model };
}

/* -------------------------------------------------------------------------- *
 * P4.T1 — the anchors (FR-5)
 * -------------------------------------------------------------------------- */

describe('corner anchors (P4.T1, FR-5)', () => {
  it('anchors each species on its own place: the mud, the nest, the tree', () => {
    expect(CORNER_ANCHORS.stego.anchor).toEqual(WALLOW_CENTRE_METRES);
    expect(CORNER_ANCHORS.stego.placeRadiusMetres).toBe(WALLOW_MUD_RADIUS_METRES);
    expect(CORNER_ANCHORS.trike.anchor).toEqual(HAY_NEST_CENTRE_METRES);
    expect(CORNER_ANCHORS.brachio.anchor).toEqual(BROWSE_TREE_FOOT_METRES);
  });

  it('pins the hay nest to the four bales and the browse tree to the plum tree', () => {
    const bales = cornerPlacements('trike').filter((item) => item.file === 'hay-bale-079e8c.glb');
    expect(bales.length).toBe(4);
    const meanX = bales.reduce((sum, item) => sum + item.position[0], 0) / bales.length;
    const meanZ = bales.reduce((sum, item) => sum + item.position[2], 0) / bales.length;
    expect(meanX).toBeCloseTo(HAY_NEST_CENTRE_METRES[0], 9);
    expect(meanZ).toBeCloseTo(HAY_NEST_CENTRE_METRES[1], 9);

    const plum = cornerPlacements('brachio').find((item) => item.file === 'plum-tree-565179.glb');
    expect(plum).toBeDefined();
    expect(plum?.position[0]).toBeCloseTo(BROWSE_TREE_FOOT_METRES[0], 9);
    expect(plum?.position[2]).toBeCloseTo(BROWSE_TREE_FOOT_METRES[1], 9);
  });

  it('derives each place radius from the prop that place belongs to', () => {
    const baleHalf = (DRESSING_CATALOGUE['hay-bale-079e8c.glb']?.footprintMetres ?? 0) / 2;
    const canopyHalf = (DRESSING_CATALOGUE['plum-tree-565179.glb']?.footprintMetres ?? 0) / 2;
    expect(CORNER_ANCHORS.trike.placeRadiusMetres).toBeCloseTo(0.55 + baleHalf, 12);
    expect(CORNER_ANCHORS.brachio.placeRadiusMetres).toBeCloseTo(canopyHalf, 12);
    expect(CORNER_ANCHORS.stego.placeRadiusMetres).toBe(WALLOW_MUD_RADIUS_METRES);
  });

  it('sits each anchor inside its corner frame and among that corner props', () => {
    const findings: string[] = [];
    for (const species of SPECIES) {
      const anchor = CORNER_ANCHORS[species];
      const bearing = bearingDegrees([0, 0], anchor.anchor);
      const off = apartDegrees(bearing, CORNER_AZIMUTH_DEGREES[species]);
      if (off > CORNER_FRAME_HALF_ANGLE_DEGREES) {
        findings.push(`${species}: anchor sits ${off.toFixed(1)} deg off its corner bearing`);
      }
      let nearestEdge = Number.POSITIVE_INFINITY;
      for (const prop of cornerPlacements(species)) {
        const centre = gapMetres(anchor.anchor, [prop.position[0], prop.position[2]]);
        const half = (DRESSING_CATALOGUE[prop.file]?.footprintMetres ?? 0) / 2;
        nearestEdge = Math.min(nearestEdge, centre - half);
      }
      if (nearestEdge > anchor.placeRadiusMetres + CORNER_PROP_FRAME_METRES) {
        findings.push(
          `${species}: nearest prop edge ${nearestEdge.toFixed(2)} m out, place reaches ${anchor.placeRadiusMetres.toFixed(2)} m`,
        );
      }
    }
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('keeps the three places apart from each other', () => {
    for (const species of SPECIES) {
      for (const other of SPECIES) {
        if (other === species) {
          continue;
        }
        const gap = gapMetres(CORNER_ANCHORS[species].anchor, CORNER_ANCHORS[other].anchor);
        const reach =
          CORNER_ANCHORS[species].placeRadiusMetres + CORNER_ANCHORS[other].placeRadiusMetres;
        expect(gap, `${species}/${other}`).toBeGreaterThan(reach);
      }
    }
  });

  it('clears every ground lens sightline, so a corner never hides the animal it frames', () => {
    // The corridor is the lens-to-subject segment, the reading the layout test
    // uses for "never stands a prop between a ground lens and the animal it
    // names". The 18 deg near-lens axis rule is a rule about props close to the
    // lens; an anchor stands *past* its subject, where it cannot occlude it.
    const findings: string[] = [];
    for (const species of SPECIES) {
      const anchor = CORNER_ANCHORS[species];
      for (const id of GROUND_POV_ORDER) {
        const preset = POV_PRESETS[id];
        const lens = groundXZ(preset.position);
        const subject = groundXZ(preset.lookAt);
        const clearance = segmentClearanceMetres(anchor.anchor, lens, subject);
        if (clearance <= anchor.placeRadiusMetres) {
          findings.push(
            `${id}: ${species} anchor ${clearance.toFixed(2)} m off the sightline, place is ${anchor.placeRadiusMetres.toFixed(2)} m`,
          );
        }
      }
    }
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('publishes an arrival radius of place plus turn-and-glide, facing outward', () => {
    for (const species of SPECIES) {
      const gait = GAITS[species];
      const corner = visitCorner(species, gait);
      expect(corner.stopRadiusMetres).toBe(corner.placeRadiusMetres);
      expect(corner.arrivalRadiusMetres).toBeGreaterThan(corner.placeRadiusMetres);
      expect(corner.dwellSeconds).toBe(VISIT_DWELL_SECONDS[species]);
      expect(corner.facingRadians).toBeCloseTo(Math.atan2(corner.anchor[0], corner.anchor[1]), 12);
      // The published radius is the place plus the worst case the gait allows.
      const speed = gaitSpeedMetresPerSecond(gait);
      const yawRate = Math.min(
        gait.turnRateRadiansPerSecond,
        gait.curvatureRadiansPerMetre * speed,
      );
      expect(corner.arrivalRadiusMetres).toBeCloseTo(
        corner.placeRadiusMetres + speed * (Math.PI / yawRate) + speed * 0.2,
        12,
      );
    }
  });
});

/* -------------------------------------------------------------------------- *
 * P4.T2 — the state machine (FR-4, AC-4)
 * -------------------------------------------------------------------------- */

describe('the visit cycle (P4.T2, FR-4, AC-4)', () => {
  it('names the five states in AC-4 order', () => {
    expect(VISIT_STATE_ORDER).toEqual(['idle', 'approach', 'arrive', 'dwell', 'return']);
  });

  for (const species of SPECIES) {
    it(`walks ${species} through idle → approach → arrive → dwell → return → idle`, () => {
      const gait = GAITS[species];
      const spawn = trioSpawnPositions()[SPECIES.indexOf(species)];
      const body = stubBodyAt(spawn.x, spawn.z);
      const actor = new StubActor();
      const director = new VisitDirector({ seed: 4 });
      director.register({ species, actor, body, gait });

      director.update(DT, true);
      expect(stateOf(director, species)).toBe('idle');
      const corner = visitCorner(species, gait);
      const startDistance = gapMetres([spawn.x, spawn.z], corner.anchor);

      expect(director.startVisit(species)).toBe(true);
      // FR-5: the ring becomes the corner, at the published arrival radius.
      expect(actor.ring.centre.x).toBeCloseTo(corner.anchor[0], 12);
      expect(actor.ring.centre.z).toBeCloseTo(corner.anchor[1], 12);
      expect(actor.ring.radius).toBeCloseTo(corner.arrivalRadiusMetres, 12);
      expect(actor.walking).toBe(true);

      const seen: VisitState[] = [];
      const walkingAt: boolean[] = [];
      const enteredAt: number[] = [];
      let ticks = 0;
      while (ticks < 60 * 200) {
        director.update(DT, true);
        walkStub(actor, body, gait, DT);
        const state = stateOf(director, species);
        if (seen[seen.length - 1] !== state) {
          seen.push(state);
          walkingAt.push(actor.walking);
          enteredAt.push(ticks * DT);
        }
        ticks += 1;
        if (seen.length > 1 && state === 'idle') {
          break;
        }
      }

      // AC-4: every state, in order, none skipped.
      expect(seen).toEqual(['approach', 'arrive', 'dwell', 'return', 'idle']);
      // The walk is on for both journeys and off for both rests.
      expect(walkingAt).toEqual([true, true, false, true, false]);

      // The approach is planned from the distance and the animal's own speed.
      const snapshot = director.getSnapshot(species);
      expect(snapshot?.approachSeconds).toBeCloseTo(
        startDistance / gaitSpeedMetresPerSecond(gait),
        12,
      );
      const approachSeconds = enteredAt[1] - enteredAt[0];
      expect(approachSeconds).toBeGreaterThan(
        (startDistance - corner.stopRadiusMetres) / gaitSpeedMetresPerSecond(gait) - DT,
      );

      // The dwell is the length of the clip that plays there.
      const dwellSeconds = enteredAt[3] - enteredAt[2];
      expect(dwellSeconds).toBeGreaterThanOrEqual(corner.dwellSeconds);
      expect(dwellSeconds).toBeLessThanOrEqual(corner.dwellSeconds + 2 * DT);

      // Home again: the home ring, the walk off, one visit and one arrival.
      expect(actor.ring.centre).toEqual({ x: 0, z: 0 });
      expect(actor.ring.radius).toBe(DINO_WALK_RADIUS_METRES);
      expect(snapshot?.visitsStarted).toBe(1);
      expect(snapshot?.arrivals).toBe(1);
      expect(snapshot?.secondsUntilVisit).toBeGreaterThanOrEqual(
        VISIT_TIMER_BASE_SECONDS + VISIT_TIMER_SLOTS[species],
      );
    });
  }

  it('absorbs a second call while the animal is out, and never turns walking on', () => {
    const actor = new StubActor();
    const body = stubBodyAt(0, DINO_WALK_RADIUS_METRES);
    const director = new VisitDirector({ seed: 4 });
    director.register({ species: 'trike', actor, body, gait: TRIKE_GAIT });

    // Walking off: a call is refused outright.
    director.update(DT, false);
    expect(director.startVisit('trike')).toBe(false);
    expect(stateOf(director, 'trike')).toBe('idle');

    director.update(DT, true);
    expect(director.startVisit('trike')).toBe(true);
    expect(stateOf(director, 'trike')).toBe('approach');
    expect(director.startVisit('trike')).toBe(false);
    expect(director.getSnapshot('trike')?.visitsStarted).toBe(1);
  });

  it('gives the walk back when the visit ends, so the animal ambles on', () => {
    const gait = TRIKE_GAIT;
    const spawn = trioSpawnPositions()[0];
    const body = stubBodyAt(spawn.x, spawn.z);
    const actor = new StubActor();
    // Walk is on: the button has already set every player walking.
    actor.setWalking(true);
    const director = new VisitDirector({ seed: 5 });
    director.register({ species: 'trike', actor, body, gait });
    director.update(DT, true);
    expect(director.startVisit('trike')).toBe(true);

    let sawIdle = false;
    for (let ticks = 0; ticks < 60 * 200 && !sawIdle; ticks += 1) {
      director.update(DT, true);
      walkStub(actor, body, gait, DT);
      sawIdle = stateOf(director, 'trike') === 'idle';
    }
    expect(sawIdle).toBe(true);
    // The return leg ends with the walk off, so the animal stops on its ring...
    expect(actor.walking).toBe(false);
    // ...and the first idle frame hands the flag back (rework 1).
    director.update(DT, true);
    expect(actor.walking).toBe(true);

    // Under way again: the stub has no steer, so it simply walks on.
    const rested = [body.position.x, body.position.z] as const;
    for (let ticks = 0; ticks < 60 * 30; ticks += 1) {
      director.update(DT, true);
      walkStub(actor, body, gait, DT);
    }
    expect(gapMetres(rested, [body.position.x, body.position.z])).toBeGreaterThan(1);
    expect(stateOf(director, 'trike')).toBe('idle');
  });

  it('never turns walking on while Walk is off', () => {
    const actor = new StubActor();
    const body = stubBodyAt(0, DINO_WALK_RADIUS_METRES);
    const director = new VisitDirector({ seed: 6 });
    director.register({ species: 'trike', actor, body, gait: TRIKE_GAIT });

    for (let ticks = 0; ticks < 60 * 120; ticks += 1) {
      director.update(DT, false);
    }

    expect(director.startVisit('trike')).toBe(false);
    expect(stateOf(director, 'trike')).toBe('idle');
    expect(actor.calls).not.toContain('walking:true');
    expect(actor.walking).toBe(false);
  });

  it('leaves the home ring alone until a visit starts', () => {
    const actor = new StubActor();
    const director = new VisitDirector({ seed: 4 });
    director.register({
      species: 'stego',
      actor,
      body: stubBodyAt(-1, 0),
      gait: STEGO_GAIT,
    });
    for (let frame = 0; frame < 60; frame += 1) {
      director.update(DT, true);
    }
    expect(actor.calls.some((call) => call.startsWith('ring:'))).toBe(false);
    expect(actor.ring.radius).toBe(DINO_WALK_RADIUS_METRES);
    expect(actor.ring.centre).toEqual({ x: 0, z: 0 });
  });
});

/* -------------------------------------------------------------------------- *
 * P4.T3 — the seeded timer (FR-9, AC-9)
 * -------------------------------------------------------------------------- */

interface SeededRun {
  species: CornerSpecies;
  gait: GaitParams;
  actor: StubActor;
  body: StubBody;
}

function seededRuns(seed: number): { director: VisitDirector; runs: SeededRun[] } {
  const spawn = trioSpawnPositions();
  const director = new VisitDirector({ seed });
  const runs = SPECIES.map((species, index) => {
    const run: SeededRun = {
      species,
      gait: GAITS[species],
      actor: new StubActor(),
      body: stubBodyAt(spawn[index].x, spawn[index].z),
    };
    director.register({
      species,
      actor: run.actor,
      body: run.body,
      gait: run.gait,
    });
    return run;
  });
  return { director, runs };
}

describe('the seeded timer (P4.T3, FR-9, AC-9)', () => {
  it('arms each species near 45 s, on three different countdowns', () => {
    const { director } = seededRuns(42);
    const countdowns = SPECIES.map((species) => director.getSnapshot(species)?.secondsUntilVisit);
    for (const species of SPECIES) {
      const countdown = director.getSnapshot(species)?.secondsUntilVisit ?? 0;
      expect(countdown).toBeGreaterThanOrEqual(
        VISIT_TIMER_BASE_SECONDS + VISIT_TIMER_SLOTS[species],
      );
      expect(countdown).toBeLessThanOrEqual(
        VISIT_TIMER_BASE_SECONDS + VISIT_TIMER_SLOTS[species] + VISIT_TIMER_WINDOW_SECONDS,
      );
    }
    expect(new Set(countdowns).size).toBe(3);
  });

  it('sends all three within 90 s, and never two in the same second', () => {
    const { director, runs } = seededRuns(42);
    const startedAt: number[] = [];
    const arrivedAt: number[] = [];
    for (let frame = 0; frame < 60 * 90; frame += 1) {
      director.update(DT, true);
      for (const run of runs) {
        walkStub(run.actor, run.body, run.gait, DT);
        const state = stateOf(director, run.species);
        const index = SPECIES.indexOf(run.species);
        if (state === 'approach' && startedAt[index] === undefined) {
          startedAt[index] = frame * DT;
        }
        if (state === 'dwell' && arrivedAt[index] === undefined) {
          arrivedAt[index] = frame * DT;
        }
      }
    }
    for (const species of SPECIES) {
      const index = SPECIES.indexOf(species);
      expect(startedAt[index], `${species} never set out`).toBeLessThan(90);
      expect(arrivedAt[index], `${species} never arrived`).toBeLessThan(90);
    }
    const seconds = startedAt.map((at) => Math.floor(at));
    expect(new Set(seconds).size).toBe(3);
  });

  it('holds every countdown while walking is off', () => {
    const { director, runs } = seededRuns(42);
    const before = SPECIES.map((species) => director.getSnapshot(species)?.secondsUntilVisit);
    for (let frame = 0; frame < 60 * 120; frame += 1) {
      director.update(DT, false);
      for (const run of runs) {
        walkStub(run.actor, run.body, run.gait, DT);
      }
    }
    const after = SPECIES.map((species) => director.getSnapshot(species)?.secondsUntilVisit);
    expect(after).toEqual(before);
    for (const species of SPECIES) {
      expect(stateOf(director, species)).toBe('idle');
    }
  });

  it('counts the frame dt, not the wall clock', () => {
    const fast = seededRuns(7);
    const slow = seededRuns(7);
    // A paused frame advances nothing at all.
    const armed = fast.director.getSnapshot('trike')?.secondsUntilVisit ?? 0;
    fast.director.update(0, true);
    expect(fast.director.getSnapshot('trike')?.secondsUntilVisit).toBe(armed);

    const startAt = (run: ReturnType<typeof seededRuns>, dt: number): number => {
      for (let frame = 0; frame < 60 * 90; frame += 1) {
        run.director.update(dt, true);
        if (stateOf(run.director, 'trike') === 'approach') {
          return frame * dt;
        }
      }
      return Number.POSITIVE_INFINITY;
    };
    const at60 = startAt(fast, DT);
    const at30 = startAt(slow, DT * 2);
    expect(at60).toBeLessThan(90);
    expect(Math.abs(at60 - at30)).toBeLessThanOrEqual(DT * 2);
  });
});

/* -------------------------------------------------------------------------- *
 * P4.T4 — avoidance in transit (FR-11, AC-11)
 * -------------------------------------------------------------------------- */

function applyTrioNudges(runs: readonly { player: DinoPlayer; model: THREE.Object3D }[]): boolean {
  const [trike, stego, brachio] = runs;
  const nudges = trioAvoidanceNudges(
    trike.model.position.x,
    trike.model.position.z,
    trike.player.heading,
    stego.model.position.x,
    stego.model.position.z,
    stego.player.heading,
    brachio.model.position.x,
    brachio.model.position.z,
    brachio.player.heading,
  );
  if (nudges.aNudge !== 0) {
    trike.player.turnTo(wrapAngle(trike.player.heading + nudges.aNudge));
  }
  if (nudges.bNudge !== 0) {
    stego.player.turnTo(wrapAngle(stego.player.heading + nudges.bNudge));
  }
  if (nudges.cNudge !== 0) {
    brachio.player.turnTo(wrapAngle(brachio.player.heading + nudges.cNudge));
  }
  return nudges.aNudge !== 0 || nudges.bNudge !== 0 || nudges.cNudge !== 0;
}

function pairDistance(first: { model: THREE.Object3D }, second: { model: THREE.Object3D }): number {
  return Math.hypot(
    first.model.position.x - second.model.position.x,
    first.model.position.z - second.model.position.z,
  );
}

describe('avoidance in transit (P4.T4, FR-11, AC-11)', () => {
  it('keeps the shipped trio clear while two of them walk out to their corners', () => {
    const spawn = trioSpawnPositions();
    const runs = SPECIES.map((species, index) => {
      const { player, model } = createPlayer(GAITS[species]);
      model.position.set(spawn[index].x, 0, spawn[index].z);
      player.turnTo(0);
      return { species, player, model };
    });
    const director = new VisitDirector({ seed: 11 });
    for (const run of runs) {
      director.register({
        species: run.species,
        actor: run.player,
        body: run.model,
        gait: GAITS[run.species],
      });
    }
    director.update(DT, true);
    expect(director.startVisit('trike')).toBe(true);
    expect(director.startVisit('stego')).toBe(true);
    // The third animal keeps wandering its home ring for the whole run.
    runs[2].player.setWalking(true);

    let closest = Number.POSITIVE_INFINITY;
    for (let frame = 0; frame < 60 * 30; frame += 1) {
      director.update(DT, true);
      applyTrioNudges(runs);
      for (const run of runs) {
        run.player.update(DT, frame * DT, false);
      }
      // Measured while the two visits are out: that is the transit AC-11 is
      // about. The ring they come home to is the existing trio's own problem.
      if (stateOf(director, 'trike') === 'idle' || stateOf(director, 'stego') === 'idle') {
        continue;
      }
      closest = Math.min(
        closest,
        pairDistance(runs[0], runs[1]),
        pairDistance(runs[0], runs[2]),
        pairDistance(runs[1], runs[2]),
      );
    }
    expect(closest).toBeGreaterThanOrEqual(PAIR_BODY_CLEARANCE_METRES);
    expect(director.getSnapshot('trike')?.arrivals).toBe(1);
    expect(director.getSnapshot('stego')?.arrivals).toBe(1);
  });

  it('nudges visit headings apart without losing either journey', () => {
    // Three animals 1.386 m apart — inside the avoidance trigger, outside the
    // pair clearance — all sent out at once. Every pair must stay clear, the
    // nudges must actually fire on the visit headings, and every animal must
    // still reach its corner.
    const ring = 0.8;
    const starts: readonly (readonly [number, number])[] = [
      [0, ring],
      [ring * Math.cos((7 * Math.PI) / 6), ring * Math.sin((7 * Math.PI) / 6)],
      [ring * Math.cos(-Math.PI / 6), ring * Math.sin(-Math.PI / 6)],
    ];
    const runs = SPECIES.map((species, index) => {
      const { player, model } = createPlayer(GAITS[species]);
      model.position.set(starts[index][0], 0, starts[index][1]);
      player.turnTo(0);
      return { species, player, model };
    });
    const director = new VisitDirector({ seed: 11 });
    for (const run of runs) {
      director.register({
        species: run.species,
        actor: run.player,
        body: run.model,
        gait: GAITS[run.species],
      });
    }
    director.update(DT, true);
    for (const run of runs) {
      expect(director.startVisit(run.species)).toBe(true);
    }

    let nudgedFrames = 0;
    let closest = Number.POSITIVE_INFINITY;
    for (let frame = 0; frame < 60 * 90; frame += 1) {
      director.update(DT, true);
      if (applyTrioNudges(runs)) {
        nudgedFrames += 1;
      }
      for (const run of runs) {
        run.player.update(DT, frame * DT, false);
      }
      if (SPECIES.every((species) => (director.getSnapshot(species)?.arrivals ?? 0) > 0)) {
        break;
      }
      closest = Math.min(
        closest,
        pairDistance(runs[0], runs[1]),
        pairDistance(runs[0], runs[2]),
        pairDistance(runs[1], runs[2]),
      );
    }
    expect(nudgedFrames).toBeGreaterThan(0);
    expect(closest).toBeGreaterThanOrEqual(PAIR_BODY_CLEARANCE_METRES);
    for (const run of runs) {
      expect(director.getSnapshot(run.species)?.arrivals, run.species).toBeGreaterThanOrEqual(1);
    }
  });
});

/* -------------------------------------------------------------------------- *
 * AC-5 — the animal stops in the place and faces it
 * -------------------------------------------------------------------------- */

describe('arrival (AC-5)', () => {
  for (const species of SPECIES) {
    it(`stops ${species} inside its arrival radius, facing the corner`, () => {
      const spawn = trioSpawnPositions()[SPECIES.indexOf(species)];
      const { player, model } = createPlayer(GAITS[species]);
      model.position.set(spawn.x, 0, spawn.z);
      const director = new VisitDirector({ seed: 3 });
      director.register({ species, actor: player, body: model, gait: GAITS[species] });
      director.update(DT, true);
      expect(director.startVisit(species)).toBe(true);

      const corner = visitCorner(species, GAITS[species]);
      let dwellFrame = -1;
      for (let frame = 0; frame < 60 * 120; frame += 1) {
        director.update(DT, true);
        player.update(DT, frame * DT, false);
        if (stateOf(director, species) === 'dwell') {
          dwellFrame = frame;
          break;
        }
      }
      expect(dwellFrame, `${species} never arrived`).toBeGreaterThanOrEqual(0);

      // The blend glides for 0.2 s after the stop, so measure where it rests.
      for (let frame = 0; frame < 60; frame += 1) {
        director.update(DT, true);
        player.update(DT, (dwellFrame + frame) * DT, false);
      }
      const rest = Math.hypot(
        model.position.x - corner.anchor[0],
        model.position.z - corner.anchor[1],
      );
      expect(rest, `${species} rests ${rest.toFixed(2)} m out`).toBeLessThanOrEqual(
        corner.arrivalRadiusMetres,
      );
      expect(Math.abs(wrapAngle(corner.facingRadians - player.heading))).toBeLessThanOrEqual(0.2);
    });
  }
});

/* -------------------------------------------------------------------------- *
 * P5.T4 — Walk off sends everyone home (FR-10, AC-10)
 * -------------------------------------------------------------------------- */

function distanceFromHome(body: StubBody): number {
  return Math.hypot(body.position.x, body.position.z);
}

describe('Walk off sends everyone home (P5.T4, FR-10, AC-10)', () => {
  it('turns the animal around from where it stands, then walks it home', () => {
    const { director, runs } = seededRuns(42);
    const trike = runs[0];

    // Walk on until the Trike is out on its approach.
    let frames = 0;
    while (stateOf(director, 'trike') !== 'approach' && frames < 60 * 120) {
      director.update(DT, true);
      for (const run of runs) {
        walkStub(run.actor, run.body, run.gait, DT);
      }
      frames += 1;
    }
    expect(stateOf(director, 'trike')).toBe('approach');
    for (let index = 0; index < 60 * 5; index += 1) {
      director.update(DT, true);
      for (const run of runs) {
        walkStub(run.actor, run.body, run.gait, DT);
      }
    }
    const away = distanceFromHome(trike.body);
    expect(away).toBeGreaterThan(1);

    // Walk off: the animal is turned around where it stands, not moved there.
    const beforeX = trike.body.position.x;
    const beforeZ = trike.body.position.z;
    director.update(DT, false);
    expect(stateOf(director, 'trike')).toBe('return');
    expect(trike.body.position.x).toBe(beforeX);
    expect(trike.body.position.z).toBe(beforeZ);
    expect(trike.actor.walking).toBe(true);
    expect(trike.actor.ring.radius).toBe(DINO_WALK_RADIUS_METRES);
    expect(trike.actor.ring.centre).toEqual({ x: 0, z: 0 });

    // It walks home from there: still outside its ring on the way, inside it at rest.
    let outsideFrames = 0;
    let settled = 0;
    while (settled < 60 * 120) {
      director.update(DT, false);
      for (const run of runs) {
        walkStub(run.actor, run.body, run.gait, DT);
      }
      if (stateOf(director, 'trike') === 'return' && distanceFromHome(trike.body) > 1) {
        outsideFrames += 1;
      }
      if (SPECIES.every((species) => stateOf(director, species) === 'idle')) {
        break;
      }
      settled += 1;
    }
    expect(outsideFrames).toBeGreaterThan(30);
    expect(settled).toBeLessThan(60 * 120);
    for (const run of runs) {
      expect(stateOf(director, run.species), run.species).toBe('idle');
      expect(distanceFromHome(run.body), run.species).toBeLessThanOrEqual(DINO_WALK_RADIUS_METRES);
    }
  });

  it('ends a visit already at its corner, so nobody is left out', () => {
    const actor = new StubActor();
    const body = stubBodyAt(0, DINO_WALK_RADIUS_METRES);
    const director = new VisitDirector({ seed: 9 });
    director.register({ species: 'stego', actor, body, gait: STEGO_GAIT });
    director.update(DT, true);
    expect(director.startVisit('stego')).toBe(true);

    let frames = 0;
    while (stateOf(director, 'stego') !== 'dwell' && frames < 60 * 60) {
      director.update(DT, true);
      walkStub(actor, body, STEGO_GAIT, DT);
      frames += 1;
    }
    expect(stateOf(director, 'stego')).toBe('dwell');
    const atCorner = distanceFromHome(body);
    expect(atCorner).toBeGreaterThan(1);

    director.update(DT, false);
    expect(stateOf(director, 'stego')).toBe('return');
    expect(distanceFromHome(body)).toBeCloseTo(atCorner, 9);

    for (let index = 0; index < 60 * 120; index += 1) {
      director.update(DT, false);
      walkStub(actor, body, STEGO_GAIT, DT);
      if (stateOf(director, 'stego') === 'idle') {
        break;
      }
    }
    expect(stateOf(director, 'stego')).toBe('idle');
    expect(distanceFromHome(body)).toBeLessThanOrEqual(DINO_WALK_RADIUS_METRES);
  });
});

/* -------------------------------------------------------------------------- *
 * P5.T2 / P5.T5 — the arrival hook the payoff hangs off (FR-6, FR-12, FR-13)
 * -------------------------------------------------------------------------- */

class ClipStubActor extends StubActor {
  clips = 0;

  playArrivalClip(): boolean {
    this.clips += 1;
    return true;
  }
}

describe('the arrival hook (P5.T2, P5.T5, FR-6, FR-12)', () => {
  it('reports every arrival once, with its species, and asks for the corner one-shot', () => {
    const arrivals: CornerSpecies[] = [];
    const spawn = trioSpawnPositions();
    const director = new VisitDirector({
      seed: 42,
      onArrival: (species) => {
        arrivals.push(species);
      },
    });
    const runs = SPECIES.map((species, index) => {
      const actor = new ClipStubActor();
      const body = stubBodyAt(spawn[index].x, spawn[index].z);
      const gait = GAITS[species];
      director.register({ species, actor, body, gait });
      return { species, actor, body, gait };
    });

    for (let frame = 0; frame < 60 * 90; frame += 1) {
      director.update(DT, true);
      for (const run of runs) {
        walkStub(run.actor, run.body, run.gait, DT);
      }
    }

    expect(arrivals.slice().sort()).toEqual(['brachio', 'stego', 'trike']);
    for (const run of runs) {
      expect(run.actor.clips, run.species).toBe(1);
      expect(director.getSnapshot(run.species)?.arrivals, run.species).toBe(1);
    }
  });
});

/* -------------------------------------------------------------------------- *
 * P5.T1 — a second tap inside the cooldown never restarts the journey (AC-8)
 * -------------------------------------------------------------------------- */

describe('a tap inside the cooldown (P5.T1, AC-8)', () => {
  it('sparkles again but leaves the journey running as it was', () => {
    const actor = new StubActor();
    const body = stubBodyAt(0, DINO_WALK_RADIUS_METRES);
    const director = new VisitDirector({ seed: 11 });
    director.register({ species: 'trike', actor, body, gait: TRIKE_GAIT });
    const cooldowns = new CallCooldowns();

    // The tap handler's own order: the sparkle is unconditional, the call is
    // gated, and only then does the director get a say.
    const tap = (nowMs: number): boolean => {
      if (!cooldowns.allows('trike', nowMs)) {
        return false;
      }
      cooldowns.record('trike', nowMs);
      return director.startVisit('trike');
    };

    // Walk is on when the child taps, which is the state a call is offered in.
    director.update(DT, true);
    expect(tap(1_000)).toBe(true);
    const approachSeconds = director.getSnapshot('trike')?.approachSeconds;
    for (let frame = 0; frame < 60; frame += 1) {
      director.update(DT, true);
      walkStub(actor, body, TRIKE_GAIT, DT);
    }

    expect(tap(1_000 + CALL_COOLDOWN_MS - 1)).toBe(false);
    expect(stateOf(director, 'trike')).toBe('approach');
    expect(director.getSnapshot('trike')?.visitsStarted).toBe(1);
    expect(director.getSnapshot('trike')?.approachSeconds).toBe(approachSeconds);

    // Cooled down, the tap reaches the director — which still refuses, because
    // the Trike is already out at its corner.
    expect(tap(1_000 + CALL_COOLDOWN_MS)).toBe(false);
    expect(director.getSnapshot('trike')?.visitsStarted).toBe(1);
  });
});
