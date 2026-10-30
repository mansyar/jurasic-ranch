/**
 * Stego's bespoke `MudRoll` clip (track 20261030-wallow-nest-life, FR-6).
 *
 * Stego is the only species with an authored arrival clip: it steps into the
 * wallow, drops its belly into the mud, rolls onto one shoulder and then the
 * other, swishes its tail once and heaves back up. Four seconds at 30 fps, in
 * place, ending on the rest pose so the walk/rest blend can take over without
 * a pop.
 *
 * Authored here rather than in Blender on purpose. The bake does not take
 * animation from Blender at all: `bake-stego-variant.js` compresses the mesh
 * headlessly and then *injects* the clip channels into the compressed GLB's
 * JSON chunk, because Blender's glTF round trip re-times animation onto its
 * own frame clock. A hand-keyed or Blender-scripted action could therefore
 * never reach the shipped file. This module produces the same shape the
 * injector already consumes, so MudRoll rides the existing, tested path.
 *
 * The motion is arithmetic rather than sculpted. That is the trade: it is
 * reviewable in a diff, reproducible from the repo alone, and testable in
 * Node without a GPU - at the cost of being keyframed by hand-written
 * constants instead of animated.
 *
 * ## Reading the table
 *
 * Spine bones are authored as **cumulative armature-space rotation**: a value
 * means "the chest is pitched 20 degrees down in world terms", and the module
 * subtracts the parent's cumulative value before keying. Authoring per-bone
 * deltas instead is how the first draft folded the animal in half - 24 at the
 * hips plus 10 at the chest plus 18 at the neck plus 14 at the head is 66
 * degrees at the nose, not 24.
 *
 * Limb and tail bones are relative to their parent, which is what "tuck the
 * forelegs" means.
 *
 * Two earlier drafts were rejected against renders: a 0.30 m drop with no
 * roll read as a bow, and a 26 degree pitch read as a face-plant. The roll is
 * the readable part of a wallow; the pitch is not. The body stays flat, drops
 * until the belly is in the mud, and the neck bends so the chin reaches it.
 */

import * as THREE from 'three';

export const MUD_ROLL_ACTION_NAME = 'MudRoll';
export const MUD_ROLL_FPS = 30;
export const MUD_ROLL_FRAMES = 120;
export const MUD_ROLL_SECONDS = MUD_ROLL_FRAMES / MUD_ROLL_FPS;

/** Root bone of every Polyfork dino rig; the only bone that also translates. */
export const MUD_ROLL_ROOT_BONE = 'Hips';

/**
 * Spine bones, root first. A chain bone missing from a keyframe inherits its
 * parent's cumulative value, so leaving `Spine` out means "do not bend here"
 * rather than "snap back to zero".
 */
export const MUD_ROLL_SPINE_CHAIN = ['Hips', 'Spine', 'Chest', 'Neck', 'Head'];

const DEGREES = Math.PI / 180;

/** (frame, {bone: [rx, ry, rz] degrees}, root drop in metres). */
export const MUD_ROLL_KEYS = [
  // Settle: the head dips and the weight shifts back.
  [0, {}, 0],
  [12, { Hips: [4, 0, 0], Chest: [3, 0, 0], Neck: [6, 0, 0], Head: [6, 0, 0], Jaw: [4, 0, 0] }, 0.04],
  // Knees go: the body starts down and the legs begin to fold under it.
  [
    26,
    {
      Hips: [10, 2, 0],
      Chest: [8, 2, 0],
      Neck: [10, 0, 0],
      Head: [8, 0, 0],
      Jaw: [8, 0, 0],
      LeftFrontUpLeg: [-16, 4, 0],
      LeftFrontElbow: [-26, 0, 0],
      RightFrontUpLeg: [-16, 4, 0],
      RightFrontElbow: [-26, 0, 0],
      LeftHindUpLeg: [-6, -2, 0],
      LeftHindLeg: [-10, 0, 0],
      RightHindUpLeg: [-6, -2, 0],
      RightHindLeg: [-10, 0, 0],
    },
    0.26,
  ],
  // Belly down in the mud, chin in it, rolled onto the left shoulder.
  [
    42,
    {
      Hips: [12, 28, 0],
      Chest: [10, 26, 0],
      Neck: [22, 12, 0],
      Head: [28, 8, 0],
      Jaw: [10, 0, 0],
      LeftFrontUpLeg: [-26, 16, 0],
      LeftFrontElbow: [-34, 0, 0],
      RightFrontUpLeg: [-26, 16, 0],
      RightFrontElbow: [-34, 0, 0],
      LeftHindUpLeg: [-16, -10, 0],
      LeftHindLeg: [-18, 0, 0],
      RightHindUpLeg: [-16, -10, 0],
      RightHindLeg: [-18, 0, 0],
      Tail: [0, 0, 14],
      TailTip: [0, 0, 18],
    },
    0.55,
  ],
  // Over onto the right shoulder.
  [
    58,
    {
      Hips: [12, -28, 0],
      Chest: [10, -26, 0],
      Neck: [22, -12, 0],
      Head: [28, -8, 0],
      Jaw: [6, 0, 0],
      LeftFrontUpLeg: [-26, -16, 0],
      LeftFrontElbow: [-34, 0, 0],
      RightFrontUpLeg: [-26, -16, 0],
      RightFrontElbow: [-34, 0, 0],
      LeftHindUpLeg: [-16, 10, 0],
      LeftHindLeg: [-18, 0, 0],
      RightHindUpLeg: [-16, 10, 0],
      RightHindLeg: [-18, 0, 0],
      Tail: [0, 0, -16],
      TailTip: [0, 0, -20],
    },
    0.55,
  ],
  // Back onto the left, a smaller roll, and the tail comes round once.
  [
    74,
    {
      Hips: [11, 22, 0],
      Chest: [9, 20, 0],
      Neck: [20, 10, 0],
      Head: [26, 7, 0],
      Jaw: [4, 0, 0],
      LeftFrontUpLeg: [-22, 12, 0],
      LeftFrontElbow: [-30, 0, 0],
      RightFrontUpLeg: [-22, 12, 0],
      RightFrontElbow: [-30, 0, 0],
      LeftHindUpLeg: [-13, -8, 0],
      LeftHindLeg: [-15, 0, 0],
      RightHindUpLeg: [-13, -8, 0],
      RightHindLeg: [-15, 0, 0],
      Tail: [0, 0, 20],
      TailTip: [0, 0, 26],
    },
    0.52,
  ],
  // Heave up: the chest lifts first and the forelegs straighten under it.
  [
    92,
    {
      Hips: [7, 5, 0],
      Chest: [6, 4, 0],
      Neck: [10, 2, 0],
      Head: [12, 0, 0],
      Jaw: [2, 0, 0],
      LeftFrontUpLeg: [-8, 3, 0],
      LeftFrontElbow: [-14, 0, 0],
      RightFrontUpLeg: [-8, 3, 0],
      RightFrontElbow: [-14, 0, 0],
      LeftHindUpLeg: [-4, 0, 0],
      LeftHindLeg: [-6, 0, 0],
      RightHindUpLeg: [-4, 0, 0],
      RightHindLeg: [-6, 0, 0],
      Tail: [0, 0, -12],
      TailTip: [0, 0, -16],
    },
    0.2,
  ],
  // Shake off: a quick shoulder wiggle and a last tail flick.
  [104, { Hips: [2, -6, 0], Chest: [2, -5, 0], Neck: [3, -2, 0], Head: [4, 0, 0], Tail: [0, 0, 9], TailTip: [0, 0, 12] }, 0.04],
  [112, { Hips: [0, 4, 0], Chest: [0, 3, 0], Neck: [0, 1, 0], Tail: [0, 0, -5], TailTip: [0, 0, -7] }, 0.01],
  // Rest pose, so the clip can be left or crossfaded without a pop.
  [MUD_ROLL_FRAMES, {}, 0],
];

/** Every bone the table ever touches, plus the root. */
export function mudRollBones() {
  const bones = new Set([MUD_ROLL_ROOT_BONE]);
  for (const [, poses] of MUD_ROLL_KEYS) {
    for (const name of Object.keys(poses)) {
      bones.add(name);
    }
  }
  return [...bones].sort();
}

const ZERO = [0, 0, 0];

function smoothstep01(t) {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Resolve one frame's cumulative spine targets into per-bone deltas.
 * A chain bone absent from the key inherits its parent's cumulative value.
 */
export function resolveMudRollPose(poses) {
  const resolved = {};
  let parent = ZERO;
  for (const boneName of MUD_ROLL_SPINE_CHAIN) {
    const cumulative = poses[boneName] ?? parent;
    resolved[boneName] = [
      cumulative[0] - parent[0],
      cumulative[1] - parent[1],
      cumulative[2] - parent[2],
    ];
    parent = cumulative;
  }
  return resolved;
}

/** Interpolate the table at a fractional frame, then resolve the chain. */
function poseAtFrame(frame) {
  let before = MUD_ROLL_KEYS[0];
  let after = MUD_ROLL_KEYS[MUD_ROLL_KEYS.length - 1];
  for (let index = 0; index < MUD_ROLL_KEYS.length - 1; index += 1) {
    if (frame >= MUD_ROLL_KEYS[index][0] && frame <= MUD_ROLL_KEYS[index + 1][0]) {
      before = MUD_ROLL_KEYS[index];
      after = MUD_ROLL_KEYS[index + 1];
      break;
    }
  }
  const span = after[0] - before[0];
  const t = span === 0 ? 0 : smoothstep01((frame - before[0]) / span);
  const lerpTriple = (a, b) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];

  const blended = {};
  for (const boneName of mudRollBones()) {
    const from = before[1][boneName] ?? ZERO;
    const to = after[1][boneName] ?? ZERO;
    blended[boneName] = lerpTriple(from, to);
  }
  const drop = before[2] + (after[2] - before[2]) * t;
  const resolved = resolveMudRollPose(blended);
  for (const boneName of Object.keys(blended)) {
    resolved[boneName] ??= blended[boneName];
  }
  return { poses: resolved, drop };
}

/** Accumulate rest quaternions from the root down, keyed by bone name. */
function armatureRestQuaternions(skeletonRoot) {
  const byName = new Map();
  skeletonRoot.traverse((object) => {
    if (object.isBone) {
      byName.set(object.name, object);
    }
  });
  const world = new Map();
  const resolve = (bone) => {
    const cached = world.get(bone.name);
    if (cached !== undefined) {
      return cached;
    }
    const local = bone.quaternion.clone().normalize();
    const parent = bone.parent?.isBone ? resolve(bone.parent) : null;
    const result = parent === null ? local : parent.clone().multiply(local);
    world.set(bone.name, result);
    return result;
  };
  for (const bone of byName.values()) {
    resolve(bone);
  }
  return world;
}

/**
 * Build the MudRoll clip in the shape `injectGlbAnimations` consumes.
 *
 * Rotations are authored in armature space and converted into each bone's
 * local space by conjugating with the bone's armature-space rest rotation,
 * which is what makes `ry` mean "roll the body onto its left side" rather than
 * "twist this bone about whatever axis it happens to have".
 */
export function buildMudRollClip(skeletonRoot) {
  const restWorld = armatureRestQuaternions(skeletonRoot);
  const rootBone = skeletonRoot.getObjectByName(MUD_ROLL_ROOT_BONE);
  if (rootBone === undefined) {
    throw new Error(`MudRoll: the rig has no "${MUD_ROLL_ROOT_BONE}" bone.`);
  }
  const restRootTranslation = rootBone.position.clone();

  const bones = mudRollBones();
  for (const boneName of bones) {
    if (!restWorld.has(boneName)) {
      throw new Error(
        `MudRoll: the rig has no "${boneName}" bone; it has ${[...restWorld.keys()].sort().join(', ')}.`,
      );
    }
  }

  const frames = [];
  for (let frame = 0; frame <= MUD_ROLL_FRAMES; frame += 1) {
    frames.push(frame);
  }
  const times = new Float32Array(frames.map((frame) => frame / MUD_ROLL_FPS));

  const channels = [];
  const euler = new THREE.Euler();
  const worldRotation = new THREE.Quaternion();
  const restInverse = new THREE.Quaternion();

  for (const boneName of bones) {
    const rest = restWorld.get(boneName);
    restInverse.copy(rest).invert();
    const values = new Float32Array(frames.length * 4);
    for (let index = 0; index < frames.length; index += 1) {
      const { poses } = poseAtFrame(frames[index]);
      const [rx, ry, rz] = poses[boneName] ?? ZERO;
      euler.set(rx * DEGREES, ry * DEGREES, rz * DEGREES, 'XYZ');
      worldRotation.setFromEuler(euler);
      // q_local = rest^-1 * q_world * rest
      const local = restInverse.clone().multiply(worldRotation).multiply(rest);
      local.normalize();
      values[index * 4 + 0] = local.x;
      values[index * 4 + 1] = local.y;
      values[index * 4 + 2] = local.z;
      values[index * 4 + 3] = local.w;
    }
    channels.push({ nodeName: boneName, path: 'rotation', interpolation: 'LINEAR', times, values });
  }

  // The drop rides the root's translation channel: glTF is Y-up, so "down" is
  // -Y on the rest translation.
  const translations = new Float32Array(frames.length * 3);
  for (let index = 0; index < frames.length; index += 1) {
    const { drop } = poseAtFrame(frames[index]);
    translations[index * 3 + 0] = restRootTranslation.x;
    translations[index * 3 + 1] = restRootTranslation.y - drop;
    translations[index * 3 + 2] = restRootTranslation.z;
  }
  channels.push({
    nodeName: MUD_ROLL_ROOT_BONE,
    path: 'translation',
    interpolation: 'LINEAR',
    times,
    values: translations,
  });

  return {
    name: MUD_ROLL_ACTION_NAME,
    durationSeconds: MUD_ROLL_SECONDS,
    channels,
  };
}
