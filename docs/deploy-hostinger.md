# Deploy on Hostinger (or any VPS)

Reelwright is a Docker app. It needs a **VPS**. Shared or "web" hosting cannot run it, because rendering a video needs a headless browser, ffmpeg and a local voice model running for minutes at a time.

## Sizing

| Plan | Works? | What to expect |
|---|---|---|
| 1 vCPU / 4 GB (e.g. KVM 1) | Barely | Short videos only. Renders are slow, and Chrome can run out of memory on 1080p. |
| **2 vCPU / 8 GB (e.g. KVM 2)** | **Recommended minimum** | One render at a time. A 60 s 1080p video takes roughly a few minutes. |
| 4 vCPU / 16 GB (e.g. KVM 4) | Comfortable | Faster renders and room for `CAPTIONS_ALIGN=whisper`. |

There is no GPU on these plans; everything renders on the CPU. Render time grows with length, resolution and frame rate. For quicker drafts, use `RENDER_QUALITY=draft` or 24 fps.

> Measured reference: a 31-second 1080×1920 video took about 160 s to render on an Apple-silicon laptop (voice + captions + render). Expect a 2-vCPU VPS to be **slower**. Use the benchmark below to measure yours.

## One-click: Hostinger Docker Manager

1. Click **Deploy on Hostinger** in the README. It opens Hostinger's Docker hosting page with this project's `docker-compose.yml` preloaded.
2. Choose a VPS plan (KVM 2 or bigger).
3. When asked for environment variables, set:
   - `REELWRIGHT_PASSWORD`: the studio login. Required.
   - Optionally `LLM_PROVIDER` + `LLM_API_KEY` (and `LLM_MODEL`) so it can write scripts for you.
4. Open `http://<your-server-ip>:8080` and sign in.

## Manual: any VPS with Docker

```bash
# On the server
mkdir reelwright && cd reelwright
curl -fsSLO https://raw.githubusercontent.com/Kuan-AI-com/reelwright/main/docker-compose.yml
echo "REELWRIGHT_PASSWORD=$(openssl rand -base64 18)" > .env
docker compose up -d
docker compose logs -f   # wait for "Reelwright studio on …"
```

### HTTPS with your own domain

1. Point an `A` record (e.g. `video.example.com`) at the server's IP.
2. Run Reelwright behind Caddy:

```bash
curl -fsSLO https://raw.githubusercontent.com/Kuan-AI-com/reelwright/main/docker-compose.https.yml
echo "DOMAIN=video.example.com" >> .env
docker compose -f docker-compose.https.yml up -d
```

Caddy gets and renews the TLS certificate automatically. With HTTPS in front, the login cookie is marked `Secure`.

## Hardening checklist

- [ ] Use a long, random `REELWRIGHT_PASSWORD`. The login is rate-limited, but a strong password is the real defence.
- [ ] Prefer the HTTPS compose file. On plain HTTP the password crosses the network in clear text.
- [ ] Firewall: open only 80/443 (HTTPS setup) or 8080 (plain).
- [ ] Back up the `reelwright-data` volume. It holds the database, scripts and videos.
- [ ] Update with `docker compose pull && docker compose up -d`.

## Benchmark your server

```bash
docker compose exec reelwright node src/cli.mjs make \
  --storyboard examples/how-tides-work.json --out /data/bench.mp4
```

The command prints the render time. Divide it by the video length to get your seconds-per-second ratio.

## Troubleshooting

- **The render fails with "Target closed" or the browser crashes.** Chrome needs shared memory. The compose files set `shm_size: 1gb`; keep it. Also check that the VPS is not out of RAM (`free -h`).
- **No voice.** Run `docker compose exec reelwright node src/cli.mjs doctor`. It checks Python, Kokoro and ffmpeg.
- **The first render is slow.** The first run caches the voice model and fonts if the image build could not. Later renders are faster.
