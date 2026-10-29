/**
 * Bake the pastel baby Brachiosaurus variant GLB (track 20261029-brachio-joins-ranch, Phase 2).
 *
 * The shipped game file `public/models/brachio.glb` is generated from the vendored
 * Polyfork parametric module — no network at bake time; the bare `three`
 * specifier below resolves via node_modules (three ^0.180.0, matching the
 * module's own importmap note).
 *
 * Pinned Polyfork call (do not drift; re-running reproduces the same variant):
 *
 *   createAsset({"size":0.6,"neck":0,"head":1,"tail":1,"colorway":"dusty-umber",
 *     "coat":"#b8a9d6","flank":"#c3b2e0","belly":"#f2e9d8","mottle":"#8a739e",
 *     "muzzle":"#d8c9e8","nail":"#5a4a5e","eye":"#211b16"})
 *
 * Size 0.6 is the smallest baby the module builds, but the sauropod adult
 * reference is huge (3.34 x 12.2 x 12.53 m as built), so 0.6 alone still
 * stands ~7.5 m long — way over the 1.2 m head-height cap. The smallest change
 * that fits the cozy-cam frame is one extra uniform group scale
 * (BRACHIO_EXTRA_SCALE 0.5, total 0.3): a ~4.7 m grazing baby — bigger than
 * the 3.9 m Trike/Stego pen-mates, head carried low at ~1.2 m (neck knob 0,
 * seated-shuffle feel, stays in-frame). Feet stay on y = 0 (uniform scale
 * about the ground-level origin).
 *
 * Steps:
 *   1. Build the variant with createAsset() (single mesh, single material,
 *      baked pastel COLOR_0 vertex colors, flat shading, 35-bone sauropod
 *      skeleton) and apply the extra uniform scale.
 *   2. Extract the Waddle clip from the shipped Trike GLB and rebuild it on
 *      the Brachio skeleton: retimed to the 1.0 s BRACHIO_GAIT loop, quaternion
 *      tracks verbatim, position tracks scaled by BRACHIO_POSITION_TRACK_SCALE
 *      (stride-calibrated so measured foot travel matches the coded 0.24 m
 *      stride — the sauropod legs are not same-class with the donor, so the
 *      scale is tuned, not inherited). Donor channels with no Brachio
 *      counterpart would drop here and be reported (never silently
 *      half-built); against the shipped donor every channel maps, so the bake
 *      logs no drops. Unmapped extra bones (Neck1-7, Tail1-4, elbows, hocks)
 *      hold bind pose.
 *   3. Export an uncompressed GLB via three's GLTFExporter to a temp file.
 *   4. Re-export through headless Blender with Draco mesh compression to the
 *      final path (three's GLTFExporter has no Draco writer; this reuses the
 *      same Blender Draco tooling the repo used for the Trike/Stego GLBs).
 *
 * Usage:
 *   node scripts/vendor/bake-brachio-variant.js [--donor <glb>] [--out <glb>]
 *     [--blender <bin>] [--keep-temp]
 *
 * Defaults: --donor is public/models/trike.glb, --out is
 * public/models/brachio.glb, --blender is `blender` (override with
 * BRACHIO_BLENDER_BIN). Any failure exits non-zero and never leaves a
 * half-written GLB: the final path is written only via an atomic rename after
 * a successful Draco pass.
 */

import { spawnSync } from 'node:child_process';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { extractAnimationTracks } from '../bake-trike-variant.js';
import { createAsset } from './brachiosaurus-base.mjs';

/**
 * Node has no FileReader, which three's GLTFExporter uses to assemble the
 * binary GLB (readAsArrayBuffer + onloadend). Minimal polyfill backed by
 * Blob.arrayBuffer(); guarded so browsers keep the native implementation.
 */
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    constructor() {
      this.result = null;
      this.onloadend = null;
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        if (typeof this.onloadend === 'function') {
          this.onloadend();
        }
      });
    }
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(dirname(HERE));
const BLENDER_SCRIPT = join(HERE, 'bake-brachio-variant.py');
const DEFAULT_DONOR_GLB = join(REPO_ROOT, 'public', 'models', 'trike.glb');
const DEFAULT_OUT_GLB = join(REPO_ROOT, 'public', 'models', 'brachio.glb');

/**
 * Pinned variant params. The variant test asserts these verbatim, so a drift
 * here fails `pnpm verify` instead of shipping a wrong-colored dino.
 */
export const BRACHIO_VARIANT_PARAMS = {
  size: 0.6,
  neck: 0,
  head: 1,
  tail: 1,
  colorway: 'dusty-umber',
  coat: '#b8a9d6',
  flank: '#c3b2e0',
  belly: '#f2e9d8',
  mottle: '#8a739e',
  muzzle: '#d8c9e8',
  nail: '#5a4a5e',
  eye: '#211b16',
};

/**
 * Extra uniform scale on the variant group. The size knob floors at 0.6, but
 * the sauropod build is non-linear down there (measured: 0.6 x 0.5 still
 * stands ~5.0 m long with the head at 2.14 m), so the cap needs a smaller
 * post-scale: 0.6 x 0.27 lands the grazing head just under the 1.2 m cap
 * (~1.16 m, ~2.7 m tip-to-tail — a touch smaller than the 3.9 m Trike/Stego
 * pen-mates, the price of the cap on a long-necked species). Uniform about
 * the ground-level origin, so feet stay on y = 0.
 */
export const BRACHIO_EXTRA_SCALE = 0.27;

/**
 * Position-track scale for the Waddle rebuild. The Trike donor GLB carries
 * size-1.0 bind-space locations; the Brachio bind layout is size-0.6, but the
 * group post-scale (0.27) applies at runtime, so the scale is
 * stride-calibrated so measured foot travel matches the coded 0.24 m
 * BRACHIO_GAIT stride (see the stride test). Tune, don't assume: the
 * sauropod legs are not same-class with the donor.
 */
export const BRACHIO_POSITION_TRACK_SCALE = 1.85;

/** Retime target: the rebuilt loop matches the 1.0 s BRACHIO_GAIT loop. */
export const BRACHIO_LOOP_SECONDS = 1.0;

const EXPECTED_CLIP_NAME = 'Waddle';
const CLIP_MIN_SECONDS = 0.79;
const CLIP_MAX_SECONDS = 0.81;

/** Procedural variant group: the exact geometry the bake exports. */
export function createBrachioVariantGroup() {
  const group = createAsset({ ...BRACHIO_VARIANT_PARAMS });
  group.scale.setScalar(BRACHIO_EXTRA_SCALE);
  return group;
}

/** Adult reference group (all Polyfork defaults): proportion baseline. */
export function createBrachioDefaultGroup() {
  return createAsset({});
}

/**
 * Rebuild the Trike donor Waddle clip on the Brachio skeleton: retimed to
 * 1.0 s, quaternion tracks verbatim, position tracks scaled into the
 * variant's bind-pose space. Donor channels whose bone has no Brachio
 * counterpart would drop here (recorded on the clip's userData, never
 * silently); against the shipped Trike donor every channel maps by name, so
 * nothing drops. Unmapped extra bones (neck/tail segments, elbows, hocks)
 * simply hold bind pose.
 * Throws (never half-builds) on a wrong clip, an out-of-range donor duration,
 * or an unsupported channel path.
 */
export function buildBrachioWaddleClip(skeletonRoot, animation) {
  if (animation.name !== EXPECTED_CLIP_NAME) {
    throw new Error(`Expected a "${EXPECTED_CLIP_NAME}" clip, found "${animation.name}".`);
  }
  if (animation.durationSeconds < CLIP_MIN_SECONDS || animation.durationSeconds > CLIP_MAX_SECONDS) {
    throw new Error(`Waddle duration ${animation.durationSeconds.toFixed(3)} s is outside 0.79-0.81 s.`);
  }
  const retime = BRACHIO_LOOP_SECONDS / animation.durationSeconds;
  const dropped = [];
  const tracks = [];
  for (const channel of animation.channels) {
    const node = skeletonRoot.getObjectByName(channel.nodeName);
    if (node === undefined || node === null) {
      dropped.push(channel.nodeName);
      continue;
    }
    const times = Float32Array.from(channel.times, (t) => t * retime);
    if (channel.path === 'translation') {
      const scaled = new Float32Array(channel.values.length);
      for (let i = 0; i < scaled.length; i += 1) {
        scaled[i] = channel.values[i] * BRACHIO_POSITION_TRACK_SCALE;
      }
      const track = new THREE.VectorKeyframeTrack(`${channel.nodeName}.position`, times, scaled);
      track.setInterpolation(THREE.InterpolateLinear);
      tracks.push(track);
    } else if (channel.path === 'rotation') {
      const track = new THREE.QuaternionKeyframeTrack(
        `${channel.nodeName}.quaternion`,
        times,
        channel.values.slice(),
      );
      track.setInterpolation(THREE.InterpolateLinear);
      tracks.push(track);
    } else if (channel.path === 'scale') {
      const track = new THREE.VectorKeyframeTrack(
        `${channel.nodeName}.scale`,
        times,
        channel.values.slice(),
      );
      track.setInterpolation(THREE.InterpolateLinear);
      tracks.push(track);
    } else {
      throw new Error(`Unsupported animation path "${channel.path}" on "${channel.nodeName}".`);
    }
  }
  const clip = new THREE.AnimationClip(EXPECTED_CLIP_NAME, BRACHIO_LOOP_SECONDS, tracks);
  clip.userData.dropped = [...new Set(dropped)];
  return clip;
}

/** Find the script-relative Blender Draco pass (scripts/vendor/bake-brachio-variant.py). */
function blenderArgs(tmpIn, tmpOut) {
  return ['--background', '--python', BLENDER_SCRIPT, '--', tmpIn, tmpOut];
}

/**
 * Run the full bake. Options: donorGlbPath (Waddle donor, default the shipped
 * Trike GLB), outPath (final Draco GLB, default public/models/brachio.glb),
 * blenderBin (default `blender`, BRACHIO_BLENDER_BIN overrides), keepTemp
 * (debug). Resolves with a summary; rejects with a clear error and never
 * leaves a half-written outPath.
 */
export async function bakeBrachioVariant(options = {}) {
  const donorGlbPath = options.donorGlbPath ?? DEFAULT_DONOR_GLB;
  const outPath = options.outPath ?? DEFAULT_OUT_GLB;
  const blenderBin = options.blenderBin ?? process.env['BRACHIO_BLENDER_BIN'] ?? 'blender';
  const donorBytes = await readFile(donorGlbPath);
  const donorAnim = extractAnimationTracks(donorBytes);
  const group = createBrachioVariantGroup();
  const clip = buildBrachioWaddleClip(group, donorAnim);
  if (clip.userData.dropped.length > 0) {
    console.log(`bake-brachio-variant: dropped donor channels: ${clip.userData.dropped.join(', ')}`);
  }
  const exporter = new GLTFExporter();
  const exported = await exporter.parseAsync(group, { binary: true, animations: [clip] });
  const tmpIn = join(tmpdir(), `brachio-baby-uncompressed-${process.pid}.glb`);
  // Blender appends `.glb` when the export path lacks it, so the temp name
  // keeps the suffix: the next run overwrites any stranded temp, then the
  // atomic rename moves it into place (never a half-written outPath).
  const tmpOut = `${outPath}.draco-tmp.glb`;
  await writeFile(tmpIn, new Uint8Array(exported));
  try {
    const result = spawnSync(blenderBin, blenderArgs(tmpIn, tmpOut), { stdio: 'inherit' });
    if (result.error !== undefined) {
      throw new Error(
        `Could not launch Blender (${result.error.message}). Install Blender on PATH ` +
          `or set BRACHIO_BLENDER_BIN / --blender. Uncompressed export kept at ${tmpIn}.`,
      );
    }
    if (result.status !== 0) {
      throw new Error(`Blender Draco pass failed (exit ${result.status}). Uncompressed export kept at ${tmpIn}.`);
    }
    await rename(tmpOut, outPath);
  } catch (error) {
    await rm(tmpOut, { force: true });
    throw error;
  } finally {
    if (options.keepTemp !== true) {
      await rm(tmpIn, { force: true });
    }
  }
  return { outPath, durationSeconds: clip.duration, trackCount: clip.tracks.length };
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--donor' && i + 1 < argv.length) {
      options.donorGlbPath = resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--out' && i + 1 < argv.length) {
      options.outPath = resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--blender' && i + 1 < argv.length) {
      options.blenderBin = argv[i + 1];
      i += 1;
    } else if (arg === '--keep-temp') {
      options.keepTemp = true;
    } else {
      throw new Error(`Unknown argument "${arg}". Usage: node scripts/vendor/bake-brachio-variant.js [--donor <glb>] [--out <glb>] [--blender <bin>] [--keep-temp].`);
    }
  }
  return options;
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const summary = await bakeBrachioVariant(parseArgs(process.argv.slice(2)));
    console.log(
      `bake-brachio-variant: wrote ${summary.outPath} (Waddle ${summary.durationSeconds.toFixed(3)} s, ${summary.trackCount} tracks).`,
    );
  } catch (error) {
    console.error(`bake-brachio-variant: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
