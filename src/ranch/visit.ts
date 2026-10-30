/**
 * The visit (FR-4, FR-5, FR-9, FR-11): one director owns the three animals'
 * journeys out to their corners and home again.
 *
 * It moves nothing itself. The only verbs it uses are the player's own —
 * `setWanderRing`, `turnTo` and `setWalking` — so the locomotion, the 0.2 s
 * walk/rest blend, the dust and the avoidance steering all stay where they
 * already live. An arrived animal is simply a player that has been told to
 * stop, which is the state Phase 1's blend plays `Idle` in.
 *
 * The one thing this module cannot do is set a speed: `DinoPlayer` walks at its
 * gait speed or not at all. So "arrive" is not a deceleration curve, it is a
 * ring change — the ring is aimed at the anchor with a small radius so the
 * wander steer stops fighting the journey, and the animal stops when it is
 * inside the place.
 */

import { DINO_WALK_RADIUS_METRES } from './avoidance.js';
import { CORNER_ANCHORS, createSeededStream } from './layout.js';
import type { CornerSpecies } from './layout.js';
import { WALK_BLEND_SECONDS, gaitSpeedMetresPerSecond, wrapAngle } from './waddle.js';
import type { GaitParams } from './waddle.js';

/** The five states a visit passes through (FR-4, AC-4). */
export type VisitState = 'idle' | 'approach' | 'arrive' | 'dwell' | 'return';

/** The cycle in the order AC-4 requires, starting and ending at `idle`. */
export const VISIT_STATE_ORDER: readonly VisitState[] = [
  'idle',
  'approach',
  'arrive',
  'dwell',
  'return',
];

/** Seconds between autonomous visits, before jitter (FR-9: "near 45 s"). */
export const VISIT_TIMER_BASE_SECONDS = 45;

/** Width of each animal's own jitter window, in seconds (FR-9). */
export const VISIT_TIMER_WINDOW_SECONDS = 3;

/**
 * Where each animal's window starts, in seconds from the base timer. The slots
 * stand three seconds apart and every window is narrower than that, so two
 * animals can never be armed into the same whole second (AC-9) however the
 * seeded draws fall, while each animal still jitters inside its own window so
 * the trio never marches in lockstep.
 */
export const VISIT_TIMER_SLOTS: Readonly<Record<CornerSpecies, number>> = {
  trike: -3,
  stego: 0,
  brachio: 3,
};

/** How close the heading must come to the corner's facing before stopping. */
export const VISIT_FACING_TOLERANCE_RADIANS = 0.1;

/**
 * How long each animal stays at its corner, in seconds: the length of the clip
 * that plays there, measured from the shipped GLBs (`Idle` 6.000 s for Trike,
 * `MudRoll` 4.000 s for Stego, `Idle` 8.000 s for Brachio). Phase 5 plays the
 * clip; the dwell is its length so the animal never restarts a loop it has
 * already finished.
 */
export const VISIT_DWELL_SECONDS: Readonly<Record<CornerSpecies, number>> = {
  trike: 6,
  stego: 4,
  brachio: 8,
};

/** Fixed species order every seeded timer is derived from (load order cannot move it). */
const VISIT_SPECIES_ORDER: readonly CornerSpecies[] = ['trike', 'stego', 'brachio'];

/** Seed offset for the timer streams, clear of the harness's movement (1) and blink (101). */
const VISIT_SEED_OFFSET = 1001;

/** A circle on the ground, in the player's own terms. */
export interface VisitRing {
  readonly centre: { readonly x: number; readonly z: number };
  readonly radius: number;
}

/**
 * The three verbs and the two readings a visit needs. `DinoPlayer` satisfies
 * this structurally, and so does a stub, which is what keeps the controller
 * testable without a GPU or a GLB.
 */
export interface VisitActor {
  readonly heading: number;
  readonly walking: boolean;
  setWalking(walking: boolean): void;
  turnTo(radians: number): void;
  setWanderRing(centre: { readonly x: number; readonly z: number }, radius: number): void;
  /**
   * Optional one-shot the animal plays at its corner (FR-6: Stego's mud roll).
   * Optional because a player built without such a clip — a Trike or a Brachio —
   * has nothing to play and must be a no-op rather than a throw.
   */
  playArrivalClip?(): boolean;
}

/** Anything whose ground position can be read: a `THREE.Object3D` or a stub. */
export interface VisitBody {
  readonly position: { readonly x: number; readonly z: number };
}

/** One animal the director can send out. */
export interface VisitAnimal {
  readonly species: CornerSpecies;
  readonly actor: VisitActor;
  readonly body: VisitBody;
  readonly gait: GaitParams;
}

/** A corner as the director works with it: the anchor plus every derived number. */
export interface VisitCorner {
  readonly species: CornerSpecies;
  readonly anchor: readonly [number, number];
  readonly facingRadians: number;
  readonly placeRadiusMetres: number;
  /** The radius FR-5 publishes: the place plus the worst-case turn and glide. */
  readonly arrivalRadiusMetres: number;
  /** Where the facing turn begins, so the animal comes to rest inside the place. */
  readonly stopRadiusMetres: number;
  readonly dwellSeconds: number;
}

/** One animal's visit state, as the tests and the dev harness read it. */
export interface VisitSnapshot {
  readonly species: CornerSpecies;
  readonly state: VisitState;
  readonly secondsInState: number;
  readonly secondsUntilVisit: number;
  /** The distance and gait the approach was planned from, in seconds. */
  readonly approachSeconds: number;
  readonly visitsStarted: number;
  readonly arrivals: number;
  readonly corner: VisitCorner;
}

export interface VisitDirectorOptions {
  /** Seed for the per-animal jitter streams; absent or null draws from `Math.random`. */
  seed?: number | null;
  /** The ring an animal owns between visits; defaults to the world origin at gait radius. */
  homeRing?: VisitRing;
  /**
   * Called once, at the moment an animal comes to rest at its corner (FR-12,
   * FR-13). The director itself plays no sound and throws up no dust; the viewer
   * hands it the arrival effects, so the payoff stays out of the state machine.
   */
  onArrival?: (species: CornerSpecies) => void;
}

/** The tightest turn a gait can make, in radians per second. */
export function yawRateRadiansPerSecond(gait: GaitParams): number {
  return Math.min(
    gait.turnRateRadiansPerSecond,
    gait.curvatureRadiansPerMetre * gaitSpeedMetresPerSecond(gait),
  );
}

/**
 * Ground covered while turning through `radians` at full walk, in metres: the
 * worst case an animal can drift after it starts turning towards its facing.
 */
export function turnDriftMetres(gait: GaitParams, radians = Math.PI): number {
  const yawRate = yawRateRadiansPerSecond(gait);
  if (!(yawRate > 0)) {
    return 0;
  }
  return gaitSpeedMetresPerSecond(gait) * (Math.abs(radians) / yawRate);
}

/**
 * A corner's anchor, facing and published arrival radius (FR-5).
 *
 * The arrival radius is the place's own radius plus the worst-case turn and
 * the 0.2 s glide of the stop blend: an animal that starts its facing turn as
 * soon as it is inside the place therefore comes to rest still inside the
 * arrival radius, whatever direction it arrived from.
 */
export function visitCorner(species: CornerSpecies, gait: GaitParams): VisitCorner {
  const anchor = CORNER_ANCHORS[species];
  const glideMetres = gaitSpeedMetresPerSecond(gait) * WALK_BLEND_SECONDS;
  return {
    species,
    anchor: anchor.anchor,
    facingRadians: anchor.facingRadians,
    placeRadiusMetres: anchor.placeRadiusMetres,
    arrivalRadiusMetres: anchor.placeRadiusMetres + turnDriftMetres(gait) + glideMetres,
    stopRadiusMetres: anchor.placeRadiusMetres,
    dwellSeconds: VISIT_DWELL_SECONDS[species],
  };
}

/** Heading that points from one ground point at another (the player's convention). */
function headingToward(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

interface VisitTrack {
  readonly animal: VisitAnimal;
  readonly corner: VisitCorner;
  readonly jitter: () => number;
  state: VisitState;
  secondsInState: number;
  secondsUntilVisit: number;
  approachSeconds: number;
  visitsStarted: number;
  arrivals: number;
  /** The walk flag the visit borrowed, restored when the animal is home again. */
  takenOverWalking: boolean;
}

/**
 * The three animals' visit state machine (FR-4): `idle → approach → arrive →
 * dwell → return → idle`, one transition per frame at most, so no state can be
 * skipped. It is fed the frame `dt`, never the wall clock, so a paused frame
 * (`dt <= 0`) freezes every timer with the rest of the ranch.
 */
export class VisitDirector {
  private readonly homeRing: VisitRing;
  private readonly seed: number | null;
  private readonly onArrival: ((species: CornerSpecies) => void) | null;
  private readonly tracks: VisitTrack[] = [];
  private walking = false;

  constructor(options: VisitDirectorOptions = {}) {
    this.homeRing = options.homeRing ?? {
      centre: { x: 0, z: 0 },
      radius: DINO_WALK_RADIUS_METRES,
    };
    this.seed = options.seed ?? null;
    this.onArrival = options.onArrival ?? null;
  }

  /**
   * Hand the director an animal. Called as each rigged GLB lands, so a slow
   * fetch never holds up the other two timers; registering the same species
   * again replaces its track and re-arms it.
   */
  register(animal: VisitAnimal): void {
    const track: VisitTrack = {
      animal,
      corner: visitCorner(animal.species, animal.gait),
      jitter:
        this.seed === null
          ? Math.random
          : createSeededStream(
              this.seed + VISIT_SEED_OFFSET + VISIT_SPECIES_ORDER.indexOf(animal.species),
            ),
      state: 'idle',
      secondsInState: 0,
      secondsUntilVisit: 0,
      approachSeconds: 0,
      visitsStarted: 0,
      arrivals: 0,
      takenOverWalking: false,
    };
    track.secondsUntilVisit = this.nextTimer(track);
    const existing = this.tracks.findIndex((item) => item.animal.species === animal.species);
    if (existing >= 0) {
      this.tracks[existing] = track;
    } else {
      this.tracks.push(track);
    }
  }

  /** Advance every animal by one frame. `walking` is the Walk button's state. */
  update(dtSeconds: number, walking: boolean): void {
    if (!(dtSeconds > 0)) {
      return;
    }
    this.walking = walking;
    for (const track of this.tracks) {
      // FR-10: Walk off ends every visit in progress. The animal is handed the
      // home ring from wherever it stands and walks back — the `return` leg with
      // a different starting point — so nothing is teleported and nothing is
      // left stranded out at a corner it can no longer use.
      if (!walking) {
        this.abandonVisit(track);
      }
      track.secondsInState += dtSeconds;
      this.advance(track, dtSeconds);
    }
  }

  /**
   * Send one animal to its corner now (FR-8's call, and the tests' way in).
   * Returns false when the animal is already out — a call is absorbed, never a
   * second journey — or when walking is off, because a call must never turn
   * walking on.
   */
  startVisit(species: CornerSpecies): boolean {
    const track = this.tracks.find((item) => item.animal.species === species);
    if (track === undefined || !this.walking || track.state !== 'idle') {
      return false;
    }
    this.beginVisit(track);
    return true;
  }

  getState(species: CornerSpecies): VisitState | null {
    return this.getSnapshot(species)?.state ?? null;
  }

  getSnapshot(species: CornerSpecies): VisitSnapshot | null {
    const track = this.tracks.find((item) => item.animal.species === species);
    if (track === undefined) {
      return null;
    }
    return {
      species,
      state: track.state,
      secondsInState: track.secondsInState,
      // F9: the timer is only re-armed when the animal is home again, so a raw
      // countdown reads negative for the whole visit. Report it floored: "how
      // long until the next one" cannot be less than nothing.
      secondsUntilVisit: Math.max(track.secondsUntilVisit, 0),
      approachSeconds: track.approachSeconds,
      visitsStarted: track.visitsStarted,
      arrivals: track.arrivals,
      corner: track.corner,
    };
  }

  getSnapshots(): VisitSnapshot[] {
    return this.tracks.map((track) => {
      const snapshot = this.getSnapshot(track.animal.species);
      if (snapshot === null) {
        throw new Error(`${track.animal.species} lost its track`);
      }
      return snapshot;
    });
  }

  private advance(track: VisitTrack, dtSeconds: number): void {
    const { actor, body } = track.animal;
    const corner = track.corner;
    switch (track.state) {
      case 'idle': {
        if (!this.walking) {
          return;
        }
        // FR-3: a visit borrows the walk flag, it does not own it. Give it back
        // as it was taken over, so an animal that came home rests one frame and
        // then ambles on until the child turns Walk off.
        if (!actor.walking && track.takenOverWalking) {
          actor.setWalking(true);
        }
        track.secondsUntilVisit -= dtSeconds;
        if (track.secondsUntilVisit > 0) {
          return;
        }
        this.beginVisit(track);
        return;
      }
      case 'approach': {
        actor.turnTo(this.headingToAnchor(track));
        if (this.distanceToAnchor(track) > corner.stopRadiusMetres) {
          return;
        }
        this.enter(track, 'arrive');
        return;
      }
      case 'arrive': {
        actor.turnTo(corner.facingRadians);
        const off = Math.abs(wrapAngle(corner.facingRadians - actor.heading));
        if (off > VISIT_FACING_TOLERANCE_RADIANS) {
          return;
        }
        actor.setWalking(false);
        track.arrivals += 1;
        // FR-6: the one-shot a corner plays belongs here, at rest and inside the
        // dwell, so it can never overlap the walk blend. A player without such a
        // clip answers false and nothing happens.
        actor.playArrivalClip?.();
        // FR-12/FR-13: the payoff — dust and the coo — fires once, on the same
        // frame the animal stops.
        this.onArrival?.(track.animal.species);
        this.enter(track, 'dwell');
        return;
      }
      case 'dwell': {
        // Held every frame: the Walk button must not start the animal walking
        // away mid-clip.
        actor.setWalking(false);
        if (track.secondsInState < corner.dwellSeconds) {
          return;
        }
        this.sendHome(track);
        return;
      }
      case 'return': {
        actor.turnTo(
          headingToward(
            body.position.x,
            body.position.z,
            this.homeRing.centre.x,
            this.homeRing.centre.z,
          ),
        );
        if (this.distanceFromHome(track) > this.homeRing.radius) {
          return;
        }
        actor.setWalking(false);
        this.enter(track, 'idle');
        track.secondsUntilVisit = this.nextTimer(track);
        return;
      }
    }
  }

  private beginVisit(track: VisitTrack): void {
    const { actor, gait } = track.animal;
    const corner = track.corner;
    // Rework 1: remember what the walk flag was before the visit borrows it, so
    // `idle` can hand it back instead of leaving the animal parked for good.
    track.takenOverWalking = actor.walking;
    // FR-5: the ring becomes the corner, so the wander steer pulls the animal
    // towards the anchor instead of back towards the paddock.
    actor.setWanderRing({ x: corner.anchor[0], z: corner.anchor[1] }, corner.arrivalRadiusMetres);
    actor.turnTo(this.headingToAnchor(track));
    actor.setWalking(true);
    track.approachSeconds = this.distanceToAnchor(track) / gaitSpeedMetresPerSecond(gait);
    track.visitsStarted += 1;
    this.enter(track, 'approach');
  }

  private sendHome(track: VisitTrack): void {
    const { actor, body } = track.animal;
    const home = this.homeRing.centre;
    actor.setWanderRing({ x: home.x, z: home.z }, this.homeRing.radius);
    actor.turnTo(headingToward(body.position.x, body.position.z, home.x, home.z));
    actor.setWalking(true);
    this.enter(track, 'return');
  }

  /**
   * FR-10: Walk off ends a visit wherever it had got to. Only the three states
   * that are still out at the corner are cut short — an animal already on its
   * `return` leg is left to finish the walk it started, which is the same leg
   * from the same place. Nothing is moved: the animal keeps the ground it
   * stands on and walks home from there.
   */
  private abandonVisit(track: VisitTrack): void {
    if (track.state === 'approach' || track.state === 'arrive' || track.state === 'dwell') {
      this.sendHome(track);
      return;
    }
    if (track.state === 'return') {
      // FR-10/AC-10: the HUD's Stop cleared every player's `moving` in one call,
      // so a return leg that only turned towards home would stand still outside
      // its ring for good - and the child pressing Stop right after watching an
      // animal arrive is the likeliest thing they do. Re-assert the walk it had
      // already started; `sendHome` does the same on the other three states.
      track.animal.actor.setWalking(true);
    }
  }

  private enter(track: VisitTrack, state: VisitState): void {
    track.state = state;
    track.secondsInState = 0;
  }

  private nextTimer(track: VisitTrack): number {
    return (
      VISIT_TIMER_BASE_SECONDS +
      VISIT_TIMER_SLOTS[track.animal.species] +
      track.jitter() * VISIT_TIMER_WINDOW_SECONDS
    );
  }

  private headingToAnchor(track: VisitTrack): number {
    const { body } = track.animal;
    const corner = track.corner;
    return headingToward(body.position.x, body.position.z, corner.anchor[0], corner.anchor[1]);
  }

  private distanceToAnchor(track: VisitTrack): number {
    const { body } = track.animal;
    const corner = track.corner;
    return Math.hypot(body.position.x - corner.anchor[0], body.position.z - corner.anchor[1]);
  }

  private distanceFromHome(track: VisitTrack): number {
    const { body } = track.animal;
    const home = this.homeRing.centre;
    return Math.hypot(body.position.x - home.x, body.position.z - home.z);
  }
}
