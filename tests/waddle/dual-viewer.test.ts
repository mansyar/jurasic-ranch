import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DinoPlayer } from "../../src/ranch/dino-player.js";
import { DustPool } from "../../src/ranch/dust.js";
import { WADDLE_LOOP_SECONDS } from "../../src/ranch/waddle.js";
import { walkStatusText } from "../../src/viewer/hud.js";
import { loadStegoPlayer, loadTrikePlayer, STEGO_MODEL_URL } from "../../src/viewer/loaders.js";
import { setAllWalking, steerPairApart } from "../../src/viewer/loop.js";
import {
  createPlaceholderStego,
  PLACEHOLDER_BODY_HEX,
  PLACEHOLDER_BODY_NAME,
  SPAWN_OFFSET_METRES,
  STEGO_BODY_HEX,
  STEGO_PLATE_HEX,
  updatePlaceholderWalk,
} from "../../src/viewer/placeholders.js";

const ROOT_URL = new URL("../../", import.meta.url);

/** Loader-boundary stubs: the tests below never touch WebGL or the network. */
const loaderMocks = vi.hoisted(() => ({
  loadAsync: vi.fn(),
  setDRACOLoader: vi.fn(),
  setDecoderPath: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: vi.fn(function (this: unknown) {
    return {
      loadAsync: loaderMocks.loadAsync,
      setDRACOLoader: loaderMocks.setDRACOLoader,
    };
  }),
}));

vi.mock("three/addons/loaders/DRACOLoader.js", () => ({
  DRACOLoader: vi.fn(function (this: unknown) {
    return {
      setDecoderPath: loaderMocks.setDecoderPath,
      dispose: loaderMocks.dispose,
    };
  }),
}));

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, ROOT_URL), "utf8");
}

function bodyOf(stego: THREE.Group): THREE.Object3D {
  return stego.getObjectByName(PLACEHOLDER_BODY_NAME) ?? stego;
}

function createRig(name: string): THREE.Group {
  const root = new THREE.Group();
  root.name = name;
  const hips = new THREE.Group();
  hips.name = "Hips";
  root.add(hips);
  return root;
}

function createWaddleClip(): THREE.AnimationClip {
  const track = new THREE.VectorKeyframeTrack(
    "Hips.position",
    [0, 0.4, 0.8],
    [0, 0, 0, 0, 0.05, 0, 0, 0, 0],
  );
  return new THREE.AnimationClip("Waddle", WADDLE_LOOP_SECONDS, [track]);
}

describe("placeholder stego fallback (FR-8, AC-5)", () => {
  it("reserves the stego model URL beside the trike one", () => {
    expect(STEGO_MODEL_URL).toBe("/models/stego.glb");
  });

  it("stands boxy on the ground plane with the same swap footprint", () => {
    const stego = createPlaceholderStego();
    expect(stego.name).toContain("Stego");
    expect(stego.children.length).toBeGreaterThan(0);
    const box = new THREE.Box3().setFromObject(stego);
    expect(Math.abs(box.min.y)).toBeLessThan(1e-6);
    const size = box.getSize(new THREE.Vector3());
    expect(size.z).toBeGreaterThanOrEqual(3.3);
    expect(size.z).toBeLessThanOrEqual(4.2);
    expect(stego.rotation.y).toBeCloseTo(-Math.PI / 2, 5);
  });

  it("reads as a Stego, not a second Trike: teal hide plus a plate row", () => {
    const stego = createPlaceholderStego();
    const hexes = new Set<number>();
    stego.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (mesh.isMesh === true && material?.color !== undefined) {
        hexes.add(material.color.getHex());
      }
    });
    expect(hexes.has(PLACEHOLDER_BODY_HEX)).toBe(false);
    expect(hexes.has(STEGO_BODY_HEX)).toBe(true);
    expect(hexes.has(STEGO_PLATE_HEX)).toBe(true);
  });

  it("shares the seamless 0.8 s placeholder bob with the trike", () => {
    const a = createPlaceholderStego();
    const b = createPlaceholderStego();
    updatePlaceholderWalk(a, 0);
    updatePlaceholderWalk(b, WADDLE_LOOP_SECONDS);
    expect(bodyOf(a).position.y).toBe(0);
    expect(bodyOf(a).position.y).toBe(bodyOf(b).position.y);
  });
});

describe("rigged stego loader (FR-4)", () => {
  beforeEach(() => {
    loaderMocks.loadAsync.mockReset();
    loaderMocks.setDRACOLoader.mockReset();
    loaderMocks.setDecoderPath.mockReset();
    loaderMocks.dispose.mockReset();
  });

  it("requests /models/stego.glb through the same Draco path as the trike", async () => {
    const scene = new THREE.Group();
    const clip = new THREE.AnimationClip("Waddle", 0.8, []);
    loaderMocks.loadAsync.mockResolvedValue({ scene, animations: [clip] });
    const loaded = await loadStegoPlayer();
    expect(loaderMocks.loadAsync).toHaveBeenCalledWith("/models/stego.glb");
    expect(loaderMocks.setDecoderPath).toHaveBeenCalledWith("/draco/");
    expect(loaderMocks.setDRACOLoader).toHaveBeenCalledTimes(1);
    expect(loaded.model).toBe(scene);
    expect(loaded.player).toBeInstanceOf(DinoPlayer);
    expect(loaded.player.clipDurationSeconds).toBeCloseTo(0.8, 5);
  });

  it("prefers the Waddle clip over other animations", async () => {
    loaderMocks.loadAsync.mockResolvedValue({
      scene: new THREE.Group(),
      animations: [
        new THREE.AnimationClip("Idle", 1.4, []),
        new THREE.AnimationClip("Waddle", 0.8, []),
      ],
    });
    const loaded = await loadStegoPlayer();
    expect(loaded.player.clipDurationSeconds).toBeCloseTo(0.8, 5);
  });

  it("honours an injected shared DustPool instead of allocating its own", async () => {
    const shared = new DustPool({ random: () => 0.5 });
    loaderMocks.loadAsync.mockResolvedValue({
      scene: new THREE.Group(),
      animations: [new THREE.AnimationClip("Waddle", 0.8, [])],
    });
    const stego = await loadStegoPlayer(shared);
    const trikeScene = new THREE.Group();
    loaderMocks.loadAsync.mockResolvedValue({
      scene: trikeScene,
      animations: [new THREE.AnimationClip("Waddle", 0.8, [])],
    });
    const trike = await loadTrikePlayer(shared);
    expect(stego.player.dust).toBe(shared);
    expect(trike.player.dust).toBe(shared);
  });

  it("rejects when the stego GLB cannot load so the placeholder stays", async () => {
    loaderMocks.loadAsync.mockRejectedValue(new Error("offline"));
    await expect(loadStegoPlayer()).rejects.toThrow("offline");
  });

  it("rejects when the stego GLB carries no animations", async () => {
    loaderMocks.loadAsync.mockResolvedValue({ scene: new THREE.Group(), animations: [] });
    await expect(loadStegoPlayer()).rejects.toThrow("Waddle");
  });
});

describe("single Walk toggles both dinos (FR-7, AC-4)", () => {
  it("flips every player together and never splits the pair", () => {
    const trike = new DinoPlayer(createRig("TrikeRoot"), { clip: createWaddleClip() });
    const stego = new DinoPlayer(createRig("StegoRoot"), { clip: createWaddleClip() });
    setAllWalking([trike, stego], true);
    expect(trike.walking).toBe(true);
    expect(stego.walking).toBe(true);
    setAllWalking([trike, stego], false);
    expect(trike.walking).toBe(false);
    expect(stego.walking).toBe(false);
  });

  it("names both species in the walking status, keeps the stopped text", () => {
    expect(walkStatusText(true)).toContain("Trike");
    expect(walkStatusText(true)).toContain("Stego");
    expect(walkStatusText(false)).toBe("Tap Walk to waddle");
  });

  it("spawns the pair ±0.4 m apart", () => {
    expect(SPAWN_OFFSET_METRES).toBe(0.4);
  });
});

describe("pair steering wiring (FR-6)", () => {
  it("turns a head-on pair away without stopping either dino", () => {
    const trikeRig = createRig("TrikeRoot");
    const stegoRig = createRig("StegoRoot");
    trikeRig.position.set(-0.2, 0, 0);
    stegoRig.position.set(0.2, 0, 0);
    const trike = new DinoPlayer(trikeRig, { clip: createWaddleClip(), random: () => 0.5 });
    const stego = new DinoPlayer(stegoRig, { clip: createWaddleClip(), random: () => 0.5 });
    trike.turnTo(Math.PI / 2);
    stego.turnTo(-Math.PI / 2);
    setAllWalking([trike, stego], true);
    for (let i = 0; i < 30; i += 1) {
      steerPairApart(trike, trikeRig, stego, stegoRig);
      trike.update(1 / 60, i / 60);
      stego.update(1 / 60, (i + 0.5) / 60);
    }
    expect(trike.walking).toBe(true);
    expect(stego.walking).toBe(true);
    // Both biased off the head-on line: headings no longer mirror exactly.
    expect(Math.abs(trike.heading - Math.PI / 2)).toBeGreaterThan(0.01);
    expect(Math.abs(stego.heading + Math.PI / 2)).toBeGreaterThan(0.01);
    expect(trikeRig.position.distanceTo(stegoRig.position)).toBeGreaterThan(0.25);
  });

  it("leaves a far-apart pair on course", () => {
    const trikeRig = createRig("TrikeRoot");
    const stegoRig = createRig("StegoRoot");
    trikeRig.position.set(-2, 0, 0);
    stegoRig.position.set(2, 0, 0);
    const trike = new DinoPlayer(trikeRig, { clip: createWaddleClip(), random: () => 0.5 });
    const stego = new DinoPlayer(stegoRig, { clip: createWaddleClip(), random: () => 0.5 });
    steerPairApart(trike, trikeRig, stego, stegoRig);
    expect(trike.heading).toBe(0);
    expect(stego.heading).toBe(0);
  });
});

describe("dual ranch shell (NFR-4, FR-7, FR-9)", () => {
  it("labels both species with icon + word in the UI", async () => {
    const html = await readText("index.html");
    expect(html).toContain("Trike");
    expect(html).toContain("Stego");
    expect(html).toContain("🦕");
    expect(html).toContain("🦖");
  });

  it("keeps one 72 px Walk button with pressed + status wiring", async () => {
    const html = await readText("index.html");
    const buttons = html.match(/id="walk-button"/g) ?? [];
    expect(buttons.length).toBe(1);
    expect(html).toContain("min-height: 72px");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('id="status"');
    const source = await readText("src/viewer/hud.ts");
    expect(source).toContain("aria-pressed");
  });

  it("constructs a single shared DustPool for both players", async () => {
    const source = await readText("src/viewer/main.ts");
    const constructions = source.match(/new DustPool\(/g) ?? [];
    expect(constructions.length).toBe(1);
    expect(source).toContain("loadStegoPlayer");
  });

  it("warns and keeps the trike walking when the stego GLB fails", async () => {
    const source = await readText("src/viewer/main.ts");
    expect(source).toContain("console.warn");
    expect(source).toContain("placeholder");
  });
});
