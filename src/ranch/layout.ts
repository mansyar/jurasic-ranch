import { DINO_WALK_RADIUS_METRES, LARGEST_DINO_BODY_LENGTH_METRES } from './avoidance.js';

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
 * One entry per vendored GLB. The footprints are the measured values the
 * layout tests already used; the heights are the GLBs' own world bounds
 * (measured across the node hierarchy, rounded to the centimetre).
 *
 * Band is the file's radius under FR-6, not its height: all twelve shipped
 * props still stand on the mid band today, and the treeline restaging that
 * moves the tall trees outward lands with the new props.
 */
export const DRESSING_CATALOGUE: Readonly<Record<string, DressingCatalogueEntry>> = {
  'ginkgo-tree-baa895.glb': { footprintMetres: 3.4, heightMetres: 11.74, band: 'mid' },
  'dawn-redwood-001c29.glb': { footprintMetres: 3.4, heightMetres: 20.0, band: 'mid' },
  'flowering-magnolia-dd76cb.glb': { footprintMetres: 3.6, heightMetres: 6.1, band: 'mid' },
  'fern-covered-boulder-2e0375.glb': { footprintMetres: 2.4, heightMetres: 1.27, band: 'mid' },
  'moss-covered-stump-7253ab.glb': { footprintMetres: 1.3, heightMetres: 1.2, band: 'mid' },
  'wooden-fence-section-d72055.glb': { footprintMetres: 2.0, heightMetres: 1.1, band: 'mid' },
  'farm-gate-8ab320.glb': { footprintMetres: 1.7, heightMetres: 1.2, band: 'mid' },
  'water-trough-df3ced.glb': { footprintMetres: 2.0, heightMetres: 0.5, band: 'mid' },
  'hand-water-pump-448037.glb': { footprintMetres: 1.2, heightMetres: 1.21, band: 'mid' },
  'stone-well-b2dfcd.glb': { footprintMetres: 1.7, heightMetres: 1.75, band: 'mid' },
  'corn-crop-b71f2f.glb': { footprintMetres: 1.3, heightMetres: 1.81, band: 'mid' },
  'river-stone-cluster-0b55bc.glb': { footprintMetres: 1.6, heightMetres: 0.19, band: 'mid' },
};

/** One prop instance: which GLB, where on the ground, which way it faces. */
export interface DressingPlacement {
  file: string;
  position: readonly [number, number, number];
  rotationY: number;
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
 * depends on `src/dev`.
 */
function seededStream(seed: number): () => number {
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
  const random = seededStream(seed);
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
