import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DinoPlayer } from '../ranch/dino-player.js';
import { WADDLE_LOOP_SECONDS } from '../ranch/waddle.js';
import { isAudioUnlocked } from './audio.js';
import { BLUSH_HEX, loadTrikePlayer, TRIKE_MODEL_URL } from './loaders.js';
import {
  createPlaceholderTrike,
  PLACEHOLDER_BODY_HEX,
  PLACEHOLDER_BODY_NAME,
  updatePlaceholderWalk,
} from './placeholders.js';
import { FALLBACK_PIXEL_RATIO, MAX_PIXEL_RATIO, resolvePixelRatio } from './pixel-ratio.js';
import { readSetting } from './storage.js';

const ROOT_URL = new URL('../../', import.meta.url);

/** Loader-boundary stubs: the tests below never touch WebGL or the network. */
const loaderMocks = vi.hoisted(() => ({
  loadAsync: vi.fn(),
  setDRACOLoader: vi.fn(),
  setDecoderPath: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn(function (this: unknown) {
    return {
      loadAsync: loaderMocks.loadAsync,
      setDRACOLoader: loaderMocks.setDRACOLoader,
    };
  }),
}));

vi.mock('three/addons/loaders/DRACOLoader.js', () => ({
  DRACOLoader: vi.fn(function (this: unknown) {
    return {
      setDecoderPath: loaderMocks.setDecoderPath,
      dispose: loaderMocks.dispose,
    };
  }),
}));

/** The only placeholder part the fallback bob may move. */
function bodyOf(trike: THREE.Group): THREE.Object3D {
  return trike.getObjectByName(PLACEHOLDER_BODY_NAME) ?? trike;
}

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, ROOT_URL), 'utf8');
}

describe('resolvePixelRatio', () => {
  it('caps the renderer at the tablet-friendly maximum', () => {
    expect(MAX_PIXEL_RATIO).toBe(2);
    expect(resolvePixelRatio(3)).toBe(2);
    expect(resolvePixelRatio(2.75)).toBe(2);
  });

  it('passes through ordinary ratios untouched', () => {
    expect(resolvePixelRatio(1)).toBe(1);
    expect(resolvePixelRatio(1.5)).toBe(1.5);
    expect(resolvePixelRatio(2)).toBe(2);
  });

  it('falls back to 1 for missing or unusable values', () => {
    expect(resolvePixelRatio(0)).toBe(FALLBACK_PIXEL_RATIO);
    expect(resolvePixelRatio(-2)).toBe(FALLBACK_PIXEL_RATIO);
    expect(resolvePixelRatio(Number.NaN)).toBe(FALLBACK_PIXEL_RATIO);
    expect(resolvePixelRatio(Number.POSITIVE_INFINITY)).toBe(FALLBACK_PIXEL_RATIO);
    expect(resolvePixelRatio(undefined)).toBe(FALLBACK_PIXEL_RATIO);
    expect(resolvePixelRatio('2')).toBe(FALLBACK_PIXEL_RATIO);
  });
});

describe('placeholder trike', () => {
  it('stands on the ground plane with a baby-scale body', () => {
    const trike = createPlaceholderTrike();
    expect(trike.children.length).toBeGreaterThan(0);
    const box = new THREE.Box3().setFromObject(trike);
    expect(Math.abs(box.min.y)).toBeLessThan(1e-6);
    // Same footprint as the rigged swap target (~3.8 m baked baby, facing
    // +Z): the swap must not pop in size or heading. Bounds mirror the
    // shipped-GLB window in scripts/check-trike.test.ts (3.3–4.2 m).
    const size = box.getSize(new THREE.Vector3());
    expect(size.z).toBeGreaterThanOrEqual(3.3);
    expect(size.z).toBeLessThanOrEqual(4.2);
    expect(trike.rotation.y).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('loops the 0.8 s walk pose seamlessly', () => {
    expect(WADDLE_LOOP_SECONDS).toBe(0.8);
    const a = createPlaceholderTrike();
    const b = createPlaceholderTrike();
    updatePlaceholderWalk(a, 0);
    updatePlaceholderWalk(b, WADDLE_LOOP_SECONDS);
    expect(bodyOf(a).position.y).toBe(0);
    expect(bodyOf(a).position.y).toBe(bodyOf(b).position.y);
    expect(bodyOf(a).rotation.z).toBe(bodyOf(b).rotation.z);
  });

  it('bobs the body mid-stride while the feet stay planted', () => {
    const trike = createPlaceholderTrike();
    updatePlaceholderWalk(trike, WADDLE_LOOP_SECONDS / 4);
    expect(bodyOf(trike).position.y).toBeGreaterThan(0);
    expect(trike.position.y).toBe(0);
    expect(trike.rotation.z).toBe(0);
  });

  it('reserves the Phase 2 model URL', () => {
    expect(TRIKE_MODEL_URL).toBe('/models/trike.glb');
  });
});

describe('rigged trike loader', () => {
  beforeEach(() => {
    loaderMocks.loadAsync.mockReset();
    loaderMocks.setDRACOLoader.mockReset();
    loaderMocks.setDecoderPath.mockReset();
    loaderMocks.dispose.mockReset();
  });

  it('requests /models/trike.glb and wraps the Waddle clip in a DinoPlayer', async () => {
    const scene = new THREE.Group();
    const clip = new THREE.AnimationClip('Waddle', 0.8, []);
    loaderMocks.loadAsync.mockResolvedValue({ scene, animations: [clip] });
    const loaded = await loadTrikePlayer();
    expect(TRIKE_MODEL_URL).toBe('/models/trike.glb');
    expect(loaderMocks.loadAsync).toHaveBeenCalledWith('/models/trike.glb');
    // Offline-first lock: the decoder must come from the vendored same-origin
    // path, never the Google CDN default.
    expect(loaderMocks.setDecoderPath).toHaveBeenCalledWith('/draco/');
    expect(loaderMocks.setDRACOLoader).toHaveBeenCalledTimes(1);
    expect(loaded.model).toBe(scene);
    expect(loaded.player).toBeInstanceOf(DinoPlayer);
    expect(loaded.player.clipDurationSeconds).toBeCloseTo(0.8, 5);
  });

  it('prefers the Waddle clip over other animations', async () => {
    const scene = new THREE.Group();
    loaderMocks.loadAsync.mockResolvedValue({
      scene,
      animations: [
        new THREE.AnimationClip('Idle', 1.4, []),
        new THREE.AnimationClip('Waddle', 0.8, []),
      ],
    });
    const loaded = await loadTrikePlayer();
    expect(loaded.player.clipDurationSeconds).toBeCloseTo(0.8, 5);
  });

  it('rejects when the GLB cannot load so the viewer keeps the placeholder', async () => {
    loaderMocks.loadAsync.mockRejectedValue(new Error('offline'));
    await expect(loadTrikePlayer()).rejects.toThrow('offline');
  });

  it('rejects when the GLB carries no animations', async () => {
    loaderMocks.loadAsync.mockResolvedValue({ scene: new THREE.Group(), animations: [] });
    await expect(loadTrikePlayer()).rejects.toThrow('Waddle');
  });
});

describe('rigged baked look', () => {
  beforeEach(() => {
    loaderMocks.loadAsync.mockReset();
  });

  /** Baked-pastel rig with a Head bone, mirroring the shipped GLB. */
  function createBakedRig(): THREE.Group {
    const root = new THREE.Group();
    const head = new THREE.Group();
    head.name = 'Head';
    root.add(head);
    const baked = new THREE.Color(PLACEHOLDER_BODY_HEX);
    const triple = [baked.r, baked.g, baked.b];
    const colorArray = new Float32Array([...triple, ...triple, ...triple]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
    );
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));
    return root;
  }

  function placeholderHexes(): Set<number> {
    const hexes = new Set<number>();
    createPlaceholderTrike().traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        hexes.add(child.material.color.getHex());
      }
    });
    return hexes;
  }

  it('leaves the baked vertex colors untouched (no runtime recolor)', async () => {
    const rig = createBakedRig();
    // Snapshot the baked mesh before load: the loader resolves with this same
    // scene, and the load pins blush cheeks (plain Meshes with no COLOR_0)
    // ahead of it in traversal order.
    const baked = rig.getObjectByProperty('type', 'Mesh') as THREE.Mesh;
    const beforeColors = (
      baked.geometry.getAttribute('color') as THREE.BufferAttribute
    ).array.slice();
    const clip = new THREE.AnimationClip('Waddle', 0.8, []);
    loaderMocks.loadAsync.mockResolvedValue({ scene: rig, animations: [clip] });
    const loaded = await loadTrikePlayer();
    expect(placeholderHexes().has(PLACEHOLDER_BODY_HEX)).toBe(true);
    expect(loaded.model).toBe(rig);
    const afterColors = (baked.geometry.getAttribute('color') as THREE.BufferAttribute).array;
    expect(Array.from(afterColors)).toEqual(Array.from(beforeColors));
    expect((baked.material as THREE.MeshStandardMaterial).flatShading).toBe(false);
  });

  it('pins pink blush cheeks under the rigged Head bone', async () => {
    const rig = createBakedRig();
    const clip = new THREE.AnimationClip('Waddle', 0.8, []);
    loaderMocks.loadAsync.mockResolvedValue({ scene: rig, animations: [clip] });
    const loaded = await loadTrikePlayer();
    expect(placeholderHexes().has(BLUSH_HEX)).toBe(true);
    const head = loaded.model.getObjectByName('Head');
    expect(head).toBeDefined();
    const cheeks =
      head?.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh) ?? [];
    expect(cheeks.length).toBe(2);
    for (const cheek of cheeks) {
      expect(cheek.material instanceof THREE.MeshStandardMaterial).toBe(true);
      if (cheek.material instanceof THREE.MeshStandardMaterial) {
        expect(cheek.material.color.getHex()).toBe(BLUSH_HEX);
      }
    }
  });
});

describe('no runtime pastel remap', () => {
  it('wires no recolor helper into the viewer', async () => {
    const source = await readText('src/viewer/loaders.ts');
    expect(source).not.toContain('applyPastelRemap');
    expect(source).not.toContain('remapColorAttribute');
    expect(source).not.toContain('pastelRemap');
    expect(source).not.toContain('../ranch/pastel');
  });

  it('deletes the runtime remap module', async () => {
    await expect(readFile(new URL('src/ranch/pastel.ts', ROOT_URL))).rejects.toThrow();
  });
});

describe('audio stub', () => {
  it('starts locked and silent', () => {
    expect(isAudioUnlocked()).toBe(false);
  });
});

describe('storage stub', () => {
  it('reads unknown keys as undefined without storage', async () => {
    await expect(readSetting('missing-key')).resolves.toBeUndefined();
  });
});

describe('offline shell', () => {
  it('links the web manifest and viewer entry', async () => {
    const html = await readText('index.html');
    expect(html).toContain('/manifest.webmanifest');
    expect(html).toContain('/src/viewer/main.ts');
    expect(html).toContain('walk-button');
    expect(html).toContain('72px');
  });

  it('ships a standalone manifest with an icon', async () => {
    const raw = await readText('public/manifest.webmanifest');
    const manifest = JSON.parse(raw) as {
      display?: string;
      icons?: Array<{ src?: string }>;
      name?: string;
      start_url?: string;
    };
    expect(manifest.name).toContain('Jurasic Ranch');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBeDefined();
    expect(manifest.icons?.length ?? 0).toBeGreaterThan(0);
    expect(manifest.icons?.[0]?.src).toBe('/icons/icon.svg');
    await expect(readFile(new URL('public/icons/icon.svg', ROOT_URL))).resolves.toBeDefined();
  });
});
