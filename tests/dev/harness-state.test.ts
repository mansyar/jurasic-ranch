import { describe, expect, it } from 'vitest';
import {
  applySolo,
  DEV_STEP_DT_SECONDS,
  formatHud,
  nextPausedFrame,
  overlayTransforms,
  type OverlayDino,
} from '../../src/dev/harness-state.js';
import { buildSnapshot, type SnapshotDino } from '../../src/dev/snapshot.js';
import type { DevSpeciesId } from '../../src/dev/dev-options.js';

const IDS: readonly DevSpeciesId[] = ['trike', 'stego', 'brachio'];

describe('applySolo (FR-2, AC-3)', () => {
  it('shows all three with no preset', () => {
    expect(applySolo(null, IDS)).toEqual({ trike: true, stego: true, brachio: true });
  });

  it('leaves exactly one visible per preset', () => {
    for (const id of IDS) {
      const visible = applySolo(id, IDS);
      expect(visible[id]).toBe(true);
      expect(Object.values(visible).filter(Boolean)).toHaveLength(1);
    }
  });

  it('stays total when a caller lists a subset', () => {
    const visible = applySolo('stego', ['stego']);
    expect(visible).toEqual({ trike: true, stego: true, brachio: true });
  });

  it('does not mutate its input list', () => {
    const ids = [...IDS];
    applySolo('trike', ids);
    expect(ids).toEqual(['trike', 'stego', 'brachio']);
  });
});

describe('nextPausedFrame (FR-3, AC-4)', () => {
  it('always advances while running', () => {
    expect(nextPausedFrame(false, 0)).toEqual({ paused: false, stepFrames: 0, advance: true });
    expect(nextPausedFrame(false, 5).stepFrames).toBe(0);
  });

  it('holds still while paused with nothing queued', () => {
    expect(nextPausedFrame(true, 0)).toEqual({ paused: true, stepFrames: 0, advance: false });
  });

  it('advances exactly n frames for step(n), then pauses again', () => {
    let paused = true;
    let stepFrames = 10;
    let advanced = 0;
    for (let i = 0; i < 15; i += 1) {
      const decision = nextPausedFrame(paused, stepFrames);
      paused = decision.paused;
      stepFrames = decision.stepFrames;
      if (decision.advance) {
        advanced += 1;
      }
    }
    expect(advanced).toBe(10);
    expect(paused).toBe(true);
    expect(stepFrames).toBe(0);
  });

  it('ignores junk frame counts instead of hanging', () => {
    expect(nextPausedFrame(true, Number.NaN).advance).toBe(false);
    expect(nextPausedFrame(true, -3).advance).toBe(false);
    expect(nextPausedFrame(true, 2.7).stepFrames).toBe(1);
  });

  it('steps with a fixed 1/60 s delta so captures are wall-clock independent', () => {
    expect(DEV_STEP_DT_SECONDS).toBeCloseTo(1 / 60, 12);
  });
});

describe('formatHud (FR-4, AC-5)', () => {
  it('reports fps, frame time, draw calls and triangles', () => {
    const hud = formatHud(60, 12, 3456);
    expect(hud).toBe('60 fps · 16.7 ms · 12 calls · 3456 tris');
  });

  it('rounds noisy values', () => {
    expect(formatHud(59.6, 11.6, 3455.4)).toBe('60 fps · 16.8 ms · 12 calls · 3455 tris');
  });

  it('degrades to a dash instead of Infinity fps', () => {
    expect(formatHud(0, 0, 0)).toBe('0 fps · — ms · 0 calls · 0 tris');
    expect(formatHud(Number.NaN, Number.NaN, Number.NaN)).toBe('0 fps · — ms · 0 calls · 0 tris');
  });
});

describe('overlayTransforms (FR-6, AC-7)', () => {
  const dinos: OverlayDino[] = [
    { id: 'trike', visible: true, x: 0.1, z: -0.2, heading: 0.5 },
    { id: 'stego', visible: false, x: 1, z: 1, heading: 1 },
    { id: 'brachio', visible: true, x: -0.3, z: 0.4, heading: -2 },
  ];

  it('projects ring centre and arrow yaw for the visible dinos', () => {
    expect(overlayTransforms(dinos)).toEqual([
      { id: 'trike', ringX: 0.1, ringZ: -0.2, arrowYaw: 0.5 },
      { id: 'brachio', ringX: -0.3, ringZ: 0.4, arrowYaw: -2 },
    ]);
  });

  it('follows a dino that wandered', () => {
    const moved = dinos.map((dino) =>
      dino.id === 'trike' ? { ...dino, x: 0.65, z: 0.12, heading: 1.25 } : dino,
    );
    const trike = overlayTransforms(moved).find((transform) => transform.id === 'trike');
    expect(trike).toEqual({ id: 'trike', ringX: 0.65, ringZ: 0.12, arrowYaw: 1.25 });
  });

  it('renders no overlays for hidden dinos', () => {
    const hidden = dinos.map((dino) => ({ ...dino, visible: false }));
    expect(overlayTransforms(hidden)).toEqual([]);
  });

  it('does not mutate its input', () => {
    const copy = dinos.map((dino) => ({ ...dino }));
    overlayTransforms(dinos);
    expect(dinos).toEqual(copy);
  });
});

describe('snapshot reuse (FR-7)', () => {
  it('reports the visibility a solo preset produced', () => {
    const visibility = applySolo('brachio', IDS);
    const dinos: SnapshotDino[] = IDS.map((id) => ({
      id,
      label: id,
      visible: visibility[id],
      rigged: true,
      x: 0,
      z: 0,
      heading: 0,
      walking: false,
    }));
    const snapshot = buildSnapshot({
      walking: false,
      paused: true,
      pov: 'ranch',
      sleepy: 'awake',
      fps: 60,
      drawCalls: 0,
      triangles: 0,
      dinos,
      visits: [],
      audio: {
        unlocked: false,
        muted: false,
        volume: 0.8,
        musicPlaying: false,
        activeLine: null,
        lastStartLatencyMs: 0,
      },
    });
    expect(snapshot.dinos.map((dino) => dino.visible)).toEqual([false, false, true]);
    expect(snapshot.pairs).toHaveLength(3);
    expect(snapshot.minSeparation).toBe(0);
  });
});
