import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildStegoClips,
  createStegoVariantGroup,
} from '../../scripts/vendor/bake-stego-variant.js';
import { DinoPlayer, STEGO_GAIT } from '../../src/ranch/dino-player.js';
import { TURN_ALIGN_RADIANS, wrapAngle } from '../../src/ranch/waddle.js';

/**
 * Stego walk (FR-1, AC-1, AC-2). The shipped clip is Polyfork's own authored
 * `Walk` — 2.4 s, 48 channels, no donor retarget — so this harness measures the
 * clip instead of tuning one. The walking speed is DERIVED from the clip: the
 * speed at which a planted foot stops travelling in world space. That is why no
 * stride constant appears here; Phase 4 re-points `STEGO_GAIT` at the measured
 * numbers (this build measures ~0.73 m/s, so a 2.4 s loop strides ~1.75 m).
 */

const DT = 1 / 60;
/** Shipped Stego GLB: the authored clip driving the player below. */
const SHIPPED_GLB = new URL('../../public/models/stego.glb', import.meta.url);
const FEET = ['LeftFrontFoot', 'RightFrontFoot', 'LeftHindFoot', 'RightHindFoot'] as const;
const SAMPLES = 121;
/** Height above a foot's lowest sample that still counts as ground contact. */
const CONTACT_METRES = 0.01;
/** Stance samples trimmed from each end of a run before rating slide speed. */
const TRANSIENT_TRIM = 3;
/** Authored cadence (AC-1). */
const CYCLE_SECONDS = 2.4;
/** The four feet must agree on the clip's own walking speed within this ratio. */
const FOOT_SPEED_SPREAD_RATIO = 0.02;
/** Max world-space drift of one planted foot during a single stance. */
const STANCE_EXCURSION_METRES = 0.06;
/** Max sustained slide speed inside the stance core (transients trimmed). */
const STANCE_SUSTAINED_PEAK_SLIDE_METRES_PER_SECOND = 0.4;
const STANCE_CORE_MEAN_SLIDE_METRES_PER_SECOND = 0.1;

interface FootSample {
  t: number;
  y: number;
  z: number;
}

interface FootReport {
  minY: number;
  lift: number;
  travel: number;
  duty: number;
  stanceRun: number;
  /** Speed at which this foot's planted stance stops sliding, in m/s. */
  footSpeed: number;
  excursion: number;
  corePeakSlide: number;
  coreMeanSlide: number;
}

interface StegoWalkMeasurement {
  duration: number;
  reports: Record<string, FootReport>;
  /** Mean of the four feet's own speeds: the clip's walking speed. */
  walkSpeed: number;
  /** Walk speed x cycle length: the ground one loop covers. */
  strideMetres: number;
}

interface StegoWalkResult extends StegoWalkMeasurement {
  group: THREE.Group;
  clip: THREE.AnimationClip;
}

/** Play the shipped `Walk` clip once, sampling every foot at 121 instants. */
async function measureStegoWalk(): Promise<StegoWalkResult> {
  const bytes = await readFile(SHIPPED_GLB);
  const group = createStegoVariantGroup();
  const clip = buildStegoClips(group, bytes).find((entry) => entry.name === 'Walk');
  if (clip === undefined) {
    throw new Error('shipped stego.glb carries no "Walk" clip');
  }
  const mixer = new THREE.AnimationMixer(group);
  mixer.clipAction(clip).play();
  const series = new Map<string, FootSample[]>();
  for (const foot of FEET) {
    series.set(foot, []);
  }
  const scratch = new THREE.Vector3();
  for (let i = 0; i < SAMPLES; i += 1) {
    const t = (i / (SAMPLES - 1)) * clip.duration;
    mixer.setTime(t);
    group.updateMatrixWorld(true);
    for (const foot of FEET) {
      const bone = group.getObjectByName(foot);
      if (bone === undefined) {
        throw new Error(`stego variant skeleton is missing bone "${foot}"`);
      }
      bone.getWorldPosition(scratch);
      series.get(foot)?.push({ t, y: scratch.y, z: scratch.z });
    }
  }
  const step = clip.duration / (SAMPLES - 1);
  const reports: Record<string, FootReport> = {};
  for (const foot of FEET) {
    const points = series.get(foot) ?? [];
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const point of points) {
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    }
    const contact = points.map((point) => point.y <= minY + CONTACT_METRES);
    const duty = contact.filter(Boolean).length / points.length;
    // Start mid-stance: skip forward past the first swing run so the measured
    // run never straddles the array wraparound.
    const swingIndex = contact.findIndex((value) => !value);
    let start = 0;
    if (swingIndex >= 0) {
      start = swingIndex;
      while (!contact[start % points.length]) {
        start += 1;
      }
      start %= points.length;
    }
    let runLength = 0;
    while (runLength < points.length && contact[(start + runLength) % points.length]) {
      runLength += 1;
    }
    // The clip is in place, so a planted foot sliding backwards at speed v in
    // body space means the body walks forward at v. Solve v from the stance
    // run's own displacement: that is the clip's speed, not an assumption.
    const stanceSeconds = (runLength - 1) * step;
    const stanceTravel = points[(start + runLength - 1) % points.length].z - points[start].z;
    const footSpeed = -stanceTravel / stanceSeconds;
    // Replay root motion on unwrapped time: the stance run may straddle the
    // loop boundary, where wrapped sample time would inject a speed*loop
    // discontinuity into world space.
    const t0 = points[start].t;
    const worldAt = (k: number): number => {
      const i = (start + k) % points.length;
      return points[i].z + footSpeed * (t0 + k * step);
    };
    let runMin = Infinity;
    let runMax = -Infinity;
    let windowPeak = 0;
    let coreSum = 0;
    let coreCount = 0;
    for (let k = 0; k < runLength; k += 1) {
      const w = worldAt(k);
      runMin = Math.min(runMin, w);
      runMax = Math.max(runMax, w);
      if (k >= TRANSIENT_TRIM && k + 1 < runLength - TRANSIENT_TRIM) {
        coreSum += Math.abs(worldAt(k + 1) - w) / step;
        coreCount += 1;
      }
    }
    for (let k = TRANSIENT_TRIM + 2; k + 2 < runLength - TRANSIENT_TRIM; k += 1) {
      let crosses = false;
      for (let m = k - 2; m <= k + 2; m += 1) {
        if ((start + m) % points.length === 0) {
          crosses = true;
          break;
        }
      }
      if (crosses) {
        continue; // Loop-boundary window: clip closure gap, not foot slide.
      }
      windowPeak = Math.max(windowPeak, Math.abs(worldAt(k + 2) - worldAt(k - 2)) / (4 * step));
    }
    reports[foot] = {
      minY,
      lift: maxY - minY,
      travel: maxZ - minZ,
      duty,
      stanceRun: runLength,
      footSpeed,
      excursion: runMax - runMin,
      corePeakSlide: windowPeak,
      coreMeanSlide: coreCount > 0 ? coreSum / coreCount : 0,
    };
  }
  const walkSpeed = FEET.reduce((total, foot) => total + reports[foot].footSpeed, 0) / FEET.length;
  return {
    group,
    clip,
    duration: clip.duration,
    reports,
    walkSpeed,
    strideMetres: walkSpeed * clip.duration,
  };
}

async function createStegoPlayer(): Promise<{ player: DinoPlayer; group: THREE.Group }> {
  // Drive the player from the shipped GLB's own clip (animation samplers are
  // never Draco-compressed, so the raw bytes parse headless): this is the
  // exact clip the viewer loads through three's bundled Draco decoder.
  const measurement = await measureStegoWalk();
  const { group, clip } = measurement;
  const player = new DinoPlayer(group, { clip, gait: STEGO_GAIT, random: () => 0.5 });
  return { player, group };
}

describe('stego gait config (FR-1, AC-2)', () => {
  it('ships the Stego tuning: 0.8 s loop, PI turn, tight curve, 0.8 m wander', () => {
    expect(STEGO_GAIT.loopSeconds).toBe(0.8);
    expect(STEGO_GAIT.turnRateRadiansPerSecond).toBe(Math.PI);
    expect(STEGO_GAIT.curvatureRadiansPerMetre).toBe(20);
    expect(STEGO_GAIT.wanderRadiusMetres).toBe(0.8);
  });

  it('turns a commanded 90 deg inside 0.6 s, then walks straight', async () => {
    const { player, group } = await createStegoPlayer();
    player.setWalking(true);
    player.turnTo(Math.PI / 2);
    let elapsed = 0;
    while (
      elapsed < 0.6 &&
      Math.abs(wrapAngle(player.heading - Math.PI / 2)) >= TURN_ALIGN_RADIANS
    ) {
      player.update(DT, elapsed);
      elapsed += DT;
    }
    expect(Math.abs(wrapAngle(player.heading - Math.PI / 2))).toBeLessThan(TURN_ALIGN_RADIANS);
    expect(elapsed).toBeLessThan(0.6);
    const before = group.position.clone();
    for (let i = 0; i < 48; i += 1) {
      player.update(DT, elapsed);
      elapsed += DT;
    }
    expect(Math.abs(wrapAngle(player.heading - Math.PI / 2))).toBeLessThan(TURN_ALIGN_RADIANS);
    expect(group.position.distanceTo(before)).toBeGreaterThan(0.05);
  });
});

describe('stego authored walk (FR-1, AC-1)', () => {
  it('ships the authored 2.4 s Walk with four feet striding evenly', async () => {
    const { duration, reports, strideMetres } = await measureStegoWalk();
    expect(duration).toBeCloseTo(CYCLE_SECONDS, 3);
    const travels = FEET.map((foot) => reports[foot].travel);
    const mean = travels.reduce((a, b) => a + b, 0) / travels.length;
    // The clip really strides (a metre-class step at authored size) and the
    // four legs agree on it, so no leg is dragging.
    expect(mean).toBeGreaterThan(0.8);
    for (const foot of FEET) {
      expect(Math.abs(reports[foot].travel - mean)).toBeLessThanOrEqual(0.02);
    }
    expect(strideMetres).toBeGreaterThan(1.2);
  });

  it('keeps a walking duty cycle with real ground clearance', async () => {
    const { reports } = await measureStegoWalk();
    for (const foot of FEET) {
      expect(reports[foot].duty).toBeGreaterThanOrEqual(0.5);
      expect(reports[foot].duty).toBeLessThanOrEqual(0.9);
      expect(reports[foot].lift).toBeGreaterThanOrEqual(0.03);
      expect(reports[foot].minY).toBeLessThan(0.25);
    }
  });
});

describe('stego foot plant (AC-2, no skate)', () => {
  it('agrees on one walking speed across all four feet', async () => {
    const { reports, walkSpeed } = await measureStegoWalk();
    expect(walkSpeed).toBeGreaterThan(0.2);
    for (const foot of FEET) {
      const ratio = reports[foot].footSpeed / walkSpeed;
      expect(Math.abs(ratio - 1)).toBeLessThanOrEqual(FOOT_SPEED_SPREAD_RATIO);
    }
  });

  it('holds planted feet still when root motion runs at that speed', async () => {
    const { reports } = await measureStegoWalk();
    for (const foot of FEET) {
      expect(reports[foot].excursion).toBeLessThanOrEqual(STANCE_EXCURSION_METRES);
      expect(reports[foot].corePeakSlide).toBeLessThanOrEqual(
        STANCE_SUSTAINED_PEAK_SLIDE_METRES_PER_SECOND,
      );
      expect(reports[foot].coreMeanSlide).toBeLessThanOrEqual(
        STANCE_CORE_MEAN_SLIDE_METRES_PER_SECOND,
      );
    }
  });
});
