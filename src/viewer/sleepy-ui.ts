import type { SleepyState } from '../ranch/sleepy.js';

/**
 * Sleepy ZZZ presentation (FR-4): a tablet-cheap DOM overlay floating three
 * pastel "Z" glyphs on a ~2s rise-and-fade loop. Visual only — sleepy never
 * forces a nap, and the overlay never intercepts taps (pointer-events none)
 * so the interrupting tap always lands.
 */

/** How many Z glyphs loop above the sleepy dinos. */
export const SLEEPY_Z_COUNT = 3;

/** Seconds per ZZZ rise-and-fade loop. */
export const SLEEPY_Z_LOOP_SECONDS = 2;

/** DOM id of the injected sleepy overlay container. */
export const SLEEPY_OVERLAY_ID = 'sleepy-zzz';

/** Overlay presentation: animated rise-and-fade, or a static highlight. */
export type SleepyMode = 'sleepy-animated' | 'sleepy-static';

/**
 * Overlay mode for the motion preference (FR-8): the gentle loop by default,
 * a static highlight when reduced motion is preferred.
 */
export function sleepyModeFor(reducedMotion: boolean): SleepyMode {
  return reducedMotion ? 'sleepy-static' : 'sleepy-animated';
}

/**
 * Whether the sleepy cues suppress the Walk/POV hint glow: once the dinos
 * get drowsy, sleepy owns the stage and the hint clears (FR-5 precedence).
 */
export function hintSuppressedBySleepy(state: SleepyState): boolean {
  return state !== 'awake';
}

/** Inner markup of the overlay: one span per looping Z glyph. */
export function sleepyOverlayHtml(): string {
  const spans: string[] = [];
  for (let index = 0; index < SLEEPY_Z_COUNT; index += 1) {
    spans.push('<span class="sleepy-z" aria-hidden="true">Z</span>');
  }
  return `<div id="${SLEEPY_OVERLAY_ID}" class="sleepy-animated" hidden>${spans.join('')}</div>`;
}

/**
 * Injected overlay styles: pastel lavender Z glyphs rising and fading on the
 * loop period with a per-glyph stagger, a static variant with no motion, and
 * a reduced-motion guard so the animation can never run against the
 * preference (FR-8). The overlay floats above the mid-scene and ignores all
 * pointer input.
 */
export const SLEEPY_STYLE_CSS = `
#${SLEEPY_OVERLAY_ID} {
  position: fixed;
  left: 50%;
  top: 26%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 0;
  pointer-events: none;
  z-index: 5;
}
#${SLEEPY_OVERLAY_ID}[hidden] {
  display: none;
}
#${SLEEPY_OVERLAY_ID} .sleepy-z {
  color: #cfc3ec;
  font-size: 44px;
  font-weight: 800;
  line-height: 1;
  text-shadow: 0 2px 8px rgba(90, 70, 140, 0.35);
  opacity: 0;
}
#${SLEEPY_OVERLAY_ID}.sleepy-animated .sleepy-z {
  animation: sleepy-rise-fade ${SLEEPY_Z_LOOP_SECONDS}s ease-in-out infinite;
}
#${SLEEPY_OVERLAY_ID}.sleepy-animated .sleepy-z:nth-child(2) {
  animation-delay: ${SLEEPY_Z_LOOP_SECONDS / SLEEPY_Z_COUNT}s;
}
#${SLEEPY_OVERLAY_ID}.sleepy-animated .sleepy-z:nth-child(3) {
  animation-delay: ${(2 * SLEEPY_Z_LOOP_SECONDS) / SLEEPY_Z_COUNT}s;
}
#${SLEEPY_OVERLAY_ID}.sleepy-static .sleepy-z {
  opacity: 0.9;
}
@keyframes sleepy-rise-fade {
  0% {
    opacity: 0;
    transform: translateY(10px) scale(0.8);
  }
  35% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-22px) scale(1.15);
  }
}
@media (prefers-reduced-motion: reduce) {
  #${SLEEPY_OVERLAY_ID}.sleepy-animated .sleepy-z {
    animation: none;
    opacity: 0.9;
  }
}
`;

/**
 * Minimal overlay surface: the real element satisfies this structurally, and
 * tests drive a DOM-free stand-in. Nullable so a missing overlay is a no-op
 * instead of a mid-frame throw.
 */
export interface SleepyOverlaySink {
  hidden: string | boolean;
  classList: {
    add(...names: string[]): void;
    remove(...names: string[]): void;
    contains(name: string): boolean;
  };
}

/**
 * Show or hide the overlay in the given motion mode. Hiding strips both mode
 * classes so the next show starts clean.
 */
export function setSleepyVisible(
  sink: SleepyOverlaySink | null,
  visible: boolean,
  reducedMotion: boolean,
): void {
  if (sink === null) {
    return;
  }
  sink.hidden = !visible;
  if (visible) {
    sink.classList.add(sleepyModeFor(reducedMotion));
    sink.classList.remove(sleepyModeFor(!reducedMotion));
  } else {
    sink.classList.remove('sleepy-animated');
    sink.classList.remove('sleepy-static');
  }
}

/** Style element marker so the overlay CSS injects exactly once. */
const SLEEPY_STYLE_MARKER = 'data-sleepy-style';

/**
 * Mount the overlay (plus its styles) into the document and return it.
 * Idempotent: a second call returns the existing element.
 */
export function ensureSleepyOverlay(doc: Document): HTMLElement {
  const existing = doc.getElementById(SLEEPY_OVERLAY_ID);
  if (existing !== null) {
    return existing;
  }
  if (doc.querySelector(`style[${SLEEPY_STYLE_MARKER}]`) === null) {
    const style = doc.createElement('style');
    style.setAttribute(SLEEPY_STYLE_MARKER, '');
    style.textContent = SLEEPY_STYLE_CSS;
    doc.head.appendChild(style);
  }
  const container = doc.createElement('div');
  container.innerHTML = sleepyOverlayHtml();
  const overlay = container.firstElementChild;
  if (overlay instanceof HTMLElement) {
    doc.body.appendChild(overlay);
    return overlay;
  }
  throw new Error('Sleepy overlay markup did not produce an element.');
}
