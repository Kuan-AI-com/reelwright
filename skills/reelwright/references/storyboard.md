# Storyboard reference

A storyboard is one JSON object. Unknown fields are ignored; every problem is reported with its path.

## Top level

| Field | Type | Default | Notes |
|---|---|---|---|
| `title` | string ≤ 120 | — required | Used for the file name, metadata and the studio. |
| `language` | `xx` or `xx-YY` | `en` | Drives the caption number format and the AI label language. |
| `aspect` | `16:9` \| `9:16` \| `1:1` | `16:9` | 1920×1080, 1080×1920, 1080×1080. |
| `theme` | `midnight` \| `paper` \| `signal` | `midnight` | Dark navy + cyan · warm editorial paper + red · loud black + yellow. |
| `voice` | Kokoro voice id | by language | `af_heart` `af_nova` `af_sky` `am_adam` `am_michael` `bf_emma` `bf_isabella` `bm_george` (en) · `ef_dora` (es) · `ff_siwis` (fr) · `jf_alpha` (ja) · `zf_xiaobei` (zh) |
| `captions` | boolean | `true` | Burned-in, word-highlighted captions. An `.srt` is always written. |
| `music` | `{ "src": "file.mp3", "volume": 0–1 }` | none | Path relative to the storyboard, or a name in `<data>/music/`. Ducked under the voice at `volume` (default 0.15). Only use music you have rights to. |
| `scenes` | array, 1–30 | — required | |

## Every scene

| Field | Notes |
|---|---|
| `type` | One of the types below. |
| `narration` | ≤ 700 chars. Spoken over the scene; the scene lasts as long as its narration (plus a short lead-in/tail, with a per-type minimum). |

## Scene types

| Type | Required | Optional | Shows |
|---|---|---|---|
| `title` | `heading` (≤ 90) | `subheading` (≤ 140) | Big opening card. |
| `bullets` | `heading`, `items` (2–5 strings ≤ 90) | — | Points revealed one by one. |
| `stat` | `value` (number), `label` (≤ 80) | `prefix`, `suffix`, `decimals` (0–3), `source` | A number that counts up. |
| `bars` | `heading`, `bars` (2–6 × `{label, value}`) | `unit`, `source` | Horizontal bar chart, values shown at the end of each bar. |
| `quote` | `quote` (≤ 240) | `author` | Pull quote. |
| `compare` | `left`, `right` (each `{title, text ≤ 160}`) | `heading` | Two cards side by side. |
| `outro` | `heading` | `subheading` | Closing card / call to action. |

## Timing

Scene duration = max(type minimum, 0.35 s lead-in + spoken length + 0.65 s tail), plus 0.4 s per bullet beyond three. Spoken length comes from the actual voice clip (or an estimate of ~2.5 words/s when rendering silent). Captions group 6 words / 34 chars (4 / 22 in 9:16).
## Slop check

`reelwright lint storyboard.json` (and the studio's *Slop check* panel) scores a storyboard from 0 to 100 and lists what to fix:

| Rule | Severity | Example |
|---|---|---|
| `slop.opener` | warn | "In today's fast-paced world", "Have you ever wondered", "Let's dive in", "En el mundo actual" |
| `slop.hype` | warn | game-changer, unlock, delve, seamless, revolucionario |
| `slop.ending` | warn | "The possibilities are endless", "In conclusion", "like and subscribe" |
| `slop.not-x-but-y` | warn | "It's not just a habit, it's a lifestyle" |
| `facts.unsourced` / `facts.unattributed` | error | a `stat` or `bars` scene without `source`, a `quote` without `author` |
| `screen.repeats-voice` | warn | on-screen text that is a word-for-word piece of the narration |
| `pace.long-scene` / `pace.long-sentence` | warn / info | more than 48 words in a scene, more than 28 in a sentence |
| `voice.questions` / `voice.exclamations` / `voice.dashes` | warn / info | more than 3 questions, more than 1 "!", more than 2 em dashes |
| `rhythm.repeat` / `rhythm.slideshow` | info / warn | three scenes of the same type in a row; mostly bullet lists |

It is a heuristic: a clean score doesn't make a script good, but a low one usually means it sounds generated. `--json` prints machine-readable findings; the exit code is 1 when there are errors.
