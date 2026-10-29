import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * Budget: the baked Stego carries Polyfork's authored clips, which are dense
 * uncompressed glTF float data (71k keys across the three). NFR-2 sets the
 * app-wide offline precache budget; Phase 6 audits the total, this caps the one
 * file against a runaway bake.
 */
// Sized to catch a runaway bake, not to bless the budget: the shipped file is
// 338 KB (Walk only). Re-check NFR-2 before raising this.
const MAX_BYTES = 512 * 1024;
/** Authored clip lengths in seconds, as published (AC-1). */
const CLIP_SECONDS = [
  ['Walk', 2.4],
  // ['Run', 1] is withdrawn: see SHIPPED_CLIP_NAMES in scripts/bake-trike-variant.js.
] as const;
/** 24 bones x translation + rotation: the authored channel count. */
const CHANNELS_PER_CLIP = 48;
/** Authored proportions: the Polyfork reference is ~6.49 m tip-to-tail. */
const MIN_LENGTH_METRES = 6.3;
const MAX_LENGTH_METRES = 6.8;
/** Adult plate crest sits at ~3.82 m. */
const MAX_HEIGHT_METRES = 4.2;

const STEGO_URL = new URL('../public/models/stego.glb', import.meta.url);

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
  const bytes = await readFile(STEGO_URL);
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

describe('stego glb', () => {
  it('ships under the authored-clip cache budget', async () => {
    const info = await stat(STEGO_URL);
    expect(info.size).toBeLessThan(MAX_BYTES);
  });

  it('parses as a gltf 2.0 asset', async () => {
    const parsed = await parseGlb();
    expect(parsed.json.asset.version).toBe('2.0');
    expect(parsed.json.meshes.length).toBeGreaterThan(0);
  });

  it('carries the authored Walk clip at its published length', async () => {
    const parsed = await parseGlb();
    const animations = parsed.json.animations ?? [];
    // AC-1: the authored set, and no donor "Waddle" anywhere.
    expect(animations.map((animation) => animation.name).sort()).toEqual(
      CLIP_SECONDS.map(([name]) => name).sort(),
    );
    expect(animations.some((animation) => animation.name === 'Waddle')).toBe(false);
    // Idle and Run are withdrawn by the bake (NFR-2 cache budget): absent, not
    // silently dropped.
    expect(animations.some((animation) => animation.name === 'Run')).toBe(false);
    expect(animations.some((animation) => animation.name === 'Idle')).toBe(false);
    for (const animation of animations) {
      const expected = CLIP_SECONDS.find(([name]) => name === animation.name)?.[1];
      expect(expected).toBeDefined();
      expect(animationDuration(parsed, animation)).toBeCloseTo(expected ?? 0, 3);
      // 24 bones x translation + rotation: no synthesised scale channel.
      expect(animation.channels.length).toBe(CHANNELS_PER_CLIP);
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
    // the Polyfork stegosaurus-base source is a flat-shaded low-poly mesh
    // (https://polyfork.dev/asset/stegosaurus-base; Phase 2 evidence: 1 mesh /
    // 1 material) and the viewer keeps it faceted under NoToneMapping daylight.
  });

  it('stands on the ground plane at authored proportions, y-up', async () => {
    const parsed = await parseGlb();
    const primitive = parsed.json.meshes[0].primitives[0];
    const accessor = parsed.json.accessors[primitive.attributes['POSITION']];
    const min = accessor.min ?? [];
    const max = accessor.max ?? [];
    // gltf is y-up: height lives on y and the lowest vertex sits on y = 0.
    // (Plates are tall: ground contact is the feet, not the plate tips, so
    // only the min bound is asserted here; the max bound caps the crest.)
    expect(Math.abs(min[1] ?? 1)).toBeLessThan(0.01);
    expect((max[1] ?? 0) - (min[1] ?? 0)).toBeLessThan(MAX_HEIGHT_METRES);
    // Authored size 1.0: ~6.49 m tip-to-tail, the module's own reference.
    const length = (max[2] ?? 0) - (min[2] ?? 0);
    expect(length).toBeGreaterThanOrEqual(MIN_LENGTH_METRES);
    expect(length).toBeLessThanOrEqual(MAX_LENGTH_METRES);
  });

  it('keeps the Head bone the runtime blush pin targets', async () => {
    const parsed = await parseGlb();
    const names = (parsed.json.nodes ?? []).map((node) => node.name ?? '');
    expect(names.some((name) => name.toLowerCase().includes('head'))).toBe(true);
  });
});
