# Reelwright — self-hosted AI video studio.
# One image: web studio + render worker + local voice (Kokoro) + ffmpeg + headless Chrome.
FROM node:22-bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive
# ffmpeg: encoding. chromium: the open-source browser HyperFrames drives (Debian
# package: redistributable, amd64 + arm64). Fonts: Latin + CJK + emoji so every
# language renders. python3: local TTS.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates tini chromium \
      python3 python3-venv \
      fonts-liberation fonts-noto-core fonts-noto-cjk fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Local text-to-speech (Kokoro-82M via kokoro-onnx, Apache-2.0 / MIT).
RUN python3 -m venv /opt/tts && /opt/tts/bin/pip install --no-cache-dir kokoro-onnx soundfile

ENV NODE_ENV=production \
    HYPERFRAMES_PYTHON=/opt/tts/bin/python \
    HYPERFRAMES_BROWSER_PATH=/usr/bin/chromium \
    HYPERFRAMES_CACHE_DIR=/opt/hf-cache \
    HYPERFRAMES_NO_TELEMETRY=1 \
    HYPERFRAMES_NO_UPDATE_CHECK=1 \
    DO_NOT_TRACK=1 \
    REELWRIGHT_DATA_DIR=/data \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY web ./web
COPY scripts ./scripts
COPY examples ./examples
COPY skills ./skills
COPY LICENSE NOTICE THIRD_PARTY_NOTICES.md README.md ./

# Bake the voice model and the fonts into the image (best-effort).
RUN mkdir -p /opt/hf-cache /data && node scripts/warmup.mjs || true \
    && chown -R node:node /opt/hf-cache /data

USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/cli.mjs", "serve"]
