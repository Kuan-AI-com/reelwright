# Studio HTTP API

All endpoints are JSON. Authenticate once, keep the cookie.

```bash
B=http://localhost:8080
curl -c jar -H 'content-type: application/json' -d '{"password":"…"}' $B/api/login
```

| Method & path | Body | Result |
|---|---|---|
| `GET /api/config` | — | voices, themes, aspects, scene types, LLM status |
| `GET /api/videos` | — | `{videos:[…], rendering:id\|null}` |
| `POST /api/videos` | `{storyboard}` or `{text, language, aspect, theme, voice}` or `{topic, draft:true, seconds, language…}` | the new video (status `review`, or `idea`/`drafting`) |
| `GET /api/videos/:id` | — | one video (status, stage, progress 0–100, error, storyboard) |
| `PATCH /api/videos/:id` | `{storyboard}` / `{notes}` / `{published_url}` / `{status}` | editorial moves only: review→idea, ready→published, published→ready, failed→review |
| `POST /api/videos/:id/draft` | `{notes?}` | (re)draft the script with the LLM |
| `POST /api/videos/:id/render` | — | queue the render (status `queued` → `rendering` → `ready` or `failed`) |
| `POST /api/videos/:id/cancel` | — | cancel a queued or running render |
| `DELETE /api/videos/:id` | — | delete the video and its files |
| `POST /api/preview` | `{storyboard}` | `{url, duration}`: a silent HTML preview (30 min) |
| `GET /files/:id/video.mp4` · `poster.jpg` · `video.srt` | — | outputs; add `?download` for an attachment |

Poll `GET /api/videos/:id` every few seconds while rendering. A storyboard that fails validation returns `422` with `errors: ["scenes[1].items is required", …]`.
