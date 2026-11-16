// Render a composed project to MP4, then stamp provenance metadata, write an
// SRT caption sidecar and a poster frame.
import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runHyperframes, run } from './hf.mjs';
import { badgeText } from './compose/index.mjs';

export async function renderProject(projectDir, outFile, { quality = 'looks', fps = 30, timeoutMs, onProgress, signal } = {}) {
  await runHyperframes(['render', projectDir, '--output', outFile, '--quality', quality, '--fps', String(fps), '--quiet'], {
    cwd: projectDir,
    timeoutMs,
    signal,
    onLine: (line) => {
      const m = line.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
      if (m && onProgress) onProgress(Math.min(100, Number(m[1])));
    },
  });
  return outFile;
}

/**
 * Write machine-readable provenance into the MP4 container (no re-encode).
 * This is the "marked in a machine-readable format" half of AI-content
 * disclosure; the on-screen badge is the human-readable half.
 */
export async function stampMetadata(file, { title, language, disclosure, generator = 'Reelwright' }) {
  const tmp = file.replace(/\.mp4$/, '.tagged.mp4');
  const args = ['-y', '-loglevel', 'error', '-i', file, '-map', '0', '-c', 'copy', '-movflags', '+faststart+use_metadata_tags', '-metadata', `title=${title}`];
  if (language) args.push('-metadata', `language=${language}`);
  if (disclosure) {
    args.push('-metadata', `comment=${badgeText('en')}: script, voice and visuals were produced with an automated AI pipeline (${generator}).`);
    args.push('-metadata', 'ai_generated=true', '-metadata', `synthetic_media=voice,visuals`);
  }
  args.push(tmp);
  await run('ffmpeg', args);
  await rename(tmp, file);
}

export async function writePoster(file, posterPath, atSeconds = 1.5) {
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(atSeconds), '-i', file, '-frames:v', '1', '-q:v', '3', posterPath]);
  return posterPath;
}

function srtTime(t) {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s},${String(ms % 1000).padStart(3, '0')}`;
}

/** SRT sidecar from the timeline words: upload it to YouTube/TikTok for accessible captions. */
export function toSrt(groups) {
  return groups.map((g, i) => `${i + 1}\n${srtTime(g.start)} --> ${srtTime(g.end)}\n${g.words.map((w) => w.text).join(' ')}\n`).join('\n');
}

export async function writeSrt(groups, path) {
  await writeFile(path, toSrt(groups));
  return path;
}

export const outputs = (jobDir) => ({
  video: join(jobDir, 'video.mp4'),
  srt: join(jobDir, 'video.srt'),
  poster: join(jobDir, 'poster.jpg'),
});
