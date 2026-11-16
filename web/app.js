// Reelwright Studio — vanilla JS, no build step.
// All user text goes through text nodes (never innerHTML) so titles and
// scripts cannot inject markup.

const $app = document.getElementById('app');
const state = { config: null, videos: [], rendering: null, route: parseRoute(), poll: null };

// ---------- tiny DOM helper ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function toast(msg, bad = false) {
  const t = h('div', { class: `toast${bad ? ' bad' : ''}`, role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), bad ? 6000 : 3000);
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') {
    renderLogin();
    throw new Error('login required');
  }
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.errors = data.errors;
    throw err;
  }
  return data;
}

function parseRoute() {
  const m = location.hash.match(/^#\/v\/([a-z0-9-]+)/);
  return m ? { name: 'video', id: m[1] } : { name: 'board' };
}
window.addEventListener('hashchange', () => {
  state.route = parseRoute();
  route();
});

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
};

// ---------- login ----------
function renderLogin() {
  stopPolling();
  const err = h('div');
  const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Password', required: true, autofocus: true });
  const form = h(
    'form',
    {
      onsubmit: async (e) => {
        e.preventDefault();
        err.replaceChildren();
        try {
          await api('/api/login', { method: 'POST', body: { password: pw.value } });
          boot();
        } catch (ex) {
          err.replaceChildren(h('div', { class: 'error-box' }, ex.message));
        }
      },
    },
    h('div', { class: 'brand' }, h('img', { src: 'favicon.svg', alt: '' }), 'Reelwright'),
    h('h1', {}, 'Welcome back'),
    h('p', { class: 'muted small' }, 'Your self-hosted video studio. The password is in your server logs on first run, or in REELWRIGHT_PASSWORD.'),
    pw,
    err,
    h('button', { class: 'btn primary', type: 'submit' }, 'Sign in'),
  );
  $app.replaceChildren(h('div', { class: 'login' }, form));
}

// ---------- shell ----------
function topBar() {
  const c = state.config;
  return h(
    'header',
    { class: 'top' },
    h('div', { class: 'brand', onclick: () => (location.hash = '#/') }, h('img', { src: 'favicon.svg', alt: '' }), 'Reelwright'),
    h('span', { class: 'spacer' }),
    h('span', { class: `pill llm ${c.llm.ready ? 'on' : ''}`, title: 'Script writer' }, h('span', { class: 'dot' }), `LLM: ${c.llm.label}`),
    h('span', { class: `pill ${state.rendering ? 'on' : ''}` }, h('span', { class: 'dot' }), state.rendering ? 'Rendering…' : 'Idle'),
    h(
      'button',
      {
        class: 'btn ghost sm',
        onclick: async () => {
          await api('/api/logout', { method: 'POST' });
          renderLogin();
        },
      },
      'Sign out',
    ),
  );
}

function stopPolling() {
  clearInterval(state.poll);
  state.poll = null;
}

async function boot() {
  try {
    state.config = await api('/api/config');
  } catch {
    return;
  }
  route();
}

function route() {
  stopPolling();
  if (state.route.name === 'video') return renderVideo(state.route.id);
  return renderBoard();
}

// ---------- board ----------
const COLUMNS = [
  { title: 'Ideas', statuses: ['idea', 'drafting'] },
  { title: 'Script review', statuses: ['review', 'failed'] },
  { title: 'Rendering', statuses: ['queued', 'rendering'] },
  { title: 'Ready', statuses: ['ready'] },
  { title: 'Published', statuses: ['published'] },
];

function composer() {
  const c = state.config;
  let mode = c.llm.ready ? 'ai' : 'text';
  const topic = h('input', { type: 'text', class: 'topic', placeholder: 'What is the video about?  e.g. "Why the sky is blue, for curious 10-year-olds"', maxlength: 500 });
  const text = h('textarea', { rows: 6, placeholder: 'Title on the first line.\n\nThen one paragraph per scene. Each paragraph is narrated while its scene is on screen.' });
  const lang = h('select', {}, ...['en', 'es', 'fr', 'ja', 'zh'].map((l) => h('option', { value: l }, l)));
  const seconds = h('input', { type: 'number', min: 15, max: 600, step: 5, value: 60 });
  const aspect = h('select', {}, ...c.aspects.map((a) => h('option', { value: a }, a === '9:16' ? '9:16 vertical' : a === '1:1' ? '1:1 square' : '16:9 landscape')));
  const theme = h('select', {}, ...c.themes.map((t) => h('option', { value: t.id }, t.label)));
  const voiceSel = h('select');
  const fillVoices = () => {
    const l = lang.value;
    const list = c.voices.filter((v) => v.lang === l);
    voiceSel.replaceChildren(...(list.length ? list : c.voices).map((v) => h('option', { value: v.id }, v.label)));
  };
  lang.addEventListener('change', fillVoices);
  fillVoices();
  const notes = h('input', { type: 'text', placeholder: 'Optional direction: audience, tone, must-mention facts…', maxlength: 2000 });
  const body = h('div', { style: 'display:contents' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' });

  const submit = h('button', { class: 'btn primary', type: 'submit' });
  const draw = () => {
    tabs.replaceChildren(
      h('button', { type: 'button', class: mode === 'ai' ? 'on' : '', onclick: () => ((mode = 'ai'), draw()) }, '✨ Write it for me'),
      h('button', { type: 'button', class: mode === 'idea' ? 'on' : '', onclick: () => ((mode = 'idea'), draw()) }, '💡 Save idea'),
      h('button', { type: 'button', class: mode === 'text' ? 'on' : '', onclick: () => ((mode = 'text'), draw()) }, '📝 I have a script'),
    );
    const llmMissing = mode === 'ai' && !c.llm.ready;
    body.replaceChildren(...[
      mode === 'text' ? text : topic,
      mode !== 'idea' ? h('div', { class: 'row' }, h('label', { class: 'field' }, 'Language', lang), mode === 'ai' ? h('label', { class: 'field' }, 'Length (s)', seconds) : null, h('label', { class: 'field' }, 'Format', aspect), h('label', { class: 'field' }, 'Look', theme), h('label', { class: 'field' }, 'Voice', voiceSel)) : null,
      mode === 'ai' ? notes : null,
      llmMissing ? h('div', { class: 'notice' }, 'No LLM is configured. Set LLM_PROVIDER (anthropic, openai, openrouter or ollama) and restart, or use “I have a script”.') : null,
    ].filter(Boolean));
    submit.textContent = mode === 'ai' ? 'Draft the script' : mode === 'idea' ? 'Save to ideas' : 'Create storyboard';
    submit.disabled = llmMissing;
  };
  draw();

  return h(
    'form',
    {
      class: 'composer',
      onsubmit: async (e) => {
        e.preventDefault();
        const base = { language: lang.value, seconds: Number(seconds.value), aspect: aspect.value, theme: theme.value, voice: voiceSel.value, notes: notes.value };
        try {
          submit.disabled = true;
          let v;
          if (mode === 'text') {
            if (!text.value.trim()) return toast('Write the script first', true);
            v = await api('/api/videos', { method: 'POST', body: { ...base, text: text.value } });
            location.hash = `#/v/${v.id}`;
          } else {
            if (!topic.value.trim()) return toast('Give it a topic', true);
            v = await api('/api/videos', { method: 'POST', body: { ...base, topic: topic.value, draft: mode === 'ai' } });
            toast(mode === 'ai' ? 'Drafting the script…' : 'Saved to ideas');
            topic.value = '';
            refreshBoard();
          }
        } catch (ex) {
          toast(ex.errors ? ex.errors.slice(0, 4).join(' · ') : ex.message, true);
        } finally {
          submit.disabled = false;
        }
      },
    },
    h('div', { class: 'row', style: 'align-items:center' }, h('h2', {}, 'New video'), h('div', { style: 'flex:0 0 auto' }, tabs)),
    body,
    h('div', { class: 'actions' }, submit, h('span', { class: 'muted small', style: 'align-self:center' }, 'Nothing renders until you approve the script.')),
  );
}

function videoCard(v) {
  const thumb = v.status === 'ready' || v.status === 'published' ? h('img', { src: `/files/${v.id}/poster.jpg?t=${encodeURIComponent(v.rendered_at || '')}`, alt: '', loading: 'lazy' }) : null;
  const progress = v.status === 'rendering' ? h('div', { class: 'bar' }, h('i', { style: `width:${Math.max(3, v.progress || 0)}%` })) : null;
  return h(
    'div',
    { class: 'card', tabindex: 0, onclick: () => (location.hash = `#/v/${v.id}`), onkeydown: (e) => e.key === 'Enter' && (location.hash = `#/v/${v.id}`) },
    thumb,
    h('div', { class: 't' }, v.title),
    progress,
    h('div', { class: 'meta' }, h('span', { class: `status ${v.status}` }, v.status), v.stage ? h('span', {}, v.stage) : null, v.duration ? h('span', {}, fmtTime(v.duration)) : null, h('span', {}, ago(v.updated_at))),
    v.status === 'failed' && v.error ? h('div', { class: 'small', style: 'color:var(--bad)' }, v.error.split('\n')[0].slice(0, 140)) : null,
  );
}

let boardEl = null;
function drawColumns() {
  if (!boardEl) return;
  boardEl.replaceChildren(
    ...COLUMNS.map((col) => {
      const items = state.videos.filter((v) => col.statuses.includes(v.status));
      return h('section', { class: 'col' }, h('h3', {}, h('span', {}, col.title), h('span', {}, String(items.length))), items.length ? items.map(videoCard) : h('div', { class: 'empty' }, '—'));
    }),
  );
}

async function refreshBoard() {
  try {
    const d = await api('/api/videos');
    state.videos = d.videos;
    state.rendering = d.rendering;
    drawColumns();
  } catch {}
}

async function renderBoard() {
  boardEl = h('div', { class: 'board' });
  $app.replaceChildren(topBar(), h('main', {}, composer(), boardEl));
  await refreshBoard();
  state.poll = setInterval(refreshBoard, 2500);
}

// ---------- video editor ----------
const FIELD_LABELS = { heading: 'Heading', subheading: 'Subheading', label: 'Label', source: 'Source', author: 'Author', quote: 'Quote', unit: 'Unit', prefix: 'Prefix', suffix: 'Suffix', value: 'Value', decimals: 'Decimals' };

function blankScene(type) {
  const s = { type, narration: '' };
  if (type === 'bullets') s.items = ['', ''];
  if (type === 'bars') s.bars = [{ label: '', value: 0 }, { label: '', value: 0 }];
  if (type === 'compare') {
    s.left = { title: '', text: '' };
    s.right = { title: '', text: '' };
  }
  if (type === 'stat') s.value = 0;
  return s;
}

function sceneEditor(sb, i, onChange) {
  const sc = sb.scenes[i];
  const spec = state.config.sceneTypes[sc.type];
  const set = (k, v) => {
    sc[k] = v;
    onChange();
  };
  const input = (k, opts = {}) =>
    h('label', { class: 'field' }, FIELD_LABELS[k] || k, h(opts.area ? 'textarea' : 'input', { type: opts.num ? 'number' : 'text', step: 'any', rows: opts.area ? 2 : null, value: sc[k] ?? '', oninput: (e) => set(k, opts.num ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value) }));

  const fields = [];
  for (const k of [...spec.req, ...spec.opt]) {
    if (k === 'items') {
      fields.push(
        h(
          'div',
          { class: 'field' },
          h('span', { class: 'muted small', style: 'font-weight:600' }, 'Points'),
          h(
            'div',
            { class: 'items' },
            sc.items.map((it, j) =>
              h(
                'div',
                { class: 'item' },
                h('input', { type: 'text', value: it, oninput: (e) => ((sc.items[j] = e.target.value), onChange()) }),
                h('button', { class: 'icon', type: 'button', title: 'Remove point', onclick: () => (sc.items.splice(j, 1), onChange(true)) }, '✕'),
              ),
            ),
            sc.items.length < 5 ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => (sc.items.push(''), onChange(true)) }, '+ point') : null,
          ),
        ),
      );
    } else if (k === 'bars') {
      fields.push(
        h(
          'div',
          { class: 'field' },
          h('span', { class: 'muted small', style: 'font-weight:600' }, 'Bars'),
          h(
            'div',
            { class: 'items' },
            sc.bars.map((b, j) =>
              h(
                'div',
                { class: 'item' },
                h('input', { type: 'text', placeholder: 'Label', value: b.label, oninput: (e) => ((b.label = e.target.value), onChange()) }),
                h('input', { type: 'number', step: 'any', placeholder: 'Value', value: b.value, style: 'max-width:130px', oninput: (e) => ((b.value = Number(e.target.value)), onChange()) }),
                h('button', { class: 'icon', type: 'button', title: 'Remove bar', onclick: () => (sc.bars.splice(j, 1), onChange(true)) }, '✕'),
              ),
            ),
            sc.bars.length < 6 ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => (sc.bars.push({ label: '', value: 0 }), onChange(true)) }, '+ bar') : null,
          ),
        ),
      );
    } else if (k === 'left' || k === 'right') {
      sc[k] = sc[k] || { title: '', text: '' };
      fields.push(
        h(
          'div',
          { class: 'field' },
          h('span', { class: 'muted small', style: 'font-weight:600' }, k === 'left' ? 'Left card' : 'Right card'),
          h('input', { type: 'text', placeholder: 'Title', value: sc[k].title, oninput: (e) => ((sc[k].title = e.target.value), onChange()) }),
          h('textarea', { rows: 2, placeholder: 'Text', value: sc[k].text, oninput: (e) => ((sc[k].text = e.target.value), onChange()) }),
        ),
      );
    } else {
      fields.push(input(k, { num: ['value', 'decimals'].includes(k), area: k === 'quote' }));
    }
  }

  const typeSel = h(
    'select',
    {
      'aria-label': 'Scene type',
      onchange: (e) => {
        const fresh = blankScene(e.target.value);
        fresh.narration = sc.narration;
        if (sc.heading) fresh.heading = sc.heading;
        sb.scenes[i] = fresh;
        onChange(true);
      },
    },
    Object.keys(state.config.sceneTypes).map((t) => h('option', { value: t, selected: t === sc.type }, t)),
  );
  const move = (d) => {
    const j = i + d;
    if (j < 0 || j >= sb.scenes.length) return;
    [sb.scenes[i], sb.scenes[j]] = [sb.scenes[j], sb.scenes[i]];
    onChange(true);
  };
  return h(
    'div',
    { class: 'scene' },
    h(
      'div',
      { class: 'scene-head' },
      h('span', { class: 'num' }, String(i + 1).padStart(2, '0')),
      typeSel,
      h('span', { class: 'muted small' }, spec.about),
      h(
        'div',
        { class: 'tools' },
        h('button', { class: 'icon', type: 'button', title: 'Move up', onclick: () => move(-1) }, '↑'),
        h('button', { class: 'icon', type: 'button', title: 'Move down', onclick: () => move(1) }, '↓'),
        h('button', { class: 'icon', type: 'button', title: 'Duplicate', onclick: () => (sb.scenes.splice(i + 1, 0, structuredClone(sc)), onChange(true)) }, '⧉'),
        h('button', { class: 'icon', type: 'button', title: 'Delete scene', onclick: () => sb.scenes.length > 1 && (sb.scenes.splice(i, 1), onChange(true)) }, '🗑'),
      ),
    ),
    h('label', { class: 'field' }, 'Narration (spoken)', h('textarea', { rows: 2, value: sc.narration || '', oninput: (e) => set('narration', e.target.value) })),
    ...fields,
  );
}

function previewStage(aspect) {
  const [w, hgt] = aspect === '9:16' ? [1080, 1920] : aspect === '1:1' ? [1080, 1080] : [1920, 1080];
  const frame = h('iframe', { sandbox: 'allow-scripts', title: 'Preview', width: w, height: hgt });
  const stage = h('div', { class: 'stage', style: `aspect-ratio:${w}/${hgt};${hgt > w ? 'max-height:70vh;margin:0 auto;' : ''}` }, frame);
  const fit = () => {
    const scale = stage.clientWidth / w;
    frame.style.transform = `scale(${scale})`;
  };
  new ResizeObserver(fit).observe(stage);
  return { stage, frame };
}

async function renderVideo(id) {
  let video;
  try {
    video = await api(`/api/videos/${id}`);
  } catch (e) {
    toast(e.message, true);
    location.hash = '#/';
    return;
  }
  const sb = video.storyboard ? structuredClone(video.storyboard) : null;
  let dirty = false;
  let duration = 0;
  let t = 0;
  let playing = null;

  const left = h('div', { class: 'left' });
  const right = h('div', { class: 'right' });
  $app.replaceChildren(topBar(), h('main', {}, h('div', { class: 'editor' }, left, right)));

  // ----- right column: preview / player + actions -----
  const scrub = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Scrub preview' });
  const timeLbl = h('span', { class: 'time' }, '0:00 / 0:00');
  const playBtn = h('button', { class: 'btn sm', type: 'button' }, '▶ Play');
  let preview = null;

  const seek = (x) => {
    t = Math.max(0, Math.min(duration, x));
    preview?.frame.contentWindow?.postMessage({ t }, '*');
    scrub.value = duration ? Math.round((t / duration) * 1000) : 0;
    timeLbl.textContent = `${fmtTime(t)} / ${fmtTime(duration)}`;
  };
  scrub.addEventListener('input', () => seek((scrub.value / 1000) * duration));
  const stop = () => {
    cancelAnimationFrame(playing);
    playing = null;
    playBtn.textContent = '▶ Play';
  };
  playBtn.addEventListener('click', () => {
    if (playing) return stop();
    playBtn.textContent = '❚❚ Pause';
    let last = performance.now();
    if (t >= duration - 0.05) seek(0);
    const step = (now) => {
      seek(t + (now - last) / 1000);
      last = now;
      if (t >= duration) return stop();
      playing = requestAnimationFrame(step);
    };
    playing = requestAnimationFrame(step);
  });

  let previewTimer = null;
  const errorsBox = h('div');
  async function refreshPreview() {
    if (!sb || !preview) return;
    try {
      const p = await api('/api/preview', { method: 'POST', body: { storyboard: sb } });
      errorsBox.replaceChildren();
      duration = p.duration;
      preview.frame.onload = () => seek(Math.min(t, duration));
      preview.frame.src = p.url;
    } catch (e) {
      errorsBox.replaceChildren(h('div', { class: 'error-box' }, (e.errors || [e.message]).slice(0, 8).join('\n')));
    }
  }
  const schedulePreview = () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 450);
  };

  const statusArea = h('div', { class: 'panel' });
  function drawStatus() {
    const v = video;
    const busy = ['queued', 'rendering', 'drafting'].includes(v.status);
    const parts = [h('div', { class: 'row', style: 'align-items:center' }, h('div', {}, h('span', { class: `status ${v.status}` }, v.status), v.stage ? h('span', { class: 'muted small' }, '  ', v.stage) : null))];
    if (v.status === 'rendering') parts.push(h('div', { class: 'bar' }, h('i', { style: `width:${Math.max(3, v.progress || 0)}%` })));
    if (v.status === 'failed' && v.error) parts.push(h('div', { class: 'error-box' }, v.error));
    if (v.status === 'drafting') parts.push(h('div', { class: 'notice' }, 'The script writer is working. This page updates by itself.'));
    const actions = h('div', { class: 'actions' });
    if (sb && !busy)
      actions.append(
        h(
          'button',
          {
            class: 'btn primary',
            onclick: async () => {
              try {
                if (dirty) await save();
                video = await api(`/api/videos/${id}/render`, { method: 'POST' });
                drawStatus();
                watch();
              } catch (e) {
                toast(e.message, true);
              }
            },
          },
          v.status === 'ready' || v.status === 'published' ? '↻ Re-render' : '🎬 Approve & render',
        ),
      );
    if (busy && v.status !== 'drafting') actions.append(h('button', { class: 'btn', onclick: async () => { await api(`/api/videos/${id}/cancel`, { method: 'POST' }); toast('Cancelling…'); } }, 'Cancel'));
    if (state.config.llm.ready && !busy)
      actions.append(
        h(
          'button',
          {
            class: 'btn',
            onclick: async () => {
              if (sb && !confirm('Replace the current script with a new draft?')) return;
              const notes = prompt('Any direction for the new draft? (optional)', video.brief?.notes || '') ?? null;
              if (notes === null) return;
              video = await api(`/api/videos/${id}/draft`, { method: 'POST', body: { notes } });
              drawStatus();
              watch();
            },
          },
          sb ? '✨ Redraft' : '✨ Draft script',
        ),
      );
    if (v.status === 'ready') actions.append(h('button', { class: 'btn', onclick: () => setStatus('published') }, '✓ Mark published'));
    if (v.status === 'published') actions.append(h('button', { class: 'btn ghost', onclick: () => setStatus('ready') }, 'Unpublish'));
    actions.append(
      h(
        'button',
        {
          class: 'btn ghost danger',
          onclick: async () => {
            if (!confirm('Delete this video and its files?')) return;
            await api(`/api/videos/${id}`, { method: 'DELETE' });
            location.hash = '#/';
          },
        },
        'Delete',
      ),
    );
    parts.push(actions);
    if (v.status === 'ready' || v.status === 'published') {
      parts.push(
        h('video', { src: `/files/${id}/video.mp4?t=${encodeURIComponent(v.rendered_at || '')}`, controls: true, preload: 'metadata', poster: `/files/${id}/poster.jpg?t=${encodeURIComponent(v.rendered_at || '')}`, style: 'width:100%;border-radius:12px;background:#000' }),
        h('div', { class: 'actions' }, h('a', { class: 'btn sm', href: `/files/${id}/video.mp4?download` }, '⬇ MP4'), h('a', { class: 'btn sm', href: `/files/${id}/video.srt?download` }, '⬇ Captions (.srt)'), h('a', { class: 'btn sm', href: `/files/${id}/poster.jpg?download` }, '⬇ Thumbnail')),
      );
      if (state.config.disclosure) parts.push(h('div', { class: 'notice' }, 'When you upload, also tick the platform’s “altered or synthetic content” / “AI-generated” box. The video already carries an on-screen label and AI metadata.'));
      const url = h('input', { type: 'url', placeholder: 'https://… where you published it', value: v.published_url || '' });
      parts.push(h('div', { class: 'row' }, h('label', { class: 'field' }, 'Published link', url), h('div', { style: 'flex:0 0 auto' }, h('button', { class: 'btn sm', onclick: async () => { video = await api(`/api/videos/${id}`, { method: 'PATCH', body: { published_url: url.value } }); toast('Saved'); } }, 'Save link'))));
    }
    statusArea.replaceChildren(...parts);
  }

  async function setStatus(status) {
    try {
      video = await api(`/api/videos/${id}`, { method: 'PATCH', body: { status } });
      drawStatus();
    } catch (e) {
      toast(e.message, true);
    }
  }

  // ----- left column: the storyboard -----
  const saveBtn = h('button', { class: 'btn', type: 'button', disabled: true }, 'Saved');
  async function save() {
    try {
      video = await api(`/api/videos/${id}`, { method: 'PATCH', body: { storyboard: sb } });
      dirty = false;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saved';
      return true;
    } catch (e) {
      toast(e.errors ? e.errors.slice(0, 4).join(' · ') : e.message, true);
      return false;
    }
  }
  saveBtn.addEventListener('click', save);
  window.onkeydown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && state.route.name === 'video') {
      e.preventDefault();
      if (dirty) save();
    }
  };

  let jsonMode = false;
  function drawLeft() {
    if (!sb) {
      left.replaceChildren(
        h('div', { class: 'panel' }, h('h3', {}, video.title), h('p', { class: 'muted' }, video.status === 'drafting' ? 'Drafting the script…' : 'No script yet. Draft one with your LLM, or go back and use “I have a script”.'), video.brief?.notes ? h('p', { class: 'small muted' }, 'Notes: ', video.brief.notes) : null),
      );
      return;
    }
    const changed = (structural) => {
      dirty = true;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save  ⌘S';
      if (structural) drawLeft();
      schedulePreview();
    };
    const head = h(
      'div',
      { class: 'panel' },
      h('input', { type: 'text', class: 'title-input', value: sb.title, 'aria-label': 'Title', oninput: (e) => ((sb.title = e.target.value), changed()) }),
      h(
        'div',
        { class: 'row' },
        h('label', { class: 'field' }, 'Format', h('select', { onchange: (e) => ((sb.aspect = e.target.value), changed(), setupPreview()) }, state.config.aspects.map((a) => h('option', { value: a, selected: a === sb.aspect }, a)))),
        h('label', { class: 'field' }, 'Look', h('select', { onchange: (e) => ((sb.theme = e.target.value), changed()) }, state.config.themes.map((th) => h('option', { value: th.id, selected: th.id === sb.theme }, th.label)))),
        h('label', { class: 'field' }, 'Voice', h('select', { onchange: (e) => ((sb.voice = e.target.value), changed()) }, state.config.voices.map((v) => h('option', { value: v.id, selected: v.id === sb.voice }, v.label)))),
        h('label', { class: 'field', style: 'flex:0 0 auto' }, 'Captions', h('input', { type: 'checkbox', checked: sb.captions, style: 'width:22px;height:22px', onchange: (e) => ((sb.captions = e.target.checked), changed()) })),
      ),
      h('div', { class: 'actions' }, saveBtn, h('button', { class: 'btn ghost', type: 'button', onclick: () => ((jsonMode = !jsonMode), drawLeft()) }, jsonMode ? 'Form editor' : '{ } JSON')),
    );
    if (jsonMode) {
      const area = h('textarea', { class: 'json', spellcheck: 'false', value: JSON.stringify(sb, null, 2) });
      const apply = h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: () => {
            try {
              const parsed = JSON.parse(area.value);
              Object.keys(sb).forEach((k) => delete sb[k]);
              Object.assign(sb, parsed);
              changed();
              toast('Applied — check the preview, then save');
            } catch (e) {
              toast(`Invalid JSON: ${e.message}`, true);
            }
          },
        },
        'Apply JSON',
      );
      left.replaceChildren(head, h('div', { class: 'panel' }, area, h('div', { class: 'actions' }, apply)));
      return;
    }
    const addSel = h('select', { 'aria-label': 'New scene type' }, Object.keys(state.config.sceneTypes).map((tp) => h('option', { value: tp }, tp)));
    left.replaceChildren(
      head,
      ...sb.scenes.map((_, i) => sceneEditor(sb, i, changed)),
      h('div', { class: 'panel' }, h('div', { class: 'row', style: 'align-items:center' }, addSel, h('button', { class: 'btn', type: 'button', style: 'flex:0 0 auto', onclick: () => (sb.scenes.push(blankScene(addSel.value)), changed(true)) }, '+ Add scene'))),
    );
  }

  function setupPreview() {
    if (!sb) {
      right.replaceChildren(statusArea);
      return;
    }
    preview = previewStage(sb.aspect);
    right.replaceChildren(
      h('div', { class: 'panel' }, h('div', { class: 'row', style: 'align-items:center' }, h('h3', {}, 'Live preview'), h('span', { class: 'muted small', style: 'text-align:right' }, 'silent · instant · final fonts and voice timing apply at render')), preview.stage, h('div', { class: 'transport' }, playBtn, scrub, timeLbl), errorsBox),
      statusArea,
    );
    refreshPreview();
  }

  function watch() {
    stopPolling();
    state.poll = setInterval(async () => {
      try {
        const fresh = await api(`/api/videos/${id}`);
        const was = video.status;
        video = fresh;
        if (was === 'drafting' && fresh.status !== 'drafting') return renderVideo(id);
        drawStatus();
        if (!['queued', 'rendering', 'drafting'].includes(fresh.status)) stopPolling();
      } catch {}
    }, 2000);
  }

  drawLeft();
  setupPreview();
  drawStatus();
  if (['queued', 'rendering', 'drafting'].includes(video.status)) watch();
}

boot();
