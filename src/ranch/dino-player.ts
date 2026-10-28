import * as THREE from "three";
import { DustPool } from "./dust.js";
import {
  BLINK_CLOSE_SECONDS,
  createWaddlePose,
  displacementMetresWithGait,
  type GaitParams,
  loopPhaseWithGait,
  nextBlinkDelaySeconds,
  plantsCrossed,
  puffCountForPlant,
  squashScaleY,
  TURN_ALIGN_RADIANS,
  updateWaddlePoseWithGait,
  wrapAngle,
  type WaddlePose,
} from "./waddle.js";

/**
 * Generic dino playback controller (FR-1: gait configs, FR-5 turn-then-walk,
 * FR-6 blink, FR-7 squash + dust, FR-8 silent: this module never touches
 * audio). Owns the AnimationMixer for the baked `Waddle` clip and drives a
 * loaded model root plus its dust.
 *
 * Blink approach: the shipped skeleton has no eyelid bones and the baked GLB
 * holds a single mesh / single material, so there are no separate eye meshes
 * to scale. findBlinkTargets still detects meshes named *eye* when a future
 * export has them; otherwise blink renders as a subtle head-dip micro-motion.
 * No geometry is invented either way.
 */

export interface BlinkTargets {
  eyes: THREE.Object3D[];
  head: THREE.Object3D | null;
}

/** Collect blink targets by node name: *eye* meshes, else the *head* bone. */
export function findBlinkTargets(root: THREE.Object3D): BlinkTargets {
  const eyes: THREE.Object3D[] = [];
  let head: THREE.Object3D | null = null;
  root.traverse((child: THREE.Object3D) => {
    if (/eye/i.test(child.name)) {
      eyes.push(child);
    }
    if (head === null && /head/i.test(child.name)) {
      head = child;
    }
  });
  return { eyes, head };
}

/** 3..5 s blink scheduler; scales eye meshes or dips the head bone. */
export class BlinkController {
  private nextBlinkAt: number;
  private blinkStartedAt = -1;
  private random: () => number;
  private eyeBaseScaleY = new Map<THREE.Object3D, number>();
  private headNode: THREE.Object3D | null = null;
  private headBaseRotationX = 0;

  constructor(random: () => number = Math.random, startAtSeconds = 0) {
    this.random = random;
    this.nextBlinkAt = startAtSeconds + nextBlinkDelaySeconds(random());
  }

  /** Advance the blink timer; returns true while a blink is visible. */
  update(nowSeconds: number, targets: BlinkTargets): boolean {
    if (this.blinkStartedAt < 0 && nowSeconds >= this.nextBlinkAt) {
      this.blinkStartedAt = nowSeconds;
    }
    if (this.blinkStartedAt < 0) {
      return false;
    }
    const progress = (nowSeconds - this.blinkStartedAt) / BLINK_CLOSE_SECONDS;
    if (progress >= 1) {
      this.restore(targets);
      this.blinkStartedAt = -1;
      this.nextBlinkAt = nowSeconds + nextBlinkDelaySeconds(this.random());
      return false;
    }
    const lid = Math.sin(Math.PI * Math.max(progress, 0));
    if (targets.eyes.length > 0) {
      for (const eye of targets.eyes) {
        const stored = this.eyeBaseScaleY.get(eye);
        const base = stored === undefined ? eye.scale.y : stored;
        if (stored === undefined) {
          this.eyeBaseScaleY.set(eye, base);
        }
        eye.scale.y = base * (1 - 0.9 * lid);
      }
    } else if (targets.head !== null) {
      if (this.headNode !== targets.head) {
        this.headNode = targets.head;
        this.headBaseRotationX = targets.head.rotation.x;
      }
      targets.head.rotation.x = this.headBaseRotationX + 0.07 * lid;
    }
    return true;
  }

  private restore(targets: BlinkTargets): void {
    for (const [eye, base] of this.eyeBaseScaleY) {
      eye.scale.y = base;
    }
    if (targets.head !== null && this.headNode === targets.head) {
      targets.head.rotation.x = this.headBaseRotationX;
    }
  }
}

/**
 * Shipped Trike gait (FR-2): 0.29 m stride per 0.8 s loop (~0.4 m/s), PI yaw
 * cap, 4.5 rad/m stroller curvature, 0.8 m stay-in-frame wander circle. Values
 * match the waddle math constants so Trike behaviour is bit-identical.
 */
export const TRIKE_GAIT: GaitParams = {
  strideMetres: 0.29,
  loopSeconds: 0.8,
  turnRateRadiansPerSecond: Math.PI,
  curvatureRadiansPerMetre: 4.5,
  wanderRadiusMetres: 0.8,
};

/**
 * Shipped Stego gait (FR-4 / AC-2): same 0.29 m stride per 0.8 s loop as the
 * Trike (the bake measured 0.291 m, no retime), PI yaw cap, 0.8 m wander
 * circle — but a hotter 20 rad/m curvature. The Stego's 90-degree turn must
 * finish under 0.6 s (TURN_90_MAX_SECONDS): at full blend the yaw rate caps at
 * PI (20 x 0.3625 m/s = 7.25 > PI), so the quarter turn takes 0.5 s, then the
 * player walks straight. Heading steps clamp to the remaining angle, so the
 * hot curvature settles exactly instead of orbiting the target.
 */
export const STEGO_GAIT: GaitParams = {
  strideMetres: 0.29,
  loopSeconds: 0.8,
  turnRateRadiansPerSecond: Math.PI,
  curvatureRadiansPerMetre: 20,
  wanderRadiusMetres: 0.8,
};

export interface DinoPlayerOptions {
  /** Baked `Waddle` clip (0.8 s loop for Trike). */
  clip: THREE.AnimationClip;
  texture?: THREE.Texture;
  random?: () => number;
  /** Gait tuning; defaults to the Trike gait. */
  gait?: GaitParams;
  /**
   * Shared particle pool (FR-9): when provided, this player puffs into the
   * given pool instead of allocating a private one, so two players share a
   * single draw call. Defaults to a private pool; existing call sites that
   * omit it behave exactly as before.
   */
  dust?: DustPool;
}

/** Random steering spread (radians) when turning back toward the center. */
export const WANDER_STEER_JITTER_RADIANS = 0.6;

/**
 * Mixer + root-motion player. Heading bends into slow stroller arcs while the
 * dino keeps walking (no in-place spin), walk weight eases over ~0.2 s, and
 * below the stop blend deadband the heading freezes so the model settles to
 * a true halt. Dust + squash fire on foot plants, and the model faces +Z at
 * heading 0. The model is expected at scene root, feet y=0.
 */
export class DinoPlayer {
  readonly dust: DustPool;
  private model: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private action: THREE.AnimationAction;
  private pose: WaddlePose;
  private blink: BlinkController;
  private targets: BlinkTargets;
  private gait: GaitParams;
  private loopTime = 0;
  private prevPhase = 0;
  private baseScale: THREE.Vector3;
  private random: () => number;
  /** Scratch heading vector reused every frame: turn math never allocates. */
  private readonly forwardTemp = new THREE.Vector3();
  /** Scratch ground point reused for every dust puff: no per-plant vector. */
  private readonly footTemp = new THREE.Vector3();

  constructor(model: THREE.Object3D, options: DinoPlayerOptions) {
    this.model = model;
    this.random = options.random ?? Math.random;
    this.gait = options.gait ?? TRIKE_GAIT;
    this.mixer = new THREE.AnimationMixer(model);
    this.action = this.mixer.clipAction(options.clip);
    this.action.setLoop(THREE.LoopRepeat, Infinity);
    this.action.weight = 0;
    this.action.play();
    this.pose = createWaddlePose();
    this.blink = new BlinkController(this.random);
    this.targets = findBlinkTargets(model);
    this.baseScale = model.scale.clone();
    this.dust = options.dust ?? new DustPool({ texture: options.texture, random: this.random });
  }

  get walking(): boolean {
    return this.pose.moving;
  }

  get heading(): number {
    return this.pose.heading;
  }

  /**
   * Head bone driving the head-dip blink; blush cheeks pin here too. Null
   * when the loaded model has no Head node.
   */
  get head(): THREE.Object3D | null {
    return this.targets.head;
  }

  get clipDurationSeconds(): number {
    return this.action.getClip().duration;
  }

  setWalking(walking: boolean): void {
    this.pose.moving = walking;
  }

  /** Walk-button toggle; returns the new walk state. */
  toggleWalk(): boolean {
    this.pose.moving = !this.pose.moving;
    return this.pose.moving;
  }

  /** Bend toward the given heading in a walk arc (radians, +Z = 0). */
  turnTo(radians: number): void {
    this.pose.targetHeading = radians;
  }

  /** Write the unit facing vector for the current heading into `out`. */
  private forwardTo(out: THREE.Vector3): THREE.Vector3 {
    return out.set(Math.sin(this.pose.heading), 0, Math.cos(this.pose.heading));
  }

  /** Write the front-ground dust emission point into `out` (no alloc). */
  private footPositionTo(out: THREE.Vector3): THREE.Vector3 {
    this.forwardTo(this.forwardTemp);
    return out.set(
      this.model.position.x + this.forwardTemp.x * 0.35,
      0.03,
      this.model.position.z + this.forwardTemp.z * 0.35,
    );
  }

  /**
   * Stay-in-frame wander: once the model leaves the gait wander radius,
   * retarget the heading back toward the center with a small random offset.
   * The pose controller bends toward it in a walk arc, so translation never
   * pauses while steering. Only steers while walking (Stop still halts) and
   * never overrides a turn already in progress.
   */
  private steerInsideWanderRadius(): void {
    if (!this.pose.moving) {
      return;
    }
    const x = this.model.position.x;
    const z = this.model.position.z;
    if (Math.hypot(x, z) <= this.gait.wanderRadiusMetres) {
      return;
    }
    const remaining = Math.abs(wrapAngle(this.pose.targetHeading - this.pose.heading));
    if (remaining >= TURN_ALIGN_RADIANS) {
      return;
    }
    const toCenter = Math.atan2(-x, -z);
    const jitter = (this.random() - 0.5) * WANDER_STEER_JITTER_RADIANS;
    this.pose.targetHeading = wrapAngle(toCenter + jitter);
  }

  /** Advance mixer, root motion, squash, dust, and blink. */
  update(dtSeconds: number, nowSeconds: number): void {
    const step = Math.min(Math.max(dtSeconds, 0), 0.25);
    updateWaddlePoseWithGait(this.pose, step, this.gait);
    this.action.weight = this.pose.blend;
    const striding = this.pose.blend > 0.5;
    if (striding) {
      // Legs and plant phase advance together so dust/squash stay in sync
      // with the visible gait across walk stop/start cycles.
      this.mixer.update(step);
      this.loopTime += step;
      const phase = loopPhaseWithGait(this.loopTime, this.gait);
      const crossed = plantsCrossed(this.prevPhase, phase);
      if (crossed > 0) {
        this.footPositionTo(this.footTemp);
        for (let c = 0; c < crossed; c += 1) {
          this.dust.puff(this.footTemp, puffCountForPlant(this.random()));
        }
      }
      this.prevPhase = phase;
    }
    const distance = displacementMetresWithGait(this.pose, step, this.gait);
    this.forwardTo(this.forwardTemp);
    this.model.position.x += this.forwardTemp.x * distance;
    this.model.position.z += this.forwardTemp.z * distance;
    this.steerInsideWanderRadius();
    this.model.rotation.y = this.pose.heading;
    const squash = squashScaleY(loopPhaseWithGait(this.loopTime, this.gait));
    this.model.scale.set(
      this.baseScale.x,
      this.baseScale.y * (1 - (1 - squash) * this.pose.blend),
      this.baseScale.z,
    );
    this.dust.update(step);
    this.blink.update(nowSeconds, this.targets);
  }
}
