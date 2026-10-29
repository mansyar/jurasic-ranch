import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { assertDistClean, findHarnessMarkers } from '../../scripts/check-dist-clean.mjs';

/**
 * The production bundle must never carry the dev harness (FR-9, NFR-3, AC-10).
 * These fixtures prove the guard finds markers wherever Vite may emit them and
 * stays quiet on a clean `dist/`.
 */

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ranch-dist-clean-'));
  tempDirs.push(dir);
  return dir;
}

async function plant(dir: string, relativePath: string, contents: string): Promise<void> {
  const file = join(dir, relativePath);
  await mkdir(join(file, '..'), { recursive: true });
  await writeFile(file, contents, 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('findHarnessMarkers (AC-10)', () => {
  it('finds markers in nested js, css, html, webmanifest and sw.js', async () => {
    const dir = await makeTempDir();
    await plant(dir, 'assets/index-abc123.js', 'window.__ranch = { snapshot() {} };');
    await plant(dir, 'assets/index-def456.css', '.installDevHarness{display:none}');
    await plant(dir, 'index.html', '<div data-dev-panel="1"></div>');
    await plant(dir, 'manifest.webmanifest', '{"name":"parseDevQuery"}');
    await plant(dir, 'sw.js', "self.addEventListener('install', () => __ranch);");

    const findings = findHarnessMarkers(dir);

    const markers = findings.map((finding) => finding.marker).sort();
    expect(markers).toEqual([
      '__ranch',
      '__ranch',
      'data-dev-panel',
      'installDevHarness',
      'parseDevQuery',
    ]);
    for (const finding of findings) {
      expect(finding.file.startsWith(dir)).toBe(false);
      expect(finding.file.length).toBeGreaterThan(0);
    }
    expect(findings.map((finding) => finding.file).sort()).toEqual([
      'assets/index-abc123.js',
      'assets/index-def456.css',
      'index.html',
      'manifest.webmanifest',
      'sw.js',
    ]);
  });

  it('reports every marker in one file', async () => {
    const dir = await makeTempDir();
    await plant(dir, 'assets/chunk.js', 'installDevHarness(parseDevQuery(location.search));');

    const findings = findHarnessMarkers(dir).filter(
      (finding) => finding.file === 'assets/chunk.js',
    );

    expect(findings.map((finding) => finding.marker).sort()).toEqual([
      'installDevHarness',
      'parseDevQuery',
    ]);
  });

  it('returns an empty list for a clean dist', async () => {
    const dir = await makeTempDir();
    await plant(dir, 'assets/index-abc123.js', 'const harnessless = true;');
    await plant(dir, 'index.html', '<main id=app></main>');
    await plant(dir, 'sw.js', 'self.skipWaiting();');
    // The word alone is not a marker: only the harness symbols are.
    await plant(dir, 'assets/notes.js', "const ranch = 'welcome to the ranch';");

    expect(findHarnessMarkers(dir)).toEqual([]);
  });
});

describe('assertDistClean (AC-10)', () => {
  it('throws an error that names the file and the marker', async () => {
    const dir = await makeTempDir();
    await plant(dir, 'assets/index-abc123.js', 'window.__ranch = {};');

    expect(() => assertDistClean(dir)).toThrow(/assets\/index-abc123\.js/);
    expect(() => assertDistClean(dir)).toThrow(/__ranch/);
  });

  it('does not throw for a clean dist', async () => {
    const dir = await makeTempDir();
    await plant(dir, 'index.html', '<main id=app></main>');

    expect(() => assertDistClean(dir)).not.toThrow();
  });

  it('throws with the build hint when dist is missing', async () => {
    const dir = await makeTempDir();
    const missing = join(dir, 'dist');

    expect(() => assertDistClean(missing)).toThrow(/pnpm build/);
    expect(() => findHarnessMarkers(missing)).toThrow(/pnpm build/);
  });
});

describe('CLI entry (AC-10)', () => {
  const script = fileURLToPath(new URL('../../scripts/check-dist-clean.mjs', import.meta.url));

  function run(target: string): { status: number; stdout: string; stderr: string } {
    const result = spawnSync(process.execPath, [script, target], { encoding: 'utf8' });
    return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
  }

  it('exits 0 and stays quiet for a clean dist', async () => {
    const dir = await makeTempDir();
    await plant(dir, 'index.html', '<main id=app></main>');

    const result = run(dir);

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/dist clean/);
  });

  it('exits 1 and names the file when a marker is planted', async () => {
    const dir = await makeTempDir();
    await plant(dir, 'assets/index-abc123.js', 'window.__ranch = {};');

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/assets\/index-abc123\.js/);
    expect(result.stderr).toMatch(/__ranch/);
  });

  it('exits 1 with the build hint when dist is missing', async () => {
    const dir = await makeTempDir();
    const result = run(join(dir, 'dist'));

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/pnpm build/);
  });
});
