/** One catalog entry parsed from `src/audio/catalog.ts`. */
export interface CatalogEntry {
  id?: string;
  bus?: 'music' | 'sfx' | 'voice';
  path?: string;
  loop?: boolean;
  gain?: number;
  durationSeconds?: number;
}

/** Pack limits from NFR-1 and the phase contract. */
export interface PackLimits {
  readonly entryCount: number;
  readonly busCounts: Readonly<Record<'music' | 'sfx' | 'voice', number>>;
  readonly totalBytes: number;
  readonly durationSeconds: Readonly<
    Record<'music' | 'sfx' | 'voice', Readonly<{ min: number; max: number }>>
  >;
}

export declare const PACK_LIMITS: PackLimits;
export declare const BUSES: readonly ('music' | 'sfx' | 'voice')[];

export declare function extractCatalogEntries(catalogText: string): {
  entries: CatalogEntry[];
  problems: string[];
};

export declare function validateCatalog(entries: readonly CatalogEntry[]): string[];

export declare function auditPack(input: {
  catalogText: string;
  fileSizes: Record<string, number>;
}): {
  entries: CatalogEntry[];
  problems: string[];
  totalBytes: number;
};

export declare function countBuses(
  entries: readonly CatalogEntry[],
): Record<'music' | 'sfx' | 'voice', number>;

export declare function collectFileSizes(publicDir: string): Record<string, number>;

export declare function checkPack(projectDir: string): {
  entries: CatalogEntry[];
  problems: string[];
  totalBytes: number;
};
