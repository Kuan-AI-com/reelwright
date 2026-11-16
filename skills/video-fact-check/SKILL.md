---
name: video-fact-check
description: Verify every number, date, quote and claim in a video script or storyboard before it is rendered or published — find primary sources, fix or remove what can't be verified, word uncertainty honestly, and fill the on-screen source fields. Use before rendering any AI-drafted video, for any script with statistics or quotes, and always for health, finance, legal, science or news topics.
---

# Video fact check

LLM-drafted scripts are fluent and often wrong in small, confident ways: a rounded number that became a different number, a quote attached to the wrong famous person, a study that doesn't exist. A wrong fact on screen is worse than no fact.

## Procedure

1. **Extract claims.** List every checkable item: numbers (in `stat`, `bars` and narration), dates, names, quotes and authors, superlatives ("the largest", "the first"), causal claims ("X causes Y").
2. **Verify each** against a source, in this order of preference:
   1. Primary: the agency, the dataset, the paper, the company's filing, the person's own text.
   2. Reputable secondary: major encyclopedias, established newspapers, textbooks — and follow them to the primary when you can.
   3. Never: content farms, AI-generated summaries, quote aggregator sites (most famous misattributions live there).
3. **Decide per claim:**
   - ✅ Verified → keep; put a short source on screen (`"source": "USGS, 2019"`).
   - ≈ Verified but rounded/old → round honestly in narration ("about a third"), exact figure + year on screen.
   - ❓ Can't verify in reasonable time → remove the number and say the idea in words, or drop the scene. Do **not** keep it "because it's probably right".
   - ❌ Wrong → fix it, or remove it if the scene's point depended on it.
4. **Quotes:** require the original context (book, speech, letter, date). If the only sources are quote sites, it is probably misattributed — drop it or say "often attributed to…" and keep it off the `author` field.
5. **Superlatives and causality:** soften unless the source says it exactly ("one of the largest", "is linked to" vs "causes").
6. **Report** a short table: claim → verdict → source. Put it in the video's notes (Reelwright studio: the Notes field) so the editor can see what was checked.

## Sensitive topics

Health, medicine, finance, law, elections, current events: platforms apply stricter rules and wrong claims cause harm.
- Use only primary or official sources.
- No advice phrased as instructions to the individual ("you should stop taking…").
- Date-stamp anything that changes ("as of 2026").

## Source field style

Short and checkable: `"USGS Water Science School"`, `"OECD, 2024"`, `"NOAA"`. Not a URL, not "studies show", not "experts".
