#!/usr/bin/env node
// reelwright — command line.
import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { loadConfig } from './config.mjs';
import { draft, produce } from './pipeline.mjs';
import { validateStoryboard, storyboardFromText, VOICES, THEMES, ASPECTS } from './storyboard.mjs';
import { describeLlm } from './llm.mjs';
import { runHyperframes, run } from './hf.mjs';

const HELP = `reelwright — topic in, narrated motion-graphics video out.

Usage
  reelwright make "<topic>"           draft a script with your LLM, voice it, render it
  reelwright make --storyboard s.json render a storyboard you wrote or edited
  reelwright make --text script.txt   render plain text (title + one paragraph per scene), no LLM
  reelwright draft "<topic>"          only write the storyboard JSON (review it, then make)
  reelwright serve                    start the web studio (default http://localhost:8080)
  reelwright doctor                   check ffmpeg, Chrome, local TTS and your LLM settings
  reelwright voices                   list the built-in voices

Options
  --lang <code>      narration language (en, es, fr, ja, zh…)            default: en
  --seconds <n>      target length for drafted scripts                     default: 60
  --aspect <ratio>   16:9 | 9:16 | 1:1                                     default: 16:9
  --theme <name>     ${THEMES.join(' | ')}                       default: midnight
  --voice <id>       Kokoro voice id (see \`reelwright voices\`)
  --no-captions      leave burned-in captions out
  --no-voice         silent video (captions still follow the planned timing)
  --quality <q>      draft | looks | delivery                              default: looks
  --out <file>       where to write the MP4                               default: ./<slug>.mp4
  --notes <text>     extra direction for the script writer

Environment: LLM_PROVIDER, LLM_MODEL, LLM_API_KEY, LLM_BASE_URL — see .env.example.`;

const slug = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'video';

function parse(argv) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      lang: { type: 'string' },
      seconds: { type: 'string' },
      aspect: { type: 'string' },
      theme: { type: 'string' },
      voice: { type: 'string' },
      captions: { type: 'boolean', default: true },
      'no-captions': { type: 'boolean' },
      'no-voice': { type: 'boolean' },
      quality: { type: 'string' },
      out: { type: 'string', short: 'o' },
      notes: { type: 'string' },
      storyboard: { type: 'string', short: 's' },
      text: { type: 'string', short: 't' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
}

function briefFrom(values, topic) {
  if (values.aspect && !ASPECTS[values.aspect]) throw new Error(`--aspect must be one of ${Object.keys(ASPECTS).join(', ')}`);
  if (values.theme && !THEMES.includes(values.theme)) throw new Error(`--theme must be one of ${THEMES.join(', ')}`);
  return {
    topic,
    language: values.lang || 'en',
    targetSeconds: Math.max(15, Math.min(600, Number(values.seconds) || 60)),
    aspect: values.aspect,
    theme: values.theme,
    voice: values.voice,
    notes: values.notes || '',
  };
}

function applyOverrides(sb, values) {
  const o = { ...sb };
  if (values.aspect) o.aspect = values.aspect;
  if (values.theme) o.theme = values.theme;
  if (values.voice) o.voice = values.voice;
  if (values.lang) o.language = values.lang;
  if (values['no-captions']) o.captions = false;
  return o;
}

async function cmdDraft(values, positionals, config) {
  const topic = positionals.join(' ').trim();
  if (!topic) throw new Error('give a topic: reelwright draft "how tides work"');
  console.error(`✍️  drafting with ${describeLlm(config.llm)}…`);
  const sb = await draft(config, briefFrom(values, topic));
  const out = values.out || `${slug(sb.title)}.storyboard.json`;
  await writeFile(out, JSON.stringify(sb, null, 2) + '\n');
  console.error(`📝 storyboard → ${out} (${sb.scenes.length} scenes). Review it, then: reelwright make --storyboard ${out}`);
}

async function cmdMake(values, positionals, config) {
  let sb;
  let baseDir = process.cwd();
  if (values.storyboard) {
    const raw = JSON.parse(await readFile(values.storyboard, 'utf8'));
    baseDir = dirname(resolve(values.storyboard));
    const v = validateStoryboard(applyOverrides(raw, values));
    if (!v.ok) throw new Error(`storyboard is not valid:\n- ${v.errors.join('\n- ')}`);
    sb = v.storyboard;
  } else if (values.text) {
    const v = storyboardFromText(await readFile(values.text, 'utf8'), applyOverrides({}, values));
    if (!v.ok) throw new Error(`could not build a storyboard from the text:\n- ${v.errors.join('\n- ')}`);
    sb = v.storyboard;
  } else {
    const topic = positionals.join(' ').trim();
    if (!topic) throw new Error('give a topic, --storyboard <file> or --text <file>. See reelwright --help');
    console.error(`✍️  drafting with ${describeLlm(config.llm)}…`);
    sb = await draft(config, briefFrom(values, topic));
  }
  if (values['no-voice']) config.voice.enabled = false;
  if (values.quality) config.render.quality = values.quality;

  const out = resolve(values.out || `${slug(sb.title)}.mp4`);
  const work = join(config.dataDir, 'cli', `${Date.now()}-${slug(sb.title)}`);
  await mkdir(work, { recursive: true });
  const started = Date.now();
  let lastStage = '';
  const res = await produce(config, sb, work, {
    musicBaseDir: baseDir,
    onStage: (stage, detail) => {
      const line = detail ? `${stage}: ${detail}` : stage;
      if (line !== lastStage) console.error(`▸ ${line}`);
      lastStage = line;
    },
    onProgress: (p) => process.stderr.write(`\r  rendering ${Math.round(p)}%   `),
  });
  process.stderr.write('\n');
  await copyFile(res.video, out);
  const extras = [];
  if (res.srt) {
    const srtOut = out.replace(/\.mp4$/i, '') + '.srt';
    await copyFile(res.srt, srtOut);
    extras.push(basename(srtOut));
  }
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.error(`🎬 ${out} — ${res.duration.toFixed(1)} s video in ${secs} s${extras.length ? ` (+ ${extras.join(', ')})` : ''}`);
  console.error(`   project: ${join(work, 'project')} (open index.html to tweak and re-render)`);
  if (values.json) console.log(JSON.stringify({ video: out, duration: res.duration, project: join(work, 'project') }));
}

async function cmdDoctor(config) {
  const rows = [];
  const ok = (name, good, detail) => rows.push(`${good ? '✅' : '❌'} ${name.padEnd(14)} ${detail}`);
  try {
    const { stdout } = await run('ffmpeg', ['-version']);
    ok('ffmpeg', true, stdout.split('\n')[0].slice(0, 60));
  } catch {
    ok('ffmpeg', false, 'not found — install ffmpeg (apt install ffmpeg / brew install ffmpeg)');
  }
  try {
    const { stdout } = await runHyperframes(['doctor', '--json'], { timeoutMs: 120_000 });
    const d = JSON.parse(stdout.slice(stdout.indexOf('[') >= 0 && stdout.indexOf('[') < stdout.indexOf('{') ? stdout.indexOf('[') : stdout.indexOf('{')));
    const checks = Array.isArray(d) ? d : d.checks || [];
    const chrome = checks.find((c) => /chrome/i.test(c.name || c.id || ''));
    ok('chrome', chrome ? chrome.ok !== false && chrome.status !== 'fail' : true, chrome ? String(chrome.detail || chrome.message || chrome.status || 'ok').slice(0, 70) : 'downloaded on first render');
  } catch (e) {
    ok('hyperframes', false, e.message.split('\n')[0].slice(0, 90));
  }
  try {
    const { stdout } = await runHyperframes(['tts', '--list', '--json'], { timeoutMs: 60_000 });
    JSON.parse(stdout);
    ok('voices', true, `Kokoro-82M, ${VOICES.length} voices (synthesis tested on first use)`);
  } catch (e) {
    ok('voices', false, e.message.split('\n')[0]);
  }
  const py = process.env.HYPERFRAMES_PYTHON;
  ok('tts python', Boolean(py) || existsSync('/opt/tts/bin/python'), py ? py : 'HYPERFRAMES_PYTHON not set: needs Python 3.10-3.12 with kokoro-onnx + soundfile');
  const llmReady = config.llm.provider === 'none' || config.llm.provider === 'ollama' || Boolean(config.llm.apiKey);
  ok('llm', llmReady, describeLlm(config.llm) + (llmReady ? '' : ' — LLM_API_KEY is missing'));
  ok('disclosure', true, config.disclosure ? 'on (badge + MP4 metadata)' : 'OFF — read docs/legal.md');
  console.log(rows.join('\n'));
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') return console.log(HELP);
  const { values, positionals } = parse(rest);
  if (values.help) return console.log(HELP);
  const config = loadConfig();
  switch (cmd) {
    case 'make':
      return cmdMake(values, positionals, config);
    case 'draft':
      return cmdDraft(values, positionals, config);
    case 'serve': {
      const { startServer } = await import('./server.mjs');
      return startServer(config);
    }
    case 'doctor':
      return cmdDoctor(config);
    case 'voices':
      return console.log(VOICES.map((v) => `${v.id.padEnd(12)} ${v.lang}  ${v.label}`).join('\n'));
    default:
      console.error(`unknown command "${cmd}"\n`);
      console.log(HELP);
      process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}`);
  process.exitCode = 1;
});
