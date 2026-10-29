import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { extractAnimationClips } from '../../scripts/bake-trike-variant.js';
import {
  BRACHIO_VARIANT_PARAMS,
  buildBrachioClips,
  createBrachioDefaultGroup,
  createBrachioVariantGroup,
} from '../../scripts/vendor/bake-brachio-variant.js';

/**
 * Baked pastel Brachio (FR-1 / FR-2 / FR-3): the pinned bake params, the
 * procedural geometry they produce (lavender-blush pastel COLOR_0, one
 * material, authored proportions with the upright default neck carriage), and
 * the authored clips the bake carries — Polyfork's own `Idle`/`Walk`/`Run` over
 * all 35 bones, copied verbatim. The GLB-level checks (Draco, single material,
 * clip durations, bounds) live in scripts/check-brachio.test.ts, which cannot
 * read colours out of Draco bytes.
 */

const PASTEL_HEXES = [
  '#b8a9d6',
  '#c3b2e0',
  '#f2e9d8',
  '#8a739e',
  '#d8c9e8',
  '#5a4a5e',
  '#211b16',
] as const;

const COLOR_TOLERANCE = 1e-4;
const MIN_VERTS_PER_ZONE = 50;
const SHIPPED_GLB = new URL('../../public/models/brachio.glb', import.meta.url);
/** Authored cycle lengths, as published (AC-1). */
const CLIP_SECONDS = { Idle: 8, Walk: 3.8, Run: 2.5 } as const;
/** Authored channels: 35 bones x translation + rotation. */
const CHANNELS_PER_CLIP = 70;

/** Count verts whose linear-space color matches the hex within tolerance. */
function countMatchingVerts(geometry: THREE.BufferGeometry, hex: string): number {
  const expected = new THREE.Color(hex);
  const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
  let count = 0;
  for (let i = 0; i < colors.count; i += 1) {
    const close =
      Math.abs(colors.getX(i) - expected.r) < COLOR_TOLERANCE &&
      Math.abs(colors.getY(i) - expected.g) < COLOR_TOLERANCE &&
      Math.abs(colors.getZ(i) - expected.b) < COLOR_TOLERANCE;
    if (close) {
      count += 1;
    }
  }
  return count;
}

/** Distinct linear-space colors baked into a geometry's COLOR_0. */
function distinctColors(geometry: THREE.BufferGeometry): Array<[number, number, number]> {
  const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < colors.count; i += 1) {
    const key = `${colors.getX(i).toFixed(6)},${colors.getY(i).toFixed(6)},${colors.getZ(i).toFixed(6)}`;
    if (!seen.has(key)) {
      seen.set(key, [colors.getX(i), colors.getY(i), colors.getZ(i)]);
    }
  }
  return [...seen.values()];
}

function isPastel(color: [number, number, number]): boolean {
  return PASTEL_HEXES.some((hex) => {
    const c = new THREE.Color(hex);
    return (
      Math.abs(color[0] - c.r) < COLOR_TOLERANCE &&
      Math.abs(color[1] - c.g) < COLOR_TOLERANCE &&
      Math.abs(color[2] - c.b) < COLOR_TOLERANCE
    );
  });
}

function singleMesh(group: THREE.Group): THREE.SkinnedMesh {
  const meshes: THREE.SkinnedMesh[] = [];
  group.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh === true) {
      meshes.push(child as THREE.SkinnedMesh);
    }
  });
  expect(meshes.length).toBe(1);
  return meshes[0] as THREE.SkinnedMesh;
}

function worldBox(group: THREE.Group): THREE.Box3 {
  group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(group);
}

describe('baked pastel brachio variant params', () => {
  it('pins the exact Polyfork call: authored size, colour only', () => {
    expect(BRACHIO_VARIANT_PARAMS).toEqual({
      size: 1,
      colorway: 'dusty-umber',
      coat: '#b8a9d6',
      flank: '#c3b2e0',
      belly: '#f2e9d8',
      mottle: '#8a739e',
      muzzle: '#d8c9e8',
      nail: '#5a4a5e',
      eye: '#211b16',
    });
    // `neck: 0` was the grazing-baby carve and it moves every neck bone; the
    // authored clips were rigged on the module's default upright carriage.
    // `size`, `head` and `tail` are absent for the same reason: they rebuild
    // bones, and Phase 1 measured official rest pose == defaults at size 1.0.
  });
});

describe('baked pastel brachio variant geometry', () => {
  it('ships one flat-shaded vertex-colored mesh on a single material', () => {
    const mesh = singleMesh(createBrachioVariantGroup());
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(mesh.geometry.hasAttribute('color')).toBe(true);
    expect(material.vertexColors).toBe(true);
    expect(material.flatShading).toBe(true);
  });

  it('bakes every lavender zone into COLOR_0 and keeps no default colorway color', () => {
    const mesh = singleMesh(createBrachioVariantGroup());
    for (const hex of PASTEL_HEXES) {
      expect(countMatchingVerts(mesh.geometry, hex)).toBeGreaterThan(MIN_VERTS_PER_ZONE);
    }
    // Retired browns are derived from the adult default build rather than
    // hand-converted: no default-colorway colour survives the pastel bake.
    const variantColors = new Set(
      distinctColors(mesh.geometry).map(
        ([r, g, b]) => `${r.toFixed(6)},${g.toFixed(6)},${b.toFixed(6)}`,
      ),
    );
    const surviving = distinctColors(singleMesh(createBrachioDefaultGroup()).geometry).filter(
      (color) =>
        !isPastel(color) &&
        variantColors.has(`${color[0].toFixed(6)},${color[1].toFixed(6)},${color[2].toFixed(6)}`),
    );
    expect(surviving).toEqual([]);
  });

  it('keeps the authored proportions instead of a grazing baby carve', () => {
    const variantBox = worldBox(createBrachioVariantGroup());
    const adultBox = worldBox(createBrachioDefaultGroup());
    const variantLength = variantBox.max.z - variantBox.min.z;
    const adultLength = adultBox.max.z - adultBox.min.z;
    // Adult reference as built: ~12.5 m long, upright head near 12 m.
    expect(adultLength).toBeGreaterThan(11.5);
    expect(adultLength).toBeLessThan(13.5);
    // The pinned call is the module's own default skeleton at size 1.0, so the
    // variant IS the adult build: gameplay size is a viewer group scale (FR-4),
    // never a bake knob.
    expect(variantLength / adultLength).toBeGreaterThan(0.99);
    expect(variantLength / adultLength).toBeLessThan(1.01);
    expect(variantBox.max.y).toBeGreaterThan(11.5);
    expect(variantBox.max.y).toBeLessThan(13);
  });

  it('keeps the Head bone the runtime blush pin targets, feet on y = 0', () => {
    const group = createBrachioVariantGroup();
    expect(group.getObjectByName('Head')).not.toBeNull();
    expect(Math.abs(worldBox(group).min.y)).toBeLessThan(0.01);
  });
});

describe('authored clips on the brachio rig', () => {
  it('rebuilds Idle, Walk and Run with the published timing', async () => {
    const group = createBrachioVariantGroup();
    const clips = buildBrachioClips(group, await readFile(SHIPPED_GLB));
    expect(clips.map((clip) => clip.name)).toEqual(['Idle', 'Walk', 'Run']);
    for (const clip of clips) {
      expect(clip.duration).toBeCloseTo(CLIP_SECONDS[clip.name as keyof typeof CLIP_SECONDS], 3);
      expect(clip.tracks.length).toBe(CHANNELS_PER_CLIP);
    }
  });

  it('drives the sauropod-only bones the Trike donor never animated', async () => {
    const group = createBrachioVariantGroup();
    const walk = buildBrachioClips(group, await readFile(SHIPPED_GLB)).find(
      (clip) => clip.name === 'Walk',
    ) as THREE.AnimationClip;
    const animated = new Set(walk.tracks.map((track) => track.name.split('.')[0]));
    for (const bone of ['Neck1', 'Neck7', 'Tail1', 'Tail4']) {
      expect(animated.has(bone), bone).toBe(true);
    }
  });

  it('carries translation and rotation only, no synthesised scale track', async () => {
    const group = createBrachioVariantGroup();
    const clips = buildBrachioClips(group, await readFile(SHIPPED_GLB));
    for (const clip of clips) {
      for (const track of clip.tracks) {
        expect(track.name.endsWith('.position') || track.name.endsWith('.quaternion')).toBe(true);
        expect((track as THREE.KeyframeTrack).getInterpolation()).toBe(THREE.InterpolateLinear);
      }
    }
  });

  it('copies the published key values verbatim — no position rescale', async () => {
    const bytes = await readFile(SHIPPED_GLB);
    const source = extractAnimationClips(bytes).find((animation) => animation.name === 'Walk');
    expect(source).toBeDefined();
    const group = createBrachioVariantGroup();
    const walk = buildBrachioClips(group, bytes).find((clip) => clip.name === 'Walk');
    expect(walk).toBeDefined();
    const tracks = new Map(
      (walk as THREE.AnimationClip).tracks.map((track) => [track.name, track]),
    );
    for (const channel of source?.channels ?? []) {
      const track = tracks.get(
        `${channel.nodeName}.${channel.path === 'translation' ? 'position' : 'quaternion'}`,
      );
      expect(track, `${channel.nodeName}.${channel.path}`).toBeDefined();
      // Exactly the published floats: this is the regression guard for the
      // retired donor bake, which multiplied every translation by 1.85 and
      // pulled each bone off its rest offset.
      expect(Array.from((track as THREE.KeyframeTrack).values)).toEqual(Array.from(channel.values));
      expect(Array.from((track as THREE.KeyframeTrack).times)).toEqual(Array.from(channel.times));
    }
  });

  it('loops cleanly: first and last Walk keys agree', async () => {
    const group = createBrachioVariantGroup();
    const walk = buildBrachioClips(group, await readFile(SHIPPED_GLB)).find(
      (clip) => clip.name === 'Walk',
    ) as THREE.AnimationClip;
    for (const track of walk.tracks) {
      const keyTrack = track as THREE.KeyframeTrack;
      const itemSize = keyTrack.getValueSize();
      const keyCount = keyTrack.values.length / itemSize;
      for (let k = 0; k < itemSize; k += 1) {
        expect(
          Math.abs(keyTrack.values[k] - keyTrack.values[(keyCount - 1) * itemSize + k]),
        ).toBeLessThan(0.05);
      }
    }
  });
});
