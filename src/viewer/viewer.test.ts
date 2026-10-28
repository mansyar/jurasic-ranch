import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { isAudioUnlocked } from "./audio.js";
import {
  createPlaceholderTrike,
  TRIKE_MODEL_URL,
  updatePlaceholderWalk,
  WADDLE_LOOP_SECONDS,
} from "./main.js";
import { FALLBACK_PIXEL_RATIO, MAX_PIXEL_RATIO, resolvePixelRatio } from "./pixel-ratio.js";
import { readSetting } from "./storage.js";

const ROOT_URL = new URL("../../", import.meta.url);

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, ROOT_URL), "utf8");
}

describe("resolvePixelRatio", () => {
  it("caps the renderer at the tablet-friendly maximum", () => {
    expect(MAX_PIXEL_RATIO).toBe(2);
    expect(resolvePixelRatio(3)).toBe(2);
    expect(resolvePixelRatio(2.75)).toBe(2);
  });

  it("passes through ordinary ratios untouched", () => {
    expect(resolvePixelRatio(1)).toBe(1);
    expect(resolvePixelRatio(1.5)).toBe(1.5);
    expect(resolvePixelRatio(2)).toBe(2);
  });

  it("falls back to 1 for missing or unusable values", () => {
    expect(resolvePixelRatio(0)).toBe(FALLBACK_PIXEL_RATIO);
    expect(resolvePixelRatio(-2)).toBe(FALLBACK_PIXEL_RATIO);
    expect(resolvePixelRatio(Number.NaN)).toBe(FALLBACK_PIXEL_RATIO);
    expect(resolvePixelRatio(Number.POSITIVE_INFINITY)).toBe(FALLBACK_PIXEL_RATIO);
    expect(resolvePixelRatio(undefined)).toBe(FALLBACK_PIXEL_RATIO);
    expect(resolvePixelRatio("2")).toBe(FALLBACK_PIXEL_RATIO);
  });
});

describe("placeholder trike", () => {
  it("stands on the ground plane with a baby-scale body", () => {
    const trike = createPlaceholderTrike();
    expect(trike.children.length).toBeGreaterThan(0);
    const box = new THREE.Box3().setFromObject(trike);
    expect(Math.abs(box.min.y)).toBeLessThan(1e-6);
    expect(box.getSize(new THREE.Vector3()).x).toBeLessThan(1.6);
  });

  it("loops the 0.8 s walk pose seamlessly", () => {
    expect(WADDLE_LOOP_SECONDS).toBe(0.8);
    const a = createPlaceholderTrike();
    const b = createPlaceholderTrike();
    updatePlaceholderWalk(a, 0);
    updatePlaceholderWalk(b, WADDLE_LOOP_SECONDS);
    expect(a.position.y).toBe(0);
    expect(a.position.y).toBe(b.position.y);
    expect(a.rotation.z).toBe(b.rotation.z);
  });

  it("lifts mid-stride", () => {
    const trike = createPlaceholderTrike();
    updatePlaceholderWalk(trike, WADDLE_LOOP_SECONDS / 4);
    expect(trike.position.y).toBeGreaterThan(0);
  });

  it("reserves the Phase 2 model URL", () => {
    expect(TRIKE_MODEL_URL).toBe("/models/trike.glb");
  });
});

describe("audio stub", () => {
  it("starts locked and silent", () => {
    expect(isAudioUnlocked()).toBe(false);
  });
});

describe("storage stub", () => {
  it("reads unknown keys as undefined without storage", async () => {
    await expect(readSetting("missing-key")).resolves.toBeUndefined();
  });
});

describe("offline shell", () => {
  it("links the web manifest and viewer entry", async () => {
    const html = await readText("index.html");
    expect(html).toContain("/manifest.webmanifest");
    expect(html).toContain("/src/viewer/main.ts");
    expect(html).toContain("walk-button");
    expect(html).toContain("72px");
  });

  it("ships a standalone manifest with an icon", async () => {
    const raw = await readText("public/manifest.webmanifest");
    const manifest = JSON.parse(raw) as {
      display?: string;
      icons?: Array<{ src?: string }>;
      name?: string;
      start_url?: string;
    };
    expect(manifest.name).toContain("Jurasic Ranch");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBeDefined();
    expect(manifest.icons?.length ?? 0).toBeGreaterThan(0);
    expect(manifest.icons?.[0]?.src).toBe("/icons/icon.svg");
    await expect(readFile(new URL("public/icons/icon.svg", ROOT_URL))).resolves.toBeDefined();
  });
});
