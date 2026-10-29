import * as THREE from 'three';
import { WADDLE_LOOP_SECONDS } from '../ranch/waddle.js';
import { BLUSH_HEX, IN_GAME_BODY_LENGTH_METRES } from './loaders.js';

/**
 * The instant fallback dinos: boxy flat-shaded groups painted while the
 * rigged GLBs load, plus the shared body-bob pose. Each faces +Z with its feet
 * on y = 0 and is scaled to the exact in-game length of the rigged model it
 * stands in for, so the swap is a shape change and not also a size jump.
 */

/** Placeholder part that may bob; the legs stay planted (body-only bob). */
export const PLACEHOLDER_BODY_NAME = 'PlaceholderBody';

/** Baked pastel palette: the shipped GLB carries it in vertex colors, so no
 * runtime recolor; only the pink blush cheeks stay runtime. Matches the bake. */
/** Baby-green body, verbatim the baked GLB hide zone. */
export const PLACEHOLDER_BODY_HEX = 0x9ed68a;
/** Boxy fallback Stego hide: dusty teal, verbatim the baked Stego hide zone. */
export const STEGO_BODY_HEX = 0x7fb5a3;
/** Boxy fallback Stego plates: peach, verbatim the baked Stego plate zone. */
export const STEGO_PLATE_HEX = 0xefa27e;
/** Boxy fallback Brachio hide: lavender, verbatim the baked Brachio coat zone. */
export const BRACHIO_BODY_HEX = 0xb8a9d6;
/** Cream belly accent, verbatim the baked Brachio belly zone. */
export const BRACHIO_BELLY_HEX = 0xf2e9d8;
/** Lateral spawn offset in metres: Trike starts at -x, Stego at +x (FR-5). */
export const SPAWN_OFFSET_METRES = 0.4;

/**
 * Length each placeholder is scaled to, in metres: the rigged model's in-game
 * length (phase 4). Driving the placeholder off the same numbers is what keeps
 * the pop on load at 1.0x — the boxy Brachio used to stand 2.79 m where a
 * 7.42 m model lands, a 2.66x jump.
 */
export const PLACEHOLDER_BODY_LENGTH_METRES = IN_GAME_BODY_LENGTH_METRES;

/** Scratch vector for the one-off authored-span measurement. */
const authoredSpan = new THREE.Vector3();

/**
 * Scale a finished placeholder so its longest side is `targetMetres`: measured
 * from the assembled parts, so adding or reshaping a body part cannot silently
 * change the size the swap lands at. Length is the longest side of each of
 * these silhouettes (the Brachio's neck contributes height, never more than
 * its tail-to-nose span), and the scale is uniform so the bob pose is safe.
 */
function scaleToBodyLength(group: THREE.Group, targetMetres: number): void {
  group.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(group).getSize(authoredSpan);
  const authored = Math.max(size.x, size.y, size.z);
  group.scale.setScalar(targetMetres / authored);
}

/** Pastel flat-shaded baby Trike: scaled to the rigged 3.708 m; paints
 * instantly, then leaves on a swap. */
export function createPlaceholderTrike(): THREE.Group {
  const body = new THREE.MeshStandardMaterial({
    color: PLACEHOLDER_BODY_HEX,
    flatShading: true,
    roughness: 0.9,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x3a4a3a,
    flatShading: true,
    roughness: 0.9,
  });
  const blush = new THREE.MeshStandardMaterial({
    color: BLUSH_HEX,
    flatShading: true,
    roughness: 0.9,
  });

  const trike = new THREE.Group();
  trike.name = 'PlaceholderTrike';

  const upper = new THREE.Group();
  upper.name = PLACEHOLDER_BODY_NAME;
  trike.add(upper);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), body);
  torso.scale.set(1.6, 1.0, 1.0);
  torso.position.set(0, 0.42, 0);
  upper.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), body);
  head.position.set(0.5, 0.56, 0);
  upper.add(head);

  const frill = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 12), body);
  frill.rotation.z = Math.PI / 2;
  frill.position.set(0.34, 0.62, 0);
  upper.add(frill);

  const hornGeo = new THREE.ConeGeometry(0.035, 0.12, 8);
  for (const z of [-0.08, 0.08]) {
    const horn = new THREE.Mesh(hornGeo, dark);
    horn.position.set(0.62, 0.74, z);
    upper.add(horn);
  }
  const noseHorn = new THREE.Mesh(hornGeo, dark);
  noseHorn.rotation.z = -Math.PI / 3;
  noseHorn.position.set(0.66, 0.6, 0);
  upper.add(noseHorn);

  const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
  for (const z of [-0.13, 0.13]) {
    const eye = new THREE.Mesh(eyeGeo, dark);
    eye.position.set(0.62, 0.6, z);
    upper.add(eye);
  }

  const blushGeo = new THREE.SphereGeometry(0.045, 8, 8);
  for (const z of [-0.16, 0.16]) {
    const cheek = new THREE.Mesh(blushGeo, blush);
    cheek.scale.set(0.5, 1, 0.4);
    cheek.position.set(0.58, 0.52, z);
    upper.add(cheek);
  }

  const legGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.34, 8);
  for (const x of [-0.25, 0.25]) {
    for (const z of [-0.16, 0.16]) {
      const leg = new THREE.Mesh(legGeo, body);
      leg.position.set(x, 0.17, z);
      trike.add(leg);
    }
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 8), body);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.55, 0.4, 0);
  upper.add(tail);

  // Authored parts face +X at ~1.44 m: rotate onto +Z, then scale to the
  // rigged Trike's 3.708 m. Origin sits at ground level, so the feet stay on
  // y = 0.
  trike.rotation.y = -Math.PI / 2;
  scaleToBodyLength(trike, PLACEHOLDER_BODY_LENGTH_METRES.trike);

  return trike;
}

/** Boxy Stego: dusty-teal hide with a peach plate row, scaled to the rigged
 * 3.845 m. */
export function createPlaceholderStego(): THREE.Group {
  const hide = new THREE.MeshStandardMaterial({
    color: STEGO_BODY_HEX,
    flatShading: true,
    roughness: 0.9,
  });
  const plate = new THREE.MeshStandardMaterial({
    color: STEGO_PLATE_HEX,
    flatShading: true,
    roughness: 0.9,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x3a4a3a,
    flatShading: true,
    roughness: 0.9,
  });
  const blush = new THREE.MeshStandardMaterial({
    color: BLUSH_HEX,
    flatShading: true,
    roughness: 0.9,
  });

  const stego = new THREE.Group();
  stego.name = 'PlaceholderStego';

  const upper = new THREE.Group();
  upper.name = PLACEHOLDER_BODY_NAME;
  stego.add(upper);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.46, 0.4), hide);
  torso.position.set(0, 0.5, 0);
  upper.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.28), hide);
  head.position.set(0.55, 0.6, 0);
  upper.add(head);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.2), hide);
  tail.position.set(-0.58, 0.52, 0);
  upper.add(tail);

  const plateGeo = new THREE.BoxGeometry(0.07, 0.3, 0.24);
  for (let index = 0; index < 5; index += 1) {
    const fin = new THREE.Mesh(plateGeo, plate);
    fin.position.set(-0.28 + index * 0.17, 0.85, 0);
    upper.add(fin);
  }

  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
  for (const z of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(eyeGeo, dark);
    eye.position.set(0.66, 0.64, z);
    upper.add(eye);
  }

  const cheekGeo = new THREE.SphereGeometry(0.04, 8, 8);
  for (const z of [-0.15, 0.15]) {
    const cheek = new THREE.Mesh(cheekGeo, blush);
    cheek.scale.set(0.5, 1, 0.4);
    cheek.position.set(0.62, 0.54, z);
    upper.add(cheek);
  }

  const legGeo = new THREE.BoxGeometry(0.16, 0.4, 0.16);
  for (const x of [-0.25, 0.25]) {
    for (const z of [-0.13, 0.13]) {
      const leg = new THREE.Mesh(legGeo, hide);
      leg.position.set(x, 0.2, z);
      stego.add(leg);
    }
  }

  // Same swap contract as the Trike: +X parts rotated onto +Z, then scaled to
  // the rigged Stego's 3.845 m; origin at ground level, feet on y = 0.
  stego.rotation.y = -Math.PI / 2;
  scaleToBodyLength(stego, PLACEHOLDER_BODY_LENGTH_METRES.stego);

  return stego;
}

/** Boxy grazing Brachio: long neck, cream belly, scaled to the rigged 7.423 m
 * so the swap no longer grows it 2.66x. */
export function createPlaceholderBrachio(): THREE.Group {
  const hide = new THREE.MeshStandardMaterial({
    color: BRACHIO_BODY_HEX,
    flatShading: true,
    roughness: 0.9,
  });
  const belly = new THREE.MeshStandardMaterial({
    color: BRACHIO_BELLY_HEX,
    flatShading: true,
    roughness: 0.9,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x3a4a3a,
    flatShading: true,
    roughness: 0.9,
  });
  const blush = new THREE.MeshStandardMaterial({
    color: BLUSH_HEX,
    flatShading: true,
    roughness: 0.9,
  });

  const brachio = new THREE.Group();
  brachio.name = 'PlaceholderBrachio';

  const upper = new THREE.Group();
  upper.name = PLACEHOLDER_BODY_NAME;
  brachio.add(upper);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.36), hide);
  torso.position.set(0, 0.45, 0);
  upper.add(torso);

  const bellyPatch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), belly);
  bellyPatch.position.set(0, 0.28, 0);
  upper.add(bellyPatch);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.16), hide);
  neck.position.set(0.45, 0.58, 0);
  neck.rotation.z = 0.15;
  upper.add(neck);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.22), hide);
  head.position.set(0.72, 0.62, 0);
  upper.add(head);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.16), hide);
  tail.position.set(-0.5, 0.48, 0);
  upper.add(tail);

  const eyeGeo = new THREE.SphereGeometry(0.03, 8, 8);
  for (const z of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(eyeGeo, dark);
    eye.position.set(0.82, 0.66, z);
    upper.add(eye);
  }

  const cheekGeo = new THREE.SphereGeometry(0.04, 8, 8);
  for (const z of [-0.13, 0.13]) {
    const cheek = new THREE.Mesh(cheekGeo, blush);
    cheek.scale.set(0.5, 1, 0.4);
    cheek.position.set(0.78, 0.56, z);
    upper.add(cheek);
  }

  const legGeo = new THREE.BoxGeometry(0.15, 0.36, 0.15);
  for (const x of [-0.22, 0.22]) {
    for (const z of [-0.12, 0.12]) {
      const leg = new THREE.Mesh(legGeo, hide);
      leg.position.set(x, 0.18, z);
      brachio.add(leg);
    }
  }

  // Same swap contract as the others: +X parts rotated onto +Z, then scaled to
  // the rigged Brachio's 7.423 m; origin at ground level, feet on y = 0.
  brachio.rotation.y = -Math.PI / 2;
  scaleToBodyLength(brachio, PLACEHOLDER_BODY_LENGTH_METRES.brachio);

  return brachio;
}

/**
 * Pose the placeholder for a walk time: only the upper body bobs (feet stay
 * planted), and loop end matches loop start, so the 0.8 s loop is seamless.
 */
export function updatePlaceholderWalk(trike: THREE.Group, elapsedSeconds: number): void {
  const phase = (elapsedSeconds % WADDLE_LOOP_SECONDS) / WADDLE_LOOP_SECONDS;
  const swing = phase * Math.PI * 2;
  const upper = trike.getObjectByName(PLACEHOLDER_BODY_NAME) ?? trike;
  upper.position.y = Math.abs(Math.sin(swing)) * 0.03;
  upper.rotation.z = Math.sin(swing) * 0.05;
}
