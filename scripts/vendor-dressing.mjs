#!/usr/bin/env node
/**
 * Vendors the free Polyfork dressing GLBs (FR-5) into `public/models/dressing/`.
 *
 * Boring on purpose: Node 22, no dependencies, global `fetch`, a literal id
 * list, a GLB header check before anything is written, existing files kept
 * unless `--force`, one summary table of bytes, and a non-zero exit when any
 * asset fails. There is no timestamp in the output, so a second run of the same
 * set prints the same table and writes nothing. The bytes are committed as
 * downloaded: no rescale, no re-encode, no Draco — the runtime loader is the
 * plain GLTFLoader.
 *
 *   node scripts/vendor-dressing.mjs
 *   node scripts/vendor-dressing.mjs --force
 */

import { existsSync, statSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Polyfork's free CDN: no key, no account, one file per asset id. */
const CDN_URL = 'https://polyfork.dev/cdn';

/** glTF binary container: 12-byte header, magic `glTF`, contained version 2. */
const GLB_MAGIC = 'glTF';
const GLB_VERSION = 2;
const GLB_HEADER_BYTES = 12;

/** The dressing set, by Polyfork asset id — a literal list, never a crawl. */
const ASSET_IDS = [
  'hay-bale-079e8c',
  'signpost-0bf523',
  'flower-bed-708e73',
  'berry-bush-ee4812',
  'milk-churn-895735',
  'wooden-crate-e46521',
  'log-stump-1d65a5',
  'garden-rock-7f5d60',
  'plum-tree-565179',
  'club-moss-mat-edcb1b',
  'wildflower-68d3a1',
  'mushroom-cluster-f2e3ba',
  'ginkgo-leaf-litter-9784e9',
  'fern-clump-90ff4b',
  'river-reed-cluster-cba87e',
  'cycad-05ad50',
  'tree-fern-78320e',
  'windpump-tower-1633a9',
  'river-stone-cluster-0b55bc',
];

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models', 'dressing');

/**
 * Reject anything that is not a version-2 GLB before it reaches the tree: a CDN
 * error page, a redirect body or a truncated download must not be committed as
 * a `.glb`. The declared length is checked too, so a half-written file fails
 * here rather than at boot.
 */
function assertGlb(bytes, label) {
  if (bytes.length < GLB_HEADER_BYTES) {
    throw new Error(`${label}: ${bytes.length} bytes is shorter than a GLB header`);
  }
  const magic = Buffer.from(bytes.subarray(0, 4)).toString('latin1');
  if (magic !== GLB_MAGIC) {
    throw new Error(`${label}: magic "${magic}" is not ${GLB_MAGIC}`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(4, true);
  if (version !== GLB_VERSION) {
    throw new Error(`${label}: glTF version ${version} is not ${GLB_VERSION}`);
  }
  const declared = view.getUint32(8, true);
  if (declared !== bytes.length) {
    throw new Error(`${label}: header declares ${declared} bytes, received ${bytes.length}`);
  }
}

function formatBytes(bytes) {
  return `${String(bytes).padStart(9)} B`;
}

async function main() {
  const force = process.argv.includes('--force');
  await mkdir(OUT_DIR, { recursive: true });

  const rows = [];
  const failures = [];
  for (const id of ASSET_IDS) {
    const file = `${id}.glb`;
    const path = join(OUT_DIR, file);
    const existed = existsSync(path);
    if (existed && !force) {
      rows.push({ file, status: 'kept', bytes: statSync(path).size });
      continue;
    }
    try {
      const response = await fetch(`${CDN_URL}/${file}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      assertGlb(bytes, file);
      writeFileSync(path, bytes);
      rows.push({ file, status: existed ? 'replaced' : 'added', bytes: bytes.length });
    } catch (error) {
      failures.push({ file, message: error instanceof Error ? error.message : String(error) });
      rows.push({ file, status: 'failed', bytes: 0 });
    }
  }

  const width = Math.max(...rows.map((row) => row.file.length));
  console.log(`${'asset'.padEnd(width)}  ${'status'.padEnd(8)}  ${'bytes'.padStart(11)}`);
  for (const row of rows) {
    console.log(`${row.file.padEnd(width)}  ${row.status.padEnd(8)}  ${formatBytes(row.bytes)}`);
  }
  const total = rows.reduce((sum, row) => sum + row.bytes, 0);
  console.log(`${''.padEnd(width)}  ${`${rows.length} files`.padEnd(8)}  ${formatBytes(total)}`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} asset(s) failed:`);
    for (const failure of failures) {
      console.error(`  ${failure.file}: ${failure.message}`);
    }
    process.exitCode = 1;
  }
}

await main();
