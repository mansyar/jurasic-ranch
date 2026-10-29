import * as THREE from 'three';

/**
 * Cheap dust puffs (FR-7): one preallocated THREE.Points draw call, a fixed
 * particle budget, a procedural sprite texture, and zero extra render passes.
 */

export const DUST_POOL_SIZE = 48;
export const DUST_LIFETIME_SECONDS = 0.6;
export const DUST_RISE_METRES_PER_SECOND = 0.35;
export const DUST_POINT_SIZE = 0.12;

/** Parking altitude for dead particles (far below the ground, never seen). */
const PARKED_Y = -999;

export interface DustPoolOptions {
  texture?: THREE.Texture;
  random?: () => number;
}

/**
 * Procedural soft-dot sprite baked into a DataTexture: no canvas, no DOM,
 * no asset file — works headlessly in unit tests and offline on the tablet.
 */
export function createDustTexture(size = 64): THREE.Texture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const falloff = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2);
      const i = (y * size + x) * 4;
      data[i] = 214;
      data[i + 1] = 200;
      data[i + 2] = 175;
      data[i + 3] = Math.round(falloff * falloff * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

/** Fixed-budget dust particle pool rendered as a single THREE.Points. */
export class DustPool {
  readonly points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private velocities: Float32Array;
  private ages: Float32Array;
  private cursor = 0;
  private random: () => number;

  constructor(options: DustPoolOptions = {}) {
    this.positions = new Float32Array(DUST_POOL_SIZE * 3);
    this.velocities = new Float32Array(DUST_POOL_SIZE * 3);
    this.ages = new Float32Array(DUST_POOL_SIZE).fill(-1);
    for (let i = 0; i < DUST_POOL_SIZE; i += 1) {
      this.positions[i * 3 + 1] = PARKED_Y;
    }
    this.random = options.random ?? Math.random;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const material = new THREE.PointsMaterial({
      size: DUST_POINT_SIZE,
      map: options.texture ?? createDustTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
  }

  /** Live particle count; always within 0..DUST_POOL_SIZE. */
  get aliveCount(): number {
    let live = 0;
    for (const age of this.ages) {
      if (age >= 0) {
        live += 1;
      }
    }
    return live;
  }

  /** Spawn a puff of `count` particles around a ground position. */
  puff(position: THREE.Vector3, count: number): void {
    for (let n = 0; n < count; n += 1) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % DUST_POOL_SIZE;
      const angle = this.random() * Math.PI * 2;
      const radius = 0.03 + this.random() * 0.09;
      this.positions[i * 3] = position.x + Math.cos(angle) * radius;
      this.positions[i * 3 + 1] = Math.max(0.02, position.y);
      this.positions[i * 3 + 2] = position.z + Math.sin(angle) * radius;
      this.velocities[i * 3] = Math.cos(angle) * 0.12;
      this.velocities[i * 3 + 1] = DUST_RISE_METRES_PER_SECOND * (0.7 + this.random() * 0.6);
      this.velocities[i * 3 + 2] = Math.sin(angle) * 0.12;
      this.ages[i] = 0;
    }
    this.geometry.attributes['position'].needsUpdate = true;
  }

  /** Integrate live particles; retire them at end of life. */
  update(dtSeconds: number): void {
    if (!(dtSeconds > 0)) {
      return;
    }
    const drag = Math.max(0, 1 - 1.8 * dtSeconds);
    for (let i = 0; i < DUST_POOL_SIZE; i += 1) {
      if (this.ages[i] < 0) {
        continue;
      }
      this.ages[i] += dtSeconds;
      if (this.ages[i] >= DUST_LIFETIME_SECONDS) {
        this.ages[i] = -1;
        this.positions[i * 3 + 1] = PARKED_Y;
        continue;
      }
      this.velocities[i * 3] *= drag;
      this.velocities[i * 3 + 1] -= 0.4 * dtSeconds;
      this.velocities[i * 3 + 2] *= drag;
      this.positions[i * 3] += this.velocities[i * 3] * dtSeconds;
      this.positions[i * 3 + 1] = Math.max(
        0.015,
        this.positions[i * 3 + 1] + this.velocities[i * 3 + 1] * dtSeconds,
      );
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dtSeconds;
    }
    this.geometry.attributes['position'].needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    const material = this.points.material as THREE.Material;
    material.dispose();
  }
}
