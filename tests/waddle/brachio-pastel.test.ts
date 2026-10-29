import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { extractAnimationTracks } from '../../scripts/bake-trike-variant.js';
import {
  BRACHIO_EXTRA_SCALE,
  BRACHIO_LOOP_SECONDS,
  BRACHIO_POSITION_TRACK_SCALE,
  BRACHIO_VARIANT_PARAMS,
  buildBrachioWaddleClip,
  createBrachioDefaultGroup,
  createBrachioVariantGroup,
} from '../../scripts/vendor/bake-brachio-variant.js';

/**
 * Baked pastel baby Brachio variant (FR-3 / FR-4): asserts the pinned bake
 * params, the procedural variant geometry they produce (lavender-blush pastel
 * COLOR_0, single material, size-0.6 baby with the extra 0.27 post-scale), and
 * the Waddle rebuild the bake applies from the Trike donor clip. The GLB-level
 * checks (Draco, single material, Waddle 1.0 s, bounds) live in
 * scripts/check-brachio.test.ts, which cannot read colors out of Draco bytes.
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

describe('baked pastel baby brachio variant params', () => {
  it('pins the exact Polyfork call from the spec', () => {
    expect(BRACHIO_VARIANT_PARAMS).toEqual({
      size: 0.6,
      neck: 0,
      head: 1,
      tail: 1,
      colorway: 'dusty-umber',
      coat: '#b8a9d6',
      flank: '#c3b2e0',
      belly: '#f2e9d8',
      mottle: '#8a739e',
      muzzle: '#d8c9e8',
      nail: '#5a4a5e',
      eye: '#211b16',
    });
    // Size 0.6 alone still stands ~5.0 m long with the head at 2.14 m on
    // this species (non-linear down there), so the bake applies one extra
    // uniform post-scale (total 0.6 x 0.27): a ~2.7 m grazing baby with the
    // head just under the 1.2 m cap. Position tracks are stride-calibrated
    // (scale 1.85): the group post-scale shrinks world travel, so the scale
    // lands measured foot travel at the coded 0.24 m stride — see the stride
    // test.
    expect(BRACHIO_EXTRA_SCALE).toBe(0.27);
    expect(BRACHIO_POSITION_TRACK_SCALE).toBe(1.85);
    expect(BRACHIO_LOOP_SECONDS).toBe(1.0);
  });
});

describe('baked pastel baby brachio variant geometry', () => {
  it('ships one flat-shaded vertex-colored mesh on a single material', () => {
    const mesh = singleMesh(createBrachioVariantGroup());
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(mesh.geometry.hasAttribute('color')).toBe(true);
    expect(material.vertexColors).toBe(true);
    expect(material.flatShading).toBe(true);
  });

  it('bakes every lavender zone into COLOR_0 and keeps no default colorway color', () => {
    const mesh = singleMesh(createBrachioVariantGroup());
    const counts = PASTEL_HEXES.map(
      (hex) => [hex, countMatchingVerts(mesh.geometry, hex)] as const,
    );
    console.log(`brachio pastel zones: ${counts.map(([hex, n]) => `${hex}=${n}`).join(' ')}`);
    for (const [, n] of counts) {
      expect(n).toBeGreaterThan(MIN_VERTS_PER_ZONE);
    }
    // Retired browns, derived at runtime from the adult default build rather
    // than hand-converted: no default-colorway color survives the pastel bake.
    const defaultColors = distinctColors(singleMesh(createBrachioDefaultGroup()).geometry);
    const variantColors = new Set(
      distinctColors(mesh.geometry).map(
        ([r, g, b]) => `${r.toFixed(6)},${g.toFixed(6)},${b.toFixed(6)}`,
      ),
    );
    const surviving = defaultColors.filter(
      ([r, g, b]) =>
        !PASTEL_HEXES.some((hex) => {
          const c = new THREE.Color(hex);
          return (
            Math.abs(r - c.r) < COLOR_TOLERANCE &&
            Math.abs(g - c.g) < COLOR_TOLERANCE &&
            Math.abs(b - c.b) < COLOR_TOLERANCE
          );
        }) && variantColors.has(`${r.toFixed(6)},${g.toFixed(6)},${b.toFixed(6)}`),
    );
    expect(surviving).toEqual([]);
  });

  it('reads as a grazing baby under the 1.2 m head cap next to the adult default', () => {
    const variantBox = worldBox(createBrachioVariantGroup());
    const adultBox = worldBox(createBrachioDefaultGroup());
    const variantLength = variantBox.max.z - variantBox.min.z;
    const adultLength = adultBox.max.z - adultBox.min.z;
    console.log(
      `brachio bounds: variant z=${variantLength.toFixed(3)} head=${variantBox.max.y.toFixed(3)} ` +
        `adult z=${adultLength.toFixed(3)} adultHead=${adultBox.max.y.toFixed(3)}`,
    );
    // Adult reference as built: ~12.5 m long, upright head near ~12 m.
    expect(adultLength).toBeGreaterThan(11.5);
    expect(adultLength).toBeLessThan(13.5);
    // Total 0.6 x 0.27 scale: a ~2.7 m grazing baby — a touch smaller than
    // the 3.9 m Trike/Stego pen-mates, the price of the cap on a long-necked
    // species — with the head just under the 1.2 m cap.
    expect(variantLength).toBeGreaterThan(2.3);
    expect(variantLength).toBeLessThan(3.1);
    const ratio = variantLength / adultLength;
    expect(ratio).toBeGreaterThan(0.18);
    expect(ratio).toBeLessThan(0.25);
    expect(variantBox.max.y).toBeLessThan(1.3);
    expect(variantBox.max.y).toBeGreaterThan(0.9);
  });

  it('keeps the Head bone the runtime blush pin targets, feet on y = 0', () => {
    const group = createBrachioVariantGroup();
    expect(group.getObjectByName('Head')).not.toBeNull();
    const box = worldBox(group);
    expect(Math.abs(box.min.y)).toBeLessThan(0.01);
  });
});

describe('Brachio Waddle rebuild from the Trike donor', () => {
  /** Shipped Trike baby GLB: the 0.8 s Waddle donor for the Brachio bake. */
  const DONOR_GLB = new URL('../../public/models/trike.glb', import.meta.url);

  it('rebuilds the clip on the sauropod skeleton retimed to 1.0 s, dropping only ears', async () => {
    const bytes = await readFile(DONOR_GLB);
    const animation = extractAnimationTracks(bytes);
    expect(animation.name).toBe('Waddle');
    const group = createBrachioVariantGroup();
    const clip = buildBrachioWaddleClip(group, animation);
    expect(clip.name).toBe('Waddle');
    // Against the shipped Trike donor every channel maps by name, so
    // nothing drops (the drop path is kept: a future donor with channels the
    // sauropod lacks would land in userData.dropped and the bake would log
    // them). All three paths pass through; unmapped extra bones (Neck1-7,
    // Tail1-4, elbows, hocks) hold bind pose.
    expect([...(clip.userData['dropped'] as string[])].sort()).toEqual([]);
    expect(clip.tracks.length).toBe(animation.channels.length);
    expect(clip.duration).toBeCloseTo(1.0, 5);
    const sourceTranslation = animation.channels.find((channel) => channel.path === 'translation');
    const rebuiltTranslation = clip.tracks.find((track) => track.name.endsWith('.position'));
    expect(sourceTranslation).toBeDefined();
    expect(rebuiltTranslation).toBeDefined();
    const sourceValues = (sourceTranslation as { values: Float32Array }).values;
    const rebuiltValues = (rebuiltTranslation as THREE.KeyframeTrack).values;
    expect(rebuiltValues.length).toBe(sourceValues.length);
    for (let i = 0; i < rebuiltValues.length; i += 1) {
      expect(rebuiltValues[i]).toBeCloseTo(sourceValues[i] * BRACHIO_POSITION_TRACK_SCALE, 5);
    }
    const sourceRotation = animation.channels.find((channel) => channel.path === 'rotation');
    const rebuiltRotation = clip.tracks.find((track) => track.name.endsWith('.quaternion'));
    expect(Array.from((rebuiltRotation as THREE.KeyframeTrack).values)).toEqual(
      Array.from((sourceRotation as { values: Float32Array }).values),
    );
    for (const track of clip.tracks) {
      expect((track as THREE.KeyframeTrack).getInterpolation()).toBe(THREE.InterpolateLinear);
    }
    // Loop closure is the donor's own: the rebuild copies every key verbatim
    // (times only change by the uniform 1.0/donor retime), so the shipped
    // endpoints match the donor Waddle exactly.
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
