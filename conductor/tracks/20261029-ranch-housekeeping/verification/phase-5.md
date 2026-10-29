# Phase 5 — Tell the truth about the ranch

- **Track:** `20261029-ranch-housekeeping` — Ranch Housekeeping
- **Phase:** 5 — Tell the truth about the ranch
- **Date:** 2026-10-29
- **Branch:** `refactor/20261029-ranch-housekeeping`
- **Base commit:** `2ab474213ca4a2f1be23622b9c4d023c431441fa`
- **Head commit:** `9b16214` (this evidence file is the next commit)
- **Result:** **blocked** — the icon PNGs cannot be produced in this environment.
  The generator, its dependency and the manifest / document-head copy are in
  place and `pnpm verify` is green, but `node`, `pnpm install`, `pnpm add` and
  `pnpm icons` are all permission-denied to the phase executor, so
  `scripts/build-icons.mjs` has never been executed and no PNG exists.

## What landed

| Commit | Task | Contents |
| --- | --- | --- |
| `820cf35` | P5.T1 (partial) | `scripts/build-icons.mjs`, `sharp` devDependency, `pnpm-lock.yaml`, `pnpm-workspace.yaml` |
| `d1da45a` | P5.T2 (partial) | `public/manifest.webmanifest` `name` + `description` |
| `9b16214` | P5.T3 (partial) | `index.html` `<title>` |

## Commands

| Command | Result |
| --- | --- |
| `pnpm add -D sharp` | **denied** — `permission.rejected` (`Permission denied: shell`) |
| `pnpm install` | **denied** — `permission.rejected` |
| `pnpm icons` | **denied** — `permission.rejected` |
| `node scripts/build-icons.mjs` | **denied** — `permission.rejected` |
| `node --version` | **denied** — `permission.rejected` |
| `pnpm format --check` (direct) | **denied** — `permission.rejected` |
| `pnpm verify` | exit 0 — lint, format (48 files), typecheck, coverage 77.47% lines, build |
| `pnpm lint` / `pnpm test` / `pnpm build` | exit 0 |
| manifest parse (`node -e …`) | not run — `node` denied |

`sharp@0.34.5` was nevertheless installed: `pnpm verify` runs its own
`verifyDepsBeforeRun` install before the scripts, and that install resolved the
`sharp` entry this phase added to `package.json`. The lockfile in `820cf35`
is the real resolved graph, not a hand edit. Its approved postinstall
(`node install/check`) ran without error, which is indirect evidence that the
sharp native binding loads on this machine — but it is not evidence that the
generator works, and it is not treated as such.

## Manifest parse (P5.T2.3) — not produced

The parse is the one-liner below; it was not run because `node` is denied.

```sh
node -e "const m=require('./public/manifest.webmanifest');
console.log(m.icons.map(i=>i.src+' '+i.sizes+' '+i.purpose).join('\n'))"
```

What can be stated by inspection instead: the manifest is valid JSON (it is
parsed by `vite build`'s copy step, which succeeded), it declares exactly one
icon (`/icons/icon.svg`), and that file exists. The 192 and 512 raster entries
and the maskable entry required by FR-10 are **not declared**, because the
files they would point at do not exist.

## Icon table — nothing produced

| File | Dimensions | Bytes | Background |
| --- | --- | --- | --- |
| `public/icons/icon-192.png` | 192×192 | — not produced | transparent (any) |
| `public/icons/icon-512.png` | 512×512 | — not produced | transparent (any) |
| `public/icons/icon-maskable-512.png` | 512×512 | — not produced | `#7ec850`, artwork at 410 px (80%) |
| `public/icons/apple-touch-icon.png` | 180×180 | — not produced | `#7ec850` |

## Clean-tree re-run proof (AC-12) — not performed

Cannot be performed without executing the generator. The script is built for
it: fixed inputs, one pinned pipeline per target (2× supersample → lanczos3
downscale → `withMetadata({})` → PNG, `compressionLevel: 9`, no palette, no
progressive, no timestamp or random id anywhere), and top-level `await` so a
failure exits non-zero before a partial set is left behind.

## `index.html` diff (NFR-2)

Only the title changed. No layout, styles, element ids, labels or emoji moved.

```diff
@@ -13,7 +13,7 @@
     />
     <link rel="manifest" href="/manifest.webmanifest" />
     <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
-    <title>Jurasic Ranch — Trike Waddle Walk</title>
+    <title>Jurasic Ranch — Trike, Stego and Brachio</title>
     <style>
```

Two notes on the brief's "what is wrong today":

1. The `meta[name=description]` already named Trike, Stego **and** Brachio at
   the base commit (`Jurasic Ranch — watch baby Trike, Stego, and Brachio
   waddle. Offline-first PWA.`). It was left alone rather than churned for the
   sake of a diff. It satisfies the AC-11 text requirement as it stands.
2. The `apple-touch-icon` link was **not** added. It would 404 on every load
   until `public/icons/apple-touch-icon.png` exists, and an offline-first app
   that requests a missing icon on boot is a worse state than a page without
   the link. It is the first thing to add once the PNGs are generated.

## Manifest diff

```diff
-  "name": "Jurasic Ranch — Trike Waddle Walk",
+  "name": "Jurasic Ranch",
   "short_name": "Jurasic Ranch",
-  "description": "Watch a baby Triceratops waddle. Offline-first PWA.",
+  "description": "Three baby dinos — Trike, Stego and Brachio — waddle around the ranch. Offline-first PWA.",
```

`start_url`, `scope`, `display`, `orientation`, `background_color` and
`theme_color` are untouched. No feature is promised that does not exist.

## Acceptance criteria

| ID | Criterion | Result |
| --- | --- | --- |
| AC-10 | manifest mentions the trio and its icon entries resolve; 192 + 512 raster plus a maskable entry | **Not met.** Name and description name the trio; the icon entries required by FR-10 are absent because the PNGs are absent. |
| AC-11 | `index.html` title and description mention Trike, Stego and Brachio, and an `apple-touch-icon` link resolves | **Partly met.** Title and description both mention all three; the link is not declared, so it cannot resolve. |
| AC-12 | `node scripts/build-icons.mjs` on a clean tree leaves `git status` clean | **Not met, not run.** The command is permission-denied. |

NFR-1 is met for the part that is observable: `sharp` is a devDependency, no
file under `src/` imports it, and `grep -i sharp dist/assets/index-*.js`
returns nothing after a clean `pnpm build`.

## What the next run must do

1. `node scripts/build-icons.mjs` (or `pnpm icons`) — expect four PNGs printed
   with their byte sizes. If sharp's binding cannot load, the error is sharp's,
   not the script's.
2. Re-run it a second time on the clean tree and confirm `git status
   --porcelain` is empty (AC-12).
3. Add to the manifest, keeping the existing SVG entry:

   ```json
   {
     "src": "/icons/icon-192.png",
     "sizes": "192x192",
     "type": "image/png",
     "purpose": "any"
   },
   {
     "src": "/icons/icon-512.png",
     "sizes": "512x512",
     "type": "image/png",
     "purpose": "any"
   },
   {
     "src": "/icons/icon-maskable-512.png",
     "sizes": "512x512",
     "type": "image/png",
     "purpose": "maskable"
   }
   ```

4. Add `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`
   after the existing `<link rel="icon" …>` in `index.html`, then re-run
   `pnpm verify` (oxfmt owns `index.html` whitespace).

## Evidence paths

- `scripts/build-icons.mjs` — the generator, committed in `820cf35`
- `public/manifest.webmanifest` — rename and description
- `index.html` — title
- `pnpm-lock.yaml` — resolved `sharp@0.34.5`
- `pnpm-workspace.yaml` — build-script approvals (see deviations)

## Deviations

- **`pnpm-workspace.yaml` (new file, outside Touches).** Adding `sharp` makes
  every install report `ERR_PNPM_IGNORED_BUILDS` and warn that `node_modules`
  may be out of sync with the lockfile, because pnpm refuses unapproved build
  scripts by default; `pnpm verify` was printing that error before every run.
  The obvious fix, `pnpm.onlyBuiltDependencies` in `package.json`, cannot be
  used here: `oxfmt` rejects every arrangement of that key that was tried
  (after `packageManager`, before `engines`, between them), and `pnpm format`
  is denied so the file cannot be reformatted by the tool that owns its
  whitespace. The same setting in `pnpm-workspace.yaml` is pnpm's own
  documented location for it. The list approves `esbuild` as well as `sharp`:
  without the file, pnpm reported `esbuild@0.28.2` as an ignored build too.
- No other file outside Touches was touched.

## Notes

- `pnpm verify` is green on this tree: format check over 48 files, typecheck,
  232 tests, coverage 77.47% lines (gate 60), and a build that still precaches
  26 entries.
- This phase is **not** verified. The three things the brief says decide
  whether it is real — safe-area padding on the maskable icon, a deterministic
  second run, and an `index.html` diff of exactly three lines — are all
  unprovable without executing the generator, and none of them is claimed.
  The `index.html` diff is one line, not three, for the reason recorded above.

## Primary verification

The subagent was denied `node`, `pnpm add` and `pnpm icons`, so it committed the
generator and the manifest rename but could not produce the PNGs. The primary ran
the generator and closed the phase.

### P5.T1 — the icon set exists and is reproducible

`node scripts/build-icons.mjs` succeeded, and a second run produced
byte-identical files:

| File | Dimensions | Artwork | Bytes | SHA-256 (first 16) |
| --- | --- | --- | --- | --- |
| `icon-192.png` | 192x192 | 192 px | 5,339 | `c497d58818e6a4d0` |
| `icon-512.png` | 512x512 | 512 px | 14,671 | `741e55866992f276` |
| `icon-maskable-512.png` | 512x512 | 410 px on `#7ec850` | 11,050 | `0d2c9b2954e1769` |
| `apple-touch-icon.png` | 180x180 | 180 px on `#7ec850` | 4,626 | `1b233c47a0be5f47` |

The maskable file was inspected visually: the artwork occupies the central ~80%
and the surrounding `#7ec850` field is unbroken, so an Android circular or squircle
mask cannot clip the horns. The apple-touch file is full-bleed green with no
transparency, which is what iOS requires. Both read as the same character as
`icon.svg` — the source art was not redrawn.

AC-12 proof, after committing the PNGs:

```
git status --porcelain        (before re-run)  -> empty
node scripts/build-icons.mjs                    -> four files rewritten
git status --porcelain        (after re-run)   -> empty   => deterministic
```

`sharp` is a devDependency only and appears nowhere in `dist/` (grep for "sharp"
across the built tree: 0 files).

### P5.T2 — the manifest describes the trio and resolves

`node -e` parse of the shipped manifest, run from `public/`:

```
name: Jurasic Ranch
short_name: Jurasic Ranch
icons: 4
  /icons/icon-192.png         192x192  image/png       any       EXISTS 5339 B
  /icons/icon-512.png         512x512  image/png       any       EXISTS 14671 B
  /icons/icon-maskable-512.png 512x512 image/png       maskable  EXISTS 11050 B
  /icons/icon.svg             any      image/svg+xml   any       EXISTS 618 B
ALL ICON SRCS RESOLVE
```

Loaded in a real browser against the production build on port 5191: the manifest
fetched and parsed, `name` read `Jurasic Ranch`, all four entries present in the
order above, and each icon URL answered `200` with the expected content type
(`image/png` x3, the SVG retained for scalable contexts). `start_url`, `scope`,
`display`, `orientation`, `background_color` and `theme_color` were untouched.

Status: PASS (AC-10).

### P5.T3 — the document head, and nothing else

`git diff <phase-base> -- index.html` is two lines:

```
-    <title>Jurasic Ranch — Trike Waddle Walk</title>
+    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
+    <title>Jurasic Ranch — Trike, Stego and Brachio</title>
```

The description meta already named all three babies at the base commit, so it
needed no edit and was left alone. Browser check on the built app: `document.title`
is the new title, the description is unchanged, the apple-touch link resolves
(`200 image/png`), and the service worker was controlling the page. No layout,
style, element id or button label changed — NFR-2 holds.

Status: PASS (AC-11).

### One test had to change

`src/viewer/viewer.test.ts > offline shell > ships a standalone manifest with an
icon` asserted `icons[0].src === '/icons/icon.svg'`, which the new manifest
contract deliberately breaks. It was rewritten as `ships a standalone manifest
with installable icons`: it now pins the 192/512 `purpose: "any"` pair, the
`maskable` entry and the retained SVG, and loops over every declared icon
asserting its `src` resolves on disk. The old assertion only checked that *some*
icon existed; the new one checks the install contract this phase created. Count
stays 232 tests.

### Gate

`pnpm verify` exit 0 — 48 files formatted, 23 test files / 232 tests, coverage
lines 77.47% (above the 60% gate), build clean, precache grew from 26 to 30
entries (3,425.76 KiB) with the four icons, all inside the 15 MB budget.
