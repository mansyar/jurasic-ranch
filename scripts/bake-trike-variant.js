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

/** Read one glTF animation into the channel shape the bakes consume. */
function readAnimation(json, bin, animation) {
  let durationSeconds = 0;
  const channels = (animation.channels ?? []).map((channel) => {
    const sampler = animation.samplers?.[channel.sampler];
    if (sampler === undefined) {
      throw new Error(`Clip "${animation.name ?? ''}" references a missing sampler.`);
    }
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
  return { name: animation.name ?? '', durationSeconds, channels };
}

/**
 * Every animation in raw GLB bytes, in file order. Polyfork ships its authored
 * `Idle`/`Walk`/`Run` set only inside the published GLB, so the Stego and
 * Brachio bakes read the clips from here. Animation samplers are never
 * Draco-compressed, so this works on the published file and on a shipped one.
 */
export function extractAnimationClips(bytes) {
  const { json, bin } = parseGlb(bytes);
  const animations = json.animations ?? [];
  if (animations.length === 0) {
    throw new Error('Source GLB carries no animations; nothing to graft.');
  }
  return animations.map((animation) => readAnimation(json, bin, animation));
}

/**
 * Extract the first animation's channels from raw GLB bytes, plus the uniform
 * root scale the Trike retarget validates.
 */
export function extractAnimationTracks(bytes) {
  const { json, bin } = parseGlb(bytes);
  const animations = json.animations ?? [];
  if (animations.length === 0) {
    throw new Error('Source GLB carries no animations; cannot retarget Waddle.');
  }
  const animation = readAnimation(json, bin, animations[0]);
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
  return {
    name: animation.name,
    durationSeconds: animation.durationSeconds,
    rootScale,
    channels: animation.channels,
  };
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

/**
 * The published GLB must carry exactly the authored clip set this game ships —
 * no missing clip (nothing to graft) and no extra one (a clip nobody plays is
 * bytes we would carry and never use).
 */
function assertAuthoredClipSet(animations, requiredClipNames) {
  const found = animations.map((animation) => animation.name);
  const missingClips = requiredClipNames.filter((name) => !found.includes(name));
  if (missingClips.length > 0) {
    throw new Error(
      `Authored GLB is missing clip(s) ${missingClips.join(', ')}; it carries ${found.join(', ') || 'none'}.`,
    );
  }
  const unexpectedClips = found.filter((name) => !requiredClipNames.includes(name));
  if (unexpectedClips.length > 0) {
    throw new Error(
      `Authored GLB carries clip(s) ${unexpectedClips.join(', ')} that this game does not ship; ` +
        'decide what to do with them rather than dropping them silently.',
    );
  }
}

/**
 * glTF sampler interpolation → three's track interpolation. `CUBICSPLINE` is
 * deliberately absent: its sampler values are in-tangent / point / out-tangent
 * triplets, so copying them into a linear track would misread every key.
 */
const TRACK_INTERPOLATION = {
  LINEAR: THREE.InterpolateLinear,
  STEP: THREE.InterpolateDiscrete,
};

/**
 * Graft authored clips from a Polyfork GLB onto a freshly baked skeleton.
 * Shared by the Stego and Brachio bakes.
 *
 * Copies `translation` and `rotation` channels only — the authored clips carry
 * no other path — and keeps each clip's name, order, duration, keyframe times
 * and values exactly as published: no rescale, no retime, no synthesised scale
 * track. A glTF translation channel is an ABSOLUTE local translation, so
 * rescaling one drags the bone off its rest offset rather than adjusting a
 * step: that was the donor transfer's bug, and this function exists to make it
 * impossible.
 *
 * Throws — before the caller writes anything — when a clip names a bone the
 * baked rig lacks (every missing bone is listed), when a channel targets
 * another path, when a sampler is not LINEAR or STEP, or when the GLB's clip
 * set is not exactly `requiredClipNames`.
 */
export function graftAuthoredClips(skeletonRoot, animations, options = {}) {
  assertAuthoredClipSet(animations, options.requiredClipNames ?? ['Idle', 'Walk', 'Run']);
  const missingBones = new Set();
  const clips = [];
  for (const animation of animations) {
    const tracks = [];
    for (const channel of animation.channels) {
      if (skeletonRoot.getObjectByName(channel.nodeName) == null) {
        missingBones.add(channel.nodeName);
        continue;
      }
      const interpolation = TRACK_INTERPOLATION[channel.interpolation];
      if (interpolation === undefined) {
        throw new Error(
          `Clip "${animation.name}" samples "${channel.nodeName}" with ${channel.interpolation} ` +
            'interpolation; the graft copies keys verbatim, so only LINEAR and STEP survive it.',
        );
      }
      const trackName = `${channel.nodeName}.${channel.path === 'translation' ? 'position' : 'quaternion'}`;
      if (channel.path === 'translation') {
        if (channel.itemSize !== 3) {
          throw new Error(`Translation channel on "${channel.nodeName}" carries ${channel.itemSize} values, expected 3.`);
        }
        const track = new THREE.VectorKeyframeTrack(trackName, channel.times.slice(), channel.values.slice());
        track.setInterpolation(interpolation);
        tracks.push(track);
      } else if (channel.path === 'rotation') {
        if (channel.itemSize !== 4) {
          throw new Error(`Rotation channel on "${channel.nodeName}" carries ${channel.itemSize} values, expected 4.`);
        }
        const track = new THREE.QuaternionKeyframeTrack(trackName, channel.times.slice(), channel.values.slice());
        track.setInterpolation(interpolation);
        tracks.push(track);
      } else {
        throw new Error(
          `Clip "${animation.name}" channels "${channel.path}" on "${channel.nodeName}"; ` +
            'only translation and rotation are grafted, and neither is synthesised.',
        );
      }
    }
    clips.push(new THREE.AnimationClip(animation.name, animation.durationSeconds, tracks));
  }
  if (missingBones.size > 0) {
    throw new Error(
      `Grafted clips name ${missingBones.size} bone(s) the baked rig lacks: ${[...missingBones].sort().join(', ')}. ` +
        'The vendored module no longer builds the skeleton the clips were authored on.',
    );
  }
  return clips;
}

/**
 * Serialise a glTF JSON document and its BIN chunk into a GLB (version 2).
 *
 * The JSON chunk is padded with spaces and the BIN chunk with zeros, as the
 * container requires. Nothing here writes a timestamp or a producer string, so
 * the same document always serialises to the same bytes.
 */
export function writeGlb(json, bin) {
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPad > 0) {
    const padded = new Uint8Array(jsonBytes.length + jsonPad).fill(0x20);
    padded.set(jsonBytes);
    jsonBytes = padded;
  }
  let binBytes = bin;
  const binPad = (4 - (binBytes.length % 4)) % 4;
  if (binPad > 0) {
    const padded = new Uint8Array(binBytes.length + binPad);
    padded.set(binBytes);
    binBytes = padded;
  }
  const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, JSON_CHUNK_TYPE, true);
  out.set(jsonBytes, 20);
  view.setUint32(20 + jsonBytes.length, binBytes.length, true);
  view.setUint32(24 + jsonBytes.length, BIN_CHUNK_TYPE, true);
  out.set(binBytes, 28 + jsonBytes.length);
  return out;
}

/**
 * Inject the authored animations into an exported GLB by editing its JSON chunk.
 *
 * The clips are deliberately NOT routed through `GLTFExporter`: it re-times
 * keyframes to its 24 fps default — a 2.4 s authored cycle shipped as 2.375 s
 * (57 frames) with 289 keys collapsed to 58 — and it emits TRS for every
 * animated node even when only two paths were supplied, which is how a 48
 * channel clip became 72. Here every authored channel keeps its sampler's key
 * times, values and interpolation byte for byte; only `target.node` is remapped,
 * by joint NAME, from the authored node indices to the exported ones. Channels
 * are copied for `translation` and `rotation` only — no scale track is
 * synthesised.
 *
 * Throws, before the caller writes anything, when the exported GLB lacks an
 * animated bone (every missing name is listed), when two exported nodes share a
 * name a clip targets, or when the authored clip set is not exactly
 * `requiredClipNames`.
 */
export function injectGlbAnimations(glbBytes, authored, options = {}) {
  const { json, bin } = parseGlb(glbBytes);
  assertAuthoredClipSet(authored, options.requiredClipNames ?? ['Idle', 'Walk', 'Run']);
  const nodeIndexByName = new Map();
  const nodes = json.nodes ?? [];
  for (let index = 0; index < nodes.length; index += 1) {
    const name = nodes[index]?.name;
    if (name === undefined) {
      continue;
    }
    if (nodeIndexByName.has(name)) {
      throw new Error(`Exported GLB has two nodes named "${name}"; refusing to guess which one a clip targets.`);
    }
    nodeIndexByName.set(name, index);
  }
  const bufferViews = json.bufferViews ?? (json.bufferViews = []);
  const accessors = json.accessors ?? (json.accessors = []);
  const pieces = [];
  let cursor = Math.ceil(bin.byteLength / 4) * 4;
  const appendAccessor = (values, type) => {
    const itemSize = ACCESSOR_ITEM_SIZE[type];
    const byteOffset = cursor;
    pieces.push(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
    cursor += values.byteLength;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: values.byteLength });
    const accessor = {
      bufferView: bufferViews.length - 1,
      componentType: FLOAT_COMPONENT,
      count: values.length / itemSize,
      type,
    };
    if (type === 'SCALAR') {
      accessor.min = [Math.min(...values)];
      accessor.max = [Math.max(...values)];
    }
    accessors.push(accessor);
    return accessors.length - 1;
  };
  const missingBones = new Set();
  const animations = [];
  for (const animation of authored) {
    const samplers = [];
    const channels = [];
    for (const channel of animation.channels) {
      if (channel.path !== 'translation' && channel.path !== 'rotation') {
        throw new Error(
          `Authored clip "${animation.name}" channels "${channel.path}" on "${channel.nodeName}"; ` +
            'only translation and rotation are carried, and neither is synthesised.',
        );
      }
      if (channel.interpolation !== 'LINEAR' && channel.interpolation !== 'STEP') {
        throw new Error(
          `Authored clip "${animation.name}" samples "${channel.nodeName}" with ${channel.interpolation} ` +
            'interpolation; the keys are copied verbatim, so only LINEAR and STEP survive it.',
        );
      }
      const node = nodeIndexByName.get(channel.nodeName);
      if (node === undefined) {
        missingBones.add(channel.nodeName);
        continue;
      }
      const input = appendAccessor(channel.times, 'SCALAR');
      const output = appendAccessor(channel.values, channel.path === 'translation' ? 'VEC3' : 'VEC4');
      channels.push({ sampler: samplers.length, target: { node, path: channel.path } });
      samplers.push({ input, output, interpolation: channel.interpolation });
    }
    animations.push({ name: animation.name, channels, samplers });
  }
  if (missingBones.size > 0) {
    throw new Error(
      `Injected clips name ${missingBones.size} bone(s) the exported rig lacks: ${[...missingBones].sort().join(', ')}. ` +
        'The exported skeleton is not the one the clips were authored on.',
    );
  }
  const injected = new Uint8Array(Math.ceil(cursor / 4) * 4);
  injected.set(bin, 0);
  let offset = Math.ceil(bin.byteLength / 4) * 4;
  for (const piece of pieces) {
    injected.set(piece, offset);
    offset += piece.byteLength;
  }
  json.animations = animations;
  json.buffers = [{ byteLength: injected.length }];
  return writeGlb(json, injected);
}

/**
 * Read a written GLB back and prove the authored clips survived: same names in
 * the same order, same channel count, same total keyframe count, the same
 * duration to the microsecond, and no path besides translation and rotation.
 */
export function assertAuthoredClipsPreserved(glbBytes, authored) {
  const shipped = extractAnimationClips(glbBytes);
  assertAuthoredClipSet(
    shipped,
    authored.map((animation) => animation.name),
  );
  const countKeys = (channels) => channels.reduce((total, channel) => total + channel.times.length, 0);
  for (let index = 0; index < authored.length; index += 1) {
    const want = authored[index];
    const got = shipped[index];
    if (got.name !== want.name) {
      throw new Error(`Clip ${index} is "${got.name}" in the written GLB, expected "${want.name}".`);
    }
    if (got.channels.length !== want.channels.length) {
      throw new Error(
        `Clip "${want.name}" has ${got.channels.length} channels, expected ${want.channels.length}.`,
      );
    }
    if (countKeys(got.channels) !== countKeys(want.channels)) {
      throw new Error(
        `Clip "${want.name}" carries ${countKeys(got.channels)} keyframes, expected ${countKeys(want.channels)}; ` +
          'something resampled the authored timing.',
      );
    }
    if (Math.abs(got.durationSeconds - want.durationSeconds) > 1e-6) {
      throw new Error(
        `Clip "${want.name}" is ${got.durationSeconds} s, expected ${want.durationSeconds} s; ` +
          'something resampled the authored timing.',
      );
    }
    for (const channel of got.channels) {
      if (channel.path !== 'translation' && channel.path !== 'rotation') {
        throw new Error(`Clip "${want.name}" carries a "${channel.path}" channel; only translation and rotation ship.`);
      }
    }
  }
  return shipped;
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
