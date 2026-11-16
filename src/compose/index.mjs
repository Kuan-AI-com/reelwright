// Storyboard + timeline → a HyperFrames project directory (index.html + assets/).
// The output is plain, readable HTML: open it in the HyperFrames desktop app or
// any editor and keep tweaking by hand if you want.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ASPECTS } from '../storyboard.mjs';
import { captionGroups } from '../timing.mjs';
import { themeCss } from './themes.mjs';

const RUNTIME = readFileSync(fileURLToPath(new URL('./runtime.js', import.meta.url)), 'utf8');

const BADGE = { en: 'AI-generated', es: 'Generado con IA', fr: 'Généré par IA', de: 'KI-generiert', it: 'Generato con IA', pt: 'Gerado por IA', ja: 'AI生成', zh: 'AI生成' };

export function badgeText(language) {
  return BADGE[(language || 'en').slice(0, 2)] || BADGE.en;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const a = (kind, at, extra = '') => `data-anim="${kind}" data-at="${round(at)}"${extra}`;
const round = (x) => Math.round(x * 100) / 100;

// When should element `i` of `n` appear, given the scene length? Spread reveals
// across the first ~70% of the narration so they land near what is being said.
function stagger(i, n, duration, first = 0.6) {
  if (n <= 1) return first;
  const span = Math.max(0.4 * n, (duration - first - 1.2) * 0.7);
  return first + (span * i) / (n - 1 || 1);
}

function sceneBody(sc, dur) {
  switch (sc.type) {
    case 'title':
      return `
      <div class="kicker" ${a('grow', 0.05, ' data-len="0.6"')}></div>
      <h1 ${a('rise', 0.15)}>${esc(sc.heading)}</h1>
      ${sc.subheading ? `<p class="sub" ${a('rise', 0.5)}>${esc(sc.subheading)}</p>` : ''}`;
    case 'outro':
      return `
      <h1 ${a('pop', 0.1, ' data-len="0.8"')}>${esc(sc.heading)}</h1>
      ${sc.subheading ? `<p class="sub" ${a('rise', 0.55)}>${esc(sc.subheading)}</p>` : ''}
      <div class="kicker" ${a('grow', 0.8, ' data-len="0.6"')}></div>`;
    case 'bullets':
      return `
      <h2 ${a('rise', 0.1)}>${esc(sc.heading)}</h2>
      <ul class="points">
        ${sc.items.map((it, i) => `<li ${a('rise', stagger(i, sc.items.length, dur))}><span class="dot"></span><span>${esc(it)}</span></li>`).join('\n        ')}
      </ul>`;
    case 'stat':
      return `
      <div class="big" ${a('count', 0.2, ` data-len="1.6" data-value="${sc.value}" data-decimals="${sc.decimals ?? 0}" data-prefix="${esc(sc.prefix || '')}" data-suffix="${esc(sc.suffix || '')}"`)}>${esc(sc.prefix || '')}0${esc(sc.suffix || '')}</div>
      <p class="label" ${a('rise', 0.6)}>${esc(sc.label)}</p>
      ${sc.source ? `<p class="source" ${a('fade', 1.2)}>${esc(sc.source)}</p>` : ''}`;
    case 'bars': {
      const max = Math.max(...sc.bars.map((b) => b.value)) || 1;
      const decimals = Math.min(2, Math.max(0, ...sc.bars.map((b) => (String(b.value).split('.')[1] || '').length)));
      const rows = sc.bars
        .map((b, i) => {
          const at = 0.5 + i * 0.25;
          return `<div class="bar-row" ${a('fade', at - 0.1, ' data-len="0.4"')}>
          <div class="bar-label">${esc(b.label)}</div>
          <div class="bar-line"><div class="bar-track"><div class="bar-fill" ${a('bar', at, ` data-len="1.1" data-frac="${round(b.value / max)}"`)}></div></div><span class="bar-value" ${a('count', at, ` data-len="1.1" data-value="${b.value}" data-decimals="${decimals}" data-suffix="${esc(sc.unit ? ' ' + sc.unit : '')}"`)}>0</span></div>
        </div>`;
        })
        .join('\n        ');
      return `
      <h2 ${a('rise', 0.1)}>${esc(sc.heading)}</h2>
      <div class="bars">
        ${rows}
      </div>
      ${sc.source ? `<p class="source" ${a('fade', 1.4)}>${esc(sc.source)}</p>` : ''}`;
    }
    case 'quote':
      return `
      <div class="quote-mark" ${a('pop', 0.05)}>“</div>
      <blockquote ${a('rise', 0.25, ' data-len="0.9"')}>${esc(sc.quote)}</blockquote>
      ${sc.author ? `<p class="author" ${a('fade', 0.9)}>— ${esc(sc.author)}</p>` : ''}`;
    case 'compare':
      return `
      ${sc.heading ? `<h2 ${a('rise', 0.1)}>${esc(sc.heading)}</h2>` : ''}
      <div class="compare">
        <div class="card left" ${a('pop', 0.4)}><h3>${esc(sc.left.title)}</h3>${sc.left.text ? `<p>${esc(sc.left.text)}</p>` : ''}</div>
        <div class="vs" ${a('fade', 0.8)}>VS</div>
        <div class="card right" ${a('pop', Math.min(1.4, dur * 0.35))}><h3>${esc(sc.right.title)}</h3>${sc.right.text ? `<p>${esc(sc.right.text)}</p>` : ''}</div>
      </div>`;
    default:
      return '';
  }
}

const CENTERED = new Set(['title', 'outro', 'stat', 'quote']);

/**
 * @param {object} sb validated storyboard
 * @param {object} timeline from buildTimeline()
 * @param {object} opts { disclosure: boolean, musicFile?: string, fps?: number, preview?: boolean }
 * @returns {string} index.html
 */
export function composeHtml(sb, timeline, opts = {}) {
  const { width, height } = ASPECTS[sb.aspect] || ASPECTS['16:9'];
  const total = timeline.total;
  const scenesHtml = sb.scenes
    .map((sc, i) => {
      const tl = timeline.scenes[i];
      const cls = CENTERED.has(sc.type) ? 'scene center' : 'scene';
      return `  <section id="${sc.id}" class="clip ${cls} scene-${sc.type}" data-scene data-start="${tl.start}" data-duration="${tl.duration}" data-track-index="1" data-track-kind="graphics">
    <div class="inner">${sceneBody(sc, tl.duration)}
    </div>
  </section>`;
    })
    .join('\n');

  let captionsHtml = '';
  if (sb.captions) {
    const words = timeline.scenes.flatMap((s) => s.words);
    const groups = captionGroups(words, sb.aspect === '9:16' ? { maxWords: 4, maxChars: 22 } : {});
    captionsHtml = groups
      .map((g, i) => {
        const ws = g.words.map((w) => `<span class="w" data-ws="${w.start}" data-we="${w.end}">${esc(w.text)}</span>`).join('');
        return `    <div id="cap${i + 1}" class="clip cap" data-start="${g.start}" data-duration="${round(Math.max(0.1, g.end - g.start))}" data-track-index="2">${ws}</div>`;
      })
      .join('\n');
  }

  const voices = timeline.scenes
    .filter((s) => s.voice)
    .map((s) => `  <audio id="vo-${s.id}" class="clip" src="${s.voice.file}" data-start="${s.voice.start}" data-duration="${s.voice.duration}" data-track-index="10" data-volume="1"></audio>`)
    .join('\n');
  const music = opts.musicFile
    ? `  <audio id="music" class="clip" src="${opts.musicFile}" data-start="0" data-duration="${total}" data-track-index="11" data-volume="${sb.music?.volume ?? 0.15}"></audio>`
    : '';

  return `<!doctype html>
<html lang="${esc(sb.language)}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${width}, height=${height}" />
<title>${esc(sb.title)}</title>
<!-- Generated by Reelwright. Edit freely: every scene is plain HTML + CSS. -->
<style>${themeCss(sb.theme, { width, height })}</style>
</head>
<body>
<div id="root" data-composition-id="main" data-no-timeline data-start="0" data-duration="${total}" data-width="${width}" data-height="${height}" data-fps="${opts.fps || 30}">
  <div id="bg" class="clip" data-start="0" data-duration="${total}" data-track-index="0"><div class="orbs" data-anim="drift" data-at="0"></div><div class="grain"></div></div>
${scenesHtml}
  <div id="captions" data-track-kind="captions">
${captionsHtml}
  </div>
${opts.disclosure ? `  <div id="badge" class="clip" data-start="0" data-duration="${total}" data-track-index="3">${esc(badgeText(sb.language))}</div>` : ''}
  <div id="progress-track" class="clip" data-start="0" data-duration="${total}" data-track-index="4"><div id="progress"></div></div>
${voices}
${music}
</div>
${opts.preview ? '<script>window.__reelwrightPreview = true;</script>\n' : ''}<script>
${RUNTIME}
</script>
</body>
</html>
`;
}
