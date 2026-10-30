import { describe, expect, it, vi } from 'vitest';
import { DRESSING_FOOTPRINT_METRES, DRESSING_MANIFEST } from '../../src/ranch/dressing.js';
import {
  arc,
  cluster,
  CORNER_AZIMUTH_DEGREES,
  CORNER_FRAME_HALF_ANGLE_DEGREES,
  cornerPlacements,
  DRESSING_BAND_RANGES,
  DRESSING_CATALOGUE,
  DRESSING_CORNERS,
  DRESSING_SCATTER,
  FOREGROUND_PLACEMENTS,
  FOREGROUND_SPRIG_MAX_HEIGHT_METRES,
  GROUND_RADIUS_METRES,
  LANDMARK_PLACEMENTS,
  LENS_AXIS_CLEARANCE_DEGREES,
  LENS_CONE_HALF_ANGLE_DEGREES,
  MID_PROP_MAX_HEIGHT_METRES,
  ring,
  row,
  scatter,
  SILHOUETTE_RHYMES,
  TREELINE_MIN_HEIGHT_METRES,
  TREELINE_PLACEMENTS,
  WALK_CLEARANCE_METRES,
  WALLOW_CENTRE_METRES,
  WALLOW_EDGE_PLACEMENTS,
  WALLOW_MUD_RADIUS_METRES,
  WATER_LINE_FLUSH_METRES,
  WATER_LINE_FROM_DEGREES,
  WATER_LINE_RADIUS_METRES,
  WATER_LINE_STONES,
  WATER_LINE_SWEEP_DEGREES,
  WATER_LINE_WIDTH_METRES,
  WIND_PUMP_FILE,
} from '../../src/ranch/layout.js';
import type { CornerSpecies, SilhouetteRhyme } from '../../src/ranch/layout.js';
import { MEADOW_RADIUS_METRES } from '../../src/ranch/ground.js';
import {
  GROUND_POV_ORDER,
  POV_FOCUS_SPECIES,
  POV_ORDER,
  POV_PRESETS,
} from '../../src/viewer/pov.js';
import { readGlbFacts } from './dressing-files.js';

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
    position: [-0.3420150676845, 0, 9.7940301047871],
    rotationY: 4.747295565424576,
  },
  {
    file: 'dawn-redwood-001c29.glb',
    position: [-9.208987683701903, 0, -3.351797404591553],
    rotationY: 6.632251157578452,
  },
  {
    file: 'flowering-magnolia-dd76cb.glb',
    // Phase 5 moved this prop: the honest 5.09 m canopy covered the Trike's
    // rectangle from 113 deg, so it stands at 100 deg instead (the radius is
    // untouched). The one deliberate break of this snapshot, recorded in the
    // catalogue comment and in the phase evidence.
    position: [-1.684387323369, 0, 9.552635204218],
    rotationY: 4.886921905584122,
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
    // Phase 3 appends its props after this block, so the shipped prefix — and
    // only the prefix — is what the snapshot pins.
    const shipped = DRESSING_MANIFEST.slice(0, SHIPPED_PLACEMENTS.length);
    expect(shipped).toHaveLength(SHIPPED_PLACEMENTS.length);
    shipped.forEach((item, index) => {
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

/* -------------------------------------------------------------------------- *
 * Phase 3: the composition (FR-5, FR-6, FR-13 to FR-16, FR-18)
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

const SHIPPED_FILES: ReadonlySet<string> = new Set(SHIPPED_PLACEMENTS.map((item) => item.file));
const UNIQUE_FILES: readonly string[] = [...new Set(DRESSING_MANIFEST.map((item) => item.file))];
const NEW_FILES: readonly string[] = UNIQUE_FILES.filter((file) => !SHIPPED_FILES.has(file));

/**
 * The sanctioned height exceptions to FR-6's mid cap for new props, each with
 * the requirement that asks for it. Pinning them here is what keeps the cap a
 * rule rather than a suggestion: a fourth entry has to be written down.
 */
const MID_HEIGHT_EXCEPTIONS: Readonly<Record<string, string>> = {
  'plum-tree-565179.glb': 'FR-13: the browse tree on Brachio’s corner',
  'river-reed-cluster-cba87e.glb': 'FR-15: reeds standing in the wallow edge',
  'signpost-0bf523.glb': 'FR-13: the farm marker that frames Brachio’s corner',
};

describe('vendored assets (FR-5)', () => {
  it('stages at least fourteen new GLBs around the twelve that shipped', () => {
    expect(SHIPPED_FILES.size).toBe(12);
    expect(NEW_FILES.length).toBeGreaterThanOrEqual(14);
    for (const file of NEW_FILES) {
      expect(DRESSING_CATALOGUE[file]).toBeDefined();
      expect(file.endsWith('.glb')).toBe(true);
    }
  });

  it('measures every footprint and height from the GLB bytes, not the vendor sheet', () => {
    // Phase 5 widened this from the fourteen new files to all thirty: the twelve
    // that shipped still carried Phase 1's optimistic vendor-sheet numbers (the
    // magnolia 3.6 m against a 5.09 m canopy), which is why the occlusion kit
    // could never see the one prop that crowded the Nest frame.
    for (const file of UNIQUE_FILES) {
      const entry = DRESSING_CATALOGUE[file];
      expect(entry).toBeDefined();
      if (entry === undefined) {
        continue;
      }
      const facts = readGlbFacts(new URL(`../../public/models/dressing/${file}`, import.meta.url));
      // The catalogue carries the widest ground extent and the measured top.
      expect(Math.max(facts.widthMetres, facts.depthMetres)).toBeCloseTo(entry.footprintMetres, 1);
      expect(facts.heightMetres).toBeCloseTo(entry.heightMetres, 1);
      expect(facts.drawCalls).toBeGreaterThan(0);
      expect(facts.triangles).toBeGreaterThan(0);
    }
  });
});

describe('band rules the new props answer to (FR-6, NFR-5)', () => {
  it('keeps every new mid prop under 1.4 m, bar the three pinned exceptions', () => {
    for (const file of NEW_FILES) {
      const entry = DRESSING_CATALOGUE[file];
      expect(entry).toBeDefined();
      if (entry === undefined || entry.band !== 'mid') {
        continue;
      }
      if (MID_HEIGHT_EXCEPTIONS[file] !== undefined) {
        expect(entry.heightMetres).toBeGreaterThan(MID_PROP_MAX_HEIGHT_METRES);
        continue;
      }
      expect(entry.heightMetres).toBeLessThanOrEqual(MID_PROP_MAX_HEIGHT_METRES);
    }
  });

  it('keeps every sprig under 0.5 m, in band, and 18 degrees off every lens axis', () => {
    expect(FOREGROUND_PLACEMENTS.length).toBeGreaterThan(0);
    const findings: string[] = [];
    for (const item of FOREGROUND_PLACEMENTS) {
      const entry = DRESSING_CATALOGUE[item.file];
      expect(entry?.band).toBe('foreground');
      expect(entry?.heightMetres ?? 0).toBeLessThanOrEqual(FOREGROUND_SPRIG_MAX_HEIGHT_METRES);
      const radius = Math.hypot(item.position[0], item.position[2]);
      expect(radius).toBeGreaterThanOrEqual(DRESSING_BAND_RANGES.foreground.minMetres);
      expect(radius).toBeLessThanOrEqual(DRESSING_BAND_RANGES.foreground.maxMetres);
      // FR-6's corridor is measured *at the lens*: the angle a sprig subtends from
      // the camera, not its polar bearing round the ranch origin. Comparing the
      // sprig's own bearing to the lens's bearing mixed two reference frames and
      // passed by luck — the club-moss at 285 deg is 5.5 deg off the Ranch axis
      // when seen from the Ranch lens, and the wildflower at 100 deg 6.9 deg off
      // the Garden axis, both inside the forbidden corridor. Read it the way the
      // treeline test does: bearing from the lens to the prop against the lens
      // to its subject.
      // Ground lenses only: the overhead preset has no lateral axis to keep a
      // sprig off, and it is framed instead by the sky kit in `pov.test.ts`.
      for (const id of GROUND_POV_ORDER) {
        const preset = POV_PRESETS[id];
        const lens = groundXZ(preset.position);
        const axis = bearingDegrees(lens, groundXZ(preset.lookAt));
        const bearing = bearingDegrees(lens, groundXZ(item.position));
        const apart = apartDegrees(bearing, axis);
        if (apart < LENS_AXIS_CLEARANCE_DEGREES) {
          findings.push(
            `${id}: ${item.file} at ${radius.toFixed(1)} m sits ${apart.toFixed(1)} deg off its axis`,
          );
        }
      }
    }
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('masses the treeline into thickets with gaps between them (rework 1)', () => {
    // A meadow edge reads as clumps with openings, not as a dotted line: each
    // mass crowds at least four props within 12 degrees of bearing, and the
    // masses are separated by wide open arcs.
    const bearings = TREELINE_PLACEMENTS.map(
      (item) => (Math.atan2(item.position[2], item.position[0]) * 180) / Math.PI,
    ).sort((a, b) => a - b);
    const masses: number[][] = [];
    for (const bearing of bearings) {
      const last = masses[masses.length - 1];
      if (last !== undefined && bearing - last[last.length - 1] <= 12) {
        last.push(bearing);
      } else {
        masses.push([bearing]);
      }
    }
    const full = masses.filter((mass) => mass.length >= 4);
    const shape = masses.map((mass) => mass.length).join('/');
    expect(full.length, `masses: ${shape}`).toBeGreaterThanOrEqual(3);
    // Every thicket prop stays inside the band's radii and near its own size.
    for (const item of TREELINE_PLACEMENTS) {
      const radius = Math.hypot(item.position[0], item.position[2]);
      expect(radius).toBeGreaterThanOrEqual(DRESSING_BAND_RANGES.treeline.minMetres);
      const scale = item.scale ?? 1;
      expect(scale).toBeGreaterThanOrEqual(0.9);
      expect(scale).toBeLessThanOrEqual(1.3);
    }
  });

  it('stands every treeline prop at least 3 m tall and beyond 17 m', () => {
    for (const item of TREELINE_PLACEMENTS) {
      const entry = DRESSING_CATALOGUE[item.file];
      expect(entry?.band).toBe('treeline');
      expect(entry?.heightMetres ?? 0).toBeGreaterThanOrEqual(TREELINE_MIN_HEIGHT_METRES);
      const radius = Math.hypot(item.position[0], item.position[2]);
      expect(radius).toBeGreaterThanOrEqual(DRESSING_BAND_RANGES.treeline.minMetres);
      expect(radius).toBeGreaterThan(17);
    }
  });

  it('keeps the treeline outside every lens cone, but for the rhyme each preset asked for', () => {
    // FR-16 needs exactly one backdrop inside the cone, at the far end of the
    // animal's axis; every other treeline prop stays out of every frame.
    const rhymeOf = (file: string, radius: number): SilhouetteRhyme | undefined =>
      SILHOUETTE_RHYMES.find(
        (rhyme) => rhyme.file === file && Math.abs(rhyme.radiusMetres - radius) < 1e-9,
      );
    for (const item of TREELINE_PLACEMENTS) {
      const radius = Math.hypot(item.position[0], item.position[2]);
      const rhyme = rhymeOf(item.file, radius);
      for (const id of GROUND_POV_ORDER) {
        if (rhyme !== undefined && rhyme.species === POV_FOCUS_SPECIES[id]) {
          continue;
        }
        const preset = POV_PRESETS[id];
        const axis = bearingDegrees(groundXZ(preset.position), groundXZ(preset.lookAt));
        const bearing = bearingDegrees(groundXZ(preset.position), groundXZ(item.position));
        expect(apartDegrees(bearing, axis)).toBeGreaterThan(LENS_CONE_HALF_ANGLE_DEGREES);
      }
    }
  });

  it('never stands a prop between a ground lens and the animal it names', () => {
    // Anything further from the lens than the animal cannot hide it; anything
    // nearer has to clear half its own footprint plus half a metre. The
    // overhead preset has no such segment — it looks down on the middle — so
    // it is judged by the screen-space kit instead (AC-1, `pov.test.ts`).
    for (const id of GROUND_POV_ORDER) {
      const preset = POV_PRESETS[id];
      const lens = groundXZ(preset.position);
      const subject = groundXZ(preset.lookAt);
      const toSubject = gapMetres(lens, subject);
      for (const item of DRESSING_MANIFEST) {
        const point = groundXZ(item.position);
        if (gapMetres(lens, point) > toSubject) {
          continue;
        }
        const clearance = segmentClearanceMetres(point, lens, subject);
        const halfFootprint = ((DRESSING_FOOTPRINT_METRES[item.file] ?? 0) * (item.scale ?? 1)) / 2;
        const measured = `${id}: ${item.file} at ${clearance.toFixed(2)} m clear, needs ${(halfFootprint + 0.5).toFixed(2)}`;
        expect(clearance, measured).toBeGreaterThan(halfFootprint + 0.5);
      }
    }
  });
});

describe('three corners on the trio’s own bearings (FR-13, AC-13)', () => {
  it('derives each corner bearing from the spawn it belongs to', () => {
    expect(CORNER_AZIMUTH_DEGREES.trike).toBeCloseTo(90, 6);
    expect(CORNER_AZIMUTH_DEGREES.stego).toBeCloseTo(210, 6);
    expect(CORNER_AZIMUTH_DEGREES.brachio).toBeCloseTo(330, 6);
    expect(DRESSING_CORNERS).toHaveLength(3);
    expect(new Set(DRESSING_CORNERS.map((corner) => corner.species))).toEqual(
      new Set(['trike', 'stego', 'brachio']),
    );
  });

  it('groups at least three props on each spawn bearing, inside the mid band', () => {
    for (const species of ['trike', 'stego', 'brachio'] as const) {
      const placements = cornerPlacements(species);
      expect(placements.length).toBeGreaterThanOrEqual(3);
      for (const item of placements) {
        const bearing = bearingDegrees([0, 0], groundXZ(item.position));
        expect(apartDegrees(bearing, CORNER_AZIMUTH_DEGREES[species])).toBeLessThanOrEqual(
          CORNER_FRAME_HALF_ANGLE_DEGREES,
        );
        const radius = Math.hypot(item.position[0], item.position[2]);
        expect(radius).toBeGreaterThanOrEqual(DRESSING_BAND_RANGES.mid.minMetres);
        expect(radius).toBeLessThanOrEqual(DRESSING_BAND_RANGES.mid.maxMetres);
      }
    }
  });

  it('frames every corner inside its own preset’s view', () => {
    const presetOf: Readonly<Record<CornerSpecies, (typeof POV_ORDER)[number]>> = {
      trike: 'nest',
      stego: 'garden',
      brachio: 'ranch',
    };
    for (const [species, id] of Object.entries(presetOf) as [CornerSpecies, string][]) {
      const preset = POV_PRESETS[id as (typeof POV_ORDER)[number]];
      const axis = bearingDegrees(groundXZ(preset.position), groundXZ(preset.lookAt));
      for (const item of cornerPlacements(species)) {
        const bearing = bearingDegrees(groundXZ(preset.position), groundXZ(item.position));
        const apart = apartDegrees(bearing, axis);
        expect(
          apart,
          `${id}: ${item.file} at ${bearing.toFixed(1)} deg, ${apart.toFixed(1)} deg off axis`,
        ).toBeLessThanOrEqual(CORNER_FRAME_HALF_ANGLE_DEGREES);
      }
    }
  });

  it('leaves the shared centre clear for the twinkle spot', () => {
    for (const item of DRESSING_MANIFEST) {
      expect(Math.hypot(item.position[0], item.position[2])).toBeGreaterThan(
        GROUND_RADIUS_METRES / 2,
      );
    }
  });
});

describe('continuous water line (FR-14, AC-14)', () => {
  const samples = Array.from({ length: 401 }, (_, index) => {
    const degrees = WATER_LINE_FROM_DEGREES + (WATER_LINE_SWEEP_DEGREES * index) / 400;
    const azimuth = (degrees * Math.PI) / 180;
    return [
      WATER_LINE_RADIUS_METRES * Math.cos(azimuth),
      WATER_LINE_RADIUS_METRES * Math.sin(azimuth),
    ] as const;
  });

  it('starts at the pump and ends inside Stego’s wallow', () => {
    const pump = DRESSING_MANIFEST.find((item) => item.file.includes('hand-water-pump'));
    expect(pump).toBeDefined();
    expect(pump).toBeDefined();
    if (pump === undefined) {
      return;
    }
    const start = samples[0];
    const end = samples[samples.length - 1];
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    if (start === undefined || end === undefined) {
      return;
    }
    expect(gapMetres(start, groundXZ(pump.position))).toBeLessThan(0.5);
    expect(gapMetres(end, WALLOW_CENTRE_METRES)).toBeLessThan(WALLOW_MUD_RADIUS_METRES);
  });

  it('passes the trough and closes every segment with no gap', () => {
    const trough = DRESSING_MANIFEST.find((item) => item.file.includes('water-trough'));
    expect(trough).toBeDefined();
    if (trough === undefined) {
      return;
    }
    const troughPoint = groundXZ(trough.position);
    const nearest = Math.min(...samples.map((sample) => gapMetres(sample, troughPoint)));
    expect(nearest).toBeLessThan(WATER_LINE_WIDTH_METRES);
    for (let index = 1; index < samples.length; index += 1) {
      const previous = samples[index - 1];
      const current = samples[index];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      if (previous === undefined || current === undefined) {
        continue;
      }
      // Samples are 0.34 deg apart, so consecutive points stay well under the
      // channel width: the run is continuous rather than a dotted line (AC-14).
      expect(gapMetres(previous, current)).toBeLessThan(WATER_LINE_WIDTH_METRES / 2);
    }
  });

  it('stays on the mid band, flush to the ground, with its stones on the same arc', () => {
    expect(WATER_LINE_FLUSH_METRES).toBeLessThanOrEqual(0.06);
    for (const sample of samples) {
      const radius = Math.hypot(sample[0], sample[1]);
      expect(radius).toBeGreaterThanOrEqual(DRESSING_BAND_RANGES.mid.minMetres);
      expect(radius).toBeLessThanOrEqual(DRESSING_BAND_RANGES.mid.maxMetres);
    }
    expect(WATER_LINE_STONES.length).toBeGreaterThan(0);
    for (const stone of WATER_LINE_STONES) {
      const stoneRadius = Math.hypot(stone.position[0], stone.position[2]);
      expect(Math.abs(stoneRadius - WATER_LINE_RADIUS_METRES)).toBeLessThan(1e-9);
      const nearest = Math.min(
        ...samples.map((sample) => gapMetres(sample, groundXZ(stone.position))),
      );
      expect(nearest).toBeLessThan(WATER_LINE_WIDTH_METRES);
    }
  });
});

describe('scatter names its parent (FR-15, AC-15)', () => {
  it('records a parent for every scattered file and lands within 1.5 m of it', () => {
    const scatteredFiles = new Set(DRESSING_SCATTER.map((item) => item.file));
    expect(scatteredFiles.size).toBeGreaterThanOrEqual(3);
    for (const file of scatteredFiles) {
      const parent = DRESSING_CATALOGUE[file]?.parent;
      expect(parent).toBeDefined();
      if (parent === undefined) {
        continue;
      }
      const parents = DRESSING_MANIFEST.filter((item) => item.file === parent);
      expect(parents.length).toBeGreaterThan(0);
      const cluster = DRESSING_SCATTER.filter((item) => item.file === file);
      const centroid: [number, number] = [0, 0];
      for (const item of cluster) {
        centroid[0] += item.position[0] / cluster.length;
        centroid[1] += item.position[2] / cluster.length;
        const nearest = Math.min(
          ...parents.map((candidate) =>
            gapMetres(groundXZ(item.position), groundXZ(candidate.position)),
          ),
        );
        expect(nearest).toBeLessThanOrEqual(1.5);
      }
      const nearestParent = Math.min(
        ...parents.map((candidate) => gapMetres(centroid, groundXZ(candidate.position))),
      );
      expect(nearestParent).toBeLessThanOrEqual(1.5);
    }
  });

  it('puts the litter under the ginkgo, mushrooms under the redwood, ferns under the magnolia', () => {
    const parentOf = (needle: string): string | undefined => {
      const file = DRESSING_SCATTER.find((item) => item.file.includes(needle))?.file;
      return file === undefined ? undefined : DRESSING_CATALOGUE[file]?.parent;
    };
    expect(parentOf('litter')).toBe('ginkgo-tree-baa895.glb');
    expect(parentOf('mushroom')).toBe('dawn-redwood-001c29.glb');
    expect(parentOf('fern-clump')).toBe('flowering-magnolia-dd76cb.glb');
  });

  it('stands the reeds in the wallow edge, where the water line ends', () => {
    expect(WALLOW_EDGE_PLACEMENTS.length).toBeGreaterThan(0);
    for (const item of WALLOW_EDGE_PLACEMENTS) {
      const gap = gapMetres(groundXZ(item.position), WALLOW_CENTRE_METRES);
      expect(gap).toBeGreaterThan(WALLOW_MUD_RADIUS_METRES);
      expect(gap).toBeLessThanOrEqual(WALLOW_MUD_RADIUS_METRES * 2);
      expect(DRESSING_CATALOGUE[item.file]?.parent).toBe('garden-rock-7f5d60.glb');
    }
  });
});

describe('one silhouette rhyme per preset (FR-16, AC-16)', () => {
  it('rhymes each preset against a backdrop on its axis, beyond the animal', () => {
    expect(SILHOUETTE_RHYMES).toHaveLength(3);
    for (const id of GROUND_POV_ORDER) {
      const preset = POV_PRESETS[id];
      const rhyme = SILHOUETTE_RHYMES.find((entry) => entry.species === POV_FOCUS_SPECIES[id]);
      expect(rhyme).toBeDefined();
      if (rhyme === undefined) {
        continue;
      }
      const placed = TREELINE_PLACEMENTS.filter((item) => item.file === rhyme.file).find(
        (item) =>
          Math.abs(Math.hypot(item.position[0], item.position[2]) - rhyme.radiusMetres) < 1e-9,
      );
      expect(placed).toBeDefined();
      if (placed === undefined) {
        continue;
      }
      const lens = groundXZ(preset.position);
      const axis = bearingDegrees(lens, groundXZ(preset.lookAt));
      const bearing = bearingDegrees(lens, groundXZ(placed.position));
      expect(apartDegrees(bearing, axis)).toBeLessThanOrEqual(LENS_CONE_HALF_ANGLE_DEGREES);
      expect(gapMetres(lens, groundXZ(placed.position))).toBeGreaterThan(
        gapMetres(lens, groundXZ(preset.lookAt)),
      );
    }
  });

  it('keeps each rhyme at treeline scale', () => {
    for (const rhyme of SILHOUETTE_RHYMES) {
      expect(DRESSING_CATALOGUE[rhyme.file]?.heightMetres ?? 0).toBeGreaterThanOrEqual(
        TREELINE_MIN_HEIGHT_METRES,
      );
    }
  });
});

describe('windpump landmark (FR-18, AC-18)', () => {
  it('stands the windpump on the apron beyond the treeline', () => {
    const pump = LANDMARK_PLACEMENTS.find((item) => item.file === WIND_PUMP_FILE);
    expect(pump).toBeDefined();
    if (pump === undefined) {
      return;
    }
    const radius = Math.hypot(pump.position[0], pump.position[2]);
    expect(radius).toBeGreaterThan(DRESSING_BAND_RANGES.treeline.minMetres);
    expect(radius).toBeLessThan(MEADOW_RADIUS_METRES);
    expect(DRESSING_CATALOGUE[WIND_PUMP_FILE]?.band).toBe('treeline');
    expect(DRESSING_CATALOGUE[WIND_PUMP_FILE]?.heightMetres ?? 0).toBeGreaterThan(4);
  });
});
