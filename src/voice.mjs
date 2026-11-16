// Voiceover and word timings.
// TTS: Kokoro-82M (Apache-2.0) through `hyperframes tts`, fully local, no API key.
// Alignment: estimated from the clip length by default; optional whisper.cpp
// alignment through `hyperframes transcribe --engine whisper` (local as well).
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { runHyperframes } from './hf.mjs';

/** Duration in seconds of a PCM/float WAV file, read from its header. */
export function wavDuration(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a WAV file');
  }
  let off = 12;
  let byteRate = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') byteRate = buf.readUInt32LE(off + 16);
    if (id === 'data') {
      if (!byteRate) throw new Error('WAV has no fmt chunk before data');
      const dataBytes = Math.min(size, buf.length - off - 8);
      return dataBytes / byteRate;
    }
    off += 8 + size + (size % 2);
  }
  throw new Error('WAV has no data chunk');
}

const LANG_FLAG = { es: 'es', fr: 'fr-fr', it: 'it', pt: 'pt-br', ja: 'ja', zh: 'zh', hi: 'hi' };

/**
 * Speak `text` into `outPath`. Results are cached by (text, voice, speed) so
 * re-rendering after a visual edit does not re-synthesize unchanged lines.
 */
export async function speak(text, { voice, speed = 1, outPath, cacheDir, signal }) {
  const key = createHash('sha256').update(JSON.stringify([text, voice, speed])).digest('hex').slice(0, 20);
  const cached = cacheDir ? join(cacheDir, `${key}.wav`) : null;
  if (cached && existsSync(cached)) {
    const buf = await readFile(cached);
    await writeFile(outPath, buf);
    return { path: outPath, duration: wavDuration(buf), cached: true };
  }
  const args = ['tts', text, '--voice', voice, '--speed', String(speed), '--output', outPath, '--json'];
  const prefix = voice.slice(0, 1);
  const lang = { e: 'es', f: 'fr', i: 'it', p: 'pt', j: 'ja', z: 'zh', h: 'hi' }[prefix];
  if (lang && LANG_FLAG[lang]) args.push('--lang', LANG_FLAG[lang]);
  try {
    await runHyperframes(args, { timeoutMs: 10 * 60 * 1000, signal });
  } catch (err) {
    if (/kokoro-onnx|soundfile|python/i.test(err.message)) {
      throw new Error(`local TTS is not ready: ${err.message}\nInstall it with: pip install kokoro-onnx soundfile (Python 3.10-3.12), then set HYPERFRAMES_PYTHON to that python. The Docker image ships with it.`);
    }
    throw err;
  }
  const buf = await readFile(outPath);
  if (cached) {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cached, buf);
  }
  return { path: outPath, duration: wavDuration(buf), cached: false };
}

// Relative speaking weight of a word: long words and punctuation pauses take longer.
function weight(word) {
  const letters = word.replace(/[^\p{L}\p{N}]/gu, '').length;
  let w = 0.6 + Math.min(letters, 14) * 0.12;
  if (/[,;:]$/.test(word)) w += 0.35;
  if (/[.!?…]$/.test(word)) w += 0.6;
  return w;
}

/**
 * Spread the words of `text` across [0, duration). Kokoro clips start and end
 * with a short silence, trimmed here so captions don't lead the voice.
 */
export function estimateWords(text, duration, { lead = 0.08, tail = 0.12 } = {}) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length === 0 || duration <= 0) return [];
  const span = Math.max(0.1, duration - lead - tail);
  const weights = words.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let t = lead;
  return words.map((w, i) => {
    const d = (weights[i] / total) * span;
    const word = { text: w, start: round(t), end: round(t + d * 0.92) };
    t += d;
    return word;
  });
}

const round = (x) => Math.round(x * 1000) / 1000;

/** Word timings from whisper.cpp. Falls back to estimates if it fails. */
export async function alignWords(text, wavPath, duration, { language = 'en', model = 'small', workDir, signal }) {
  const dir = join(workDir, `align-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  try {
    const m = language.startsWith('en') && !model.endsWith('.en') && !model.startsWith('large') ? `${model}.en` : model;
    await runHyperframes(['transcribe', wavPath, '--dir', dir, '--engine', 'whisper', '--model', m, '--language', language.slice(0, 2), '--json'], {
      timeoutMs: 20 * 60 * 1000,
      signal,
    });
    const words = JSON.parse(await readFile(join(dir, 'transcript.json'), 'utf8'));
    if (!Array.isArray(words) || words.length === 0) throw new Error('empty transcript');
    // Keep the script's spelling: whisper may mishear names. Map 1:1 when counts match.
    const scriptWords = String(text).split(/\s+/).filter(Boolean);
    if (scriptWords.length === words.length) {
      return words.map((w, i) => ({ text: scriptWords[i], start: round(w.start), end: round(w.end) }));
    }
    return words.map((w) => ({ text: String(w.text).trim(), start: round(w.start), end: round(w.end) }));
  } catch {
    return estimateWords(text, duration);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
