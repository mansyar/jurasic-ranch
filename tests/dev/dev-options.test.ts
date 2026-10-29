import { describe, expect, it } from "vitest";
import { parseDevQuery } from "../../src/dev/dev-options.js";

/**
 * Harness activation (FR-1) and option parsing (FR-8): only `dev=1` turns the
 * harness on, seed-only URLs stay disabled, and malformed values never throw.
 */

describe("harness activation (FR-1)", () => {
  it("enables the harness for exactly dev=1", () => {
    expect(parseDevQuery("?dev=1").enabled).toBe(true);
    expect(parseDevQuery("dev=1").enabled).toBe(true);
  });

  it("stays disabled without a query", () => {
    const options = parseDevQuery("");
    expect(options.enabled).toBe(false);
    expect(options.seed).toBeNull();
    expect(options.solo).toBeNull();
    expect(options.paused).toBe(false);
    expect(options.overlays).toBe(true);
  });

  it("stays disabled for dev=0 or dev=true", () => {
    expect(parseDevQuery("?dev=0").enabled).toBe(false);
    expect(parseDevQuery("?dev=true").enabled).toBe(false);
    expect(parseDevQuery("?dev=").enabled).toBe(false);
  });

  it("stays disabled when only seed is given", () => {
    expect(parseDevQuery("?seed=42").enabled).toBe(false);
  });
});

describe("seed parsing (FR-8)", () => {
  it("parses a positive integer seed", () => {
    expect(parseDevQuery("?dev=1&seed=42").seed).toBe(42);
  });

  it("keeps seed 0 valid", () => {
    expect(parseDevQuery("?dev=1&seed=0").seed).toBe(0);
  });

  it("keeps a negative seed valid", () => {
    expect(parseDevQuery("?dev=1&seed=-7").seed).toBe(-7);
  });

  it("treats junk and empty seeds as null", () => {
    expect(parseDevQuery("?dev=1&seed=abc").seed).toBeNull();
    expect(parseDevQuery("?dev=1&seed=").seed).toBeNull();
    expect(parseDevQuery("?dev=1").seed).toBeNull();
  });

  it("rejects a partially numeric seed instead of truncating it (F7)", () => {
    // `Number.parseInt("12abc")` is 12, which would silently seed a run from a
    // typo; only a full `/^-?\d+$/` integer is a seed.
    expect(parseDevQuery("?dev=1&seed=12abc").seed).toBeNull();
    expect(parseDevQuery("?dev=1&seed=42.5").seed).toBeNull();
    expect(parseDevQuery("?dev=1&seed=1e3").seed).toBeNull();
    expect(parseDevQuery("?dev=1&seed=%2042").seed).toBeNull();
    expect(parseDevQuery("?dev=1&seed=12abc").enabled).toBe(true);
  });
});

describe("remaining options", () => {
  it("reads pause=1", () => {
    expect(parseDevQuery("?dev=1&pause=1").paused).toBe(true);
    expect(parseDevQuery("?dev=1&pause=0").paused).toBe(false);
  });

  it("disables overlays only for overlays=0", () => {
    expect(parseDevQuery("?dev=1&overlays=0").overlays).toBe(false);
    expect(parseDevQuery("?dev=1").overlays).toBe(true);
    expect(parseDevQuery("?dev=1&overlays=1").overlays).toBe(true);
  });

  it("accepts the three species ids case-insensitively", () => {
    expect(parseDevQuery("?dev=1&solo=Brachio").solo).toBe("brachio");
    expect(parseDevQuery("?dev=1&solo=TRIKE").solo).toBe("trike");
    expect(parseDevQuery("?dev=1&solo=stego").solo).toBe("stego");
  });

  it("rejects unknown species ids", () => {
    expect(parseDevQuery("?dev=1&solo=trex").solo).toBeNull();
  });

  it("never throws on malformed input", () => {
    expect(() => parseDevQuery("?dev=1&seed=Infinity&solo=%%%")).not.toThrow();
    expect(parseDevQuery("?dev=1&seed=Infinity").seed).toBeNull();
  });
});
