/**
 * Bake the pastel Brachiosaurus GLB (track 20261029-authored-dino-walk-clips, Phase 2).
 *
 * The shipped game file `public/models/brachio.glb` is the vendored Polyfork
 * parametric module's mesh and palette with Polyfork's OWN authored `Idle`,
 * `Walk` and `Run` clips on it. Nothing here reads the Trike: the donor transfer
 * this bake used until this phase is gone. It was worse on this species than on
 * the Stego — the donor clip carried 70 channels against a 35-bone sauropod and
 * still left `Neck1`–`Neck7` and `Tail1`–`Tail4` (11 of 35 bones) at bind pose,
 * because the Trike has no such chain. Negotiating the neck and tail is exactly
 * what the sauropod's own clips do.
 *
 * Two sources, one file:
 *
 *   1. Mesh, palette and rig — `createAsset()` from the vendored module at
 *      authored proportions. No bake-time size knob decides gameplay size; it is
 *      the viewer's per-species group scale:
 *
 *        createAsset({"size":1,"colorway":"dusty-umber","coat":"#b8a9d6",
 *          "flank":"#c3b2e0","belly":"#f2e9d8","mottle":"#8a739e",
 *          "muzzle":"#d8c9e8","nail":"#5a4a5e","eye":"#211b16"})
 *
 *      The geometry knobs (`size`, `neck`, `head`, `tail`) are deliberately
 *      absent. `neck: 0` was the old grazing-baby carve, and it moves every neck
 *      bone: the authored clips were rigged on the module's DEFAULT upright
 *      carriage, so the carve would deform the walk. Phase 1 measured the
 *      official rest pose equals those defaults at size 1.0 — 35/35 joints,
 *      worst delta 0.0000 m / 0.000°. Colour knobs never move a bone.
 *
 *   2. Clips — the official published GLB, the only place Polyfork ships its
 *      authored animation (the vendored module contains no `AnimationClip`):
 *
 *        curl -L -o .conductor/evidence/polyfork/brachiosaurus-base.glb \
 *          https://polyfork.dev/cdn/brachiosaurus-base.glb
 *
 *      `Idle` (70 channels), `Walk` (70) and `Run` (70) are carried verbatim:
 *      name, duration, keyframe times and values unchanged, `translation` and
 *      `rotation` only. The authored clips carry no scale channels, so none is
 *      synthesised. A clip naming a bone the baked rig lacks aborts the bake,
 *      naming every such bone, before anything is written.
 *
 * Steps:
 *   1. Build the pastel variant with `createAsset()` (single mesh, single
 *      material, baked pastel COLOR_0, flat shading, 35-bone skeleton), and
 *      graft the authored clips onto it once as a pre-flight: any bone the rig
 *      lacks aborts here, with the full list, before Blender runs.
 *   2. Export the mesh to an uncompressed temp GLB via three's GLTFExporter.
 *   3. Re-export through headless Blender with Draco mesh compression
 *      (`bake-brachio-variant.py`; three's GLTFExporter has no Draco writer).
 *   4. Inject the authored clips into the COMPRESSED GLB's JSON chunk, remapping
 *      `target.node` by joint name and copying key times, values and
 *      interpolation byte for byte.
 *   5. Read the bytes back and prove the clips survived, then rename into place.
 *
 * The clips are injected rather than exported because `GLTFExporter` cannot
 * preserve them: it re-times keyframes to its 24 fps default (a 3.8 s cycle came
 * out at 3.792 s, 457 keys collapsed to 92) and it emits TRS for every animated
 * node, turning a 70 channel clip into 105. Injection also has to happen AFTER
 * the Blender pass, because Blender's glTF round trip re-times animation onto
 * integer frames. The mesh-only export is what Blender sees.
 *
 * Usage:
 *   node scripts/vendor/bake-brachio-variant.js [--official <glb>] [--out <glb>]
 *     [--blender <bin>] [--keep-temp]
 *
 * Defaults: --official is `.conductor/evidence/polyfork/brachiosaurus-base.glb`
 * (gitignored; the two official files are read at bake time and never shipped),
 * --out is `public/models/brachio.glb`, --blender is `blender` (override with
 * BRACHIO_BLENDER_BIN). Any failure exits non-zero and never leaves a
 * half-written GLB: the final path is written only via an atomic rename after
 * the clips have been injected and read back.
 */

import { spawnSync } from 'node:child_process';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import {
  assertAuthoredClipsPreserved,
  extractAnimationClips,
  graftAuthoredClips,
  injectGlbAnimations,
} from '../bake-trike-variant.js';
import { createAsset } from './brachiosaurus-base.mjs';

/**
 * Node has no FileReader, which three's GLTFExporter uses to assemble the
 * binary GLB (readAsArrayBuffer + onloadend). Minimal polyfill backed by
 * Blob.arrayBuffer(); guarded so browsers keep the native implementation.
 */
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    constructor() {
      this.result = null;
      this.onloadend = null;
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        if (typeof this.onloadend === 'function') {
          this.onloadend();
        }
      });
    }
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(dirname(HERE));
const BLENDER_SCRIPT = join(HERE, 'bake-brachio-variant.py');
const OFFICIAL_CDN_FILE = 'brachiosaurus-base.glb';
const DEFAULT_OFFICIAL_GLB = join(REPO_ROOT, '.conductor', 'evidence', 'polyfork', OFFICIAL_CDN_FILE);
const DEFAULT_OUT_GLB = join(REPO_ROOT, 'public', 'models', 'brachio.glb');

/** Authored proportions: the module's own default skeleton, at its own size. */
const AUTHORED_SIZE = 1;

/**
 * Pinned variant params. The variant test asserts these verbatim, so a drift
 * here fails `pnpm verify` instead of shipping a wrong-coloured dino. Colour
 * plus the authored size only — see the docblock for why no geometry knob
 * appears and why no group scale is applied.
 */
export const BRACHIO_VARIANT_PARAMS = {
  size: AUTHORED_SIZE,
  colorway: 'dusty-umber',
  coat: '#b8a9d6',
  flank: '#c3b2e0',
  belly: '#f2e9d8',
  mottle: '#8a739e',
  muzzle: '#d8c9e8',
  nail: '#5a4a5e',
  eye: '#211b16',
};

/** Procedural variant group: the exact geometry the bake exports. */
export function createBrachioVariantGroup() {
  return createAsset({ ...BRACHIO_VARIANT_PARAMS });
}

/** Adult reference group (all Polyfork defaults): proportion baseline. */
export function createBrachioDefaultGroup() {
  return createAsset({});
}

/**
 * Load the authored `Idle`, `Walk` and `Run` from a published GLB and rebuild
 * them as three clips on `skeletonRoot`. Species-named wrapper over the shared
 * graft; see `graftAuthoredClips` for the copy rules. The bake uses it as a
 * pre-flight check against the baked skeleton, and the tests use it to play the
 * shipped clips headless.
 */
export function buildBrachioClips(skeletonRoot, officialBytes) {
  return graftAuthoredClips(skeletonRoot, extractAnimationClips(officialBytes));
}

/** Read the official clip source, naming both fetch routes when it is absent. */
async function readOfficialGlb(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Official clip source missing at ${path}. Fetch it first:\n` +
          `  curl -L -o ${path} https://polyfork.dev/cdn/${OFFICIAL_CDN_FILE}\n` +
          `or copy it from .conductor/evidence/phase-1/${OFFICIAL_CDN_FILE}.`,
      );
    }
    throw error;
  }
}

/** Find the script-relative Blender Draco pass (scripts/vendor/bake-brachio-variant.py). */
function blenderArgs(tmpIn, tmpOut) {
  return ['--background', '--python', BLENDER_SCRIPT, '--', tmpIn, tmpOut];
}

/**
 * Run the full bake. Options: officialGlbPath (authored clip source, default
 * `.conductor/evidence/polyfork/brachiosaurus-base.glb`), outPath (final Draco
 * GLB, default public/models/brachio.glb), blenderBin (default `blender`,
 * BRACHIO_BLENDER_BIN overrides), keepTemp (debug). Resolves with the clip
 * summary; rejects with a clear error and never leaves a half-written outPath.
 */
export async function bakeBrachioVariant(options = {}) {
  const officialGlbPath = options.officialGlbPath ?? DEFAULT_OFFICIAL_GLB;
  const outPath = options.outPath ?? DEFAULT_OUT_GLB;
  const blenderBin = options.blenderBin ?? process.env['BRACHIO_BLENDER_BIN'] ?? 'blender';
  const officialBytes = await readOfficialGlb(officialGlbPath);
  const authored = extractAnimationClips(officialBytes);
  const group = createBrachioVariantGroup();
  // Pre-flight against the real baked skeleton: a missing bone fails here, with
  // the full list, instead of after Blender has written a GLB.
  buildBrachioClips(group, officialBytes);
  // Mesh only. The clips go into the Draco output's JSON chunk below.
  const exported = await new GLTFExporter().parseAsync(group, { binary: true });
  const tmpIn = join(tmpdir(), `brachio-uncompressed-${process.pid}.glb`);
  const tmpOut = `${outPath}.draco-tmp.glb`;
  await writeFile(tmpIn, new Uint8Array(exported));
  try {
    const result = spawnSync(blenderBin, blenderArgs(tmpIn, tmpOut), { stdio: 'inherit' });
    if (result.error !== undefined) {
      throw new Error(
        `Could not launch Blender (${result.error.message}). Install Blender on PATH ` +
          `or set BRACHIO_BLENDER_BIN / --blender. Uncompressed export kept at ${tmpIn}.`,
      );
    }
    if (result.status !== 0) {
      throw new Error(`Blender Draco pass failed (exit ${result.status}). Uncompressed export kept at ${tmpIn}.`);
    }
    const injected = injectGlbAnimations(await readFile(tmpOut), authored);
    assertAuthoredClipsPreserved(injected, authored);
    await writeFile(tmpOut, injected);
    await rename(tmpOut, outPath);
  } catch (error) {
    await rm(tmpOut, { force: true });
    throw error;
  } finally {
    if (options.keepTemp !== true) {
      await rm(tmpIn, { force: true });
    }
  }
  return {
    outPath,
    clips: authored.map((animation) => ({
      name: animation.name,
      durationSeconds: animation.durationSeconds,
      trackCount: animation.channels.length,
    })),
  };
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--official' && i + 1 < argv.length) {
      options.officialGlbPath = resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--out' && i + 1 < argv.length) {
      options.outPath = resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--blender' && i + 1 < argv.length) {
      options.blenderBin = argv[i + 1];
      i += 1;
    } else if (arg === '--keep-temp') {
      options.keepTemp = true;
    } else {
      throw new Error(`Unknown argument "${arg}". Usage: node scripts/vendor/bake-brachio-variant.js [--official <glb>] [--out <glb>] [--blender <bin>] [--keep-temp].`);
    }
  }
  return options;
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const summary = await bakeBrachioVariant(parseArgs(process.argv.slice(2)));
    const clips = summary.clips
      .map((clip) => `${clip.name} ${clip.durationSeconds.toFixed(3)} s / ${clip.trackCount} tracks`)
      .join(', ');
    console.log(`bake-brachio-variant: wrote ${summary.outPath} (${clips}).`);
  } catch (error) {
    console.error(`bake-brachio-variant: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
