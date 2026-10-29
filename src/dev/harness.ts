/**
 * Dev-only harness (FR-1..FR-8): a runtime-built panel that drives and inspects
 * the live ranch, plus `window.__ranch` for agents. Everything here is reached
 * through a `import.meta.env.DEV`-guarded dynamic import, so the production
 * bundle and `index.html` never carry a panel.
 *
 * The testable decisions live in `harness-state.ts` (no `three`, no DOM); this
 * module owns the DOM/three glue and the frame hook.
 */

import * as THREE from 'three';
import { TRIKE_GAIT, type DinoPlayer } from '../ranch/dino-player.js';
import type { DustPool } from '../ranch/dust.js';
import type { SleepyState } from '../ranch/sleepy.js';
import { AVOIDANCE_TRIGGER_METRES } from '../ranch/avoidance.js';
import { POV_ORDER, type PovPresetId } from '../viewer/pov.js';
import { type DevOptions, type DevSpeciesId } from './dev-options.js';
import {
  applySolo,
  nextPausedFrame,
  formatHud,
  overlayTransforms,
  DEV_STEP_DT_SECONDS,
} from './harness-state.js';
import { buildSnapshot, type DevSnapshot, type SnapshotDino } from './snapshot.js';

/** True activation flag; the harness is inert without `?dev=1`. */
export { parseDevQuery } from './dev-options.js';
/** Seeded RNG for `?dev=1&seed=`, reused by the viewer's construction path. */
export { seededRandom } from './seeded-random.js';
/** Per-consumer seeded streams (FR-8), reused by the viewer's construction path. */
export { seededStreams } from './harness-state.js';

/** Attribute marking the runtime panel root (Phase 3 scans `dist/` for it). */
export const DEV_PANEL_ATTRIBUTE = 'data-dev-panel';

/** Attribute marking the single injected stylesheet. */
export const DEV_PANEL_STYLE_ATTRIBUTE = 'data-dev-panel-style';

/**
 * Shared wander circle the trio steers inside, in metres. Derived from the
 * gait so the diagnostic ring can never drift from what the players obey
 * (F5); all three gaits share this radius (asserted in the panel tests).
 */
export const DEV_WANDER_RADIUS_METRES = TRIKE_GAIT.wanderRadiusMetres;

/** Pairwise avoidance trigger distance drawn per dino: the steering constant. */
export const DEV_AVOIDANCE_TRIGGER_METRES = AVOIDANCE_TRIGGER_METRES;

/** Particles per forced dust puff (matches a foot plant at full blend). */
const FORCED_DUST_PARTICLES = 4;

/** Viewports at or below this width boot the panel collapsed (NFR-2). */
const NARROW_VIEWPORT_PX = 720;

/** HUD repaint interval in seconds; the numbers never need 60 Hz updates. */
const HUD_UPDATE_SECONDS = 0.2;

/** Element id linking the collapse button to its body. */
const PANEL_BODY_ID = 'dev-panel-body';

/** One dino the panel can show, hide and inspect. */
export interface DevDinoHandle {
  id: DevSpeciesId;
  label: string;
  /** Current visible model: the placeholder until the GLB swap, then the rig. */
  getModel(): THREE.Object3D;
  /** Rigged player, or null while the placeholder is still on stage. */
  getPlayer(): DinoPlayer | null;
}

/**
 * Everything the harness needs from `bootViewer`. The mutators mirror the
 * kid-facing controls (Walk button, POV pills) so the panel never diverges.
 */
export interface DevBridge {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  dust: DustPool;
  dinos: DevDinoHandle[];
  getWalking(): boolean;
  setWalking(next: boolean): void;
  getPov(): PovPresetId;
  setPov(id: PovPresetId): void;
  forceSleepy(): void;
  forceHint(): void;
  getSleepyState(): SleepyState;
}

/** Per-frame hook: `dt` out is the delta the simulation may advance by. */
export type DevFrameHook = (dt: number, now: number) => number;

/** Machine-readable surface published as `window.__ranch` (FR-7). */
export interface DevRanchApi {
  snapshot(): DevSnapshot;
  show(id: DevSpeciesId, visible: boolean): void;
  solo(id: DevSpeciesId | null): void;
  setWalking(walking: boolean): void;
  pause(paused: boolean): void;
  step(frames: number): void;
  setPov(id: PovPresetId): void;
  blink(): void;
  dust(): void;
  sleepy(): void;
  hint(): void;
}

declare global {
  interface Window {
    /** Dev harness only; absent without `?dev=1` (FR-1, FR-10). */
    __ranch?: DevRanchApi;
  }
}

/** Panel stylesheet, injected once per install and removed on dispose. */
const DEV_PANEL_STYLE = `
[${DEV_PANEL_ATTRIBUTE}] {
  position: fixed;
  top: max(64px, calc(env(safe-area-inset-top, 0px) + 64px));
  right: 12px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: min(288px, calc(100vw - 24px));
  max-height: calc(100vh - 176px);
  overflow: auto;
  padding: 8px;
  border-radius: 14px;
  background: rgba(18, 30, 22, 0.92);
  color: #f4fff6;
  font: 13px/1.3 system-ui, sans-serif;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
}
[${DEV_PANEL_ATTRIBUTE}] button {
  min-width: 34px;
  min-height: 34px;
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  color: inherit;
  font: inherit;
  cursor: pointer;
}
[${DEV_PANEL_ATTRIBUTE}] button[aria-pressed="true"] {
  background: #8fe08f;
  border-color: #8fe08f;
  color: #10240f;
}
[${DEV_PANEL_ATTRIBUTE}] button:focus-visible {
  outline: 3px solid #ffd54f;
  outline-offset: 2px;
}
[${DEV_PANEL_ATTRIBUTE}] [data-dev-row] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
[${DEV_PANEL_ATTRIBUTE}] [data-dev-hud] {
  margin: 0;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
[${DEV_PANEL_ATTRIBUTE}][data-collapsed="true"] [data-dev-body] {
  display: none;
}
@media (max-width: ${NARROW_VIEWPORT_PX}px) {
  [${DEV_PANEL_ATTRIBUTE}] {
    top: auto;
    bottom: calc(max(24px, env(safe-area-inset-bottom, 0px)) + 88px);
    right: 8px;
    max-width: calc(100vw - 16px);
  }
}
`;

/** One live installation; a second install disposes the first (AC double-activation). */
let installed: { dispose(): void } | null = null;

/** Build a plain button: real focusable element, no div-with-role shortcuts. */
function createButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  return button;
}

/** Named button group so screen readers announce what a row controls. */
function createRow(label: string, buttons: HTMLButtonElement[]): HTMLDivElement {
  const row = document.createElement('div');
  row.setAttribute('data-dev-row', '');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', label);
  row.append(...buttons);
  return row;
}

/**
 * Diagnostic overlay group (FR-6): the shared wander circle, a per-dino
 * avoidance trigger ring and a heading arrow, all driven from live positions
 * and toggled as one unit.
 */
function createOverlays(bridge: DevBridge): {
  group: THREE.Group;
  update: (isVisible: (id: DevSpeciesId) => boolean) => void;
} {
  const group = new THREE.Group();
  group.name = 'DevOverlays';

  const wanderRing = new THREE.Mesh(
    new THREE.RingGeometry(DEV_WANDER_RADIUS_METRES - 0.01, DEV_WANDER_RADIUS_METRES, 64),
    new THREE.MeshBasicMaterial({
      color: 0x2f7d3b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  );
  wanderRing.name = 'DevWanderRing';
  wanderRing.rotation.x = -Math.PI / 2;
  wanderRing.position.y = 0.02;
  group.add(wanderRing);

  const perDino = bridge.dinos.map((dino) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(
        DEV_AVOIDANCE_TRIGGER_METRES - 0.008,
        DEV_AVOIDANCE_TRIGGER_METRES,
        32,
      ),
      new THREE.MeshBasicMaterial({
        color: 0xd94f4f,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    ring.name = `DevAvoidanceRing:${dino.id}`;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    group.add(ring);
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(),
      0.6,
      0xffd54f,
      0.16,
      0.1,
    );
    arrow.name = `DevHeadingArrow:${dino.id}`;
    group.add(arrow);
    return { ring, arrow };
  });

  return {
    group,
    update: (isVisible: (id: DevSpeciesId) => boolean): void => {
      // The projection is pure (FR-6, AC-7); this loop only writes the three
      // transforms it returns, keyed by id so a filtered-out dino leaves its
      // ring and arrow off.
      const transforms = overlayTransforms(
        bridge.dinos.map((dino) => {
          const model = dino.getModel();
          return {
            id: dino.id,
            visible: isVisible(dino.id),
            x: model.position.x,
            z: model.position.z,
            heading: dino.getPlayer()?.heading ?? 0,
          };
        }),
      );
      const byId = new Map(transforms.map((transform) => [transform.id, transform]));
      bridge.dinos.forEach((dino, index) => {
        const { ring, arrow } = perDino[index];
        const transform = byId.get(dino.id);
        ring.visible = transform !== undefined;
        arrow.visible = transform !== undefined;
        if (transform === undefined) {
          return;
        }
        ring.position.x = transform.ringX;
        ring.position.z = transform.ringZ;
        arrow.position.set(transform.ringX, 0.05, transform.ringZ);
        arrow.rotation.y = transform.arrowYaw;
      });
    },
  };
}

/** Free the overlay geometries/materials (the panel is DOM, removed whole). */
function disposeOverlays(group: THREE.Group, scene: THREE.Scene): void {
  scene.remove(group);
  group.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        for (const material of child.material) {
          material.dispose();
        }
      } else {
        child.material.dispose();
      }
    }
  });
}

/**
 * Install the panel, overlays and `window.__ranch`, returning the frame hook.
 * A second install replaces the previous panel and listeners instead of
 * stacking a duplicate. Callers only reach this when `?dev=1` is present.
 */
export function installDevHarness(bridge: DevBridge, options: DevOptions): DevFrameHook {
  installed?.dispose();

  const ids = bridge.dinos.map((dino) => dino.id);
  const visibility = applySolo(options.solo, ids);
  let paused = options.paused;
  let stepFrames = 0;
  let overlaysVisible = options.overlays;
  let fps = 0;
  let lastHudSeconds = Number.NEGATIVE_INFINITY;

  const style = document.createElement('style');
  style.setAttribute(DEV_PANEL_STYLE_ATTRIBUTE, '');
  style.textContent = DEV_PANEL_STYLE;
  document.head.append(style);

  const panel = document.createElement('div');
  panel.setAttribute(DEV_PANEL_ATTRIBUTE, '');
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Dev harness');

  const startCollapsed = window.innerWidth <= NARROW_VIEWPORT_PX;
  panel.setAttribute('data-collapsed', startCollapsed ? 'true' : 'false');

  const toggleButton = createButton('Dev');
  toggleButton.setAttribute('aria-controls', PANEL_BODY_ID);
  toggleButton.setAttribute('aria-expanded', startCollapsed ? 'false' : 'true');
  const body = document.createElement('div');
  body.id = PANEL_BODY_ID;
  body.setAttribute('data-dev-body', '');

  const setCollapsed = (collapsed: boolean): void => {
    panel.setAttribute('data-collapsed', collapsed ? 'true' : 'false');
    toggleButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggleButton.textContent = collapsed ? 'Dev ▸' : 'Dev ▾';
  };
  setCollapsed(startCollapsed);
  toggleButton.addEventListener('click', () => {
    setCollapsed(panel.getAttribute('data-collapsed') !== 'true');
  });

  const applyVisibility = (): void => {
    for (const dino of bridge.dinos) {
      const model = dino.getModel();
      const shown = visibility[dino.id];
      if (model.visible !== shown) {
        model.visible = shown;
      }
    }
  };

  // FR-2: species buttons toggle exactly their own dino (AC-2)...
  const visibilityButtons = new Map<DevSpeciesId, HTMLButtonElement>();
  const visibilityRowButtons: HTMLButtonElement[] = [];
  for (const dino of bridge.dinos) {
    const button = createButton(dino.label);
    button.setAttribute('data-dev-show', dino.id);
    visibilityButtons.set(dino.id, button);
    visibilityRowButtons.push(button);
  }

  // ...and the one-tap presets live in their own group, so a solo press never
  // doubles as an independent toggle.
  const soloButtons = new Map<DevSpeciesId | 'all', HTMLButtonElement>();
  const allButton = createButton('All');
  soloButtons.set('all', allButton);
  const soloRowButtons = [allButton];
  for (const dino of bridge.dinos) {
    const button = createButton(dino.label);
    soloButtons.set(dino.id, button);
    soloRowButtons.push(button);
  }

  const syncVisibilityButtons = (): void => {
    for (const [id, button] of visibilityButtons) {
      button.setAttribute('aria-pressed', visibility[id] ? 'true' : 'false');
    }
  };

  const syncSoloButtons = (): void => {
    const visibleIds = bridge.dinos.filter((dino) => visibility[dino.id]).map((dino) => dino.id);
    allButton.setAttribute(
      'aria-pressed',
      visibleIds.length === bridge.dinos.length ? 'true' : 'false',
    );
    for (const dino of bridge.dinos) {
      const alone = visibleIds.length === 1 && visibleIds[0] === dino.id;
      soloButtons.get(dino.id)?.setAttribute('aria-pressed', alone ? 'true' : 'false');
    }
  };

  const setSolo = (solo: DevSpeciesId | null): void => {
    Object.assign(visibility, applySolo(solo, ids));
    applyVisibility();
    syncVisibilityButtons();
    syncSoloButtons();
  };

  const showDino = (id: DevSpeciesId, visible: boolean): void => {
    visibility[id] = visible;
    applyVisibility();
    syncVisibilityButtons();
    syncSoloButtons();
  };

  for (const [id, button] of visibilityButtons) {
    button.addEventListener('click', () => {
      showDino(id, !visibility[id]);
    });
  }
  for (const [key, button] of soloButtons) {
    button.addEventListener('click', () => {
      setSolo(key === 'all' ? null : key);
    });
  }

  const pauseButton = createButton('Pause');
  const stepOne = createButton('Step 1');
  const stepTen = createButton('Step 10');

  const syncPauseButton = (): void => {
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    pauseButton.setAttribute('aria-pressed', paused ? 'true' : 'false');
  };
  const setPaused = (next: boolean): void => {
    paused = next;
    if (paused) {
      stepFrames = 0;
    }
    syncPauseButton();
  };
  const queueStep = (frames: number): void => {
    paused = true;
    stepFrames += Math.max(0, Math.floor(frames));
    syncPauseButton();
  };
  pauseButton.addEventListener('click', () => {
    setPaused(!paused);
  });
  stepOne.addEventListener('click', () => {
    queueStep(1);
  });
  stepTen.addEventListener('click', () => {
    queueStep(10);
  });

  // Visual readout only: a 5 Hz `aria-live` region would flood a screen
  // reader, so the numbers are never announced (F6).
  const hud = document.createElement('p');
  hud.setAttribute('data-dev-hud', '');
  hud.textContent = formatHud(0, 0, 0);

  const forceBlink = (): void => {
    for (const dino of bridge.dinos) {
      dino.getPlayer()?.forceBlink();
    }
  };
  const forceDust = (): void => {
    const centre = new THREE.Vector3();
    let count = 0;
    for (const dino of bridge.dinos) {
      if (!visibility[dino.id]) {
        continue;
      }
      const position = dino.getModel().position;
      centre.x += position.x;
      centre.z += position.z;
      count += 1;
    }
    if (count > 0) {
      centre.multiplyScalar(1 / count);
    }
    centre.y = 0.03;
    bridge.dust.puff(centre, FORCED_DUST_PARTICLES);
  };

  const blinkButton = createButton('Blink');
  const dustButton = createButton('Dust');
  const sleepyButton = createButton('Sleepy');
  const hintButton = createButton('Hint');
  blinkButton.addEventListener('click', forceBlink);
  dustButton.addEventListener('click', forceDust);
  sleepyButton.addEventListener('click', () => {
    bridge.forceSleepy();
  });
  hintButton.addEventListener('click', () => {
    bridge.forceHint();
  });

  const povButtons = POV_ORDER.map((id) => {
    const button = createButton(id.charAt(0).toUpperCase() + id.slice(1));
    button.setAttribute('data-dev-pov', id);
    button.addEventListener('click', () => {
      setPov(id);
    });
    return button;
  });
  const syncPovButtons = (): void => {
    const active = bridge.getPov();
    for (const button of povButtons) {
      button.setAttribute(
        'aria-pressed',
        button.getAttribute('data-dev-pov') === active ? 'true' : 'false',
      );
    }
  };
  const setPov = (id: PovPresetId): void => {
    bridge.setPov(id);
    syncPovButtons();
  };

  const overlaysButton = createButton('Overlays');
  const syncOverlaysButton = (): void => {
    overlaysButton.setAttribute('aria-pressed', overlaysVisible ? 'true' : 'false');
  };
  overlaysButton.addEventListener('click', () => {
    overlaysVisible = !overlaysVisible;
    overlayGroup.group.visible = overlaysVisible;
    syncOverlaysButton();
  });

  body.append(
    createRow('Dino visibility', visibilityRowButtons),
    createRow('Solo', soloRowButtons),
    createRow('Simulation', [pauseButton, stepOne, stepTen]),
    hud,
    createRow('Forced states', [blinkButton, dustButton, sleepyButton, hintButton]),
    createRow('Viewpoint', povButtons),
    createRow('Diagnostics', [overlaysButton]),
  );
  panel.append(toggleButton, body);
  document.body.append(panel);

  const overlayGroup = createOverlays(bridge);
  overlayGroup.group.visible = overlaysVisible;
  bridge.scene.add(overlayGroup.group);

  const snapshot = (): DevSnapshot => {
    const dinos: SnapshotDino[] = bridge.dinos.map((dino) => {
      const model = dino.getModel();
      const player = dino.getPlayer();
      return {
        id: dino.id,
        label: dino.label,
        visible: visibility[dino.id],
        rigged: player !== null,
        x: model.position.x,
        z: model.position.z,
        // Placeholders keep an authored -90 deg yaw, so their heading is 0
        // until the rigged player takes over.
        heading: player?.heading ?? 0,
        walking: player?.walking ?? bridge.getWalking(),
      };
    });
    return buildSnapshot({
      walking: bridge.getWalking(),
      paused,
      pov: bridge.getPov(),
      sleepy: bridge.getSleepyState(),
      fps,
      dinos,
    });
  };

  const api: DevRanchApi = {
    snapshot,
    show: showDino,
    solo: setSolo,
    setWalking: (walking: boolean) => {
      bridge.setWalking(walking);
    },
    pause: setPaused,
    step: queueStep,
    setPov,
    blink: forceBlink,
    dust: forceDust,
    sleepy: () => {
      bridge.forceSleepy();
    },
    hint: () => {
      bridge.forceHint();
    },
  };
  window.__ranch = api;

  applyVisibility();
  syncVisibilityButtons();
  syncSoloButtons();
  syncPauseButton();
  syncPovButtons();
  syncOverlaysButton();

  const frame: DevFrameHook = (dt: number, now: number): number => {
    if (Number.isFinite(dt) && dt > 0) {
      const instant = 1 / dt;
      fps = fps <= 0 ? instant : fps * 0.9 + instant * 0.1;
    }
    // Re-apply every frame: a placeholder -> GLB swap resets `visible`.
    applyVisibility();
    overlayGroup.group.visible = overlaysVisible;
    if (overlaysVisible) {
      overlayGroup.update((id) => visibility[id]);
    }
    if (now - lastHudSeconds >= HUD_UPDATE_SECONDS) {
      lastHudSeconds = now;
      const info = bridge.renderer.info.render;
      hud.textContent = formatHud(fps, info.calls, info.triangles);
    }
    const decision = nextPausedFrame(paused, stepFrames);
    stepFrames = decision.stepFrames;
    if (!decision.advance) {
      return 0;
    }
    // Stepped frames use a fixed delta so captures are wall-clock independent.
    return paused ? DEV_STEP_DT_SECONDS : dt;
  };

  const dispose = (): void => {
    panel.remove();
    style.remove();
    disposeOverlays(overlayGroup.group, bridge.scene);
    if (window.__ranch === api) {
      delete window.__ranch;
    }
    if (installed === handle) {
      installed = null;
    }
  };
  const handle = { dispose };
  installed = handle;

  return frame;
}
