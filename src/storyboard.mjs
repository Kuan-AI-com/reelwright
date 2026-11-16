// The storyboard is the contract between every stage of the pipeline:
// the LLM writes it, people edit it in the studio, the composer turns it into
// HyperFrames HTML. Validation lives here, in one place, and returns readable
// errors instead of throwing on the first problem.

export const ASPECTS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

export const THEMES = ['midnight', 'paper', 'signal'];

export const VOICES = [
  { id: 'af_heart', lang: 'en', label: 'Heart (US, female)' },
  { id: 'af_nova', lang: 'en', label: 'Nova (US, female)' },
  { id: 'af_sky', lang: 'en', label: 'Sky (US, female)' },
  { id: 'am_adam', lang: 'en', label: 'Adam (US, male)' },
  { id: 'am_michael', lang: 'en', label: 'Michael (US, male)' },
  { id: 'bf_emma', lang: 'en', label: 'Emma (UK, female)' },
  { id: 'bf_isabella', lang: 'en', label: 'Isabella (UK, female)' },
  { id: 'bm_george', lang: 'en', label: 'George (UK, male)' },
  { id: 'ef_dora', lang: 'es', label: 'Dora (Spanish, female)' },
  { id: 'ff_siwis', lang: 'fr', label: 'Siwis (French, female)' },
  { id: 'jf_alpha', lang: 'ja', label: 'Alpha (Japanese, female)' },
  { id: 'zf_xiaobei', lang: 'zh', label: 'Xiaobei (Chinese, female)' },
];

const DEFAULT_VOICE_BY_LANG = { en: 'af_heart', es: 'ef_dora', fr: 'ff_siwis', ja: 'jf_alpha', zh: 'zf_xiaobei' };

export function defaultVoiceFor(language, fallback = 'af_heart') {
  return DEFAULT_VOICE_BY_LANG[(language || '').slice(0, 2).toLowerCase()] || fallback;
}

// Field specs per scene type. `req` fields must be present and non-empty.
export const SCENE_TYPES = {
  title: { req: ['heading'], opt: ['subheading'], about: 'Opening card: big heading, optional kicker line.' },
  bullets: { req: ['heading', 'items'], opt: [], about: 'Heading plus 2-5 short points revealed in order.' },
  stat: { req: ['value', 'label'], opt: ['prefix', 'suffix', 'decimals', 'source'], about: 'One big number that counts up, with a label.' },
  bars: { req: ['heading', 'bars'], opt: ['unit', 'source'], about: 'Horizontal bar chart, 2-6 bars.' },
  quote: { req: ['quote'], opt: ['author'], about: 'A pull quote with attribution.' },
  compare: { req: ['left', 'right'], opt: ['heading'], about: 'Two columns side by side: before/after, A vs B.' },
  outro: { req: ['heading'], opt: ['subheading'], about: 'Closing card with a call to action.' },
};

const LIMITS = { title: 120, narration: 700, heading: 90, subheading: 140, item: 90, label: 80, quote: 240, text: 160 };

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

function str(errors, path, v, max, required) {
  if (v == null || v === '') {
    if (required) errors.push(`${path} is required`);
    return undefined;
  }
  if (typeof v !== 'string') {
    errors.push(`${path} must be text`);
    return undefined;
  }
  const s = v.trim().replace(/\s+/g, ' ');
  if (s.length > max) errors.push(`${path} is ${s.length} characters; keep it under ${max}`);
  return s;
}

function normalizeScene(raw, i, errors) {
  const p = `scenes[${i}]`;
  if (!raw || typeof raw !== 'object') {
    errors.push(`${p} must be an object`);
    return null;
  }
  const type = raw.type;
  const spec = SCENE_TYPES[type];
  if (!spec) {
    errors.push(`${p}.type "${type}" is not one of: ${Object.keys(SCENE_TYPES).join(', ')}`);
    return null;
  }
  const s = { id: `s${i + 1}`, type };
  s.narration = str(errors, `${p}.narration`, raw.narration, LIMITS.narration, false) || '';

  const need = (f) => spec.req.includes(f);
  const has = (f) => need(f) || spec.opt.includes(f);

  if (has('heading')) s.heading = str(errors, `${p}.heading`, raw.heading, LIMITS.heading, need('heading'));
  if (has('subheading')) s.subheading = str(errors, `${p}.subheading`, raw.subheading, LIMITS.subheading, false);
  if (has('label')) s.label = str(errors, `${p}.label`, raw.label, LIMITS.label, need('label'));
  if (has('source')) s.source = str(errors, `${p}.source`, raw.source, LIMITS.label, false);
  if (has('author')) s.author = str(errors, `${p}.author`, raw.author, LIMITS.label, false);
  if (has('quote')) s.quote = str(errors, `${p}.quote`, raw.quote, LIMITS.quote, true);
  if (has('unit')) s.unit = str(errors, `${p}.unit`, raw.unit, 20, false);
  if (has('prefix')) s.prefix = str(errors, `${p}.prefix`, raw.prefix, 6, false);
  if (has('suffix')) s.suffix = str(errors, `${p}.suffix`, raw.suffix, 12, false);

  if (has('items')) {
    if (!Array.isArray(raw.items) || raw.items.length < 1 || raw.items.length > 5) {
      errors.push(`${p}.items must be a list of 1-5 short points`);
    } else {
      s.items = raw.items.map((it, j) => str(errors, `${p}.items[${j}]`, it, LIMITS.item, true));
    }
  }

  if (has('value')) {
    const n = typeof raw.value === 'string' ? Number(raw.value.replace(/[, ]/g, '')) : raw.value;
    if (!Number.isFinite(n)) errors.push(`${p}.value must be a number (got ${JSON.stringify(raw.value)})`);
    else s.value = n;
    if (has('decimals')) {
      const d = raw.decimals == null ? (Number.isInteger(n) ? 0 : 1) : Number(raw.decimals);
      s.decimals = Number.isInteger(d) && d >= 0 && d <= 3 ? d : 0;
    }
  }

  if (has('bars')) {
    if (!Array.isArray(raw.bars) || raw.bars.length < 2 || raw.bars.length > 6) {
      errors.push(`${p}.bars must be a list of 2-6 {label, value}`);
    } else {
      s.bars = raw.bars.map((b, j) => {
        const label = str(errors, `${p}.bars[${j}].label`, b?.label, 40, true);
        const value = Number(b?.value);
        if (!Number.isFinite(value) || value < 0) errors.push(`${p}.bars[${j}].value must be a number ≥ 0`);
        return { label, value };
      });
    }
  }

  for (const side of ['left', 'right']) {
    if (!has(side)) continue;
    const v = raw[side];
    if (!v || typeof v !== 'object') {
      errors.push(`${p}.${side} must be {title, text}`);
      continue;
    }
    s[side] = {
      title: str(errors, `${p}.${side}.title`, v.title, 40, true),
      text: str(errors, `${p}.${side}.text`, v.text, LIMITS.text, false) || '',
    };
  }
  return s;
}

/**
 * Validate and normalize a storyboard. Never throws.
 * @returns {{ ok: boolean, errors: string[], storyboard: object | null }}
 */
export function validateStoryboard(raw, defaults = {}) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['storyboard must be a JSON object'], storyboard: null };
  }
  const language = typeof raw.language === 'string' && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(raw.language) ? raw.language : defaults.language || 'en';
  const sb = {
    title: str(errors, 'title', raw.title, LIMITS.title, true),
    language,
    aspect: ASPECTS[raw.aspect] ? raw.aspect : defaults.aspect || '16:9',
    theme: THEMES.includes(raw.theme) ? raw.theme : defaults.theme || 'midnight',
    voice: isStr(raw.voice) ? raw.voice.trim() : defaults.voice || defaultVoiceFor(language),
    captions: raw.captions == null ? defaults.captions ?? true : Boolean(raw.captions),
    scenes: [],
  };
  if (raw.music && typeof raw.music === 'object' && isStr(raw.music.src)) {
    const volume = Number(raw.music.volume);
    sb.music = { src: raw.music.src.trim(), volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.15 };
  }
  if (!Array.isArray(raw.scenes) || raw.scenes.length === 0) {
    errors.push('scenes must be a non-empty list');
  } else if (raw.scenes.length > 30) {
    errors.push(`scenes has ${raw.scenes.length} entries; the maximum is 30`);
  } else {
    raw.scenes.forEach((sc, i) => {
      const n = normalizeScene(sc, i, errors);
      if (n) sb.scenes.push(n);
    });
  }
  return { ok: errors.length === 0, errors, storyboard: errors.length === 0 ? sb : null };
}

/**
 * Build a storyboard from plain text, no LLM needed: first line is the title,
 * each following paragraph becomes one narrated scene.
 */
export function storyboardFromText(text, opts = {}) {
  const blocks = String(text || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  if (blocks.length === 0) return validateStoryboard({}, opts);
  const [title, ...paras] = blocks;
  const cut = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
  const firstSentence = (p) => (p.match(/^.*?[.!?](\s|$)/)?.[0] || p).trim();
  const scenes = [{ type: 'title', heading: cut(title, LIMITS.heading), narration: title }];
  for (const p of paras) {
    scenes.push({ type: 'title', heading: cut(firstSentence(p).replace(/[.!?]$/, ''), LIMITS.heading), narration: cut(p, LIMITS.narration) });
  }
  return validateStoryboard({ title: cut(title, LIMITS.title), scenes, ...opts }, opts);
}

/** JSON Schema used to ask LLMs for a storyboard (structured outputs). */
export const STORYBOARD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'scenes'],
  properties: {
    title: { type: 'string' },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'narration'],
        properties: {
          type: { type: 'string', enum: Object.keys(SCENE_TYPES) },
          narration: { type: 'string' },
          heading: { type: 'string' },
          subheading: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } },
          value: { type: 'number' },
          prefix: { type: 'string' },
          suffix: { type: 'string' },
          decimals: { type: 'integer' },
          label: { type: 'string' },
          source: { type: 'string' },
          unit: { type: 'string' },
          bars: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'value'],
              properties: { label: { type: 'string' }, value: { type: 'number' } },
            },
          },
          quote: { type: 'string' },
          author: { type: 'string' },
          left: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'text'],
            properties: { title: { type: 'string' }, text: { type: 'string' } },
          },
          right: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'text'],
            properties: { title: { type: 'string' }, text: { type: 'string' } },
          },
        },
      },
    },
  },
};
