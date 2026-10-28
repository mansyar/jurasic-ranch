import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  applyPastelRemap,
  attachBlushCheeks,
  BLUSH_CHEEK_RADIUS_METRES,
  luminance01,
  PASTEL_BLUSH_HEX,
  PASTEL_BODY_HEX,
  pastelRemap,
} from "../../src/ranch/pastel.js";

describe("pastelRemap", () => {
  it("shares the exact placeholder hexes", () => {
    expect(PASTEL_BODY_HEX).toBe(0x9e_d6_8a);
    expect(PASTEL_BLUSH_HEX).toBe(0xf2_a0_ac);
  });

  it("remaps authored brown to the pastel green hue, keeping luminance", () => {
    const brown: readonly [number, number, number] = [0.45, 0.29, 0.16];
    const [r, g, b] = pastelRemap(brown[0], brown[1], brown[2]);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    expect(luminance01(r, g, b)).toBeCloseTo(luminance01(brown[0], brown[1], brown[2]), 2);
  });

  it("keeps dark verts (eyes, horns) untouched", () => {
    expect(pastelRemap(0.02, 0.02, 0.02)).toEqual([0.02, 0.02, 0.02]);
  });

  it("keeps cream verts (claws) untouched", () => {
    expect(pastelRemap(0.93, 0.87, 0.72)).toEqual([0.93, 0.87, 0.72]);
  });

  it("keeps pure white untouched", () => {
    expect(pastelRemap(1, 1, 1)).toEqual([1, 1, 1]);
  });
});

describe("applyPastelRemap", () => {
  function createBrownMesh(): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(
        new Float32Array([0.45, 0.29, 0.16, 0.45, 0.29, 0.16, 0.45, 0.29, 0.16]),
        3,
      ),
    );
    return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  }

  it("remaps COLOR_0 to green in place and enables flat shading", () => {
    const mesh = createBrownMesh();
    const model = new THREE.Group();
    model.add(mesh);
    applyPastelRemap(model);
    const colors = mesh.geometry.getAttribute("color");
    expect(colors instanceof THREE.BufferAttribute).toBe(true);
    if (colors instanceof THREE.BufferAttribute) {
      expect(colors.getY(0)).toBeGreaterThan(colors.getX(0));
      expect(colors.getY(0)).toBeGreaterThan(colors.getZ(0));
      expect(colors.version).toBeGreaterThan(0);
    }
    expect(mesh.material instanceof THREE.MeshStandardMaterial).toBe(true);
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      expect(mesh.material.flatShading).toBe(true);
    }
  });

  it("ignores meshes without vertex colors", () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    );
    expect(() => applyPastelRemap(mesh)).not.toThrow();
    if (mesh.material instanceof THREE.MeshStandardMaterial) {
      expect(mesh.material.flatShading).toBe(true);
    }
  });
});

describe("attachBlushCheeks", () => {
  it("pins two pink cheeks under the Head bone", () => {
    const head = new THREE.Group();
    head.name = "Head";
    const cheeks = attachBlushCheeks(head);
    expect(cheeks.length).toBe(2);
    expect(head.children).toHaveLength(2);
    for (const cheek of cheeks) {
      expect(cheek.parent).toBe(head);
    }
    const material = cheeks[0].material;
    expect(material instanceof THREE.MeshStandardMaterial).toBe(true);
    if (material instanceof THREE.MeshStandardMaterial) {
      expect(material.color.getHex()).toBe(PASTEL_BLUSH_HEX);
    }
    expect(cheeks[0].position.x).toBeGreaterThan(0);
    expect(cheeks[1].position.x).toBeCloseTo(-cheeks[0].position.x, 9);
    expect(cheeks[1].position.y).toBe(cheeks[0].position.y);
    expect(cheeks[1].position.z).toBe(cheeks[0].position.z);
    cheeks[0].geometry.computeBoundingSphere();
    expect(cheeks[0].geometry.boundingSphere?.radius).toBeCloseTo(
      BLUSH_CHEEK_RADIUS_METRES,
      5,
    );
  });

  it("is a no-op without a Head and idempotent on repeat swaps", () => {
    expect(attachBlushCheeks(null)).toEqual([]);
    const head = new THREE.Group();
    head.name = "Head";
    attachBlushCheeks(head);
    attachBlushCheeks(head);
    expect(head.children).toHaveLength(2);
  });
});
