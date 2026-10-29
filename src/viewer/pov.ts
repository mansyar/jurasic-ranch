import * as THREE from 'three';

/**
 * Fixed cozy viewpoints (FR-1). The camera never orbits or follows: every
 * switch is an instant cut, so all animations stay interruptible (FR-7).
 * Dino wander stays inside the 0.8 m circle, so both babies stay reachable
 * in frame from any preset via the existing wander/avoidance.
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

/** Fixed camera presets. Ranch keeps the legacy fixed camera verbatim. */
export const POV_PRESETS: Record<PovPresetId, PovPreset> = {
  ranch: {
    id: 'ranch',
    label: 'Ranch',
    icon: '🏠',
    position: [2.4, 1.5, 3.0],
    lookAt: [0, 0.45, 0],
  },
  nest: {
    id: 'nest',
    label: 'Nest',
    icon: '🪹',
    position: [-2.3, 1.2, 2.5],
    lookAt: [0, 0.4, 0],
  },
  garden: {
    id: 'garden',
    label: 'Garden',
    icon: '🌼',
    position: [0.3, 1.9, 3.7],
    lookAt: [0, 0.35, 0],
  },
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
