// Runtime configuration, read once from the environment.
// Every knob has a safe default so `reelwright make` works with zero setup
// (manual script, local voice, local render).
import { resolve } from 'node:path';

const env = process.env;

function num(name, fallback) {
  const v = Number(env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function bool(name, fallback) {
  const v = env[name];
  if (v == null || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export function loadConfig(overrides = {}) {
  const dataDir = resolve(overrides.dataDir || env.REELWRIGHT_DATA_DIR || './data');
  return {
    dataDir,
    port: num('PORT', 8080),
    host: env.HOST || '0.0.0.0',
    // Web UI login. If empty on a server, `serve` generates one and prints it once.
    password: env.REELWRIGHT_PASSWORD || '',
    llm: {
      provider: (env.LLM_PROVIDER || 'none').toLowerCase(), // anthropic | openai | ollama | openrouter | none
      model: env.LLM_MODEL || '',
      baseUrl: env.LLM_BASE_URL || '',
      apiKey: env.LLM_API_KEY || env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY || '',
    },
    voice: {
      enabled: bool('VOICE_ENABLED', true),
      defaultVoice: env.VOICE_DEFAULT || 'af_heart',
      speed: num('VOICE_SPEED', 1),
    },
    captions: {
      // `estimate` spreads words over the voice clip (instant).
      // `whisper` aligns them with speech recognition (accurate, slow on CPU).
      align: (env.CAPTIONS_ALIGN || 'estimate').toLowerCase(),
      whisperModel: env.WHISPER_MODEL || 'small',
    },
    render: {
      quality: env.RENDER_QUALITY || 'looks', // draft | looks | delivery
      fps: num('RENDER_FPS', 30),
      timeoutMs: num('RENDER_TIMEOUT_MS', 60 * 60 * 1000),
    },
    // Label videos as AI-generated (on-screen badge + MP4 metadata). On by default:
    // see docs/legal.md before turning it off.
    disclosure: bool('AI_DISCLOSURE', true),
    ...overrides,
  };
}
