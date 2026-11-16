---
name: reelwright
description: Make narrated, captioned motion-graphics videos (explainers, data stories, shorts) from a topic or a script with the Reelwright CLI — write or fix a storyboard JSON, render it to MP4 with local voice and captions, or drive a Reelwright studio over its HTTP API. Use when someone asks for an explainer video, a vertical short, a "video about X", or to render/edit a Reelwright storyboard.
---

# Reelwright

Reelwright turns a **storyboard** (a small JSON file: title + scenes, each with on-screen content and the narration spoken over it) into an MP4 with a local AI voice, word-highlighted captions, an AI-disclosure label and an `.srt` file. Rendering is deterministic (HyperFrames + headless Chrome + ffmpeg).

## Pick the path

| Situation | Do this |
|---|---|
| A topic, and an LLM key is configured | `reelwright draft "<topic>" --out sb.json`, review sb.json, then `reelwright make --storyboard sb.json` |
| A topic, no LLM configured, or you are the writer | Write the storyboard yourself (rules below), validate, `make --storyboard` |
| A finished script in prose | `reelwright make --text script.txt` (first line = title, one paragraph per scene) |
| A running studio | Use the HTTP API (see `references/api.md`) |

Run `reelwright doctor` first on a new machine: it checks ffmpeg, the browser, the local voice and the LLM settings. Inside a clone of the repo use `node src/cli.mjs` instead of `reelwright`.

## Writing a storyboard

Full schema with every field and limit: `references/storyboard.md`. The essentials:

```json
{
  "title": "How tides work",
  "language": "en",
  "aspect": "16:9",
  "theme": "midnight",
  "voice": "af_heart",
  "captions": true,
  "scenes": [
    { "type": "title", "heading": "Why the sea rises twice a day", "narration": "Twice a day, the ocean rises and falls. Here is why." },
    { "type": "stat", "value": 46, "suffix": "%", "label": "of the Moon's pull is what the Sun adds", "source": "NOAA", "narration": "..." },
    { "type": "outro", "heading": "Two bulges, one spinning planet", "narration": "..." }
  ]
}
```

Scene types: `title`, `bullets`, `stat`, `bars`, `quote`, `compare`, `outro`.

Rules that make videos good (and keep them honest):

1. **One idea per scene.** Narration of 1–3 sentences (about 6–18 s spoken). The screen shows the *gist*, the voice gives the detail. Never put the narration text on screen verbatim.
2. **Write for the ear.** Short sentences, numbers spelled the way they are said ("forty six percent"), no parentheses, no URLs, no abbreviations a voice would stumble on.
3. **Never invent facts.** Every `stat` and `bars` scene needs a real `source` you can name. Quotes need a real, correctly attributed author — if unsure, drop the quote scene. If you cannot verify a number, say so to the person instead of guessing.
4. **Open with a hook, close with a payoff.** First scene `title` with a question or tension; last scene `outro` that answers it.
5. **Length:** about 150 spoken words per minute. A 60 s video ≈ 5–7 scenes.
6. **Vertical (`9:16`)** for Shorts/Reels/TikTok: fewer words on screen, max 4 bullets.
7. Voice must match `language` (e.g. `ef_dora` for `es`). `reelwright voices` lists them.

Before rendering, run the slop check and fix what it finds: `reelwright lint sb.json` (stock openers, hype words, "it's not X, it's Y", unsourced numbers, on-screen text repeating the voice, pacing). For deeper passes, the companion skills in this folder: `video-storytelling` (structure), `video-script-doctor` (de-slop the writing), `video-fact-check` (verify every number and quote).

Validate before rendering — the CLI prints every problem with its path (`scenes[2].bars is required`), fix them all and retry:

```bash
reelwright make --storyboard sb.json --out video.mp4
```

Output: `video.mp4`, `video.srt` next to it. Rendering takes roughly 2–5× the video length on a laptop CPU; run it in the background for long videos and tell the person it is rendering.

## After rendering

- Look at a few frames before you report success: `ffmpeg -ss 5 -i video.mp4 -frames:v 1 frame.png`.
- Tell the person the video carries an "AI-generated" label and metadata, and that they should also tick the platform's AI/synthetic-content box when uploading (see `docs/legal.md` in the repo).
- Do not remove the AI-disclosure label (`AI_DISCLOSURE=false`) unless the person explicitly asks and understands they take over disclosure.

## Don't

- Don't add music unless the person provides a file they have rights to (`"music": {"src": "track.mp3", "volume": 0.15}`).
- Don't clone or imitate real people's voices; only the bundled voices.
- Don't edit files in the render work directory to "fix" a video — fix the storyboard and render again.
