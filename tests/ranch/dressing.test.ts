import { readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDressing,
  DRAW_CALL_CEILING,
  DRESSING_BUDGET_BYTES,
  DRESSING_MANIFEST,
  GROUND_RADIUS_METRES,
  IN_FRAME_OVERSHOOT_METRES,
  PRECACHE_BUDGET_BYTES,
  TRIANGLE_CEILING,
  updateDressing,
  WALK_CLEARANCE_METRES,
  WIND_PUMP_RADIANS_PER_SECOND,
} from '../../src/ranch/dressing.js';
import { DRESSING_BAND_RANGES, DRESSING_CATALOGUE } from '../../src/ranch/layout.js';
import { MEADOW_RADIUS_METRES } from '../../src/ranch/ground.js';
import { GROUND_POV_ORDER, POV_PRESETS } from '../../src/viewer/pov.js';
import { readGlbFacts } from './dressing-files.js';
import {
  DINO_WALK_RADIUS_METRES,
  LARGEST_DINO_BODY_LENGTH_METRES,
} from '../../src/ranch/avoidance.js';
import { BRACHIO_GAIT, STEGO_GAIT, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import { gaitSpeedMetresPerSecond, WALK_BLEND_SECONDS } from '../../src/ranch/waddle.js';
import { IN_GAME_BODY_LENGTH_METRES } from '../../src/viewer/loaders.js';

const ROOT_URL = new URL('../../', import.meta.url);

/** Every file the manifest references once, in first-use order. */
const UNIQUE_FILES = [...new Set(DRESSING_MANIFEST.map((item) => item.file))];

/** Loader-boundary stubs: the tests below never touch WebGL or the network. */
const loaderMocks = vi.hoisted(() => ({
  loadAsync: vi.fn(),
}));

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn(function (this: unknown) {
    return {
      loadAsync: loaderMocks.loadAsync,
    };
  }),
}));

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, ROOT_URL), 'utf8');
}

function dressingDirUrl(relativePath: string): URL {
  return new URL(`public/models/dressing/${relativePath}`, ROOT_URL);
}

function groundDistanceMetres(position: readonly [number, number, number]): number {
  return Math.hypot(position[0], position[2]);
}

describe('dressing manifest on disk (FR-3, NFR-2)', () => {
  it('references exactly the vendored GLBs on the manifest, each with metadata', () => {
    expect(UNIQUE_FILES).toHaveLength(30);
    for (const file of UNIQUE_FILES) {
      expect(file.endsWith('.glb')).toBe(true);
      expect(DRESSING_CATALOGUE[file]).toBeDefined();
    }
  });

  it('keeps every vendored GLB present and the dressing set under the 4 MB budget', () => {
    let totalBytes = 0;
    for (const file of UNIQUE_FILES) {
      const bytes = statSync(dressingDirUrl(file)).size;
      expect(bytes).toBeGreaterThan(0);
      totalBytes += bytes;
    }
    expect(totalBytes).toBeLessThan(DRESSING_BUDGET_BYTES);
    expect(DRESSING_BUDGET_BYTES).toBe(4_000_000);
    expect(PRECACHE_BUDGET_BYTES).toBe(15_000_000);
  });

  it('keeps the dressing group under the draw-call and triangle ceilings (a per-prop guard, not the frame)', () => {
    // NFR-1: the whole frame stays under 150 calls and 80k triangles. This is the
    // *dressing group's* arithmetic: each file is single-material, so its
    // primitives bake into one buffer at load and one clone costs one call. It is
    // not the frame — the sky, ground, dinos, dust and sparkles are not in this
    // sum. The measured frame is `window.__ranch.snapshot().drawCalls`, which the
    // harness reads off `renderer.info.render` (F3).
    let triangles = 0;
    for (const item of DRESSING_MANIFEST) {
      const facts = readGlbFacts(dressingDirUrl(item.file));
      expect(facts.materials).toBe(1);
      triangles += facts.triangles;
    }
    // The water line's channel and its one stone batch, plus the wallow disc.
    const drawCalls = DRESSING_MANIFEST.length + 3;
    expect(drawCalls).toBeLessThan(DRAW_CALL_CEILING);
    expect(triangles).toBeLessThan(TRIANGLE_CEILING);
    expect(DRAW_CALL_CEILING).toBe(150);
    expect(TRIANGLE_CEILING).toBe(80_000);
  });
});

describe('dressing layout invariants (FR-3, AC-3)', () => {
  it('sits every prop on the ground origin plane', () => {
    expect(DRESSING_MANIFEST.length).toBeGreaterThan(0);
    for (const item of DRESSING_MANIFEST) {
      expect(item.position[1]).toBe(0);
      expect(Number.isFinite(item.rotationY)).toBe(true);
    }
  });

  it('keeps every prop outside the biggest animal’s whole wander path', () => {
    // FR-6/FR-7, derived rather than tuned: the circle body centres use is half
    // the largest body length, and nothing may stand inside that circle plus
    // the ground a dino covers overshooting it plus half its nose and tail.
    expect(LARGEST_DINO_BODY_LENGTH_METRES).toBeCloseTo(IN_GAME_BODY_LENGTH_METRES.brachio, 3);
    expect(LARGEST_DINO_BODY_LENGTH_METRES).toBeGreaterThan(IN_GAME_BODY_LENGTH_METRES.stego);
    expect(DINO_WALK_RADIUS_METRES).toBe(LARGEST_DINO_BODY_LENGTH_METRES / 2);
    for (const gait of [TRIKE_GAIT, STEGO_GAIT, BRACHIO_GAIT]) {
      expect(gait.wanderRadiusMetres).toBe(DINO_WALK_RADIUS_METRES);
      // The overshoot margin must cover every gait's in-frame bound.
      const speed = gaitSpeedMetresPerSecond(gait);
      const yawRate = Math.min(
        gait.turnRateRadiansPerSecond,
        gait.curvatureRadiansPerMetre * speed,
      );
      const overshoot = speed * (Math.PI / yawRate + WALK_BLEND_SECONDS);
      expect(overshoot).toBeLessThanOrEqual(IN_FRAME_OVERSHOOT_METRES);
    }
    expect(WALK_CLEARANCE_METRES).toBeCloseTo(
      DINO_WALK_RADIUS_METRES + IN_FRAME_OVERSHOOT_METRES + LARGEST_DINO_BODY_LENGTH_METRES / 2,
      10,
    );
    for (const item of DRESSING_MANIFEST) {
      // No prop inside the path, so no prop can intersect a dino.
      expect(groundDistanceMetres(item.position)).toBeGreaterThanOrEqual(WALK_CLEARANCE_METRES);
      // And every prop still stands on the ground — the apron now, not just
      // the play disc, because the treeline and the windpump stand out there.
      expect(groundDistanceMetres(item.position)).toBeLessThan(MEADOW_RADIUS_METRES);
    }
  });

  it('leaves the ranch a prop band to stand in on both sides of every preset', () => {
    // The walk clearance has to stay smaller than the ground, or the props
    // would have nowhere legal to go.
    expect(GROUND_RADIUS_METRES).toBeGreaterThan(WALK_CLEARANCE_METRES);
    expect(GROUND_RADIUS_METRES - WALK_CLEARANCE_METRES).toBeGreaterThan(1);
    for (const id of GROUND_POV_ORDER) {
      const preset = POV_PRESETS[id];
      const distance = Math.hypot(preset.position[0], preset.position[2]);
      // Stands clear of the walk area (nothing walks through the lens) and
      // outside the mid band, so the band's props are what the frame reads
      // first. Phase 4 pulled the lenses inside the foreground ring on purpose;
      // the screen-space kit in `pov.test.ts` is what proves the animal behind
      // those props is still clear (AC-1).
      expect(distance).toBeGreaterThan(WALK_CLEARANCE_METRES);
      expect(distance).toBeGreaterThan(DRESSING_BAND_RANGES.mid.maxMetres);
      expect(distance).toBeLessThan(DRESSING_BAND_RANGES.foreground.minMetres);
    }
    // The overhead lens stands further out still, so nothing it looks past is
    // in the near plane.
    const overhead = POV_PRESETS['sky'];
    expect(Math.hypot(overhead.position[0], overhead.position[2])).toBeGreaterThan(
      WALK_CLEARANCE_METRES,
    );
    expect(overhead.position[1]).toBeGreaterThan(LARGEST_DINO_BODY_LENGTH_METRES * 2);
  });

  it('keeps every prop clear of the fixed POV camera near-planes', () => {
    for (const item of DRESSING_MANIFEST) {
      for (const preset of Object.values(POV_PRESETS)) {
        const gap = Math.hypot(
          item.position[0] - preset.position[0],
          item.position[2] - preset.position[2],
        );
        expect(gap).toBeGreaterThan(0.5);
      }
    }
  });

  it('scatters the valley backdrop: 3 trees plus boulder and stump', () => {
    const treeFiles = [
      'ginkgo-tree-baa895.glb',
      'dawn-redwood-001c29.glb',
      'flowering-magnolia-dd76cb.glb',
    ];
    const trees = DRESSING_MANIFEST.filter((item) => treeFiles.includes(item.file));
    expect(trees).toHaveLength(3);
    expect(DRESSING_MANIFEST.filter((item) => item.file.includes('boulder'))).toHaveLength(1);
    // The stump the valley necklace was built around; the phase-3 log stump is
    // a corner prop with its own file rather than a second necklace stump.
    expect(
      DRESSING_MANIFEST.filter((item) => item.file === 'moss-covered-stump-7253ab.glb'),
    ).toHaveLength(1);
  });

  it('runs the fence perimeter with a farm-gate gap', () => {
    const fences = DRESSING_MANIFEST.filter((item) => item.file.includes('fence-section'));
    const gates = DRESSING_MANIFEST.filter((item) => item.file.includes('farm-gate'));
    expect(fences.length).toBeGreaterThanOrEqual(3);
    expect(gates).toHaveLength(1);
  });

  it('clusters trough, pump, and well as the Ranch-side group', () => {
    expect(DRESSING_MANIFEST.filter((item) => item.file.includes('water-trough'))).toHaveLength(1);
    expect(
      DRESSING_MANIFEST.filter((item) => item.file === 'hand-water-pump-448037.glb'),
    ).toHaveLength(1);
    expect(DRESSING_MANIFEST.filter((item) => item.file.includes('well'))).toHaveLength(1);
    // FR-18's landmark is the other pump-named file, and it stands alone.
    expect(
      DRESSING_MANIFEST.filter((item) => item.file === 'windpump-tower-1633a9.glb'),
    ).toHaveLength(1);
  });

  it('plants 2 short corn rows as the garden marker', () => {
    const corn = DRESSING_MANIFEST.filter((item) => item.file.includes('corn'));
    expect(corn).toHaveLength(6);
    const rows = new Set(corn.map((item) => item.position[2]));
    expect(rows.size).toBe(2);
  });

  it('rings 3-5 river stones as the nest marker', () => {
    const stones = DRESSING_MANIFEST.filter((item) => item.file.includes('river-stone'));
    expect(stones.length).toBeGreaterThanOrEqual(3);
    expect(stones.length).toBeLessThanOrEqual(5);
    const centroid: [number, number] = [0, 0];
    for (const stone of stones) {
      centroid[0] += stone.position[0] / stones.length;
      centroid[1] += stone.position[2] / stones.length;
    }
    expect(Math.hypot(centroid[0], centroid[1])).toBeGreaterThan(WALK_CLEARANCE_METRES);
    for (const stone of stones) {
      const spread = Math.hypot(stone.position[0] - centroid[0], stone.position[2] - centroid[1]);
      expect(spread).toBeLessThanOrEqual(0.6);
    }
  });
});

describe('dressing loader fallback (NFR-2 offline safety)', () => {
  beforeEach(() => {
    loaderMocks.loadAsync.mockReset();
  });

  it('places one clone per manifest entry and reports the summary', async () => {
    loaderMocks.loadAsync.mockImplementation(async () => ({
      scene: new THREE.Group(),
      animations: [],
    }));
    const scene = new THREE.Scene();
    const summary = await buildDressing(scene);
    expect(summary.requested).toBe(DRESSING_MANIFEST.length);
    expect(summary.placed).toBe(DRESSING_MANIFEST.length);
    expect(summary.loadedFiles).toBe(UNIQUE_FILES.length);
    expect(summary.failedFiles).toEqual([]);
    const dressing = scene.getObjectByName('RanchDressing');
    expect(dressing).not.toBeNull();
    expect(dressing?.children.length).toBe(DRESSING_MANIFEST.length);
  });

  it('resolves with zero placed when every GLB load fails — never throws', async () => {
    loaderMocks.loadAsync.mockRejectedValue(new Error('offline'));
    const scene = new THREE.Scene();
    const summary = await buildDressing(scene);
    expect(summary.placed).toBe(0);
    expect(summary.loadedFiles).toBe(0);
    expect(summary.failedFiles).toHaveLength(UNIQUE_FILES.length);
  });

  it('keeps the surviving props when a single GLB fails', async () => {
    loaderMocks.loadAsync.mockImplementation(async (url: string) => {
      if (url.includes('stone-well')) {
        throw new Error('offline');
      }
      return { scene: new THREE.Group(), animations: [] };
    });
    const scene = new THREE.Scene();
    const summary = await buildDressing(scene);
    const wellCount = DRESSING_MANIFEST.filter((item) => item.file.includes('well')).length;
    expect(summary.placed).toBe(DRESSING_MANIFEST.length - wellCount);
    expect(summary.failedFiles).toHaveLength(1);
  });

  it('loads each unique GLB once and clones the repeats', async () => {
    loaderMocks.loadAsync.mockImplementation(async () => ({
      scene: new THREE.Group(),
      animations: [],
    }));
    await buildDressing(new THREE.Scene());
    expect(loaderMocks.loadAsync).toHaveBeenCalledTimes(UNIQUE_FILES.length);
  });

  it('bakes a many-primitive file down to one call per clone (NFR-1)', async () => {
    // Every dressing GLB is a single material, so its primitives merge into one
    // buffer at load: 57 placements cost 57 calls, not the 224 the raw files
    // would ask for.
    loaderMocks.loadAsync.mockImplementation(async () => {
      const scene = new THREE.Group();
      const material = new THREE.MeshStandardMaterial();
      const left = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      left.position.x = 2;
      const right = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
      right.position.x = -2;
      scene.add(left, right);
      return { scene, animations: [] };
    });
    const scene = new THREE.Scene();
    await buildDressing(scene);
    const dressing = scene.getObjectByName('RanchDressing');
    const clone = dressing?.children[0];
    expect(clone?.children).toHaveLength(1);
    const baked = clone?.children[0] as THREE.Mesh;
    baked.geometry.computeBoundingBox();
    const bounds = baked.geometry.boundingBox as THREE.Box3;
    // Both halves survive the merge in their own places.
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(5, 3);
  });

  it('keeps a vertex-coloured palette through the bake (rework 1)', async () => {
    // A Polyfork GLB carries its whole palette in COLOR_0 and leaves its
    // material white. If the bake drops `vertexColors`, the prop renders blank —
    // which is how the windpump came out in the Sky capture.
    loaderMocks.loadAsync.mockImplementation(async () => {
      const scene = new THREE.Group();
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const colours = new Float32Array(geometry.getAttribute('position').count * 3);
      for (let index = 0; index < colours.length; index += 3) {
        colours[index] = 0.26;
        colours[index + 1] = 0.23;
        colours[index + 2] = 0.17;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
      const left = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
      left.position.x = 1;
      const right = new THREE.Mesh(geometry.clone(), new THREE.MeshStandardMaterial());
      right.position.x = -1;
      scene.add(left, right);
      return { scene, animations: [] };
    });
    const scene = new THREE.Scene();
    await buildDressing(scene);
    const clone = scene.getObjectByName('RanchDressing')?.children[0];
    const baked = clone?.children[0] as THREE.Mesh;
    expect(baked.geometry.getAttribute('color')).toBeDefined();
    expect((baked.material as THREE.MeshStandardMaterial).vertexColors).toBe(true);
  });

  it('documents the windpump palette: one white material, colour in COLOR_0 (rework 1)', () => {
    const bytes = readFileSync(
      new URL('../../public/models/dressing/windpump-tower-1633a9.glb', import.meta.url),
    );
    const jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')) as {
      materials?: { pbrMetallicRoughness?: { baseColorFactor?: number[] } }[];
      images?: unknown[];
      meshes?: { primitives: { attributes: Record<string, number> }[] }[];
    };
    // One material, no base colour and no texture: the whole palette is in
    // COLOR_0, so a renderer that drops `vertexColors` paints it blank white.
    expect(json.materials).toHaveLength(1);
    expect(json.materials?.[0]?.pbrMetallicRoughness?.baseColorFactor).toBeUndefined();
    expect(json.images).toBeUndefined();
    const primitives = (json.meshes ?? []).flatMap((mesh) => mesh.primitives);
    expect(primitives.length).toBeGreaterThan(1);
    for (const primitive of primitives) {
      expect(primitive.attributes['COLOR_0']).toBeDefined();
    }
  });

  it('scales a thicket prop by its placement, not by 1 (rework 1)', async () => {
    loaderMocks.loadAsync.mockImplementation(async () => ({
      scene: new THREE.Group(),
      animations: [],
    }));
    const scene = new THREE.Scene();
    await buildDressing(scene);
    const dressing = scene.getObjectByName('RanchDressing');
    dressing?.children.forEach((child, index) => {
      const placement = DRESSING_MANIFEST[index];
      expect(child.scale.x, `${placement.file} scale`).toBeCloseTo(placement.scale ?? 1, 10);
    });
  });
});

describe('water line and windpump rig (FR-14, FR-18)', () => {
  const sourceOf = (): THREE.Group => {
    // Every GLB resolves to a group with one small box, so the loader path and
    // the measurements are exercised without a real file.
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
    return group;
  };

  beforeEach(() => {
    loaderMocks.loadAsync.mockReset();
    loaderMocks.loadAsync.mockImplementation(async () => ({
      scene: sourceOf(),
      animations: [],
    }));
  });

  it('builds the water line as one flush channel rather than a prop train', async () => {
    const scene = new THREE.Scene();
    const summary = await buildDressing(scene);
    const waterLine = scene.getObjectByName('RanchWaterLine');
    expect(waterLine).not.toBeNull();
    expect(summary.waterLine).not.toBeNull();
    // The line is its own group, so the manifest's one-clone-per-entry rule
    // above still describes the dressing group exactly.
    expect(waterLine?.parent).toBe(scene);
    const mesh = waterLine?.children[0] as THREE.Mesh | undefined;
    expect(mesh).toBeDefined();
    const material = mesh?.material as THREE.MeshStandardMaterial;
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.depthWrite).toBe(false);
  });

  it('turns the windpump rotor and stops it under reduced motion', async () => {
    const scene = new THREE.Scene();
    const summary = await buildDressing(scene);
    expect(summary.rotor).not.toBeNull();
    const rotor = summary.rotor;
    if (rotor === null) {
      return;
    }
    const before = rotor.node.rotation.z;
    updateDressing(summary, 0.5, false);
    expect(rotor.node.rotation.z).toBeCloseTo(before - WIND_PUMP_RADIANS_PER_SECOND * 0.5, 6);
    const turned = rotor.node.rotation.z;
    updateDressing(summary, 0.5, true);
    expect(rotor.node.rotation.z).toBe(turned);
    updateDressing(summary, 0, false);
    expect(rotor.node.rotation.z).toBe(turned);
    updateDressing(null, 1, false);
    expect(summary.rotor).toBe(rotor);
  });

  it('finds the fan by the GLB’s own node name, with geometry still under it (review F6)', async () => {
    // The rotor lookup used to run on a clone whose source meshes the bake had
    // merged into the root, so it found an empty group: the fallback fan stood in
    // front of baked, stationary blades. Read the vendored node names, build that
    // same tree, and check the node that comes back is the file's own fan and
    // still carries the mesh that makes turning it visible.
    const bytes = readFileSync(
      new URL('../../public/models/dressing/windpump-tower-1633a9.glb', import.meta.url),
    );
    const jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')) as {
      nodes?: { name?: string }[];
    };
    const names = (json.nodes ?? []).map((node) => node.name ?? '');
    const fanName = names.find((name) => /(blade|rotor|fan|wheel|vane)/i.test(name));
    expect(fanName, names.join(', ')).toBeDefined();
    if (fanName === undefined) {
      return;
    }
    loaderMocks.loadAsync.mockImplementation(async () => {
      const root = new THREE.Group();
      root.name = 'windpump-tower';
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 0.3));
      tower.name = 'tower';
      const fan = new THREE.Group();
      fan.name = fanName;
      fan.position.y = 7.1;
      const fanMaterial = new THREE.MeshStandardMaterial();
      for (const [index, offset] of [-0.4, 0.4].entries()) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.02), fanMaterial);
        blade.name = `${fanName}-blade-${index}`;
        blade.position.x = offset;
        fan.add(blade);
      }
      root.add(tower, fan);
      return { scene: root, animations: [] };
    });
    const scene = new THREE.Scene();
    const summary = await buildDressing(scene);
    const rotor = summary.rotor;
    expect(rotor).not.toBeNull();
    expect(rotor?.node.name).toBe(fanName);
    const meshes: THREE.Mesh[] = [];
    rotor?.node.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
      }
    });
    expect(meshes.length).toBeGreaterThan(0);
    // One buffer now, not two: the fan's blades merged inside the fan.
    expect(meshes.length).toBe(1);
    // It hangs off the placed windpump clone, which is a child of the group.
    let ancestor: THREE.Object3D | null = rotor?.node.parent ?? null;
    while (ancestor !== null && ancestor.name !== 'RanchDressing') {
      ancestor = ancestor.parent;
    }
    expect(ancestor?.name).toBe('RanchDressing');
  });

  it('survives a dressing that failed to load, rotor and all', async () => {
    loaderMocks.loadAsync.mockRejectedValue(new Error('offline'));
    const summary = await buildDressing(new THREE.Scene());
    expect(summary.rotor).toBeNull();
    expect(() => updateDressing(summary, 1, false)).not.toThrow();
    expect(summary.drawCalls).toBeGreaterThan(0);
  });
});

describe('dressing precache + boot wiring (NFR-2, AC-3)', () => {
  it('precaches the dressing GLBs through the workbox glob', async () => {
    const source = await readText('vite.config.ts');
    expect(source).toContain('glb');
  });

  it('boots dressing in parallel with a silent fallback in the viewer', async () => {
    const source = await readText('src/viewer/main.ts');
    expect(source).toContain('buildDressing');
    expect(source).toContain('console.warn');
  });
});
