import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const ROOT_URL = new URL("../../", import.meta.url);

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, ROOT_URL), "utf8");
}

describe("dev harness production gate (FR-1, FR-10, AC-1)", () => {
  it("guards the harness import with import.meta.env.DEV", async () => {
    const viewer = await read("src/viewer/main.ts");
    expect(viewer).toMatch(
      /const dev = import\.meta\.env\.DEV \? await import\("\.\.\/dev\/harness\.js"\) : null;/,
    );
    // Publish + install only behind the same dev flag and the `?dev=1` option.
    expect(viewer).toMatch(/options\?\.enabled === true && options\.seed !== null && dev !== null/);
    expect(viewer).toMatch(
      /if \(dev !== null && devBridge !== null && options !== null\) \{\s*\n\s*devFrame = dev\.installDevHarness\(devBridge, options\);/,
    );
  });

  it("never imports harness values statically", async () => {
    const viewer = await read("src/viewer/main.ts");
    const valueImports = viewer.match(/^import (?!type\b).*dev\/harness\.js";$/gm) ?? [];
    expect(valueImports).toEqual([]);
    // The only static reference is the erased type import.
    expect(viewer).toMatch(/^import type \{[^}]*\} from "\.\.\/dev\/harness\.js";$/m);
  });

  it("leaves the default DOM path untouched", async () => {
    const html = await read("index.html");
    expect(html).not.toMatch(/data-dev-panel/);
    expect(html).not.toMatch(/__ranch/);
    expect(html).not.toMatch(/dev\/harness/);
    expect(html).not.toMatch(/dev-button/);

    const viewer = await read("src/viewer/main.ts");
    // `window.__ranch` is owned by the harness module only.
    expect(viewer).not.toMatch(/__ranch/);
    // The frame hook is the only per-frame harness touch, and it is a null check.
    expect(viewer).toMatch(/devFrame === null \? rawDt : devFrame\(rawDt, now\)/);
    // Unseeded boots keep Math.random for dust and the players.
    expect(viewer).toMatch(/Math\.random/);
  });

  it("builds the panel at runtime from the harness module", async () => {
    const harness = await read("src/dev/harness.ts");
    expect(harness).toMatch(/document\.createElement\("style"\)/);
    expect(harness).toMatch(/document\.createElement\("div"\)/);
    expect(harness).toMatch(/DEV_PANEL_ATTRIBUTE = "data-dev-panel"/);
    expect(harness).toMatch(/DEV_PANEL_STYLE_ATTRIBUTE = "data-dev-panel-style"/);
    expect(harness).not.toMatch(/innerHTML/);
    // Real buttons keep the panel keyboard reachable (NFR-2).
    expect(harness).toMatch(/document\.createElement\("button"\)/);
    expect(harness).toMatch(/aria-pressed/);
  });

  it("re-exports the phase 1 dev logic instead of duplicating it", async () => {
    const harness = await read("src/dev/harness.ts");
    expect(harness).toMatch(/export \{ parseDevQuery \} from "\.\/dev-options\.js";/);
    expect(harness).toMatch(/export \{ seededRandom \} from "\.\/seeded-random\.js";/);
    expect(harness).toMatch(/buildSnapshot/);
  });
});
