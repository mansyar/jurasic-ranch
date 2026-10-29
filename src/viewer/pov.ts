import * as THREE from 'three';
import { trioSpawnPositions } from '../ranch/avoidance.js';
import { GROUND_RADIUS_METRES } from '../ranch/layout.js';
import { IN_GAME_BODY_LENGTH_METRES } from './loaders.js';

/**
 * Fixed cozy viewpoints (FR-1). The camera never orbits or follows: every
 * switch is an instant cut, so all animations stay interruptible (FR-7).
 * Dino wander stays inside the half-body-length circle on the ranch, so both
 * babies stay reachable in frame from any preset via the existing
 * wander/avoidance.
 *
 * A preset is the whole cut — where the lens stands, where it aims, and the
 * lens it aims through (FR-10). Three presets stand on the ground and frame one
 * corner each; the fourth looks down on the whole ranch (FR-8). `kind` is what
 * tells the sightline maths which of the two it is holding, because an overhead
 * lens has no lateral subject direction to measure a rhyme against.
 */

/** A viewpoint that stands on the ground and frames one corner (FR-7). */
export type GroundPovPresetId = 'ranch' | 'nest' | 'garden';

/** Fixed camera viewpoint id. */
export type PovPresetId = GroundPovPresetId | 'sky';

/** Whether a preset stands on the ground or looks down on the ranch (FR-8). */
export type PovKind = 'ground' | 'overhead';

/** The corner a preset frames; `centre` is the whole-ranch overhead view. */
export type PovAnchor = 'trike' | 'stego' | 'brachio' | 'centre';

/** Fixed camera preset: where it stands, where it aims, and the lens it uses. */
export interface PovPreset {
  id: PovPresetId;
  /** Ground presets read the ranch from its rim; the overhead one from above. */
  kind: PovKind;
  /** The corner this preset frames, or `centre` for the whole ranch. */
  anchor: PovAnchor;
  label: string;
  icon: string;
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
  /** Vertical field of view in degrees, applied with the cut (FR-10). */
  fov: number;
}

/** Tab order for the POV buttons; Ranch is the boot view. */
export const POV_ORDER: readonly PovPresetId[] = ['ranch', 'nest', 'garden', 'sky'];

/**
 * The presets that stand on the ground. The sightline, lens-cone and rhyme
 * rules are written against these: an overhead lens has no ground axis from
 * which to measure a lateral offset, so the rules that depend on one select
 * this list rather than `POV_ORDER` (Edge Cases: overhead sightline).
 */
export const GROUND_POV_ORDER: readonly GroundPovPresetId[] = ['ranch', 'nest', 'garden'];

/** The preset the viewer boots on, and the one the scene lens starts at. */
export const BOOT_POV_ID: PovPresetId = 'ranch';

/**
 * POV preset id -> the animal that preset is named for. Every preset aims at
 * where its animal is *placed* rather than at the middle of the ranch: the
 * lens stands on a bearing of its own, and aiming at the centre put whichever
 * animal spawned on the lens side between the camera and the animal it named.
 */
export const POV_FOCUS_SPECIES: Readonly<
  Record<GroundPovPresetId, keyof typeof IN_GAME_BODY_LENGTH_METRES>
> = {
  ranch: 'brachio',
  nest: 'trike',
  garden: 'stego',
};

/** Spawn-ring order used by `trioSpawnPositions()` and the boot placement. */
const TRIO_SPAWN_SPECIES_ORDER: readonly (keyof typeof IN_GAME_BODY_LENGTH_METRES)[] = [
  'trike',
  'stego',
  'brachio',
];

/**
 * Where a ground preset stands, as a bearing around the ranch in radians,
 * measured from +X towards +Z — the same convention the dressing ring places
 * props in, so the layout tests can hold the two against each other. The bow of
 * the lens used to be hand-authored as three unrelated coordinates; since the
 * trio now fills a much bigger circle, the bearing is what keeps the three
 * views apart (FR-7). Phase 4 kept all three exactly as they were.
 */
export const POV_BEARING_RADIANS: Readonly<Record<GroundPovPresetId, number>> = {
  // Bearings are degrees around the ranch in the dressing ring's convention.
  ranch: 1.0123, // 58 deg: the boot view, lit from the sun at (+3, +5, +2).
  nest: 2.471, // 141.6 deg: the nest stones sit 18 deg along the rim.
  garden: 4.1888, // 240 deg: stands off the corn, looking back at its dino.
};

/**
 * Lens standoff from the ranch middle, in metres (FR-7: 10.6-11.4 m). Phase 4
 * pulled every ground lens in from the 15.2-17.8 m it stood at, which lands
 * them just outside the mid band: the props the frame reads first are the
 * band's own, and the screen-space occlusion test is what proves the animal
 * behind them is still clear. Three distances rather than one keep the trio
 * visually different from view to view.
 */
export const POV_LENS_METRES: Readonly<Record<GroundPovPresetId, number>> = {
  ranch: 11.4,
  nest: 10.8,
  garden: 11.1,
};

/**
 * Eye height in metres (FR-7: 3.0-3.4 m). The ground is flat, so a low eye
 * keeps the horizon steady through a cut while still looking down on a 3.7 m
 * animal; three heights keep the three shots from reading as one lens moved.
 */
export const POV_EYE_METRES: Readonly<Record<GroundPovPresetId, number>> = {
  ranch: 3.4,
  nest: 3.0,
  garden: 3.2,
};

/**
 * How tall each rigged model stands in game, head included, measured from its
 * GLB's own bounds (`public/models/<species>.glb`) times `DINO_GROUP_SCALE`:
 * trike 2.247 m, stego 3.820 x 0.59233 = 2.263 m, brachio 12.200 x 0.59233 =
 * 7.226 m. The Brachio is the ranch's reason for a per-species table: it stands
 * 0.97 m of height per metre of body, where the Trike manages 0.61, so one
 * shared ratio aimed every lens at a height the sauropod's head left long ago.
 * Phase 5 corrected this from the GLB bytes; `tests/viewer/pov.test.ts` re-reads
 * the same bytes so the table cannot drift from the models on disk.
 */
export const DINO_HEAD_HEIGHT_METRES: Readonly<
  Record<keyof typeof IN_GAME_BODY_LENGTH_METRES, number>
> = {
  trike: 2.247,
  stego: 2.263,
  brachio: 7.226,
};

/**
 * Where a ground lens aims, as a fraction of the focus animal's height
 * (FR-7: 55-60 %). Phase 5 pinned it to the floor of the window: the Brachio is
 * 7.2 m tall, so every point of aim lifted above 55 % pushes its paws under the
 * bottom chrome when it wanders toward the lens.
 */
export const POV_LOOK_AT_HEIGHT_FRACTION = 0.55;

/**
 * Vertical field of view per preset, in degrees (FR-7: 48-52 deg on the ground
 * lenses). The sky lens is its own number: it is sized to fit the whole play
 * disc rather than to frame one animal, and FR-8 fixes that by projection, not
 * by a fov window.
 */
export const POV_FOV_DEGREES: Readonly<Record<PovPresetId, number>> = {
  ranch: 52,
  nest: 50,
  garden: 48,
  sky: 30,
};

/**
 * POV preset id -> index into `trioSpawnPositions()` for the animal that
 * preset is named for, derived from the species map so the two cannot drift.
 */
export const POV_FOCUS_SPAWN_INDEX: Readonly<Record<GroundPovPresetId, number>> = {
  ranch: TRIO_SPAWN_SPECIES_ORDER.indexOf(POV_FOCUS_SPECIES.ranch),
  nest: TRIO_SPAWN_SPECIES_ORDER.indexOf(POV_FOCUS_SPECIES.nest),
  garden: TRIO_SPAWN_SPECIES_ORDER.indexOf(POV_FOCUS_SPECIES.garden),
};

/** How tall the animal a preset frames stands, whole model, head included (FR-7). */
export function focusHeightMetres(species: keyof typeof IN_GAME_BODY_LENGTH_METRES): number {
  return DINO_HEAD_HEIGHT_METRES[species];
}

/**
 * Cut a ground preset to a camera position: stand `lensMetres` out on
 * `bearing`, look at the named animal's chest height. Keeping this derivation
 * in one function means the three presets cannot drift out of step with each
 * other, the walk circle, or the body heights when the ranch is resized
 * (AC-1).
 */
function groundPreset(id: GroundPovPresetId, label: string, icon: string): PovPreset {
  const bearing = POV_BEARING_RADIANS[id];
  const distance = POV_LENS_METRES[id];
  const species = POV_FOCUS_SPECIES[id];
  const spawn = trioSpawnPositions()[POV_FOCUS_SPAWN_INDEX[id]];
  return {
    id,
    kind: 'ground',
    anchor: species,
    label,
    icon,
    position: [distance * Math.cos(bearing), POV_EYE_METRES[id], distance * Math.sin(bearing)],
    // A little above the middle of the animal it names, not its toes and not
    // the ranch centre: at 55-60 % of its height head and tail both fit.
    lookAt: [spawn.x, focusHeightMetres(species) * POV_LOOK_AT_HEIGHT_FRACTION, spawn.z],
    fov: POV_FOV_DEGREES[id],
  };
}

/**
 * Tilt of the overhead lens, in degrees below the horizon (FR-8). Not nadir: a
 * straight-down frame reads as a map, while 75 deg keeps the animals in
 * profile and lets the treeline stand up at the top of the frame.
 */
export const SKY_TILT_DEGREES = 75;

/**
 * Bare edge the play disc must leave inside the frame, as a fraction of the
 * half-frame: FR-8's "at least 5 % margin", and AC-2's number.
 */
export const SKY_DISC_FRAME_MARGIN = 0.05;

/**
 * Room the derivation keeps inside that margin, as a fraction of the
 * half-frame. The closed-form bound below charges the whole rim the nearest
 * depth it can reach, which under-reads the widest chord by a hair; without
 * this the disc lands exactly on the 5 % line and the pixel check lands either
 * side of it.
 */
export const SKY_FRAME_CUSHION = 0.02;

/**
 * The aspect the sky lens is sized against: 3:4 portrait, the narrowest frame a
 * tablet boots into. Sizing from landscape alone is what lets a portrait frame
 * cut the ranch's ears off.
 */
export const SKY_NARROWEST_ASPECT = 3 / 4;

/**
 * Bearing the overhead lens stands on, in radians. It is the one camera
 * bearing FR-7 does not fix, so it is chosen for the frame: standing on 30 deg
 * puts the far treeline — the redwood at 200 deg and the three silhouette
 * rhymes — across the top edge of the frame.
 */
export const SKY_BEARING_RADIANS = Math.PI / 6;

const SKY_TILT_RADIANS = (SKY_TILT_DEGREES * Math.PI) / 180;
const SKY_COS_TILT = Math.cos(SKY_TILT_RADIANS);
const SKY_SIN_TILT = Math.sin(SKY_TILT_RADIANS);
/** Tan of the sky lens's vertical half-fov: the half-frame in camera space. */
export const SKY_TAN_HALF_FOV = Math.tan((POV_FOV_DEGREES.sky * Math.PI) / 360);
/** The half-frame the disc may use, after FR-8's margin and the cushion. */
const SKY_HALF_FRAME = (1 - SKY_DISC_FRAME_MARGIN - SKY_FRAME_CUSHION) * SKY_TAN_HALF_FOV;
/** The same half-frame across the narrowest frame: aspect * tan(v/2). */
const SKY_ACROSS_HALF_FRAME = SKY_HALF_FRAME * SKY_NARROWEST_ASPECT;

/**
 * How far the overhead lens stands from the ranch middle, in metres — derived
 * from the play disc rather than by eye (FR-8, AC-2).
 *
 * A horizontal disc of radius `R` seen from `D` out and `H = D tan(tilt)` up,
 * looking down the tilt axis at its centre, projects to an ellipse whose
 * half-extents in camera space are
 *
 *     across = R / (D / cos(tilt) - R cos(tilt))
 *     up     = R sin(tilt) / (D / cos(tilt) - R cos(tilt))
 *
 * Both use the nearest depth a rim point can reach, because the nearer a point
 * is the wider it reads, and the rim leans `R cos(tilt)` closer than the disc's
 * centre. Requiring each to stay inside `(1 - margin)` of its half-frame gives
 * the two lower bounds below, and the distance is the larger of them: which one
 * binds depends on the aspect. At the shipped numbers the portrait width binds,
 * so the disc fills 95 % of a 3:4 frame's width and rather less of a 16:10 one.
 *
 * The height follows from the tilt, so the aim vector is exactly 75 deg down.
 */
const SKY_ACROSS_DISTANCE_METRES =
  (GROUND_RADIUS_METRES * (1 + SKY_ACROSS_HALF_FRAME * SKY_COS_TILT) * SKY_COS_TILT) /
  SKY_ACROSS_HALF_FRAME;
const SKY_UP_DISTANCE_METRES =
  GROUND_RADIUS_METRES * SKY_COS_TILT * SKY_COS_TILT +
  (GROUND_RADIUS_METRES * SKY_SIN_TILT * SKY_COS_TILT) / SKY_HALF_FRAME;

export const SKY_DISTANCE_METRES = Math.max(SKY_ACROSS_DISTANCE_METRES, SKY_UP_DISTANCE_METRES);

/** Height of the overhead lens, in metres: the distance at the tilt angle. */
export const SKY_HEIGHT_METRES = SKY_DISTANCE_METRES * Math.tan(SKY_TILT_RADIANS);

/**
 * The overhead preset (FR-8): stand `SKY_DISTANCE_METRES` out on the sky
 * bearing, `SKY_HEIGHT_METRES` up, and aim at the middle of the play disc. The
 * aim point is the ground origin, so the tilt the camera actually cuts to is
 * `SKY_TILT_DEGREES` exactly — the test holds the two against each other rather
 * than trusting the constants to agree.
 */
function overheadPreset(): PovPreset {
  return {
    id: 'sky',
    kind: 'overhead',
    anchor: 'centre',
    label: 'Sky',
    icon: '🚁',
    position: [
      SKY_DISTANCE_METRES * Math.cos(SKY_BEARING_RADIANS),
      SKY_HEIGHT_METRES,
      SKY_DISTANCE_METRES * Math.sin(SKY_BEARING_RADIANS),
    ],
    lookAt: [0, 0, 0],
    fov: POV_FOV_DEGREES.sky,
  };
}

/**
 * Fixed camera presets: Ranch looks at the Brachio, Nest at the Trike, Garden
 * at the Stego, Sky at the whole ranch (FR-7, FR-8). The three ground lenses
 * stand just outside the mid band, so what they see first is that band's props
 * — the occlusion test proves the animal behind them is still clear — and each
 * aims past the other two animals rather than through one of them.
 */
export const POV_PRESETS: Readonly<Record<PovPresetId, PovPreset>> = {
  ranch: groundPreset('ranch', 'Ranch', '🏠'),
  nest: groundPreset('nest', 'Nest', '🪹'),
  garden: groundPreset('garden', 'Garden', '🌼'),
  sky: overheadPreset(),
};

/** Look up a fixed camera preset by id. */
export function povPresetById(id: PovPresetId): PovPreset {
  return POV_PRESETS[id];
}

/**
 * Whether a value names a preset (FR-9): the DOM is the one place a preset
 * arrives as a string, and every lookup goes through here so a fifth button
 * cannot be swallowed by a hardcoded list.
 */
export function isPovPresetId(value: string | null | undefined): value is PovPresetId {
  return value !== null && value !== undefined && Object.hasOwn(POV_PRESETS, value);
}

/**
 * Cut the camera to a preset instantly (no tween): set the lens, the position
 * and the look-at target in the same frame, so the switch lands under 200 ms
 * (AC-4) and never leaves a tween to interrupt (FR-7). The fov is part of the
 * cut (FR-10), so a switch between a 48 deg and a 52 deg lens re-projects
 * immediately rather than waiting for a resize.
 */
export function applyPovPreset(camera: THREE.PerspectiveCamera, id: PovPresetId): void {
  const preset = povPresetById(id);
  camera.position.set(preset.position[0], preset.position[1], preset.position[2]);
  camera.lookAt(preset.lookAt[0], preset.lookAt[1], preset.lookAt[2]);
  camera.fov = preset.fov;
  camera.updateProjectionMatrix();
}

/**
 * Milliseconds of no interaction before the hint glow pulses on
 * Walk/POV (FR-5).
 */
export const HINT_IDLE_MS = 5000;

/**
 * Whether the hint glow should show: true once the time since the last
 * interaction reaches the idle threshold.
 */
export function shouldShowHint(
  lastInteractionMs: number,
  nowMs: number,
  idleMs: number = HINT_IDLE_MS,
): boolean {
  return nowMs - lastInteractionMs >= idleMs;
}

/**
 * Hint presentation for the motion preference (FR-8): a pulsing glow by
 * default, a static outline when reduced motion is preferred.
 */
export function hintModeFor(reducedMotion: boolean): 'hint-glow' | 'hint-static' {
  return reducedMotion ? 'hint-static' : 'hint-glow';
}

/**
 * Locked viewport content (FR-6): landscape stage, no pinch/double-tap
 * zoom. Mirrored verbatim in the index.html viewport meta tag.
 */
export const VIEWPORT_META_CONTENT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

/** Whether a window size counts as portrait (shows the rotate hint). */
export function isPortraitViewport(width: number, height: number): boolean {
  return height > width;
}
