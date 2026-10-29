# Phase R1 — Review Fixes

- **Track:** `20261029-ranch-housekeeping`
- **Phase:** R1 (Review Fixes)
- **Date:** 2026-10-29
- **Branch:** `refactor/20261029-ranch-housekeeping`
- **Base:** `2ebba6b` (review recording commit)
- **Head:** `c8328c5`
- **Result:** verified

## Commands

| Command | Result |
| --- | --- |
| `pnpm verify` | exit 0 |
| `oxfmt --check` (final glob set) | 49 files, all correct |
| `vitest run` | 23 files, **232 tests passed** |
| coverage (v8) | 77.47 % lines (717/923 statements) |
| `vite build` | green, precache 30 entries / 3,425.89 KiB |

## Findings

| ID | Severity | Fix |
| --- | --- | --- |
| F1 | Low | `public/manifest.webmanifest` now declares `/icons/apple-touch-icon.png` (180×180, `purpose: any`); `viewer.test.ts` asserts the entry alongside the 192/512/maskable/SVG ones |
| F2 | Low | `format` script gained `"scripts/**/*.mjs"`; the vendored base pipelines stay out via `"!scripts/vendor/**/*.mjs"` |
| F3 | Low | `verification/integrated.md` re-keyed to the spec's actual FR/NFR/AC text; counts and line numbers corrected |
| F4 | Low | `spec.md` FR-9 and AC-9 restated as "no app-supplied decoder; every decoder file present is emitted by three", which is what the change actually guarantees |

## F2 — the probe

The gate would not be fixed by a file count alone, so the new scope was tested by
breaking a file it did not previously cover:

```
# deliberate mis-format appended to scripts/build-icons.mjs
Add-Content scripts/build-icons.mjs "const   probe =    1;"
pnpm format --check   ->  Format issues found in above 1 files
                          Finished in 611ms on 49 files
                          exit code 1
# reverted
git checkout -- scripts/build-icons.mjs   ->  working tree clean
```

Before this phase the same command inspected 48 files and never looked at a
`.mjs` file at all.

## F1 — manifest inventory

```
icons: 5
/icons/icon-192.png          192x192  any       exists=True
/icons/icon-512.png          512x512  any       exists=True
/icons/icon-maskable-512.png 512x512  maskable  exists=True
/icons/apple-touch-icon.png  180x180  any       exists=True
/icons/icon.svg              any      any       exists=True
```

The test now asserts all five entries, and still loops every icon asserting that
`public` + `src` resolves on disk, so a future entry pointing at a missing file
fails.

## F3 — evidence corrections

- `integrated.md` requirement table re-keyed: FR-10 (manifest trio + icon
  inventory), FR-11 (title/description/touch link), FR-12 (deterministic script),
  NFR-1 (no runtime dependency), NFR-2 (parity), NFR-5 (styleguide), NFR-6
  (precache budget) now carry their own text rather than a neighbour's.
- `main.ts` stated as **171** lines (the earlier 158 came from
  `Measure-Object -Line`, which undercounts; `Get-Content | .Count` gives 171).
- Test-count sentence corrected: the base ran **234**, the head runs 232, and the
  two missing tests are FR-3's own shim deletions.
- The 48-file format figure was superseded by 49 with `.mjs` in scope.

## F4 — what changed in the spec

`FR-9` and `AC-9` no longer say "exactly one decoder set". Three emits a base pair
*and* a `gltf/` variant plus a JS fallback unconditionally, so a file-count
criterion can never be green. The criteria now pin the property the change
actually delivers: no app-supplied copy in `dist/`, every decoder file emitted by
three, and the measured size drop.

## Acceptance

| Finding | Criterion | Result |
| --- | --- | --- |
| F1 | Manifest declares the touch icon and the test asserts it | pass |
| F2 | A `.mjs` script is format-checked and a mis-format fails | pass (probe exit 1) |
| F3 | Evidence table matches `spec.md`; counters agree with the tree | pass |
| F4 | AC-9 is satisfiable and satisfied | pass |

## Notes

- No source behaviour changed in this phase: the only runtime-visible edits are
  four extra manifest lines and one extra test assertion.
- `scripts/vendor/**/*.mjs` is excluded from the format gate deliberately — those
  are generated base pipelines, already excluded from lint and coverage.
