#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Harness symbols that must never reach the production bundle (FR-9, AC-10).
 * `__ranch` covers the global, `data-dev-panel` the DOM node and attribute,
 * `installDevHarness` the module entry, `parseDevQuery` the URL parser.
 */
export const HARNESS_MARKERS = Object.freeze([
  '__ranch',
  'data-dev-panel',
  'installDevHarness',
  'parseDevQuery',
]);

const BUILD_HINT = 'Run `pnpm build` first so dist/ exists.';

/** Fail loudly when the scan target is missing or not a directory. */
function assertDirectory(rootDir) {
  let info;
  try {
    info = statSync(rootDir);
  } catch {
    throw new Error(`dist harness check failed: ${rootDir} does not exist. ${BUILD_HINT}`);
  }
  if (!info.isDirectory()) {
    throw new Error(`dist harness check failed: ${rootDir} is not a directory. ${BUILD_HINT}`);
  }
}

/** Depth-first walk over every regular file under `dir`. */
function* walkFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(path);
    } else if (entry.isFile()) {
      yield path;
    }
  }
}

/** Root-relative, slash-separated path so reports read the same on every OS. */
function displayPath(rootDir, file) {
  return relative(rootDir, file).split(sep).join('/');
}

/**
 * Scan `rootDir` recursively and return every harness marker occurrence.
 * Files are read as latin1 bytes so a stray binary never aborts the scan; the
 * markers themselves are ascii, so decoded text and raw bytes agree.
 */
export function findHarnessMarkers(rootDir) {
  const root = resolve(rootDir);
  assertDirectory(root);
  const findings = [];
  for (const file of walkFiles(root)) {
    const contents = readFileSync(file, 'latin1');
    for (const marker of HARNESS_MARKERS) {
      if (contents.includes(marker)) {
        findings.push({ file: displayPath(root, file), marker });
      }
    }
  }
  return findings;
}

/** Throw with the offending file and marker when the bundle is not clean. */
export function assertDistClean(rootDir) {
  const findings = findHarnessMarkers(rootDir);
  if (findings.length === 0) {
    return;
  }
  const detail = findings.map(({ file, marker }) => `  ${file}: ${marker}`).join('\n');
  throw new Error(
    `dev harness leaked into ${resolve(rootDir)} (${findings.length} marker(s)):\n${detail}`,
  );
}

/** CLI entry: exit 1 on leaked markers or a missing dist, 0 when clean. */
function main(argv) {
  const target = argv[0] ?? 'dist';
  try {
    const findings = findHarnessMarkers(target);
    if (findings.length > 0) {
      const detail = findings.map(({ file, marker }) => `  ${file}: ${marker}`).join('\n');
      process.stderr.write(
        `dev harness leaked into ${target} (${findings.length} marker(s)):\n${detail}\n`,
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`dist clean: no dev harness markers in ${target}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

// Importable by the unit tests: only run as a CLI when executed directly.
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  main(process.argv.slice(2));
}
