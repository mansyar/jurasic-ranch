import * as THREE from "three";
import { DustPool } from "./dust.js";
import {
  BLINK_CLOSE_SECONDS,
  createWaddlePose,
  displacementMetres,
  loopPhase,
  nextBlinkDelaySeconds,
  plantsCrossed,
  puffCountForPlant,
  squashScaleY,
  updateWaddlePose,
  type WaddlePose,
} from "./waddle.js";

/**
 * Trike playback controller (FR-5 turn-then-walk, FR-6 blink, FR-7 squash +
 * dust, FR-8 silent: this module never touches audio). Owns the AnimationMixer
 * for the baked `Waddle` clip and drives a loaded model root plus its dust.
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

export interface TrikePlayerOptions {
  /** Baked `Waddle` clip (0.8 s loop). */
  clip: THREE.AnimationClip;
  texture?: THREE.Texture;
  random?: () => number;
}

/**
 * Mixer + root-motion player. Turn-in-place completes before translation,
 * walk weight eases over ~0.2 s, dust + squash fire on foot plants, and the
 * model faces +Z at heading 0. The model is expected at scene root, feet y=0.
 */
export class TrikePlayer {
  readonly dust: DustPool;
  private model: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private action: THREE.AnimationAction;
  private pose: WaddlePose;
  private blink: BlinkController;
  private targets: BlinkTargets;
  private loopTime = 0;
  private prevPhase = 0;
  private baseScale: THREE.Vector3;
  private random: () => number;

  constructor(model: THREE.Object3D, options: TrikePlayerOptions) {
    this.model = model;
    this.random = options.random ?? Math.random;
    this.mixer = new THREE.AnimationMixer(model);
    this.action = this.mixer.clipAction(options.clip);
    this.action.setLoop(THREE.LoopRepeat, Infinity);
    this.action.weight = 0;
    this.action.play();
    this.pose = createWaddlePose();
    this.blink = new BlinkController(this.random);
    this.targets = findBlinkTargets(model);
    this.baseScale = model.scale.clone();
    this.dust = new DustPool({ texture: options.texture, random: this.random });
  }

  get walking(): boolean {
    return this.pose.moving;
  }

  get heading(): number {
    return this.pose.heading;
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

  /** Queue a turn-in-place to the given heading (radians, +Z = 0). */
  turnTo(radians: number): void {
    this.pose.targetHeading = radians;
  }

  private forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.pose.heading), 0, Math.cos(this.pose.heading));
  }

  private footPosition(): THREE.Vector3 {
    const dir = this.forward();
    return new THREE.Vector3(
      this.model.position.x + dir.x * 0.35,
      0.03,
      this.model.position.z + dir.z * 0.35,
    );
  }

  /** Advance mixer, root motion, squash, dust, and blink. */
  update(dtSeconds: number, nowSeconds: number): void {
    const step = Math.min(Math.max(dtSeconds, 0), 0.25);
    updateWaddlePose(this.pose, step);
    this.action.weight = this.pose.blend;
    const striding = this.pose.blend > 0.5;
    if (striding) {
      // Legs and plant phase advance together so dust/squash stay in sync
      // with the visible gait across walk stop/start cycles.
      this.mixer.update(step);
      this.loopTime += step;
      const phase = loopPhase(this.loopTime);
      const crossed = plantsCrossed(this.prevPhase, phase);
      for (let c = 0; c < crossed; c += 1) {
        this.dust.puff(this.footPosition(), puffCountForPlant(this.random()));
      }
      this.prevPhase = phase;
    }
    const distance = displacementMetres(this.pose, step);
    const dir = this.forward();
    this.model.position.x += dir.x * distance;
    this.model.position.z += dir.z * distance;
    this.model.rotation.y = this.pose.heading;
    const squash = squashScaleY(loopPhase(this.loopTime));
    this.model.scale.set(
      this.baseScale.x,
      this.baseScale.y * (1 - (1 - squash) * this.pose.blend),
      this.baseScale.z,
    );
    this.dust.update(step);
    this.blink.update(nowSeconds, this.targets);
  }
}
