---
name: video-script-doctor
description: Rewrite a narrated video script or storyboard so it stops sounding AI-written — kills stock openers, hype words, "it's not X, it's Y", empty endings, rhetorical-question chains and on-screen text that repeats the voice; makes it specific, spoken and tight. Use when a script feels generic, "AI slop", flat or too long, or before rendering any LLM-drafted video.
---

# Video script doctor

Goal: a script a viewer would believe a sharp human wrote and **said out loud**. Work on the storyboard JSON (Reelwright) or on plain narration text — the rules are the same.

## Loop

1. **Measure.** If Reelwright is available: `reelwright lint storyboard.json` (add `--json` for machine output). It flags stock phrases, hype, unsourced numbers, repeated on-screen text, pacing. Treat its score as a floor, not the goal.
2. **Diagnose** with the checklist below — the linter can't catch vagueness.
3. **Rewrite** scene by scene. Change as little as needed; keep facts and sources intact.
4. **Read it aloud** (or at ~150 words per minute in your head). Any sentence you would not say to a friend gets rewritten.
5. Re-run the lint. Report what you changed in one line per scene.

## The checklist

**Hook (first 3 seconds)**
- Starts with the most surprising *specific* thing: a number, an image, a contradiction. "Your phone knows where you are to within five metres — using clocks, not maps."
- Never: "In today's world…", "Have you ever wondered…", "Let's dive in", "In this video we'll…", "Imagine a world…". Spanish: "En el mundo actual…", "¿Alguna vez te has preguntado…?", "Sumerjámonos", "En este video vamos a…".

**Specific beats general**
- Replace every adjective that could describe anything ("amazing", "huge", "incredible", "crucial") with the fact that made you want to use it.
- Name things: which country, which year, which study, which product.
- Comparisons the viewer can picture: "the weight of two cars", not "very heavy".

**Spoken, not written**
- Sentences under ~20 words. One idea per sentence.
- Numbers as said: "about four in ten", not "41.7%" — keep the exact figure for the on-screen `stat`.
- No parentheses, abbreviations, URLs, emoji, em dashes (TTS reads them badly and they read as AI).

**Kill the AI tells**
- Hype verbs/nouns: unlock, unleash, harness, elevate, delve, tapestry, landscape, game-changer, revolutionary, seamless, robust, pivotal. Spanish: revolucionario, innovador, sin precedentes, potenciar, desbloquear.
- "It's not X, it's Y" / "No es solo X, es Y" — say Y.
- Triplets for rhythm's sake ("fast, simple, and powerful"). Keep a list only if all three items carry information.
- Rhetorical question chains. One question max, and answer it immediately.
- Fake enthusiasm: more than one "!" in the whole video.

**Screen vs voice**
- Screen shows the *gist* (≤ 8 words), the number, or the contrast. Voice carries the sentence. Never the same words on both, except a quote being read.
- Every `stat`/`bars` scene has a real `source`. No source → turn it into words or delete it.

**Ending**
- One takeaway the viewer can repeat, or one concrete action. Never "the possibilities are endless", "only time will tell", "in conclusion", "like and subscribe".

**Length**
- ~150 spoken words per minute. If over target, cut whole scenes, not words from every scene.

## Before / after

> ❌ "Have you ever wondered about the fascinating world of tides? Let's dive in!"
> ✅ "The ocean rises twice a day, not once. That second tide is the interesting part."

> ❌ "It's not just a battery, it's a revolution in how we store energy."
> ✅ (for a hypothetical product) "It charges in twelve minutes and still holds most of its capacity after thousands of cycles." — then put the exact, sourced figures on screen.

Every number in a rewrite must come from the original script or a verified source; see the `video-fact-check` skill.
