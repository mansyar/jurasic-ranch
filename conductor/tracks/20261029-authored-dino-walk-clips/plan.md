# Implementation Plan: Stego and Brachio Walk on Their Own Bones

> **Branch:** `fix/20261029-authored-dino-walk-clips`
> **Base:** `main` @ `1a96d6b`
>
> Phase states are `pending`, `in_progress`, `verified`, `failed`, `blocked`. Only the primary agent writes this file.

## Phase 1: Prove the official base matches the module

- **Goal:** a measured bone-by-bone comparison proves that a fresh `createAsset()` bake shares the official GLBs' rest pose, so grafted clips apply verbatim; the same pass records each clip's duration, channel set and stride basis.
- **Depends on:** none
- **Covers:** FR-2, AC-2
- **Touches:** `scripts/vendor/inspect-dino-clips.mjs`, `conductor/tracks/20261029-authored-dino-walk-clips/verification/phase-1.md`
- **Verification:** `pnpm verify` plus the inspection script's recorded output
- **Status:** verified
- **Tasks:**
  - [x] **P1.T1: Build the inspection tool** - covers: FR-2
    - [x] **P1.T1.1: Parse a GLB and print nodes, skins, joints, rest TRS and every animation channel**
    - [x] **P1.T1.2: Print per-bone rest distance to parent, so later phases can express displacement as a fraction**
  - [x] **P1.T2: Compare official GLB against a module bake** - covers: FR-2
    - [x] **P1.T2.1: Fetch the official `stegosaurus-base.glb` and `brachiosaurus-base.glb` into gitignored `.conductor/evidence/phase-1/`**
    - [x] **P1.T2.2: Bake each module at `size: 1.0` with the pastel knobs and diff rest TRS joint by joint**
    - [x] **P1.T2.3: Record the verdict — identical rig, or the exact bones that differ and by how much**
  - [x] **P1.T3: Record the clip facts** - covers: FR-2
    - [x] **P1.T3.1: Dump each clip's name, duration, channel count and bone coverage**
    - [x] **P1.T3.2: Record the current shipped GLBs' displacement table as the pre-track baseline for AC-2**
- **Result:** verified — both modules rebuild the official rigs bone for bone (24/24 and 35/35 joints, worst delta 0.0000 m / 0.000°), so the authored clips apply verbatim. The first run reported a false MISMATCH because three exports bones as `matrix`, not TRS; fixed in the inspector and recorded as a deviation.
- **Checkpoint:** 17f6b8a
- **Evidence:** conductor/tracks/20261029-authored-dino-walk-clips/verification/phase-1.md

## Phase 2: Re-bake both GLBs with the authored clips

- **Goal:** `public/models/stego.glb` and `brachio.glb` carry Polyfork's own `Idle`, `Walk` and `Run` at authored proportions with the pastel colourway, produced reproducibly.
- **Depends on:** Phase 1
- **Covers:** FR-1, FR-2, FR-9, NFR-3, AC-1
- **Touches:** `scripts/vendor/bake-stego-variant.js`, `scripts/vendor/bake-brachio-variant.js`, `scripts/vendor/*-base-params.json`, `scripts/bake-trike-variant.js` (shared helpers only), `public/models/stego.glb`, `public/models/brachio.glb`, `CREDITS.md`
- **Verification:** `pnpm verify` plus a second bake that reproduces byte-identical GLBs
- **Status:** verified
- **Tasks:**
  - [x] **P2.T1: Replace the donor transfer with a graft** - covers: FR-1
    - [x] **P2.T1.1: Drop the Trike-donor extraction, `STEGO_POSITION_TRACK_SCALE` and the position rescaling entirely**
    - [x] **P2.T1.2: Import the official GLB's `Idle`/`Walk`/`Run` and attach them to the baked scene**
    - [x] **P2.T1.3: Fail loudly when a grafted clip names a bone the baked rig lacks**
  - [x] **P2.T2: Bake at authored proportions** - covers: FR-2
    - [x] **P2.T2.1: Call `createAsset()` at `size: 1.0` with the current pastel knobs, keeping one material and the baked `COLOR_0`**
    - [x] **P2.T2.2: Confirm the exported GLB's joints equal the official GLB's joints in name and rest TRS**
  - [x] **P2.T3: Ship both files** - covers: FR-1, AC-1
    - [x] **P2.T3.1: Run the Draco pass and write both GLBs via the existing atomic rename**
    - [x] **P2.T3.2: Verify the shipped files expose `Idle`, `Walk`, `Run` and no `Waddle`**
  - [x] **P2.T4: Reproducibility and credit** - covers: NFR-3, FR-9
    - [x] **P2.T4.1: Re-run both bakes and prove byte-identical output**
    - [x] **P2.T4.2: Update `CREDITS.md` and both script docblocks to name the official GLB as the clip source**

**Result:** verified
**Checkpoint:** _(set after squash)_
**Evidence:** conductor/tracks/20261029-authored-dino-walk-clips/verification/phase-2.md

> The graft could not go through `GLTFExporter`: it resamples at 24 fps and
> re-emits all three TRS paths, so `Walk` came back as 2.375 s with scale
> channels. The bake now exports the mesh alone, runs the Draco pass, then
> injects the official animation blocks into the compressed GLB by joint name.
> `vite.config.ts` also needed `maximumFileSizeToCacheInBytes: 4 MiB` because
> the clips push `brachio.glb` past workbox's 2 MiB default; Phase 6 owns the
> final precache budget.

## Phase 3: Regression gate on bone displacement

- **Goal:** a test that fails against the pre-track GLBs and passes against the re-baked ones, so this defect cannot return silently.
- **Depends on:** Phase 2
- **Covers:** FR-3, AC-2
- **Touches:** `scripts/check-dino-clips.test.ts`, `scripts/vendor/inspect-dino-clips.mjs`
- **Verification:** `pnpm verify`, plus a recorded run that fails against `1a96d6b`'s GLBs
- **Status:** pending
- **Tasks:**
  - [ ] **P3.T1: Assert the displacement envelope** - covers: FR-3
    - [ ] **P3.T1.1: For every animated bone, resolve rest translation and first-frame translation, and assert displacement ≤ 25 % of the bone's rest distance to its parent**
    - [ ] **P3.T1.2: Assert `Walk` durations 2.4 s / 3.8 s and the presence of `Idle` and `Run`**
  - [ ] **P3.T2: Prove the gate bites** - covers: AC-2
    - [ ] **P3.T2.1: Run the test against the `1a96d6b` GLBs checked out into a temp dir and record the failure**
    - [ ] **P3.T2.2: Record both runs in the phase evidence**

## Phase 4: Gait constants and per-species scale

- **Goal:** each species walks at its own measured stride, and in-game size is a uniform group scale rather than a bake knob.
- **Depends on:** Phase 3
- **Covers:** FR-4, FR-5, AC-5
- **Touches:** `src/ranch/dino-player.ts`, `src/viewer/loaders.ts`, `src/viewer/placeholders.ts`, `tests/waddle/*.test.ts`, `tests/ranch/*.test.ts`
- **Verification:** `pnpm verify`
- **Status:** pending
- **Tasks:**
  - [ ] **P4.T1: Measure the stride from the shipped clips** - covers: FR-5
    - [ ] **P4.T1.1: Derive metres per loop for Stego and Brachio from the clip length and authored gait step**
    - [ ] **P4.T1.2: Update `STEGO_GAIT` and `BRACHIO_GAIT`, and assert no gait constant is a copy of `TRIKE_GAIT`**
  - [ ] **P4.T2: Move scale into the viewer** - covers: FR-4
    - [ ] **P4.T2.1: Apply a documented uniform group scale per species so authored proportions survive**
    - [ ] **P4.T2.2: Drop the now-meaningless bake-time size knob from the params files or document it as shape-only**
  - [ ] **P4.T3: Re-point the tests** - covers: FR-5
    - [ ] **P4.T3.1: Update stride and gait assertions to the new numbers, keeping the one-loop-equals-one-stride contract**

## Phase 5: Enlarge the ranch to hold real proportions

- **Goal:** a real-proportion Brachio turns inside the walkable area, no prop intersects a dino, and each POV preset frames the animal it names.
- **Depends on:** Phase 4
- **Covers:** FR-6, FR-7, FR-8, NFR-1, AC-4, AC-6, AC-7
- **Touches:** `src/viewer/scene.ts`, `src/viewer/pov.ts`, `src/ranch/dressing.ts`, `src/ranch/avoidance.ts`, `src/ranch/dino-player.ts`, `src/viewer/placeholders.ts`, `tests/ranch/*.test.ts`, `tests/viewer/*.test.ts`
- **Verification:** `pnpm verify` plus dev-harness screenshots per POV in the phase evidence
- **Status:** pending
- **Tasks:**
  - [ ] **P5.T1: Grow the walkable area** - covers: FR-6
    - [ ] **P5.T1.1: Increase ground radius, camera far plane, spawn ring and wander radius to derive from body length**
    - [ ] **P5.T1.2: Scale walk clearance and the avoidance trigger with the largest pair's body length**
  - [ ] **P5.T2: Keep the props out of the way** - covers: FR-7
    - [ ] **P5.T2.1: Re-place the valley and farm dressing so every prop keeps its clearance from every wander path**
    - [ ] **P5.T2.2: Assert the clearance in a test rather than by eye**
  - [ ] **P5.T3: Re-aim the three presets** - covers: FR-8
    - [ ] **P5.T3.1: Retune Ranch, Nest and Garden positions and look-at targets for the new layout**
    - [ ] **P5.T3.2: Capture a screenshot per preset in the dev harness and check the named animal is unobstructed**
  - [ ] **P5.T4: Hold the frame budget** - covers: NFR-1
    - [ ] **P5.T4.1: Record harness triangles and draw calls for the trio and compare with the pre-track figures**

## Phase 6: Tell the truth about the trio

- **Goal:** the conductor docs, the credits and the budget evidence describe the shipped pipeline; the Brachio scale cap is retired.
- **Depends on:** Phase 5
- **Covers:** FR-9, NFR-2, NFR-5, AC-8, AC-9
- **Touches:** `conductor/product.md`, `conductor/tech-stack.md`, `CREDITS.md`, `conductor/tracks/20261029-authored-dino-walk-clips/verification/`
- **Verification:** `pnpm verify`
- **Status:** pending
- **Tasks:**
  - [ ] **P6.T1: Retire the stale cap and document the pipeline** - covers: FR-9
    - [ ] **P6.T1.1: Replace the 1.2 m Brachio cap in `product.md` with the real proportion rule**
    - [ ] **P6.T1.2: Describe the module-mesh-plus-grafted-clips bake in `tech-stack.md`**
  - [ ] **P6.T2: Record the budget** - covers: NFR-2
    - [ ] **P6.T2.1: Record precache before and after, and confirm the growth stays within 2 MiB**
    - [ ] **P6.T2.2: If the budget is exceeded, withdraw `Run` explicitly rather than trimming precision**
