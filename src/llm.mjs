// Script writer: topic → storyboard JSON.
// Providers:
//   anthropic  — official @anthropic-ai/sdk, structured outputs (schema-valid JSON)
//   openai     — any OpenAI-compatible /chat/completions endpoint (OpenAI, OpenRouter,
//   openrouter   Ollama, LM Studio, vLLM, llama.cpp server…)
//   ollama
//   none       — no LLM; write the script yourself (text or storyboard JSON)
import { STORYBOARD_JSON_SCHEMA, SCENE_TYPES, validateStoryboard } from './storyboard.mjs';

const DEFAULTS = {
  anthropic: { model: 'claude-opus-5-5' },
  openai: { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
  openrouter: { model: null, baseUrl: 'https://openrouter.ai/api/v1' }, // pick any model id with LLM_MODEL
  ollama: { model: 'llama3.1', baseUrl: 'http://localhost:11434/v1' },
};

export function describeLlm(llm) {
  if (!llm || llm.provider === 'none') return 'none (manual script)';
  const d = DEFAULTS[llm.provider] || {};
  return `${llm.provider} · ${llm.model || d.model || 'set LLM_MODEL'}`;
}

export function systemPrompt() {
  const types = Object.entries(SCENE_TYPES)
    .map(([k, v]) => `- ${k}: ${v.about} Fields: ${[...v.req.map((f) => f + ' (required)'), ...v.opt].join(', ')}`)
    .join('\n');
  return `You write storyboards for short narrated explainer videos with animated motion graphics.

Return one JSON object: {"title": string, "scenes": [...]}. Each scene has a "type", a "narration" (what the voice says while the scene is on screen) and the fields its type uses:
${types}

How a good storyboard reads:
- The first scene is a "title" that states the hook in a few words. The last is an "outro" with one clear takeaway or call to action.
- Narration is spoken language: short sentences, no markdown, no emoji, no URLs, numbers written the way a person says them. 1-3 sentences per scene.
- On-screen text supports the narration instead of repeating it word for word. Headings stay under 8 words; list items under 9 words.
- Use "stat" and "bars" only for figures you are confident are accurate, and put where the figure comes from in "source". If you are not sure of a number, describe the idea in words instead. Never invent statistics, quotes or sources.
- Use "quote" only for a real, well-known quote you can attribute correctly, or leave it out.
- Vary the scene types so the video has rhythm. Leave out fields a scene type does not use.`;
}

export function userPrompt({ topic, language = 'en', targetSeconds = 60, notes = '' }) {
  const scenes = Math.max(3, Math.min(14, Math.round(targetSeconds / 8)));
  return `Topic: ${topic}
Language for narration and on-screen text: ${language}
Target length: about ${targetSeconds} seconds, roughly ${scenes} scenes (about ${Math.round(targetSeconds * 2.4)} spoken words in total).${notes ? `\nNotes from the editor: ${notes}` : ''}`;
}

function extractJson(text) {
  if (!text) throw new Error('the model returned an empty answer');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('the model did not return JSON');
  return JSON.parse(body.slice(start, end + 1));
}

async function anthropicDraft(llm, brief) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic(llm.apiKey ? { apiKey: llm.apiKey } : {});
  const stream = client.messages.stream({
    model: llm.model || DEFAULTS.anthropic.model,
    max_tokens: 16000,
    system: systemPrompt(),
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: STORYBOARD_JSON_SCHEMA },
    },
    messages: [{ role: 'user', content: userPrompt(brief) }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error('the model declined to write this script; try rephrasing the topic');
  if (message.stop_reason === 'max_tokens') throw new Error('the script was cut off; ask for a shorter video');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return extractJson(text);
}

async function openAiCompatibleDraft(llm, brief) {
  const d = DEFAULTS[llm.provider] || DEFAULTS.openai;
  const baseUrl = (llm.baseUrl || d.baseUrl).replace(/\/$/, '');
  const headers = { 'content-type': 'application/json' };
  if (llm.apiKey) headers.authorization = `Bearer ${llm.apiKey}`;
  const body = {
    model: llm.model || d.model,
    messages: [
      { role: 'system', content: systemPrompt() + '\n\nReply with the JSON object only.' },
      { role: 'user', content: userPrompt(brief) },
    ],
    response_format: { type: 'json_object' },
  };
  const res = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(300_000) });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`${llm.provider} answered ${res.status}: ${detail}`);
  }
  const json = await res.json();
  return extractJson(json.choices?.[0]?.message?.content || '');
}

/**
 * Ask the configured LLM for a storyboard. Retries once with the validation
 * errors if the first draft does not pass.
 */
export async function draftStoryboard(llm, brief, defaults = {}) {
  if (!llm || llm.provider === 'none') {
    throw new Error('no LLM configured: set LLM_PROVIDER (anthropic, openai, openrouter, ollama) or write the script yourself');
  }
  if (!llm.model && !DEFAULTS[llm.provider]?.model) {
    throw new Error(`LLM_MODEL is required for provider "${llm.provider}" (use a model id from your provider's catalog)`);
  }
  const call = llm.provider === 'anthropic' ? anthropicDraft : openAiCompatibleDraft;
  let raw = await call(llm, brief);
  let result = validateStoryboard({ ...raw, language: brief.language }, defaults);
  if (!result.ok) {
    const retry = { ...brief, notes: `${brief.notes || ''}\nYour previous draft had these problems, fix them: ${result.errors.slice(0, 12).join('; ')}`.trim() };
    raw = await call(llm, retry);
    result = validateStoryboard({ ...raw, language: brief.language }, defaults);
  }
  if (!result.ok) throw new Error(`the model's storyboard did not validate: ${result.errors.slice(0, 5).join('; ')}`);
  return result.storyboard;
}
