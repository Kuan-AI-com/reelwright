// Turns per-scene voice clips into one timeline: scene start/duration,
// voice placement and caption groups, all in absolute seconds.

// Minimum on-screen time per scene type when narration is short or absent.
const MIN_SECONDS = { title: 3, bullets: 4.5, stat: 4, bars: 5, quote: 4.5, compare: 5, outro: 3.5 };
const LEAD_IN = 0.35; // silence before the voice starts in each scene
const TAIL = 0.65; // breathing room after the voice ends
const WORDS_PER_SECOND = 2.5; // used when there is no voice clip

export function estimateSpeechSeconds(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  return words / WORDS_PER_SECOND;
}

/**
 * @param {object[]} scenes storyboard scenes
 * @param {(object|null)[]} voices per-scene {duration, words, file} or null
 * @returns {{ total: number, scenes: object[] }}
 */
export function buildTimeline(scenes, voices = []) {
  let t = 0;
  const out = scenes.map((scene, i) => {
    const v = voices[i] || null;
    const speech = v ? v.duration : estimateSpeechSeconds(scene.narration);
    const extra = scene.type === 'bullets' ? Math.max(0, (scene.items?.length || 0) - 3) * 0.4 : 0;
    const duration = round(Math.max(MIN_SECONDS[scene.type] || 3, LEAD_IN + speech + TAIL + extra));
    const entry = { id: scene.id, index: i, start: round(t), duration, voice: null, words: [] };
    if (v) {
      entry.voice = { file: v.file, start: round(t + LEAD_IN), duration: round(v.duration) };
      entry.words = (v.words || []).map((w) => ({ text: w.text, start: round(t + LEAD_IN + w.start), end: round(t + LEAD_IN + w.end) }));
    }
    t += duration;
    return entry;
  });
  return { total: round(t), scenes: out };
}

/**
 * Group words into caption lines: at most `maxWords` words / `maxChars`
 * characters, breaking early after sentence punctuation.
 */
export function captionGroups(words, { maxWords = 6, maxChars = 34 } = {}) {
  const groups = [];
  let cur = [];
  let chars = 0;
  const flush = () => {
    if (cur.length) groups.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
    cur = [];
    chars = 0;
  };
  for (const w of words) {
    const len = w.text.length + (cur.length ? 1 : 0);
    if (cur.length && (cur.length >= maxWords || chars + len > maxChars)) flush();
    cur.push(w);
    chars += len;
    if (/[.!?…;:]$/.test(w.text)) flush();
  }
  flush();
  // Hold each group until the next one starts (no flicker in short gaps).
  for (let i = 0; i < groups.length; i++) {
    const next = groups[i + 1];
    const holdUntil = next ? Math.min(next.start, groups[i].end + 0.6) : groups[i].end + 0.4;
    groups[i].end = round(Math.max(groups[i].end, holdUntil));
  }
  return groups;
}

const round = (x) => Math.round(x * 1000) / 1000;
