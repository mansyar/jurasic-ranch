/**
 * Build the ranch icon set from `public/icons/icon.svg`.
 *
 * The manifest and the document head reference these PNGs as **install
 * metadata**: the browser reads them when the app is installed, before any
 * bundle, workbox precache or service worker exists to generate them. A build
 * step that produced them at `vite build` time would therefore never reach an
 * already-installed copy, and an offline install would have no icon at all. So
 * the PNGs are committed and this script exists to regenerate them on demand
 * (`pnpm icons`) and to prove the committed bytes are its output (AC-12).
 *
 * Outputs, all written beside the source SVG:
 *
 *   icon-192.png             192x192  transparent corners, `purpose: any`
 *   icon-512.png             512x512  transparent corners, `purpose: any`
 *   icon-maskable-512.png    512x512  artwork at 80% on #7ec850, `purpose: maskable`
 *   apple-touch-icon.png     180x180  full bleed on #7ec850, iOS masks the corners
 *
 * The maskable and apple-touch variants are composited onto the brand green
 * rather than left transparent: Android's mask crops the outer 10% of a
 * maskable icon and iOS fills transparency with black before rounding the
 * corners, so both would otherwise lose the frill or the background.
 *
 * Determinism is a contract, not a nicety — a re-run on a clean tree must leave
 * `git status` clean. Every output goes through the same pinned pipeline
 * (lanczos3 downscale, PNG no-metadata, no palette, no timestamps), so the
 * bytes depend only on the SVG source and the sharp version.
 *
 * Usage:
 *   pnpm icons            regenerate every PNG in place
 *   node scripts/build-icons.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const ICONS_DIR = path.join(ROOT, 'public', 'icons');
const SOURCE_SVG = path.join(ICONS_DIR, 'icon.svg');

/** The rounded-square background of `icon.svg`; the maskable safe area. */
const BRAND_GREEN = '#7ec850';

/** The SVG's intrinsic size, used to pick a supersampling density. */
const SVG_SIZE = 256;

/**
 * Maskable icons must keep their meaningful content inside a centred circle of
 * 80% of the icon; rendering the artwork to 80% of the canvas leaves 10%
 * padding on each edge, which is what Android's mask is allowed to crop.
 */
const MASKABLE_ART_RATIO = 0.8;

const TARGETS = [
  { file: 'icon-192.png', size: 192, background: null, artRatio: 1 },
  { file: 'icon-512.png', size: 512, background: null, artRatio: 1 },
  {
    file: 'icon-maskable-512.png',
    size: 512,
    background: BRAND_GREEN,
    artRatio: MASKABLE_ART_RATIO,
  },
  { file: 'apple-touch-icon.png', size: 180, background: BRAND_GREEN, artRatio: 1 },
];

/**
 * Rasterize the SVG at `artSize`, supersampled 2x and downscaled with lanczos3
 * so the horns and frill edges stay clean at 512.
 */
async function renderArtwork(svg, artSize) {
  const density = Math.ceil((72 * artSize * 2) / SVG_SIZE);
  return sharp(svg, { density })
    .resize(artSize, artSize, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9, palette: false, progressive: false })
    .toBuffer();
}

async function buildIcon(svg, target) {
  const artSize = Math.round(target.size * target.artRatio);
  const artwork = await renderArtwork(svg, artSize);

  let pipeline;
  if (target.background === null) {
    pipeline = sharp(artwork);
  } else {
    const canvas = sharp({
      create: {
        width: target.size,
        height: target.size,
        channels: 3,
        background: target.background,
      },
    });
    pipeline = canvas
      .composite([{ input: artwork, gravity: 'centre' }])
      .flatten({ background: target.background });
  }

  const png = await pipeline
    .withMetadata({})
    .png({ compressionLevel: 9, palette: false, progressive: false })
    .toBuffer();

  await writeFile(path.join(ICONS_DIR, target.file), png);
  return { file: target.file, size: target.size, artSize, bytes: png.length };
}

const svg = await readFile(SOURCE_SVG);
const results = [];
for (const target of TARGETS) {
  results.push(await buildIcon(svg, target));
}

for (const result of results) {
  console.log(
    `${result.file.padEnd(24)} ${result.size}x${result.size}  artwork ${result.artSize}px  ${result.bytes} B`,
  );
}
