import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * Budget: the baked Brachio carries Polyfork's authored clips over all 35
 * bones, which are dense uncompressed glTF float data (120k keys across the
 * three). NFR-2 sets the app-wide offline precache budget; Phase 6 audits the
 * total, this caps the one file against a runaway bake.
 */
const MAX_BYTES = 3 * 1024 * 1024;
/** Authored clip lengths in seconds, as published (AC-1). */
const CLIP_SECONDS = [
  ['Idle', 8],
  ['Walk', 3.8],
  ['Run', 2.5],
] as const;
/** 35 bones x translation + rotation: the authored channel count. */
const CHANNELS_PER_CLIP = 70;
/** Authored proportions: the Polyfork reference is ~12.5 m tip-to-tail. */
const MIN_LENGTH_METRES = 11.5;
const MAX_LENGTH_METRES = 13.5;
/** Upright head carriage at ~12.2 m (the default neck, not the grazing carve). */
const MIN_HEAD_METRES = 11.5;
const MAX_HEAD_METRES = 13;

const BRACHIO_URL = new URL('../public/models/brachio.glb', import.meta.url);

interface GlbAccessor {
  bufferView?: number;
  byteOffset?: number;
  count: number;
  min?: number[];
  max?: number[];
}

interface GlbBufferView {
  byteOffset?: number;
}

interface GlbPrimitive {
  attributes: Record<string, number>;
}

interface GlbMesh {
  primitives: GlbPrimitive[];
}

interface GlbMaterial {
  name?: string;
}

interface GlbSampler {
  input: number;
}

interface GlbChannel {
  target: { node: number; path: string };
}

interface GlbAnimation {
  name?: string;
  channels: GlbChannel[];
  samplers: GlbSampler[];
}

interface GlbNode {
  name?: string;
  scale?: number[];
}

interface GlbJson {
  asset: { version: string };
  accessors: GlbAccessor[];
  bufferViews: GlbBufferView[];
  meshes: GlbMesh[];
  nodes?: GlbNode[];
  animations?: GlbAnimation[];
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  materials?: GlbMaterial[];
}

interface ParsedGlb {
  json: GlbJson;
  bin: Uint8Array;
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function readF32(view: DataView, offset: number): number {
  return view.getFloat32(offset, true);
}

/** Parse the GLB container without a WebGL dependency so checks run in CI. */
async function parseGlb(): Promise<ParsedGlb> {
  const bytes = await readFile(BRACHIO_URL);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(readU32(view, 0)).toBe(0x4654_6c67);
  expect(readU32(view, 4)).toBe(2);
  const jsonLength = readU32(view, 12);
  expect(readU32(view, 16)).toBe(0x4e4f_534a);
  const jsonText = new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength));
  const json = JSON.parse(jsonText) as GlbJson;
  const binOffset = 20 + jsonLength;
  let bin = new Uint8Array(0);
  if (binOffset < bytes.byteLength) {
    expect(readU32(view, binOffset + 4)).toBe(0x004e_4942);
    const binLength = readU32(view, binOffset);
    bin = bytes.subarray(binOffset + 8, binOffset + 8 + binLength);
  }
  return { json, bin };
}

/** Longest input timestamp across the animation samplers: the clip duration. */
function animationDuration(parsed: ParsedGlb, animation: GlbAnimation): number {
  const view = new DataView(parsed.bin.buffer, parsed.bin.byteOffset, parsed.bin.byteLength);
  let max = 0;
  for (const sampler of animation.samplers) {
    const accessor = parsed.json.accessors[sampler.input];
    const bufferView = parsed.json.bufferViews[accessor.bufferView ?? 0];
    const base = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    for (let i = 0; i < accessor.count; i += 1) {
      max = Math.max(max, readF32(view, base + i * 4));
    }
  }
  return max;
}

describe('brachio glb', () => {
  it('ships under the authored-clip cache budget', async () => {
    const info = await stat(BRACHIO_URL);
    expect(info.size).toBeLessThan(MAX_BYTES);
  });

  it('parses as a gltf 2.0 asset', async () => {
    const parsed = await parseGlb();
    expect(parsed.json.asset.version).toBe('2.0');
    expect(parsed.json.meshes.length).toBeGreaterThan(0);
  });

  it('carries the authored Idle, Walk and Run clips at their published lengths', async () => {
    const parsed = await parseGlb();
    const animations = parsed.json.animations ?? [];
    // AC-1: the authored set, and no donor "Waddle" anywhere.
    expect(animations.map((animation) => animation.name).sort()).toEqual(
      CLIP_SECONDS.map(([name]) => name).sort(),
    );
    expect(animations.some((animation) => animation.name === 'Waddle')).toBe(false);
    for (const animation of animations) {
      const expected = CLIP_SECONDS.find(([name]) => name === animation.name)?.[1];
      expect(expected).toBeDefined();
      expect(animationDuration(parsed, animation)).toBeCloseTo(expected ?? 0, 3);
      // 35 bones x translation + rotation: no synthesised scale channel.
      expect(animation.channels.length).toBe(CHANNELS_PER_CLIP);
      // Every bone is driven, including the sauropod-only neck and tail the
      // Trike donor left at bind pose.
      expect(new Set(animation.channels.map((channel) => channel.target.node)).size).toBe(35);
      for (const channel of animation.channels) {
        expect(['translation', 'rotation']).toContain(channel.target.path);
      }
    }
  });

  it('meets the NFR-2 offline contract: draco, one flat-shaded material', async () => {
    const parsed = await parseGlb();
    const declared = [
      ...(parsed.json.extensionsUsed ?? []),
      ...(parsed.json.extensionsRequired ?? []),
    ];
    expect(declared).toContain('KHR_draco_mesh_compression');
    // One material: the shipped mesh shares a single pastel PBR material.
    expect(parsed.json.materials?.length).toBe(1);
    // glTF carries no flat-shading flag, so this half is cited, not parsed:
    // the Polyfork brachiosaurus-base source is a flat-shaded low-poly mesh
    // (https://polyfork.dev/asset/brachiosaurus-base; Phase 2 evidence: 1 mesh /
    // 1 material) and the viewer keeps it faceted under NoToneMapping daylight.
  });

  it('stands on the ground plane at authored proportions with the upright neck', async () => {
    const parsed = await parseGlb();
    const primitive = parsed.json.meshes[0].primitives[0];
    const accessor = parsed.json.accessors[primitive.attributes['POSITION']];
    const min = accessor.min ?? [];
    const max = accessor.max ?? [];
    // gltf is y-up: the lowest vertex sits on y = 0.
    expect(Math.abs(min[1] ?? 1)).toBeLessThan(0.01);
    // Authored size 1.0: ~12.5 m tip-to-tail with the default neck carriage,
    // not a size-0.6 grazing baby with a 0.27 post-scale.
    const length = (max[2] ?? 0) - (min[2] ?? 0);
    expect(length).toBeGreaterThanOrEqual(MIN_LENGTH_METRES);
    expect(length).toBeLessThanOrEqual(MAX_LENGTH_METRES);
    expect(max[1] ?? 0).toBeGreaterThanOrEqual(MIN_HEAD_METRES);
    expect(max[1] ?? 0).toBeLessThanOrEqual(MAX_HEAD_METRES);
  });

  it('keeps the Head bone the runtime blush pin targets', async () => {
    const parsed = await parseGlb();
    const names = (parsed.json.nodes ?? []).map((node) => node.name ?? '');
    expect(names.some((name) => name.toLowerCase().includes('head'))).toBe(true);
  });
});
