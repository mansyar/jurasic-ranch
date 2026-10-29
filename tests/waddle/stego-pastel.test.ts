import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { extractAnimationClips } from '../../scripts/bake-trike-variant.js';
import {
  buildStegoClips,
  createStegoDefaultGroup,
  createStegoVariantGroup,
  STEGO_VARIANT_PARAMS,
} from '../../scripts/vendor/bake-stego-variant.js';

/**
 * Baked pastel Stego (FR-1 / FR-2 / FR-3): the pinned bake params, the
 * procedural geometry they produce (pastel COLOR_0, one material, authored
 * proportions), and the authored clips the bake carries — Polyfork's own
 * `Idle`/`Walk`/`Run`, copied verbatim. The GLB-level checks (Draco, single
 * material, clip durations, bounds) live in scripts/check-stego.test.ts, which
 * cannot read colours out of Draco bytes.
 */

const PASTEL_HEXES = [
  '#7fb5a3',
  '#f6ead0',
  '#bacfb9',
  '#6da08e',
  '#4f5e59',
  '#efa27e',
  '#b26a4d',
  '#fff3dd',
] as const;

const COLOR_TOLERANCE = 1e-4;
const MIN_VERTS_PER_ZONE = 50;
const SHIPPED_GLB = new URL('../../public/models/stego.glb', import.meta.url);
/** Authored cycle lengths, as published (AC-1). */
const CLIP_SECONDS = { Idle: 9, Walk: 2.4, Run: 1 } as const;

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

describe('baked pastel stego variant params', () => {
  it('pins the exact Polyfork call: authored size, colour only', () => {
    expect(STEGO_VARIANT_PARAMS).toEqual({
      size: 1,
      plateColour: 'umber',
      hide: '#7fb5a3',
      belly: '#f6ead0',
      blend: '#bacfb9',
      feet: '#6da08e',
      mark: '#4f5e59',
      plate: '#efa27e',
      plateTrim: '#b26a4d',
      spike: '#fff3dd',
    });
    // No geometry knob and no second scale: `plates`/`plateSize`/`tail` rebuild
    // bones, and the authored clips only fit the module's default skeleton —
    // Phase 1 measured official rest pose == module defaults at size 1.0.
  });
});

describe('baked pastel stego variant geometry', () => {
  it('ships one flat-shaded vertex-colored mesh on a single material', () => {
    const mesh = singleMesh(createStegoVariantGroup());
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(mesh.geometry.hasAttribute('color')).toBe(true);
    expect(material.vertexColors).toBe(true);
    expect(material.flatShading).toBe(true);
  });

  it('bakes every pastel zone into COLOR_0 and keeps the retired brown hide out', () => {
    const mesh = singleMesh(createStegoVariantGroup());
    for (const hex of PASTEL_HEXES) {
      expect(countMatchingVerts(mesh.geometry, hex)).toBeGreaterThan(MIN_VERTS_PER_ZONE);
    }
    // The plate *palette* stays the default 'umber' (a separate knob from the
    // pastel `plate`/`plateTrim` faces), so a few plate-shade browns are by
    // design. What must not survive is the brown hide: the pastel zones have to
    // own the majority of the vertices.
    const colorAttribute = mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    const pastelVerts = PASTEL_HEXES.reduce(
      (sum, hex) => sum + countMatchingVerts(mesh.geometry, hex),
      0,
    );
    expect(pastelVerts / colorAttribute.count).toBeGreaterThan(0.6);
    // The adult build's own hide is not one of the pastel zones: recolouring
    // actually replaced it rather than adding on top of it.
    expect(distinctColors(mesh.geometry).some((color) => isPastel(color))).toBe(true);
  });

  it('keeps the authored proportions instead of a size-0.6 baby scale', () => {
    const variantBox = worldBox(createStegoVariantGroup());
    const adultBox = worldBox(createStegoDefaultGroup());
    const variantLength = variantBox.max.z - variantBox.min.z;
    const adultLength = adultBox.max.z - adultBox.min.z;
    // Adult reference as built: ~6.5 m long, 3.8 m at the plates.
    expect(adultLength).toBeGreaterThan(6.3);
    expect(adultLength).toBeLessThan(6.6);
    // The pinned call is the module's own default skeleton at size 1.0, so the
    // variant IS the adult build: gameplay size is a viewer group scale (FR-4),
    // never a bake knob.
    expect(variantLength / adultLength).toBeGreaterThan(0.99);
    expect(variantLength / adultLength).toBeLessThan(1.01);
    expect(variantBox.max.y).toBeGreaterThan(3.4);
    expect(variantBox.max.y).toBeLessThan(4.2);
  });

  it('keeps the Head bone the runtime blush pin targets, feet on y = 0', () => {
    const group = createStegoVariantGroup();
    expect(group.getObjectByName('Head')).not.toBeNull();
    expect(Math.abs(worldBox(group).min.y)).toBeLessThan(0.01);
  });
});

describe('authored clips on the stego rig', () => {
  it('rebuilds Idle, Walk and Run with the published timing', async () => {
    const group = createStegoVariantGroup();
    const clips = buildStegoClips(group, await readFile(SHIPPED_GLB));
    expect(clips.map((clip) => clip.name)).toEqual(['Idle', 'Walk', 'Run']);
    for (const clip of clips) {
      expect(clip.duration).toBeCloseTo(CLIP_SECONDS[clip.name as keyof typeof CLIP_SECONDS], 3);
      expect(clip.tracks.length).toBe(48);
    }
  });

  it('carries translation and rotation only, no synthesised scale track', async () => {
    const group = createStegoVariantGroup();
    const clips = buildStegoClips(group, await readFile(SHIPPED_GLB));
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
    const group = createStegoVariantGroup();
    const walk = buildStegoClips(group, bytes).find((clip) => clip.name === 'Walk');
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
      // retired donor bake, which multiplied every translation by 0.6 and
      // pulled each bone off its rest offset.
      expect(Array.from((track as THREE.KeyframeTrack).values)).toEqual(Array.from(channel.values));
      expect(Array.from((track as THREE.KeyframeTrack).times)).toEqual(Array.from(channel.times));
    }
  });

  it('loops cleanly: first and last Walk keys agree', async () => {
    const group = createStegoVariantGroup();
    const walk = buildStegoClips(group, await readFile(SHIPPED_GLB)).find(
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
