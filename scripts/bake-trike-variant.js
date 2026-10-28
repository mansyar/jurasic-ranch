/**
 * Bake the pastel baby Triceratops variant GLB (track 20261029-baby-trike-turn-fix, Phase 1).
 *
 * The shipped game file `public/models/trike.glb` is generated from the vendored
 * Polyfork parametric module — no network at bake time; the bare `three`
 * specifier below resolves via node_modules (three ^0.180.0, matching the
 * module's own importmap note).
 *
 * Pinned Polyfork call (do not drift; re-running reproduces the same variant):
 *
 *   createAsset({"size":0.6,"horns":0.7,"noseHorn":0.6,"frill":"rayed",
 *     "hide":"#9ed68a","belly":"#c4e8b0","horn":"#f2e8c9","mark":"#7fb069",
 *     "shieldTrim":"#f2e8c9","shieldMark":"#7fb069"})
 *
 * Size 0.6 rebuilds the animal at ~3.8 m (subadult whose head, shield and horns
 * are relatively ~6% larger than the adult reference); horns 0.7 are the short
 * ~0.9 m brow horns of a young adult; the rayed shield pattern lands on the
 * shield's facet rings while the explicit cream/leaf hexes override the
 * pattern's rust defaults. Feet stay on y = 0.
 *
 * Steps:
 *   1. Build the variant with createAsset() (single mesh, single material,
 *      baked pastel COLOR_0 vertex colors, flat shading, 24-bone skeleton).
 *   2. Extract the Waddle clip from the previous GLB and retarget it onto the
 *      new skeleton: same bone names, same 0.8 s timing, quaternion tracks
 *      verbatim, position tracks scaled by POSITION_TRACK_SCALE. Gait quality
 *      on the new legs is Phase 2 work; this keeps the game wired and seamless.
 *   3. Export an uncompressed GLB via three's GLTFExporter to a temp file.
 *   4. Re-export through headless Blender 4.x with Draco mesh compression to
 *      the final path (three's GLTFExporter has no Draco writer; this reuses
 *      the same Blender Draco tooling the repo used for the previous GLB).
 *
 * Usage:
 *   node scripts/bake-trike-variant.js [--prev <glb>] [--out <glb>]
 *     [--blender <bin>] [--keep-temp]
 *
 * Defaults: --prev and --out are public/models/trike.glb, --blender is `blender`
 * (override with TRIKE_BLENDER_BIN). Any failure exits non-zero and never
 * leaves a half-written GLB: the final path is written only via an atomic
 * rename after a successful Draco pass.
 */

import { spawnSync } from 'node:child_process';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createAsset } from './vendor/triceratops-base.mjs';

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
const REPO_ROOT = dirname(HERE);
const BLENDER_SCRIPT = join(HERE, 'bake-trike-variant.py');
const DEFAULT_GLB = join(REPO_ROOT, 'public', 'models', 'trike.glb');

/**
 * Pinned variant params. The variant test asserts these verbatim, so a drift
 * here fails `pnpm verify` instead of shipping a wrong-colored dino.
 */
export const TRIKE_VARIANT_PARAMS = {
  size: 0.6,
  horns: 0.7,
  noseHorn: 0.6,
  frill: 'rayed',
  hide: '#9ed68a',
  belly: '#c4e8b0',
  horn: '#f2e8c9',
  mark: '#7fb069',
  shieldTrim: '#f2e8c9',
  shieldMark: '#7fb069',
};

/**
 * Position-track scale for the Waddle retarget. The previous GLB carries a
 * 0.3x root scale over authored size-1.0 bone offsets, so its baked location
 * tracks live in size-1.0 space; the rebuilt variant skeleton lives in
 * size-0.6 space. The bake validates the 0.3x root assumption before writing.
 */
export const POSITION_TRACK_SCALE = 0.6;

const EXPECTED_CLIP_NAME = 'Waddle';
const CLIP_MIN_SECONDS = 0.79;
const CLIP_MAX_SECONDS = 0.81;
const OLD_ROOT_SCALE = 0.3;
const ROOT_SCALE_TOLERANCE = 0.01;

const GLB_MAGIC = 0x4654_6c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f_534a;
const BIN_CHUNK_TYPE = 0x004e_4942;
const FLOAT_COMPONENT = 5126;

const ACCESSOR_ITEM_SIZE = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
};

/** Procedural variant group: the exact geometry the bake exports. */
export function createVariantGroup() {
  return createAsset({ ...TRIKE_VARIANT_PARAMS });
}

/** Adult reference group (all Polyfork defaults): proportion baseline. */
export function createDefaultGroup() {
  return createAsset({});
}

/** Minimal GLB container parse (JSON + BIN chunk, no WebGL needed). */
export function parseGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('Not a GLB file (bad magic).');
  }
  if (view.getUint32(4, true) !== GLB_VERSION) {
    throw new Error(`Unsupported glTF version (expected 2).`);
  }
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== JSON_CHUNK_TYPE) {
    throw new Error('GLB JSON chunk missing.');
  }
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  const binOffset = 20 + jsonLength;
  let bin = new Uint8Array(0);
  if (binOffset < bytes.byteLength) {
    if (view.getUint32(binOffset + 4, true) !== BIN_CHUNK_TYPE) {
      throw new Error('GLB BIN chunk missing.');
    }
    const binLength = view.getUint32(binOffset, true);
    bin = bytes.subarray(binOffset + 8, binOffset + 8 + binLength);
  }
  return { json, bin };
}

/** Read a FLOAT accessor as a plain array (handles bufferView/accessor offsets). */
function readFloatAccessor(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  if (accessor.componentType !== FLOAT_COMPONENT) {
    throw new Error(`Accessor ${accessorIndex} is not FLOAT; refusing to guess.`);
  }
  const itemSize = ACCESSOR_ITEM_SIZE[accessor.type];
  if (itemSize === undefined) {
    throw new Error(`Accessor ${accessorIndex} has unsupported type "${accessor.type}".`);
  }
  const bufferView = json.bufferViews[accessor.bufferView ?? 0];
  if ((bufferView.byteStride ?? 0) !== 0 && bufferView.byteStride !== undefined) {
    throw new Error(`Accessor ${accessorIndex} is interleaved; not supported.`);
  }
  const base = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const out = Array.from({ length: accessor.count * itemSize });
  for (let i = 0; i < out.length; i += 1) {
    out[i] = view.getFloat32(base + i * 4, true);
  }
  return { values: Float32Array.from(out), itemSize, count: accessor.count };
}

/**
 * Extract the first animation's channels from raw GLB bytes. Animation
 * samplers are never Draco-compressed, so this works on the shipped GLB.
 */
export function extractAnimationTracks(bytes) {
  const { json, bin } = parseGlb(bytes);
  const animations = json.animations ?? [];
  if (animations.length === 0) {
    throw new Error('Source GLB carries no animations; cannot retarget Waddle.');
  }
  const animation = animations[0];
  let durationSeconds = 0;
  const channels = animation.channels.map((channel) => {
    const sampler = animation.samplers[channel.sampler];
    const input = readFloatAccessor(json, bin, sampler.input);
    const output = readFloatAccessor(json, bin, sampler.output);
    for (const t of input.values) {
      durationSeconds = Math.max(durationSeconds, t);
    }
    const node = json.nodes[channel.target.node];
    return {
      nodeName: node?.name ?? `node_${channel.target.node}`,
      path: channel.target.path,
      interpolation: sampler.interpolation ?? 'LINEAR',
      times: input.values,
      values: output.values,
      itemSize: output.itemSize,
    };
  });
  let rootScale = null;
  for (const node of json.nodes ?? []) {
    const scale = node?.scale;
    if (Array.isArray(scale) && scale.length === 3) {
      const uniform = Math.abs(scale[0] - scale[1]) < 1e-6 && Math.abs(scale[1] - scale[2]) < 1e-6;
      if (uniform) {
        rootScale = scale[0];
      }
    }
  }
  return { name: animation.name ?? '', durationSeconds, rootScale, channels };
}

/**
 * Rebuild the Waddle clip on a new skeleton: quaternion tracks verbatim,
 * position tracks scaled into the variant's bind-pose space, same timing.
 * Throws (never half-builds) on a wrong clip, a broken root-scale assumption,
 * unresolvable bone names, or an unsupported channel path.
 */
export function buildRetargetedClip(skeletonRoot, animation) {
  if (animation.name !== EXPECTED_CLIP_NAME) {
    throw new Error(`Expected a "${EXPECTED_CLIP_NAME}" clip, found "${animation.name}".`);
  }
  if (animation.durationSeconds < CLIP_MIN_SECONDS || animation.durationSeconds > CLIP_MAX_SECONDS) {
    throw new Error(`Waddle duration ${animation.durationSeconds.toFixed(3)} s is outside 0.79-0.81 s.`);
  }
  const missing = [];
  const tracks = [];
  for (const channel of animation.channels) {
    const node = skeletonRoot.getObjectByName(channel.nodeName);
    if (node === undefined || node === null) {
      missing.push(channel.nodeName);
      continue;
    }
    if (channel.path === 'translation') {
      const scaled = new Float32Array(channel.values.length);
      for (let i = 0; i < scaled.length; i += 1) {
        scaled[i] = channel.values[i] * POSITION_TRACK_SCALE;
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
  if (missing.length > 0) {
    const names = [...new Set(missing)].join(', ');
    throw new Error(`Waddle retarget: ${missing.length} channels target missing bones: ${names}.`);
  }
  return new THREE.AnimationClip(EXPECTED_CLIP_NAME, animation.durationSeconds, tracks);
}

/** Find the script-relative Blender Draco pass (scripts/bake-trike-variant.py). */
function blenderArgs(tmpIn, tmpOut) {
  return ['--background', '--python', BLENDER_SCRIPT, '--', tmpIn, tmpOut];
}

/**
 * Run the full bake. Options: prevGlbPath (Waddle donor), outPath (final
 * Draco GLB), blenderBin (default `blender`, TRIKE_BLENDER_BIN overrides),
 * keepTemp (debug). Resolves with a summary; rejects with a clear error and
 * never leaves a half-written outPath.
 */
export async function bakeTrikeVariant(options = {}) {
  const prevGlbPath = options.prevGlbPath ?? DEFAULT_GLB;
  const outPath = options.outPath ?? DEFAULT_GLB;
  const blenderBin = options.blenderBin ?? process.env['TRIKE_BLENDER_BIN'] ?? 'blender';
  const prevBytes = await readFile(prevGlbPath);
  const prevAnim = extractAnimationTracks(prevBytes);
  if (prevAnim.rootScale === null || Math.abs(prevAnim.rootScale - OLD_ROOT_SCALE) > ROOT_SCALE_TOLERANCE) {
    throw new Error(
      `Previous GLB root scale is ${prevAnim.rootScale ?? 'unknown'}, expected ${OLD_ROOT_SCALE}: ` +
        'position tracks are not in authored space, refusing to guess the retarget scale.',
    );
  }
  const group = createVariantGroup();
  const clip = buildRetargetedClip(group, prevAnim);
  const exporter = new GLTFExporter();
  const exported = await exporter.parseAsync(group, { binary: true, animations: [clip] });
  const tmpIn = join(tmpdir(), `trike-baby-uncompressed-${process.pid}.glb`);
  // Blender appends `.glb` when the export path lacks it, so the temp name
  // keeps the suffix: the next run overwrites any stranded temp, then the
  // atomic rename moves it into place (never a half-written outPath).
  const tmpOut = `${outPath}.draco-tmp.glb`;
  await writeFile(tmpIn, new Uint8Array(exported));
  try {
    const result = spawnSync(blenderBin, blenderArgs(tmpIn, tmpOut), { stdio: 'inherit' });
    if (result.error !== undefined) {
      throw new Error(
        `Could not launch Blender (${result.error.message}). Install Blender 4.x on PATH ` +
          `or set TRIKE_BLENDER_BIN / --blender. Uncompressed export kept at ${tmpIn}.`,
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
    if (arg === '--prev' && i + 1 < argv.length) {
      options.prevGlbPath = resolve(argv[i + 1]);
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
      throw new Error(`Unknown argument "${arg}". Usage: node scripts/bake-trike-variant.js [--prev <glb>] [--out <glb>] [--blender <bin>] [--keep-temp].`);
    }
  }
  return options;
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const summary = await bakeTrikeVariant(parseArgs(process.argv.slice(2)));
    console.log(
      `bake-trike-variant: wrote ${summary.outPath} (Waddle ${summary.durationSeconds.toFixed(3)} s, ${summary.trackCount} tracks).`,
    );
  } catch (error) {
    console.error(`bake-trike-variant: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
