import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { extractAnimationTracks } from '../../scripts/bake-trike-variant.js';
import {
  buildStegoWaddleClip,
  createStegoVariantGroup,
} from '../../scripts/vendor/bake-stego-variant.js';
import { DinoPlayer, STEGO_GAIT } from '../../src/ranch/dino-player.js';
import { TURN_ALIGN_RADIANS, wrapAngle } from '../../src/ranch/waddle.js';

/**
 * Stego gait tuning (FR-4 / AC-2): the baked clip's measured foot travel sets
 * the stride so root motion and feet agree (no skate), and the curvature turns
 * a commanded 90 deg inside the 0.6 s budget before walking straight.
 */

const DT = 1 / 60;
const DONOR_GLB = new URL('../../public/models/trike.glb', import.meta.url);
/** Shipped Stego baby GLB: the clip driving the AC-2 player below. */
const SHIPPED_GLB = new URL('../../public/models/stego.glb', import.meta.url);
const FEET = ['LeftFrontFoot', 'RightFrontFoot', 'LeftHindFoot', 'RightHindFoot'] as const;
const SAMPLES = 121;
/** Height above a foot's lowest sample that still counts as ground contact. */
const CONTACT_METRES = 0.01;
/** The coded stride must match the clip's measured foot travel this closely. */
const STRIDE_TOLERANCE_METRES = 0.02;
/** Max world-space drift of one planted foot during a single stance. */
const STANCE_EXCURSION_METRES = 0.12;
/** Max sustained slide speed inside the stance core (transients trimmed). */
const STANCE_SUSTAINED_PEAK_SLIDE_METRES_PER_SECOND = 0.45;
const STANCE_CORE_MEAN_SLIDE_METRES_PER_SECOND = 0.25;
/** Stance samples trimmed from each end of a run before rating slide speed. */
const TRANSIENT_TRIM = 3;

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
  excursion: number;
  corePeakSlide: number;
  coreMeanSlide: number;
}

/**
 * Sample each foot bone's world position across one clip loop with the body
 * fixed at the origin, then replay root motion at the gait walk speed to
 * measure how planted feet move in world space.
 */
async function measureStegoGait(): Promise<{
  reports: Record<string, FootReport>;
  duration: number;
}> {
  const bytes = await readFile(DONOR_GLB);
  const animation = extractAnimationTracks(bytes);
  const group = createStegoVariantGroup();
  const clip = buildStegoWaddleClip(group, animation);
  const walkSpeed = STEGO_GAIT.strideMetres / STEGO_GAIT.loopSeconds;
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
    const step = clip.duration / (SAMPLES - 1);
    const t0 = points[start].t;
    const worldAt = (k: number): number => {
      const i = (start + k) % points.length;
      return points[i].z + walkSpeed * (t0 + k * step);
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
        const slide = Math.abs(worldAt(k + 1) - w) / step;
        coreSum += slide;
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
        continue;
      }
      const sustained = Math.abs(worldAt(k + 2) - worldAt(k - 2)) / (4 * step);
      windowPeak = Math.max(windowPeak, sustained);
    }
    reports[foot] = {
      minY,
      lift: maxY - minY,
      travel: maxZ - minZ,
      duty,
      excursion: runMax - runMin,
      corePeakSlide: windowPeak,
      coreMeanSlide: coreCount > 0 ? coreSum / coreCount : 0,
    };
  }
  return { reports, duration: clip.duration };
}

async function createStegoPlayer(): Promise<{ player: DinoPlayer; group: THREE.Group }> {
  // Drive the player from the shipped GLB's own clip (animation samplers are
  // never Draco-compressed, so the raw bytes parse headless): this is the
  // exact clip the viewer loads via the /draco/ decoder path.
  const shipped = await readFile(SHIPPED_GLB);
  const animation = extractAnimationTracks(shipped);
  const group = createStegoVariantGroup();
  const clip = buildStegoWaddleClip(group, animation);
  const player = new DinoPlayer(group, { clip, gait: STEGO_GAIT, random: () => 0.5 });
  return { player, group };
}

describe('stego gait config (FR-1, AC-2)', () => {
  it('ships the Stego tuning: measured stride, 0.8 s loop, PI turn, tight curve, 0.8 m wander', () => {
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

describe('stego stride (FR-4, AC-2 no skate)', () => {
  it("matches the coded stride to the clip's measured foot travel", async () => {
    const { reports } = await measureStegoGait();
    const travels = FEET.map((foot) => reports[foot].travel);
    const mean = travels.reduce((a, b) => a + b, 0) / travels.length;
    console.log(
      `stego stride: ${FEET.map((foot) => `${foot}=${reports[foot].travel.toFixed(4)}`).join(' ')} mean=${mean.toFixed(4)} coded=${STEGO_GAIT.strideMetres}`,
    );
    expect(mean).toBeGreaterThan(0.2);
    expect(mean).toBeLessThan(0.4);
    for (const foot of FEET) {
      expect(Math.abs(reports[foot].travel - STEGO_GAIT.strideMetres)).toBeLessThanOrEqual(
        STRIDE_TOLERANCE_METRES,
      );
    }
  });

  it('keeps a walking duty cycle with real ground clearance', async () => {
    const { reports } = await measureStegoGait();
    for (const foot of FEET) {
      expect(reports[foot].duty).toBeGreaterThanOrEqual(0.5);
      expect(reports[foot].duty).toBeLessThanOrEqual(0.85);
      expect(reports[foot].lift).toBeGreaterThanOrEqual(0.03);
      expect(reports[foot].minY).toBeLessThan(0.1);
    }
  });

  it('keeps planted feet within tolerance at the gait walk speed', async () => {
    const { reports } = await measureStegoGait();
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
