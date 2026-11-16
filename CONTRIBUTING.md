# Contributing

Thanks for helping! Small, focused PRs are easiest to review.

## Setup

```bash
npm install
npm run doctor     # ffmpeg, browser, local voice, LLM
npm run check      # syntax check + tests (no network, no rendering)
npm run dev        # studio with auto-reload on :8080
```

Rendering a real video needs ffmpeg and Python 3.10–3.13; `npx reelwright make --storyboard examples/how-tides-work.json --quality draft` is the quickest end-to-end check.

## Where things live

| Path | What |
|---|---|
| `src/storyboard.mjs` | Storyboard schema, validation, plain-text import |
| `src/timing.mjs` | Scene timeline, caption grouping, SRT |
| `src/compose/` | HTML composition: themes, scene templates, runtime animation |
| `src/pipeline.mjs` | draft → voice → compose → render → finalize |
| `src/voice.mjs`, `src/render.mjs`, `src/hf.mjs` | Local TTS, render + ffmpeg finalize, HyperFrames child process |
| `src/db.mjs`, `src/jobs.mjs` | `node:sqlite` storage, render queue |
| `src/server.mjs`, `web/` | Studio API and front end (no build step) |
| `skills/reelwright/` | Agent skill — keep it in sync with schema changes |

## Good first contributions

- **A new scene type**: add it to `SCENE_TYPES` in `src/storyboard.mjs`, a template in `src/compose/index.mjs`, styles in `src/compose/themes.mjs`, a test, and a row in `docs/storyboard.md` + the skill reference.
- **A theme**: palette + fonts in `src/compose/themes.mjs`. Fonts must be OFL or similarly licensed.
- **A voice language**, once Kokoro supports it.

## Rules

- No new runtime dependency without a good reason; prefer Node built-ins. Every dependency must have an OSI-approved license compatible with Apache-2.0, and be listed in `THIRD_PARTY_NOTICES.md` if it ships in the image.
- Animation must stay deterministic (no `Date.now()`, no unseeded randomness, no network in compositions).
- Don't weaken the AI-disclosure defaults.
- By contributing you agree your contribution is licensed under Apache-2.0.
