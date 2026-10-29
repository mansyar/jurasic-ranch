import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDressing,
  DRESSING_BUDGET_BYTES,
  DRESSING_MANIFEST,
  GROUND_RADIUS_METRES,
  WALK_CLEARANCE_METRES,
} from '../../src/ranch/dressing.js';
import { POV_PRESETS } from '../../src/viewer/pov.js';

const ROOT_URL = new URL('../../', import.meta.url);

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
  it('references exactly the 12 vendored CC0 GLBs', () => {
    const files = [...new Set(DRESSING_MANIFEST.map((item) => item.file))];
    expect(files).toHaveLength(12);
    for (const file of files) {
      expect(file.endsWith('.glb')).toBe(true);
    }
  });

  it('keeps every vendored GLB present and the ranch under the 15 MB PWA budget', () => {
    let totalBytes = 0;
    for (const item of DRESSING_MANIFEST) {
      const bytes = statSync(dressingDirUrl(item.file)).size;
      expect(bytes).toBeGreaterThan(0);
      totalBytes += statSync(dressingDirUrl(item.file)).size;
    }
    expect(totalBytes).toBeLessThan(DRESSING_BUDGET_BYTES);
    expect(DRESSING_BUDGET_BYTES).toBe(15_000_000);
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

  it('keeps every prop outside the dino walk area and inside the ground circle', () => {
    expect(WALK_CLEARANCE_METRES).toBe(0.8);
    expect(GROUND_RADIUS_METRES).toBe(6);
    for (const item of DRESSING_MANIFEST) {
      expect(groundDistanceMetres(item.position)).toBeGreaterThan(WALK_CLEARANCE_METRES);
      expect(groundDistanceMetres(item.position)).toBeLessThan(GROUND_RADIUS_METRES);
    }
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
    const trees = DRESSING_MANIFEST.filter(
      (item) =>
        item.file.includes('ginkgo') ||
        item.file.includes('redwood') ||
        item.file.includes('magnolia'),
    );
    expect(trees).toHaveLength(3);
    expect(DRESSING_MANIFEST.filter((item) => item.file.includes('boulder'))).toHaveLength(1);
    expect(DRESSING_MANIFEST.filter((item) => item.file.includes('stump'))).toHaveLength(1);
  });

  it('runs the fence perimeter with a farm-gate gap', () => {
    const fences = DRESSING_MANIFEST.filter((item) => item.file.includes('fence-section'));
    const gates = DRESSING_MANIFEST.filter((item) => item.file.includes('farm-gate'));
    expect(fences.length).toBeGreaterThanOrEqual(3);
    expect(gates).toHaveLength(1);
  });

  it('clusters trough, pump, and well as the Ranch-side group', () => {
    expect(DRESSING_MANIFEST.filter((item) => item.file.includes('trough'))).toHaveLength(1);
    expect(DRESSING_MANIFEST.filter((item) => item.file.includes('pump'))).toHaveLength(1);
    expect(DRESSING_MANIFEST.filter((item) => item.file.includes('well'))).toHaveLength(1);
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
    expect(summary.loadedFiles).toBe(12);
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
    expect(summary.failedFiles).toHaveLength(12);
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
    expect(loaderMocks.loadAsync).toHaveBeenCalledTimes(12);
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
