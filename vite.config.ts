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
        // `wasm` covers the Draco decoder Vite emits under `assets/`.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb,wasm,webmanifest}'],
        // The authored clips ride inside the GLBs as float accessors, so Stego
        // and Brachio are 1.4 MB and 2.3 MB. Workbox's 2 MiB default silently
        // drops the larger one from the precache and fails the build; the ranch
        // still fits its 15 MB cache budget with both. Track
        // 20261029-authored-dino-walk-clips owns shrinking them.
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
