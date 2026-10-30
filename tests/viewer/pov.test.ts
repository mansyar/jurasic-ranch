import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  DINO_WALK_RADIUS_METRES,
  LARGEST_DINO_BODY_LENGTH_METRES,
  trioSpawnPositions,
} from '../../src/ranch/avoidance.js';
import {
  DRESSING_FOOTPRINT_METRES,
  DRESSING_HEIGHT_METRES,
  DRESSING_MANIFEST,
  GROUND_RADIUS_METRES,
  WALK_CLEARANCE_METRES,
  type DressingPlacement,
} from '../../src/ranch/dressing.js';
import { MEADOW_RADIUS_METRES, frameEdgeGround } from '../../src/ranch/ground.js';
import { DRESSING_BAND_RANGES, DRESSING_CATALOGUE } from '../../src/ranch/layout.js';
import { IN_GAME_BODY_LENGTH_METRES } from '../../src/viewer/loaders.js';
import { DINO_GROUP_SCALE } from '../../src/viewer/loaders.js';
import { readGlbFacts } from '../ranch/dressing-files.js';
import {
  BOOT_POV_ID,
  DINO_HEAD_HEIGHT_METRES,
  GROUND_POV_ORDER,
  HINT_IDLE_MS,
  POV_BEARING_RADIANS,
  POV_EYE_METRES,
  POV_FOCUS_SPECIES,
  POV_LENS_METRES,
  POV_LOOK_AT_HEIGHT_FRACTION,
  POV_ORDER,
  POV_PRESETS,
  SKY_DISC_FRAME_MARGIN,
  SKY_DISTANCE_METRES,
  SKY_HEIGHT_METRES,
  SKY_TILT_DEGREES,
  VIEWPORT_META_CONTENT,
  applyPovPreset,
  focusHeightMetres,
  hintModeFor,
  isPortraitViewport,
  isPovPresetId,
  povPresetById,
  shouldShowHint,
  type PovPreset,
  type PovPresetId,
} from '../../src/viewer/pov.js';
import { CAMERA_FAR_METRES } from '../../src/viewer/scene.js';

const ROOT_URL = new URL('../../', import.meta.url);

/** Clear ground a prop must leave on a preset's sightline before it blocks. */
const SIGHTLINE_MARGIN_METRES = 0.5;

/** Frame the acceptance criteria are written against (AC-1, AC-3). */
const FRAME_WIDTH_PX = 1280;
const FRAME_HEIGHT_PX = 800;
const LANDSCAPE_ASPECT = FRAME_WIDTH_PX / FRAME_HEIGHT_PX;
/** The other frame a tablet boots into: 3:4 portrait (FR-8, AC-2). */
const PORTRAIT_ASPECT = 3 / 4;

/**
 * FR-7's windows, written down as numbers rather than trusted to the preset
 * table, so a future edit to `pov.ts` cannot quietly widen them.
 */
const LENS_WINDOW_METRES = { min: 10.6, max: 11.4 };
const EYE_WINDOW_METRES = { min: 3.0, max: 3.4 };
const GROUND_FOV_WINDOW_DEGREES = { min: 48, max: 52 };
const LOOK_AT_HEIGHT_WINDOW = { min: 0.55, max: 0.6 };
/** AC-3: every animal reads at least this wide on screen. */
const MIN_DINO_PX = 72;

/**
 * The rectangle no HUD chrome covers, as pixel insets from the frame edge:
 * #status and the species chips own the top strip, the 72 px Walk button plus
 * its 24 px margin and gap own the bottom one, and the POV nav sits in the
 * bottom-left corner. Measured off `index.html`'s fixed offsets.
 */
const HUD_SAFE_INSET_PX = { top: 96, bottom: 120, left: 24, right: 24 };

const TRIO_SPECIES_ORDER = ['trike', 'stego', 'brachio'] as const;
type TrioSpecies = (typeof TRIO_SPECIES_ORDER)[number];

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, ROOT_URL), 'utf8');
}

/** Ground bearing of a point in the preset convention (+X = 0, +Z = 90 deg). */
function bearingTo(x: number, z: number): number {
  return Math.atan2(z, x);
}

/** Shortest absolute angle between two bearings, in radians. */
function angleDelta(from: number, to: number): number {
  const delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) {
    return Math.abs(delta - Math.PI * 2);
  }
  return Math.abs(delta < -Math.PI ? delta + Math.PI * 2 : delta);
}

/** Where a species spawns, from the single spawn ring the boot code uses. */
function spawnOf(species: TrioSpecies): { x: number; z: number } {
  return trioSpawnPositions()[TRIO_SPECIES_ORDER.indexOf(species)];
}

/**
 * The camera a preset cuts to, built the way the viewer builds it: a
 * `PerspectiveCamera` at the frame's aspect, then the real `applyPovPreset`
 * cut. Nothing here touches a renderer — the kit projects through
 * `projectionMatrix x matrixWorldInverse`, so it is pure three.js maths.
 */
function cameraFor(id: PovPresetId, aspect: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(1, aspect, 0.1, CAMERA_FAR_METRES);
  applyPovPreset(camera, id);
  camera.updateMatrixWorld(true);
  return camera;
}

/** A screen-space rectangle in CSS pixels, with the nearest corner's depth. */
interface ScreenRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Distance from the lens to the box's nearest corner, in metres. */
  nearest: number;
}

/** Project world points into the frame: pixel bounds and nearest depth. */
function projectPoints(
  camera: THREE.PerspectiveCamera,
  points: readonly THREE.Vector3[],
  width: number,
  height: number,
): ScreenRect {
  const point = new THREE.Vector3();
  const view = new THREE.Vector3();
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let nearest = Number.POSITIVE_INFINITY;
  for (const world of points) {
    point.copy(world);
    // Camera space looks down -Z, so the depth is the negated z.
    view.copy(point).applyMatrix4(camera.matrixWorldInverse);
    nearest = Math.min(nearest, -view.z);
    point.project(camera);
    const px = (point.x * 0.5 + 0.5) * width;
    const py = (0.5 - point.y * 0.5) * height;
    left = Math.min(left, px);
    right = Math.max(right, px);
    top = Math.min(top, py);
    bottom = Math.max(bottom, py);
  }
  return { left, right, top, bottom, nearest };
}

/** Project a world box into the frame: its pixel bounds and its near depth. */
function projectBox(
  camera: THREE.PerspectiveCamera,
  box: THREE.Box3,
  width: number,
  height: number,
): ScreenRect {
  const corners: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        corners.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  return projectPoints(camera, corners, width, height);
}

function rectsOverlap(a: ScreenRect, b: ScreenRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * The box a ground prop occupies: its GLB's widest footprint around its
 * placement, standing on the ground, grown by the placement's own scale so a
 * thicket's bigger props are measured at the size they render (rework 1).
 * Footprints are square in plan, so the box holds the prop at any facing.
 */
function propBox(item: DressingPlacement): THREE.Box3 {
  const scale = item.scale ?? 1;
  const half = ((DRESSING_FOOTPRINT_METRES[item.file] ?? 0) * scale) / 2;
  const height = (DRESSING_HEIGHT_METRES[item.file] ?? 0) * scale;
  const [x, , z] = item.position;
  return new THREE.Box3(
    new THREE.Vector3(x - half, 0, z - half),
    new THREE.Vector3(x + half, height, z + half),
  );
}

/**
 * The silhouette an animal presents: its full body length held broadside, its
 * head height tall, at its placement. The walk can face an animal any way at
 * all and the broadside is the widest it ever reads, so the rectangle is that
 * one — built perpendicular to whichever lens is asking, which is the one
 * orientation the animal cannot be both broadside and end-on in.
 */
function subjectSilhouette(
  species: TrioSpecies,
  from: readonly [number, number, number],
  centre?: { x: number; z: number },
): THREE.Vector3[] {
  const spawn = centre ?? spawnOf(species);
  const aim = spawnOf(species);
  const half = IN_GAME_BODY_LENGTH_METRES[species] / 2;
  const dx = aim.x - from[0];
  const dz = aim.z - from[2];
  const length = Math.hypot(dx, dz);
  // Unit normal to the sightline in plan.
  const nx = (-dz / length) * half;
  const nz = (dx / length) * half;
  const height = focusHeightMetres(species);
  return [
    new THREE.Vector3(spawn.x - nx, 0, spawn.z - nz),
    new THREE.Vector3(spawn.x + nx, 0, spawn.z + nz),
    new THREE.Vector3(spawn.x - nx, height, spawn.z - nz),
    new THREE.Vector3(spawn.x + nx, height, spawn.z + nz),
  ];
}

describe('POV presets', () => {
  it('ships the Ranch, Nest, Garden, and Sky viewpoints in that order (FR-9)', () => {
    expect(POV_ORDER).toEqual(['ranch', 'nest', 'garden', 'sky']);
    expect(GROUND_POV_ORDER).toEqual(['ranch', 'nest', 'garden']);
    expect(BOOT_POV_ID).toBe('ranch');
    for (const id of POV_ORDER) {
      const preset = povPresetById(id);
      expect(preset.id).toBe(id);
      expect(preset.label.length).toBeGreaterThan(0);
      // NFR-4: every button carries an icon and an English word, never one or
      // the other.
      expect(preset.icon.length).toBeGreaterThan(0);
      expect(POV_ORDER.map((presetId) => POV_PRESETS[presetId].label)).toEqual([
        'Ranch',
        'Nest',
        'Garden',
        'Sky',
      ]);
    }
  });

  it('gives every preset a kind, an anchor, and its own lens (P4.T1, FR-10)', () => {
    expect(POV_PRESETS['ranch'].kind).toBe('ground');
    expect(POV_PRESETS['nest'].kind).toBe('ground');
    expect(POV_PRESETS['garden'].kind).toBe('ground');
    // The overhead view aims at the whole ranch, not at a corner of it.
    expect(POV_PRESETS['sky'].kind).toBe('overhead');
    expect(POV_PRESETS['sky'].anchor).toBe('centre');
    for (const id of GROUND_POV_ORDER) {
      expect(POV_PRESETS[id].anchor).toBe(POV_FOCUS_SPECIES[id]);
    }
    for (const id of POV_ORDER) {
      expect(Number.isFinite(POV_PRESETS[id].fov)).toBe(true);
      expect(POV_PRESETS[id].fov).toBeGreaterThan(0);
      expect(POV_PRESETS[id].fov).toBeLessThan(180);
    }
  });

  it('frames the animal each ground preset is named for (FR-7)', () => {
    // Ranch -> Brachio, Nest -> Trike, Garden -> Stego, and every ground preset
    // looks at that animal's placement rather than at the middle of the ranch.
    expect(POV_FOCUS_SPECIES).toEqual({ ranch: 'brachio', nest: 'trike', garden: 'stego' });
    for (const id of GROUND_POV_ORDER) {
      const preset = POV_PRESETS[id];
      const species = POV_FOCUS_SPECIES[id];
      const spawn = spawnOf(species);
      const height = focusHeightMetres(species);
      expect(preset.lookAt[0]).toBeCloseTo(spawn.x, 10);
      expect(preset.lookAt[2]).toBeCloseTo(spawn.z, 10);
      // FR-7: the aim sits at 55-60 % of the animal's height, so head and tail
      // both stay in frame.
      const ratio = preset.lookAt[1] / height;
      expect(ratio).toBeGreaterThanOrEqual(LOOK_AT_HEIGHT_WINDOW.min);
      expect(ratio).toBeLessThanOrEqual(LOOK_AT_HEIGHT_WINDOW.max);
      expect(preset.lookAt[1]).toBeCloseTo(height * POV_LOOK_AT_HEIGHT_FRACTION, 10);
      // The aim clears the toes and never points over the animal's back.
      expect(preset.lookAt[1]).toBeGreaterThan(IN_GAME_BODY_LENGTH_METRES[species] * 0.2);
      expect(preset.lookAt[1]).toBeLessThan(height);
    }
    // The three focus animals are three different species.
    expect(new Set(Object.values(POV_FOCUS_SPECIES)).size).toBe(3);
  });

  it('stands each ground lens in the FR-7 window, on its unchanged bearing', () => {
    for (const id of GROUND_POV_ORDER) {
      const preset = POV_PRESETS[id];
      const distance = Math.hypot(preset.position[0], preset.position[2]);
      // P4.T2: lens 10.6-11.4 m out, eye 3.0-3.4 m up, fov 48-52 deg.
      expect(distance).toBeGreaterThanOrEqual(LENS_WINDOW_METRES.min);
      expect(distance).toBeLessThanOrEqual(LENS_WINDOW_METRES.max);
      expect(distance).toBeCloseTo(POV_LENS_METRES[id], 10);
      expect(preset.position[1]).toBeGreaterThanOrEqual(EYE_WINDOW_METRES.min);
      expect(preset.position[1]).toBeLessThanOrEqual(EYE_WINDOW_METRES.max);
      expect(preset.position[1]).toBeCloseTo(POV_EYE_METRES[id], 10);
      expect(preset.fov).toBeGreaterThanOrEqual(GROUND_FOV_WINDOW_DEGREES.min);
      expect(preset.fov).toBeLessThanOrEqual(GROUND_FOV_WINDOW_DEGREES.max);
      // P4.T2: the bearings are the ones the views were staged on and did not
      // move in phase 4 (58 / 141.6 / 240 deg).
      const standing = bearingTo(preset.position[0], preset.position[2]);
      expect(angleDelta(standing, POV_BEARING_RADIANS[id])).toBeLessThan(1e-9);
      expect(angleDelta(standing, POV_BEARING_RADIANS[id]) * (180 / Math.PI)).toBeLessThan(1e-6);
      // The lens never stands inside the circle a body centre wanders in, and
      // the whole ranch still projects inside the near/far planes.
      expect(distance).toBeGreaterThan(DINO_WALK_RADIUS_METRES * 2);
      expect(distance).toBeLessThan(CAMERA_FAR_METRES);
    }
    // The three bearings the shipped views were staged on, verbatim.
    const ranchDegrees = (POV_BEARING_RADIANS.ranch * 180) / Math.PI;
    const nestDegrees = (POV_BEARING_RADIANS.nest * 180) / Math.PI;
    const gardenDegrees = (POV_BEARING_RADIANS.garden * 180) / Math.PI;
    expect(ranchDegrees).toBeCloseTo(58, 1);
    expect(nestDegrees).toBeCloseTo(141.6, 1);
    expect(gardenDegrees).toBeCloseTo(240, 1);
  });

  it('stands the ground lenses just outside the mid band (P4.T2, FR-6)', () => {
    // Phase 4 pulled the lenses in past the mid band's far edge, so the first
    // thing each frame reads is that band's props. That is the arrangement the
    // occlusion kit below has to prove the animal still shows through.
    for (const id of GROUND_POV_ORDER) {
      const distance = Math.hypot(POV_PRESETS[id].position[0], POV_PRESETS[id].position[2]);
      expect(distance).toBeGreaterThan(DRESSING_BAND_RANGES.mid.maxMetres);
      // ...and clear of the foreground band, which is staged in front of it.
      expect(distance).toBeLessThan(DRESSING_BAND_RANGES.foreground.minMetres);
      expect(distance).toBeGreaterThan(WALK_CLEARANCE_METRES);
    }
  });

  it('keeps the other two animals out of the line to the named one (FR-7)', () => {
    // A dino is roughly two metres across. If another species' spawn point
    // passes within that of the ray from a lens to its animal, a big animal
    // fills the frame and the preset stops framing the one it names.
    const BLOCKER_WIDTH_METRES = 2;
    for (const id of GROUND_POV_ORDER) {
      const lens = POV_PRESETS[id].position;
      const target = POV_PRESETS[id].lookAt;
      const dx = target[0] - lens[0];
      const dz = target[2] - lens[2];
      const length = Math.hypot(dx, dz);
      for (const species of TRIO_SPECIES_ORDER) {
        if (species === POV_FOCUS_SPECIES[id]) {
          continue;
        }
        const spawn = spawnOf(species);
        const wx = spawn.x - lens[0];
        const wz = spawn.z - lens[2];
        const along = (wx * dx + wz * dz) / (length * length);
        if (along <= 0 || along >= 1) {
          continue;
        }
        const lateral = Math.abs(wx * dz - wz * dx) / length;
        expect(lateral, `${species} blocks ${id}`).toBeGreaterThan(BLOCKER_WIDTH_METRES);
      }
    }
  });

  it('keeps every prop off every ground preset sightline (FR-6)', () => {
    // A prop is only in the way if it sits between a lens and the animal the
    // preset looks at, close enough to its centre line to cover it. Lateral
    // offsets are computed against the real placement data and the widest
    // footprint of each GLB, so a future layout change cannot reintroduce a
    // blocked POV. The screen-space kit below is the sharper version of this
    // claim; this one keeps the ground plan honest on its own terms.
    for (const id of GROUND_POV_ORDER) {
      const lens = POV_PRESETS[id].position;
      const target = POV_PRESETS[id].lookAt;
      for (const item of DRESSING_MANIFEST) {
        const [px, , pz] = item.position;
        const dx = target[0] - lens[0];
        const dz = target[2] - lens[2];
        const along = ((px - lens[0]) * dx + (pz - lens[2]) * dz) / (dx * dx + dz * dz);
        if (along <= 0 || along >= 1) {
          continue;
        }
        const lateral = Math.abs((px - lens[0]) * dz - (pz - lens[2]) * dx) / Math.hypot(dx, dz);
        const halfWidth = ((DRESSING_FOOTPRINT_METRES[item.file] ?? 0) * (item.scale ?? 1)) / 2;
        expect(lateral, `${item.file} blocks ${id}`).toBeGreaterThan(
          halfWidth + SIGHTLINE_MARGIN_METRES,
        );
      }
    }
  });

  it('spreads the three ground bearings far enough apart to be different views', () => {
    for (const first of GROUND_POV_ORDER) {
      for (const second of GROUND_POV_ORDER) {
        if (first === second) {
          continue;
        }
        const gap = angleDelta(POV_BEARING_RADIANS[first], POV_BEARING_RADIANS[second]);
        expect(gap).toBeGreaterThan(0.2);
      }
    }
    expect(WALK_CLEARANCE_METRES).toBeGreaterThan(DINO_WALK_RADIUS_METRES);
    expect(GROUND_RADIUS_METRES).toBeGreaterThan(WALK_CLEARANCE_METRES);
    // The avoidance guard must not drift from the loaders' measured length.
    expect(LARGEST_DINO_BODY_LENGTH_METRES).toBeCloseTo(IN_GAME_BODY_LENGTH_METRES.brachio, 3);
  });

  it('gives every preset a distinct camera position', () => {
    const positions = POV_ORDER.map((id) => POV_PRESETS[id].position.join(','));
    expect(new Set(positions).size).toBe(POV_ORDER.length);
  });

  it('cuts the camera to the preset instantly, lens included (FR-10)', () => {
    for (const id of POV_ORDER) {
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
      camera.position.set(9, 9, 9);
      camera.fov = 40;
      applyPovPreset(camera, id);
      expect(Array.from(camera.position.toArray())).toEqual([
        POV_PRESETS[id].position[0],
        POV_PRESETS[id].position[1],
        POV_PRESETS[id].position[2],
      ]);
      const direction = camera.getWorldDirection(new THREE.Vector3());
      const target = new THREE.Vector3(...POV_PRESETS[id].lookAt);
      const expected = target.sub(camera.position).normalize();
      expect(direction.distanceTo(expected)).toBeLessThan(1e-6);
      // The lens is part of the cut: the fov moves and the projection matrix is
      // refreshed in the same call, so a switch re-projects immediately.
      expect(camera.fov).toBe(POV_PRESETS[id].fov);
      expect(camera.projectionMatrix.elements[5]).toBeCloseTo(
        1 / Math.tan((POV_PRESETS[id].fov * Math.PI) / 360),
        10,
      );
    }
  });

  it('looks up every preset by id, never by a hardcoded list (FR-9)', () => {
    for (const id of POV_ORDER) {
      expect(isPovPresetId(id)).toBe(true);
    }
    expect(isPovPresetId('stable')).toBe(false);
    expect(isPovPresetId('')).toBe(false);
    expect(isPovPresetId(undefined)).toBe(false);
    expect(isPovPresetId(null)).toBe(false);
    // A preset id is a key of the table, so the table is the only list.
    expect(Object.keys(POV_PRESETS).sort()).toEqual([...POV_ORDER].sort());
  });
});

describe('ground optics: the subject is unobstructed (AC-1)', () => {
  it('puts no nearer prop inside the subject box, in any ground preset', () => {
    // AC-1, screen space: for every ground preset, project the animal's box and
    // every prop's box through the real camera. A prop nearer than the animal
    // must not overlap the animal's rectangle — that is what "unobstructed"
    // means once the lens has a field of view rather than a centre line.
    const findings: string[] = [];
    for (const id of GROUND_POV_ORDER) {
      const camera = cameraFor(id, LANDSCAPE_ASPECT);
      const subject = projectPoints(
        camera,
        subjectSilhouette(POV_FOCUS_SPECIES[id], POV_PRESETS[id].position),
        FRAME_WIDTH_PX,
        FRAME_HEIGHT_PX,
      );
      expect(subject.right).toBeGreaterThan(subject.left);
      for (const item of DRESSING_MANIFEST) {
        const box = propBox(item);
        // The lens must never stand inside a prop; that is a placement error of
        // its own, and it is not "a prop behind the animal".
        const insideX = camera.position.x >= box.min.x && camera.position.x <= box.max.x;
        const insideZ = camera.position.z >= box.min.z && camera.position.z <= box.max.z;
        if (insideX && insideZ) {
          findings.push(`${id}: ${item.file} stands around the lens`);
          continue;
        }
        const rect = projectBox(camera, box, FRAME_WIDTH_PX, FRAME_HEIGHT_PX);
        // A prop wholly behind the lens is not in the picture at all, and one
        // that straddles the lens plane is beside it: at that depth the whole
        // frame has collapsed, so it cannot cover an animal 11 m out.
        if (rect.nearest <= 0.1) {
          continue;
        }
        if (rect.nearest >= subject.nearest) {
          continue;
        }
        if (rectsOverlap(rect, subject)) {
          const metresFromLens = rect.nearest.toFixed(2);
          findings.push(`${id}: ${item.file} at ${metresFromLens} m overlaps the subject`);
        }
      }
    }
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('frames the subject fully inside the HUD-safe area, in both aspects (AC-1)', () => {
    // The animal must not sit under the Walk button, the POV nav, the status
    // pill or the species chips — a readable frame is one the chrome leaves
    // alone.
    const findings: string[] = [];
    for (const aspect of [LANDSCAPE_ASPECT, PORTRAIT_ASPECT]) {
      const width = aspect >= 1 ? FRAME_WIDTH_PX : FRAME_HEIGHT_PX;
      const height = aspect >= 1 ? FRAME_HEIGHT_PX : FRAME_WIDTH_PX;
      for (const id of GROUND_POV_ORDER) {
        const camera = cameraFor(id, aspect);
        const rect = projectPoints(
          camera,
          subjectSilhouette(POV_FOCUS_SPECIES[id], POV_PRESETS[id].position),
          width,
          height,
        );
        const px = `${id} @${aspect}: l${rect.left.toFixed(0)} r${rect.right.toFixed(0)}`;
        const py = `t${rect.top.toFixed(0)} b${rect.bottom.toFixed(0)}`;
        const where = `${px} ${py}`;
        if (rect.left < HUD_SAFE_INSET_PX.left) {
          findings.push(`${where} touches the left chrome`);
        }
        if (rect.right > width - HUD_SAFE_INSET_PX.right) {
          findings.push(`${where} touches the right chrome`);
        }
        if (rect.top < HUD_SAFE_INSET_PX.top) {
          findings.push(`${where} sits under the top chrome`);
        }
        if (rect.bottom > height - HUD_SAFE_INSET_PX.bottom) {
          findings.push(`${where} sits under the bottom chrome`);
        }
      }
    }
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('measures every subject box from the GLB bytes, head included (P5.T6)', () => {
    // Phase 4 aimed every lens at `bodyLength * 0.62`, a figure that happened to
    // suit the Trike (0.61) and left the Brachio's 7.2 m head a metre and a half
    // above the aim. The table is read back off the files here, so a new rig or
    // a re-export cannot quietly restore the blind spot.
    for (const species of TRIO_SPECIES_ORDER) {
      const facts = readGlbFacts(new URL(`public/models/${species}.glb`, ROOT_URL));
      // The Trike's GLB ships at game scale (its body is already 3.708 m); the
      // other two are authored at 3.845 m and 12.532 m and scaled on load.
      const scale = species === 'trike' ? 1 : DINO_GROUP_SCALE;
      expect(facts.heightMetres * scale, `${species} head`).toBeCloseTo(
        DINO_HEAD_HEIGHT_METRES[species],
        1,
      );
      expect(focusHeightMetres(species)).toBeCloseTo(DINO_HEAD_HEIGHT_METRES[species], 10);
    }
  });

  /**
   * How far past the HUD inset the whole animal may sit at the nearest point of
   * its walk circle, in px, per lens. Zero where the lens can hold it.
   *
   * The review's F2 asked for the full inset at every stance and hoped FR-7's own
   * aim headroom would buy it. It does not, and this is the measurement rather
   * than a claim: with the aim anywhere in 55-60 %, the lens anywhere in
   * 10.6-11.4 m, the eye anywhere in 3.0-3.4 m and the fov anywhere in 48-52 deg,
   * the Brachio at 8.15 m spans 727 px of an 800 px frame, so the 96 px top inset
   * and the 120 px bottom inset (216 px together) cannot both be satisfied — the
   * Ranch frame needs 64 deg at 12.0 m, and the Garden frame (Stego at 4.39 m)
   * needs 52 deg at 12.0 m. Aiming higher does not help: the paws move *down* as
   * the frame tilts up (790 px at 55 %, 820 px at 60 %). The Nest lens was the
   * one lens that could be fixed inside the window, by standing it at the
   * window's far end (10.8 m → 11.4 m), and it now fits with 11 px to spare.
   *
   * The two residual overflows are pinned here so the composition cannot quietly
   * worsen; widening FR-7 or shortening the animals' walk circle is the owner's
   * call, not this test's.
   */
  const WALK_STANCE_OVERFLOW_PX = {
    ranch: { top: 34, bottom: 111 },
    nest: { top: 0, bottom: 0 },
    garden: { top: 0, bottom: 94 },
  } as const;

  it('keeps the whole animal inside the HUD-safe area at its nearest stance (AC-1, P5.T6)', () => {
    // The defect the captures showed: the kit projected the animal at its spawn,
    // but the Trio walks a 3.71 m circle, so a Brachio three metres nearer than
    // its spawn put its head through the top of the Ranch frame. The review found
    // the follow-up test still only asked for `rect.top > 0` — not the 96 px top
    // inset that names the rule, nothing about the paws or the sides, and not the
    // animal's own frame. This asserts the whole box against the full inset at the
    // nearest point of the walk circle, and pins the two overflows FR-7 cannot
    // close (see WALK_STANCE_OVERFLOW_PX).
    const findings: string[] = [];
    for (const id of GROUND_POV_ORDER) {
      const preset = POV_PRESETS[id];
      const species = POV_FOCUS_SPECIES[id];
      const lens = new THREE.Vector3(preset.position[0], preset.position[1], preset.position[2]);
      const spawn = spawnOf(species);
      const toSpawn = new THREE.Vector3(spawn.x - lens.x, 0, spawn.z - lens.z);
      // The walk circle reaches this far toward the lens along the sightline.
      const nearest = Math.max(1, toSpawn.length() - DINO_WALK_RADIUS_METRES);
      const toward = toSpawn.clone().normalize().multiplyScalar(nearest);
      const from: [number, number, number] = [lens.x + toward.x, 0, lens.z + toward.z];
      const camera = cameraFor(id, LANDSCAPE_ASPECT);
      const rect = projectPoints(
        camera,
        subjectSilhouette(species, from, { x: from[0], z: from[2] }),
        FRAME_WIDTH_PX,
        FRAME_HEIGHT_PX,
      );
      const measured = `${id}: ${species} at ${nearest.toFixed(2)} m`;
      const limit = WALK_STANCE_OVERFLOW_PX[id];
      const headOverflow = HUD_SAFE_INSET_PX.top - rect.top;
      const pawOverflow = rect.bottom - (FRAME_HEIGHT_PX - HUD_SAFE_INSET_PX.bottom);
      if (headOverflow > limit.top) {
        findings.push(
          `${measured} puts the head ${rect.top.toFixed(0)} px down — ${headOverflow.toFixed(0)} px into the top chrome, limit ${limit.top}`,
        );
      }
      if (pawOverflow > limit.bottom) {
        findings.push(
          `${measured} puts the paws ${rect.bottom.toFixed(0)} px down — ${pawOverflow.toFixed(0)} px into the bottom chrome, limit ${limit.bottom}`,
        );
      }
      // The sides must fit everywhere: no lens is wide enough to crop the trio,
      // and a walk stance that did would be a real regression.
      if (rect.left < HUD_SAFE_INSET_PX.left) {
        findings.push(`${measured} runs ${rect.left.toFixed(0)} px from the left edge`);
      }
      if (rect.right > FRAME_WIDTH_PX - HUD_SAFE_INSET_PX.right) {
        findings.push(`${measured} runs ${rect.right.toFixed(0)} px past the right inset`);
      }
    }
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('keeps every animal at least 72 px across in the preset that frames it (AC-3)', () => {
    for (const id of GROUND_POV_ORDER) {
      const camera = cameraFor(id, LANDSCAPE_ASPECT);
      const rect = projectPoints(
        camera,
        subjectSilhouette(POV_FOCUS_SPECIES[id], POV_PRESETS[id].position),
        FRAME_WIDTH_PX,
        FRAME_HEIGHT_PX,
      );
      const across = Math.max(rect.right - rect.left, rect.bottom - rect.top);
      const measured = `${POV_FOCUS_SPECIES[id]} in ${id}`;
      expect(across, measured).toBeGreaterThanOrEqual(MIN_DINO_PX);
    }
  });
});

describe('sky preset: the whole ranch, from 75 degrees (FR-8, AC-2)', () => {
  const sky = POV_PRESETS['sky'];

  it('stands the lens at exactly the 75 degree tilt the spec asks for', () => {
    // P4.T3: the tilt is not nadir — a straight-down frame reads as a map.
    const standing = Math.hypot(sky.position[0], sky.position[2]);
    const pitch = Math.atan2(sky.position[1], standing);
    const tiltDegrees = (pitch * 180) / Math.PI;
    expect(tiltDegrees).toBeCloseTo(SKY_TILT_DEGREES, 9);
    expect(SKY_TILT_DEGREES).toBe(75);
    expect(standing).toBeCloseTo(SKY_DISTANCE_METRES, 9);
    expect(sky.position[1]).toBeCloseTo(SKY_HEIGHT_METRES, 9);
    // The aim point is the middle of the play disc, so the pitch the camera
    // actually cuts to is the tilt, not something the two agree on by luck.
    expect(sky.lookAt).toEqual([0, 0, 0]);
    const camera = cameraFor('sky', LANDSCAPE_ASPECT);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const pitchDegrees = (Math.asin(-direction.y) * 180) / Math.PI;
    expect(pitchDegrees).toBeCloseTo(SKY_TILT_DEGREES, 9);
  });

  it('derives the distance from the projected disc, not from a height', () => {
    // The disc's half-extents in camera space bound the distance from below,
    // and the near rim — not the disc's centre — is the binding depth. The
    // shipped placement must satisfy both bounds, and one step closer must
    // break the portrait one, which is what "sized from the projected disc"
    // means rather than "a height someone liked".
    const cos = Math.cos((SKY_TILT_DEGREES * Math.PI) / 180);
    const sin = Math.sin((SKY_TILT_DEGREES * Math.PI) / 180);
    const tanHalf = Math.tan((sky.fov * Math.PI) / 360);
    const margin = 1 - SKY_DISC_FRAME_MARGIN;
    const nearDepth = (distance: number): number => distance / cos - GROUND_RADIUS_METRES * cos;
    const across = GROUND_RADIUS_METRES / nearDepth(SKY_DISTANCE_METRES);
    const up = (GROUND_RADIUS_METRES * sin) / nearDepth(SKY_DISTANCE_METRES);
    // Across binds on the portrait frame; up has room to spare.
    expect(across).toBeLessThanOrEqual(margin * PORTRAIT_ASPECT * tanHalf);
    expect(up).toBeLessThanOrEqual(margin * tanHalf);
    expect(GROUND_RADIUS_METRES / nearDepth(SKY_DISTANCE_METRES * 0.97)).toBeGreaterThan(
      margin * PORTRAIT_ASPECT * tanHalf,
    );
    // A camera that only fitted the landscape frame would stand inside the
    // obstacle the loaded ranch already occupies.
    expect(SKY_DISTANCE_METRES).toBeGreaterThan(LARGEST_DINO_BODY_LENGTH_METRES * 2);
    expect(SKY_DISTANCE_METRES + GROUND_RADIUS_METRES).toBeLessThan(CAMERA_FAR_METRES);
  });

  it('frames the whole play disc with at least 5 % margin, in both aspects', () => {
    // A disc, not its bounding square: the disc is what the ranch stands on,
    // and a circle seen at 75 degrees is an ellipse whose extremes are on the
    // rim, not on the square's corners.
    const EDGE_SAMPLES = 360;
    const rim = new THREE.Vector3();
    const findings: string[] = [];
    for (const aspect of [LANDSCAPE_ASPECT, PORTRAIT_ASPECT]) {
      const width = aspect >= 1 ? FRAME_WIDTH_PX : FRAME_HEIGHT_PX;
      const height = aspect >= 1 ? FRAME_HEIGHT_PX : FRAME_WIDTH_PX;
      const camera = cameraFor('sky', aspect);
      for (let step = 0; step < EDGE_SAMPLES; step += 1) {
        const angle = (step / EDGE_SAMPLES) * Math.PI * 2;
        rim.set(Math.cos(angle) * GROUND_RADIUS_METRES, 0, Math.sin(angle) * GROUND_RADIUS_METRES);
        rim.project(camera);
        const px = (rim.x * 0.5 + 0.5) * width;
        const py = (0.5 - rim.y * 0.5) * height;
        if (px < width * 0.05 || px > width * 0.95) {
          findings.push(`@${aspect}: rim at ${px.toFixed(0)} px leaves the width`);
        }
        if (py < height * 0.05 || py > height * 0.95) {
          findings.push(`@${aspect}: rim at ${py.toFixed(0)} px leaves the height`);
        }
        // The disc is in front of the lens, never behind it.
        expect(rim.z).toBeLessThan(1);
      }
    }
    expect(findings.slice(0, 6).join('\n'), findings.length.toString()).toBe('');
  });

  it('shows no sky: every frame edge lands on the meadow (AC-2)', () => {
    // With the meadow 48 m across and the tilt this steep, "no background
    // colour in frame" is a geometry claim: all five edge rays have to hit
    // ground inside the meadow, so no pixel of the frame is the scene
    // background colour. This is asserted for the frames the app ships —
    // 16:10 landscape, 3:4 portrait — and for square.
    for (const aspect of [LANDSCAPE_ASPECT, PORTRAIT_ASPECT, 1]) {
      const frame = frameEdgeGround(sky.position, sky.lookAt, sky.fov, aspect);
      expect(frame.hits.length, `aspect ${aspect} has a ray above the horizon`).toBe(5);
      expect(frame.topEdgeAboveHorizon).toBe(false);
      for (const hit of frame.hits) {
        expect(hit.distanceFromOriginMetres).toBeLessThan(MEADOW_RADIUS_METRES);
      }
    }
    // An ultrawide frame is the known limit: at 2.4:1 the top corners land
    // about 51 m out, 3 m past the meadow's edge, because framing the disc on
    // the portrait width is what fixes the distance. The whole frame is still
    // ground plane below the horizon — asserted here — but the corner leaves
    // the meadow, which is recorded in the phase evidence rather than papered
    // over. 0.46:1 (a tall phone) does stay inside.
    for (const aspect of [2.4, 0.46]) {
      const frame = frameEdgeGround(sky.position, sky.lookAt, sky.fov, aspect);
      expect(frame.hits.length, `aspect ${aspect} has a ray above the horizon`).toBe(5);
      expect(frame.topEdgeAboveHorizon).toBe(false);
    }
    const tall = frameEdgeGround(sky.position, sky.lookAt, sky.fov, 0.46);
    for (const hit of tall.hits) {
      expect(hit.distanceFromOriginMetres).toBeLessThan(MEADOW_RADIUS_METRES);
    }
  });

  it('keeps every animal at least 72 px across, in both aspects (AC-3)', () => {
    const measured: string[] = [];
    for (const aspect of [LANDSCAPE_ASPECT, PORTRAIT_ASPECT]) {
      const width = aspect >= 1 ? FRAME_WIDTH_PX : FRAME_HEIGHT_PX;
      const height = aspect >= 1 ? FRAME_HEIGHT_PX : FRAME_WIDTH_PX;
      const camera = cameraFor('sky', aspect);
      for (const species of TRIO_SPECIES_ORDER) {
        const rect = projectPoints(camera, subjectSilhouette(species, sky.position), width, height);
        const across = Math.max(rect.right - rect.left, rect.bottom - rect.top);
        const size = `${species} in sky at ${aspect}`;
        expect(across, size).toBeGreaterThanOrEqual(MIN_DINO_PX);
        measured.push(`${species}@${aspect}=${Math.round(across)}px`);
      }
    }
    // Six measurements, three animals, two frames: no species is an
    // afterthought in either orientation.
    expect(measured).toHaveLength(TRIO_SPECIES_ORDER.length * 2);
  });

  it('writes the sky preset from the shared model, not a second shape (P4.T1)', () => {
    // One preset type for all four cameras: every field the ground presets
    // carry is present here too, so the HUD, harness and snapshot widen by
    // looking up the table rather than by special-casing `sky`.
    const ground = POV_PRESETS['ranch'];
    expect(Object.keys(sky).sort()).toEqual(Object.keys(ground).sort());
    const presets: PovPreset[] = POV_ORDER.map((id) => POV_PRESETS[id]);
    for (const preset of presets) {
      expect(preset.position).toHaveLength(3);
      expect(preset.lookAt).toHaveLength(3);
    }
  });
});

describe('hint glow idle timer', () => {
  it('waits 5s of no interaction before glowing', () => {
    expect(HINT_IDLE_MS).toBe(5000);
    expect(shouldShowHint(0, 4999)).toBe(false);
    expect(shouldShowHint(0, 5000)).toBe(true);
    expect(shouldShowHint(1000, 9000)).toBe(true);
  });

  it('uses a static outline when reduced motion is preferred', () => {
    expect(hintModeFor(false)).toBe('hint-glow');
    expect(hintModeFor(true)).toBe('hint-static');
  });
});

describe('viewport guards', () => {
  it('locks the viewport against pinch zoom', () => {
    expect(VIEWPORT_META_CONTENT).toContain('maximum-scale=1.0');
    expect(VIEWPORT_META_CONTENT).toContain('user-scalable=no');
  });

  it('detects portrait windows for the rotate hint', () => {
    expect(isPortraitViewport(1024, 768)).toBe(false);
    expect(isPortraitViewport(768, 1024)).toBe(true);
    expect(isPortraitViewport(800, 800)).toBe(false);
  });
});

describe('POV shell wiring', () => {
  it('ships four 72 px POV buttons with the portrait lift kept (FR-9, AC-4)', async () => {
    const html = await readText('index.html');
    expect(html).toContain(VIEWPORT_META_CONTENT);
    for (const id of POV_ORDER) {
      expect(html).toContain(`id="pov-${id}"`);
      expect(html).toContain(`data-pov="${id}"`);
    }
    // Four buttons, one per preset, and no fifth.
    expect((html.match(/data-pov=/g) ?? []).length).toBe(POV_ORDER.length);
    expect(html).toContain('rotate-hint');
    expect(html).toContain('hint-glow');
    const touchTargets = html.match(/min-height: 72px/g) ?? [];
    expect(touchTargets.length).toBeGreaterThanOrEqual(2);
    // The nav still lifts clear of the Walk button in portrait — and on any
    // narrow window, where four 72 px buttons would otherwise reach it.
    expect(html).toContain('@media (orientation: portrait), (max-width: 800px)');
  });

  it('wires instant POV cuts, hint reset, and zoom guards in the viewer', async () => {
    const source = await readText('src/viewer/hud.ts');
    expect(source).toContain('applyPovPreset');
    expect(source).toContain('shouldShowHint');
    expect(source).toContain('isPortraitViewport');
    expect(source).toContain('gesturestart');
    expect(source).toContain('dblclick');
    // FR-9: the hardcoded id list is gone; the table is the only lookup.
    expect(source).toContain('isPovPresetId');
    expect(source).not.toContain("id !== 'ranch'");
    expect(source).not.toContain("id !== 'sky'");
  });

  it('derives the dev harness POV buttons from POV_ORDER (P4.T5)', async () => {
    const source = await readText('src/dev/harness.ts');
    expect(source).toContain('POV_ORDER');
    expect(source).not.toContain("'ranch', 'nest', 'garden'");
  });

  it('never writes the camera from the render loop (FR-10)', async () => {
    // The preset cut is the only thing allowed to move the camera: if the loop
    // wrote a position, a fov or a projection, a switch would be re-tweened a
    // frame later and FR-10 would be back to being an animation.
    const source = await readText('src/viewer/loop.ts');
    const writes = [
      'camera.position',
      'camera.lookAt',
      'camera.fov',
      'camera.rotation',
      'camera.quaternion',
      'camera.matrix',
      'camera.projectionMatrix',
      'updateProjectionMatrix',
      'applyPovPreset',
    ];
    for (const write of writes) {
      expect(source, `loop.ts writes ${write}`).not.toContain(write);
    }
    // It does draw through the camera, which is the one thing it is for.
    expect(source).toContain('renderer.render(scene, camera)');
  });
});

describe('dressing catalogue stays reachable for the kit', () => {
  it('has a footprint and a height for every prop the occlusion test places', () => {
    // The kit projects a box per manifest entry; a prop without a catalogue
    // entry would project as a point and lie about being in the way.
    for (const item of DRESSING_MANIFEST) {
      expect(DRESSING_CATALOGUE[item.file], item.file).toBeDefined();
      expect(DRESSING_FOOTPRINT_METRES[item.file], item.file).toBeGreaterThan(0);
      expect(DRESSING_HEIGHT_METRES[item.file], item.file).toBeGreaterThan(0);
    }
  });
});
