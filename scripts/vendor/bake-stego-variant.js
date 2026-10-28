/**
 * Bake the pastel baby Stegosaurus variant GLB (track 20261029-stego-generic-player, Phase 2).
 *
 * The shipped game file `public/models/stego.glb` is generated from the vendored
 * Polyfork parametric module — no network at bake time; the bare `three`
 * specifier below resolves via node_modules (three ^0.180.0, matching the
 * module's own importmap note).
 *
 * Pinned Polyfork call (do not drift; re-running reproduces the same variant):
 *
 *   createAsset({"size":0.6,"plates":24,"plateSize":1,"tail":1,"plateColour":"umber",
 *     "hide":"#7fb5a3","belly":"#f6ead0","blend":"#bacfb9","feet":"#6da08e",
 *     "mark":"#4f5e59","plate":"#efa27e","plateTrim":"#b26a4d","spike":"#fff3dd"})
 *
 * Size 0.6 rebuilds the animal at ~3.9 m: a baby Stego pen-mate of the Trike
 * (dusty-teal hide, cream belly, peach plates with terracotta trim — distinct
 * from the Trike green and colorblind-safe by luminance separation). The size
 * knob's documented range is 0.6–1.4, so 0.6 is the smallest baby the module
 * builds; the umber plate pattern lands on the plates' facet bands while the
 * explicit peach/terracotta hexes override the pattern's brown defaults. Feet
 * stay on y = 0.
 *
 * Steps:
 *   1. Build the variant with createAsset() (single mesh, single material,
 *      baked pastel COLOR_0 vertex colors, flat shading, same 22-bone
 *      quadruped skeleton as the Trike).
 *   2. Extract the Waddle clip from the shipped Trike GLB and rebuild it on
 *      the Stego skeleton: same bone names, same 0.8 s timing, quaternion
 *      tracks verbatim, position tracks scaled by STEGO_POSITION_TRACK_SCALE.
 *      Donor channels with no Stego counterpart are dropped and reported
 *      (never silently half-built: the bake logs every drop).
 *   3. Export an uncompressed GLB via three's GLTFExporter to a temp file.
 *   4. Re-export through headless Blender with Draco mesh compression to the
 *      final path (three's GLTFExporter has no Draco writer; this reuses the
 *      same Blender Draco tooling the repo used for the Trike GLB).
 *
 * Usage:
 *   node scripts/vendor/bake-stego-variant.js [--donor <glb>] [--out <glb>]
 *     [--blender <bin>] [--keep-temp]
 *
 * Defaults: --donor is public/models/trike.glb, --out is
 * public/models/stego.glb, --blender is `blender` (override with
 * STEGO_BLENDER_BIN). Any failure exits non-zero and never leaves a
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
import { createAsset } from './stegosaurus-base.mjs';

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
const BLENDER_SCRIPT = join(HERE, 'bake-stego-variant.py');
const DEFAULT_DONOR_GLB = join(REPO_ROOT, 'public', 'models', 'trike.glb');
const DEFAULT_OUT_GLB = join(REPO_ROOT, 'public', 'models', 'stego.glb');

/**
 * Pinned variant params. The variant test asserts these verbatim, so a drift
 * here fails `pnpm verify` instead of shipping a wrong-colored dino.
 */
export const STEGO_VARIANT_PARAMS = {
  size: 0.6,
  plates: 24,
  plateSize: 1,
  tail: 1,
  plateColour: 'umber',
  hide: '#7fb5a3',
  belly: '#f6ead0',
  blend: '#bacfb9',
  feet: '#6da08e',
  mark: '#4f5e59',
  plate: '#efa27e',
  plateTrim: '#b26a4d',
  spike: '#fff3dd',
};

/**
 * Position-track scale for the Waddle rebuild. The Trike donor GLB carries
 * size-0.6 bind-space locations and the Stego variant skeleton also lives in
 * size-0.6 space on a same-class adult reference (6.49 m vs the Trike
 * 6.26 m), so donor translations carry over at the Trike bake's 0.6 scale —
 * no retime: the rebuilt clip measures the same ~0.29 m stride. The stride
 * test absorbs the 4 % reference gap within its 0.02 m tolerance.
 */
export const STEGO_POSITION_TRACK_SCALE = 0.6;

const EXPECTED_CLIP_NAME = 'Waddle';
const CLIP_MIN_SECONDS = 0.79;
const CLIP_MAX_SECONDS = 0.81;

/** Procedural variant group: the exact geometry the bake exports. */
export function createStegoVariantGroup() {
  return createAsset({ ...STEGO_VARIANT_PARAMS });
}

/** Adult reference group (all Polyfork defaults): proportion baseline. */
export function createStegoDefaultGroup() {
  return createAsset({});
}

/**
 * Rebuild the Trike donor Waddle clip on the Stego skeleton: same timing,
 * quaternion tracks verbatim, position tracks scaled into the variant's
 * bind-pose space. Donor channels whose bone has no Stego counterpart are
 * dropped and recorded on the clip's userData (the same quadruped rig means
 * the expected drop set is empty). Throws (never half-builds) on a wrong
 * clip, an out-of-range duration, or an unsupported channel path.
 */
export function buildStegoWaddleClip(skeletonRoot, animation) {
  if (animation.name !== EXPECTED_CLIP_NAME) {
    throw new Error(`Expected a "${EXPECTED_CLIP_NAME}" clip, found "${animation.name}".`);
  }
  if (animation.durationSeconds < CLIP_MIN_SECONDS || animation.durationSeconds > CLIP_MAX_SECONDS) {
    throw new Error(`Waddle duration ${animation.durationSeconds.toFixed(3)} s is outside 0.79-0.81 s.`);
  }
  const dropped = [];
  const tracks = [];
  for (const channel of animation.channels) {
    const node = skeletonRoot.getObjectByName(channel.nodeName);
    if (node === undefined || node === null) {
      dropped.push(channel.nodeName);
      continue;
    }
    if (channel.path === 'translation') {
      const scaled = new Float32Array(channel.values.length);
      for (let i = 0; i < scaled.length; i += 1) {
        scaled[i] = channel.values[i] * STEGO_POSITION_TRACK_SCALE;
      }
      const track = new THREE.VectorKeyframeTrack(`${channel.nodeName}.position`, channel.times, scaled);
      track.setInterpolation(THREE.InterpolateLinear);
      tracks.push(track);
    } else if (channel.path === 'rotation') {
      const track = new THREE.QuaternionKeyframeTrack(
        `${channel.nodeName}.quaternion`,
        channel.times,
        channel.values.slice(),
      );
      track.setInterpolation(THREE.InterpolateLinear);
      tracks.push(track);
    } else if (channel.path === 'scale') {
      const track = new THREE.VectorKeyframeTrack(
        `${channel.nodeName}.scale`,
        channel.times,
        channel.values.slice(),
      );
      track.setInterpolation(THREE.InterpolateLinear);
      tracks.push(track);
    } else {
      throw new Error(`Unsupported animation path "${channel.path}" on "${channel.nodeName}".`);
    }
  }
  const clip = new THREE.AnimationClip(EXPECTED_CLIP_NAME, animation.durationSeconds, tracks);
  clip.userData.dropped = [...new Set(dropped)];
  return clip;
}

/** Find the script-relative Blender Draco pass (scripts/vendor/bake-stego-variant.py). */
function blenderArgs(tmpIn, tmpOut) {
  return ['--background', '--python', BLENDER_SCRIPT, '--', tmpIn, tmpOut];
}

/**
 * Run the full bake. Options: donorGlbPath (Waddle donor, default the shipped
 * Trike GLB), outPath (final Draco GLB, default public/models/stego.glb),
 * blenderBin (default `blender`, STEGO_BLENDER_BIN overrides), keepTemp
 * (debug). Resolves with a summary; rejects with a clear error and never
 * leaves a half-written outPath.
 */
export async function bakeStegoVariant(options = {}) {
  const donorGlbPath = options.donorGlbPath ?? DEFAULT_DONOR_GLB;
  const outPath = options.outPath ?? DEFAULT_OUT_GLB;
  const blenderBin = options.blenderBin ?? process.env['STEGO_BLENDER_BIN'] ?? 'blender';
  const donorBytes = await readFile(donorGlbPath);
  const donorAnim = extractAnimationTracks(donorBytes);
  const group = createStegoVariantGroup();
  const clip = buildStegoWaddleClip(group, donorAnim);
  if (clip.userData.dropped.length > 0) {
    console.log(`bake-stego-variant: dropped donor channels: ${clip.userData.dropped.join(', ')}`);
  }
  const exporter = new GLTFExporter();
  const exported = await exporter.parseAsync(group, { binary: true, animations: [clip] });
  const tmpIn = join(tmpdir(), `stego-baby-uncompressed-${process.pid}.glb`);
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
          `or set STEGO_BLENDER_BIN / --blender. Uncompressed export kept at ${tmpIn}.`,
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
      throw new Error(`Unknown argument "${arg}". Usage: node scripts/vendor/bake-stego-variant.js [--donor <glb>] [--out <glb>] [--blender <bin>] [--keep-temp].`);
    }
  }
  return options;
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const summary = await bakeStegoVariant(parseArgs(process.argv.slice(2)));
    console.log(
      `bake-stego-variant: wrote ${summary.outPath} (Waddle ${summary.durationSeconds.toFixed(3)} s, ${summary.trackCount} tracks).`,
    );
  } catch (error) {
    console.error(`bake-stego-variant: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
