import * as THREE from 'three';
import { DustPool } from './dust.js';
import { createSeededStream, cornerPlacements } from './layout.js';
import type { CornerSpecies } from './layout.js';

/**
 * Aliveness (FR-11, FR-12, NFR-7): the quiet sway the corn, the reeds and the
 * ginkgo litter answer the wind with, and the one sparkle a tap on any dressed
 * prop earns.
 *
 * Both halves are decoration, never gameplay: a tap moves no dino, changes no
 * counter, plays no voice line and touches none of the state the kid-facing
 * chrome owns. Both are driven from the frame's own `dt` — the same clamped
 * delta the loop hands its other subsystems — so `?pause=1` freezes them too
 * (NFR-8). The sway is inert under reduced motion; the sparkle may still
 * animate (NFR-7).
 *
 * Pure scene-graph math: no DOM and no renderer, so a Node test can drive the
 * sway with a supplied `dt` and raycast a prop without a browser.
 */

/** Which wind class a file sways in (FR-11). */
export type SwayClass = 'corn' | 'reeds' | 'litter';

/**
 * How hard one class leans, and how long one full wave takes. Amplitudes are
 * small on purpose — this is grass in a breeze, not a flag: 1.4 deg on the
 * 1.81 m corn, 2.2 deg on the 1.89 m reeds, 2.9 deg on the flat litter mat.
 * The cross-axis share is the fraction of the same amplitude the prop leans by
 * on its other ground axis, half as fast, so a stalk traces a lazy ellipse
 * instead of a single hinge.
 */
export interface SwayTuning {
  readonly amplitudeRadians: number;
  readonly periodSeconds: number;
  readonly crossAxis: number;
}

export const SWAY_TUNING: Readonly<Record<SwayClass, SwayTuning>> = {
  corn: { amplitudeRadians: 0.024, periodSeconds: 4.4, crossAxis: 0.6 },
  reeds: { amplitudeRadians: 0.038, periodSeconds: 3.2, crossAxis: 0.75 },
  litter: { amplitudeRadians: 0.05, periodSeconds: 5.6, crossAxis: 0.5 },
};

/**
 * The files FR-11 names, and the class each sways in. Everything else in the
 * manifest is furniture or stone and stands still.
 */
export const SWAY_FILE_CLASSES: Readonly<Record<string, SwayClass>> = {
  'corn-crop-b71f2f.glb': 'corn',
  'river-reed-cluster-cba87e.glb': 'reeds',
  'ginkgo-leaf-litter-9784e9.glb': 'litter',
};

/** Seed used when the viewer boots without a dev seed (NFR-8). */
export const DEFAULT_SWAY_SEED = 1;

/** One swaying prop: which node, its class, and the phase the seed gave it. */
export interface SwayProp {
  readonly node: THREE.Object3D;
  readonly tuning: SwayTuning;
  readonly phaseRadians: number;
}

/**
 * The sway driver (FR-11): every corn stalk, reed cluster and litter patch
 * leans on its own sine, and the phase comes from the seeded stream the layout
 * already scatters with — so `?seed=42` replays the same ripple, and two
 * neighbouring clumps never lean in lockstep.
 *
 * Only `rotation.x` and `rotation.z` are written; `rotation.y` stays the
 * authored facing, and the models are ground-origin, so each prop hinges about
 * the point it stands on rather than about its middle.
 */
export class AmbientSway {
  /** Every prop this driver owns, in manifest order. */
  readonly props: readonly SwayProp[] = [];
  private elapsedSeconds = 0;
  private leaning = false;

  constructor(group: THREE.Object3D, seed: number = DEFAULT_SWAY_SEED) {
    const random = createSeededStream(seed);
    const props: SwayProp[] = [];
    for (const child of group.children) {
      const file = child.userData['file'];
      const swayClass = typeof file === 'string' ? SWAY_FILE_CLASSES[file] : undefined;
      const tuning = swayClass === undefined ? undefined : SWAY_TUNING[swayClass];
      if (tuning === undefined) {
        continue;
      }
      props.push({ node: child, tuning, phaseRadians: random() * Math.PI * 2 });
    }
    this.props = props;
  }

  /** How many props the driver found — 10 with the shipped manifest. */
  get swayedProps(): number {
    return this.props.length;
  }

  /** Seconds of un-paused wind this driver has played, for the dev HUD. */
  get elapsed(): number {
    return this.elapsedSeconds;
  }

  /**
   * Advance the wind by one frame. A reduced-motion frame — or a live flip of
   * the media query — settles every prop back upright and freezes the clock, so
   * the ranch is stock still rather than frozen mid-lean.
   */
  update(dtSeconds: number, reducedMotion: boolean): void {
    if (reducedMotion) {
      this.settle();
      return;
    }
    if (!(dtSeconds > 0) || this.props.length === 0) {
      return;
    }
    this.elapsedSeconds += dtSeconds;
    for (const { node, tuning, phaseRadians } of this.props) {
      const angle = (Math.PI * 2 * this.elapsedSeconds) / tuning.periodSeconds + phaseRadians;
      node.rotation.x = tuning.amplitudeRadians * Math.sin(angle);
      node.rotation.z = tuning.amplitudeRadians * tuning.crossAxis * Math.cos(angle / 2);
    }
    this.leaning = true;
  }

  /** Whether any prop is currently off vertical. */
  get isLeaning(): boolean {
    return this.leaning;
  }

  private settle(): void {
    if (!this.leaning) {
      return;
    }
    for (const { node } of this.props) {
      node.rotation.x = 0;
      node.rotation.z = 0;
    }
    this.leaning = false;
  }
}

/** FR-12: one tap earns this many particles, and then nothing until it cools. */
export const SPARKLE_BURST_PARTICLES = 8;

/** FR-12: the per-prop cooldown, in milliseconds. */
export const SPARKLE_COOLDOWN_MS = 250;

/** How wide one sparkle sprite reads, in metres of world space. */
export const SPARKLE_POINT_SIZE_METRES = 0.3;

/** Warm white, so a sparkle reads as a glint rather than as dust. */
const SPARKLE_HEX = 0xfff1c4;
const SPARKLE_OPACITY = 0.95;

/**
 * Procedural four-point star baked into a DataTexture: no canvas, no DOM and no
 * image file, exactly as the dust sprite is made (NFR-3).
 */
export function createSparkleTexture(size = 64): THREE.Texture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = Math.abs((x + 0.5) / size - 0.5) * 2;
      const dy = Math.abs((y + 0.5) / size - 0.5) * 2;
      const core = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2);
      const points = Math.max(0, 1 - Math.min(dx * 6, dy * 6));
      const falloff = Math.min(1, core * core + points * 0.55);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 241;
      data[i + 2] = 196;
      data[i + 3] = Math.round(falloff * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

/**
 * What the guards know about the pointer when a tap lands (FR-12, AC-9).
 *
 * Review F8: this carried a `hudOwnsPointer` flag as well, which could never be
 * true — the listener sits on the canvas, so a tap on the HUD never reaches it
 * and `event.target` is the canvas every time. The DOM check is the browser's
 * now; the only guard left is the sleepy one.
 */
export interface TapGuards {
  /** The sleepy overlay is up, or the trio has already nodded off. */
  readonly sleepy: boolean;
}

/**
 * FR-12's edge case, as one predicate: a tap during the sleepy overlay makes no
 * sparkle and no chime, so the raycast only ever runs once this says yes.
 */
export function allowsPropTap(guards: TapGuards): boolean {
  return !guards.sleepy;
}

/** A tap that found a prop: which prop, and where on it the ray landed. */
export interface PropHit {
  prop: THREE.Object3D;
  point: THREE.Vector3;
}

/** Scratch raycaster, so a pointer event allocates nothing it does not need. */
const TAP_RAYCASTER = new THREE.Raycaster();

/**
 * The prop a pointer is over, or null (FR-12). Only the children of `root` —
 * the `RanchDressing` group — are ever tested, so a tap can never hit a dino,
 * the ground or the water line; the hit is walked back up to the manifest entry
 * that owns it, which is what the cooldown is keyed on.
 */
export function propUnderPointer(
  root: THREE.Object3D,
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  raycaster: THREE.Raycaster = TAP_RAYCASTER,
): PropHit | null {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(root.children, true)[0];
  if (hit === undefined) {
    return null;
  }
  let prop = hit.object;
  while (prop.parent !== null && prop.parent !== root) {
    prop = prop.parent;
  }
  return { prop, point: hit.point.clone() };
}

/** The corners, in the fixed order every lookup walks them. */
const CORNER_SPECIES_ORDER: readonly CornerSpecies[] = ['trike', 'stego', 'brachio'];

/**
 * The corner a tapped prop belongs to, or null (FR-8): a tap on any prop of a
 * corner calls that corner's animal, so the hay bale *and* the berry bush call
 * the Trike.
 *
 * The match is on the manifest entry's `file` plus its exact ground position,
 * never on a distance. That is sound because the two are the same numbers: the
 * dressing builder copies `placement.position` straight onto the node, so the
 * values are identical bit for bit, and a tolerance here would only invite two
 * neighbouring props to be confused for one another.
 */
export function cornerUnderProp(prop: THREE.Object3D): CornerSpecies | null {
  const file = prop.userData['file'];
  if (typeof file !== 'string') {
    return null;
  }
  for (const species of CORNER_SPECIES_ORDER) {
    for (const placement of cornerPlacements(species)) {
      if (
        placement.file === file &&
        placement.position[0] === prop.position.x &&
        placement.position[2] === prop.position.z
      ) {
        return species;
      }
    }
  }
  return null;
}

/** How long a corner refuses a second call, in milliseconds (FR-8). */
export const CALL_COOLDOWN_MS = 2_000;

/**
 * FR-8's per-corner cooldown: a corner that was just called cannot be called
 * again until it cools, so a mash of taps cannot thrash the state machine.
 *
 * It is keyed per corner, not globally: two different corners can be called
 * back to back, because all three animals may be out at once (FR-9). A refused
 * call is not an error — the sparkle still happens, only the journey is not
 * restarted.
 */
export class CallCooldowns {
  private readonly lastCallAtMs = new Map<CornerSpecies, number>();

  /** Whether this corner may be called at `nowMs`. */
  allows(species: CornerSpecies, nowMs: number): boolean {
    const last = this.lastCallAtMs.get(species);
    return last === undefined || nowMs - last >= CALL_COOLDOWN_MS;
  }

  /**
   * Note that a call went out, so the corner cools from now. Only a call that
   * was allowed should record, or a refused tap would keep the corner shut.
   */
  record(species: CornerSpecies, nowMs: number): void {
    this.lastCallAtMs.set(species, nowMs);
  }
}

/**
 * FR-12's response: one sparkle burst per prop per 250 ms, drawn from the dust
 * pool's own shape rather than a second particle system — one preallocated
 * `THREE.Points`, a fixed budget, a procedural sprite, no extra render pass.
 * Only the sprite, the size and the additive blend change, so a burst reads as
 * a glint instead of a puff of dirt.
 */
export class SparkleReactions {
  readonly pool: DustPool;
  private readonly lastBurstAtMs = new WeakMap<THREE.Object3D, number>();

  constructor(random: () => number = Math.random) {
    this.pool = new DustPool({ texture: createSparkleTexture(), random });
    this.pool.points.name = 'RanchSparkles';
    this.pool.points.renderOrder = 6;
    const material = this.pool.points.material as THREE.PointsMaterial;
    material.size = SPARKLE_POINT_SIZE_METRES;
    material.opacity = SPARKLE_OPACITY;
    material.color.setHex(SPARKLE_HEX);
    material.blending = THREE.AdditiveBlending;
    material.depthWrite = false;
  }

  /** The single draw call a burst costs, for the scene to add once. */
  get points(): THREE.Points {
    return this.pool.points;
  }

  /** Whether this prop has cooled down at `nowMs` (FR-12). */
  allows(prop: THREE.Object3D, nowMs: number): boolean {
    const last = this.lastBurstAtMs.get(prop);
    return last === undefined || nowMs - last >= SPARKLE_COOLDOWN_MS;
  }

  /**
   * Burst at a prop, unless it is still cooling. Returns whether it fired, so
   * the caller knows a chime is owed.
   */
  react(prop: THREE.Object3D, point: THREE.Vector3, nowMs: number): boolean {
    if (!this.allows(prop, nowMs)) {
      return false;
    }
    this.lastBurstAtMs.set(prop, nowMs);
    this.pool.puff(point, SPARKLE_BURST_PARTICLES);
    return true;
  }

  /** How many sparkles are in the air right now. */
  get aliveCount(): number {
    return this.pool.aliveCount;
  }

  /**
   * Advance the sparkles. Not gated on reduced motion: NFR-7 allows the tap
   * reaction to keep animating; a paused frame (`dt` of 0) still freezes it.
   */
  update(dtSeconds: number): void {
    this.pool.update(dtSeconds);
  }
}
