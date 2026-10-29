import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseDevQuery } from '../../src/dev/dev-options.js';
import { DustPool } from '../../src/ranch/dust.js';
import { BRACHIO_GAIT, STEGO_GAIT, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import { AVOIDANCE_TRIGGER_METRES } from '../../src/ranch/avoidance.js';
import {
  DEV_PANEL_ATTRIBUTE,
  installDevHarness,
  type DevBridge,
  type DevDinoHandle,
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

interface FakeBridge {
  bridge: DevBridge;
  models: Record<DevSpeciesId, THREE.Group>;
  audio: FakeAudio;
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
  };
  return { bridge, models, audio };
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
