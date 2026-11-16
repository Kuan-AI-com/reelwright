# Third-party notices

Reelwright's own code is Apache-2.0 (see `LICENSE`). It installs or drives the software below, which keeps its own license. Most of it runs as a **separate program** (a child process or a browser), not linked into Reelwright.

This file is a good-faith summary, not legal advice. The license files shipped with each component are what governs.

## npm dependencies (installed by `npm install`)

| Component | License | How it is used |
|---|---|---|
| [HyperFrames](https://hyperframes.heygen.com) (`hyperframes`) | Apache-2.0 | Run as a CLI child process: render, text-to-speech, transcription, checks. Reelwright turns its telemetry off (`HYPERFRAMES_NO_TELEMETRY=1`, `DO_NOT_TRACK=1`). |
| `@anthropic-ai/sdk` | MIT | Optional script writer when `LLM_PROVIDER=anthropic`. |
| Transitive deps (puppeteer-core, etc.) | MIT / Apache-2.0 / BSD / ISC | Run `npx license-checker --summary` for the full list. |

## Bundled in the Docker image

| Component | License | Notes |
|---|---|---|
| Node.js (official `node:22-bookworm-slim` image) | MIT + bundled licenses | Base image. |
| Debian bookworm packages | Various (see `/usr/share/doc/*/copyright` inside the image) | |
| **FFmpeg** (Debian build) | **GPL-2.0-or-later** (the Debian build enables GPL parts) | Run as a separate program to encode, mux audio, write metadata and make posters. |
| **Chromium** (Debian package) | BSD-3-Clause + bundled third-party licenses | Headless browser that HyperFrames drives to capture frames. |
| Python 3 + `venv` | PSF-2.0 | Runs the local TTS. |
| [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) | MIT | Local text-to-speech runtime. |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) model weights and voices | Apache-2.0 | Downloaded on first use (or at image build). |
| ONNX Runtime | MIT | Dependency of kokoro-onnx. |
| **eSpeak NG** (via `espeakng-loader`) | **GPL-3.0-or-later** | Turns text into phonemes for Kokoro. Runs in the separate Python TTS process. |
| `phonemizer` | GPL-3.0 | Phonemizer used by kokoro-onnx. Runs in the same separate process. |
| `soundfile` / libsndfile | BSD-3-Clause / LGPL-2.1-or-later | Writes WAV files. |
| whisper.cpp + Whisper models (only if `CAPTIONS_ALIGN=whisper`) | MIT | Word-level caption alignment, downloaded on first use. |
| Fonts: Inter, Playfair Display, Archivo Black | SIL Open Font License 1.1 | Theme fonts, fetched and cached by HyperFrames at render time. |
| Fonts: Noto (core, CJK, color emoji), Liberation | SIL OFL 1.1 | Fallback fonts for every language. |
| tini | MIT | Init process. |
| Caddy (only `docker-compose.https.yml`) | Apache-2.0 | Separate container for HTTPS. |

### GPL components and source code

The image contains GPL-licensed programs (FFmpeg as built by Debian, eSpeak NG, phonemizer). Reelwright does not link to them. It runs them as separate programs, which makes the image an *aggregate* in the GPL's sense. Their licenses still apply to those programs:

- **Debian packages** (FFmpeg, eSpeak NG data, …): the exact source for every package in the image is on [sources.debian.org](https://sources.debian.org/) and the Debian snapshot archive. You can list the installed versions with `dpkg -l` inside the container.
- **Python packages**: their source is on PyPI next to each wheel, and in each project's repository linked above.
- If you redistribute the image and need a written offer for the corresponding source, open an issue in this repository. The maintainers will provide it for at least three years from the date of each image release.

## Outputs

Videos rendered by Reelwright belong to whoever made them. Rendering through these tools puts no license on your video. Two caveats:

- **Fonts** are embedded as rendered pixels, which the OFL allows.
- **Music and images you add** keep their own licenses. See `docs/legal.md`.
