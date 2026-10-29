import * as THREE from 'three';
import { LARGEST_DINO_BODY_LENGTH_METRES, trioSpawnPositions } from '../ranch/avoidance.js';
import { IN_GAME_BODY_LENGTH_METRES } from './loaders.js';

/**
 * Fixed cozy viewpoints (FR-1). The camera never orbits or follows: every
 * switch is an instant cut, so all animations stay interruptible (FR-7).
 * Dino wander stays inside the half-body-length circle on the ranch, so both
 * babies stay reachable in frame from any preset via the existing
 * wander/avoidance.
 */

/** Fixed camera viewpoint id. */
export type PovPresetId = 'ranch' | 'nest' | 'garden';

/** Fixed camera preset: position plus look-at target, both in metres. */
export interface PovPreset {
  id: PovPresetId;
  label: string;
  icon: string;
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}

/** Tab order for the POV buttons; Ranch is the boot view. */
export const POV_ORDER: readonly PovPresetId[] = ['ranch', 'nest', 'garden'];

/**
 * POV preset id -> the animal that preset is named for. Every preset aims at
 * where its animal is *placed* rather than at the middle of the ranch: the
 * lens stands on a bearing of its own, and aiming at the centre put whichever
 * animal spawned on the lens side between the camera and the animal it named.
 */
export const POV_FOCUS_SPECIES: Record<PovPresetId, keyof typeof IN_GAME_BODY_LENGTH_METRES> = {
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
 * Where a preset stands, as a bearing around the ranch in radians, measured
 * from +X towards +Z — the same convention the dressing ring places props in,
 * so the layout tests can hold the two against each other. The bow of the lens
 * used to be hand-authored as three unrelated coordinates; since the trio now
 * fills a much bigger circle, the bearing is what keeps the three views apart
 * (FR-8).
 */
export const POV_BEARING_RADIANS: Record<PovPresetId, number> = {
  // Bearings are degrees around the ranch in the dressing ring's convention.
  ranch: 1.0123, // 58 deg: the boot view, lit from the sun at (+3, +5, +2).
  nest: 2.471, // 141.6 deg: the nest stones sit 18 deg along the rim.
  garden: 4.1888, // 240 deg: stands off the corn, looking back at its dino.
};

/**
 * How far out a preset stands, in body lengths. Far enough that the biggest
 * animal still fits the 40 deg lens, close enough that a 3.7 m hatchling is
 * not a speck. Three distances rather than one keep the trio visually
 * different from view to view.
 */
const POV_DISTANCES_IN_BODY_LENGTHS: Record<PovPresetId, number> = {
  ranch: 2.4,
  nest: 2.05,
  garden: 2.18,
};

/**
 * Eye height in metres. The ground is flat, so a single height keeps the
 * horizon steady through a cut while still looking down on a 3.7 m animal.
 */
const POV_EYE_HEIGHT_METRES = 4.6;

/**
 * POV preset id -> index into `trioSpawnPositions()` for the animal that
 * preset is named for, derived from the species map so the two cannot drift.
 */
export const POV_FOCUS_SPAWN_INDEX: Record<PovPresetId, number> = {
  ranch: TRIO_SPAWN_SPECIES_ORDER.indexOf(POV_FOCUS_SPECIES.ranch),
  nest: TRIO_SPAWN_SPECIES_ORDER.indexOf(POV_FOCUS_SPECIES.nest),
  garden: TRIO_SPAWN_SPECIES_ORDER.indexOf(POV_FOCUS_SPECIES.garden),
};

/**
 * Cut a preset to a camera position: stand `distance` out on `bearing`, look
 * at the named animal's body centre. Keeping this derivation in one function
 * means the three presets cannot drift out of step with each other, the walk
 * circle, or the body heights when the ranch is resized (AC-7).
 */
function presetFor(id: PovPresetId, label: string, icon: string): PovPreset {
  const bearing = POV_BEARING_RADIANS[id];
  const distance = POV_DISTANCES_IN_BODY_LENGTHS[id] * LARGEST_DINO_BODY_LENGTH_METRES;
  const bodyLength = IN_GAME_BODY_LENGTH_METRES[POV_FOCUS_SPECIES[id]];
  const spawn = trioSpawnPositions()[POV_FOCUS_SPAWN_INDEX[id]];
  return {
    id,
    label,
    icon,
    position: [distance * Math.cos(bearing), POV_EYE_HEIGHT_METRES, distance * Math.sin(bearing)],
    // The middle of the animal it names, not its toes and not the ranch centre.
    lookAt: [spawn.x, bodyLength / 2, spawn.z],
  };
}

/**
 * Fixed camera presets: Ranch looks at the Brachio, Nest at the Trike, Garden
 * at the Stego (FR-8). All three stand outside the walk circle and inside the
 * prop ring, so no prop can sit between a lens and the animal it names, and
 * each lens aims past the other two animals rather than through one of them.
 */
export const POV_PRESETS: Record<PovPresetId, PovPreset> = {
  ranch: presetFor('ranch', 'Ranch', '🏠'),
  nest: presetFor('nest', 'Nest', '🪹'),
  garden: presetFor('garden', 'Garden', '🌼'),
};

/** Look up a fixed camera preset by id. */
export function povPresetById(id: PovPresetId): PovPreset {
  return POV_PRESETS[id];
}

/**
 * Cut the camera to a preset instantly (no tween): set the position and
 * look at the target in the same frame, so the switch lands under 200 ms
 * (AC-1) and never leaves a tween to interrupt (FR-7).
 */
export function applyPovPreset(camera: THREE.PerspectiveCamera, id: PovPresetId): void {
  const preset = povPresetById(id);
  camera.position.set(preset.position[0], preset.position[1], preset.position[2]);
  camera.lookAt(preset.lookAt[0], preset.lookAt[1], preset.lookAt[2]);
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
