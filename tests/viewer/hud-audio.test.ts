import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SLEEPY_OVERLAY_ID } from '../../src/viewer/sleepy-ui.js';
import { createHud, type Hud } from '../../src/viewer/hud.js';

/**
 * HUD feedback wiring (FR-1, FR-2, FR-4, FR-5, FR-9, AC-1, AC-3, AC-9).
 *
 * The audio facade is stubbed, not Howler: `playFeedback` is the seam the HUD
 * uses, and the facade owns the queued-first-press logic behind it. The DOM is a
 * small hand-rolled fake rather than jsdom, which this project does not
 * configure; every click below runs the real listener that `createHud`
 * registered on the element the fake document returned.
 */

const { playSfx } = vi.hoisted(() => ({ playSfx: vi.fn() }));

vi.mock('../../src/viewer/audio.js', () => ({
  playFeedback: playSfx,
}));

/** Manual clock the coo gate reads through `performance.now`. */
let nowMs = 0;

const ROOT_URL = new URL('../../', import.meta.url);

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, ROOT_URL), 'utf8');
}

beforeEach(() => {
  nowMs = 1000;
  playSfx.mockReset();
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  playSfx.mockReset();
});

type Listener = () => void;

class FakeClassList {
  private readonly names = new Set<string>();

  add(...names: string[]): void {
    for (const name of names) {
      this.names.add(name);
    }
  }

  remove(...names: string[]): void {
    for (const name of names) {
      this.names.delete(name);
    }
  }

  contains(name: string): boolean {
    return this.names.has(name);
  }
}

class FakeElement {
  readonly listeners = new Map<string, Listener[]>();
  readonly attributes = new Map<string, string>();
  readonly classList = new FakeClassList();
  readonly dataset: Record<string, string>;
  textContent = '';
  hidden = false;

  constructor(dataset: Record<string, string> = {}) {
    this.dataset = { ...dataset };
  }

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  click(): void {
    this.dispatch('click');
  }
}

class FakeWindow {
  readonly listeners = new Map<string, Listener[]>();
  innerWidth = 1280;
  innerHeight = 800;

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  matchMedia(): { matches: boolean } {
    return { matches: false };
  }

  setInterval(): number {
    return 0;
  }
}

interface Harness {
  walk: FakeElement;
  pov: Record<'ranch' | 'nest' | 'garden', FakeElement>;
  species: Record<'trike' | 'stego' | 'brachio', FakeElement>;
  gear: FakeElement;
  close: FakeElement;
  slider: FakeElement;
  hud: Hud;
  /** Move the shared manual clock forward, e.g. past a coo's own window. */
  advance(ms: number): void;
}

function createHarness(): Harness {
  const walk = new FakeElement();
  const pov = {
    ranch: new FakeElement({ pov: 'ranch' }),
    nest: new FakeElement({ pov: 'nest' }),
    garden: new FakeElement({ pov: 'garden' }),
  };
  const species = {
    trike: new FakeElement({ species: 'trike' }),
    stego: new FakeElement({ species: 'stego' }),
    brachio: new FakeElement({ species: 'brachio' }),
  };
  // The gear, Close and slider live in audio-controls.ts. They exist here only
  // so the clicks can prove the HUD wires no sound to them (FR-8).
  const gear = new FakeElement();
  const close = new FakeElement();
  const slider = new FakeElement();
  const overlay = new FakeElement();
  const rotateHint = new FakeElement();
  const body = new FakeElement();

  const fakeDocument = {
    body,
    getElementById: (id: string): FakeElement | null => {
      if (id === SLEEPY_OVERLAY_ID) {
        return overlay;
      }
      if (id === 'rotate-hint') {
        return rotateHint;
      }
      return null;
    },
    querySelector: (): FakeElement | null => null,
    querySelectorAll: (selector: string): FakeElement[] => {
      if (selector === '#pov [data-pov]') {
        return Object.values(pov);
      }
      if (selector === '#species button[data-species]') {
        return Object.values(species);
      }
      return [];
    },
    addEventListener: (): void => {},
  };
  const fakeWindow = new FakeWindow();

  vi.stubGlobal('document', fakeDocument);
  vi.stubGlobal('window', fakeWindow);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  const hud = createHud({
    camera,
    // The fake satisfies exactly the DOM members createHud touches; the
    // HudOptions signature takes the real element type.
    button: walk as unknown as HTMLButtonElement,
    status: null,
    audio: null,
    initialWalking: false,
    onWalkChange: (): void => {},
  });

  return {
    walk,
    pov,
    species,
    gear,
    close,
    slider,
    hud,
    advance: (ms: number): void => {
      nowMs += ms;
    },
  };
}

function dispatchedIds(): string[] {
  return playSfx.mock.calls.map((call) => call[0]);
}

describe('Walk toggle (AC-1, FR-1)', () => {
  it('plays exactly one tap on the press that starts walking', () => {
    const harness = createHarness();

    harness.walk.click();

    expect(playSfx.mock.calls).toEqual([['tap']]);
    expect(harness.hud.isWalking()).toBe(true);
  });

  it('plays again on the press that stops walking', () => {
    const harness = createHarness();

    harness.walk.click();
    harness.walk.click();

    expect(playSfx.mock.calls).toEqual([['tap'], ['tap']]);
    expect(harness.hud.isWalking()).toBe(false);
  });
});

describe('POV pills (AC-1, FR-2)', () => {
  it('plays a tap on each pill and again on the active pill', () => {
    const harness = createHarness();

    harness.pov.ranch.click();
    harness.pov.nest.click();
    harness.pov.garden.click();
    harness.pov.nest.click();

    expect(dispatchedIds()).toEqual(['tap', 'tap', 'tap', 'tap']);
    expect(harness.hud.pov()).toBe('nest');
  });
});

describe('species buttons (AC-3, FR-4)', () => {
  it('plays each baby its own coo asset', () => {
    const harness = createHarness();

    harness.species.trike.click();
    harness.advance(2000);
    harness.species.stego.click();
    harness.advance(2000);
    harness.species.brachio.click();

    expect(dispatchedIds()).toEqual(['coo-trike', 'coo-stego', 'coo-brachio']);
  });
});

describe('coo gating (AC-4, FR-5)', () => {
  it('swallows rapid repeats of the same species', () => {
    const harness = createHarness();

    harness.species.trike.click();
    harness.species.trike.click();
    harness.species.trike.click();

    expect(dispatchedIds()).toEqual(['coo-trike']);
  });

  it('lets only the first of two species tapped in the same tick sound', () => {
    const harness = createHarness();

    harness.species.trike.click();
    harness.species.stego.click();

    expect(dispatchedIds()).toEqual(['coo-trike']);
  });
});

describe('species target and label contract (AC-9, P2.T4)', () => {
  it('gives every species button its visible label as the accessible name', async () => {
    const html = await readText('index.html');
    const list = html.match(/<ul id="species"[\s\S]*?<\/ul>/)?.[0] ?? '';
    expect(list).not.toBe('');

    const buttons = list.match(/<button\b[^>]*data-species="[^"]+"[^>]*>[^<]*<\/button>/g) ?? [];
    expect(buttons).toHaveLength(3);
    // The text is the name; a second aria-label would duplicate it.
    expect(buttons.join('\n')).not.toContain('aria-label');

    for (const [id, label] of [
      ['trike', 'Trike'],
      ['stego', 'Stego'],
      ['brachio', 'Brachio'],
    ] as const) {
      expect(list).toMatch(
        new RegExp(`<button[^>]*data-species="${id}"[^>]*>[^<]*${label}[^<]*</button>`),
      );
    }
  });

  it('declares a 72 px species target and a creature glyph for Brachio', async () => {
    const html = await readText('index.html');
    const block = html.match(/#species button \{[\s\S]*?\}/)?.[0] ?? '';
    expect(block).toContain('min-inline-size: 72px');
    expect(block).toContain('min-height: 72px');
    expect(block).toContain('pointer-events: auto');

    const list = html.match(/<ul id="species"[\s\S]*?<\/ul>/)?.[0] ?? '';
    expect(list).toContain('🦒 Brachio');
    expect(list).not.toContain('🦴');
  });
});

describe('silent surfaces (FR-8)', () => {
  it('dispatches nothing for gear, Close or the volume slider', () => {
    const harness = createHarness();

    harness.gear.click();
    harness.close.click();
    harness.slider.click();

    expect(playSfx).not.toHaveBeenCalled();
  });
});

describe('failure path (FR-9)', () => {
  it('completes the Walk toggle when the engine throws', () => {
    const harness = createHarness();
    playSfx.mockImplementationOnce((): void => {
      throw new Error('engine down');
    });

    expect(() => {
      harness.walk.click();
    }).not.toThrow();

    expect(harness.hud.isWalking()).toBe(true);
  });
});
