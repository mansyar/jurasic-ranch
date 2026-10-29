import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  HINT_IDLE_MS,
  POV_ORDER,
  POV_PRESETS,
  VIEWPORT_META_CONTENT,
  applyPovPreset,
  hintModeFor,
  isPortraitViewport,
  povPresetById,
  shouldShowHint,
} from '../../src/viewer/pov.js';

const ROOT_URL = new URL('../../', import.meta.url);

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, ROOT_URL), 'utf8');
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

  it('keeps the Ranch preset on the legacy fixed camera', () => {
    expect(POV_PRESETS['ranch'].position).toEqual([2.4, 1.5, 3.0]);
    expect(POV_PRESETS['ranch'].lookAt).toEqual([0, 0.45, 0]);
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
