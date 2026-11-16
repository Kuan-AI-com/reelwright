// The whole pipeline, one function per stage so the CLI, the job queue and the
// tests can run any subset:
//
//   brief ──draft──▶ storyboard ──voice──▶ clips ──compose──▶ HyperFrames project ──render──▶ MP4 (+ SRT, poster)
//
import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { draftStoryboard } from './llm.mjs';
import { validateStoryboard } from './storyboard.mjs';
import { speak, estimateWords, alignWords } from './voice.mjs';
import { buildTimeline, captionGroups } from './timing.mjs';
import { composeHtml } from './compose/index.mjs';
import { renderProject, stampMetadata, writePoster, writeSrt, outputs } from './render.mjs';

const noop = () => {};

export async function draft(config, brief) {
  return draftStoryboard(config.llm, brief, { language: brief.language, aspect: brief.aspect, theme: brief.theme, voice: brief.voice });
}

/** Synthesize every scene's narration. Returns per-scene {file, duration, words} or null. */
export async function voiceScenes(config, sb, projectDir, { log = noop, signal } = {}) {
  if (!config.voice.enabled) return sb.scenes.map(() => null);
  const assets = join(projectDir, 'assets');
  await mkdir(assets, { recursive: true });
  const cacheDir = join(config.dataDir, 'cache', 'tts');
  const out = [];
  for (const [i, scene] of sb.scenes.entries()) {
    if (!scene.narration) {
      out.push(null);
      continue;
    }
    log(`voice ${i + 1}/${sb.scenes.length}`);
    const file = `assets/vo-${scene.id}.wav`;
    const res = await speak(scene.narration, { voice: sb.voice, speed: config.voice.speed, outPath: join(projectDir, file), cacheDir, signal });
    const words =
      config.captions.align === 'whisper'
        ? await alignWords(scene.narration, res.path, res.duration, { language: sb.language, model: config.captions.whisperModel, workDir: join(config.dataDir, 'tmp'), signal })
        : estimateWords(scene.narration, res.duration);
    out.push({ file, duration: res.duration, words });
  }
  return out;
}

/** Without a voice we still want captions to line up with the planned timing. */
function silentWords(sb, timeline) {
  timeline.scenes.forEach((s, i) => {
    const text = sb.scenes[i].narration;
    if (!text) return;
    const span = Math.max(0.5, s.duration - 1);
    s.words = estimateWords(text, span).map((w) => ({ ...w, start: w.start + s.start + 0.35, end: w.end + s.start + 0.35 }));
  });
}

export async function compose(config, sb, voices, projectDir, { musicPath } = {}) {
  await mkdir(join(projectDir, 'assets'), { recursive: true });
  const timeline = buildTimeline(sb.scenes, voices);
  if (voices.every((v) => !v)) silentWords(sb, timeline);
  let musicFile;
  if (musicPath) {
    musicFile = `assets/music${extname(musicPath) || '.mp3'}`;
    await copyFile(musicPath, join(projectDir, musicFile));
  }
  const html = composeHtml(sb, timeline, { disclosure: config.disclosure, musicFile, fps: config.render.fps });
  await writeFile(join(projectDir, 'index.html'), html);
  await writeFile(join(projectDir, 'storyboard.json'), JSON.stringify(sb, null, 2));
  return timeline;
}

/** Resolve a music reference: an absolute/relative file, or a name in <dataDir>/music. */
export function resolveMusic(config, src, baseDir = process.cwd()) {
  if (!src) return undefined;
  const candidates = [resolve(baseDir, src), join(config.dataDir, 'music', basename(src))];
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error(`music file not found: ${src} (put it in ${join(config.dataDir, 'music')})`);
  return hit;
}

/**
 * Storyboard → finished files in `jobDir`.
 * @returns {{ video: string, srt: string|null, poster: string, duration: number }}
 */
export async function produce(config, rawStoryboard, jobDir, { onStage = noop, onProgress = noop, signal, musicBaseDir } = {}) {
  const v = validateStoryboard(rawStoryboard);
  if (!v.ok) throw new Error(`storyboard is not valid:\n- ${v.errors.join('\n- ')}`);
  const sb = v.storyboard;
  const projectDir = join(jobDir, 'project');
  await rm(projectDir, { recursive: true, force: true });
  await mkdir(projectDir, { recursive: true });

  onStage('voice');
  const voices = await voiceScenes(config, sb, projectDir, { log: (m) => onStage('voice', m), signal });

  onStage('compose');
  const musicPath = sb.music ? resolveMusic(config, sb.music.src, musicBaseDir) : undefined;
  const timeline = await compose(config, sb, voices, projectDir, { musicPath });

  onStage('render');
  const out = outputs(jobDir);
  await renderProject(projectDir, out.video, { quality: config.render.quality, fps: config.render.fps, timeoutMs: config.render.timeoutMs, onProgress, signal });

  onStage('finish');
  await stampMetadata(out.video, { title: sb.title, language: sb.language, disclosure: config.disclosure });
  await writePoster(out.video, out.poster, Math.min(1.5, timeline.total / 2));
  const words = timeline.scenes.flatMap((s) => s.words);
  const srt = words.length ? await writeSrt(captionGroups(words, { maxWords: 8, maxChars: 42 }), out.srt) : null;
  return { video: out.video, srt, poster: out.poster, duration: timeline.total, storyboard: sb };
}

/** Instant, silent HTML preview of a storyboard for the studio (no TTS, no render). */
export function previewHtml(config, rawStoryboard) {
  const v = validateStoryboard(rawStoryboard);
  if (!v.ok) return { ok: false, errors: v.errors };
  const timeline = buildTimeline(v.storyboard.scenes, []);
  silentWords(v.storyboard, timeline);
  const html = composeHtml(v.storyboard, timeline, { disclosure: config.disclosure, preview: true, fps: config.render.fps });
  return { ok: true, html, duration: timeline.total };
}
