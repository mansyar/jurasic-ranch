import { readFileSync } from 'node:fs';

/**
 * What a vendored GLB says about itself, read from its own bytes.
 *
 * Measurements come from the file rather than from the vendor's metadata
 * sheet: the bounds are the union of every POSITION accessor's own `min`/`max`
 * (Polyfork bakes each asset to a single ground-origin node, so the accessor
 * range is the asset's world range), and the counts are the primitives that
 * will become draw calls once three.js clones the file.
 */
export interface GlbFacts {
  bytes: number;
  drawCalls: number;
  triangles: number;
  materials: number;
  widthMetres: number;
  depthMetres: number;
  heightMetres: number;
}

interface GltfAccessor {
  count: number;
  min?: readonly number[];
  max?: readonly number[];
}

interface GltfJson {
  accessors?: readonly GltfAccessor[];
  materials?: readonly unknown[];
  meshes?: readonly {
    primitives: readonly {
      attributes: Readonly<Record<string, number>>;
      indices?: number;
      material?: number;
    }[];
  }[];
}

export function readGlbFacts(url: URL): GlbFacts {
  const bytes = readFileSync(url);
  if (bytes.length < 20) {
    throw new Error(`${url.pathname}: too short to be a GLB`);
  }
  const magic = bytes.toString('latin1', 0, 4);
  if (magic !== 'glTF') {
    throw new Error(`${url.pathname}: magic is "${magic}", not "glTF"`);
  }
  const version = bytes.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`${url.pathname}: GLB version ${version}, expected 2`);
  }
  if (bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error(`${url.pathname}: header length disagrees with the file size`);
  }
  const chunkLength = bytes.readUInt32LE(12);
  const chunkType = bytes.readUInt32LE(16);
  if (chunkType !== 0x4e4f534a) {
    throw new Error(`${url.pathname}: first chunk is not JSON`);
  }
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + chunkLength)) as GltfJson;
  const accessors = gltf.accessors ?? [];
  const meshes = gltf.meshes ?? [];

  let drawCalls = 0;
  let triangles = 0;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const mesh of meshes) {
    for (const primitive of mesh.primitives) {
      drawCalls += 1;
      const positionIndex = primitive.attributes.POSITION;
      const position = positionIndex === undefined ? undefined : accessors[positionIndex];
      const counted = primitive.indices === undefined ? position : accessors[primitive.indices];
      if (counted !== undefined) {
        triangles += counted.count / 3;
      }
      if (position?.min !== undefined && position.max !== undefined) {
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis], position.min[axis] ?? 0);
          max[axis] = Math.max(max[axis], position.max[axis] ?? 0);
        }
      }
    }
  }

  return {
    bytes: bytes.length,
    drawCalls,
    triangles: Math.round(triangles),
    materials: new Set(
      meshes.flatMap((mesh) => mesh.primitives.map((primitive) => primitive.material ?? -1)),
    ).size,
    widthMetres: max[0] - min[0],
    depthMetres: max[2] - min[2],
    heightMetres: max[1] - min[1],
  };
}
