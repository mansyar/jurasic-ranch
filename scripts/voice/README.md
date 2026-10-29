# Voice line generation

The eight spoken lines (`hello`, `nom`, `all-done`, `count-1` … `count-5`) are
pre-rendered at build time with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M)
through the ONNX runtime. Nothing is synthesized at runtime and no network
request is made by the game.

- Voice: `af_bella`, speed `0.85`, `en-us`
- Text: `lines.json` — the single source of truth for the eight ids and texts
- Output: `public/audio/voice/<id>.mp3`, mono 44.1 kHz, 128 kbps, ≤ 2 s
  including a 0.3 s tail, normalized to −16 LUFS

## One-time setup

```bash
python -m venv .conductor/kokoro-venv
.conductor/kokoro-venv/Scripts/python.exe -m pip install kokoro-onnx==0.6.1 onnxruntime numpy phonemizer
ffmpeg -version
```

Both `ffmpeg` and `ffprobe` must be on `PATH` (the pipeline uses `loudnorm`,
`apad`, `ebur128`, and `libmp3lame`).

Download the model files into `.conductor/kokoro-models/` (gitignored, roughly
325 MB, never committed):

```bash
curl.exe -L --fail --output .conductor/kokoro-models/kokoro-v1.0.onnx \
  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl.exe -L --fail --output .conductor/kokoro-models/voices-v1.0.bin \
  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

## Generate

```bash
.conductor/kokoro-venv/Scripts/python.exe scripts/voice/generate.py
```

The script synthesizes one line at a time, trims silence, applies two-pass
`loudnorm`, pads the tail, encodes the mp3, and fails if any line exceeds the
2 s budget. It writes a measurement report to
`.conductor/evidence/voice-report.json` and leaves no wav intermediates behind.

Useful flags: `--manifest`, `--model-dir`, `--out-dir`, `--keep-intermediates`.

## License notes

- **Kokoro-82M** model and voices: Apache-2.0. The generated audio is a model
  output and is shipped with the game; the model weights are downloaded for the
  build only and are not redistributed in this repository.
- **kokoro-onnx** (the runtime wrapper): MIT.
- Voice text in `lines.json` is original to this project.
- Regenerating overwrites `public/audio/voice/*.mp3`; the committed files are
  the reviewed, shipped pack. Re-run `pnpm audio:check` (or `pnpm verify`) after
  regenerating.
