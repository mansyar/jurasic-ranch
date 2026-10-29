/**
 * Bake the pastel Stegosaurus GLB (track 20261029-authored-dino-walk-clips, Phase 2).
 *
 * The shipped game file `public/models/stego.glb` is the vendored Polyfork
 * parametric module's mesh and palette with Polyfork's OWN authored `Walk` clip
 * on it (`Idle` and `Run` are withdrawn at bake time, see `SHIPPED_CLIP_NAMES`).
 * Nothing here reads the Trike: the donor transfer
 * this bake used until this phase is gone, because glTF translation channels are
 * absolute local translations and a foreign clip drags every bone off its rest
 * offset.
 *
 * Two sources, one file:
 *
 *   1. Mesh, palette and rig — `createAsset()` from the vendored module at
 *      authored proportions. No bake-time size knob decides gameplay size; it
 *      is the viewer's per-species group scale:
 *
 *        createAsset({"size":1,"plateColour":"umber","hide":"#7fb5a3",
 *          "belly":"#f6ead0","blend":"#bacfb9","feet":"#6da08e","mark":"#4f5e59",
 *          "plate":"#efa27e","plateTrim":"#b26a4d","spike":"#fff3dd"})
 *
 *      The geometry knobs (`plates`, `plateSize`, `tail`, `neck`, `head`) are
 *      deliberately absent: each rebuilds bones, and Phase 1 measured that the
 *      official GLB's rest pose equals the module's DEFAULTS at size 1.0 —
 *      24/24 joints, worst delta 0.0000 m / 0.000°. Colour knobs never move a
 *      bone, so the pastel palette is safe to pin.
 *
 *   2. Clips — the official published GLB, the only place Polyfork ships its
 *      authored animation (the vendored module contains no `AnimationClip`):
 *
 *        curl -L -o .conductor/evidence/polyfork/stegosaurus-base.glb \
 *          https://polyfork.dev/cdn/stegosaurus-base.glb
 *
 *      `Walk` (48 channels) is carried verbatim:
 *      name, duration, keyframe times and values unchanged, `translation` and
 *      `rotation` only. The authored clips carry no scale channels, so none is
 *      synthesised. A clip naming a bone the baked rig lacks aborts the bake,
 *      naming every such bone, before anything is written.
 *
 * Steps:
 *   1. Build the pastel variant with `createAsset()` (single mesh, single
 *      material, baked pastel COLOR_0, flat shading, 24-bone skeleton), and
 *      graft the authored clips onto it once as a pre-flight: any bone the rig
 *      lacks aborts here, with the full list, before Blender runs.
 *   2. Export the mesh to an uncompressed temp GLB via three's GLTFExporter.
 *   3. Re-export through headless Blender with Draco mesh compression
 *      (`bake-stego-variant.py`; three's GLTFExporter has no Draco writer).
 *   4. Inject the authored clips into the COMPRESSED GLB's JSON chunk, remapping
 *      `target.node` by joint name and copying key times, values and
 *      interpolation byte for byte.
 *   5. Read the bytes back and prove the clips survived, then rename into place.
 *
 * The clips are injected rather than exported because `GLTFExporter` cannot
 * preserve them: it re-times keyframes to its 24 fps default (a 2.4 s cycle came
 * out at 2.375 s, 289 keys collapsed to 58) and it emits TRS for every animated
 * node, turning a 48 channel clip into 72. Injection also has to happen AFTER
 * the Blender pass, because Blender's glTF round trip re-times animation onto
 * integer frames — the same 2.375 s. The mesh-only export is what Blender sees.
 *
 * Usage:
 *   node scripts/vendor/bake-stego-variant.js [--official <glb>] [--out <glb>]
 *     [--blender <bin>] [--keep-temp]
 *
 * Defaults: --official is `.conductor/evidence/polyfork/stegosaurus-base.glb`
 * (gitignored; the two official files are read at bake time and never shipped),
 * --out is `public/models/stego.glb`, --blender is `blender` (override with
 * STEGO_BLENDER_BIN). Any failure exits non-zero and never leaves a half-written
 * GLB: the final path is written only via an atomic rename after the clips have
 * been injected and read back.
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
  selectShippedClips,
} from '../bake-trike-variant.js';
import { createAsset } from './stegosaurus-base.mjs';

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
const BLENDER_SCRIPT = join(HERE, 'bake-stego-variant.py');
const OFFICIAL_CDN_FILE = 'stegosaurus-base.glb';
const DEFAULT_OFFICIAL_GLB = join(REPO_ROOT, '.conductor', 'evidence', 'polyfork', OFFICIAL_CDN_FILE);
const DEFAULT_OUT_GLB = join(REPO_ROOT, 'public', 'models', 'stego.glb');

/** Authored proportions: the module's own default skeleton, at its own size. */
const AUTHORED_SIZE = 1;

/**
 * Pinned variant params. The variant test asserts these verbatim, so a drift
 * here fails `pnpm verify` instead of shipping a wrong-coloured dino. Colour
 * plus the authored size only — see the docblock for why no geometry knob
 * appears and why no group scale is applied.
 */
export const STEGO_VARIANT_PARAMS = {
  size: AUTHORED_SIZE,
  plateColour: 'umber',
  hide: '#7fb5a3',
  belly: '#f6ead0',
  blend: '#bacfb9',
  feet: '#6da08e',
  mark: '#4f5e59',
  plate: '#efa27e',
  plateTrim: '#b26a4d',
  spike: '#fff3dd',
};

/** Procedural variant group: the exact geometry the bake exports. */
export function createStegoVariantGroup() {
  return createAsset({ ...STEGO_VARIANT_PARAMS });
}

/** Adult reference group (all Polyfork defaults): proportion baseline. */
export function createStegoDefaultGroup() {
  return createAsset({});
}

/**
 * Load the published GLB's authored clips and rebuild the SHIPPED set on
 * `skeletonRoot`: `Walk` only. `Idle` and `Run` are withdrawn - they cost
 * 100 KiB-1.6 MiB of keyframes that no code path plays, and the offline-cache
 * budget is 2 MiB - so the bake grafts one of the three (see
 * `SHIPPED_CLIP_NAMES` in `bake-trike-variant.js`). Species-named wrapper over
 * the shared graft; see `graftAuthoredClips` for the copy rules. The bake uses it as a
 * pre-flight check against the baked skeleton, and the tests use it to play the
 * shipped clips headless.
 */
export function buildStegoClips(skeletonRoot, officialBytes) {
  return graftAuthoredClips(skeletonRoot, selectShippedClips(extractAnimationClips(officialBytes)));
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

/** Find the script-relative Blender Draco pass (scripts/vendor/bake-stego-variant.py). */
function blenderArgs(tmpIn, tmpOut) {
  return ['--background', '--python', BLENDER_SCRIPT, '--', tmpIn, tmpOut];
}

/**
 * Run the full bake. Options: officialGlbPath (authored clip source, default
 * `.conductor/evidence/polyfork/stegosaurus-base.glb`), outPath (final Draco
 * GLB, default public/models/stego.glb), blenderBin (default `blender`,
 * STEGO_BLENDER_BIN overrides), keepTemp (debug). Resolves with the clip
 * summary; rejects with a clear error and never leaves a half-written outPath.
 */
export async function bakeStegoVariant(options = {}) {
  const officialGlbPath = options.officialGlbPath ?? DEFAULT_OFFICIAL_GLB;
  const outPath = options.outPath ?? DEFAULT_OUT_GLB;
  const blenderBin = options.blenderBin ?? process.env['STEGO_BLENDER_BIN'] ?? 'blender';
  const officialBytes = await readOfficialGlb(officialGlbPath);
  const shipped = selectShippedClips(extractAnimationClips(officialBytes));
  const group = createStegoVariantGroup();
  // Pre-flight against the real baked skeleton: a missing bone fails here, with
  // the full list, instead of after Blender has written a GLB.
  buildStegoClips(group, officialBytes);
  // Mesh only. The clips go into the Draco output's JSON chunk below.
  const exported = await new GLTFExporter().parseAsync(group, { binary: true });
  const tmpIn = join(tmpdir(), `stego-uncompressed-${process.pid}.glb`);
  // Blender appends `.glb` when the export path lacks it, so the temp name
  // keeps the suffix: the next run overwrites any stranded temp, then the
  // atomic rename moves it into place (never a half-written outPath).
  const tmpOut = `${outPath}.draco-tmp.glb`;
  await writeFile(tmpIn, new Uint8Array(exported));
  try {
    const result = spawnSync(blenderBin, blenderArgs(tmpIn, tmpOut), { stdio: 'inherit' });
    if (result.error !== undefined) {
      throw new Error(
        `Could not launch Blender (${result.error.message}). Install Blender on PATH ` +
          `or set STEGO_BLENDER_BIN / --blender. Uncompressed export kept at ${tmpIn}.`,
      );
    }
    if (result.status !== 0) {
      throw new Error(`Blender Draco pass failed (exit ${result.status}). Uncompressed export kept at ${tmpIn}.`);
    }
    const injected = injectGlbAnimations(await readFile(tmpOut), shipped);
    assertAuthoredClipsPreserved(injected, shipped);
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
    clips: shipped.map((animation) => ({
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
      throw new Error(`Unknown argument "${arg}". Usage: node scripts/vendor/bake-stego-variant.js [--official <glb>] [--out <glb>] [--blender <bin>] [--keep-temp].`);
    }
  }
  return options;
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const summary = await bakeStegoVariant(parseArgs(process.argv.slice(2)));
    const clips = summary.clips
      .map((clip) => `${clip.name} ${clip.durationSeconds.toFixed(3)} s / ${clip.trackCount} tracks`)
      .join(', ');
    console.log(`bake-stego-variant: wrote ${summary.outPath} (${clips}).`);
  } catch (error) {
    console.error(`bake-stego-variant: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
