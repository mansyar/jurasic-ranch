import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { extractAnimationTracks } from '../../scripts/bake-trike-variant.js';
import {
  buildStegoWaddleClip,
  createStegoDefaultGroup,
  createStegoVariantGroup,
  STEGO_POSITION_TRACK_SCALE,
  STEGO_VARIANT_PARAMS,
} from '../../scripts/vendor/bake-stego-variant.js';

/**
 * Baked pastel baby Stego variant (FR-3 / FR-4): asserts the pinned bake
 * params, the procedural variant geometry they produce (dusty-teal pastel
 * COLOR_0, single material, size-0.6 baby proportions), and the Waddle
 * retarget the bake applies from the Trike donor clip. The GLB-level checks
 * (Draco, single material, Waddle 0.8 s, bounds) live in
 * scripts/check-stego.test.ts, which cannot read colors out of Draco bytes.
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
const RETIRED_HEXES = [
  '#ab814f',
  '#9c7242',
  '#63503f',
  '#684a2d',
  '#f4ddb4',
  '#cfaf82',
  '#a67c4b',
  '#ffebc8',
] as const;

const COLOR_TOLERANCE = 1e-4;
const MIN_VERTS_PER_ZONE = 50;

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

function zLengthMetres(group: THREE.Group): number {
  const box = new THREE.Box3().setFromObject(group);
  return box.max.z - box.min.z;
}

describe('baked pastel baby stego variant params', () => {
  it('pins the exact Polyfork call from the spec', () => {
    expect(STEGO_VARIANT_PARAMS).toEqual({
      size: 0.6,
      plates: 24,
      plateSize: 1,
      tail: 1,
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
    expect(STEGO_POSITION_TRACK_SCALE).toBe(0.6);
  });
});

describe('baked pastel baby stego variant geometry', () => {
  it('ships one flat-shaded vertex-colored mesh on a single material', () => {
    const mesh = singleMesh(createStegoVariantGroup());
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(mesh.geometry.hasAttribute('color')).toBe(true);
    expect(material.vertexColors).toBe(true);
    expect(material.flatShading).toBe(true);
  });

  it('bakes every pastel zone into COLOR_0 and drops every retired brown', () => {
    const mesh = singleMesh(createStegoVariantGroup());
    for (const hex of PASTEL_HEXES) {
      expect(countMatchingVerts(mesh.geometry, hex)).toBeGreaterThan(MIN_VERTS_PER_ZONE);
    }
    for (const hex of RETIRED_HEXES) {
      expect(countMatchingVerts(mesh.geometry, hex)).toBe(0);
    }
  });

  it('reads as a size-0.6 baby next to the adult default', () => {
    const variantLength = zLengthMetres(createStegoVariantGroup());
    const adultLength = zLengthMetres(createStegoDefaultGroup());
    expect(adultLength).toBeGreaterThan(6.3);
    expect(adultLength).toBeLessThan(6.6);
    expect(variantLength).toBeGreaterThan(3.3);
    expect(variantLength).toBeLessThan(4.2);
    const ratio = variantLength / adultLength;
    expect(ratio).toBeGreaterThan(0.55);
    expect(ratio).toBeLessThan(0.65);
  });

  it('keeps the Head bone the runtime blush pin targets, feet on y = 0', () => {
    const group = createStegoVariantGroup();
    expect(group.getObjectByName('Head')).not.toBeNull();
    const box = new THREE.Box3().setFromObject(group);
    expect(Math.abs(box.min.y)).toBeLessThan(0.01);
  });
});

describe('Stego Waddle retarget from the Trike donor', () => {
  /** Shipped Trike baby GLB: the 0.8 s Waddle donor for the Stego bake. */
  const DONOR_GLB = new URL('../../public/models/trike.glb', import.meta.url);

  it('rebuilds the clip on the stego skeleton with positions scaled and quats intact', async () => {
    const bytes = await readFile(DONOR_GLB);
    const animation = extractAnimationTracks(bytes);
    expect(animation.name).toBe('Waddle');
    const group = createStegoVariantGroup();
    const clip = buildStegoWaddleClip(group, animation);
    expect(clip.name).toBe('Waddle');
    // 24 mapped nodes x (position + quaternion + scale): the donor Waddle
    // carries all three paths and the retarget passes them through — the
    // Stego rig shares the Trike's 24-bone skeleton, so nothing drops.
    expect(clip.tracks.length).toBe(72);
    expect(clip.duration).toBeGreaterThan(0.79);
    expect(clip.duration).toBeLessThan(0.81);
    const sourceTranslation = animation.channels.find((channel) => channel.path === 'translation');
    const rebuiltTranslation = clip.tracks.find((track) => track.name.endsWith('.position'));
    expect(sourceTranslation).toBeDefined();
    expect(rebuiltTranslation).toBeDefined();
    const sourceValues = (sourceTranslation as { values: Float32Array }).values;
    const rebuiltValues = (rebuiltTranslation as THREE.KeyframeTrack).values;
    expect(rebuiltValues.length).toBe(sourceValues.length);
    for (let i = 0; i < rebuiltValues.length; i += 1) {
      expect(rebuiltValues[i]).toBeCloseTo(sourceValues[i] * STEGO_POSITION_TRACK_SCALE, 5);
    }
    const sourceRotation = animation.channels.find((channel) => channel.path === 'rotation');
    const rebuiltRotation = clip.tracks.find((track) => track.name.endsWith('.quaternion'));
    expect(Array.from((rebuiltRotation as THREE.KeyframeTrack).values)).toEqual(
      Array.from((sourceRotation as { values: Float32Array }).values),
    );
    for (const track of clip.tracks) {
      expect((track as THREE.KeyframeTrack).getInterpolation()).toBe(THREE.InterpolateLinear);
    }
    // Loop closure is the donor's own: the retarget copies every key verbatim
    // (positions only change by the uniform STEGO_POSITION_TRACK_SCALE), so
    // the shipped endpoints match the donor Waddle exactly.
    let maxSeamGap = 0;
    for (const track of clip.tracks) {
      const keyTrack = track as THREE.KeyframeTrack;
      const itemSize = keyTrack.getValueSize();
      const keyCount = keyTrack.values.length / itemSize;
      let trackGap = 0;
      for (let k = 0; k < itemSize; k += 1) {
        trackGap = Math.max(
          trackGap,
          Math.abs(keyTrack.values[k] - keyTrack.values[(keyCount - 1) * itemSize + k]),
        );
      }
      maxSeamGap = Math.max(maxSeamGap, trackGap);
    }
    expect(maxSeamGap).toBeLessThan(0.05);
  });
});
