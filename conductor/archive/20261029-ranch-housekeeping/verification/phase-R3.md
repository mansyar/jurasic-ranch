# Verification: Phase R3 - CI Install Fix

- **Track:** 20261029-ranch-housekeeping
- **Phase:** R3
- **Date:** 2026-10-29
- **Branch:** `refactor/20261029-ranch-housekeeping`
- **Base commit:** `4621562`
- **Head commit:** `4621562`
- **Result:** verified

## What failed

PR #8's `verify` job died before running any check:

```
Error: ERR_PNPM_IGNORED_BUILDS
  ╰─▶ Ignored build scripts: esbuild@0.28.2, sharp@0.34.5
  help: Run "pnpm approve-builds" to pick which dependencies should be allowed
```

`pnpm install --frozen-lockfile` had passed on every earlier PR, so the trigger was
new: Phase 5 added `sharp` and, with it, a `pnpm-workspace.yaml` carrying
`onlyBuiltDependencies`. pnpm 12 stopped on the ignored builds anyway.

## Root cause

`onlyBuiltDependencies` is the pnpm 10 spelling. pnpm 11 replaced it with
`allowBuilds`, a map, and pnpm 12 ignores the old key silently - so the approval
list was never read, and the install failed the moment a dependency with a build
script was present. `esbuild` had been installed without complaint before only
because nothing else tripped the check; adding `sharp` made the failure visible.

Reproduced locally in a scratch directory holding just `package.json`,
`pnpm-lock.yaml` and `pnpm-workspace.yaml`: the old key gave
`ERR_PNPM_IGNORED_BUILDS` at exit 1, and the new key installed clean.

## Fix

`pnpm-workspace.yaml`:

```yaml
allowBuilds:
  esbuild: true
  sharp: true
```

## Commands

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` (scratch dir, old key) | exit 1, `ERR_PNPM_IGNORED_BUILDS` |
| `pnpm install --frozen-lockfile` (scratch dir, new key) | exit 0, 15.2 s |
| `pnpm install --frozen-lockfile` (repo) | exit 0, `esbuild postinstall: Done` |
| `pnpm verify` | exit 0 - 49 files formatted, 23 test files / 232 tests, 77.47 % lines (705/910), precache 30 entries (3,425.89 KiB) |
| GitHub Actions `verify` on the fixed head (`4fa5251`) | pass, 27 s - run `40847326032` |

## Note

Nothing in the app, its tests or its build output changed: the fix is the approval
key in one config file. The local `pnpm install` also dropped two statements that
the earlier run had counted (705/910 against 717/923) - a stale `node_modules` on
the dev machine, not a coverage change; the percentage is identical at 77.47 %.
