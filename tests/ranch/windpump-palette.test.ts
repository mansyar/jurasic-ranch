import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The windpump's colour, read straight out of the vendored file (rework 1).
 *
 * It renders blank because its material is white and carries no base colour —
 * the palette lives entirely in the `COLOR_0` attribute. This suite pins that
 * fact to the bytes, so the bake's `vertexColors` guard has a reason to exist
 * and a change of vendor file cannot quietly break the tower's timber tone.
 *
 * Kept beside `tests/ranch/dressing.test.ts` rather than inside it because it
 * reads the file rather than the loader.
 */

interface GlbAccessor {
  readonly min?: number[];
  readonly max?: number[];
}

interface GlbJson {
  readonly accessors?: GlbAccessor[];
  readonly meshes?: { primitives: { attributes: Record<string, number> }[] }[];
}

const PALETTE_URL = new URL(
  '../../public/models/dressing/windpump-tower-1633a9.glb',
  import.meta.url,
);

function glbJson(url: URL): GlbJson {
  const bytes = readFileSync(url);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')) as GlbJson;
}

/** Every `COLOR_0` accessor's own colour bounds, unioned. */
function paletteBounds(json: GlbJson): { min: number[]; max: number[] } {
  const accessors = json.accessors ?? [];
  const bounds = { min: [1, 1, 1], max: [0, 0, 0] };
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      const index = primitive.attributes['COLOR_0'];
      if (index === undefined) continue;
      const accessor = accessors[index];
      for (let channel = 0; channel < 3; channel += 1) {
        bounds.min[channel] = Math.min(bounds.min[channel], accessor?.min?.[channel] ?? 1);
        bounds.max[channel] = Math.max(bounds.max[channel], accessor?.max?.[channel] ?? 0);
      }
    }
  }
  return bounds;
}

describe('the windpump palette (rework 1)', () => {
  it('carries its colour in COLOR_0, and the colour is timber', () => {
    const json = glbJson(PALETTE_URL);
    const palette = paletteBounds(json);
    // Not white: the darkest channel sits well under the others.
    expect(palette.min[2]).toBeLessThan(0.1);
    expect(palette.max[0]).toBeGreaterThan(0.5);
    // Brown: red above green above blue, the way the other Polyfork props are.
    expect(palette.max[0]).toBeGreaterThan(palette.max[1]);
    expect(palette.max[1]).toBeGreaterThan(palette.max[2]);
  });

  it('gives every primitive a COLOR_0 attribute to read', () => {
    const json = glbJson(PALETTE_URL);
    const primitives = (json.meshes ?? []).flatMap((mesh) => mesh.primitives);
    expect(primitives.length).toBeGreaterThan(1);
    for (const primitive of primitives) {
      expect(primitive.attributes['COLOR_0']).toBeDefined();
    }
  });
});
