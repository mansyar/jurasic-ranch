import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// NOTE: `export default` is required by Vite's config loader; the project
// styleguide's named-export rule applies to app code, not tool configs.
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // We ship our own manifest at public/manifest.webmanifest.
      manifest: false,
      workbox: {
        // Precache the app shell plus future dino GLBs for airplane-mode boot.
        // `wasm` covers the Draco decoder Vite emits under `assets/`; `mp3`
        // covers the 15-asset starter pack so audio works offline (AC-10).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb,wasm,webmanifest,mp3}'],
        // The dino GLBs ship at 338 KB (Stego) and 690 KB (Brachio) after
        // 20261029-authored-dino-walk-clips dropped the withdrawn clips, and
        // `scripts/check-*` fails the bake above 512 KB / 900 KB. This cap is
        // headroom above that, not a target: Workbox's 2 MiB default would drop
        // a runaway bake from the precache with only a build warning.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
  test: {
    // Workflow Config: coverage.gate 60. The verify chain runs this, so a
    // coverage regression fails CI instead of being skipped.
    coverage: {
      provider: 'v8',
      // Generated Polyfork base generators, checked in for reproducibility and
      // already ignored by oxlint. They are vendored build tooling, not app
      // code, and they are what dragged the global figure from 77% to 50%.
      exclude: ['scripts/vendor/**'],
      thresholds: {
        lines: 60,
      },
    },
  },
});
