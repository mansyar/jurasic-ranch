import {
  DINO_WALK_RADIUS_METRES,
  LARGEST_DINO_BODY_LENGTH_METRES,
  TRIO_SPAWN_ANGLES_RADIANS,
} from './avoidance.js';

/**
 * Ranch layout as data (FR-1): the radii the ranch is built on, the band each
 * prop belongs to, the per-file catalogue, and the placement helpers a
 * composition is written with — a ring, an arc, a row, a cluster and a seeded
 * scatter — so no banded prop carries a hand-written position array.
 *
 * Pure math and plain data: no `three`, no DOM, no scene graph, so the whole
 * layout is importable in a Node test and a later phase can reuse it for props
 * that never came from the original scatter ring.
 */

/**
 * Margin between the walk circle and the furthest a body centre actually
 * reaches, in metres. The per-gait bound is
 * `speed x (PI / min(turnRate, curvature x speed) + WALK_BLEND_SECONDS)`, which
 * phase 4 evaluated at 0.771 m (trike), 0.894 m (stego) and 0.904 m (brachio)
 * over a 0.8 m circle, and measured 1.347 / 1.414 / 1.099 m from the origin.
 * Rounded up so the ring never has to be re-measured unless a stride or a turn
 * rate changes; the dressing test recomputes all three bounds.
 */
export const IN_FRAME_OVERSHOOT_METRES = 0.91;

/**
 * Dino walk clearance in metres (FR-7): the circle the body centres wander
 * inside, the ground a dino covers overshooting it, and half the largest body
 * length of nose and tail around that centre. Nothing may be placed inside
 * this, so no prop can touch the Brachio at any point of its loop.
 */
export const WALK_CLEARANCE_METRES =
  DINO_WALK_RADIUS_METRES + IN_FRAME_OVERSHOOT_METRES + LARGEST_DINO_BODY_LENGTH_METRES / 2;

/**
 * Viewer ground circle radius in metres: the walk clearance plus half a body
 * length of grass beyond the prop ring, so the dressing rings a clearing
 * rather than a cliff and every prop still stands on the ground it belongs to.
 */
export const GROUND_RADIUS_METRES = WALK_CLEARANCE_METRES + LARGEST_DINO_BODY_LENGTH_METRES / 2;

/**
 * Band membership for a dressed prop (FR-6): where it stands relative to the
 * play disc. `mid` rings the paddock, `foreground` sits on the meadow just
 * outside the ground edge, and `treeline` stands well beyond it.
 */
export type DressingBand = 'mid' | 'foreground' | 'treeline';

/** Nearest and furthest radius a band's props may stand at, in metres. */
export interface DressingBandRange {
  minMetres: number;
  maxMetres: number;
}

/** Grass between the walk clearance and the ground edge, in metres. */
const PROP_BAND_METRES = GROUND_RADIUS_METRES - WALK_CLEARANCE_METRES;

/**
 * Grid band edges snap inward to, in metres: a boundary a plan can read at a
 * glance rather than a value only the formula can reproduce. Snapping inward
 * (mins up, maxes down) keeps every band inside the window it was derived from.
 */
const BAND_EDGE_GRID_METRES = 0.2;

function snapUpToGrid(metres: number): number {
  return Math.ceil(metres / BAND_EDGE_GRID_METRES) * BAND_EDGE_GRID_METRES;
}

function snapDownToGrid(metres: number): number {
  return Math.floor(metres / BAND_EDGE_GRID_METRES) * BAND_EDGE_GRID_METRES;
}

/**
 * Radius window per band (FR-6, NFR-5), derived from the two radii the ranch
 * already has instead of copying metres into the table:
 *
 * - `mid` runs from the nearest legal grass (the walk clearance) to halfway
 *   across the prop ring — 8.4-10.0 m, inside FR-6's 8.4-10.2 m window.
 * - `foreground` runs from an eighth of a prop band inside the ground edge to
 *   half a prop band beyond it — 11.6-13.8 m, inside FR-6's 11.5-14 m window.
 * - `treeline` starts one and a half prop bands beyond the ground edge and is
 *   unbounded outwards — 17.8 m and up, clear of FR-6's 17 m floor. The meadow
 *   between the foreground window and the treeline stays deliberately empty:
 *   that clear middle distance is what the cameras read as depth.
 */
export const DRESSING_BAND_RANGES: Readonly<Record<DressingBand, DressingBandRange>> = {
  mid: {
    minMetres: snapUpToGrid(WALK_CLEARANCE_METRES),
    maxMetres: snapDownToGrid(WALK_CLEARANCE_METRES + PROP_BAND_METRES / 2),
  },
  foreground: {
    minMetres: snapUpToGrid(GROUND_RADIUS_METRES - PROP_BAND_METRES / 8),
    maxMetres: snapDownToGrid(GROUND_RADIUS_METRES + PROP_BAND_METRES / 2),
  },
  treeline: {
    minMetres: snapUpToGrid(GROUND_RADIUS_METRES + PROP_BAND_METRES * 1.5),
    maxMetres: Number.POSITIVE_INFINITY,
  },
};

/**
 * What a dressing file is, in metres, at the scale the manifest places it
 * (FR-1, FR-5). `footprintMetres` is the widest ground footprint — the tests
 * ask "could this cover the animal", never "by how much" — and `heightMetres`
 * is the measured GLB top above its ground origin. `parent` is the file a
 * scatter cluster belongs to (FR-15); authored props leave it unset.
 */
export interface DressingCatalogueEntry {
  footprintMetres: number;
  heightMetres: number;
  band: DressingBand;
  parent?: string;
}

/**
 * One entry per vendored GLB. Both numbers are the GLB's own world bounds,
 * measured from the file's POSITION accessors and rounded to the centimetre —
 * for all thirty files, the twelve that shipped included since Phase 5. The
 * twelve shipped with Phase 1's optimistic vendor-sheet footprints (the
 * magnolia read 3.6 m against a 5.09 m canopy, the redwood 3.4 m against 7.59),
 * which made the occlusion kit blind to the props that most needed to fail it.
 *
 * Band is the file's radius under FR-6, not its height: all twelve shipped
 * props still stand on the mid band today, and the treeline restaging that
 * moves the tall trees outward lands with the new props.
 */
export const DRESSING_CATALOGUE: Readonly<Record<string, DressingCatalogueEntry>> = {
  'ginkgo-tree-baa895.glb': { footprintMetres: 5.69, heightMetres: 13.05, band: 'mid' },
  'dawn-redwood-001c29.glb': { footprintMetres: 7.59, heightMetres: 21.32, band: 'mid' },
  'flowering-magnolia-dd76cb.glb': { footprintMetres: 5.09, heightMetres: 3.65, band: 'mid' },
  'fern-covered-boulder-2e0375.glb': { footprintMetres: 2.0, heightMetres: 1.64, band: 'mid' },
  'moss-covered-stump-7253ab.glb': { footprintMetres: 1.0, heightMetres: 1.21, band: 'mid' },
  'wooden-fence-section-d72055.glb': { footprintMetres: 2.0, heightMetres: 1.1, band: 'mid' },
  'farm-gate-8ab320.glb': { footprintMetres: 2.72, heightMetres: 1.2, band: 'mid' },
  'water-trough-df3ced.glb': { footprintMetres: 1.6, heightMetres: 0.5, band: 'mid' },
  'hand-water-pump-448037.glb': { footprintMetres: 0.9, heightMetres: 1.47, band: 'mid' },
  'stone-well-b2dfcd.glb': { footprintMetres: 0.97, heightMetres: 1.93, band: 'mid' },
  'corn-crop-b71f2f.glb': { footprintMetres: 0.88, heightMetres: 1.82, band: 'mid' },
  'river-stone-cluster-0b55bc.glb': { footprintMetres: 1.5, heightMetres: 0.19, band: 'mid' },
  // Phase 3. Every footprint is the widest ground extent of the GLB's own
  // world bounds and every height its measured top above the ground origin
  // (y = 0), read out of the bytes on disk rather than off the vendor sheet;
  // the layout test re-measures each one. The twelve shipped entries above keep
  // the catalogue they were authored and accepted against in Phase 1.
  'hay-bale-079e8c.glb': { footprintMetres: 0.94, heightMetres: 0.52, band: 'mid' },
  'signpost-0bf523.glb': { footprintMetres: 1.17, heightMetres: 1.97, band: 'mid' },
  'flower-bed-708e73.glb': { footprintMetres: 1.0, heightMetres: 0.4, band: 'mid' },
  'berry-bush-ee4812.glb': { footprintMetres: 0.73, heightMetres: 1.11, band: 'mid' },
  'milk-churn-895735.glb': { footprintMetres: 0.49, heightMetres: 0.66, band: 'mid' },
  'wooden-crate-e46521.glb': { footprintMetres: 0.6, heightMetres: 0.6, band: 'mid' },
  'log-stump-1d65a5.glb': { footprintMetres: 0.61, heightMetres: 0.49, band: 'mid' },
  'garden-rock-7f5d60.glb': { footprintMetres: 0.72, heightMetres: 0.42, band: 'mid' },
  // The one deliberate mid-band height exception (FR-13): Brachio's browse tree.
  'plum-tree-565179.glb': { footprintMetres: 1.41, heightMetres: 3.13, band: 'mid' },
  'mushroom-cluster-f2e3ba.glb': {
    footprintMetres: 0.26,
    heightMetres: 0.19,
    band: 'mid',
    parent: 'dawn-redwood-001c29.glb',
  },
  'ginkgo-leaf-litter-9784e9.glb': {
    footprintMetres: 0.78,
    heightMetres: 0.14,
    band: 'mid',
    parent: 'ginkgo-tree-baa895.glb',
  },
  'fern-clump-90ff4b.glb': {
    footprintMetres: 1.47,
    heightMetres: 0.62,
    band: 'mid',
    parent: 'flowering-magnolia-dd76cb.glb',
  },
  // Second recorded exception: FR-15 asks for reeds at the wallow, and a wallow
  // eight metres out in the treeline would not read as one.
  'river-reed-cluster-cba87e.glb': {
    footprintMetres: 1.07,
    heightMetres: 1.89,
    band: 'mid',
    parent: 'garden-rock-7f5d60.glb',
  },
  'club-moss-mat-edcb1b.glb': { footprintMetres: 1.5, heightMetres: 0.23, band: 'foreground' },
  'wildflower-68d3a1.glb': { footprintMetres: 0.15, heightMetres: 0.4, band: 'foreground' },
  'cycad-05ad50.glb': { footprintMetres: 2.92, heightMetres: 3.2, band: 'treeline' },
  'tree-fern-78320e.glb': { footprintMetres: 4.44, heightMetres: 9.36, band: 'treeline' },
  'windpump-tower-1633a9.glb': { footprintMetres: 2.0, heightMetres: 7.75, band: 'treeline' },
};

/**
 * One prop instance: which GLB, where on the ground, which way it faces, and
 * how big it grows. `scale` defaults to 1; a thicket varies it, because a mass
 * of identical clones at identical sizes reads as wallpaper rather than as a
 * meadow edge (rework 1).
 */
export interface DressingPlacement {
  file: string;
  position: readonly [number, number, number];
  rotationY: number;
  scale?: number;
}

/** Which way a ring placement turns: the models are authored facing +Z. */
export type RingFacing = 'inward' | 'outward' | 'tangent';

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Place a prop on the dressing ring.
 *
 * `azimuthDegrees` is the compass angle around the ranch (+X = 0, +Z = 90),
 * which is what makes the composition readable: the farm cluster sits on the
 * Brachio's corner, the corn on the Stego's, the nest stones on the Trike's.
 * `facing` is derived from the same azimuth rather than hand-tuned, so a prop
 * that moves around the rim still points the way it should:
 *
 * - `inward`/`outward` — the model's own +Z points at or away from the middle.
 * - `tangent` — its long axis (local X, which is how the fence panels are
 *   baked: 2 m of width along x at rotationY 0) follows the rim, so a run of
 *   panels reads as one curved fence.
 */
export function ring(
  file: string,
  azimuthDegrees: number,
  radiusMetres: number,
  facing: RingFacing,
): DressingPlacement {
  const azimuth = toRadians(azimuthDegrees);
  const rotationY =
    facing === 'tangent'
      ? -azimuth - Math.PI / 2
      : facing === 'inward'
        ? azimuth + Math.PI
        : azimuth;
  return {
    file,
    position: [radiusMetres * Math.cos(azimuth), 0, radiusMetres * Math.sin(azimuth)],
    rotationY,
  };
}

/**
 * One prop inside a thicket: a file, the bearing and radius it stands at, and
 * how big it grows relative to its model.
 */
export interface ThicketProp {
  readonly file: string;
  readonly azimuthDegrees: number;
  readonly radiusMetres: number;
  readonly scale: number;
}

/**
 * A thicket: overlapping props crowded onto a few neighbouring bearings.
 *
 * The first pass spaced the meadow rim evenly, which produced a dozen single
 * cycads at regular intervals — a dotted line, not a wood edge (rework 1). A
 * thicket instead packs its props within a handful of degrees and a couple of
 * metres of radius, varied in size and facing, so the silhouettes overlap and
 * read as one mass; the gap to the next thicket is what makes it a clump rather
 * than a fence.
 */
export function thicket(props: readonly ThicketProp[]): DressingPlacement[] {
  return props.map((prop) => {
    const azimuth = toRadians(prop.azimuthDegrees);
    return {
      file: prop.file,
      position: [prop.radiusMetres * Math.cos(azimuth), 0, prop.radiusMetres * Math.sin(azimuth)],
      rotationY: azimuth + Math.PI,
      scale: prop.scale,
    };
  });
}

/**
 * A run of identical props evenly spaced along the rim from `fromDegrees` to
 * `toDegrees`, both ends included. Arcs are rim runs, so they face `tangent`
 * unless a caller says otherwise.
 */
export function arc(
  file: string,
  fromDegrees: number,
  toDegrees: number,
  count: number,
  radiusMetres: number,
  facing: RingFacing = 'tangent',
): DressingPlacement[] {
  if (count <= 1) {
    return [ring(file, fromDegrees, radiusMetres, facing)];
  }
  const stepDegrees = (toDegrees - fromDegrees) / (count - 1);
  const placements: DressingPlacement[] = [];
  for (let index = 0; index < count; index += 1) {
    placements.push(ring(file, fromDegrees + stepDegrees * index, radiusMetres, facing));
  }
  return placements;
}

/** Ground axis a row steps along. */
export type RowAxis = 'x' | 'z';

function rotationAt(rotationY: number | readonly number[], index: number): number {
  return typeof rotationY === 'number' ? rotationY : (rotationY[index] ?? 0);
}

/**
 * A straight row of identical props from a ground `start` point, stepping
 * `stepMetres` along one axis. A planted row is a line of constant z (or x)
 * rather than an arc, which is how it reads as a garden marker. `rotationY` is
 * either one spin for the whole row or one authored spin per prop, so a row
 * never looks machine-planted.
 */
export function row(
  file: string,
  start: readonly [number, number],
  count: number,
  axis: RowAxis,
  stepMetres: number,
  rotationY: number | readonly number[],
): DressingPlacement[] {
  const placements: DressingPlacement[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = stepMetres * index;
    placements.push({
      file,
      position: [
        axis === 'x' ? start[0] + offset : start[0],
        0,
        axis === 'z' ? start[1] + offset : start[1],
      ],
      rotationY: rotationAt(rotationY, index),
    });
  }
  return placements;
}

/** One prop in a cluster: where it sits on the ring, and which way it faces. */
export interface ClusterProp {
  azimuthDegrees: number;
  rotationY: number;
}

/**
 * A ring of identical props about a `centre` rather than the ranch middle — a
 * nest, a wallow, a well head. Each prop carries its own bearing and spin, so
 * a cluster keeps the hand-placed look a uniform facing would lose while the
 * ring itself stays one authored radius.
 */
export function cluster(
  file: string,
  centre: readonly [number, number],
  radiusMetres: number,
  props: readonly ClusterProp[],
): DressingPlacement[] {
  return props.map((prop) => {
    const azimuth = toRadians(prop.azimuthDegrees);
    return {
      file,
      position: [
        centre[0] + radiusMetres * Math.cos(azimuth),
        0,
        centre[1] + radiusMetres * Math.sin(azimuth),
      ],
      rotationY: prop.rotationY,
    };
  });
}

const UINT32_RANGE = 4_294_967_296;

/**
 * Deterministic 32-bit xorshift stream for `scatter` (FR-1): the same seed
 * replays the same placements, so `?seed=` fixes the jitter. Non-finite seeds
 * fall back to 1, and zero is remapped because xorshift cannot leave it. Kept
 * local rather than imported from the dev harness so the ranch layout never
 * depends on `src/dev`. Exported because it is the ranch's one seeded stream:
 * the ambient sway draws its per-object phases from it rather than carrying a
 * second generator (FR-11).
 */
export function createSeededStream(seed: number): () => number {
  let state = (Number.isFinite(seed) ? Math.trunc(seed) : 1) >>> 0;
  if (state === 0) {
    state = 0x9e3779b9;
  }
  return () => {
    state = (state ^ (state << 13)) >>> 0;
    state = (state ^ (state >>> 17)) >>> 0;
    state = (state ^ (state << 5)) >>> 0;
    return state / UINT32_RANGE;
  };
}

/** Compass and radius window `scatter` may drop a prop into. */
export interface ScatterArea {
  /** Centre of the area on the ground; defaults to the ranch centre. */
  centre?: readonly [number, number];
  /** Compass window, in degrees. */
  fromDegrees: number;
  toDegrees: number;
  /** Radius window from `centre`, in metres. */
  minRadiusMetres: number;
  maxRadiusMetres: number;
}

/**
 * A seeded cluster of identical props inside an area (FR-1, FR-15): litter
 * under its tree, reeds at the wallow edge. Pure in `seed` — the same seed
 * yields the same layout down to the metre, and later phases feed it the dev
 * harness seed. Draw order per prop is azimuth, radius, then spin, so a seed
 * keeps its layout when a later prop is appended to a cluster.
 */
export function scatter(
  file: string,
  count: number,
  area: ScatterArea,
  seed: number,
): DressingPlacement[] {
  const random = createSeededStream(seed);
  const [centreX, centreZ] = area.centre ?? [0, 0];
  const placements: DressingPlacement[] = [];
  for (let index = 0; index < count; index += 1) {
    const azimuth = toRadians(area.fromDegrees + random() * (area.toDegrees - area.fromDegrees));
    const radius = area.minRadiusMetres + random() * (area.maxRadiusMetres - area.minRadiusMetres);
    const rotationY = random() * Math.PI * 2;
    placements.push({
      file,
      position: [centreX + radius * Math.cos(azimuth), 0, centreZ + radius * Math.sin(azimuth)],
      rotationY,
    });
  }
  return placements;
}

/* -------------------------------------------------------------------------- *
 * The composition (FR-13, FR-14, FR-15, FR-16, FR-18)
 *
 * Every placement below is authored with the helpers above, in the order the
 * ranch reads: the shipped ring first — kept exactly where it stood — then the
 * three corners, the scatter that names its parent, the water line, the
 * foreground sprigs beside every lens and the treeline that rhymes with it.
 * -------------------------------------------------------------------------- */

/**
 * FR-6's height window per band, as numbers a test can hold. The mid cap is
 * applied to this phase's clutter only: the twelve shipped props are
 * grandfathered by the phase-1 snapshot (the 20 m redwood has always stood on
 * the mid band), and FR-13's browse tree is the one deliberate mid exception.
 */
export const MID_PROP_MAX_HEIGHT_METRES = 1.4;
export const FOREGROUND_SPRIG_MAX_HEIGHT_METRES = 0.5;
export const TREELINE_MIN_HEIGHT_METRES = 3;

/**
 * FR-6: no foreground sprig stands inside this half-angle of a lens axis, so a
 * sprig frames the shot instead of sitting in it.
 */
export const LENS_AXIS_CLEARANCE_DEGREES = 18;

/**
 * The cone a preset's frame reads (FR-6, FR-16). FR-16 measures a rhyme against
 * the same ±25 deg, so "outside every lens cone" and "within the rhyme
 * tolerance" are one number and the rhyme is the only prop inside it.
 */
export const LENS_CONE_HALF_ANGLE_DEGREES = 25;

/** Half the horizontal frame of the narrowest FR-7 lens at 16:9, in degrees. */
export const CORNER_FRAME_HALF_ANGLE_DEGREES = 30;

/** How far off the subject a corner must sit to leave the animal a clear approach. */
export const CORNER_APPROACH_CLEARANCE_DEGREES = 10;

const DEGREES_PER_RADIAN = 180 / Math.PI;

function toDegrees(radians: number): number {
  return radians * DEGREES_PER_RADIAN;
}

/** Which dino a corner belongs to (FR-13). */
export type CornerSpecies = 'trike' | 'stego' | 'brachio';

/**
 * Corner bearings in compass degrees, derived from the trio's own spawn angles
 * rather than authored: Trike 90, Stego 210, Brachio 330. Move a spawn and its
 * corner moves with it.
 */
export const CORNER_AZIMUTH_DEGREES: Readonly<Record<CornerSpecies, number>> = {
  trike: toDegrees(TRIO_SPAWN_ANGLES_RADIANS[0] ?? 0),
  stego: toDegrees(TRIO_SPAWN_ANGLES_RADIANS[1] ?? 0),
  brachio: toDegrees(TRIO_SPAWN_ANGLES_RADIANS[2] ?? 0),
};

/** A point on the ground at a compass bearing and radius. */
function at(azimuthDegrees: number, radiusMetres: number): readonly [number, number] {
  const azimuth = toRadians(azimuthDegrees);
  return [radiusMetres * Math.cos(azimuth), radiusMetres * Math.sin(azimuth)];
}

/**
 * Valley backdrop: three pastel trees plus a boulder and a stump, spaced around
 * the rim so each of the three POV presets gets a backdrop and none of them
 * stands between a camera and the animal it names (FR-2, FR-6).
 *
 * Phase 5 moved two of these five with measured footprints in hand — see each
 * placement's note. Nothing else from the twelve moved.
 */
export const VALLEY_PLACEMENTS: readonly DressingPlacement[] = [
  // Moved 28 deg -> 92 deg at 9.8 m: its measured canopy is 5.69 m wide, and at
  // 9.6 m on 28 deg that canopy stood 5.7 m from the Ranch lens with its inner
  // edge 0.75 m off the sightline, covering the Brachio's own rectangle (the
  // capture's right-of-centre animal). Every placement that keeps it in that
  // frame covers the animal, so it now stands behind the Ranch camera and reads
  // in Nest and Garden instead — the same tree, out of the way.
  ring('ginkgo-tree-baa895.glb', 92, 9.8, 'inward'),
  ring('dawn-redwood-001c29.glb', 200, 9.8, 'inward'),
  // Moved 113 deg -> 100 deg: its measured canopy is 5.09 m, not the 3.6 m the
  // vendor sheet claimed, and at 113 deg that box covered the Trike's rectangle
  // in Nest. At 100 deg its inner edge clears the sightline by 2.4 m — 15.0 deg
  // off-axis at the animal's depth against the Trike's 11.7 deg half-width.
  ring('flowering-magnolia-dd76cb.glb', 100, 9.7, 'inward'),
  ring('fern-covered-boulder-2e0375.glb', 180, 9.0, 'inward'),
  ring('moss-covered-stump-7253ab.glb', 70, 9.4, 'inward'),
];

/**
 * Farm set: a curved fence run with a farm-gate gap along the back rim, the
 * trough/pump/well cluster on the Brachio's corner (the Ranch view), two short
 * corn rows as the garden marker on the Stego's corner, and a river-stone ring
 * as the nest marker on the Trike's corner.
 *
 * The fence panels sit 12 deg apart on a 9.2 m ring — a 1.9 m chord, the width
 * of one panel — so the run reads as a continuous fence. Unchanged from phase 1.
 */
export const FARM_PLACEMENTS: readonly DressingPlacement[] = [
  ring('farm-gate-8ab320.glb', 260, 9.2, 'tangent'),
  ...arc('wooden-fence-section-d72055.glb', 272, 296, 3, 9.2),
  ring('water-trough-df3ced.glb', 338, 8.7, 'inward'),
  ring('hand-water-pump-448037.glb', 350, 9.1, 'inward'),
  ring('stone-well-b2dfcd.glb', 2, 9.0, 'inward'),
  // Two corn rows of three: a line of constant z each, the way a planted row
  // reads, with an authored spin per stalk so the rows never look stamped.
  ...row('corn-crop-b71f2f.glb', [-3.4, -8.55], 3, 'x', 0.3, [2.6, 1.9, 2.4]),
  ...row('corn-crop-b71f2f.glb', [-3.4, -9.05], 3, 'x', 0.3, [3.6, 2.9, 3.4]),
  // Four stones ringing a nest spot 18 deg along the rim from the Nest
  // preset, 0.43 m from its centre — a ring a child reads as "the nest",
  // beside the animal rather than in front of it.
  ...cluster('river-stone-cluster-0b55bc.glb', [-8.505, 3.095], 0.43, [
    { azimuthDegrees: 0, rotationY: 0.4 },
    { azimuthDegrees: 180, rotationY: 2.0 },
    { azimuthDegrees: 90, rotationY: 3.5 },
    { azimuthDegrees: 270, rotationY: 5.1 },
  ]),
];

/**
 * The three corners (FR-13), each built on its own dino's spawn bearing.
 *
 * - Trike, 90 deg: a hay nest of four bales at angles, framed by a berry bush
 *   and a flower bed — somewhere to flop that is not the bare grass. The nest
 *   sits at 64 deg rather than square on the bearing: phase 4 pulled the Nest
 *   lens in to 10.8 m, and a cluster at 90 deg then falls 36 deg off that lens's
 *   axis, outside the 30 deg the preset's view allows. It keeps its radius band
 *   and its side of the animal; only its bearing moved.
 * - Stego, 210 deg: the wallow. Its mud, rim stones and reeds are in the water
 *   line and scatter below; the log and the boulder-side rocks frame it, on the
 *   wallow's far side — the Garden lens stands at 240 deg and 11.1 m, so the
 *   cluster leans the same way to stay inside its view.
 * - Brachio, 330 deg: the trough the water line starts at, with the browse tree
 *   standing just past it and the farm clutter — churn, crate, sign — beside it.
 */
export const DRESSING_CORNERS: readonly {
  species: CornerSpecies;
  placements: readonly DressingPlacement[];
}[] = [
  {
    species: 'trike',
    placements: [
      ...cluster('hay-bale-079e8c.glb', at(64, 9.0), 0.55, [
        { azimuthDegrees: 0, rotationY: 0.2 },
        { azimuthDegrees: 90, rotationY: 2.4 },
        { azimuthDegrees: 180, rotationY: 4.1 },
        { azimuthDegrees: 270, rotationY: 5.6 },
      ]),
      ring('berry-bush-ee4812.glb', 61, 8.7, 'inward'),
      ring('flower-bed-708e73.glb', 68, 8.7, 'inward'),
    ],
  },
  {
    species: 'stego',
    placements: [
      // The Garden lens stands at 240 deg and 11.1 m, only 30 deg round from
      // Stego's bearing, so the corner's props sit a couple of metres from the
      // lens and subtend a wide angle. They therefore crowd the wallow's
      // eastern rim, where the sightline corridor is already 0.86 m clear and
      // the frame's 30 deg still reaches them. The bearings moved; the radii
      // stayed in the mid band.
      ring('garden-rock-7f5d60.glb', 223, 8.42, 'outward'),
      ring('log-stump-1d65a5.glb', 226.5, 8.45, 'inward'),
      ring('garden-rock-7f5d60.glb', 229.8, 8.6, 'inward'),
    ],
  },
  {
    species: 'brachio',
    placements: [
      // "Just beyond the trough" (338 deg / 8.7 m): the browse tree stands on
      // the far side of it, so the neck has the tree it walks towards.
      ring('plum-tree-565179.glb', 326, 9.1, 'inward'),
      ring('milk-churn-895735.glb', 316, 9.4, 'inward'),
      ring('wooden-crate-e46521.glb', 312, 8.9, 'inward'),
      ring('signpost-0bf523.glb', 306, 9.0, 'inward'),
    ],
  },
];

/** The corner whose props frame the given preset (FR-13, AC-13). */
export function cornerPlacements(species: CornerSpecies): readonly DressingPlacement[] {
  return DRESSING_CORNERS.find((corner) => corner.species === species)?.placements ?? [];
}

/**
 * Stego's wallow (FR-13, FR-14): a mud patch the water line empties into. It
 * sits four degrees around from the spawn bearing so the patch clears the
 * redwood's trunk while staying on Stego's corner.
 */
export const WALLOW_AZIMUTH_DEGREES = CORNER_AZIMUTH_DEGREES.stego + 4;
export const WALLOW_RADIUS_METRES = 9.3;
export const WALLOW_MUD_RADIUS_METRES = 1.25;
export const WALLOW_CENTRE_METRES: readonly [number, number] = at(
  WALLOW_AZIMUTH_DEGREES,
  WALLOW_RADIUS_METRES,
);

/**
 * The water line (FR-14): pump at 350 deg, trough at 338 deg, then a flush
 * channel on the mid band all the way to the wallow at 214 deg. One band, one
 * continuous mesh: the run is not a stone path because the channel is 0.4 m of
 * wet stone rather than a walkway, and it costs one draw call rather than the
 * sixteen a cloned stone arc would.
 */
export const WATER_LINE_RADIUS_METRES = 8.72;
export const WATER_LINE_WIDTH_METRES = 0.4;
export const WATER_LINE_FROM_DEGREES = 350;
export const WATER_LINE_TO_DEGREES = WALLOW_AZIMUTH_DEGREES;
/** The sweep runs the short way round — past the trough — so it is negative. */
export const WATER_LINE_SWEEP_DEGREES = WATER_LINE_TO_DEGREES - WATER_LINE_FROM_DEGREES;

/** No point of the water line stands above this, in metres (FR-14, AC-14). */
export const WATER_LINE_FLUSH_METRES = 0.06;

export const WATER_LINE_STONE_FILE = 'river-stone-cluster-0b55bc.glb';

/**
 * How far a gutter stone is sunk so its top lands on the flush limit instead of
 * kerbing the channel: derived from the file's own measured height.
 */
export const WATER_LINE_STONE_SINK_METRES = Math.max(
  0,
  (DRESSING_CATALOGUE[WATER_LINE_STONE_FILE]?.heightMetres ?? 0) - WATER_LINE_FLUSH_METRES,
);

/**
 * The stones that line the pump-to-trough stretch. They are not manifest props:
 * the channel is one mesh, and these are dressed onto it as instances so the
 * repeated stones stay one draw call (NFR-1).
 */
export const WATER_LINE_STONES: readonly DressingPlacement[] = arc(
  WATER_LINE_STONE_FILE,
  348,
  336,
  4,
  WATER_LINE_RADIUS_METRES,
  'tangent',
);

/** A scatter cluster needs its parent standing on the ring already. */
function placementOf(file: string): DressingPlacement {
  const found = [...VALLEY_PLACEMENTS, ...FARM_PLACEMENTS].find((item) => item.file === file);
  if (found === undefined) {
    throw new Error(`No placement for ${file}: a scatter cluster needs its parent on the ring.`);
  }
  return found;
}

/**
 * Scatter under a parent (FR-15, AC-15): the area is centred on the parent and
 * its compass window points inward, so a cluster can never be pushed out of the
 * mid band by its own jitter, and the centroid stays within a metre of the
 * parent it belongs to.
 */
function underParent(
  file: string,
  parentFile: string,
  count: number,
  fromDegrees: number,
  toDegrees: number,
  seed: number,
): DressingPlacement[] {
  const parent = placementOf(parentFile);
  return scatter(
    file,
    count,
    {
      centre: [parent.position[0], parent.position[2]],
      fromDegrees,
      toDegrees,
      minRadiusMetres: 0.4,
      maxRadiusMetres: 1.0,
    },
    seed,
  );
}

/**
 * Cause and effect (FR-15): litter under the ginkgo it fell from, mushrooms
 * under the redwood, ferns under the magnolia, reeds at the wallow edge.
 */
export const DRESSING_SCATTER: readonly DressingPlacement[] = [
  ...underParent('ginkgo-leaf-litter-9784e9.glb', 'ginkgo-tree-baa895.glb', 3, 178, 238, 4242),
  // The window is written 350 -> 410 rather than 350 -> 50 so it stays a 60 deg
  // slice around the inward bearing instead of wrapping into its 300 deg complement.
  ...underParent('mushroom-cluster-f2e3ba.glb', 'dawn-redwood-001c29.glb', 3, 350, 410, 4343),
  ...underParent('fern-clump-90ff4b.glb', 'flowering-magnolia-dd76cb.glb', 2, 263, 323, 4444),
];

/** Reeds standing in the wallow's edge, on the stone that rims it (FR-15). */
export const WALLOW_EDGE_PLACEMENTS: readonly DressingPlacement[] = [
  ring('river-reed-cluster-cba87e.glb', 224, 10, 'inward'),
  ring('river-reed-cluster-cba87e.glb', 226, 9.9, 'inward'),
];

/**
 * Foreground sprigs (FR-6, P3.T3): one moss mat and one wildflower beside every
 * lens, 24 deg off its axis at 13 m — inside the foreground window, outside
 * every lens's ±18 deg, and never between a camera and its animal. Phase 5 added
 * four more at 12.4-13 m on the arcs no lens looks down, so the near apron
 * carries grass tufts instead of bare green.
 */
export const FOREGROUND_PLACEMENTS: readonly DressingPlacement[] = [
  ring('club-moss-mat-edcb1b.glb', 34, 13, 'inward'),
  ring('wildflower-68d3a1.glb', 100, 13, 'inward'),
  ring('club-moss-mat-edcb1b.glb', 117.6, 13, 'inward'),
  ring('wildflower-68d3a1.glb', 165.6, 13, 'inward'),
  ring('club-moss-mat-edcb1b.glb', 216, 13, 'inward'),
  ring('wildflower-68d3a1.glb', 215, 13, 'inward'),
  // Phase 5 apron fill (FR-6): the same two files, more of them.
  ring('club-moss-mat-edcb1b.glb', 145, 12.4, 'inward'),
  ring('wildflower-68d3a1.glb', 200, 12.8, 'inward'),
  ring('club-moss-mat-edcb1b.glb', 285, 13, 'inward'),
  ring('wildflower-68d3a1.glb', 40, 12.9, 'inward'),
];

/** One silhouette rhyme per ground preset (FR-16, AC-16). */
export interface SilhouetteRhyme {
  species: CornerSpecies;
  file: string;
  azimuthDegrees: number;
  radiusMetres: number;
}

/**
 * The backdrop each ground preset rhymes its animal against: a tree fern
 * behind the Brachio, a cycad's frill behind the Trike, a tree fern behind the
 * Stego. Each is on its lens's own axis (bearing = the lens-to-subject line),
 * beyond the animal, so it frames it rather than hiding it.
 */
export const SILHOUETTE_RHYMES: readonly SilhouetteRhyme[] = [
  { species: 'brachio', file: 'tree-fern-78320e.glb', azimuthDegrees: 261.6, radiusMetres: 18 },
  { species: 'trike', file: 'cycad-05ad50.glb', azimuthDegrees: 344.9, radiusMetres: 18.2 },
  { species: 'stego', file: 'tree-fern-78320e.glb', azimuthDegrees: 75.4, radiusMetres: 18.2 },
];

/**
 * The treeline: the rhymes above, plus the meadow edge the rework thickened.
 *
 * Phase 5's first pass spaced a dozen cycads and tree ferns evenly around the
 * rim, and the Sky capture read them as single palms dropped on a lawn. They are
 * now three thickets — four or five overlapping props each, on four or five
 * neighbouring bearings, varied in size and facing — with open gaps between
 * them, so the meadow edge reads as clumps with openings rather than a dotted
 * line. Every prop is still at least 17.8 m out, i.e. off the paddock entirely,
 * and every bearing sits more than 25 deg off all three lens cones (the lens
 * axes are 256.2, 340.5 and 73.2 deg, and the test re-derives that from the live
 * lens positions).
 */
export const TREELINE_PLACEMENTS: readonly DressingPlacement[] = [
  ...SILHOUETTE_RHYMES.map((rhyme) =>
    ring(rhyme.file, rhyme.azimuthDegrees, rhyme.radiusMetres, 'inward'),
  ),
  // South thicket: behind the Garden lens's shoulder, an open gap either side.
  ...thicket([
    { file: 'cycad-05ad50.glb', azimuthDegrees: 152, radiusMetres: 21, scale: 1.1 },
    { file: 'tree-fern-78320e.glb', azimuthDegrees: 156, radiusMetres: 23.5, scale: 1.15 },
    { file: 'cycad-05ad50.glb', azimuthDegrees: 160, radiusMetres: 19.5, scale: 1 },
    { file: 'tree-fern-78320e.glb', azimuthDegrees: 164, radiusMetres: 25, scale: 0.95 },
    { file: 'cycad-05ad50.glb', azimuthDegrees: 168, radiusMetres: 22, scale: 1.05 },
  ]),
  // South-west thicket: the mass the Ranch lens sees past its own treeline.
  ...thicket([
    { file: 'cycad-05ad50.glb', azimuthDegrees: 188, radiusMetres: 25.5, scale: 1.25 },
    { file: 'tree-fern-78320e.glb', azimuthDegrees: 193, radiusMetres: 22.5, scale: 1.1 },
    { file: 'cycad-05ad50.glb', azimuthDegrees: 198, radiusMetres: 24, scale: 1.05 },
    { file: 'tree-fern-78320e.glb', azimuthDegrees: 203, radiusMetres: 26, scale: 1 },
    { file: 'tree-fern-78320e.glb', azimuthDegrees: 208, radiusMetres: 23, scale: 1.15 },
  ]),
  // North thicket: the far side of the ring from the Ranch lens. The safe arc
  // there is only eight degrees wide (30-38), so this mass overlaps along the
  // radius instead of along the bearing.
  ...thicket([
    { file: 'tree-fern-78320e.glb', azimuthDegrees: 30, radiusMetres: 19.6, scale: 1.2 },
    { file: 'cycad-05ad50.glb', azimuthDegrees: 33, radiusMetres: 22.4, scale: 1.1 },
    { file: 'tree-fern-78320e.glb', azimuthDegrees: 36, radiusMetres: 25, scale: 0.95 },
    { file: 'cycad-05ad50.glb', azimuthDegrees: 38, radiusMetres: 27, scale: 1.05 },
  ]),
];

/** FR-18: the windpump, and the file the rotor is mounted on. */
export const WIND_PUMP_FILE = 'windpump-tower-1633a9.glb';
/**
 * The horizon landmark (FR-18), placed where a camera actually sees it.
 *
 * Rework 2 moved it from 210 deg / 28 m: the Sky preset's ground footprint ends
 * near 27 m at that bearing, so the one prop built to be a landmark stood outside
 * the only frame that could have shown it. At 142 deg / 22 m it sits on the
 * meadow's outer band, a clear 2.6 m inside the frame's edge, still outside all
 * three ground lenses' 25 deg cones, and still inside the meadow.
 */
export const LANDMARK_PLACEMENTS: readonly DressingPlacement[] = [
  ring(WIND_PUMP_FILE, 142, 22, 'inward'),
];

/**
 * The whole ranch dressing (FR-1): the shipped ring first, in its phase-1
 * order, then everything phase 3 staged around it.
 */
export const DRESSING_MANIFEST: readonly DressingPlacement[] = [
  ...VALLEY_PLACEMENTS,
  ...FARM_PLACEMENTS,
  ...DRESSING_CORNERS.flatMap((corner) => corner.placements),
  ...DRESSING_SCATTER,
  ...WALLOW_EDGE_PLACEMENTS,
  ...FOREGROUND_PLACEMENTS,
  ...TREELINE_PLACEMENTS,
  ...LANDMARK_PLACEMENTS,
];
