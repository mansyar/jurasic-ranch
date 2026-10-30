import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseDevQuery } from '../../src/dev/dev-options.js';
import { DustPool } from '../../src/ranch/dust.js';
import { BRACHIO_GAIT, STEGO_GAIT, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import { AVOIDANCE_TRIGGER_METRES } from '../../src/ranch/avoidance.js';
import type { CornerSpecies } from '../../src/ranch/layout.js';
import {
  VisitDirector,
  visitCorner,
  type VisitActor,
  type VisitSnapshot,
} from '../../src/ranch/visit.js';
import { gaitSpeedMetresPerSecond, type GaitParams } from '../../src/ranch/waddle.js';
import {
  DEV_PANEL_ATTRIBUTE,
  VISIT_CORNER_LABELS,
  installDevHarness,
  type DevBridge,
  type DevDinoHandle,
  type DevFrameHook,
  type DevRanchApi,
} from '../../src/dev/harness.js';
import type { DevSpeciesId } from '../../src/dev/dev-options.js';
import type { SnapshotAudio } from '../../src/dev/snapshot.js';
import { POV_ORDER, type PovPresetId } from '../../src/viewer/pov.js';
import { type FakeDom, type FakeElement, installFakeDom } from './fake-dom.js';

/**
 * Panel wiring (FR-2, AC-2, F2/F6): species buttons toggle exactly one dino,
 * solo presets live in their own group, `aria-pressed` mirrors the visibility
 * it controls, and the HUD is not announced to screen readers.
 */

const IDS: readonly DevSpeciesId[] = ['trike', 'stego', 'brachio'];
const LABELS: Record<DevSpeciesId, string> = { trike: 'Trike', stego: 'Stego', brachio: 'Brachio' };

/** Recording audio stand-in: no engine and no Howler in these tests. */
interface FakeAudio {
  state: SnapshotAudio;
  actions: string[];
}

/** Recording visit stand-in: the panel never reaches the director directly. */
interface FakeVisits {
  calls: CornerSpecies[];
  snapshots: VisitSnapshot[];
  next: boolean;
}

interface FakeBridge {
  bridge: DevBridge;
  models: Record<DevSpeciesId, THREE.Group>;
  audio: FakeAudio;
  visits: FakeVisits;
}

function createAudio(): FakeAudio {
  return {
    state: {
      unlocked: false,
      muted: false,
      volume: 0.8,
      musicPlaying: false,
      activeLine: null,
      lastStartLatencyMs: 0,
    },
    actions: [],
  };
}

function createBridge(): FakeBridge {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const models = {
    trike: new THREE.Group(),
    stego: new THREE.Group(),
    brachio: new THREE.Group(),
  };
  const dinos: DevDinoHandle[] = IDS.map((id) => ({
    id,
    label: LABELS[id],
    getModel: () => models[id],
    getPlayer: () => null,
  }));
  // Structural stand-in: node has no WebGL context, and these tests never
  // frame a render, so only `info.render` needs to exist.
  const renderer = {
    info: { render: { calls: 0, triangles: 0 } },
  } as unknown as THREE.WebGLRenderer;
  const audio = createAudio();
  const visits: FakeVisits = { calls: [], snapshots: [], next: true };
  const bridge: DevBridge = {
    scene,
    camera,
    renderer,
    dust: new DustPool(),
    dinos,
    getWalking: () => true,
    setWalking: () => undefined,
    getPov: () => 'ranch',
    setPov: () => undefined,
    forceSleepy: () => undefined,
    forceHint: () => undefined,
    getSleepyState: () => 'awake',
    getAudioState: () => ({ ...audio.state }),
    mute: (muted: boolean) => {
      audio.state.muted = muted;
      audio.actions.push(`mute:${muted}`);
    },
    setVolume: (volume: number) => {
      audio.state.volume = volume;
      audio.actions.push(`volume:${volume}`);
    },
    play: (id) => {
      audio.state.activeLine = id;
      audio.actions.push(`play:${id}`);
    },
    stopAll: () => {
      audio.state.activeLine = null;
      audio.state.musicPlaying = false;
      audio.actions.push('stop-all');
    },
    callVisit: (species: CornerSpecies) => {
      visits.calls.push(species);
      return visits.next;
    },
    getVisitState: () => visits.snapshots,
  };
  return { bridge, models, audio, visits };
}

function findRow(body: FakeElement, label: string): FakeElement {
  const row = body.queryAll(
    (element) => element.getAttribute('aria-label') === label && element.tagName === 'div',
  )[0];
  if (row === undefined) {
    throw new Error(`panel row "${label}" not found`);
  }
  return row;
}

function button(row: FakeElement, label: string): FakeElement {
  const found = row.findButton(label);
  if (found === null) {
    throw new Error(`button "${label}" not found in row`);
  }
  return found;
}

function pressed(element: FakeElement): string {
  return element.getAttribute('aria-pressed') ?? 'missing';
}

describe('panel visibility toggles (FR-2, AC-2)', () => {
  let dom: FakeDom;

  beforeEach(() => {
    dom = installFakeDom();
  });

  afterEach(() => {
    dom.restore();
  });

  it('hides exactly the pressed dino and leaves the others walking', () => {
    const { bridge, models } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const row = findRow(dom.body, 'Dino visibility');

    button(row, 'Stego').click();

    expect(models.stego.visible).toBe(false);
    expect(models.trike.visible).toBe(true);
    expect(models.brachio.visible).toBe(true);
  });

  it('shows the dino again on a second press', () => {
    const { bridge, models } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const row = findRow(dom.body, 'Dino visibility');
    const stego = button(row, 'Stego');

    stego.click();
    stego.click();

    expect(models.stego.visible).toBe(true);
    expect(pressed(stego)).toBe('true');
  });

  it("binds aria-pressed to that dino's own visibility", () => {
    const { bridge } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const row = findRow(dom.body, 'Dino visibility');

    button(row, 'Trike').click();

    expect(pressed(button(row, 'Trike'))).toBe('false');
    expect(pressed(button(row, 'Stego'))).toBe('true');
    expect(pressed(button(row, 'Brachio'))).toBe('true');
  });

  it('keeps solo presets in a separate group', () => {
    const { bridge, models } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const soloRow = findRow(dom.body, 'Solo');

    button(soloRow, 'Stego').click();

    expect(models.trike.visible).toBe(false);
    expect(models.stego.visible).toBe(true);
    expect(models.brachio.visible).toBe(false);
    expect(pressed(button(soloRow, 'Stego'))).toBe('true');
    expect(pressed(button(soloRow, 'Trike'))).toBe('false');

    button(soloRow, 'All').click();
    expect(models.trike.visible).toBe(true);
    expect(models.stego.visible).toBe(true);
    expect(models.brachio.visible).toBe(true);
  });

  it('keeps independent toggles independent of the solo presets', () => {
    const { bridge, models } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const row = findRow(dom.body, 'Dino visibility');

    button(row, 'Stego').click();
    button(row, 'Brachio').click();

    expect(models.trike.visible).toBe(true);
    expect(models.stego.visible).toBe(false);
    expect(models.brachio.visible).toBe(false);
  });
});

describe('overlay metrics come from the simulation (F5)', () => {
  let dom: FakeDom;

  beforeEach(() => {
    dom = installFakeDom();
  });

  afterEach(() => {
    dom.restore();
  });

  function overlayRadius(bridge: DevBridge, name: string): number {
    const overlay = bridge.scene.getObjectByName(name);
    expect(overlay).toBeInstanceOf(THREE.Mesh);
    const geometry = (overlay as THREE.Mesh).geometry as THREE.RingGeometry;
    return geometry.parameters.outerRadius;
  }

  it('draws the shared wander circle at the gait wander radius', () => {
    const { bridge } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    // The trio shares one wander circle, so every gait must agree on it.
    expect(STEGO_GAIT.wanderRadiusMetres).toBe(TRIKE_GAIT.wanderRadiusMetres);
    expect(BRACHIO_GAIT.wanderRadiusMetres).toBe(TRIKE_GAIT.wanderRadiusMetres);
    expect(overlayRadius(bridge, 'DevWanderRing')).toBeCloseTo(TRIKE_GAIT.wanderRadiusMetres, 5);
  });

  it('draws each avoidance ring at the avoidance trigger distance', () => {
    const { bridge } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    for (const { id } of bridge.dinos) {
      expect(overlayRadius(bridge, `DevAvoidanceRing:${id}`)).toBeCloseTo(
        AVOIDANCE_TRIGGER_METRES,
        5,
      );
    }
  });
});

describe('HUD accessibility (FR-4, F6)', () => {
  let dom: FakeDom;

  beforeEach(() => {
    dom = installFakeDom();
  });

  afterEach(() => {
    dom.restore();
  });

  it('does not announce the 5 Hz HUD to screen readers', () => {
    const { bridge } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const hud = dom.body.queryAll((element) => element.tagName === 'p')[0];

    expect(hud.getAttribute('aria-live')).toBeNull();
    expect(hud.textContent).toContain('fps');
  });

  it('still mounts one panel', () => {
    const { bridge } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const panels = dom.body.queryAll((element) => element.getAttribute(DEV_PANEL_ATTRIBUTE) === '');
    expect(panels).toHaveLength(1);
  });
});

/** The api the harness published on the fake window. */
function ranchApi(dom: FakeDom): DevRanchApi {
  const api = dom.window['__ranch'];
  if (api === undefined) {
    throw new Error('window.__ranch was not published');
  }
  return api as DevRanchApi;
}

describe('audio bridge (FR-10, AC-11)', () => {
  let dom: FakeDom;

  beforeEach(() => {
    dom = installFakeDom();
  });

  afterEach(() => {
    dom.restore();
  });

  it('publishes the live audio state on window.__ranch.audio', () => {
    const { bridge, audio } = createBridge();
    audio.state = {
      unlocked: true,
      muted: false,
      volume: 0.55,
      musicPlaying: true,
      activeLine: null,
      lastStartLatencyMs: 4.2,
    };
    installDevHarness(bridge, parseDevQuery('?dev=1'));

    const state = ranchApi(dom).audio;
    expect(state.unlocked).toBe(true);
    expect(state.muted).toBe(false);
    expect(state.volume).toBe(0.55);
    expect(state.musicPlaying).toBe(true);
    expect(state.activeLine).toBeNull();
    expect(state.lastStartLatencyMs).toBeCloseTo(4.2, 12);
  });

  it('routes mute and volume through the injected controls', () => {
    const { bridge, audio } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const api = ranchApi(dom);

    api.audio.mute(true);
    expect(audio.actions).toEqual(['mute:true']);
    expect(audio.state.muted).toBe(true);

    api.audio.setVolume(0.4);
    expect(audio.actions).toEqual(['mute:true', 'volume:0.4']);
    expect(api.audio.volume).toBe(0.4);
  });

  it('forwards play and stopAll and reflects them in the state', () => {
    const { bridge, audio } = createBridge();
    audio.state.musicPlaying = true;
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const api = ranchApi(dom);

    api.audio.play('hello');
    expect(audio.actions).toEqual(['play:hello']);
    expect(api.audio.activeLine).toBe('hello');

    api.audio.stopAll();
    expect(audio.actions).toEqual(['play:hello', 'stop-all']);
    expect(api.audio.activeLine).toBeNull();
    expect(api.audio.musicPlaying).toBe(false);
  });

  it('carries the same audio block in the snapshot', () => {
    const { bridge, audio } = createBridge();
    audio.state = {
      unlocked: true,
      muted: true,
      volume: 0.25,
      musicPlaying: false,
      activeLine: 'nom',
      lastStartLatencyMs: 1.5,
    };
    installDevHarness(bridge, parseDevQuery('?dev=1'));

    const snapshot = ranchApi(dom).snapshot();
    expect(snapshot.audio).toEqual(audio.state);
    expect(snapshot.audio).not.toBe(audio.state);
  });

  it('reads the frame the renderer drew into the snapshot (AC-8, F3)', () => {
    // The plumbing F3 asked for: `renderer.info.render` is the only honest source
    // for a frame's draw calls and triangles, and the harness is what has it.
    const { bridge } = createBridge();
    bridge.renderer.info.render.calls = 87;
    bridge.renderer.info.render.triangles = 41_234;
    installDevHarness(bridge, parseDevQuery('?dev=1'));

    const snapshot = ranchApi(dom).snapshot();
    expect(snapshot.drawCalls).toBe(87);
    expect(snapshot.triangles).toBe(41_234);
  });

  it('drives mute, play hello and stop from the Sound row', () => {
    const { bridge, audio } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const row = findRow(dom.body, 'Sound');
    const mute = button(row, 'Mute');

    expect(pressed(mute)).toBe('false');
    mute.click();
    expect(audio.actions).toEqual(['mute:true']);
    expect(pressed(mute)).toBe('true');

    button(row, 'Play hello').click();
    expect(audio.actions).toEqual(['mute:true', 'play:hello']);

    button(row, 'Stop').click();
    expect(audio.actions).toEqual(['mute:true', 'play:hello', 'stop-all']);
  });
});

describe('viewpoint row (FR-9, P4.T5)', () => {
  let dom: FakeDom;

  beforeEach(() => {
    dom = installFakeDom();
  });

  afterEach(() => {
    dom.restore();
  });

  /** A bridge whose viewpoint actually moves, so a press can be observed. */
  function createPovBridge(): { bridge: DevBridge; pressed: string[] } {
    const { bridge } = createBridge();
    const presses: string[] = [];
    let active: PovPresetId = 'ranch';
    bridge.getPov = () => active;
    bridge.setPov = (id: PovPresetId) => {
      active = id;
      presses.push(id);
    };
    return { bridge, pressed: presses };
  }

  it('derives a button per preset from POV_ORDER, Sky included', () => {
    const { bridge } = createPovBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const row = findRow(dom.body, 'Viewpoint');

    for (const id of POV_ORDER) {
      const label = id.charAt(0).toUpperCase() + id.slice(1);
      expect(button(row, label).getAttribute('data-dev-pov')).toBe(id);
    }
    // Exactly one button per preset: the row is POV_ORDER, not a second list.
    expect(row.queryAll((element) => element.getAttribute('data-dev-pov') !== null)).toHaveLength(
      POV_ORDER.length,
    );
  });

  it('routes a Sky press to setPov and marks it pressed', () => {
    const { bridge, pressed: presses } = createPovBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const row = findRow(dom.body, 'Viewpoint');
    const sky = button(row, 'Sky');

    expect(pressed(sky)).toBe('false');
    sky.click();

    expect(presses).toEqual(['sky']);
    expect(pressed(sky)).toBe('true');
    expect(pressed(button(row, 'Ranch'))).toBe('false');
  });
});

/** The authored gaits the corner geometry is derived from. */
const GAITS: Readonly<Record<CornerSpecies, GaitParams>> = {
  trike: TRIKE_GAIT,
  stego: STEGO_GAIT,
  brachio: BRACHIO_GAIT,
};

/** A walker playing the part `DinoPlayer` plays for the director. */
interface VisitWalker {
  species: CornerSpecies;
  walking: boolean;
  clips: number;
}

interface VisitRig {
  walkers: Record<CornerSpecies, VisitWalker>;
  callVisit(species: CornerSpecies): boolean;
  getVisitState(): VisitSnapshot[];
  arrivals(species: CornerSpecies): number;
  /** One loop frame: the dev hook, then the director, then the walkers. */
  advance(frame: DevFrameHook, dt: number): number;
}

/**
 * A real `VisitDirector` driven the way the loop drives it: the dev hook
 * decides the delta, the director decides the state, and the walkers move at
 * their gait speed — exactly the split `startLoop` keeps. The models are the
 * bodies, so the snapshot's measured distance is the walker's real distance.
 */
function createVisitRig(models: Record<DevSpeciesId, THREE.Group>): VisitRig {
  const director = new VisitDirector({ seed: 42 });
  const walkers: Record<CornerSpecies, VisitWalker> = {
    trike: { species: 'trike', walking: true, clips: 0 },
    stego: { species: 'stego', walking: true, clips: 0 },
    brachio: { species: 'brachio', walking: true, clips: 0 },
  };
  for (const species of IDS) {
    const walker = walkers[species];
    const corner = visitCorner(species, GAITS[species]);
    const position = models[species].position;
    // Three metres short of the corner: the approach is what is under test,
    // not the length of the walk to it.
    position.set(corner.anchor[0] - 3, position.y, corner.anchor[1]);
    let heading = 0;
    const actor: VisitActor = {
      get heading() {
        return heading;
      },
      get walking() {
        return walker.walking;
      },
      setWalking: (next: boolean) => {
        walker.walking = next;
      },
      turnTo: (radians: number) => {
        heading = radians;
      },
      setWanderRing: () => undefined,
      playArrivalClip: () => {
        walker.clips += 1;
        return true;
      },
    };
    director.register({ species, actor, body: { position }, gait: GAITS[species] });
  }
  // The page has been running: the director only lets a call through once it
  // has seen the trio walking, and a `?pause=1` page never frames on its own.
  director.update(1 / 60, true);
  let seconds = 0;
  const advance = (frame: DevFrameHook, dt: number): number => {
    const stepped = frame(dt, seconds);
    seconds += dt;
    if (stepped <= 0) {
      return 0;
    }
    // The loop's order: the director first, then the players move.
    director.update(stepped, true);
    for (const species of IDS) {
      const walker = walkers[species];
      const snapshot = director.getSnapshot(species);
      if (!walker.walking || snapshot === null) {
        continue;
      }
      const position = models[species].position;
      const dx = snapshot.corner.anchor[0] - position.x;
      const dz = snapshot.corner.anchor[1] - position.z;
      const distance = Math.hypot(dx, dz);
      const step = gaitSpeedMetresPerSecond(GAITS[species]) * stepped;
      if (distance <= step || distance === 0) {
        position.set(snapshot.corner.anchor[0], position.y, snapshot.corner.anchor[1]);
      } else {
        position.set(
          position.x + (dx / distance) * step,
          position.y,
          position.z + (dz / distance) * step,
        );
      }
    }
    return stepped;
  };
  return {
    walkers,
    callVisit: (species: CornerSpecies) => director.startVisit(species),
    getVisitState: () => director.getSnapshots(),
    arrivals: (species: CornerSpecies) => director.getSnapshot(species)?.arrivals ?? 0,
    advance,
  };
}

/** Run `tick` until `promise` settles, so a seek never blocks on a wall clock. */
async function drain<T>(promise: Promise<T>, tick: () => void): Promise<T> {
  let value: T | null = null;
  void promise.then((result) => {
    value = result;
  });
  for (let frame = 0; frame < 5000 && value === null; frame += 1) {
    tick();
    await Promise.resolve();
  }
  if (value === null) {
    throw new Error('visit seek never settled');
  }
  return value;
}

function stegoDwell(): VisitSnapshot {
  return {
    species: 'stego',
    state: 'dwell',
    secondsInState: 1.5,
    secondsUntilVisit: 0,
    approachSeconds: 9,
    visitsStarted: 1,
    arrivals: 1,
    corner: {
      species: 'stego',
      anchor: [4, 0],
      facingRadians: 0,
      placeRadiusMetres: 1.25,
      arrivalRadiusMetres: 1,
      stopRadiusMetres: 0.8,
      dwellSeconds: 4,
    },
  };
}

describe('visit row (FR-14, AC-14)', () => {
  let dom: FakeDom;

  beforeEach(() => {
    dom = installFakeDom();
  });

  afterEach(() => {
    dom.restore();
  });

  it('gives the Visit row one button per corner, named for the place', () => {
    const { bridge } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));
    const row = findRow(dom.body, 'Visit');

    for (const id of IDS) {
      expect(button(row, VISIT_CORNER_LABELS[id]).getAttribute('data-dev-visit')).toBe(id);
    }
    // Exactly one button per corner: the row is the corner list, not a second one.
    expect(row.queryAll((element) => element.getAttribute('data-dev-visit') !== null)).toHaveLength(
      IDS.length,
    );
  });

  it('routes a press through the bridge call path, never around it', () => {
    const { bridge, visits } = createBridge();
    installDevHarness(bridge, parseDevQuery('?dev=1'));

    button(findRow(dom.body, 'Visit'), 'Wallow').click();

    expect(visits.calls).toEqual(['stego']);
  });

  it('carries the director reading into the snapshot, measured', () => {
    const { bridge, models, visits } = createBridge();
    models.stego.position.set(4.5, 0, 0);
    visits.snapshots = [stegoDwell()];
    installDevHarness(bridge, parseDevQuery('?dev=1&pause=1'));
    const api = ranchApi(dom);

    const state = api.getVisitState().find((entry) => entry.species === 'stego');
    expect(state?.state).toBe('dwell');
    expect(state?.arrivals).toBe(1);
    expect(state?.distanceToCorner).toBeCloseTo(0.5, 12);

    const snapshot = api.snapshot();
    const reported = snapshot.visits.find((entry) => entry.species === 'stego');
    expect(reported?.state).toBe('dwell');
    expect(reported?.distanceToCorner).toBeCloseTo(0.5, 12);
    expect(snapshot.paused).toBe(true);
  });

  it('drives a full visit from the panel press to the arrival', async () => {
    const { bridge, models } = createBridge();
    const rig = createVisitRig(models);
    bridge.callVisit = rig.callVisit;
    bridge.getVisitState = rig.getVisitState;
    const frame = installDevHarness(bridge, parseDevQuery('?dev=1&seed=42&pause=1'));
    const api = ranchApi(dom);

    // One loop frame first: the director only lets a tap through once it has
    // seen the trio walking, exactly the precondition a real tap has.
    const seek = api.stepUntilVisit('stego', 'dwell', { extraFrames: 30 });
    button(findRow(dom.body, 'Visit'), 'Wallow').click();

    const result = await drain(seek, () => {
      rig.advance(frame, 1 / 60);
    });

    expect(result.reached).toBe(true);
    expect(result.frames).toBeGreaterThan(30);
    expect(rig.arrivals('stego')).toBe(1);
    expect(rig.walkers.stego.clips).toBe(1);
    expect(api.getVisitState().find((entry) => entry.species === 'stego')?.state).toBe('dwell');
    expect(api.snapshot().visits.find((entry) => entry.species === 'stego')?.state).toBe('dwell');
  });

  it('answers reached false instead of hanging when nothing is coming', async () => {
    const { bridge } = createBridge();
    const frame = installDevHarness(bridge, parseDevQuery('?dev=1&pause=1'));
    const api = ranchApi(dom);
    const seek = api.stepUntilVisit('brachio', 'dwell', { maxFrames: 10 });
    const tick = (): void => {
      frame(1 / 60, 0);
    };

    const result = await drain(seek, tick);
    const states = api.snapshot().visits.map((entry) => entry.state);

    expect(result).toEqual({ frames: 10, reached: false });
    // An unregistered animal is unknown, never a confident idle.
    expect(states).toEqual(['unknown', 'unknown', 'unknown']);
  });
});
