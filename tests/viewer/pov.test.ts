import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  DINO_WALK_RADIUS_METRES,
  LARGEST_DINO_BODY_LENGTH_METRES,
  trioSpawnPositions,
} from '../../src/ranch/avoidance.js';
import {
  DRESSING_FOOTPRINT_METRES,
  DRESSING_MANIFEST,
  GROUND_RADIUS_METRES,
  WALK_CLEARANCE_METRES,
} from '../../src/ranch/dressing.js';
import { IN_GAME_BODY_LENGTH_METRES } from '../../src/viewer/loaders.js';
import { DRESSING_CATALOGUE } from '../../src/ranch/layout.js';
import {
  HINT_IDLE_MS,
  POV_BEARING_RADIANS,
  POV_FOCUS_SPECIES,
  POV_ORDER,
  POV_PRESETS,
  VIEWPORT_META_CONTENT,
  applyPovPreset,
  hintModeFor,
  isPortraitViewport,
  povPresetById,
  shouldShowHint,
} from '../../src/viewer/pov.js';
import { CAMERA_FAR_METRES } from '../../src/viewer/scene.js';

const ROOT_URL = new URL('../../', import.meta.url);

/** Clear ground a prop must leave on a preset's sightline before it blocks. */
const SIGHTLINE_MARGIN_METRES = 0.5;

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, ROOT_URL), 'utf8');
}

/** Ground bearing of a point in the preset convention (+X = 0, +Z = 90 deg). */
function bearingTo(x: number, z: number): number {
  return Math.atan2(z, x);
}

/** Shortest absolute angle between two bearings, in radians. */
function angleDelta(from: number, to: number): number {
  const delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) {
    return Math.abs(delta - Math.PI * 2);
  }
  return Math.abs(delta < -Math.PI ? delta + Math.PI * 2 : delta);
}

describe('POV presets', () => {
  it('ships exactly the Ranch, Nest, and Garden viewpoints', () => {
    expect(POV_ORDER).toEqual(['ranch', 'nest', 'garden']);
    for (const id of POV_ORDER) {
      const preset = povPresetById(id);
      expect(preset.id).toBe(id);
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.icon.length).toBeGreaterThan(0);
    }
  });

  it('frames the animal each preset is named for (FR-8, AC-7)', () => {
    // Ranch -> Brachio, Nest -> Trike, Garden -> Stego, and every preset looks
    // at that animal's body centre rather than at the middle of the ranch.
    expect(POV_FOCUS_SPECIES).toEqual({ ranch: 'brachio', nest: 'trike', garden: 'stego' });
    const spawns = trioSpawnPositions();
    const order = ['trike', 'stego', 'brachio'];
    for (const id of POV_ORDER) {
      const preset = POV_PRESETS[id];
      const length = IN_GAME_BODY_LENGTH_METRES[POV_FOCUS_SPECIES[id]];
      const spawn = spawns[order.indexOf(POV_FOCUS_SPECIES[id])];
      // Aimed at where that animal is placed, not at the ranch centre: aiming
      // at the centre let the animal on the lens side block the named one.
      expect(preset.lookAt[0]).toBeCloseTo(spawn.x, 10);
      expect(preset.lookAt[2]).toBeCloseTo(spawn.z, 10);
      expect(preset.lookAt[1]).toBeCloseTo(length / 2, 10);
    }
    // The three focus animals are three different species.
    expect(new Set(Object.values(POV_FOCUS_SPECIES)).size).toBe(3);
  });

  it('keeps the other two animals out of the line to the named one (AC-7)', () => {
    // A dino is roughly two metres across. If another species' spawn point
    // passes within that of the ray from a lens to its animal, a big animal
    // fills the frame and the preset stops framing the one it names.
    const BLOCKER_WIDTH_METRES = 2;
    const spawns = trioSpawnPositions();
    const order = ['trike', 'stego', 'brachio'];
    for (const id of POV_ORDER) {
      const lens = POV_PRESETS[id].position;
      const target = POV_PRESETS[id].lookAt;
      const dx = target[0] - lens[0];
      const dz = target[2] - lens[2];
      const length = Math.hypot(dx, dz);
      for (const species of order) {
        if (species === POV_FOCUS_SPECIES[id]) {
          continue;
        }
        const spawn = spawns[order.indexOf(species)];
        const wx = spawn.x - lens[0];
        const wz = spawn.z - lens[2];
        const along = (wx * dx + wz * dz) / (length * length);
        if (along <= 0 || along >= 1) {
          continue;
        }
        const lateral = Math.abs(wx * dz - wz * dx) / length;
        expect(lateral, `${species} blocks ${id}`).toBeGreaterThan(BLOCKER_WIDTH_METRES);
      }
    }
  });

  it('stands on its own bearing outside the ring props and inside the far plane', () => {
    // The ring is the mid and foreground bands; the treeline is staged out on
    // the apron on purpose (FR-6, FR-16), so it is judged by the sightline test
    // below rather than by this ring radius.
    const ringProps = DRESSING_MANIFEST.filter(
      (item) => DRESSING_CATALOGUE[item.file]?.band !== 'treeline',
    );
    const widestRingProp = Math.max(
      ...ringProps.map((item) => Math.hypot(item.position[0], item.position[2])),
    );
    for (const id of POV_ORDER) {
      const preset = POV_PRESETS[id];
      const distance = Math.hypot(preset.position[0], preset.position[2]);
      // The lens is never inside the circle a body centre wanders in.
      expect(distance).toBeGreaterThan(DINO_WALK_RADIUS_METRES * 2);
      // It stands beyond every prop of the ring it looks across, so nothing
      // grows between the lens and the animal it names...
      expect(distance).toBeGreaterThan(widestRingProp);
      // ...and the whole ranch still projects inside the near/far planes.
      expect(distance).toBeLessThan(CAMERA_FAR_METRES);
      // And the preset stands where its bearing says it does.
      const standing = bearingTo(preset.position[0], preset.position[2]);
      expect(angleDelta(standing, POV_BEARING_RADIANS[id])).toBeLessThan(1e-9);
      expect(preset.position[1]).toBeGreaterThan(0);
    }
  });

  it('keeps every prop off every preset sightline (FR-8, AC-7)', () => {
    // A prop is only in the way if it sits between a lens and the animal the
    // preset looks at, close enough to its centre line to cover it. Lateral
    // offsets are computed against the real placement data and the widest
    // footprint of each GLB, so a future layout change cannot reintroduce a
    // blocked POV.
    for (const id of POV_ORDER) {
      const lens = POV_PRESETS[id].position;
      const target = POV_PRESETS[id].lookAt;
      for (const item of DRESSING_MANIFEST) {
        const px = item.position[0];
        const pz = item.position[2];
        // The segment from the lens to the animal it names, in ground plan.
        const dx = target[0] - lens[0];
        const dz = target[2] - lens[2];
        const along = ((px - lens[0]) * dx + (pz - lens[2]) * dz) / (dx * dx + dz * dz);
        if (along <= 0 || along >= 1) {
          continue;
        }
        const lateral = Math.abs((px - lens[0]) * dz - (pz - lens[2]) * dx) / Math.hypot(dx, dz);
        const halfWidth = (DRESSING_FOOTPRINT_METRES[item.file] ?? 0) / 2;
        expect(lateral).toBeGreaterThan(halfWidth + SIGHTLINE_MARGIN_METRES);
      }
    }
  });

  it('spreads the three bearings far enough apart to be different views', () => {
    for (const first of POV_ORDER) {
      for (const second of POV_ORDER) {
        if (first === second) {
          continue;
        }
        const gap = angleDelta(POV_BEARING_RADIANS[first], POV_BEARING_RADIANS[second]);
        expect(gap).toBeGreaterThan(0.2);
      }
    }
    expect(WALK_CLEARANCE_METRES).toBeGreaterThan(DINO_WALK_RADIUS_METRES);
    expect(GROUND_RADIUS_METRES).toBeGreaterThan(WALK_CLEARANCE_METRES);
    // The avoidance guard must not drift from the loaders' measured length.
    expect(LARGEST_DINO_BODY_LENGTH_METRES).toBeCloseTo(IN_GAME_BODY_LENGTH_METRES.brachio, 3);
  });

  it('gives every preset a distinct camera position', () => {
    const positions = POV_ORDER.map((id) => POV_PRESETS[id].position.join(','));
    expect(new Set(positions).size).toBe(POV_ORDER.length);
  });

  it('cuts the camera to the preset instantly', () => {
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(9, 9, 9);
    applyPovPreset(camera, 'nest');
    expect(Array.from(camera.position.toArray())).toEqual([
      POV_PRESETS['nest'].position[0],
      POV_PRESETS['nest'].position[1],
      POV_PRESETS['nest'].position[2],
    ]);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const target = new THREE.Vector3(...POV_PRESETS['nest'].lookAt);
    const expected = target.sub(camera.position).normalize();
    expect(direction.distanceTo(expected)).toBeLessThan(1e-6);
  });
});

describe('hint glow idle timer', () => {
  it('waits 5s of no interaction before glowing', () => {
    expect(HINT_IDLE_MS).toBe(5000);
    expect(shouldShowHint(0, 4999)).toBe(false);
    expect(shouldShowHint(0, 5000)).toBe(true);
    expect(shouldShowHint(1000, 9000)).toBe(true);
  });

  it('uses a static outline when reduced motion is preferred', () => {
    expect(hintModeFor(false)).toBe('hint-glow');
    expect(hintModeFor(true)).toBe('hint-static');
  });
});

describe('viewport guards', () => {
  it('locks the viewport against pinch zoom', () => {
    expect(VIEWPORT_META_CONTENT).toContain('maximum-scale=1.0');
    expect(VIEWPORT_META_CONTENT).toContain('user-scalable=no');
  });

  it('detects portrait windows for the rotate hint', () => {
    expect(isPortraitViewport(1024, 768)).toBe(false);
    expect(isPortraitViewport(768, 1024)).toBe(true);
    expect(isPortraitViewport(800, 800)).toBe(false);
  });
});

describe('POV shell wiring', () => {
  it('ships the locked viewport, POV buttons, and rotate hint', async () => {
    const html = await readText('index.html');
    expect(html).toContain(VIEWPORT_META_CONTENT);
    expect(html).toContain('pov-ranch');
    expect(html).toContain('pov-nest');
    expect(html).toContain('pov-garden');
    expect(html).toContain('rotate-hint');
    expect(html).toContain('hint-glow');
    const touchTargets = html.match(/min-height: 72px/g) ?? [];
    expect(touchTargets.length).toBeGreaterThanOrEqual(2);
  });

  it('wires instant POV cuts, hint reset, and zoom guards in the viewer', async () => {
    const source = await readText('src/viewer/hud.ts');
    expect(source).toContain('applyPovPreset');
    expect(source).toContain('shouldShowHint');
    expect(source).toContain('isPortraitViewport');
    expect(source).toContain('gesturestart');
    expect(source).toContain('dblclick');
  });
});
