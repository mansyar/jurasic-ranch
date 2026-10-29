import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DisplacementRow } from './vendor/inspect-dino-clips.mjs';
import { clipFacts, displacementRows, readRig } from './vendor/inspect-dino-clips.mjs';

/**
 * The FR-3 regression gate: while a dino walks, no bone may be dragged far from
 * the rest offset its own rig gives it.
 *
 * The defect this guards against is subtle enough to survive review: glTF
 * `translation` channels are ABSOLUTE local translations, not deltas, so a clip
 * authored for one skeleton can be copied onto another and still look like a
 * plausible animation — the rotations are right, only the bones slide. That is
 * exactly what shipped: the Trike's `Waddle`, its positions scaled by one
 * constant, on rest skeletons whose bone offsets differ by factors of 0.22 to
 * 8.55. Stego's hips dropped 0.60 m, Brachio's tail tip sat 148 % of its own
 * rest offset away from where it belongs.
 *
 * The rule, from `spec.md` (Goal 1): first-frame displacement from rest must be
 * at most 25 % of the bone's rest distance to its parent. The rest distance is
 * the denominator because it is the scale at which that bone's position is
 * meaningful; a 5 cm slide is noise on a 4 m neck and a collapse on a 6 cm jaw.
 *
 * Point this at another directory of GLBs with `DINO_CLIPS_DIR` to run the same
 * assertion against a historical bake — AC-2's `1a96d6b` half was measured that
 * way, with the recorded failure in `verification/phase-3.md`.
 */

/** FR-3's envelope: 25 % of the bone's rest distance to its parent. */
const MAX_DISPLACEMENT_FRACTION = 0.25;

/**
 * Rest offsets at or below this are treated as zero. 25 % of a rest offset that
 * is itself a rounding artefact is not a bound at all: Brachio's `Head` sits on
 * its parent's origin (rest translation reads 1e-7 m), so the fraction is 100 %
 * for a displacement of 0.1 µm. Dividing there would fail forever on noise.
 */
const MIN_REST_DISTANCE_METRES = 1e-3;

/**
 * Absolute fallback for the zero-rest case above: a bone pinned to its parent's
 * origin may not be moved by more than a millimetre at frame 0. Calibrated from
 * both sides rather than picked: the shipped Brachio moves `Head` 1e-7 m, the
 * pre-track file moved it 0.5476 m, so the bound sits four orders of magnitude
 * from the passing case and three from the failing one.
 */
const MAX_ZERO_REST_DISPLACEMENT_METRES = 1e-3;

/** A rig read that resolved no bones would pass every assertion vacuously. */
const MIN_PLAUSIBLE_REST_OFFSET_METRES = 1;

interface SpeciesSpec {
  /** Filename inside the model directory; both the shipped and pre-track files share it. */
  readonly file: string;
  /** The authored `Walk` length in seconds (AC-1); the export rounds in float32. */
  readonly walkSeconds: number;
  /** Skin joints: 24 for the Stego, 35 for the Brachio (11 of them sauropod-only). */
  readonly jointCount: number;
}

const SPECIES: readonly SpeciesSpec[] = [
  { file: 'stego.glb', walkSeconds: 2.4, jointCount: 24 },
  { file: 'brachio.glb', walkSeconds: 3.8, jointCount: 35 },
];

/**
 * The shipped GLBs by default, or `DINO_CLIPS_DIR` when a caller wants the gate
 * run against another bake. Resolved per assertion so a directory-relative
 * invocation cannot half-apply.
 */
function modelDir(): string {
  const override = process.env.DINO_CLIPS_DIR;
  if (override === undefined || override === '') {
    return fileURLToPath(new URL('../public/models', import.meta.url));
  }
  return resolve(override);
}

async function loadGlb(file: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(modelDir(), file)));
}

/**
 * The clip the envelope measures. `Walk` is the authored one. A file that
 * carries a single clip under another name is still measured, so the envelope
 * reports displacement — the defect this gate is about — instead of stopping at
 * a lookup error; that the clip must be called `Walk` is a separate assertion,
 * so nothing is excused by this fallback. Measured this way, the `1a96d6b` bake
 * (whose only clip is `Waddle`) fails on 22 of 24 Stego bones and 12 of 35
 * Brachio bones rather than on a missing name.
 */
function locomotionClipName(clips: ReturnType<typeof clipFacts>, file: string): string {
  const names = clips.map((clip) => clip.name);
  if (names.includes('Walk')) {
    return 'Walk';
  }
  if (clips.length === 1) {
    return names[0];
  }
  throw new Error(`${file} carries no Walk clip and is not single-clip: ${names.join(', ')}.`);
}

/**
 * Every bone the clip moves, with the two numbers FR-3 compares. The bound is
 * per bone: the walk drives all 24/35 joints, so a missing row means the reader
 * lost a channel, not that the bone is exempt.
 */
function displacementViolations(rows: readonly DisplacementRow[]): string[] {
  const violations: string[] = [];
  for (const row of rows) {
    const zeroRest = row.restDistanceMetres <= MIN_REST_DISTANCE_METRES;
    const allowed = zeroRest
      ? MAX_ZERO_REST_DISPLACEMENT_METRES
      : row.restDistanceMetres * MAX_DISPLACEMENT_FRACTION;
    if (row.deltaMetres > allowed) {
      violations.push(
        `${row.name} sits ${row.deltaMetres.toFixed(4)} m off its rest offset ` +
          `(rest → parent ${row.restDistanceMetres.toFixed(4)} m, ` +
          `${zeroRest ? 'zero rest offset' : `${((row.deltaMetres / row.restDistanceMetres) * 100).toFixed(1)} % of it`}, ` +
          `bound ${allowed.toFixed(4)} m)`,
      );
    }
  }
  return violations;
}

describe.each(SPECIES)('$file bone displacement', (species) => {
  it('keeps every walking bone inside 25 % of its rest offset (FR-3)', async () => {
    const bytes = await loadGlb(species.file);
    const rig = readRig(bytes);
    // A skin that failed to parse reads as 0 joints and would make the envelope
    // vacuously true, so the rig is asserted before it is trusted.
    expect(rig.hasSkin).toBe(true);
    expect(rig.joints.length).toBe(species.jointCount);
    const widestRestOffset = Math.max(...rig.joints.map((joint) => joint.restDistanceMetres));
    expect(widestRestOffset).toBeGreaterThan(MIN_PLAUSIBLE_REST_OFFSET_METRES);

    // Every joint carries a translation channel in the authored clip, so the
    // envelope below covers the whole rig rather than a subset of it.
    const clipName = locomotionClipName(clipFacts(bytes), species.file);
    const rows = displacementRows(bytes, { clipName }).rows;
    expect(rows.length).toBe(species.jointCount);

    expect(displacementViolations(rows)).toEqual([]);
  });

  it('ships the authored Walk clip at its published length, beside Idle and Run (FR-1)', async () => {
    const clips = clipFacts(await loadGlb(species.file));
    const byName = new Map(clips.map((clip) => [clip.name, clip.durationSeconds]));
    // The clip must be the species' own authored one; `Waddle` is the donor
    // transfer this gate exists to keep out.
    expect(byName.has('Waddle')).toBe(false);
    expect([...byName.keys()].sort()).toEqual(['Idle', 'Run', 'Walk']);
    expect(byName.get('Walk')).toBeCloseTo(species.walkSeconds, 3);
  });
});
