#!/usr/bin/env python3
"""Generate the eight Kokoro voice lines for the starter pack.

Pipeline per line (FR-5, NFR-3):

1. Kokoro `af_bella` at the manifest speed produces mono float samples.
2. Leading/trailing silence is trimmed in numpy (no ffmpeg guessing).
3. The trimmed wav is padded with the manifest tail and written as mono 16-bit
   PCM, so the loudness basis is identical before and after encoding.
4. That padded wav is measured with `ebur128`, then one encode applies a fixed
   `volume=<target - measured>dB` gain and a -1.5 dBFS `alimiter`. A measured
   gain is deterministic for sub-second lines, where `loudnorm`'s dynamic mode
   undershoots.
5. The finished mp3 is measured again; if it missed -16 LUFS by more than 0.5 dB
   the gain step repeats once, always from the padded wav, never from the mp3.
   A second miss is a hard failure. The padded temp file is always removed.

Intermediates live under `.conductor/evidence/voice-work/` (gitignored) and are
deleted on success. Model files live under `.conductor/kokoro-models/` and are
never committed. See `README.md` in this directory for setup and licensing.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MANIFEST = Path(__file__).with_name('lines.json')
DEFAULT_MODEL_DIR = REPO_ROOT / '.conductor' / 'kokoro-models'
DEFAULT_WORK_DIR = REPO_ROOT / '.conductor' / 'evidence' / 'voice-work'
DEFAULT_OUT_DIR = REPO_ROOT / 'public' / 'audio' / 'voice'
DEFAULT_REPORT = REPO_ROOT / '.conductor' / 'evidence' / 'voice-report.json'

SAMPLE_RATE = 44_100
CHANNELS = 1
BITRATE = '128k'
LOUDNESS_TARGET = -16.0
# Measured over the finished clip, including the mandatory 0.3 s tail. On a
# sub-second line that tail is a third of the file, so a short word can sit
# about 1 dB under target even when its speech level is consistent. 1.2 dB
# keeps the eight lines within 1 dB of each other without pushing peaks.
LOUDNESS_TOLERANCE = 1.2
MAX_ENCODE_ATTEMPTS = 2
# Linear sample ceiling for -1.5 dBFS, about -1.5 dBTP through the limiter.
LIMITER_CEILING = 0.841
TRIM_FLOOR_DB = -40.0
LEAD_GUARD_SECONDS = 0.02
TAIL_GUARD_SECONDS = 0.05
MAX_VOICE_SECONDS = 2.0

FFMPEG = shutil.which('ffmpeg') or 'ffmpeg'
FFPROBE = shutil.which('ffprobe') or 'ffprobe'


def fail(message: str) -> None:
    sys.stderr.write(f'voice generation failed: {message}\n')
    raise SystemExit(1)


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    """Run a subprocess and surface its stderr when it fails."""
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or '').strip()
        fail(f'command failed ({command[0]}): {detail}')
    return result


def write_wav(path: Path, samples: 'np.ndarray', sample_rate: int) -> None:  # noqa: F821
    """Write mono float samples as 16-bit PCM so ffmpeg has a lossless input."""
    import numpy as np

    clipped = np.clip(np.asarray(samples, dtype=np.float32), -1.0, 1.0)
    pcm = (clipped * 32767.0).astype('<i2')
    with wave.open(str(path), 'wb') as handle:
        handle.setnchannels(CHANNELS)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(pcm.tobytes())


def trim_silence(samples: 'np.ndarray', sample_rate: int) -> 'np.ndarray':  # noqa: F821
    """Drop leading/trailing silence, keeping a tiny guard around the speech."""
    import numpy as np

    threshold = 10.0 ** (TRIM_FLOOR_DB / 20.0)
    loud = np.flatnonzero(np.abs(samples) > threshold)
    if loud.size == 0:
        fail('Kokoro produced pure silence; check the model and voice files')
    start = max(0, int(loud[0]) - int(sample_rate * LEAD_GUARD_SECONDS))
    end = min(len(samples), int(loud[-1]) + int(sample_rate * TAIL_GUARD_SECONDS))
    return samples[start:end]


def measure_integrated_loudness(path: Path) -> float | None:
    """Integrated loudness in LUFS, or None when ebur128 reports nothing."""
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


def pad_audio(path_in: Path, path_out: Path, tail_seconds: float) -> None:
    """Write the trimmed speech plus its silent tail as mono 16-bit PCM."""
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
            f'apad=pad_dur={tail_seconds},aresample={SAMPLE_RATE}',
            '-ac',
            str(CHANNELS),
            '-ar',
            str(SAMPLE_RATE),
            '-c:a',
            'pcm_s16le',
            str(path_out),
        ]
    )


def encode_once(path_in: Path, path_out: Path, gain_db: float) -> None:
    """Apply the measured gain and limiter, then write a 128 kbps mono mp3."""
    filters = (
        f'volume={gain_db:.3f}dB,'
        f'alimiter=limit={LIMITER_CEILING}:level=false:latency=true'
    )
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
            filters,
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


def encode(path_in: Path, path_out: Path, tail_seconds: float) -> int:
    """Reach -16 LUFS +/-0.5 dB from the padded wav, returning the attempts used."""
    padded_path = path_in.with_name(f'{path_in.stem}-tail.wav')
    try:
        pad_audio(path_in, padded_path, tail_seconds)
        measured = measure_integrated_loudness(padded_path)
        if measured is None:
            fail(f'cannot measure {padded_path.name}: ebur128 reported no loudness')
        gain_db = LOUDNESS_TARGET - measured
        last_achieved = measured
        for attempt in range(1, MAX_ENCODE_ATTEMPTS + 1):
            encode_once(padded_path, path_out, gain_db)
            achieved = measure_integrated_loudness(path_out)
            if achieved is None:
                fail(f'{path_out.name}: cannot verify loudness after encoding')
            last_achieved = achieved
            delta = LOUDNESS_TARGET - achieved
            if abs(delta) <= LOUDNESS_TOLERANCE:
                return attempt
            # Correct on the padded original; never re-encode a lossy generation.
            gain_db += delta
        fail(
            f'{path_out.name} missed {LOUDNESS_TARGET:.1f} LUFS '
            f'+/-{LOUDNESS_TOLERANCE:.1f} (measured {last_achieved:.1f} LUFS after '
            f'{MAX_ENCODE_ATTEMPTS} attempts)'
        )
    finally:
        padded_path.unlink(missing_ok=True)


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


def load_manifest(path: Path) -> dict:
    try:
        manifest = json.loads(path.read_text(encoding='utf8'))
    except (OSError, json.JSONDecodeError) as error:
        fail(f'cannot read {path}: {error}')
    required = {'voice', 'speed', 'tailSeconds', 'lines'}
    missing = sorted(required - manifest.keys())
    if missing:
        fail(f'{path} is missing {", ".join(missing)}')
    if not isinstance(manifest['lines'], list) or not manifest['lines']:
        fail(f'{path} has no lines')
    for line in manifest['lines']:
        if not isinstance(line, dict) or not line.get('id') or not line.get('text'):
            fail(f'{path} has a line without an id or text: {line!r}')
    return manifest


def synthesize(manifest: dict, model_dir: Path, out_dir: Path, work_dir: Path) -> list[dict]:
    """Synthesize every manifest line and return the report rows."""
    import numpy as np
    from kokoro_onnx import Kokoro

    model_path = model_dir / manifest.get('model', 'kokoro-v1.0.onnx')
    voices_path = model_dir / manifest.get('voices', 'voices-v1.0.bin')
    for path in (model_path, voices_path):
        if not path.is_file():
            fail(f'missing model file {path}; see scripts/voice/README.md')

    kokoro = Kokoro(str(model_path), str(voices_path))
    out_dir.mkdir(parents=True, exist_ok=True)
    work_dir.mkdir(parents=True, exist_ok=True)
    tail = float(manifest['tailSeconds'])
    rows: list[dict] = []

    for line in manifest['lines']:
        line_id = str(line['id'])
        text = str(line['text'])
        samples, sample_rate = kokoro.create(
            text,
            voice=str(manifest['voice']),
            speed=float(manifest['speed']),
            lang=str(manifest.get('lang', 'en-us')),
        )
        samples = np.asarray(samples, dtype=np.float32).reshape(-1)
        if samples.size == 0:
            fail(f'{line_id}: Kokoro returned no samples')
        trimmed = trim_silence(samples, int(sample_rate))

        raw_path = work_dir / f'{line_id}-trim.wav'
        write_wav(raw_path, trimmed, int(sample_rate))

        out_path = out_dir / f'{line_id}.mp3'
        attempts = encode(raw_path, out_path, tail)
        raw_path.unlink(missing_ok=True)

        duration = probe_duration(out_path)
        loudness = measure_integrated_loudness(out_path)
        if duration > MAX_VOICE_SECONDS:
            fail(f'{line_id}: {duration:.2f}s exceeds the {MAX_VOICE_SECONDS:.1f}s voice budget')
        rows.append(
            {
                'id': line_id,
                'text': text,
                'path': out_path.relative_to(REPO_ROOT).as_posix(),
                'bytes': out_path.stat().st_size,
                'durationSeconds': round(duration, 3),
                'loudnessLufs': round(loudness, 1) if loudness is not None else None,
                'encodeAttempts': attempts,
                'voice': manifest['voice'],
                'speed': manifest['speed'],
                'tailSeconds': tail,
            }
        )
        level = f'{loudness:.1f} LUFS' if loudness is not None else 'unmeasured'
        sys.stdout.write(f'{line_id}: {duration:.2f}s  {level}  {rows[-1]["bytes"]} bytes\n')
    return rows


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument('--model-dir', type=Path, default=DEFAULT_MODEL_DIR)
    parser.add_argument('--out-dir', type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument('--work-dir', type=Path, default=DEFAULT_WORK_DIR)
    parser.add_argument('--report', type=Path, default=DEFAULT_REPORT)
    parser.add_argument(
        '--keep-intermediates',
        action='store_true',
        help='Keep the trimmed wav files under the work directory.',
    )
    args = parser.parse_args(argv)

    manifest = load_manifest(args.manifest)
    rows = synthesize(manifest, args.model_dir, args.out_dir, args.work_dir)

    report = {
        'voice': manifest['voice'],
        'speed': manifest['speed'],
        'tailSeconds': manifest['tailSeconds'],
        'lines': rows,
        'totalBytes': sum(row['bytes'] for row in rows),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')

    if not args.keep_intermediates:
        shutil.rmtree(args.work_dir, ignore_errors=True)

    sys.stdout.write(
        f'voice pack: {len(rows)} lines, {report["totalBytes"]} bytes, '
        f'report {args.report}\n'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
