import { describe, expect, it } from 'vitest';
import type {
  DevSnapshot,
  SnapshotAudio,
  SnapshotDino,
  SnapshotVisit,
  VisitBody,
} from '../../src/dev/snapshot.js';
import { buildSnapshot, visitStates } from '../../src/dev/snapshot.js';
import type { VisitSnapshot } from '../../src/ranch/visit.js';
import { POV_ORDER } from '../../src/viewer/pov.js';

/** Snapshot projection (FR-7, AC-8): documented fields plus pairwise distances. */

function dino(id: SnapshotDino['id'], x: number, z: number): SnapshotDino {
  return {
    id,
    label: id,
    visible: true,
    rigged: true,
    x,
    z,
    heading: 0,
    walking: true,
  };
}

function audioState(overrides: Partial<SnapshotAudio> = {}): SnapshotAudio {
  return {
    unlocked: false,
    muted: false,
    volume: 0.8,
    musicPlaying: false,
    activeLine: null,
    lastStartLatencyMs: 0,
    ...overrides,
  };
}

function inputFor(dinos: SnapshotDino[], audio: SnapshotAudio = audioState()) {
  return {
    walking: true,
    paused: false,
    pov: 'ranch' as const,
    sleepy: 'awake' as const,
    fps: 60,
    drawCalls: 61,
    triangles: 37_600,
    dinos,
    visits: [] as SnapshotVisit[],
    audio,
  };
}

describe('buildSnapshot (FR-7, AC-8)', () => {
  it('carries the scene fields through', () => {
    const snapshot: DevSnapshot = buildSnapshot(inputFor([dino('trike', 0, 0)]));
    expect(snapshot.walking).toBe(true);
    expect(snapshot.paused).toBe(false);
    expect(snapshot.pov).toBe('ranch');
    expect(snapshot.sleepy).toBe('awake');
    expect(snapshot.fps).toBe(60);
  });

  it('carries the frame the renderer actually drew, not a prop count (AC-8, F3)', () => {
    // The review's F3: `DRESSING_MANIFEST.length + 3` is an arithmetic proxy for
    // the dressing group, not the frame — it leaves out the sky, the ground, the
    // dinos, the dust and the sparkles. These two fields are read straight off
    // `renderer.info.render` by the harness, so a capture can quote a measurement.
    const snapshot = buildSnapshot(inputFor([dino('trike', 0, 0)]));
    expect(snapshot.drawCalls).toBe(61);
    expect(snapshot.triangles).toBe(37_600);
  });

  it('widens the reported viewpoint to every preset (P4.T5, FR-9)', () => {
    // The snapshot type is the documented shape, so it has to name the sky
    // view too: a harness that could set a fourth preset and a snapshot that
    // could only report three would disagree the moment someone pressed it.
    for (const id of POV_ORDER) {
      const snapshot = buildSnapshot({ ...inputFor([dino('trike', 0, 0)]), pov: id });
      expect(snapshot.pov).toBe(id);
    }
  });

  it('lists every unordered pair exactly once', () => {
    const snapshot = buildSnapshot(
      inputFor([dino('trike', 0, 0), dino('stego', 3, 4), dino('brachio', 1, 0)]),
    );
    expect(snapshot.pairs.map((pair) => `${pair.a}-${pair.b}`)).toEqual([
      'trike-stego',
      'trike-brachio',
      'stego-brachio',
    ]);
  });

  it('computes pairwise distances from the reported coordinates', () => {
    const snapshot = buildSnapshot(
      inputFor([dino('trike', 0, 0), dino('stego', 3, 4), dino('brachio', -1.5, 2)]),
    );
    for (const pair of snapshot.pairs) {
      const a = snapshot.dinos.find((entry) => entry.id === pair.a);
      const b = snapshot.dinos.find((entry) => entry.id === pair.b);
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      const expected = Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
      expect(pair.distance).toBeCloseTo(expected, 12);
    }
    expect(snapshot.pairs[0]?.distance).toBeCloseTo(5, 12);
  });

  it('reports the smallest pair distance as minSeparation', () => {
    const snapshot = buildSnapshot(
      inputFor([dino('trike', 0, 0), dino('stego', 3, 4), dino('brachio', 0, 0.5)]),
    );
    const smallest = Math.min(...snapshot.pairs.map((pair) => pair.distance));
    expect(snapshot.minSeparation).toBeCloseTo(0.5, 12);
    expect(snapshot.minSeparation).toBe(smallest);
  });

  it('returns no pairs and null separation for a single dino', () => {
    const snapshot = buildSnapshot(inputFor([dino('trike', 2, -1)]));
    expect(snapshot.pairs).toEqual([]);
    expect(snapshot.minSeparation).toBeNull();
  });

  it('does not mutate the input', () => {
    const dinos = [dino('trike', 0, 0), dino('stego', 1, 1)];
    const input = inputFor(dinos);
    const before = structuredClone(input);
    buildSnapshot(input);
    expect(input).toEqual(before);
  });
});

describe('audio block (FR-10)', () => {
  it('copies the audio state exactly and does not share the object', () => {
    const audio = audioState({
      unlocked: true,
      muted: true,
      volume: 0.35,
      musicPlaying: false,
      activeLine: 'hello',
      lastStartLatencyMs: 12.5,
    });
    const snapshot = buildSnapshot(inputFor([dino('trike', 0, 0)], audio));

    expect(snapshot.audio).toEqual(audio);
    expect(snapshot.audio).not.toBe(audio);
  });

  it('keeps volume and latency finite', () => {
    const snapshot = buildSnapshot(
      inputFor([dino('trike', 0, 0)], audioState({ volume: 0, lastStartLatencyMs: 3.2 })),
    );

    expect(Number.isFinite(snapshot.audio.volume)).toBe(true);
    expect(Number.isFinite(snapshot.audio.lastStartLatencyMs)).toBe(true);
    expect(snapshot.audio.volume).toBe(0);
    expect(snapshot.audio.lastStartLatencyMs).toBeCloseTo(3.2, 12);
  });

  it('still computes pairs with the audio block present', () => {
    const snapshot = buildSnapshot(
      inputFor([dino('trike', 0, 0), dino('stego', 3, 4)], audioState({ unlocked: true })),
    );

    expect(snapshot.pairs).toHaveLength(1);
    expect(snapshot.pairs[0]?.distance).toBeCloseTo(5, 12);
    expect(snapshot.audio.unlocked).toBe(true);
  });
});

function visitSnapshot(
  species: SnapshotVisit['species'],
  overrides: Partial<VisitSnapshot> = {},
): VisitSnapshot {
  return {
    species,
    state: 'idle',
    secondsInState: 0,
    secondsUntilVisit: 30,
    approachSeconds: 0,
    visitsStarted: 0,
    arrivals: 0,
    corner: {
      species,
      anchor: [4, 0],
      facingRadians: 0,
      placeRadiusMetres: 1.2,
      arrivalRadiusMetres: 0.9,
      stopRadiusMetres: 0.7,
      dwellSeconds: 4,
    },
    ...overrides,
  };
}

describe('visit block (FR-14, AC-14)', () => {
  it('reports one record per animal the harness can see, in its own order', () => {
    const bodies: VisitBody[] = [
      { id: 'trike', x: 0, z: 0 },
      { id: 'stego', x: 1, z: 0 },
      { id: 'brachio', x: 2, z: 0 },
    ];
    const states = visitStates([visitSnapshot('trike'), visitSnapshot('stego')], bodies);

    expect(states.map((state) => state.species)).toEqual(['trike', 'stego', 'brachio']);
    expect(states[0]?.state).toBe('idle');
    expect(states[1]?.state).toBe('idle');
  });

  it('says unknown rather than idle when the director has no record', () => {
    const states = visitStates([], [{ id: 'brachio', x: 2, z: 0 }]);

    expect(states[0]).toEqual({
      species: 'brachio',
      state: 'unknown',
      secondsInState: null,
      secondsUntilVisit: null,
      visitsStarted: null,
      arrivals: null,
      corner: null,
      arrivalRadiusMetres: null,
      distanceToCorner: null,
    });
  });

  it('reports the director state, its dwell clock and its counters verbatim', () => {
    const snapshots = [
      visitSnapshot('stego', {
        state: 'dwell',
        secondsInState: 2.5,
        secondsUntilVisit: 0,
        approachSeconds: 11.25,
        visitsStarted: 1,
        arrivals: 1,
      }),
    ];
    const states = visitStates(snapshots, [{ id: 'stego', x: 4, z: 0 }]);

    expect(states[0]?.state).toBe('dwell');
    expect(states[0]?.secondsInState).toBe(2.5);
    expect(states[0]?.visitsStarted).toBe(1);
    expect(states[0]?.arrivals).toBe(1);
  });

  it('measures the distance to the corner from the position it reports', () => {
    const states = visitStates([visitSnapshot('trike')], [{ id: 'trike', x: 4.6, z: 0 }]);
    const distance = states[0]?.distanceToCorner ?? Infinity;
    const radius = states[0]?.arrivalRadiusMetres ?? 0;

    expect(states[0]?.corner).toEqual({ x: 4, z: 0 });
    expect(distance).toBeCloseTo(0.6, 12);
    // The documented "is it at the corner" check: position, not a boolean.
    expect(distance).toBeLessThanOrEqual(radius);
  });

  it('is not fooled by a state that says arrived while the animal is home', () => {
    const bodies: VisitBody[] = [{ id: 'trike', x: 0, z: 0 }];
    const states = visitStates([visitSnapshot('trike', { state: 'dwell' })], bodies);
    const distance = states[0]?.distanceToCorner ?? 0;
    const radius = states[0]?.arrivalRadiusMetres ?? 0;

    expect(states[0]?.state).toBe('dwell');
    expect(distance).toBeGreaterThan(radius);
  });

  it('carries the block into the snapshot and does not share it', () => {
    const visits = visitStates([visitSnapshot('stego')], [{ id: 'stego', x: 0, z: 0 }]);
    const snapshot = buildSnapshot({ ...inputFor([dino('stego', 0, 0)]), visits });

    expect(snapshot.visits).toEqual(visits);
    expect(snapshot.visits).not.toBe(visits);
    expect(snapshot.visits[0]).not.toBe(visits[0]);
    expect(snapshot.visits[0]?.corner).not.toBe(visits[0]?.corner);
  });

  it('does not mutate the visit records it is given', () => {
    const visits = visitStates([visitSnapshot('trike')], [{ id: 'trike', x: 0, z: 0 }]);
    const before = structuredClone(visits);

    buildSnapshot({ ...inputFor([dino('trike', 0, 0)]), visits });

    expect(visits).toEqual(before);
  });
});
