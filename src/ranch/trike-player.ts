import type * as THREE from "three";
import {
  BlinkController,
  DinoPlayer,
  type DinoPlayerOptions,
  findBlinkTargets,
  TRIKE_GAIT,
  WANDER_STEER_JITTER_RADIANS,
  type BlinkTargets,
} from "./dino-player.js";

/**
 * Thin Trike alias over DinoPlayer (FR-10, AC-7): no behaviour lives here.
 * New code imports DinoPlayer from ./dino-player.js directly; this module
 * only keeps existing Trike call sites compiling during the migration.
 */
export class TrikePlayer extends DinoPlayer {
  constructor(model: THREE.Object3D, options: DinoPlayerOptions) {
    super(model, { ...options, gait: TRIKE_GAIT });
  }
}

/** Stay-in-frame wander radius around the spawn point (origin) in metres. */
export const WANDER_RADIUS_METRES = TRIKE_GAIT.wanderRadiusMetres;

export { BlinkController, findBlinkTargets, TRIKE_GAIT, WANDER_STEER_JITTER_RADIANS };
export type { BlinkTargets, DinoPlayerOptions as TrikePlayerOptions };
