import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildBrachioClips,
  createBrachioVariantGroup,
} from '../../scripts/vendor/bake-brachio-variant.js';
import { BRACHIO_GAIT } from '../../src/ranch/dino-player.js';
import { gaitSpeedMetresPerSecond } from '../../src/ranch/waddle.js';

/**
 * Brachio walk (FR-1, AC-1, AC-2, AC-5). The shipped clip is Polyfork's own
 * authored `Walk` — 3.8 s, 70 channels over all 35 bones, so the neck and tail
 * finally move with the step — and this harness derives the walking speed from
 * it rather than asserting a tuned constant: the speed at which each planted
 * foot stops travelling.
 *
 * Phase 4 re-pointed `BRACHIO_GAIT` at those measurements (1.767 m per 3.8 s,
 * ~0.465 m/s) and the sweep test below holds the constant to the clip: the
 * shipped speed must be the slide minimum, not a remembered number.
 */

const SHIPPED_GLB = new URL('../../public/models/brachio.glb', import.meta.url);
const FEET = ['LeftFrontFoot', 'RightFrontFoot', 'LeftHindFoot', 'RightHindFoot'] as const;
const SAMPLES = 121;
/** Height above a foot's lowest sample that still counts as ground contact. */
const CONTACT_METRES = 0.01;
/** Stance samples trimmed from each end of a run before rating slide speed. */
const TRANSIENT_TRIM = 3;
/** Authored cadence (AC-1). */
const CYCLE_SECONDS = 3.8;
/** The four feet must agree on the clip's own walking speed within this ratio. */
const FOOT_SPEED_SPREAD_RATIO = 0.03;
/** Max world-space drift of one planted foot during a single stance. */
const STANCE_EXCURSION_METRES = 0.2;
/**
 * Max sustained world-space speed of a planted foot: peak over 5-sample
 * windows inside the stance core (transient touchdown/liftoff samples trimmed,
 * loop-boundary windows skipped). On a 12 m sauropod these are large absolute
 * numbers, so they are read against the ~0.42 m/s walk speed.
 */
const STANCE_SUSTAINED_PEAK_SLIDE_METRES_PER_SECOND = 0.25;
const STANCE_CORE_MEAN_SLIDE_METRES_PER_SECOND = 0.12;

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

interface BrachioWalkMeasurement {
  duration: number;
  reports: Record<string, FootReport>;
  /** Mean of the four feet's own speeds: the clip's walking speed. */
  walkSpeed: number;
  /** Walk speed x cycle length: the ground one loop covers. */
  strideMetres: number;
  /**
   * Mean world-space slide of every planted foot at a candidate root speed, in
   * m/s. The gait constant minimises this, so the sweep test below holds the
   * constant to the clip's own geometry instead of comparing it to itself.
   */
  slideAt: (speed: number) => number;
}

/** Play the shipped `Walk` clip once, sampling every foot at 121 instants. */
async function measureBrachioWalk(): Promise<THREE.Group & BrachioWalkMeasurement> {
  const bytes = await readFile(SHIPPED_GLB);
  const group = createBrachioVariantGroup();
  const clip = buildBrachioClips(group, bytes).find((entry) => entry.name === 'Walk');
  if (clip === undefined) {
    throw new Error('shipped brachio.glb carries no "Walk" clip');
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
        throw new Error(`brachio variant skeleton is missing bone "${foot}"`);
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

  // Contact floors recomputed once: slideAt runs a few hundred times below.
  const contactFloors = new Map<string, number>();
  for (const foot of FEET) {
    let minY = Infinity;
    for (const point of series.get(foot) ?? []) {
      minY = Math.min(minY, point.y);
    }
    contactFloors.set(foot, minY + CONTACT_METRES);
  }
  const slideAt = (speed: number): number => {
    let sum = 0;
    let count = 0;
    for (const foot of FEET) {
      const points = series.get(foot) ?? [];
      const floor = contactFloors.get(foot) ?? 0;
      for (let i = 1; i < points.length; i += 1) {
        const previous = points[i - 1];
        const current = points[i];
        if (previous.y > floor || current.y > floor) {
          continue;
        }
        const travelled = current.z + speed * current.t - (previous.z + speed * previous.t);
        sum += Math.abs(travelled) / step;
        count += 1;
      }
    }
    return count > 0 ? sum / count : Number.NaN;
  };

  return Object.assign(group, {
    duration: clip.duration,
    reports,
    walkSpeed,
    strideMetres: walkSpeed * clip.duration,
    slideAt,
  });
}

describe('brachio authored walk (FR-1, AC-1)', () => {
  it('ships the authored 3.8 s Walk with four feet striding evenly', async () => {
    const { duration, reports, strideMetres } = await measureBrachioWalk();
    expect(duration).toBeCloseTo(CYCLE_SECONDS, 3);
    const travels = FEET.map((foot) => reports[foot].travel);
    const mean = travels.reduce((a, b) => a + b, 0) / travels.length;
    expect(mean).toBeGreaterThan(0.8);
    for (const foot of FEET) {
      expect(Math.abs(reports[foot].travel - mean)).toBeLessThanOrEqual(0.02);
    }
    expect(strideMetres).toBeGreaterThan(1.3);
  });

  it('keeps a walking duty cycle with real ground clearance', async () => {
    const { reports } = await measureBrachioWalk();
    for (const foot of FEET) {
      expect(reports[foot].duty).toBeGreaterThanOrEqual(0.5);
      expect(reports[foot].duty).toBeLessThanOrEqual(0.9);
      expect(reports[foot].lift).toBeGreaterThanOrEqual(0.03);
      expect(reports[foot].minY).toBeLessThan(0.45);
    }
  });
});

describe('brachio foot plant (AC-2, AC-5, no skate)', () => {
  it('agrees on one walking speed across all four feet', async () => {
    const { reports, walkSpeed } = await measureBrachioWalk();
    expect(walkSpeed).toBeGreaterThan(0.2);
    for (const foot of FEET) {
      const ratio = reports[foot].footSpeed / walkSpeed;
      expect(Math.abs(ratio - 1)).toBeLessThanOrEqual(FOOT_SPEED_SPREAD_RATIO);
    }
  });

  it('walks at the speed that minimises planted-foot slide on the shipped clip', async () => {
    const measurement = await measureBrachioWalk();
    const gaitSpeed = gaitSpeedMetresPerSecond(BRACHIO_GAIT);
    // Sweep the clip's own frames: the front and hind pairs disagree slightly
    // on the exact minimiser, so the V is flatter than the Stego's.
    let bestSlide = Infinity;
    let bestSpeed = 0;
    for (let i = 0; i <= 20; i += 1) {
      const speed = 0.42 + i * 0.005;
      const slide = measurement.slideAt(speed);
      if (slide < bestSlide) {
        bestSlide = slide;
        bestSpeed = speed;
      }
    }
    expect(Math.abs(bestSpeed - gaitSpeed)).toBeLessThanOrEqual(0.005);
    expect(measurement.slideAt(gaitSpeed)).toBeLessThanOrEqual(0.07);
    // The defect this phase pays: the pre-track 0.24 m / 1.0 s dragged the
    // same feet at 0.25 m/s of world-space slide.
    expect(measurement.slideAt(0.24 / 1.0)).toBeGreaterThan(0.2);
  });

  it('keeps one loop equal to one stride and sits at the slide optimum', async () => {
    const measurement = await measureBrachioWalk();
    const gaitSpeed = gaitSpeedMetresPerSecond(BRACHIO_GAIT);
    expect(BRACHIO_GAIT.loopSeconds).toBeCloseTo(measurement.duration, 3);
    expect(BRACHIO_GAIT.strideMetres).toBeCloseTo(gaitSpeed * measurement.duration, 6);
    // The stance-run estimator reads 11 % below the slide minimiser on this
    // clip (0.412 vs 0.465 m/s): its whole-stance mean carries the slow
    // touchdown/liftoff transients that the slide fit ignores, so the two
    // instruments are not expected to agree within 5 % here — a finding, not a
    // tuning target (phase-4 evidence records both, and the stance-core fit
    // agrees with the slide optimum at 0.465). What the constant must satisfy
    // is the visual quantity: no better speed exists on the shipped clip.
    let bestSlide = Infinity;
    for (let i = 0; i <= 20; i += 1) {
      bestSlide = Math.min(bestSlide, measurement.slideAt(0.42 + i * 0.005));
    }
    expect(measurement.slideAt(gaitSpeed)).toBeLessThanOrEqual(bestSlide * 1.05);
    expect(gaitSpeed / measurement.walkSpeed).toBeGreaterThan(1.0);
    expect(gaitSpeed / measurement.walkSpeed).toBeLessThan(1.15);
  });

  it('holds planted feet still when root motion runs at that speed', async () => {
    const { reports } = await measureBrachioWalk();
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
