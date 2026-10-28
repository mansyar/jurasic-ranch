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
 * Gait is forced to TRIKE_GAIT (review F6): the constructor does not accept
 * a gait option, so callers cannot silently have one dropped.
 */
export class TrikePlayer extends DinoPlayer {
  constructor(model: THREE.Object3D, options: TrikePlayerOptions) {
    super(model, { ...options, gait: TRIKE_GAIT });
  }
}

/** Stay-in-frame wander radius around the spawn point (origin) in metres. */
export const WANDER_RADIUS_METRES = TRIKE_GAIT.wanderRadiusMetres;

export { BlinkController, findBlinkTargets, TRIKE_GAIT, WANDER_STEER_JITTER_RADIANS };
export type { BlinkTargets };
/** TrikePlayer options: DinoPlayer options without gait (forced to TRIKE_GAIT). */
export type TrikePlayerOptions = Omit<DinoPlayerOptions, "gait">;
