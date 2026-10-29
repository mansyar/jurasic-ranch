import { describe, expect, it, vi } from 'vitest';
import { DRESSING_FOOTPRINT_METRES, DRESSING_MANIFEST } from '../../src/ranch/dressing.js';
import {
  arc,
  cluster,
  DRESSING_BAND_RANGES,
  DRESSING_CATALOGUE,
  GROUND_RADIUS_METRES,
  ring,
  row,
  scatter,
  WALK_CLEARANCE_METRES,
} from '../../src/ranch/layout.js';

/** The shape of a recorded placement, independent of the layout module. */
interface SnapshotPlacement {
  file: string;
  position: readonly [number, number, number];
  rotationY: number;
}

/**
 * The twelve shipped props exactly as they were hand-written before the
 * phase-1 refactor (AC-5). This table is the phase's contract: it is typed out
 * here, not computed, so the helpers cannot agree with themselves and pass.
 */
const SHIPPED_PLACEMENTS: readonly SnapshotPlacement[] = [
  {
    file: 'ginkgo-tree-baa895.glb',
    position: [8.476296891445699, 0, 4.506927002744551],
    rotationY: 3.630284844148205,
  },
  {
    file: 'dawn-redwood-001c29.glb',
    position: [-9.208987683701903, 0, -3.351797404591553],
    rotationY: 6.632251157578452,
  },
  {
    file: 'flowering-magnolia-dd76cb.glb',
    position: [-3.7900919463459535, 0, 8.92889707848867],
    rotationY: 5.113814708343385,
  },
  {
    file: 'fern-covered-boulder-2e0375.glb',
    position: [-9, 0, 1.102182119232618e-15],
    rotationY: 6.283185307179586,
  },
  {
    file: 'moss-covered-stump-7253ab.glb',
    position: [3.214989347261287, 0, 8.833110635387538],
    rotationY: 4.363323129985824,
  },
  {
    file: 'farm-gate-8ab320.glb',
    position: [-1.5975632345357589, 0, -9.060231327712312],
    rotationY: -6.1086523819801535,
  },
  {
    file: 'wooden-fence-section-d72055.glb',
    position: [0.32107536966301176, 0, -9.19439560857568],
    rotationY: -6.318091892219473,
  },
  {
    file: 'wooden-fence-section-d72055.glb',
    position: [2.2256814395169404, 0, -8.926720681739168],
    rotationY: -6.527531402458792,
  },
  {
    file: 'wooden-fence-section-d72055.glb',
    position: [4.033014550459511, 0, -8.268905225952336],
    rotationY: -6.736970912698112,
  },
  {
    file: 'water-trough-df3ced.glb',
    position: [8.066499534731049, 0, -3.259077362718437],
    rotationY: 9.040805525330626,
  },
  {
    file: 'hand-water-pump-448037.glb',
    position: [8.961750552411091, 0, -1.5801984167690746],
    rotationY: 9.250245035569947,
  },
  {
    file: 'stone-well-b2dfcd.glb',
    position: [8.994517443171862, 0, 0.31409547032250873],
    rotationY: 3.1764992386296798,
  },
  {
    file: 'corn-crop-b71f2f.glb',
    position: [-3.4, 0, -8.55],
    rotationY: 2.6,
  },
  {
    file: 'corn-crop-b71f2f.glb',
    position: [-3.1, 0, -8.55],
    rotationY: 1.9,
  },
  {
    file: 'corn-crop-b71f2f.glb',
    position: [-2.8, 0, -8.55],
    rotationY: 2.4,
  },
  {
    file: 'corn-crop-b71f2f.glb',
    position: [-3.4, 0, -9.05],
    rotationY: 3.6,
  },
  {
    file: 'corn-crop-b71f2f.glb',
    position: [-3.1, 0, -9.05],
    rotationY: 2.9,
  },
  {
    file: 'corn-crop-b71f2f.glb',
    position: [-2.8, 0, -9.05],
    rotationY: 3.4,
  },
  {
    file: 'river-stone-cluster-0b55bc.glb',
    position: [-8.075, 0, 3.095],
    rotationY: 0.4,
  },
  {
    file: 'river-stone-cluster-0b55bc.glb',
    position: [-8.935, 0, 3.095],
    rotationY: 2,
  },
  {
    file: 'river-stone-cluster-0b55bc.glb',
    position: [-8.505, 0, 3.525],
    rotationY: 3.5,
  },
  {
    file: 'river-stone-cluster-0b55bc.glb',
    position: [-8.505, 0, 2.665],
    rotationY: 5.1,
  },
];

function groundDistanceMetres(position: readonly [number, number, number]): number {
  return Math.hypot(position[0], position[2]);
}

describe('dressing placement snapshot (FR-2, AC-5)', () => {
  it('keeps every shipped prop exactly where it stood before the refactor', () => {
    // AC-5 is the phase's whole risk: the layout may be re-expressed, but the
    // rendered frame may not move. 1e-9 m is far below a pixel at any preset.
    expect(DRESSING_MANIFEST).toHaveLength(SHIPPED_PLACEMENTS.length);
    DRESSING_MANIFEST.forEach((item, index) => {
      const expected = SHIPPED_PLACEMENTS[index];
      expect(item.file).toBe(expected.file);
      for (const axis of [0, 1, 2] as const) {
        expect(item.position[axis]).toBeCloseTo(expected.position[axis], 9);
      }
      expect(item.rotationY).toBeCloseTo(expected.rotationY, 9);
    });
  });
});

describe('placement helpers (FR-1)', () => {
  it('rings a prop on the compass azimuth, facing as asked', () => {
    const inward = ring('probe.glb', 0, 10, 'inward');
    expect(inward.position[0]).toBeCloseTo(10, 12);
    expect(inward.position[1]).toBe(0);
    expect(inward.position[2]).toBeCloseTo(0, 12);
    expect(inward.rotationY).toBeCloseTo(Math.PI, 12);

    const outward = ring('probe.glb', 90, 10, 'outward');
    expect(outward.position[0]).toBeCloseTo(0, 12);
    expect(outward.position[2]).toBeCloseTo(10, 12);
    expect(outward.rotationY).toBeCloseTo(Math.PI / 2, 12);

    const tangent = ring('probe.glb', 90, 10, 'tangent');
    expect(tangent.rotationY).toBeCloseTo(-Math.PI, 12);
  });

  it('spaces an arc evenly with both ends included', () => {
    const placements = arc('fence.glb', 0, 90, 3, 5);
    expect(placements).toHaveLength(3);
    expect(placements[0]?.position[0]).toBeCloseTo(5, 12);
    expect(placements[1]?.position[0]).toBeCloseTo(5 * Math.cos(Math.PI / 4), 12);
    expect(placements[1]?.position[2]).toBeCloseTo(5 * Math.sin(Math.PI / 4), 12);
    expect(placements[2]?.position[2]).toBeCloseTo(5, 12);
    expect(placements[2]?.rotationY).toBeCloseTo(-Math.PI, 12);
  });

  it('steps a row along one axis and keeps the other fixed', () => {
    const placements = row('corn.glb', [1, 2], 3, 'z', 0.5, 0.25);
    expect(placements.map((placement) => placement.position)).toEqual([
      [1, 0, 2],
      [1, 0, 2.5],
      [1, 0, 3],
    ]);
    expect(placements.every((placement) => placement.rotationY === 0.25)).toBe(true);
    const spins = row('corn.glb', [1, 2], 2, 'x', 0.5, [0.1, 0.2]);
    expect(spins.map((placed) => placed.rotationY)).toEqual([0.1, 0.2]);
  });

  it('spaces a cluster around its own centre', () => {
    const placements = cluster('stone.glb', [1, -1], 0.5, [
      { azimuthDegrees: 0, rotationY: 0.1 },
      { azimuthDegrees: 180, rotationY: 0.2 },
    ]);
    expect(placements).toHaveLength(2);
    expect(placements[0]?.position[0]).toBeCloseTo(1.5, 12);
    expect(placements[0]?.position[2]).toBeCloseTo(-1, 12);
    expect(placements[1]?.position[0]).toBeCloseTo(0.5, 12);
    expect(placements[1]?.position[2]).toBeCloseTo(-1, 12);
    expect(placements.map((placed) => placed.rotationY)).toEqual([0.1, 0.2]);
  });
});

describe('seeded scatter (FR-1, NFR-8)', () => {
  const area = {
    centre: [2, -3] as const,
    fromDegrees: 150,
    toDegrees: 210,
    minRadiusMetres: 9,
    maxRadiusMetres: 10,
  };

  it('replays the same layout for the same seed and differs for another', () => {
    const first = scatter('reed.glb', 8, area, 42);
    expect(scatter('reed.glb', 8, area, 42)).toEqual(first);
    expect(scatter('reed.glb', 8, area, 43)).not.toEqual(first);
  });

  it('never reaches for Math.random', () => {
    // The dev harness owns the only source of entropy; the layout is a
    // function of its seed (constraint: `?seed=` must reproduce a capture).
    const random = vi.spyOn(Math, 'random');
    scatter('reed.glb', 8, area, 7);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it('keeps every prop inside the area it was given', () => {
    for (const placement of scatter('reed.glb', 24, area, 5)) {
      expect(placement.position[1]).toBe(0);
      const radius = Math.hypot(placement.position[0] - 2, placement.position[2] + 3);
      expect(radius).toBeGreaterThanOrEqual(area.minRadiusMetres);
      expect(radius).toBeLessThanOrEqual(area.maxRadiusMetres);
      const bearing =
        (Math.atan2(placement.position[2] + 3, placement.position[0] - 2) * 180) / Math.PI;
      const azimuth = (bearing + 360) % 360;
      expect(azimuth).toBeGreaterThanOrEqual(area.fromDegrees);
      expect(azimuth).toBeLessThanOrEqual(area.toDegrees);
      expect(Number.isFinite(placement.rotationY)).toBe(true);
    }
  });
});

describe('band radii (FR-6, NFR-5)', () => {
  it('derives ordered, non-overlapping bands out from the play disc', () => {
    expect(DRESSING_BAND_RANGES.mid.minMetres).toBeGreaterThanOrEqual(WALK_CLEARANCE_METRES);
    expect(DRESSING_BAND_RANGES.mid.maxMetres).toBeLessThan(
      DRESSING_BAND_RANGES.foreground.minMetres,
    );
    expect(DRESSING_BAND_RANGES.foreground.minMetres).toBeGreaterThan(GROUND_RADIUS_METRES - 1);
    expect(DRESSING_BAND_RANGES.foreground.maxMetres).toBeLessThan(
      DRESSING_BAND_RANGES.treeline.minMetres,
    );
    expect(DRESSING_BAND_RANGES.treeline.minMetres).toBeGreaterThan(GROUND_RADIUS_METRES);
    expect(DRESSING_BAND_RANGES.treeline.maxMetres).toBe(Number.POSITIVE_INFINITY);
  });

  it('gives every catalogue entry a band that holds the radii it stands at', () => {
    const manifestFiles = new Set(DRESSING_MANIFEST.map((item) => item.file));
    expect(new Set(Object.keys(DRESSING_CATALOGUE))).toEqual(manifestFiles);
    for (const [file, entry] of Object.entries(DRESSING_CATALOGUE)) {
      const range = DRESSING_BAND_RANGES[entry.band];
      const placed = DRESSING_MANIFEST.filter((item) => item.file === file);
      expect(placed.length).toBeGreaterThan(0);
      for (const item of placed) {
        const radius = groundDistanceMetres(item.position);
        expect(radius).toBeGreaterThanOrEqual(range.minMetres);
        expect(radius).toBeLessThanOrEqual(range.maxMetres);
      }
    }
  });

  it('records a catalogue footprint for every manifest prop', () => {
    for (const [file, entry] of Object.entries(DRESSING_CATALOGUE)) {
      expect(entry.footprintMetres).toBeGreaterThan(0);
      expect(entry.heightMetres).toBeGreaterThan(0);
      expect(DRESSING_FOOTPRINT_METRES[file]).toBe(entry.footprintMetres);
    }
  });
});
