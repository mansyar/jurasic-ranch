import { describe, expect, it } from "vitest";
import type { DevSnapshot, SnapshotDino } from "../../src/dev/snapshot.js";
import { buildSnapshot } from "../../src/dev/snapshot.js";

/** Snapshot projection (FR-7, AC-8): documented fields plus pairwise distances. */

function dino(id: SnapshotDino["id"], x: number, z: number): SnapshotDino {
  return {
    id,
    label: id,
    visible: true,
    rigged: true,
    x,
    z,
    heading: 0,
    walking: true,
  };
}

function inputFor(dinos: SnapshotDino[]) {
  return {
    walking: true,
    paused: false,
    pov: "ranch" as const,
    sleepy: "awake" as const,
    fps: 60,
    dinos,
  };
}

describe("buildSnapshot (FR-7, AC-8)", () => {
  it("carries the scene fields through", () => {
    const snapshot: DevSnapshot = buildSnapshot(inputFor([dino("trike", 0, 0)]));
    expect(snapshot.walking).toBe(true);
    expect(snapshot.paused).toBe(false);
    expect(snapshot.pov).toBe("ranch");
    expect(snapshot.sleepy).toBe("awake");
    expect(snapshot.fps).toBe(60);
  });

  it("lists every unordered pair exactly once", () => {
    const snapshot = buildSnapshot(
      inputFor([dino("trike", 0, 0), dino("stego", 3, 4), dino("brachio", 1, 0)]),
    );
    expect(snapshot.pairs.map((pair) => `${pair.a}-${pair.b}`)).toEqual([
      "trike-stego",
      "trike-brachio",
      "stego-brachio",
    ]);
  });

  it("computes pairwise distances from the reported coordinates", () => {
    const snapshot = buildSnapshot(
      inputFor([dino("trike", 0, 0), dino("stego", 3, 4), dino("brachio", -1.5, 2)]),
    );
    for (const pair of snapshot.pairs) {
      const a = snapshot.dinos.find((entry) => entry.id === pair.a);
      const b = snapshot.dinos.find((entry) => entry.id === pair.b);
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      const expected = Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
      expect(pair.distance).toBeCloseTo(expected, 12);
    }
    expect(snapshot.pairs[0]?.distance).toBeCloseTo(5, 12);
  });

  it("reports the smallest pair distance as minSeparation", () => {
    const snapshot = buildSnapshot(
      inputFor([dino("trike", 0, 0), dino("stego", 3, 4), dino("brachio", 0, 0.5)]),
    );
    const smallest = Math.min(...snapshot.pairs.map((pair) => pair.distance));
    expect(snapshot.minSeparation).toBeCloseTo(0.5, 12);
    expect(snapshot.minSeparation).toBe(smallest);
  });

  it("returns no pairs and null separation for a single dino", () => {
    const snapshot = buildSnapshot(inputFor([dino("trike", 2, -1)]));
    expect(snapshot.pairs).toEqual([]);
    expect(snapshot.minSeparation).toBeNull();
  });

  it("does not mutate the input", () => {
    const dinos = [dino("trike", 0, 0), dino("stego", 1, 1)];
    const input = inputFor(dinos);
    const before = structuredClone(input);
    buildSnapshot(input);
    expect(input).toEqual(before);
  });
});
