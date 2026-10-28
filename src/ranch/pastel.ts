import * as THREE from "three";

/**
 * Pastel baby look (review-fix-2): the shipped GLB carries authored Polyfork
 * browns in COLOR_0 vertex colors under a single material, so the viewer
 * remaps them at load to the placeholder's pastel green and pins pink blush
 * cheeks to the Head bone. Pure and headless-testable; the viewer wires it
 * into the rigged-model swap block.
 */

/** Pastel baby-green body, shared verbatim with the placeholder Trike. */
export const PASTEL_BODY_HEX = 0x9ed68a;

/** Pastel blush pink, shared verbatim with the placeholder cheeks. */
export const PASTEL_BLUSH_HEX = 0xf2a0ac;

/** Blush cheek sphere radius in metres. */
export const BLUSH_CHEEK_RADIUS_METRES = 0.03;

/** Cheek offsets in Head-bone local space: symmetric, low and forward. */
export const BLUSH_CHEEK_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [0.09, -0.02, 0.1],
  [-0.09, -0.02, 0.1],
];

/** Vertex colors below this luminance are kept: dark eyes and horns. */
const DARK_LUMINANCE_MAX = 0.12;

/** Low-saturation vertex colors above this luminance are kept: cream claws. */
const CREAM_LUMINANCE_MIN = 0.6;

/** Saturation ceiling for the cream keep-rule. */
const CREAM_SATURATION_MAX = 0.25;

const PASTEL_BODY_RGB: readonly [number, number, number] = [
  ((PASTEL_BODY_HEX >> 16) & 0xff) / 255,
  ((PASTEL_BODY_HEX >> 8) & 0xff) / 255,
  (PASTEL_BODY_HEX & 0xff) / 255,
];

const PASTEL_BODY_LUMINANCE =
  0.2126 * PASTEL_BODY_RGB[0] + 0.7152 * PASTEL_BODY_RGB[1] + 0.0722 * PASTEL_BODY_RGB[2];

/** Rec.709 luminance of an sRGB 0..1 triplet. */
export function luminance01(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Chroma spread of an sRGB 0..1 triplet; near 0 reads as grey or cream. */
export function saturation01(r: number, g: number, b: number): number {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Preserve-luminance pastel remap: dark verts (eyes, horns) and cream verts
 * (claws) pass through, everything else becomes the placeholder pastel green
 * scaled so the vertex keeps its own luminance (baked shading survives).
 */
export function pastelRemap(r: number, g: number, b: number): [number, number, number] {
  const luminance = luminance01(r, g, b);
  if (luminance < DARK_LUMINANCE_MAX) {
    return [r, g, b];
  }
  if (luminance > CREAM_LUMINANCE_MIN && saturation01(r, g, b) < CREAM_SATURATION_MAX) {
    return [r, g, b];
  }
  const scale = luminance / PASTEL_BODY_LUMINANCE;
  return [
    clamp01(PASTEL_BODY_RGB[0] * scale),
    clamp01(PASTEL_BODY_RGB[1] * scale),
    clamp01(PASTEL_BODY_RGB[2] * scale),
  ];
}

/** Remap a `color` (COLOR_0) attribute to pastel in place. */
export function remapColorAttribute(attribute: THREE.BufferAttribute): void {
  for (let i = 0; i < attribute.count; i += 1) {
    const [r, g, b] = pastelRemap(attribute.getX(i), attribute.getY(i), attribute.getZ(i));
    attribute.setXYZ(i, r, g, b);
  }
  attribute.needsUpdate = true;
}

/**
 * Apply the pastel look to a loaded GLB scene in place: remap every COLOR_0
 * attribute and switch standard materials to runtime flat shading (glTF
 * carries no flat-shading flag, so this half stays a runtime step and the
 * file keeps its single Draco material per NFR-2).
 */
export function applyPastelRemap(model: THREE.Object3D): void {
  model.traverse((child: THREE.Object3D) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const colors = child.geometry.getAttribute("color");
    if (colors instanceof THREE.BufferAttribute && colors.itemSize === 3) {
      remapColorAttribute(colors);
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial && !material.flatShading) {
        material.flatShading = true;
        material.needsUpdate = true;
      }
    }
  });
}

/**
 * Pin two pink blush spheres to a Head bone (the same reference TrikePlayer
 * uses for the head-dip blink). No-op when there is no Head; cheeks that
 * already exist are reused so repeat swaps stay idempotent.
 */
export function attachBlushCheeks(head: THREE.Object3D | null): THREE.Mesh[] {
  if (head === null) {
    return [];
  }
  const material = new THREE.MeshStandardMaterial({
    color: PASTEL_BLUSH_HEX,
    flatShading: true,
    roughness: 0.9,
  });
  const cheeks: THREE.Mesh[] = [];
  BLUSH_CHEEK_OFFSETS.forEach(([x, y, z], index) => {
    const name = index === 0 ? "Blush_L" : "Blush_R";
    const existing = head.getObjectByName(name);
    if (existing instanceof THREE.Mesh) {
      cheeks.push(existing);
      return;
    }
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(BLUSH_CHEEK_RADIUS_METRES, 8, 8),
      material,
    );
    cheek.name = name;
    cheek.position.set(x, y, z);
    head.add(cheek);
    cheeks.push(cheek);
  });
  return cheeks;
}
