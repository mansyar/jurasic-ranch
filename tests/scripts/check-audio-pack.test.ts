import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  auditPack,
  collectFileSizes,
  extractCatalogEntries,
  validateCatalog,
} from '../../scripts/check-audio-pack.mjs';

/**
 * The starter-pack guard must fail loudly on a missing, orphaned, oversized, or
 * malformed pack (FR-1, AC-1, NFR-1) and stay quiet on a complete one.
 */

interface FixtureAsset {
  readonly id: string;
  readonly bus: 'music' | 'sfx' | 'voice';
  readonly path: string;
  readonly loop: boolean;
  readonly gain: number;
  readonly durationSeconds: number;
}

const FIXTURE_ASSETS: readonly FixtureAsset[] = [
  {
    id: 'music-kalimba',
    bus: 'music',
    path: 'audio/music/kalimba-loop.mp3',
    loop: true,
    gain: 1,
    durationSeconds: 40,
  },
  {
    id: 'coo-trike',
    bus: 'sfx',
    path: 'audio/sfx/coo-trike.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 1,
  },
  {
    id: 'coo-stego',
    bus: 'sfx',
    path: 'audio/sfx/coo-stego.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 1.2,
  },
  {
    id: 'coo-brachio',
    bus: 'sfx',
    path: 'audio/sfx/coo-brachio.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 1.4,
  },
  {
    id: 'tap',
    bus: 'sfx',
    path: 'audio/sfx/tap.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.18,
  },
  {
    id: 'heart',
    bus: 'sfx',
    path: 'audio/sfx/heart.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.75,
  },
  {
    id: 'sparkle',
    bus: 'sfx',
    path: 'audio/sfx/sparkle.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.9,
  },
  {
    id: 'hello',
    bus: 'voice',
    path: 'audio/voice/hello.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.93,
  },
  {
    id: 'nom',
    bus: 'voice',
    path: 'audio/voice/nom.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 1.12,
  },
  {
    id: 'all-done',
    bus: 'voice',
    path: 'audio/voice/all-done.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 1.02,
  },
  {
    id: 'count-1',
    bus: 'voice',
    path: 'audio/voice/count-1.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.79,
  },
  {
    id: 'count-2',
    bus: 'voice',
    path: 'audio/voice/count-2.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.85,
  },
  {
    id: 'count-3',
    bus: 'voice',
    path: 'audio/voice/count-3.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.85,
  },
  {
    id: 'count-4',
    bus: 'voice',
    path: 'audio/voice/count-4.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.86,
  },
  {
    id: 'count-5',
    bus: 'voice',
    path: 'audio/voice/count-5.mp3',
    loop: false,
    gain: 1,
    durationSeconds: 0.91,
  },
];

const catalogSource = (entries: readonly FixtureAsset[]): string => {
  const rows = entries.map(
    (entry) => `  {
    id: '${entry.id}',
    bus: '${entry.bus}',
    path: '${entry.path}',
    loop: ${entry.loop},
    gain: ${entry.gain},
    durationSeconds: ${entry.durationSeconds},
  },`,
  );
  return `export const AUDIO_CATALOG = [\n${rows.join('\n')}\n] as const satisfies readonly AudioAsset[];\n`;
};

function sizesFor(entries: readonly FixtureAsset[], bytes = 1_000): Record<string, number> {
  return Object.fromEntries(entries.map((entry) => [entry.path, bytes]));
}

function withEntry(index: number, patch: Partial<FixtureAsset>): readonly FixtureAsset[] {
  return FIXTURE_ASSETS.map((entry, position) =>
    position === index ? { ...entry, ...patch } : entry,
  );
}

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ranch-audio-pack-'));
  tempDirs.push(dir);
  return dir;
}

async function plant(dir: string, relativePath: string, contents: string): Promise<void> {
  const file = join(dir, relativePath);
  await mkdir(join(file, '..'), { recursive: true });
  await writeFile(file, contents);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('extractCatalogEntries', () => {
  it('reads all 15 literal entries with their flags', () => {
    const { entries, problems } = extractCatalogEntries(catalogSource(FIXTURE_ASSETS));

    expect(problems).toEqual([]);
    expect(entries).toHaveLength(15);
    expect(entries[0]).toEqual(FIXTURE_ASSETS[0]);
    expect(entries[14]).toEqual(FIXTURE_ASSETS[14]);
  });

  it('reports text without an AUDIO_CATALOG literal', () => {
    const { entries, problems } = extractCatalogEntries('export const somethingElse = [];');

    expect(entries).toEqual([]);
    expect(problems.join('\n')).toMatch(/cannot find/);
  });

  it('reports a truncated array missing its terminator', () => {
    const { problems } = extractCatalogEntries("export const AUDIO_CATALOG = [\n  { id: 'x' },");

    expect(problems.join('\n')).toMatch(/as const satisfies/);
  });
});

describe('validateCatalog', () => {
  it('accepts the shipped 1/6/8 layout', () => {
    const { entries } = extractCatalogEntries(catalogSource(FIXTURE_ASSETS));

    expect(validateCatalog(entries)).toEqual([]);
  });

  it('rejects wrong bus counts', () => {
    const entries = FIXTURE_ASSETS.slice(0, 14);
    const problems = validateCatalog(extractCatalogEntries(catalogSource(entries)).entries);

    expect(problems.join('\n')).toMatch(/expected 15 entries, found 14/);
    expect(problems.join('\n')).toMatch(/bus count: expected 8 voice, found 7/);
  });

  it('rejects a loop flag on an SFX entry', () => {
    const entries = withEntry(1, { loop: true });
    const parsed = extractCatalogEntries(catalogSource(entries)).entries;

    expect(validateCatalog(parsed).join('\n')).toMatch(/loop flag: coo-trike/);
  });

  it('rejects duplicate ids and paths', () => {
    const entries = withEntry(2, { id: 'coo-trike', path: 'audio/sfx/coo-trike.mp3' });
    const problems = validateCatalog(extractCatalogEntries(catalogSource(entries)).entries);

    expect(problems.join('\n')).toMatch(/duplicate id: coo-trike/);
    expect(problems.join('\n')).toMatch(/duplicate path: audio\/sfx\/coo-trike\.mp3/);
  });

  it('rejects a voice budget over two seconds and a short music loop', () => {
    const longVoice = validateCatalog(
      extractCatalogEntries(catalogSource(withEntry(7, { durationSeconds: 2.5 }))).entries,
    );
    const shortMusic = validateCatalog(
      extractCatalogEntries(catalogSource(withEntry(0, { durationSeconds: 12 }))).entries,
    );

    expect(longVoice.join('\n')).toMatch(/duration out of bounds: hello/);
    expect(shortMusic.join('\n')).toMatch(/duration out of bounds: music-kalimba/);
  });
});

describe('auditPack (AC-1, NFR-1)', () => {
  it('passes a complete pack and totals only the declared audio', () => {
    const result = auditPack({
      catalogText: catalogSource(FIXTURE_ASSETS),
      fileSizes: sizesFor(FIXTURE_ASSETS, 1_000),
    });

    expect(result.problems).toEqual([]);
    expect(result.totalBytes).toBe(15_000);
    expect(result.entries).toHaveLength(15);
  });

  it('ignores large non-audio public files in the pack total', () => {
    const fileSizes = { ...sizesFor(FIXTURE_ASSETS, 1_000), 'models/trike.glb': 3_000_000 };

    const { problems, totalBytes } = auditPack({
      catalogText: catalogSource(FIXTURE_ASSETS),
      fileSizes,
    });

    expect(problems).toEqual([]);
    expect(totalBytes).toBe(15_000);
  });

  it('fails a missing file', () => {
    const fileSizes = sizesFor(FIXTURE_ASSETS);
    delete fileSizes['audio/voice/hello.mp3'];

    const { problems } = auditPack({
      catalogText: catalogSource(FIXTURE_ASSETS),
      fileSizes,
    });

    expect(problems).toEqual(['missing file: public/audio/voice/hello.mp3']);
  });

  it('fails an empty file', () => {
    const fileSizes = sizesFor(FIXTURE_ASSETS);
    fileSizes['audio/sfx/tap.mp3'] = 0;

    const { problems } = auditPack({
      catalogText: catalogSource(FIXTURE_ASSETS),
      fileSizes,
    });

    expect(problems.join('\n')).toMatch(/empty file: public\/audio\/sfx\/tap\.mp3/);
  });

  it('fails an orphan mp3 under public/audio', () => {
    const fileSizes = { ...sizesFor(FIXTURE_ASSETS), 'audio/sfx/extra.mp3': 500 };

    const { problems } = auditPack({
      catalogText: catalogSource(FIXTURE_ASSETS),
      fileSizes,
    });

    expect(problems).toEqual(['orphan mp3: public/audio/sfx/extra.mp3']);
  });

  it('fails a pack over 2.5 MB', () => {
    const fileSizes = sizesFor(FIXTURE_ASSETS, 170_000);

    const { problems, totalBytes } = auditPack({
      catalogText: catalogSource(FIXTURE_ASSETS),
      fileSizes,
    });

    expect(totalBytes).toBe(2_550_000);
    expect(problems.join('\n')).toMatch(/pack too large: 2550000 bytes > 2500000/);
  });

  it('fails a malformed catalog instead of guessing', () => {
    const { problems } = auditPack({
      catalogText: "export const AUDIO_CATALOG = [ { id: 'hello' } ] as const satisfies X;",
      fileSizes: {},
    });

    expect(problems.join('\n')).toMatch(
      /entry 1 is missing bus, path, loop, gain, durationSeconds/,
    );
    expect(problems.join('\n')).toMatch(/expected 15 entries, found 1/);
  });
});

describe('collectFileSizes', () => {
  it('keys files relative to public/ with forward slashes', async () => {
    const dir = await makeTempDir();
    await plant(dir, 'audio/sfx/tap.mp3', '12345');
    await plant(dir, 'models/trike.glb', '123');

    expect(collectFileSizes(dir)).toEqual({
      'audio/sfx/tap.mp3': 5,
      'models/trike.glb': 3,
    });
  });

  it('returns an empty map for a missing directory', async () => {
    const dir = await makeTempDir();

    expect(collectFileSizes(join(dir, 'public'))).toEqual({});
  });
});

describe('CLI entry', () => {
  const script = fileURLToPath(new URL('../../scripts/check-audio-pack.mjs', import.meta.url));

  async function makeProject(): Promise<string> {
    const dir = await makeTempDir();
    await plant(dir, 'src/audio/catalog.ts', catalogSource(FIXTURE_ASSETS));
    for (const asset of FIXTURE_ASSETS) {
      await plant(dir, `public/${asset.path}`, 'not really an mp3');
    }
    // Big non-audio neighbours must never count against the audio budget.
    await plant(dir, 'public/models/trike.glb', 'x'.repeat(2_600_000));
    return dir;
  }

  function run(projectDir: string): { status: number; stdout: string; stderr: string } {
    const result = spawnSync(process.execPath, [script, projectDir], { encoding: 'utf8' });
    return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
  }

  it('exits 0 and prints the bus counts for a complete pack', async () => {
    const dir = await makeProject();

    const result = run(dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(
      /audio pack ok: 15 assets \(1 music, 6 sfx, 8 voice\), 255 bytes/,
    );
  });

  it('exits 1 with one line per problem', async () => {
    const dir = await makeProject();
    await rm(join(dir, 'public/audio/music/kalimba-loop.mp3'));

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /audio pack: missing file: public\/audio\/music\/kalimba-loop\.mp3/,
    );
  });

  it('exits 1 when the catalog is missing', async () => {
    const dir = await makeTempDir();

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/audio pack: catalog: cannot read/);
  });
});
