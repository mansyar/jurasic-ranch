import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  SLEEPY_OVERLAY_ID,
  SLEEPY_STYLE_CSS,
  SLEEPY_Z_COUNT,
  SLEEPY_Z_LOOP_SECONDS,
  hintSuppressedBySleepy,
  setSleepyVisible,
  sleepyModeFor,
  sleepyOverlayHtml,
  type SleepyOverlaySink,
} from '../../src/viewer/sleepy-ui.js';
import { shouldShowHint } from '../../src/viewer/pov.js';

const ROOT_URL = new URL('../../', import.meta.url);

/** DOM-free stand-in: the real overlay element satisfies this structurally. */
class FakeSink implements SleepyOverlaySink {
  hidden = true;
  private classes = new Set<string>();
  classList = {
    add: (...names: string[]): void => {
      for (const name of names) {
        this.classes.add(name);
      }
    },
    remove: (...names: string[]): void => {
      for (const name of names) {
        this.classes.delete(name);
      }
    },
    contains: (name: string): boolean => this.classes.has(name),
  };
}

describe('ZZZ presentation (FR-4, P3.T2)', () => {
  it('loops exactly 3 ZZZ glyphs on a ~2s rise-and-fade', () => {
    expect(SLEEPY_Z_COUNT).toBe(3);
    expect(SLEEPY_Z_LOOP_SECONDS).toBe(2);
  });

  it('renders three Z spans inside the sleepy overlay', () => {
    const html = sleepyOverlayHtml();
    expect(html).toContain(SLEEPY_OVERLAY_ID);
    const spans = html.match(/>Z</g) ?? [];
    expect(spans).toHaveLength(SLEEPY_Z_COUNT);
  });

  it('shows and hides the overlay without touching the pose', () => {
    const sink = new FakeSink();
    setSleepyVisible(sink, true, false);
    expect(sink.hidden).toBe(false);
    expect(sink.classList.contains('sleepy-animated')).toBe(true);
    setSleepyVisible(sink, false, false);
    expect(sink.hidden).toBe(true);
    expect(sink.classList.contains('sleepy-animated')).toBe(false);
    expect(sink.classList.contains('sleepy-static')).toBe(false);
  });

  it('ignores a missing overlay instead of throwing mid-frame', () => {
    expect(() => setSleepyVisible(null, true, false)).not.toThrow();
  });

  it('never intercepts the tap that should interrupt it', async () => {
    expect(SLEEPY_STYLE_CSS).toContain('pointer-events: none');
  });

  it('stays visual-only: no audio in the sleepy presentation', async () => {
    const source = await readFile(new URL('src/viewer/sleepy-ui.ts', ROOT_URL), 'utf8');
    expect(source).not.toMatch(/howler/i);
    expect(source).not.toMatch(/AudioContext/i);
  });
});

describe('reduced-motion sleepy guards (FR-8, P3.T3)', () => {
  it('maps reduced motion to a static highlight', () => {
    expect(sleepyModeFor(false)).toBe('sleepy-animated');
    expect(sleepyModeFor(true)).toBe('sleepy-static');
  });

  it('shows a static highlight instead of the rise-and-fade', () => {
    const sink = new FakeSink();
    setSleepyVisible(sink, true, true);
    expect(sink.hidden).toBe(false);
    expect(sink.classList.contains('sleepy-static')).toBe(true);
    expect(sink.classList.contains('sleepy-animated')).toBe(false);
  });

  it('ships a reduced-motion guard in the injected styles', () => {
    expect(SLEEPY_STYLE_CSS).toContain('prefers-reduced-motion');
    expect(SLEEPY_STYLE_CSS).toContain('.sleepy-static');
    expect(SLEEPY_STYLE_CSS).toContain('@keyframes');
  });
});

describe('sleepy versus hint-glow precedence (P3.T3)', () => {
  it('lets sleepy win once the dinos get drowsy', () => {
    expect(hintSuppressedBySleepy('awake')).toBe(false);
    expect(hintSuppressedBySleepy('drowsy')).toBe(true);
    expect(hintSuppressedBySleepy('sleepy')).toBe(true);
  });

  it('wires the controller, overlay, and player weight into the viewer', async () => {
    const viewer = await readFile(new URL('src/viewer/main.ts', ROOT_URL), 'utf8');
    expect(viewer).toContain('SleepyController');
    expect(viewer).toContain('ensureSleepyOverlay');
    expect(viewer).toContain('setSleepyVisible');
    expect(viewer).toContain('setSleepyWeight');
    expect(viewer).toContain('hintSuppressedBySleepy');
  });

  it('never adds the hint class while drowsy/sleepy, even past the idle threshold (F1)', async () => {
    // Idle long enough that the hint timer fires and sleepy has taken over.
    expect(shouldShowHint(0, 95_000)).toBe(true);
    expect(hintSuppressedBySleepy('drowsy')).toBe(true);
    expect(hintSuppressedBySleepy('sleepy')).toBe(true);
    // The interval guard mirrors that precedence: suppression is checked
    // before the hint class is added.
    const viewer = await readFile(new URL('src/viewer/main.ts', ROOT_URL), 'utf8');
    const interval = viewer.slice(viewer.indexOf('window.setInterval'));
    expect(interval).toContain('hintSuppressedBySleepy');
    expect(interval.slice(0, interval.indexOf('classList.add'))).toContain('hintSuppressedBySleepy');
  });
});
