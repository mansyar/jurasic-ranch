#!/usr/bin/env node
/**
 * Inspect the dino GLBs: rig, rest pose, authored clips and frame-0 displacement
 * (track 20261029-authored-dino-walk-clips, Phase 1).
 *
 * Phase 1 has to answer one question before any clip is grafted: does a fresh
 * `createAsset()` bake at authored proportions (`size: 1.0`) share the rest pose
 * of the official Polyfork GLB? If it does not, the authored `Idle`/`Walk`/`Run`
 * clips would drag every bone off its rest offset exactly as the Trike donor
 * clip does today. This script measures it joint by joint instead of assuming.
 *
 * It reads uncompressed and Draco-compressed GLBs alike: animation samplers and
 * node TRS are never Draco-compressed, so a plain JSON + BIN scan is enough.
 *
 * Usage:
 *   node scripts/vendor/inspect-dino-clips.mjs [--only <stego|brachio>]
 *     [--evidence-dir <dir>] [--skip-bake]
 *
 * Defaults: --evidence-dir is `.conductor/evidence/phase-1` (gitignored), and
 * the official GLBs are expected there as `<species>-base.glb`:
 *
 *   curl -L -o .conductor/evidence/phase-1/stegosaurus-base.glb \
 *     https://polyfork.dev/cdn/stegosaurus-base.glb
 *   curl -L -o .conductor/evidence/phase-1/brachiosaurus-base.glb \
 *     https://polyfork.dev/cdn/brachiosaurus-base.glb
 *
 * For each species the script prints a markdown joint table, the MATCH /
 * MISMATCH verdict, the official clips' facts, and the shipped GLB's per-bone
 * frame-0 displacement (the AC-2 baseline). It writes `<species>-report.json`
 * beside the GLBs. Exit code is 1 when any species is a MISMATCH, so a wrong
 * rig fails loudly rather than scrolling past.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { parseGlb } from '../bake-trike-variant.js';
import { STEGO_VARIANT_PARAMS } from './bake-stego-variant.js';
import { BRACHIO_VARIANT_PARAMS } from './bake-brachio-variant.js';
import { createAsset as createStegoAsset } from './stegosaurus-base.mjs';
import { createAsset as createBrachioAsset } from './brachiosaurus-base.mjs';

/**
 * Node has no FileReader, which three's GLTFExporter uses to assemble the
 * binary GLB (readAsArrayBuffer + onloadend). Same guarded polyfill the bake
 * scripts use; browsers keep the native implementation.
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
const DEFAULT_EVIDENCE_DIR = join(REPO_ROOT, '.conductor', 'evidence', 'phase-1');
const SHIPPED_MODEL_DIR = join(REPO_ROOT, 'public', 'models');

/** Authored proportions. Gameplay size is a viewer group scale, never a bake knob. */
export const AUTHORED_SIZE = 1;

/** MATCH bounds, from the phase brief: 1 mm of translation, 0.1 deg of rotation. */
export const MATCH_TRANSLATION_METRES = 1e-3;
export const MATCH_ROTATION_DEGREES = 0.1;

const GLB_FLOAT = 5126;
const ACCESSOR_ITEM_SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/**
 * Module knobs that change geometry or the bind skeleton rather than colour.
 * They are dropped for the comparison bake so the module's own defaults apply
 * and only `size: 1.0` is forced; colour never moves a bone.
 */
const GEOMETRY_KNOBS = new Set(['size', 'plates', 'plateSize', 'tail', 'neck', 'head']);

/**
 * Per-species wiring. `officialFile` matches the CDN filename so the download
 * command above is a straight `curl -o`.
 */
export const SPECIES = {
  stego: {
    officialFile: 'stegosaurus-base.glb',
    shippedFile: 'stego.glb',
    params: STEGO_VARIANT_PARAMS,
    createAsset: createStegoAsset,
  },
  brachio: {
    officialFile: 'brachiosaurus-base.glb',
    shippedFile: 'brachio.glb',
    params: BRACHIO_VARIANT_PARAMS,
    createAsset: createBrachioAsset,
  },
};

function asVec3(value, fallback) {
  if (Array.isArray(value) && value.length === 3) {
    return [value[0], value[1], value[2]];
  }
  return [...fallback];
}

function asVec4(value, fallback) {
  if (Array.isArray(value) && value.length === 4) {
    return [value[0], value[1], value[2], value[3]];
  }
  return [...fallback];
}

/**
 * Read a FLOAT accessor into a flat array. Animation samplers are never
 * interleaved or Draco-compressed, so the simple path is the correct one; any
 * other layout throws rather than guessing.
 */
export function readFloatAccessor(json, bin, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  if (accessor === undefined) {
    throw new Error(`Accessor ${accessorIndex} is missing.`);
  }
  if (accessor.componentType !== GLB_FLOAT) {
    throw new Error(`Accessor ${accessorIndex} is not FLOAT (${accessor.componentType}); refusing to guess.`);
  }
  const itemSize = ACCESSOR_ITEM_SIZE[accessor.type];
  if (itemSize === undefined) {
    throw new Error(`Accessor ${accessorIndex} has unsupported type "${accessor.type}".`);
  }
  if (accessor.bufferView === undefined) {
    throw new Error(`Accessor ${accessorIndex} has no bufferView; sparse accessors are unsupported.`);
  }
  const bufferView = json.bufferViews[accessor.bufferView];
  if (bufferView.byteStride !== undefined && bufferView.byteStride !== 0) {
    throw new Error(`Accessor ${accessorIndex} is interleaved; not supported.`);
  }
  const byteOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const view = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const values = new Float32Array(accessor.count * itemSize);
  for (let i = 0; i < values.length; i += 1) {
    values[i] = view.getFloat32(byteOffset + i * 4, true);
  }
  return { values, itemSize, count: accessor.count };
}

/**
 * Resolve the skeleton: every skin joint with its local rest TRS, its parent
 * name, and the magnitude of its local rest translation (its rest distance to
 * the parent, which is the denominator the displacement envelope divides by).
 */
export function readRig(bytes) {
  const { json } = parseGlb(bytes);
  const nodes = json.nodes ?? [];
  const parentIndices = new Array(nodes.length).fill(-1);
  nodes.forEach((node, index) => {
    for (const child of node.children ?? []) {
      parentIndices[child] = index;
    }
  });
  const jointIndices = new Set();
  for (const skin of json.skins ?? []) {
    for (const joint of skin.joints ?? []) {
      jointIndices.add(joint);
    }
  }
  const joints = [...jointIndices]
    .sort((a, b) => a - b)
    .map((index) => {
      const node = nodes[index];
      const parentIndex = parentIndices[index];
      const local = localTransform(node);
      const translation = local.translation;
      return {
        index,
        name: node.name ?? `node_${index}`,
        parent: parentIndex === -1 ? null : (nodes[parentIndex].name ?? `node_${parentIndex}`),
        translation,
        rotation: local.rotation,
        scale: local.scale,
        restDistanceMetres: Math.hypot(translation[0], translation[1], translation[2]),
      };
    });
  return {
    joints,
    nodeCount: nodes.length,
    skinCount: (json.skins ?? []).length,
    meshCount: (json.meshes ?? []).length,
    materialCount: (json.materials ?? []).length,
    animationNames: (json.animations ?? []).map((animation) => animation.name ?? ''),
    hasSkin: (json.skins ?? []).length > 0,
  };
}

/**
 * Local rest transform of a node, as translation/rotation/scale.
 *
 * A glTF node carries EITHER `translation`/`rotation`/`scale` OR a single
 * column-major `matrix`. three's GLTFExporter writes bones as `matrix`, while
 * Polyfork's published files carry TRS, so reading `node.translation` alone
 * silently yields zeros for every bone of a baked file — which reads as a total
 * rig mismatch when the rigs are in fact identical.
 */
export function localTransform(node) {
  if (node.translation || node.rotation || node.scale) {
    return {
      translation: asVec3(node.translation, [0, 0, 0]),
      rotation: asVec4(node.rotation, [0, 0, 0, 1]),
      scale: asVec3(node.scale, [1, 1, 1]),
    };
  }
  if (!node.matrix) {
    return { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
  }
  const m = node.matrix;
  const translation = [m[12], m[13], m[14]];
  const sx = Math.hypot(m[0], m[1], m[2]) || 1;
  const sy = Math.hypot(m[4], m[5], m[6]) || 1;
  const sz = Math.hypot(m[8], m[9], m[10]) || 1;
  const r00 = m[0] / sx;
  const r10 = m[1] / sx;
  const r20 = m[2] / sx;
  const r01 = m[4] / sy;
  const r11 = m[5] / sy;
  const r21 = m[6] / sy;
  const r02 = m[8] / sz;
  const r12 = m[9] / sz;
  const r22 = m[10] / sz;
  const trace = r00 + r11 + r22;
  let x;
  let y;
  let z;
  let w;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (r21 - r12) / s;
    y = (r02 - r20) / s;
    z = (r10 - r01) / s;
  } else if (r00 > r11 && r00 > r22) {
    const s = Math.sqrt(1 + r00 - r11 - r22) * 2;
    w = (r21 - r12) / s;
    x = 0.25 * s;
    y = (r01 + r10) / s;
    z = (r02 + r20) / s;
  } else if (r11 > r22) {
    const s = Math.sqrt(1 + r11 - r00 - r22) * 2;
    w = (r02 - r20) / s;
    x = (r01 + r10) / s;
    y = 0.25 * s;
    z = (r12 + r21) / s;
  } else {
    const s = Math.sqrt(1 + r22 - r00 - r11) * 2;
    w = (r10 - r01) / s;
    x = (r02 + r20) / s;
    y = (r12 + r21) / s;
    z = 0.25 * s;
  }
  return { translation, rotation: [x, y, z, w], scale: [sx, sy, sz] };
}

/** Angle between two unit quaternions, in degrees (sign-agnostic). */
export function quaternionAngleDegrees(a, b) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const clamped = Math.min(1, Math.abs(dot));
  return (2 * Math.acos(clamped) * 180) / Math.PI;
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function lengthOf(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

/**
 * Diff two rigs joint by joint, matched by node name. A joint missing on either
 * side is a MISMATCH by itself: a grafted clip naming that bone would have
 * nowhere to land.
 */
export function compareRigs(officialBytes, moduleBytes, options = {}) {
  const translationTolerance = options.translationToleranceMetres ?? MATCH_TRANSLATION_METRES;
  const rotationTolerance = options.rotationToleranceDegrees ?? MATCH_ROTATION_DEGREES;
  const official = readRig(officialBytes);
  const module = readRig(moduleBytes);
  const moduleByName = new Map(module.joints.map((joint) => [joint.name, joint]));
  const officialNames = new Set(official.joints.map((joint) => joint.name));
  const rows = [];
  const missingInModule = [];
  for (const joint of official.joints) {
    const other = moduleByName.get(joint.name);
    if (other === undefined) {
      missingInModule.push(joint.name);
      continue;
    }
    const delta = subtract(other.translation, joint.translation);
    const deltaLength = lengthOf(delta);
    const scaleDelta = lengthOf(subtract(other.scale, joint.scale));
    rows.push({
      name: joint.name,
      parent: joint.parent,
      parentMatches: joint.parent === other.parent,
      officialTranslation: joint.translation,
      moduleTranslation: other.translation,
      delta,
      deltaMetres: deltaLength,
      restDistanceMetres: joint.restDistanceMetres,
      deltaFractionOfRestDistance:
        joint.restDistanceMetres > 0 ? deltaLength / joint.restDistanceMetres : null,
      rotationDeltaDegrees: quaternionAngleDegrees(joint.rotation, other.rotation),
      scaleDelta,
    });
  }
  const extraInModule = module.joints
    .filter((joint) => !officialNames.has(joint.name))
    .map((joint) => joint.name);
  const outside = rows.filter(
    (row) => row.deltaMetres > translationTolerance || row.rotationDeltaDegrees > rotationTolerance,
  );
  const parentDiffs = rows.filter((row) => !row.parentMatches).map((row) => row.name);
  const scaleDiffs = rows.filter((row) => row.scaleDelta > translationTolerance).map((row) => row.name);
  const verdict = missingInModule.length === 0 && extraInModule.length === 0 && outside.length === 0
    ? 'MATCH'
    : 'MISMATCH';
  return {
    verdict,
    translationToleranceMetres: translationTolerance,
    rotationToleranceDegrees: rotationTolerance,
    jointCounts: { official: official.joints.length, module: module.joints.length },
    rows,
    missingInModule,
    extraInModule,
    outsideBounds: outside.map((row) => row.name),
    parentDiffs,
    scaleDiffs,
    official,
    module,
  };
}

/**
 * Each clip's name, duration, channel count, keyframe count and the bones it
 * drives, split by target path. Durations come from the sampler inputs, which
 * are the authored times; nothing is inferred from a frame rate.
 */
export function clipFacts(bytes) {
  const { json, bin } = parseGlb(bytes);
  const nodes = json.nodes ?? [];
  return (json.animations ?? []).map((animation) => {
    let durationSeconds = 0;
    let keyframes = 0;
    const pathCounts = {};
    const bones = new Set();
    for (const channel of animation.channels ?? []) {
      const sampler = animation.samplers?.[channel.sampler];
      if (sampler === undefined) {
        throw new Error(`Clip "${animation.name}" references a missing sampler.`);
      }
      const input = readFloatAccessor(json, bin, sampler.input);
      for (const time of input.values) {
        durationSeconds = Math.max(durationSeconds, time);
      }
      keyframes = Math.max(keyframes, input.count);
      const path = channel.target.path ?? 'unknown';
      pathCounts[path] = (pathCounts[path] ?? 0) + 1;
      const target = nodes[channel.target.node];
      bones.add(target?.name ?? `node_${channel.target.node}`);
    }
    return {
      name: animation.name ?? '',
      durationSeconds,
      channelCount: (animation.channels ?? []).length,
      keyframes,
      pathCounts,
      bones: [...bones].sort(),
    };
  });
}

/**
 * Per-bone frame-0 displacement: the clip's first translation keyframe minus
 * the bone's rest translation, both local. glTF translation channels are
 * absolute local translations, so any non-zero result is the bone being pulled
 * off its rest offset. `null` fraction means the bone sits on its parent (rest
 * distance 0), where a ratio is meaningless and only the absolute bound applies.
 */
export function displacementRows(bytes, options = {}) {
  const { json, bin } = parseGlb(bytes);
  const rig = readRig(bytes);
  const jointByIndex = new Map(rig.joints.map((joint) => [joint.index, joint]));
  const animations = json.animations ?? [];
  if (animations.length === 0) {
    throw new Error('GLB carries no animations; nothing to measure.');
  }
  const animation = options.clipName === undefined
    ? animations[0]
    : animations.find((candidate) => candidate.name === options.clipName);
  if (animation === undefined) {
    const names = animations.map((candidate) => candidate.name ?? '').join(', ');
    throw new Error(`Clip "${options.clipName}" not found; the GLB carries: ${names}.`);
  }
  const rows = [];
  for (const channel of animation.channels ?? []) {
    if (channel.target.path !== 'translation') {
      continue;
    }
    const joint = jointByIndex.get(channel.target.node);
    if (joint === undefined) {
      continue;
    }
    const sampler = animation.samplers[channel.sampler];
    const output = readFloatAccessor(json, bin, sampler.output);
    const firstFrame = [output.values[0], output.values[1], output.values[2]];
    const delta = subtract(firstFrame, joint.translation);
    const deltaLength = lengthOf(delta);
    rows.push({
      name: joint.name,
      restTranslation: joint.translation,
      firstFrameTranslation: firstFrame,
      delta,
      deltaMetres: deltaLength,
      restDistanceMetres: joint.restDistanceMetres,
      deltaFractionOfRestDistance:
        joint.restDistanceMetres > 0 ? deltaLength / joint.restDistanceMetres : null,
    });
  }
  rows.sort((a, b) => b.deltaMetres - a.deltaMetres);
  return { clipName: animation.name ?? '', rows };
}

/**
 * Bake a vendored module at authored proportions for the comparison. Only the
 * colour knobs survive from the pinned variant params, so the module's own
 * geometry defaults apply and `size: 1.0` is the single deliberate override.
 * No group scale: the official GLB carries none.
 */
export async function bakeModuleGlb(speciesId, options = {}) {
  const spec = SPECIES[speciesId];
  if (spec === undefined) {
    throw new Error(`Unknown species "${speciesId}"; expected one of ${Object.keys(SPECIES).join(', ')}.`);
  }
  const params = { size: options.size ?? AUTHORED_SIZE };
  for (const [key, value] of Object.entries(spec.params)) {
    if (!GEOMETRY_KNOBS.has(key)) {
      params[key] = value;
    }
  }
  const group = spec.createAsset(params);
  const exporter = new GLTFExporter();
  const exported = await exporter.parseAsync(group, { binary: true });
  if (!(exported instanceof ArrayBuffer)) {
    throw new Error('GLTFExporter did not return a binary GLB.');
  }
  return { bytes: new Uint8Array(exported), params };
}

function fmt(value, digits = 4) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function fmtVec(vector, digits = 4) {
  return vector.map((value) => fmt(value, digits)).join(', ');
}

function fmtFraction(value) {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function markdownTable(headers, rows) {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => row[column].length)));
  const line = (cells) => `| ${cells.map((cell, i) => cell.padEnd(widths[i])).join(' | ')} |`;
  const separator = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`;
  return [line(headers), separator, ...rows.map((row) => line(row))].join('\n');
}

/** Fetch bytes for a comparison. A missing official GLB is a blocker, not a silent skip. */
async function readOfficial(speciesId, evidenceDir) {
  const path = join(evidenceDir, SPECIES[speciesId].officialFile);
  try {
    return { path, bytes: await readFile(path) };
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Official GLB missing at ${path}. Download it first:\n` +
          `  curl -L -o ${path} https://polyfork.dev/cdn/${SPECIES[speciesId].officialFile}`,
      );
    }
    throw error;
  }
}

async function inspectSpecies(speciesId, options) {
  const evidenceDir = options.evidenceDir;
  const official = await readOfficial(speciesId, evidenceDir);
  const modulePath = join(evidenceDir, `${speciesId}-module.glb`);
  let moduleBytes;
  let bakeParams;
  if (options.skipBake === true) {
    moduleBytes = await readFile(modulePath);
  } else {
    const bake = await bakeModuleGlb(speciesId);
    moduleBytes = bake.bytes;
    bakeParams = bake.params;
    await writeFile(modulePath, moduleBytes);
  }
  const shippedPath = join(SHIPPED_MODEL_DIR, SPECIES[speciesId].shippedFile);
  const shippedBytes = await readFile(shippedPath);
  const comparison = compareRigs(official.bytes, moduleBytes);
  const clips = clipFacts(official.bytes);
  const baseline = displacementRows(shippedBytes);
  const report = {
    species: speciesId,
    officialGlb: official.path,
    moduleGlb: modulePath,
    shippedGlb: shippedPath,
    bakeParams,
    verdict: comparison.verdict,
    tolerances: {
      translationMetres: comparison.translationToleranceMetres,
      rotationDegrees: comparison.rotationToleranceDegrees,
    },
    jointCounts: comparison.jointCounts,
    rig: comparison.rows,
    missingInModule: comparison.missingInModule,
    extraInModule: comparison.extraInModule,
    outsideBounds: comparison.outsideBounds,
    parentDiffs: comparison.parentDiffs,
    scaleDiffs: comparison.scaleDiffs,
    clips,
    shippedFrame0Displacement: baseline,
  };
  const reportPath = join(evidenceDir, `${speciesId}-report.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return {
    report,
    reportPath,
    rigTable: markdownTable(
      ['joint', 'parent', 'official rest t', 'module rest t', 'delta (m)', 'delta / rest → parent', 'rest Δrot'],
      comparison.rows.map((row) => [
        row.name,
        row.parent ?? '(root)',
        `(${fmtVec(row.officialTranslation)})`,
        `(${fmtVec(row.moduleTranslation)})`,
        fmt(row.deltaMetres),
        fmtFraction(row.deltaFractionOfRestDistance),
        `${fmt(row.rotationDeltaDegrees, 3)}°`,
      ]),
    ),
    clipTable: markdownTable(
      ['clip', 'duration (s)', 'channels', 'keyframes', 'paths', 'bones covered'],
      clips.map((clip) => [
        clip.name,
        fmt(clip.durationSeconds, 3),
        String(clip.channelCount),
        String(clip.keyframes),
        Object.entries(clip.pathCounts).map(([path, count]) => `${path} ${count}`).join(', '),
        String(clip.bones.length),
      ]),
    ),
    baselineTable: markdownTable(
      ['bone', 'rest t', 'clip[0] t', 'displacement (m)', 'rest → parent (m)', 'fraction'],
      baseline.rows.map((row) => [
        row.name,
        `(${fmtVec(row.restTranslation)})`,
        `(${fmtVec(row.firstFrameTranslation)})`,
        fmt(row.deltaMetres),
        fmt(row.restDistanceMetres),
        fmtFraction(row.deltaFractionOfRestDistance),
      ]),
    ),
  };
}

function parseArgs(argv) {
  const options = { evidenceDir: DEFAULT_EVIDENCE_DIR, skipBake: false, only: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--evidence-dir' && i + 1 < argv.length) {
      options.evidenceDir = resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--only' && i + 1 < argv.length) {
      options.only = argv[i + 1];
      i += 1;
    } else if (arg === '--skip-bake') {
      options.skipBake = true;
    } else {
      throw new Error(
        `Unknown argument "${arg}". Usage: node scripts/vendor/inspect-dino-clips.mjs ` +
          '[--only <stego|brachio>] [--evidence-dir <dir>] [--skip-bake].',
      );
    }
  }
  return options;
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const ids = options.only === undefined ? Object.keys(SPECIES) : [options.only];
    if (options.only !== undefined && SPECIES[options.only] === undefined) {
      throw new Error(`Unknown species "${options.only}"; expected stego or brachio.`);
    }
    await mkdir(options.evidenceDir, { recursive: true });
    const results = [];
    for (const speciesId of ids) {
      results.push([speciesId, await inspectSpecies(speciesId, options)]);
    }
    for (const [speciesId, result] of results) {
      const { report } = result;
      console.log(`\n## ${speciesId} — official vs module bake\n`);
      console.log(`Official: ${report.officialGlb}`);
      console.log(`Module:   ${report.moduleGlb}`);
      console.log(`Shipped:  ${report.shippedGlb}\n`);
      console.log(`Joints: ${report.jointCounts.official} official, ${report.jointCounts.module} module\n`);
      console.log(result.rigTable);
      if (report.missingInModule.length > 0) {
        console.log(`\nMissing in module: ${report.missingInModule.join(', ')}`);
      }
      if (report.extraInModule.length > 0) {
        console.log(`\nExtra in module: ${report.extraInModule.join(', ')}`);
      }
      if (report.parentDiffs.length > 0) {
        console.log(`\nParent chain differs on: ${report.parentDiffs.join(', ')}`);
      }
      if (report.scaleDiffs.length > 0) {
        console.log(`\nRest scale differs on: ${report.scaleDiffs.join(', ')}`);
      }
      console.log(
        `\nVerdict: ${report.verdict}` +
          ` (bound ${fmt(report.tolerances.translationMetres)} m, ${fmt(report.tolerances.rotationDegrees, 3)}°)` +
          (report.outsideBounds.length > 0 ? ` — outside bounds: ${report.outsideBounds.join(', ')}` : ''),
      );
      console.log(`\n### ${speciesId} — official clips\n`);
      console.log(result.clipTable);
      console.log(`\n### ${speciesId} — shipped GLB frame-0 displacement (AC-2 baseline)\n`);
      console.log(result.baselineTable);
      console.log(`\nReport: ${result.reportPath}\n`);
    }
    const mismatched = results.filter(([, result]) => result.report.verdict !== 'MATCH');
    if (mismatched.length > 0) {
      console.error(`inspect-dino-clips: MISMATCH for ${mismatched.map(([id]) => id).join(', ')}.`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`inspect-dino-clips: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
