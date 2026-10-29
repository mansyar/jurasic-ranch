#!/usr/bin/env python3
"""Synthesize the CC0 starter-pack music loop and six UI/creature SFX.

Every sound here is generated from scratch with numpy — no downloaded samples,
no unclear provenance — and is dedicated CC0 by the project (see CREDITS.md).
That also lets the kalimba loop be sample-accurate: notes are rendered past the
loop end and wrapped back onto the start, so bar 16 flows into bar 1 with no
click and no silence.

Output (mono 44.1 kHz, 128 kbps, -16 LUFS):

- `public/audio/music/kalimba-loop.mp3` — 40.0 s, 96 BPM, 16 bars of 4/4
- `public/audio/sfx/coo-trike.mp3` — 1.0 s, G3
- `public/audio/sfx/coo-stego.mp3` — 1.2 s, F3
- `public/audio/sfx/coo-brachio.mp3` — 1.4 s, A3
- `public/audio/sfx/tap.mp3` — soft wooden tap
- `public/audio/sfx/heart.mp3` — two soft low thumps
- `public/audio/sfx/sparkle.mp3` — three gentle bell notes

Usage:

```bash
.conductor/kokoro-venv/Scripts/python.exe scripts/audio/synth-starter-pack.py
```
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT_DIR = REPO_ROOT / 'public' / 'audio'
DEFAULT_WORK_DIR = REPO_ROOT / '.conductor' / 'evidence' / 'synth-work'
DEFAULT_REPORT = REPO_ROOT / '.conductor' / 'evidence' / 'starter-pack-report.json'

SAMPLE_RATE = 44_100
CHANNELS = 1
BITRATE = '128k'
LOUDNESS_TARGET = -16.0
TRUE_PEAK = -1.5
LOUDNESS_RANGE = 11.0

BPM = 96.0
BEATS_PER_BAR = 4
BARS = 16
LOOP_SECONDS = BARS * BEATS_PER_BAR * 60.0 / BPM
TAIL_SECONDS = 4.0

FFMPEG = shutil.which('ffmpeg') or 'ffmpeg'
FFPROBE = shutil.which('ffprobe') or 'ffprobe'


def fail(message: str) -> None:
    sys.stderr.write(f'starter-pack synthesis failed: {message}\n')
    raise SystemExit(1)


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or '').strip()
        fail(f'command failed ({command[0]}): {detail}')
    return result


def write_wav(path: Path, samples: np.ndarray) -> None:
    """Write mono float32 samples as 16-bit PCM for a lossless ffmpeg input."""
    clipped = np.clip(np.asarray(samples, dtype=np.float32), -1.0, 1.0)
    pcm = (clipped * 32767.0).astype('<i2')
    with wave.open(str(path), 'wb') as handle:
        handle.setnchannels(CHANNELS)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(pcm.tobytes())


def lowpass(signal: np.ndarray, cutoff_hz: float, order: float = 4.0) -> np.ndarray:
    """Zero-phase low-pass via FFT; fine for offline, deterministic renders."""
    spectrum = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(len(signal), 1.0 / SAMPLE_RATE)
    spectrum /= 1.0 + (freqs / cutoff_hz) ** order
    return np.fft.irfft(spectrum, len(signal))


def fade_edges(signal: np.ndarray, attack: float, release: float) -> np.ndarray:
    """Raised-cosine attack and release so a clip starts and ends at zero."""
    out = signal.copy()
    attack_samples = min(len(out), max(1, int(attack * SAMPLE_RATE)))
    release_samples = min(len(out), max(1, int(release * SAMPLE_RATE)))
    out[:attack_samples] *= 0.5 - 0.5 * np.cos(
        np.linspace(0.0, np.pi, attack_samples, endpoint=False)
    )
    out[-release_samples:] *= 0.5 + 0.5 * np.cos(
        np.linspace(0.0, np.pi, release_samples, endpoint=True)
    )
    return out


def normalize_peak(signal: np.ndarray, peak: float) -> np.ndarray:
    highest = float(np.max(np.abs(signal)))
    if highest <= 0.0:
        fail('synthesized a silent buffer')
    return signal * (peak / highest)


def last_json_object(text: str) -> dict[str, str]:
    start = text.rfind('{')
    end = text.rfind('}')
    if start < 0 or end <= start:
        raise ValueError('loudnorm printed no JSON measurement')
    return json.loads(text[start : end + 1])


def measure_loudness(path: Path) -> dict[str, float] | None:
    """Two-pass loudnorm measurement; None when the clip is too short to judge."""
    result = subprocess.run(
        [
            FFMPEG,
            '-hide_banner',
            '-nostats',
            '-i',
            str(path),
            '-af',
            f'loudnorm=I={LOUDNESS_TARGET}:TP={TRUE_PEAK}:LRA={LOUDNESS_RANGE}:print_format=json',
            '-f',
            'null',
            '-',
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    try:
        payload = last_json_object(result.stderr)
        measured = {
            'input_i': float(payload['input_i']),
            'input_tp': float(payload['input_tp']),
            'input_lra': float(payload['input_lra']),
            'input_thresh': float(payload['input_thresh']),
            'target_offset': float(payload['target_offset']),
        }
    except (KeyError, TypeError, ValueError):
        return None
    if not all(math.isfinite(value) for value in measured.values()):
        return None
    return measured


def measure_peak_db(path: Path) -> float | None:
    result = subprocess.run(
        [FFMPEG, '-hide_banner', '-nostats', '-i', str(path), '-af', 'volumedetect', '-f', 'null', '-'],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    match = re.search(r'max_volume:\s*(-?\d+(?:\.\d+)?)\s*dB', result.stderr)
    return float(match.group(1)) if match else None


def encode(path_in: Path, path_out: Path) -> None:
    """Normalize to -16 LUFS when measurable, else peak-normalize, then encode."""
    measured = measure_loudness(path_in)
    if measured is not None:
        chain = (
            f'loudnorm=I={LOUDNESS_TARGET}:TP={TRUE_PEAK}:LRA={LOUDNESS_RANGE}'
            f':measured_I={measured["input_i"]}'
            f':measured_TP={measured["input_tp"]}'
            f':measured_LRA={measured["input_lra"]}'
            f':measured_thresh={measured["input_thresh"]}'
            f':offset={measured["target_offset"]}'
            ':linear=true'
        )
    else:
        peak_db = measure_peak_db(path_in)
        if peak_db is None:
            fail(f'cannot measure loudness or peak for {path_in.name}')
        gain = -3.0 - peak_db
        chain = f'volume={gain:.2f}dB'
    run(
        [
            FFMPEG,
            '-y',
            '-hide_banner',
            '-loglevel',
            'error',
            '-i',
            str(path_in),
            '-af',
            f'{chain},aresample={SAMPLE_RATE}',
            '-ac',
            str(CHANNELS),
            '-ar',
            str(SAMPLE_RATE),
            '-c:a',
            'libmp3lame',
            '-b:a',
            BITRATE,
            str(path_out),
        ]
    )


def probe_duration(path: Path) -> float:
    result = run(
        [
            FFPROBE,
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            str(path),
        ]
    )
    return float(result.stdout.strip())


def measure_integrated_loudness(path: Path) -> float | None:
    result = subprocess.run(
        [FFMPEG, '-hide_banner', '-nostats', '-i', str(path), '-af', 'ebur128', '-f', 'null', '-'],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    matches = re.findall(r'I:\s*(-?\d+(?:\.\d+)?)\s*LUFS', result.stderr)
    return float(matches[-1]) if matches else None


# --- Music -----------------------------------------------------------------

# C major pentatonic across two octaves; the lower row is the bass tine.
MELODY = {
    'C4': 261.63,
    'D4': 293.66,
    'E4': 329.63,
    'G4': 392.00,
    'A4': 440.00,
    'C5': 523.25,
    'D5': 587.33,
    'E5': 659.25,
    'C3': 130.81,
    'G3': 196.00,
    'F3': 174.61,
    'A3': 220.00,
}

# Four-bar progression (C, Am, F, G) repeated four times = 16 bars.
CHORDS = [
    ('C3', ['C4', 'E4', 'G4']),
    ('A3', ['A4', 'C5', 'E5']),
    ('F3', ['A4', 'C5', 'D5']),
    ('G3', ['G4', 'D5', 'E5']),
]

# One bar of melody: (beat inside the bar, note). Leaves space to breathe.
BAR_PATTERNS = [
    [(0.0, 'C5'), (1.0, 'G4'), (2.0, 'E4'), (3.0, 'G4')],
    [(0.0, 'A4'), (1.0, 'E4'), (2.0, 'C4'), (3.0, 'E4')],
    [(0.0, 'C5'), (1.0, 'A4'), (2.0, 'D5'), (3.0, 'A4')],
    [(0.0, 'G4'), (1.0, 'D4'), (2.0, 'E4'), (3.0, 'G4')],
]


def kalimba_note(freq: float, seconds: float, amplitude: float) -> np.ndarray:
    """A soft tine: a few slightly inharmonic partials, each decaying faster."""
    count = int(SAMPLE_RATE * seconds)
    time = np.arange(count) / SAMPLE_RATE
    partials = ((1.0, 1.0, 1.0), (2.02, 0.32, 0.62), (3.91, 0.12, 0.38), (5.41, 0.05, 0.24))
    signal = np.zeros(count)
    for ratio, level, decay_scale in partials:
        signal += (
            level
            * np.sin(2.0 * math.pi * freq * ratio * time + ratio)
            * np.exp(-time / (1.9 * decay_scale))
        )
    attack = max(1, int(SAMPLE_RATE * 0.005))
    signal[:attack] *= np.linspace(0.0, 1.0, attack)
    return signal * amplitude


def render_kalimba() -> np.ndarray:
    """Render 40.0 s and wrap the overhang back onto the loop start."""
    total = int(round(LOOP_SECONDS * SAMPLE_RATE))
    buffer = np.zeros(total + int(TAIL_SECONDS * SAMPLE_RATE))
    beat_seconds = 60.0 / BPM
    bar_seconds = beat_seconds * BEATS_PER_BAR

    for bar in range(BARS):
        chord_root, chord = CHORDS[bar % len(CHORDS)]
        pattern = BAR_PATTERNS[bar % len(BAR_PATTERNS)]
        bar_start = bar * bar_seconds
        # Bass tines on beats 1 and 3, quiet and slow.
        for beat, level in ((0.0, 0.5), (2.0, 0.36)):
            offset = int((bar_start + beat * beat_seconds) * SAMPLE_RATE)
            note = kalimba_note(MELODY[chord_root], 2.4, level)
            end = min(len(buffer), offset + len(note))
            buffer[offset:end] += note[: end - offset]
        # Melody voice, alternating octave in the second half for variety.
        for beat, name in pattern:
            octave = 12 if bar >= 8 and name.endswith('4') else 0
            freq = MELODY[name] * (2.0 ** (octave / 12.0))
            offset = int((bar_start + beat * beat_seconds) * SAMPLE_RATE)
            note = kalimba_note(freq, 2.2, 0.42)
            end = min(len(buffer), offset + len(note))
            buffer[offset:end] += note[: end - offset]
        # A quiet chord tone under the pattern to keep it warm, not sparse.
        offset = int((bar_start + 3.5 * beat_seconds) * SAMPLE_RATE)
        note = kalimba_note(MELODY[chord[-1]] * 0.5, 1.6, 0.16)
        end = min(len(buffer), offset + len(note))
        buffer[offset:end] += note[: end - offset]

    loop = buffer[:total].copy()
    overhang = buffer[total:]
    loop[: len(overhang)] += overhang
    loop -= float(np.mean(loop))
    return loop


# --- Creatures and UI ------------------------------------------------------


def coo(base_hz: float, seconds: float, formant_hz: float, vibrato_hz: float, depth: float) -> np.ndarray:
    """One warm creature coo: a gentle pitch arc, soft harmonics, low breath."""
    count = int(SAMPLE_RATE * seconds)
    time = np.arange(count) / SAMPLE_RATE
    arc = 1.0 + 0.045 * np.sin(math.pi * time / seconds) - 0.03 * (time / seconds)
    vibrato = 1.0 + depth * np.sin(2.0 * math.pi * vibrato_hz * time)
    frequency = base_hz * arc * vibrato
    phase = 2.0 * math.pi * np.cumsum(frequency) / SAMPLE_RATE
    voice = (
        np.sin(phase)
        + 0.48 * np.sin(2.0 * phase + 0.4)
        + 0.18 * np.sin(3.0 * phase + 0.9)
        + 0.07 * np.sin(4.0 * phase + 1.3)
    )
    rng = np.random.default_rng(7)
    breath = lowpass(rng.standard_normal(count), 520.0) * 0.06
    voiced = lowpass(voice + breath, formant_hz)
    envelope = np.ones(count)
    attack = int(0.09 * SAMPLE_RATE)
    envelope[:attack] = 0.5 - 0.5 * np.cos(np.linspace(0.0, np.pi, attack, endpoint=False))
    envelope *= np.exp(-0.9 * time / seconds)
    return fade_edges(voiced * envelope, 0.01, 0.28)


def tap() -> np.ndarray:
    """A soft wooden tap: a filtered noise tick under a short pitched body."""
    count = int(0.18 * SAMPLE_RATE)
    time = np.arange(count) / SAMPLE_RATE
    rng = np.random.default_rng(11)
    body = (
        np.sin(2.0 * math.pi * 760.0 * time) * np.exp(-time / 0.035)
        + 0.35 * np.sin(2.0 * math.pi * 1520.0 * time) * np.exp(-time / 0.02)
    )
    tick = rng.standard_normal(count) * np.exp(-time / 0.008) * 0.22
    return fade_edges(lowpass(body + tick, 3500.0), 0.002, 0.03)


def heart() -> np.ndarray:
    """Two low, soft thumps with a gentle pitch drop — no startling transient."""
    count = int(0.75 * SAMPLE_RATE)
    out = np.zeros(count)
    for start_seconds, level in ((0.0, 1.0), (0.21, 0.7)):
        thump_count = int(0.2 * SAMPLE_RATE)
        time = np.arange(thump_count) / SAMPLE_RATE
        frequency = 62.0 * (1.0 - 0.22 * np.minimum(1.0, time / 0.15))
        phase = 2.0 * math.pi * np.cumsum(frequency) / SAMPLE_RATE
        envelope = (1.0 - np.exp(-time / 0.01)) * np.exp(-time / 0.085)
        thump = (np.sin(phase) + 0.22 * np.sin(2.0 * phase)) * envelope * level
        offset = int(start_seconds * SAMPLE_RATE)
        end = min(count, offset + thump_count)
        out[offset:end] += thump[: end - offset]
    return fade_edges(lowpass(out, 320.0), 0.005, 0.12)


def sparkle() -> np.ndarray:
    """Three soft bell notes with rolled-off highs; bright but never harsh."""
    count = int(0.9 * SAMPLE_RATE)
    out = np.zeros(count)
    for index, (freq, level) in enumerate(((1318.51, 1.0), (1567.98, 0.8), (2093.0, 0.6))):
        note_count = int(0.55 * SAMPLE_RATE)
        time = np.arange(note_count) / SAMPLE_RATE
        note = (
            np.sin(2.0 * math.pi * freq * time)
            + 0.18 * np.sin(4.0 * math.pi * freq * time)
            + 0.05 * np.sin(6.0 * math.pi * freq * time)
        )
        note *= (1.0 - np.exp(-time / 0.008)) * np.exp(-time / 0.28) * level * 0.5
        offset = int((0.11 * index) * SAMPLE_RATE)
        end = min(count, offset + note_count)
        out[offset:end] += note[: end - offset]
    return fade_edges(lowpass(out, 9000.0), 0.004, 0.1)


# --- Driver ----------------------------------------------------------------


def assets() -> list[dict]:
    return [
        {
            'id': 'music-kalimba',
            'path': 'music/kalimba-loop.mp3',
            'kind': 'music',
            'seconds': LOOP_SECONDS,
            'render': render_kalimba,
            'source': 'Original for Jurasic Ranch, dedicated CC0',
            'notes': 'Kalimba-like tine synthesis, 96 BPM, 16 bars, tail wrapped into bar 1',
        },
        {
            'id': 'coo-trike',
            'path': 'sfx/coo-trike.mp3',
            'kind': 'sfx',
            'seconds': 1.0,
            'render': lambda: coo(196.00, 1.0, 900.0, 5.0, 0.015),
            'source': 'Original for Jurasic Ranch, dedicated CC0',
            'notes': 'Base coo at G3, soft harmonics, low breath',
        },
        {
            'id': 'coo-stego',
            'path': 'sfx/coo-stego.mp3',
            'kind': 'sfx',
            'seconds': 1.2,
            'render': lambda: coo(174.61, 1.2, 800.0, 4.2, 0.012),
            'source': 'Original for Jurasic Ranch, dedicated CC0',
            'notes': 'Same coo voice, two semitones below Trike (F3), slower',
        },
        {
            'id': 'coo-brachio',
            'path': 'sfx/coo-brachio.mp3',
            'kind': 'sfx',
            'seconds': 1.4,
            'render': lambda: coo(220.00, 1.4, 1020.0, 5.4, 0.010),
            'source': 'Original for Jurasic Ranch, dedicated CC0',
            'notes': 'Same coo voice, three semitones above Trike (A3), longest',
        },
        {
            'id': 'tap',
            'path': 'sfx/tap.mp3',
            'kind': 'sfx',
            'seconds': 0.18,
            'render': tap,
            'source': 'Original for Jurasic Ranch, dedicated CC0',
            'notes': 'Soft wooden tap, low-passed at 3.5 kHz',
        },
        {
            'id': 'heart',
            'path': 'sfx/heart.mp3',
            'kind': 'sfx',
            'seconds': 0.75,
            'render': heart,
            'source': 'Original for Jurasic Ranch, dedicated CC0',
            'notes': 'Two 60 Hz thumps, low-passed at 320 Hz',
        },
        {
            'id': 'sparkle',
            'path': 'sfx/sparkle.mp3',
            'kind': 'sfx',
            'seconds': 0.9,
            'render': sparkle,
            'source': 'Original for Jurasic Ranch, dedicated CC0',
            'notes': 'Three bell notes (E6/G6/C7), high partials rolled off',
        },
    ]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out-dir', type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument('--work-dir', type=Path, default=DEFAULT_WORK_DIR)
    parser.add_argument('--report', type=Path, default=DEFAULT_REPORT)
    parser.add_argument('--keep-intermediates', action='store_true')
    args = parser.parse_args(argv)

    args.work_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    for asset in assets():
        samples = asset['render']()
        peak = 0.9 if asset['kind'] == 'music' else 0.6
        # The loop must not be faded at its edges: bar 16 continues into bar 1.
        samples = normalize_peak(samples, peak)

        wav_path = args.work_dir / f'{asset["id"]}.wav'
        write_wav(wav_path, samples)

        out_path = args.out_dir / asset['path']
        out_path.parent.mkdir(parents=True, exist_ok=True)
        encode(wav_path, out_path)
        if not args.keep_intermediates:
            wav_path.unlink(missing_ok=True)

        duration = probe_duration(out_path)
        loudness = measure_integrated_loudness(out_path)
        if asset['kind'] == 'music' and not 30.0 <= duration <= 60.0:
            fail(f'{asset["id"]}: {duration:.2f}s is outside the 30-60 s music bound')
        if asset['kind'] == 'sfx' and duration > 2.0:
            fail(f'{asset["id"]}: {duration:.2f}s exceeds the 2 s SFX budget')
        rows.append(
            {
                'id': asset['id'],
                'path': out_path.relative_to(REPO_ROOT).as_posix(),
                'kind': asset['kind'],
                'bytes': out_path.stat().st_size,
                'durationSeconds': round(duration, 3),
                'loudnessLufs': round(loudness, 1) if loudness is not None else None,
                'source': asset['source'],
                'notes': asset['notes'],
            }
        )
        sys.stdout.write(f'{asset["id"]}: {duration:.2f}s  {rows[-1]["bytes"]} bytes\n')

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps({'assets': rows}, indent=2) + '\n', encoding='utf8')
    if not args.keep_intermediates:
        shutil.rmtree(args.work_dir, ignore_errors=True)
    sys.stdout.write(
        f'starter pack: {len(rows)} files, {sum(row["bytes"] for row in rows)} bytes, '
        f'report {args.report}\n'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
