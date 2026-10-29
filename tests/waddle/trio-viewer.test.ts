import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { trioSpawnPositions } from '../../src/ranch/avoidance.js';
import { BRACHIO_GAIT, DinoPlayer, STEGO_GAIT, TRIKE_GAIT } from '../../src/ranch/dino-player.js';
import { DustPool } from '../../src/ranch/dust.js';
import { WADDLE_LOOP_SECONDS } from '../../src/ranch/waddle.js';
import { walkStatusText } from '../../src/viewer/hud.js';
import {
  AUTHORED_BODY_LENGTH_METRES,
  BRACHIO_MODEL_URL,
  DINO_GROUP_SCALE,
  IN_GAME_BODY_LENGTH_METRES,
  loadBrachioPlayer,
  loadStegoPlayer,
  loadTrikePlayer,
  type LoadedDino,
} from '../../src/viewer/loaders.js';
import {
  setAllWalking,
  steerTrioApart,
  TRIO_SPAWN_HEADINGS_RADIANS,
} from '../../src/viewer/loop.js';
import {
  BRACHIO_BODY_HEX,
  createPlaceholderBrachio,
  createPlaceholderStego,
  createPlaceholderTrike,
  PLACEHOLDER_BODY_HEX,
  PLACEHOLDER_BODY_NAME,
  STEGO_BODY_HEX,
  STEGO_PLATE_HEX,
  updatePlaceholderWalk,
} from '../../src/viewer/placeholders.js';

const ROOT_URL = new URL('../../', import.meta.url);

/** Loader-boundary stubs: the tests below never touch WebGL or the network. */
const loaderMocks = vi.hoisted(() => ({
  loadAsync: vi.fn(),
  setDRACOLoader: vi.fn(),
  setDecoderPath: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn(function (this: unknown) {
    return {
      loadAsync: loaderMocks.loadAsync,
      setDRACOLoader: loaderMocks.setDRACOLoader,
    };
  }),
}));

vi.mock('three/addons/loaders/DRACOLoader.js', () => ({
  DRACOLoader: vi.fn(function (this: unknown) {
    return {
      setDecoderPath: loaderMocks.setDecoderPath,
      dispose: loaderMocks.dispose,
    };
  }),
}));

async function readText(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, ROOT_URL), 'utf8');
}

function bodyOf(brachio: THREE.Group): THREE.Object3D {
  return brachio.getObjectByName(PLACEHOLDER_BODY_NAME) ?? brachio;
}

function createRig(name: string): THREE.Group {
  const root = new THREE.Group();
  root.name = name;
  const hips = new THREE.Group();
  hips.name = 'Hips';
  root.add(hips);
  return root;
}

function createWaddleClip(loopSeconds: number): THREE.AnimationClip {
  const track = new THREE.VectorKeyframeTrack(
    'Hips.position',
    [0, loopSeconds / 2, loopSeconds],
    [0, 0, 0, 0, 0.05, 0, 0, 0, 0],
  );
  return new THREE.AnimationClip('Waddle', loopSeconds, [track]);
}

describe('placeholder brachio fallback (FR-8, AC-5)', () => {
  it('reserves the brachio model URL beside the trike and stego ones', () => {
    expect(BRACHIO_MODEL_URL).toBe('/models/brachio.glb');
  });

  it('stands boxy and grazing on the ground plane at the rigged length', () => {
    const brachio = createPlaceholderBrachio();
    expect(brachio.name).toContain('Brachio');
    expect(brachio.children.length).toBeGreaterThan(0);
    const box = new THREE.Box3().setFromObject(brachio);
    expect(Math.abs(box.min.y)).toBeLessThan(1e-6);
    const size = box.getSize(new THREE.Vector3());
    // Phase 4 sized the rigged model at 7.423 m; the boxy stand-in is the same
    // length now, so the swap is a shape change and not also a 2.66x pop.
    expect(size.z).toBeCloseTo(IN_GAME_BODY_LENGTH_METRES.brachio, 3);
    expect(brachio.rotation.y).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('stays squat: no taller than half its own length', () => {
    // The old "head near the 1.2 m cap" window described a 2.79 m toy. At the
    // rigged size the cap that still means something is proportion, not metres:
    // the stand-in must stay a low, child-readable shape...
    const box = new THREE.Box3().setFromObject(createPlaceholderBrachio());
    expect(box.max.y).toBeLessThan(IN_GAME_BODY_LENGTH_METRES.brachio / 2);
    // ...and shorter than the rigged animal, so it never grows on the swap.
    expect(box.max.y).toBeGreaterThan(IN_GAME_BODY_LENGTH_METRES.brachio / 4);
  });

  it('reads as a Brachio, not a third Trike or Stego: lavender hide, no green or teal', () => {
    const brachio = createPlaceholderBrachio();
    const hexes = new Set<number>();
    brachio.traverse((child: THREE.Object3D) => {
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (mesh.isMesh === true && material?.color !== undefined) {
        hexes.add(material.color.getHex());
      }
    });
    expect(hexes.has(BRACHIO_BODY_HEX)).toBe(true);
    expect(hexes.has(PLACEHOLDER_BODY_HEX)).toBe(false);
    expect(hexes.has(STEGO_BODY_HEX)).toBe(false);
    expect(hexes.has(STEGO_PLATE_HEX)).toBe(false);
  });

  it('lands every stand-in at the rigged length, so no swap changes size (FR-4)', () => {
    const cases = [
      [createPlaceholderTrike(), IN_GAME_BODY_LENGTH_METRES.trike],
      [createPlaceholderStego(), IN_GAME_BODY_LENGTH_METRES.stego],
      [createPlaceholderBrachio(), IN_GAME_BODY_LENGTH_METRES.brachio],
    ] as const;
    for (const [group, length] of cases) {
      const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
      // Each stand-in faces +Z after its rotation, so z is its length.
      expect(Math.max(size.x, size.z)).toBeCloseTo(length, 3);
      expect(size.y).toBeLessThan(length);
    }
  });

  it('shares the seamless placeholder bob with the other two', () => {
    const a = createPlaceholderBrachio();
    const b = createPlaceholderBrachio();
    updatePlaceholderWalk(a, 0);
    updatePlaceholderWalk(b, WADDLE_LOOP_SECONDS);
    expect(bodyOf(a).position.y).toBe(0);
    expect(bodyOf(a).position.y).toBe(bodyOf(b).position.y);
  });
});

describe('rigged brachio loader (FR-1, FR-4, FR-9)', () => {
  beforeEach(() => {
    loaderMocks.loadAsync.mockReset();
    loaderMocks.setDRACOLoader.mockReset();
    loaderMocks.setDecoderPath.mockReset();
    loaderMocks.dispose.mockReset();
  });

  it('requests /models/brachio.glb through the same bundled decoder', async () => {
    const scene = new THREE.Group();
    const clip = new THREE.AnimationClip('Waddle', 1.0, []);
    loaderMocks.loadAsync.mockResolvedValue({ scene, animations: [clip] });
    const loaded = await loadBrachioPlayer();
    expect(loaderMocks.loadAsync).toHaveBeenCalledWith('/models/brachio.glb');
    expect(loaderMocks.setDecoderPath).not.toHaveBeenCalled();
    expect(loaderMocks.setDRACOLoader).toHaveBeenCalledTimes(1);
    expect(loaded.model).toBe(scene);
    expect(loaded.player).toBeInstanceOf(DinoPlayer);
    expect(loaded.player.clipDurationSeconds).toBeCloseTo(1.0, 5);
  });

  it('prefers the Waddle clip over other animations', async () => {
    loaderMocks.loadAsync.mockResolvedValue({
      scene: new THREE.Group(),
      animations: [
        new THREE.AnimationClip('Idle', 1.4, []),
        new THREE.AnimationClip('Waddle', 1.0, []),
      ],
    });
    const loaded = await loadBrachioPlayer();
    expect(loaded.player.clipDurationSeconds).toBeCloseTo(1.0, 5);
  });

  it('picks the authored Walk clip, not the first animation in the file', async () => {
    // The re-baked Brachio ships Idle first; the walk loop is 3.8 s (FR-1, AC-1).
    loaderMocks.loadAsync.mockResolvedValue({
      scene: new THREE.Group(),
      animations: [
        new THREE.AnimationClip('Idle', 8, []),
        new THREE.AnimationClip('Walk', 3.8, []),
      ],
    });
    const loaded = await loadBrachioPlayer();
    expect(loaded.player.clipDurationSeconds).toBeCloseTo(3.8, 5);
  });

  it('refuses a GLB that carries no walk clip rather than guessing at one', async () => {
    loaderMocks.loadAsync.mockResolvedValue({
      scene: new THREE.Group(),
      animations: [new THREE.AnimationClip('Idle', 8, [])],
    });
    await expect(loadBrachioPlayer()).rejects.toThrow('no walk clip');
  });

  it('shares one DustPool across all three players', async () => {
    const shared = new DustPool({ random: () => 0.5 });
    loaderMocks.loadAsync.mockResolvedValue({
      scene: new THREE.Group(),
      animations: [new THREE.AnimationClip('Waddle', 0.8, [])],
    });
    const trike = await loadTrikePlayer(shared);
    const stego = await loadStegoPlayer(shared);
    loaderMocks.loadAsync.mockResolvedValue({
      scene: new THREE.Group(),
      animations: [new THREE.AnimationClip('Waddle', 1.0, [])],
    });
    const brachio = await loadBrachioPlayer(shared);
    expect(trike.player.dust).toBe(shared);
    expect(stego.player.dust).toBe(shared);
    expect(brachio.player.dust).toBe(shared);
  });

  it('rejects when the brachio GLB cannot load so the placeholder stays', async () => {
    loaderMocks.loadAsync.mockRejectedValue(new Error('offline'));
    await expect(loadBrachioPlayer()).rejects.toThrow('offline');
  });

  it('rejects when the brachio GLB carries no animations', async () => {
    loaderMocks.loadAsync.mockResolvedValue({ scene: new THREE.Group(), animations: [] });
    await expect(loadBrachioPlayer()).rejects.toThrow('Waddle');
  });
});

describe('per-species in-game size (FR-4, AC-4)', () => {
  it('derives S from the Trike the child already knows and keeps it uniform', () => {
    // S = 3.708 m (shipped trike.glb) / 6.26 m (Polyfork adult reference).
    expect(DINO_GROUP_SCALE).toBeCloseTo(3.708 / 6.26, 12);
    expect(DINO_GROUP_SCALE).toBeGreaterThan(0.55);
    expect(DINO_GROUP_SCALE).toBeLessThan(0.65);
    // Real-life ratios survive the shrink: Stego/Trike 1.04, Brachio/Trike 2.00.
    expect(IN_GAME_BODY_LENGTH_METRES.trike).toBeCloseTo(3.708, 6);
    expect(IN_GAME_BODY_LENGTH_METRES.stego / IN_GAME_BODY_LENGTH_METRES.trike).toBeCloseTo(
      1.04,
      2,
    );
    expect(IN_GAME_BODY_LENGTH_METRES.brachio / IN_GAME_BODY_LENGTH_METRES.trike).toBeCloseTo(
      2.0,
      2,
    );
    // ... and every one is the authored length times the same single scale.
    expect(IN_GAME_BODY_LENGTH_METRES.stego).toBeCloseTo(
      AUTHORED_BODY_LENGTH_METRES.stego * DINO_GROUP_SCALE,
      9,
    );
    expect(IN_GAME_BODY_LENGTH_METRES.brachio).toBeCloseTo(
      AUTHORED_BODY_LENGTH_METRES.brachio * DINO_GROUP_SCALE,
      9,
    );
  });

  it('applies one scalar to the loaded group: uniform, and 1 for the Trike', async () => {
    const scene = new THREE.Group();
    loaderMocks.loadAsync.mockResolvedValue({
      scene,
      animations: [new THREE.AnimationClip('Waddle', 1.0, [])],
    });
    const loaded = await loadStegoPlayer();
    expect(loaded.model.scale.toArray()).toEqual([
      DINO_GROUP_SCALE,
      DINO_GROUP_SCALE,
      DINO_GROUP_SCALE,
    ]);
    // The player captured the scaled group as its squash base, so the walk
    // squash multiplies this scale rather than replacing it.
    loaded.player.update(1 / 60, 0);
    expect(loaded.model.scale.x).toBeCloseTo(DINO_GROUP_SCALE, 12);
    expect(loaded.model.scale.z).toBeCloseTo(DINO_GROUP_SCALE, 12);

    const trikeScene = new THREE.Group();
    loaderMocks.loadAsync.mockResolvedValue({
      scene: trikeScene,
      animations: [new THREE.AnimationClip('Waddle', 0.8, [])],
    });
    const trike = await loadTrikePlayer();
    expect(trike.model.scale.toArray()).toEqual([1, 1, 1]);
  });
});

describe('single Walk toggles all three dinos (FR-7, AC-4)', () => {
  it('flips every player together and never splits the trio', () => {
    const players = [TRIKE_GAIT, STEGO_GAIT, BRACHIO_GAIT].map(
      (gait, index) =>
        new DinoPlayer(createRig(`Root${index}`), {
          clip: createWaddleClip(gait.loopSeconds),
          gait,
        }),
    );
    setAllWalking(players, true);
    for (const player of players) {
      expect(player.walking).toBe(true);
    }
    setAllWalking(players, false);
    for (const player of players) {
      expect(player.walking).toBe(false);
    }
  });

  it('names all three species with icon + word while walking, keeps the stopped text', () => {
    expect(walkStatusText(true)).toContain('Trike');
    expect(walkStatusText(true)).toContain('Stego');
    expect(walkStatusText(true)).toContain('Brachio');
    expect(walkStatusText(true)).toContain('🦕');
    expect(walkStatusText(true)).toContain('🦖');
    expect(walkStatusText(true)).toContain('🦒');
    expect(walkStatusText(false)).toBe('Tap Walk to waddle');
  });

  it('ships staggered-entry spawn headings, one per dino', () => {
    expect(TRIO_SPAWN_HEADINGS_RADIANS).toHaveLength(3);
    for (const heading of TRIO_SPAWN_HEADINGS_RADIANS) {
      expect(Number.isFinite(heading)).toBe(true);
    }
    const [first, second, third] = TRIO_SPAWN_HEADINGS_RADIANS;
    expect(first).not.toBe(second);
    expect(second).not.toBe(third);
    expect(first).not.toBe(third);
  });
});

describe('trio steering wiring (FR-6, AC-3)', () => {
  it('steers a crowded trio apart without stopping any dino', () => {
    const rigs = [createRig('TrikeRoot'), createRig('StegoRoot'), createRig('BrachioRoot')];
    const gaits = [TRIKE_GAIT, STEGO_GAIT, BRACHIO_GAIT];
    const players = rigs.map(
      (rig, index) =>
        new DinoPlayer(rig, {
          clip: createWaddleClip(gaits[index].loopSeconds),
          gait: gaits[index],
          random: () => 0.5,
        }),
    );
    rigs[0].position.set(-0.15, 0, 0);
    rigs[1].position.set(0.15, 0, 0);
    rigs[2].position.set(0, 0, 0.25);
    players[0].turnTo(Math.PI / 2);
    players[1].turnTo(-Math.PI / 2);
    players[2].turnTo(Math.PI);
    setAllWalking(players, true);
    for (let i = 0; i < 30; i += 1) {
      steerTrioApart(players[0], rigs[0], players[1], rigs[1], players[2], rigs[2]);
      players.forEach((player) => {
        player.update(1 / 60, i / 60);
        expect(player.walking).toBe(true);
      });
    }
    // The head-on pair biased off its line: headings no longer mirror exactly.
    expect(Math.abs(players[0].heading - Math.PI / 2)).toBeGreaterThan(0.01);
    expect(Math.abs(players[1].heading + Math.PI / 2)).toBeGreaterThan(0.01);
    for (const [first, second] of [
      [rigs[0], rigs[1]],
      [rigs[1], rigs[2]],
      [rigs[0], rigs[2]],
    ] as const) {
      expect(first.position.distanceTo(second.position)).toBeGreaterThan(0.15);
    }
  });

  it('leaves a far-apart trio on course', () => {
    const rigs = [createRig('TrikeRoot'), createRig('StegoRoot'), createRig('BrachioRoot')];
    const gaits = [TRIKE_GAIT, STEGO_GAIT, BRACHIO_GAIT];
    const players = rigs.map(
      (rig, index) =>
        new DinoPlayer(rig, {
          clip: createWaddleClip(gaits[index].loopSeconds),
          gait: gaits[index],
          random: () => 0.5,
        }),
    );
    rigs[0].position.set(-2, 0, 0);
    rigs[1].position.set(2, 0, 0);
    rigs[2].position.set(0, 0, 2);
    steerTrioApart(players[0], rigs[0], players[1], rigs[1], players[2], rigs[2]);
    expect(players[0].heading).toBe(0);
    expect(players[1].heading).toBe(0);
    expect(players[2].heading).toBe(0);
  });

  it('spawns the trio on the avoidance triangle, not the old pair line', () => {
    const spawn = trioSpawnPositions();
    expect(spawn).toHaveLength(3);
    for (const point of spawn) {
      // Triangle vertices sit off the x-axis pair line.
      expect(Math.abs(point.z)).toBeGreaterThan(0.01);
    }
  });
});

describe('trio ranch shell (NFR-4, FR-7, FR-8, FR-9)', () => {
  it('labels all three species with icon + word in the UI', async () => {
    const html = await readText('index.html');
    expect(html).toContain('Trike');
    expect(html).toContain('Stego');
    expect(html).toContain('Brachio');
    expect(html).toContain('🦕');
    expect(html).toContain('🦖');
    expect(html).toContain('🦒');
  });

  it('keeps one 72 px Walk button with pressed + status wiring', async () => {
    const html = await readText('index.html');
    const buttons = html.match(/id="walk-button"/g) ?? [];
    expect(buttons.length).toBe(1);
    expect(html).toContain('min-height: 72px');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('id="status"');
    const source = await readText('src/viewer/hud.ts');
    expect(source).toContain('aria-pressed');
  });

  it('constructs a single shared DustPool for all three players', async () => {
    const source = (
      await Promise.all(
        ['main.ts', 'loaders.ts', 'loop.ts'].map((file) => readText(`src/viewer/${file}`)),
      )
    ).join('\n');
    const constructions = source.match(/new DustPool\(/g) ?? [];
    expect(constructions.length).toBe(1);
    expect(source).toContain('loadBrachioPlayer');
    expect(source).toContain('BRACHIO_GAIT');
    expect(source).toContain('trioAvoidanceNudges');
  });

  it('adds no new player class: only DinoPlayer drives all three gaits', async () => {
    const source = (
      await Promise.all(
        ['main.ts', 'loaders.ts', 'loop.ts'].map((file) => readText(`src/viewer/${file}`)),
      )
    ).join('\n');
    expect(source).not.toMatch(/class BrachioPlayer/);
    expect(source).not.toMatch(/class TrikePlayer/);
    expect(source).not.toMatch(/class StegoPlayer/);
  });

  it('warns and keeps walking when the brachio GLB fails', async () => {
    const source = await readText('src/viewer/main.ts');
    expect(source).toContain('Rigged brachio unavailable; keeping the placeholder.');
  });
});

describe('world stride at the loader boundary (FR-5, AC-5)', () => {
  const DT = 1 / 60;

  /** Summed per-frame path length over two seconds, after the 0.2 s blend. */
  function walkedSpeedMetresPerSecond(loaded: LoadedDino): number {
    loaded.model.position.set(0, 0, 0);
    loaded.player.setWalking(true);
    let now = 0;
    for (let frame = 0; frame < 60; frame += 1) {
      now += DT;
      loaded.player.update(DT, now);
    }
    let travelled = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      const before = loaded.model.position.clone();
      now += DT;
      loaded.player.update(DT, now);
      travelled += loaded.model.position.distanceTo(before);
    }
    return travelled / 2;
  }

  it('walks the loaded Stego at the stride its clip plays on the scaled group', async () => {
    // The round-1 defect lived at the one place gait meets player: the stride
    // was authored metres while the root advanced world metres, so the feet
    // covered 1.059 m per 2.4 s loop while the body moved 1.788 m. This test
    // never calls worldGait - it walks the loaded player and times it, so
    // dropping the conversion at the call site fails here.
    loaderMocks.loadAsync.mockResolvedValue({
      scene: new THREE.Group(),
      animations: [new THREE.AnimationClip('Walk', 2.4, [])],
    });
    const stego = await loadStegoPlayer();
    const speed = walkedSpeedMetresPerSecond(stego);
    expect(speed).toBeCloseTo(0.4413, 2);
    // The authored stride would read 0.745 m/s: 0.30 m/s of skating.
    expect(speed).toBeLessThan(0.6);
  });

  it('leaves the Trike at its own stride, because it is drawn at scale 1', async () => {
    loaderMocks.loadAsync.mockResolvedValue({
      scene: new THREE.Group(),
      animations: [new THREE.AnimationClip('Waddle', 0.8, [])],
    });
    const trike = await loadTrikePlayer();
    expect(walkedSpeedMetresPerSecond(trike)).toBeCloseTo(0.3625, 2);
  });
});
