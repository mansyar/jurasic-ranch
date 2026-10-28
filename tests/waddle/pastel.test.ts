import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  buildRetargetedClip,
  createDefaultGroup,
  createVariantGroup,
  extractAnimationTracks,
  POSITION_TRACK_SCALE,
  TRIKE_VARIANT_PARAMS,
} from "../../scripts/bake-trike-variant.js";

/**
 * Baked pastel baby variant (replaces the runtime-remap pastel suite):
 * asserts the pinned bake params, the procedural variant geometry they
 * produce (pastel COLOR_0, single material, baby proportions), and the
 * Waddle retarget the bake applies to the previous GLB. The GLB-level
 * checks (Draco, single material, Waddle 0.8 s, bounds) live in
 * scripts/check-trike.test.ts, which cannot read colors out of Draco bytes.
 */

const PASTEL_HEXES = ["#9ed68a", "#c4e8b0", "#f2e8c9", "#7fb069"] as const;
const RETIRED_HEXES = [
  "#a97a50",
  "#c9a579",
  "#5a3a22",
  "#7c5434",
  "#e4d5b6",
  "#e2d2ae",
  "#dcc9a2",
  "#a8442a",
] as const;

const COLOR_TOLERANCE = 1e-4;
const MIN_VERTS_PER_ZONE = 50;

/** Count verts whose linear-space color matches the hex within tolerance. */
function countMatchingVerts(geometry: THREE.BufferGeometry, hex: string): number {
  const expected = new THREE.Color(hex);
  const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
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

describe("baked pastel baby variant params", () => {
  it("pins the exact Polyfork call from the spec", () => {
    expect(TRIKE_VARIANT_PARAMS).toEqual({
      size: 0.6,
      horns: 0.7,
      noseHorn: 0.6,
      frill: "rayed",
      hide: "#9ed68a",
      belly: "#c4e8b0",
      horn: "#f2e8c9",
      mark: "#7fb069",
      shieldTrim: "#f2e8c9",
      shieldMark: "#7fb069",
    });
    expect(POSITION_TRACK_SCALE).toBe(0.6);
  });
});

describe("baked pastel baby variant geometry", () => {
  it("ships one flat-shaded vertex-colored mesh on a single material", () => {
    const mesh = singleMesh(createVariantGroup());
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(mesh.geometry.hasAttribute("color")).toBe(true);
    expect(material.vertexColors).toBe(true);
    expect(material.flatShading).toBe(true);
  });

  it("bakes every pastel zone into COLOR_0 and drops every retired brown", () => {
    const mesh = singleMesh(createVariantGroup());
    for (const hex of PASTEL_HEXES) {
      expect(countMatchingVerts(mesh.geometry, hex)).toBeGreaterThan(MIN_VERTS_PER_ZONE);
    }
    for (const hex of RETIRED_HEXES) {
      expect(countMatchingVerts(mesh.geometry, hex)).toBe(0);
    }
  });

  it("reads as a size-0.6 baby next to the adult default", () => {
    const variantLength = zLengthMetres(createVariantGroup());
    const adultLength = zLengthMetres(createDefaultGroup());
    expect(adultLength).toBeGreaterThan(6.0);
    expect(adultLength).toBeLessThan(6.5);
    expect(variantLength).toBeGreaterThan(3.3);
    expect(variantLength).toBeLessThan(4.2);
    const ratio = variantLength / adultLength;
    expect(ratio).toBeGreaterThan(0.55);
    expect(ratio).toBeLessThan(0.65);
  });

  it("keeps the Head bone the runtime blush pin targets, feet on y = 0", () => {
    const group = createVariantGroup();
    expect(group.getObjectByName("Head")).not.toBeNull();
    const box = new THREE.Box3().setFromObject(group);
    expect(Math.abs(box.min.y)).toBeLessThan(0.01);
  });
});

describe("Waddle retarget onto the baby skeleton", () => {
  /** Shipped baby GLB (bake output): the 0.3x-root donor was consumed by the
   * bake, which validates the donor root scale at bake time and refuses to
   * guess otherwise. */
  const SHIPPED_GLB = new URL("../../public/models/trike.glb", import.meta.url);

  it("finds a seamless 0.8 s Waddle on the shipped GLB with a 1.0x root", async () => {
    const bytes = await readFile(SHIPPED_GLB);
    const animation = extractAnimationTracks(bytes);
    expect(animation.name).toBe("Waddle");
    expect(animation.durationSeconds).toBeGreaterThan(0.79);
    expect(animation.durationSeconds).toBeLessThan(0.81);
    expect(animation.rootScale).not.toBeNull();
    // Measured 1.0: size 0.6 is baked into the geometry, no root rescale.
    // (The 0.3x-root donor was consumed by the bake, which validates the
    // donor root scale at bake time and refuses to guess otherwise.)
    expect(Math.abs((animation.rootScale as number) - 1.0)).toBeLessThan(0.01);
    const translations = animation.channels.filter((channel) => channel.path === "translation");
    const rotations = animation.channels.filter((channel) => channel.path === "rotation");
    const scales = animation.channels.filter((channel) => channel.path === "scale");
    expect(translations.length).toBe(24);
    expect(rotations.length).toBe(24);
    expect(scales.length).toBe(24);
    for (const channel of animation.channels) {
      if (channel.path === "scale") {
        // Blender marks constant scale F-curves STEP on round-trip; either
        // way the mixer's output is a constant scale per segment.
        expect(["STEP", "LINEAR"]).toContain(channel.interpolation);
      } else {
        expect(channel.interpolation).toBe("LINEAR");
      }
    }
  });

  it("rebuilds the clip on the variant skeleton with positions scaled and quats intact", async () => {
    const bytes = await readFile(SHIPPED_GLB);
    const animation = extractAnimationTracks(bytes);
    const group = createVariantGroup();
    const clip = buildRetargetedClip(group, animation);
    expect(clip.name).toBe("Waddle");
    // 24 bones x (position + quaternion + scale): the donor Waddle carries
    // scale tracks and the retarget passes them through verbatim.
    expect(clip.tracks.length).toBe(72);
    expect(Math.abs(clip.duration - animation.durationSeconds)).toBeLessThan(1e-6);
    const sourceTranslation = animation.channels.find((channel) => channel.path === "translation");
    const rebuiltTranslation = clip.tracks.find((track) => track.name.endsWith(".position"));
    expect(sourceTranslation).toBeDefined();
    expect(rebuiltTranslation).toBeDefined();
    const sourceValues = (sourceTranslation as { values: Float32Array }).values;
    const rebuiltValues = (rebuiltTranslation as THREE.KeyframeTrack).values;
    expect(rebuiltValues.length).toBe(sourceValues.length);
    for (let i = 0; i < rebuiltValues.length; i += 1) {
      expect(rebuiltValues[i]).toBeCloseTo(sourceValues[i] * POSITION_TRACK_SCALE, 5);
    }
    const sourceRotation = animation.channels.find((channel) => channel.path === "rotation");
    const rebuiltRotation = clip.tracks.find((track) => track.name.endsWith(".quaternion"));
    expect(Array.from((rebuiltRotation as THREE.KeyframeTrack).values)).toEqual(
      Array.from((sourceRotation as { values: Float32Array }).values),
    );
    // Loop closure is the donor's own: the retarget copies every key verbatim
    // (positions only change by the uniform POSITION_TRACK_SCALE), so the
    // shipped endpoints match the donor Waddle exactly. Measured max endpoint
    // gap on the shipped file is 0.0486 (LeftFrontFoot.quaternion; leg-bone
    // rotations dominate, translations all close under a centimetre). Gait
    // quality on the new legs — including foot-slide tolerance across the
    // cycle — is Phase 2 work, which owns the shipped stride end to end.
    const gaps: Array<{ name: string; gap: number }> = [];
    let maxSeamGap = 0;
    for (const track of clip.tracks) {
      const keyTrack = track as THREE.KeyframeTrack;
      const itemSize = keyTrack.getValueSize();
      const keyCount = keyTrack.values.length / itemSize;
      let trackGap = 0;
      for (let k = 0; k < itemSize; k += 1) {
        trackGap = Math.max(trackGap, Math.abs(keyTrack.values[k] - keyTrack.values[(keyCount - 1) * itemSize + k]));
      }
      gaps.push({ name: track.name, gap: trackGap });
      maxSeamGap = Math.max(maxSeamGap, trackGap);
    }
    gaps.sort((a, b) => b.gap - a.gap);
    expect(maxSeamGap).toBeLessThan(0.05);
  });
});
