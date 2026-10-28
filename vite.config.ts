import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// NOTE: `export default` is required by Vite's config loader; the project
// styleguide's named-export rule applies to app code, not tool configs.
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // We ship our own manifest at public/manifest.webmanifest.
      manifest: false,
      workbox: {
        // Precache the app shell plus future dino GLBs for airplane-mode boot.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,glb,webmanifest}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: "es2022",
  },
});
