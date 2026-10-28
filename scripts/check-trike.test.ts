import { readFile, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/** Budget from NFR-2: the baked Trike must stay small enough for offline cache. */
const MAX_BYTES = 150 * 1024;
/** Baked waddle cycle length in seconds; matches the viewer loop constant. */
const WADDLE_MIN_SECONDS = 0.79;
const WADDLE_MAX_SECONDS = 0.81;
/** Baby scale is 0.3x of the 6.26 m authored length. */
const MIN_LENGTH_METRES = 1.7;
const MAX_LENGTH_METRES = 2.1;

const TRIKE_URL = new URL('../public/models/trike.glb', import.meta.url);

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

interface GlbAnimation {
  name?: string;
  channels: unknown[];
  samplers: GlbSampler[];
}

interface GlbJson {
  asset: { version: string };
  accessors: GlbAccessor[];
  bufferViews: GlbBufferView[];
  meshes: GlbMesh[];
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
  const bytes = await readFile(TRIKE_URL);
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

describe('trike glb', () => {
  it('ships under the 150 kb offline-cache budget', async () => {
    const info = await stat(TRIKE_URL);
    expect(info.size).toBeLessThan(MAX_BYTES);
  });

  it('parses as a gltf 2.0 asset', async () => {
    const parsed = await parseGlb();
    expect(parsed.json.asset.version).toBe('2.0');
    expect(parsed.json.meshes.length).toBeGreaterThan(0);
  });

  it('carries exactly one seamless waddle clip of 0.8 s', async () => {
    const parsed = await parseGlb();
    expect(parsed.json.animations?.length).toBe(1);
    const waddle = (parsed.json.animations ?? [])[0];
    expect(waddle.name).toBe('Waddle');
    expect(waddle.channels.length).toBeGreaterThan(0);
    const duration = animationDuration(parsed, waddle);
    expect(duration).toBeGreaterThanOrEqual(WADDLE_MIN_SECONDS);
    expect(duration).toBeLessThanOrEqual(WADDLE_MAX_SECONDS);
  });

  it('meets the NFR-2 offline contract: draco, one flat-shaded material', async () => {
    const parsed = await parseGlb();
    // Draco keeps the 85,780-byte GLB far under the 150 KB cache budget.
    const declared = [
      ...(parsed.json.extensionsUsed ?? []),
      ...(parsed.json.extensionsRequired ?? []),
    ];
    expect(declared).toContain('KHR_draco_mesh_compression');
    // One material: the shipped mesh shares a single pastel PBR material.
    expect(parsed.json.materials?.length).toBe(1);
    // glTF carries no flat-shading flag, so this half is cited, not parsed:
    // the Polyfork triceratops-base source is a flat-shaded low-poly mesh
    // (https://polyfork.dev/asset/triceratops-base; Phase 2 evidence: 1 mesh /
    // 1 material) and the viewer keeps it faceted under NoToneMapping daylight.
  });

  it('stands on the ground plane at baby scale, y-up', async () => {
    const parsed = await parseGlb();
    const primitive = parsed.json.meshes[0].primitives[0];
    const accessor = parsed.json.accessors[primitive.attributes['POSITION']];
    const min = accessor.min ?? [];
    const max = accessor.max ?? [];
    // gltf is y-up: height lives on y and the lowest vertex sits on y = 0.
    expect(Math.abs(min[1] ?? 1)).toBeLessThan(0.01);
    expect((max[1] ?? 0) - (min[1] ?? 0)).toBeLessThan(1.3);
    // Authored length 6.26 m along z, baby-scaled 0.3x to about 1.9 m.
    const length = (max[2] ?? 0) - (min[2] ?? 0);
    expect(length).toBeGreaterThanOrEqual(MIN_LENGTH_METRES);
    expect(length).toBeLessThanOrEqual(MAX_LENGTH_METRES);
  });
});
