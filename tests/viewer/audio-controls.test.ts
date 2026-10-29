import { describe, expect, it, vi } from 'vitest';
import { HOLD_DURATION_MS } from '../../src/audio/gate.js';
import { DEFAULT_VOLUME } from '../../src/audio/mix.js';
import {
  AUDIO_CONTROLS_ID,
  AUDIO_MUTE_ID,
  AUDIO_PANEL_CLOSE_ID,
  AUDIO_PANEL_ID,
  AUDIO_PANEL_MUTE_ID,
  AUDIO_PANEL_TITLE_ID,
  AUDIO_PARENT_ID,
  AUDIO_VOLUME_ID,
  AUDIO_VOLUME_VALUE_ID,
  MUTED_LABEL,
  SOUND_LABEL,
  VOLUME_LABEL,
  createAudioControls,
  formatVolumePercent,
  isAudioControlTarget,
  type AudioControlEvent,
  type AudioControlElement,
  type AudioControls,
  type AudioPanelElement,
  type AudioSliderElement,
  type HoldTicker,
} from '../../src/viewer/audio-controls.js';

/**
 * Sound controls and the parent gate (FR-6, FR-7, FR-8, NFR-4, AC-6..AC-8).
 * These tests use a small richer fake instead of jsdom and a manual frame
 * clock, so the 2 s hold is deterministic and no real timer runs.
 */

class FakeStyle {
  readonly properties = new Map<string, string>();

  setProperty(name: string, value: string): void {
    this.properties.set(name, value);
  }
}

class FakeElement implements AudioControlElement {
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: AudioControlEvent) => void>>();
  readonly style = new FakeStyle();
  textContent: string | null = '';
  focusCount = 0;

  addEventListener(type: string, listener: (event: AudioControlEvent) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: AudioControlEvent) => void): void {
    const listeners = (this.listeners.get(type) ?? []).filter((entry) => entry !== listener);
    if (listeners.length === 0) {
      this.listeners.delete(type);
      return;
    }
    this.listeners.set(type, listeners);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  focus(): void {
    this.focusCount += 1;
  }

  dispatch(type: string, event: AudioControlEvent = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  listenerCount(): number {
    let count = 0;
    for (const listeners of this.listeners.values()) {
      count += listeners.length;
    }
    return count;
  }
}

class FakePanel extends FakeElement implements AudioPanelElement {
  hidden = true;
}

class FakeSlider extends FakeElement implements AudioSliderElement {
  value = '0';
}

/** Manual rAF: frames run only when a test advances the clock. */
class ManualTicker implements HoldTicker {
  current = 0;
  private nextId = 1;
  private readonly frames = new Map<number, () => void>();

  now(): number {
    return this.current;
  }

  requestFrame(callback: () => void): number {
    const id = this.nextId;
    this.nextId += 1;
    this.frames.set(id, callback);
    return id;
  }

  cancelFrame(id: number): void {
    this.frames.delete(id);
  }

  /** Advance to `ms` and run the frames already scheduled at this step. */
  advanceTo(ms: number): void {
    this.current = ms;
    const due = [...this.frames.values()];
    this.frames.clear();
    for (const callback of due) {
      callback();
    }
  }

  pendingFrames(): number {
    return this.frames.size;
  }
}

interface Harness {
  mute: FakeElement;
  parent: FakeElement;
  panel: FakePanel;
  panelMute: FakeElement;
  slider: FakeSlider;
  close: FakeElement;
  volumeValue: FakeElement;
  windowTarget: FakeElement;
  ticker: ManualTicker;
  controls: AudioControls;
  onMutedChange: ReturnType<typeof vi.fn>;
  onVolumeChange: ReturnType<typeof vi.fn>;
  onUnlock: ReturnType<typeof vi.fn>;
}

function createHarness(
  overrides: {
    initialMuted?: boolean;
    initialVolume?: number;
  } = {},
): Harness {
  const mute = new FakeElement();
  const parent = new FakeElement();
  const panel = new FakePanel();
  const panelMute = new FakeElement();
  const slider = new FakeSlider();
  const close = new FakeElement();
  const volumeValue = new FakeElement();
  const windowTarget = new FakeElement();
  const ticker = new ManualTicker();
  const onMutedChange = vi.fn();
  const onVolumeChange = vi.fn();
  const onUnlock = vi.fn();
  const controls = createAudioControls({
    muteButton: mute,
    parentButton: parent,
    panel,
    panelMuteButton: panelMute,
    slider,
    closeButton: close,
    volumeValue,
    initialMuted: overrides.initialMuted ?? false,
    initialVolume: overrides.initialVolume ?? DEFAULT_VOLUME,
    onMutedChange,
    onVolumeChange,
    onUnlock,
    ticker,
    windowTarget,
  });
  return {
    mute,
    parent,
    panel,
    panelMute,
    slider,
    close,
    volumeValue,
    windowTarget,
    ticker,
    controls,
    onMutedChange,
    onVolumeChange,
    onUnlock,
  };
}

/** Open the panel through the real gate: press, wait 2 s, release. */
function completeHold(harness: Harness): void {
  harness.parent.dispatch('pointerdown');
  harness.ticker.advanceTo(harness.ticker.now() + HOLD_DURATION_MS);
}

describe('element ids and labels', () => {
  it('matches the ids index.html declares', () => {
    expect([
      AUDIO_CONTROLS_ID,
      AUDIO_MUTE_ID,
      AUDIO_PARENT_ID,
      AUDIO_PANEL_ID,
      AUDIO_PANEL_TITLE_ID,
      AUDIO_PANEL_MUTE_ID,
      AUDIO_VOLUME_ID,
      AUDIO_VOLUME_VALUE_ID,
      AUDIO_PANEL_CLOSE_ID,
    ]).toEqual([
      'audio-controls',
      'audio-mute',
      'audio-parent',
      'audio-panel',
      'audio-panel-title',
      'audio-panel-mute',
      'audio-volume',
      'audio-volume-value',
      'audio-panel-close',
    ]);
  });

  it('keeps icon + word on both mute labels (NFR-4)', () => {
    expect(SOUND_LABEL).toContain('🔊');
    expect(SOUND_LABEL).toContain('Sound');
    expect(MUTED_LABEL).toContain('🔇');
    expect(MUTED_LABEL).toContain('Muted');
    expect(VOLUME_LABEL).toContain('⚙️');
    expect(VOLUME_LABEL).toContain('Volume');
  });

  it('formats a clamped percent readout', () => {
    expect(formatVolumePercent(0.8)).toBe('80%');
    expect(formatVolumePercent(0)).toBe('0%');
    expect(formatVolumePercent(2)).toBe('100%');
    expect(formatVolumePercent(Number.NaN)).toBe('80%');
  });
});

describe('mute button (FR-6, AC-6)', () => {
  it('starts from the persisted state and mirrors it in word + aria-pressed', () => {
    const harness = createHarness({ initialMuted: true });
    expect(harness.mute.textContent).toBe(MUTED_LABEL);
    expect(harness.mute.attributes.get('aria-pressed')).toBe('true');
    expect(harness.panelMute.textContent).toBe(MUTED_LABEL);
  });

  it('toggles sound, reports the change, and unlocks after the tap', () => {
    const harness = createHarness();
    expect(harness.mute.textContent).toBe(SOUND_LABEL);

    harness.mute.dispatch('click');

    expect(harness.mute.textContent).toBe(MUTED_LABEL);
    expect(harness.mute.attributes.get('aria-pressed')).toBe('true');
    expect(harness.controls.isMuted()).toBe(true);
    expect(harness.onMutedChange).toHaveBeenCalledTimes(1);
    expect(harness.onMutedChange).toHaveBeenCalledWith(true);
    expect(harness.onUnlock).toHaveBeenCalledTimes(1);

    harness.mute.dispatch('click');
    expect(harness.mute.textContent).toBe(SOUND_LABEL);
    expect(harness.controls.isMuted()).toBe(false);
    expect(harness.onMutedChange).toHaveBeenLastCalledWith(false);
    expect(harness.onUnlock).toHaveBeenCalledTimes(2);
  });

  it('keeps the panel mute button in sync and stays silent on a failed unlock', async () => {
    const harness = createHarness();
    harness.onUnlock.mockRejectedValue(new Error('no audio'));

    expect(() => {
      harness.panelMute.dispatch('click');
    }).not.toThrow();
    expect(harness.controls.isMuted()).toBe(true);
    expect(harness.mute.textContent).toBe(MUTED_LABEL);
    await Promise.resolve();
    await Promise.resolve();
  });

  it('does not report a no-op state change twice', () => {
    const harness = createHarness();
    harness.controls.setMuted(true);
    harness.controls.setMuted(true);
    expect(harness.onMutedChange).toHaveBeenCalledTimes(1);
  });
});

describe('parent slider (FR-7, AC-7)', () => {
  it('renders the initial volume as a clamped percent', () => {
    const harness = createHarness({ initialVolume: 0.8 });
    expect(harness.slider.value).toBe('80');
    expect(harness.volumeValue.textContent).toBe('80%');
    expect(harness.slider.attributes.get('aria-valuetext')).toBe('80%');

    const clamped = createHarness({ initialVolume: 4 });
    expect(clamped.slider.value).toBe('100');
    expect(clamped.controls.volume()).toBe(1);
  });

  it('applies slider input live and clamps it into 0..1', () => {
    const harness = createHarness();
    harness.slider.value = '55';
    harness.slider.dispatch('input');

    expect(harness.onVolumeChange).toHaveBeenCalledWith(0.55);
    expect(harness.controls.volume()).toBe(0.55);
    expect(harness.volumeValue.textContent).toBe('55%');

    harness.slider.value = '150';
    harness.slider.dispatch('input');
    expect(harness.onVolumeChange).toHaveBeenLastCalledWith(1);
    expect(harness.volumeValue.textContent).toBe('100%');

    harness.slider.value = '-20';
    harness.slider.dispatch('input');
    expect(harness.onVolumeChange).toHaveBeenLastCalledWith(0);
    expect(harness.volumeValue.textContent).toBe('0%');
  });

  it('applies an external volume through the same clamp', () => {
    const harness = createHarness();
    harness.controls.setVolume(0.25);
    expect(harness.slider.value).toBe('25');
    expect(harness.onVolumeChange).toHaveBeenCalledWith(0.25);
  });
});

describe('hold gate (FR-8, AC-8)', () => {
  it('opens the panel at 2 s, resets the ring, and focuses inside', () => {
    const harness = createHarness();
    expect(harness.panel.hidden).toBe(true);

    harness.parent.dispatch('pointerdown');
    expect(harness.parent.style.properties.get('--hold-progress')).toBe('0');

    harness.ticker.advanceTo(1000);
    expect(harness.parent.style.properties.get('--hold-progress')).toBe('0.5');
    expect(harness.panel.hidden).toBe(true);

    harness.ticker.advanceTo(HOLD_DURATION_MS);
    expect(harness.panel.hidden).toBe(false);
    expect(harness.controls.isPanelOpen()).toBe(true);
    expect(harness.parent.attributes.get('aria-expanded')).toBe('true');
    expect(harness.parent.style.properties.get('--hold-progress')).toBe('0');
    expect(harness.close.focusCount).toBe(1);
    expect(harness.ticker.pendingFrames()).toBe(0);
  });

  it('cancels at 1.9 s on pointerup without opening', () => {
    const harness = createHarness();
    harness.parent.dispatch('pointerdown');
    harness.ticker.advanceTo(1900);
    harness.parent.dispatch('pointerup');

    expect(harness.panel.hidden).toBe(true);
    expect(harness.parent.style.properties.get('--hold-progress')).toBe('0');
    expect(harness.ticker.pendingFrames()).toBe(0);
  });

  it('cancels on pointerleave, pointercancel, and window blur', () => {
    for (const event of ['pointerleave', 'pointercancel'] as const) {
      const harness = createHarness();
      harness.parent.dispatch('pointerdown');
      harness.ticker.advanceTo(1500);
      harness.parent.dispatch(event);
      expect(harness.panel.hidden).toBe(true);
      expect(harness.parent.style.properties.get('--hold-progress')).toBe('0');
    }

    const harness = createHarness();
    harness.parent.dispatch('pointerdown');
    harness.ticker.advanceTo(1500);
    harness.windowTarget.dispatch('blur');
    expect(harness.panel.hidden).toBe(true);
    expect(harness.ticker.pendingFrames()).toBe(0);
  });

  it('does not extend the hold on a repeated pointerdown', () => {
    const harness = createHarness();
    harness.parent.dispatch('pointerdown');
    harness.ticker.advanceTo(1000);
    harness.parent.dispatch('pointerdown');
    harness.ticker.advanceTo(HOLD_DURATION_MS);

    expect(harness.panel.hidden).toBe(false);
  });

  it('supports the same 2 s gate from Space and Enter', () => {
    const harness = createHarness();
    harness.parent.dispatch('keydown', { key: ' ' });
    harness.ticker.advanceTo(500);

    // Auto-repeat must not restart the gate.
    harness.parent.dispatch('keydown', { key: ' ', repeat: true });
    harness.ticker.advanceTo(1900);
    expect(harness.panel.hidden).toBe(true);

    harness.parent.dispatch('keyup', { key: ' ' });
    expect(harness.ticker.pendingFrames()).toBe(0);

    harness.parent.dispatch('keydown', { key: 'Enter' });
    harness.ticker.advanceTo(3900);
    expect(harness.panel.hidden).toBe(false);
    expect(harness.controls.isPanelOpen()).toBe(true);
    expect(harness.close.focusCount).toBe(1);
  });

  it('ignores unrelated keys on the gear', () => {
    const harness = createHarness();
    harness.parent.dispatch('keydown', { key: 'a' });
    expect(harness.ticker.pendingFrames()).toBe(0);
  });
});

describe('parent panel (FR-8, AC-8)', () => {
  it('closes on Escape from the window and returns focus to the gear', () => {
    const harness = createHarness();
    completeHold(harness);
    expect(harness.panel.hidden).toBe(false);

    harness.windowTarget.dispatch('keydown', { key: 'Escape' });

    expect(harness.panel.hidden).toBe(true);
    expect(harness.controls.isPanelOpen()).toBe(false);
    expect(harness.parent.attributes.get('aria-expanded')).toBe('false');
    expect(harness.parent.focusCount).toBe(1);
  });

  it('closes from the 72 px close button and returns focus to the gear', () => {
    const harness = createHarness();
    completeHold(harness);

    harness.close.dispatch('click');

    expect(harness.panel.hidden).toBe(true);
    expect(harness.parent.focusCount).toBe(1);
  });

  it('re-opening an open panel only moves focus back inside', () => {
    const harness = createHarness();
    completeHold(harness);
    harness.controls.openPanel();
    expect(harness.close.focusCount).toBe(2);
    expect(harness.controls.isPanelOpen()).toBe(true);
  });
});

describe('dispose (NFR-5)', () => {
  it('removes every listener and cancels a pending hold', () => {
    const harness = createHarness();
    harness.parent.dispatch('pointerdown');
    expect(harness.ticker.pendingFrames()).toBe(1);

    harness.controls.dispose();

    expect(harness.ticker.pendingFrames()).toBe(0);
    expect(harness.mute.listenerCount()).toBe(0);
    expect(harness.parent.listenerCount()).toBe(0);
    expect(harness.windowTarget.listenerCount()).toBe(0);

    harness.mute.dispatch('click');
    expect(harness.controls.isMuted()).toBe(false);
  });
});

describe('isAudioControlTarget (FR-2, AC-6 edge)', () => {
  it('matches elements inside the controls or the panel', () => {
    expect(isAudioControlTarget({ closest: () => ({}) })).toBe(true);
    const closest = vi.fn(() => ({}));
    expect(isAudioControlTarget({ closest })).toBe(true);
    expect(closest).toHaveBeenCalledWith('#audio-controls, #audio-panel');
  });

  it('rejects targets outside the controls', () => {
    expect(isAudioControlTarget({ closest: () => null })).toBe(false);
    expect(isAudioControlTarget(null)).toBe(false);
    expect(isAudioControlTarget(undefined)).toBe(false);
    expect(isAudioControlTarget(42)).toBe(false);
    expect(isAudioControlTarget({})).toBe(false);
  });

  it('treats a throwing closest as outside the controls', () => {
    expect(
      isAudioControlTarget({
        closest: (): unknown => {
          throw new Error('detached');
        },
      }),
    ).toBe(false);
  });
});
