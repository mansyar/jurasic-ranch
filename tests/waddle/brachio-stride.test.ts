import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { extractAnimationTracks } from "../../scripts/bake-trike-variant.js";
import { createBrachioVariantGroup, buildBrachioWaddleClip } from "../../scripts/vendor/bake-brachio-variant.js";
import { BRACHIO_GAIT } from "../../src/ranch/dino-player.js";
import { gaitSpeedMetresPerSecond } from "../../src/ranch/waddle.js";

/**
 * Brachio stride / foot-slide conformance (FR-4, AC-2): the rebuilt 1.0 s
 * Waddle loop must land the coded 0.24 m BRACHIO_GAIT stride in measured foot
 * travel, keep a walking duty cycle with real ground clearance, and hold
 * planted feet inside the shared slide tolerances at the coded 0.24 m/s walk
 * speed. Same harness as the Trike stride.test.ts; the longer sauropod legs
 * swing the same donor quaternions, so travel is tuned with
 * BRACHIO_POSITION_TRACK_SCALE (see the bake) rather than assumed.
 */

const SHIPPED_GLB = new URL("../../public/models/trike.glb", import.meta.url);
const WALK_SPEED_METRES_PER_SECOND = gaitSpeedMetresPerSecond(BRACHIO_GAIT);
const FEET = [
  "LeftFrontFoot",
  "RightFrontFoot",
  "LeftHindFoot",
  "RightHindFoot",
] as const;
const SAMPLES = 121;
/** Height above a foot's lowest sample that still counts as ground contact. */
const CONTACT_METRES = 0.01;
/** The coded stride must match the clip's measured foot travel this closely. */
const STRIDE_TOLERANCE_METRES = 0.02;
/** Max world-space drift of one planted foot during a single stance. */
const STANCE_EXCURSION_METRES = 0.12;
/**
 * Max sustained world-space speed of a planted foot: peak over 5-sample
 * windows inside the stance core (transient touchdown/liftoff samples
 * trimmed, loop-boundary windows skipped). Windowing dilutes single-sample
 * touchdown scrubs and the clip's own loop-closure pop; total drift is
 * bounded by the excursion metric above.
 */
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
 * fixed at the origin, then replay root motion at the coded walk speed to
 * measure how planted feet move in world space.
 */
async function measureGait(): Promise<{ reports: Record<string, FootReport> }> {
  const bytes = await readFile(SHIPPED_GLB);
  const animation = extractAnimationTracks(bytes);
  const group = createBrachioVariantGroup();
  const clip = buildBrachioWaddleClip(group, animation);
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
        throw new Error(`variant skeleton is missing bone "${foot}"`);
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
    while (
      runLength < points.length &&
      contact[(start + runLength) % points.length]
    ) {
      runLength += 1;
    }
    // Replay root motion on unwrapped time: the stance run may straddle the
    // loop boundary, where wrapped sample time would inject a speed*loop
    // discontinuity into world space. Continuous replay keeps the planted
    // foot in one world frame for the whole run.
    const step = clip.duration / (SAMPLES - 1);
    const t0 = points[start].t;
    const worldAt = (k: number): number => {
      const i = (start + k) % points.length;
      return points[i].z + WALK_SPEED_METRES_PER_SECOND * (t0 + k * step);
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
        continue; // Loop-boundary window: clip closure gap, not foot slide.
      }
      const sustained = Math.abs(worldAt(k + 2) - worldAt(k - 2)) / (4 * step);
      windowPeak = Math.max(windowPeak, sustained);
    }
    const excursion = runMax - runMin;
    reports[foot] = {
      minY,
      lift: maxY - minY,
      travel: maxZ - minZ,
      duty,
      excursion,
      corePeakSlide: windowPeak,
      coreMeanSlide: coreCount > 0 ? coreSum / coreCount : 0,
    };
  }
  return { reports };
}

describe("brachio waddle stride (FR-4)", () => {
  it("matches the coded stride to the clip's measured foot travel", async () => {
    const { reports } = await measureGait();
    const travels = FEET.map((foot) => reports[foot].travel);
    const mean = travels.reduce((a, b) => a + b, 0) / travels.length;
    console.log(
      `brachio stride: ${FEET.map((foot) => `${foot}=${reports[foot].travel.toFixed(4)}`).join(" ")} mean=${mean.toFixed(4)} coded=${BRACHIO_GAIT.strideMetres}`,
    );
    for (const foot of FEET) {
      expect(Math.abs(reports[foot].travel - BRACHIO_GAIT.strideMetres)).toBeLessThanOrEqual(
        STRIDE_TOLERANCE_METRES,
      );
    }
    expect(Math.abs(mean - BRACHIO_GAIT.strideMetres)).toBeLessThanOrEqual(
      STRIDE_TOLERANCE_METRES,
    );
  });

  it("keeps a walking duty cycle with real ground clearance", async () => {
    const { reports } = await measureGait();
    for (const foot of FEET) {
      expect(reports[foot].duty).toBeGreaterThanOrEqual(0.5);
      expect(reports[foot].duty).toBeLessThanOrEqual(0.85);
      expect(reports[foot].lift).toBeGreaterThanOrEqual(0.03);
      expect(reports[foot].minY).toBeLessThan(0.1);
    }
  });
});

describe("brachio foot-slide tolerance (AC-2)", () => {
  it("keeps planted feet within tolerance at the coded walk speed", async () => {
    const { reports } = await measureGait();
    for (const foot of FEET) {
      console.log(
        `${foot} duty=${reports[foot].duty.toFixed(3)} excursion=${reports[foot].excursion.toFixed(4)} corePeak=${reports[foot].corePeakSlide.toFixed(4)} coreMean=${reports[foot].coreMeanSlide.toFixed(4)}`,
      );
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
