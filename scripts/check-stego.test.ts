import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { resolveMudRollPose } from './vendor/mud-roll-clip.js';

/**
 * Budget: the baked Stego carries Polyfork's authored clips, which are dense
 * uncompressed glTF float data (71k keys across the three). NFR-2 sets the
 * app-wide offline precache budget; Phase 6 audits the total, this caps the one
 * file against a runaway bake.
 */
// Sized to catch a runaway bake, not to bless the budget: the shipped file is
// 1303 KB (Idle + Walk + MudRoll, FR-1/FR-6). Re-check NFR-1 before raising this.
const MAX_BYTES = 1400 * 1024;
/** Authored clip lengths in seconds, as published (AC-1). */
const CLIP_SECONDS = [
  ['Idle', 9],
  ['Walk', 2.4],
  ['MudRoll', 4],
  // ['Run', 1] is withdrawn: see SHIPPED_CLIP_NAMES in scripts/bake-trike-variant.js.
] as const;
/**
 * Stego's bespoke wallow clip (FR-6, AC-6): four seconds, in place, ending on
 * the rest pose. Authored in scripts/vendor/mud-roll-clip.js and injected by
 * the bake - not exported from Blender, whose round trip re-times animation.
 */
const MUD_ROLL_SECONDS = 4;
const MUD_ROLL_CHANNELS = 16;
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
  type?: string;
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
  output: number;
}

interface GlbChannel {
  sampler: number;
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

/** Read a float accessor as rows of its component count (VEC3 -> 3, VEC4 -> 4). */
function readAccessor(parsed: ParsedGlb, accessorIndex: number): number[][] {
  const accessor = parsed.json.accessors[accessorIndex];
  const bufferView = parsed.json.bufferViews[accessor.bufferView ?? 0];
  const itemSize = accessor.type === 'VEC4' ? 4 : accessor.type === 'VEC3' ? 3 : 1;
  const view = new DataView(parsed.bin.buffer, parsed.bin.byteOffset, parsed.bin.byteLength);
  const base = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const rows: number[][] = [];
  for (let i = 0; i < accessor.count; i += 1) {
    const row: number[] = [];
    for (let c = 0; c < itemSize; c += 1) {
      row.push(readF32(view, base + (i * itemSize + c) * 4));
    }
    rows.push(row);
  }
  return rows;
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

  it('carries the authored Idle and Walk clips at their published lengths', async () => {
    const parsed = await parseGlb();
    const animations = parsed.json.animations ?? [];
    // AC-1: the authored set, and no donor "Waddle" anywhere.
    expect(animations.map((animation) => animation.name).sort()).toEqual(
      CLIP_SECONDS.map(([name]) => name).sort(),
    );
    expect(animations.some((animation) => animation.name === 'Waddle')).toBe(false);
    // Idle is re-instated (FR-1): a stopped dino plays it instead of holding a
    // stride. Run stays withdrawn - no code path plays it.
    expect(animations.some((animation) => animation.name === 'Idle')).toBe(true);
    expect(animations.some((animation) => animation.name === 'Run')).toBe(false);
    for (const animation of animations) {
      const expected = CLIP_SECONDS.find(([name]) => name === animation.name)?.[1];
      expect(expected).toBeDefined();
      expect(animationDuration(parsed, animation)).toBeCloseTo(expected ?? 0, 3);
      // 24 bones x translation + rotation: no synthesised scale channel.
      // MudRoll touches only the bones a wallow needs, plus the root's drop.
      expect(animation.channels.length).toBe(
        animation.name === 'MudRoll' ? MUD_ROLL_CHANNELS : CHANNELS_PER_CLIP,
      );
      for (const channel of animation.channels) {
        expect(['translation', 'rotation']).toContain(channel.target.path);
      }
    }
  });

  it("ships Stego's MudRoll as a four-second rest-to-rest clip with a root drop", async () => {
    const parsed = await parseGlb();
    const mudRoll = (parsed.json.animations ?? []).find(
      (animation) => animation.name === 'MudRoll',
    );
    expect(mudRoll).toBeDefined();
    if (mudRoll === undefined) {
      return;
    }
    // AC-6: authored at four seconds, so the visit can time its dwell from it.
    expect(animationDuration(parsed, mudRoll)).toBeCloseTo(MUD_ROLL_SECONDS, 3);

    const rotation = mudRoll.channels.filter((channel) => channel.target.path === 'rotation');
    const hips = rotation.find(
      (channel) => parsed.json.nodes?.[channel.target.node]?.name === 'Hips',
    );
    expect(hips).toBeDefined();
    if (hips === undefined) {
      return;
    }
    const keys = readAccessor(parsed, mudRoll.samplers[hips.sampler].output);
    const first = keys[0] ?? [];
    const last = keys[keys.length - 1] ?? [];
    // Rest to rest: the clip can be left, or crossfaded, without a pop.
    expect(first).toEqual(last);
    expect(Math.abs((first[3] ?? 0) - 1)).toBeLessThan(1e-6);

    // The body actually moves: the widest key swings the hips well off rest.
    // Angles, not raw w: a 30-degree roll is only 0.034 away from w = 1.
    const peakDegrees = keys.reduce((most, key) => {
      const w = Math.min(Math.abs(key[3] ?? 1), 1);
      return Math.max(most, (2 * Math.acos(w) * 180) / Math.PI);
    }, 0);
    expect(peakDegrees).toBeGreaterThan(20);

    // The belly reaches the mud: the root's translation channel drops and
    // returns. A clip that only rotated would read as a bow, not a wallow.
    const translation = mudRoll.channels.find((channel) => channel.target.path === 'translation');
    expect(translation).toBeDefined();
    if (translation === undefined) {
      return;
    }
    const positions = readAccessor(parsed, mudRoll.samplers[translation.sampler].output);
    const heights = positions.map((position) => position[1] ?? 0);
    const rest = heights[heights.length - 1] ?? 0;
    const lowest = Math.min(...heights);
    expect(rest - lowest).toBeGreaterThan(0.4);
    expect(rest - lowest).toBeLessThan(0.7);
    expect(heights[0]).toBeCloseTo(rest, 5);
  });

  it('authors the spine as cumulative rotation, not per-bone deltas', () => {
    // A chain value means "the chest is pitched 20 degrees in world terms".
    // Summing per-bone deltas down the spine is how the first draft folded the
    // animal onto its nose, so the rule is pinned here as arithmetic.
    const resolved = resolveMudRollPose({ Hips: [10, 0, 0], Neck: [20, 0, 0] });
    expect(resolved['Hips']).toEqual([10, 0, 0]);
    // Spine is absent, so it inherits the hips: no delta.
    expect(resolved['Spine']).toEqual([0, 0, 0]);
    expect(resolved['Chest']).toEqual([0, 0, 0]);
    // Neck reaches 20 cumulative, so it adds the remaining 10.
    expect(resolved['Neck']).toEqual([10, 0, 0]);
    expect(resolved['Head']).toEqual([0, 0, 0]);
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
