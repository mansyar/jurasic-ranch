/** One harness marker occurrence found in a build output tree. */
export interface HarnessMarkerFinding {
  /** Path relative to the scanned root, slash-separated. */
  file: string;
  /** Harness symbol that must never reach `dist/`. */
  marker: string;
}

/** Harness symbols scanned for; frozen at runtime by the `.mjs` module. */
export declare const HARNESS_MARKERS: readonly string[];

/** Scan `rootDir` recursively and return every harness marker occurrence. */
export declare function findHarnessMarkers(rootDir: string): HarnessMarkerFinding[];

/** Throw with the offending file and marker when the bundle is not clean. */
export declare function assertDistClean(rootDir: string): void;
