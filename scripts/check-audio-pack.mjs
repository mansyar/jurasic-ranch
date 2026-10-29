#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Starter-pack guard (FR-1, AC-1, NFR-1). Reads the literal entries out of
 * `src/audio/catalog.ts`, checks them against the files under `public/audio`,
 * and fails with one clear line per problem. Pure helpers are exported so the
 * unit tests can audit fixtures without touching the real pack.
 */

/** Pack limits from NFR-1 and the phase contract. */
export const PACK_LIMITS = Object.freeze({
  entryCount: 15,
  busCounts: Object.freeze({ music: 1, sfx: 6, voice: 8 }),
  totalBytes: 2_500_000,
  durationSeconds: Object.freeze({
    music: Object.freeze({ min: 30, max: 60 }),
    sfx: Object.freeze({ min: 0, max: 2 }),
    voice: Object.freeze({ min: 0, max: 2 }),
  }),
});

/** The only buses the catalog may declare. */
export const BUSES = Object.freeze(['music', 'sfx', 'voice']);

const CATALOG_HEADER = /export const AUDIO_CATALOG\s*=\s*\[/;
const CATALOG_END = /\]\s*as const satisfies/;
const ENTRY_KEYS = Object.freeze(['id', 'bus', 'path', 'loop', 'gain', 'durationSeconds']);

/** Read a quoted literal field out of one catalog entry body. */
function readString(body, key) {
  const match = new RegExp(`\\b${key}\\s*:\\s*'([^']*)'`).exec(body);
  return match?.[1];
}

/** Read a numeric literal field out of one catalog entry body. */
function readNumber(body, key) {
  const match = new RegExp(`\\b${key}\\s*:\\s*(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))`).exec(body);
  return match ? Number(match[1]) : undefined;
}

/** Read a boolean literal field out of one catalog entry body. */
function readBoolean(body, key) {
  const match = new RegExp(`\\b${key}\\s*:\\s*(true|false)\\b`).exec(body);
  if (match === null) {
    return undefined;
  }
  return match[1] === 'true';
}

/** Parse the `AUDIO_CATALOG` array literal into entries plus syntax problems. */
export function extractCatalogEntries(catalogText) {
  const header = CATALOG_HEADER.exec(catalogText);
  if (header === null) {
    return { entries: [], problems: ['catalog: cannot find `export const AUDIO_CATALOG = [`'] };
  }
  const bodyStart = header.index + header[0].length;
  const end = CATALOG_END.exec(catalogText.slice(bodyStart));
  if (end === null) {
    return {
      entries: [],
      problems: ['catalog: cannot find `] as const satisfies` after `AUDIO_CATALOG`'],
    };
  }
  const body = catalogText.slice(bodyStart, bodyStart + end.index);
  const problems = [];
  const entries = [];
  let index = 0;
  for (const match of body.matchAll(/\{([^{}]*)\}/g)) {
    index += 1;
    const literal = match[1];
    const entry = {
      id: readString(literal, 'id'),
      bus: readString(literal, 'bus'),
      path: readString(literal, 'path'),
      loop: readBoolean(literal, 'loop'),
      gain: readNumber(literal, 'gain'),
      durationSeconds: readNumber(literal, 'durationSeconds'),
    };
    const missing = ENTRY_KEYS.filter((key) => entry[key] === undefined);
    if (missing.length > 0) {
      problems.push(`catalog: entry ${index} is missing ${missing.join(', ')}`);
    }
    entries.push(entry);
  }
  if (entries.length === 0) {
    problems.push('catalog: AUDIO_CATALOG contains no entries');
  }
  return { entries, problems };
}

/** Deploy-relative mp3 path shape, no traversal, no leading slash. */
function isValidPath(path) {
  return path.startsWith('audio/') && path.endsWith('.mp3') && !path.includes('..');
}

/** Structural checks: counts, uniqueness, bounds, loop flags. */
export function validateCatalog(entries) {
  const problems = [];
  if (entries.length !== PACK_LIMITS.entryCount) {
    problems.push(`catalog: expected ${PACK_LIMITS.entryCount} entries, found ${entries.length}`);
  }

  const counts = { music: 0, sfx: 0, voice: 0 };
  const ids = new Set();
  const paths = new Set();

  entries.forEach((entry, index) => {
    const label = entry.id ?? `entry ${index + 1}`;
    if (entry.bus !== undefined) {
      if (!BUSES.includes(entry.bus)) {
        problems.push(`invalid bus: ${label} has "${entry.bus}"`);
      } else {
        counts[entry.bus] += 1;
      }
    }

    if (entry.id !== undefined) {
      if (ids.has(entry.id)) {
        problems.push(`duplicate id: ${entry.id}`);
      }
      ids.add(entry.id);
    }

    if (entry.path !== undefined) {
      if (!isValidPath(entry.path)) {
        problems.push(`invalid path: ${label} has "${entry.path}"`);
      }
      if (paths.has(entry.path)) {
        problems.push(`duplicate path: ${entry.path}`);
      }
      paths.add(entry.path);
    }

    if (entry.gain !== undefined && !(entry.gain >= 0 && entry.gain <= 1)) {
      problems.push(`invalid gain: ${label} has ${entry.gain}`);
    }

    if (entry.loop !== undefined) {
      const shouldLoop = entry.bus === 'music';
      if (entry.loop !== shouldLoop) {
        problems.push(`loop flag: ${label} must be ${shouldLoop}, found ${entry.loop}`);
      }
    }

    if (entry.durationSeconds !== undefined && entry.bus !== undefined) {
      const bounds = PACK_LIMITS.durationSeconds[entry.bus];
      if (bounds === undefined) {
        return;
      }
      if (entry.durationSeconds <= bounds.min || entry.durationSeconds > bounds.max) {
        problems.push(
          `duration out of bounds: ${label} is ${entry.durationSeconds}s, expected ` +
            `${bounds.min < 0 ? 0 : bounds.min}-${bounds.max}s`,
        );
      }
    }
  });

  for (const bus of BUSES) {
    const expected = PACK_LIMITS.busCounts[bus];
    if (counts[bus] !== expected) {
      problems.push(`bus count: expected ${expected} ${bus}, found ${counts[bus]}`);
    }
  }

  return problems;
}

/**
 * Audit a parsed catalog against a map of deploy-relative path -> byte size.
 * `fileSizes` describes every file under `public/`, so orphan mp3s stay visible
 * without filesystem access in the tests. `totalBytes` sums only the declared
 * audio, so models and other public assets never eat the NFR-1 audio budget.
 */
export function auditPack({ catalogText, fileSizes }) {
  const { entries, problems: catalogProblems } = extractCatalogEntries(catalogText);
  const problems = [...catalogProblems, ...validateCatalog(entries)];

  const declared = new Set();
  for (const entry of entries) {
    if (entry.path === undefined) {
      continue;
    }
    declared.add(entry.path);
    const bytes = fileSizes[entry.path];
    if (bytes === undefined) {
      problems.push(`missing file: public/${entry.path}`);
    } else if (bytes <= 0) {
      problems.push(`empty file: public/${entry.path}`);
    } else if (!entry.path.endsWith('.mp3')) {
      problems.push(`not an mp3: public/${entry.path}`);
    }
  }

  for (const path of Object.keys(fileSizes)) {
    if (path.endsWith('.mp3') && !declared.has(path)) {
      problems.push(`orphan mp3: public/${path}`);
    }
  }

  const totalBytes = entries.reduce((sum, entry) => {
    const bytes = entry.path === undefined ? 0 : (fileSizes[entry.path] ?? 0);
    return sum + bytes;
  }, 0);
  if (totalBytes > PACK_LIMITS.totalBytes) {
    problems.push(`pack too large: ${totalBytes} bytes > ${PACK_LIMITS.totalBytes}`);
  }

  return { entries, problems, totalBytes };
}

/** Count entries per bus for the success line. */
export function countBuses(entries) {
  const counts = { music: 0, sfx: 0, voice: 0 };
  for (const entry of entries) {
    if (entry.bus !== undefined && BUSES.includes(entry.bus)) {
      counts[entry.bus] += 1;
    }
  }
  return counts;
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

/**
 * Map every file under `publicDir` to its byte size, keyed by its path relative
 * to `public/` with forward slashes (so it matches the catalog's `path`).
 */
export function collectFileSizes(publicDir) {
  const root = resolve(publicDir);
  const fileSizes = {};
  let info;
  try {
    info = statSync(root);
  } catch {
    return fileSizes;
  }
  if (!info.isDirectory()) {
    return fileSizes;
  }
  for (const file of walkFiles(root)) {
    fileSizes[relative(root, file).split(sep).join('/')] = statSync(file).size;
  }
  return fileSizes;
}

/**
 * Read the catalog and the audio tree under `projectDir`, then audit them.
 * Returns the findings plus the totals the CLI prints.
 */
export function checkPack(projectDir) {
  const root = resolve(projectDir);
  const catalogPath = join(root, 'src', 'audio', 'catalog.ts');
  let catalogText;
  try {
    catalogText = readFileSync(catalogPath, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      entries: [],
      problems: [`catalog: cannot read ${catalogPath}: ${reason}`],
      totalBytes: 0,
    };
  }
  const fileSizes = collectFileSizes(join(root, 'public'));
  return auditPack({ catalogText, fileSizes });
}

/** CLI entry: one line per problem, exit 1; a summary line and 0 on success. */
function main(argv) {
  const projectDir = argv[0] ?? '.';
  const { entries, problems, totalBytes } = checkPack(projectDir);
  if (problems.length > 0) {
    for (const problem of problems) {
      process.stderr.write(`audio pack: ${problem}\n`);
    }
    process.exitCode = 1;
    return;
  }
  const counts = countBuses(entries);
  process.stdout.write(
    `audio pack ok: ${entries.length} assets (` +
      `${counts.music} music, ${counts.sfx} sfx, ${counts.voice} voice), ` +
      `${totalBytes} bytes\n`,
  );
}

// Importable by the unit tests: only run as a CLI when executed directly.
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  main(process.argv.slice(2));
}
