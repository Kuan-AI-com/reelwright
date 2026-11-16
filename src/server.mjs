// Web studio + JSON API. Plain node:http, no framework.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { openDb } from './db.mjs';
import { Worker } from './jobs.mjs';
import { previewHtml } from './pipeline.mjs';
import { validateStoryboard, storyboardFromText, VOICES, THEMES, ASPECTS, SCENE_TYPES, defaultVoiceFor } from './storyboard.mjs';
import { THEME_TOKENS } from './compose/themes.mjs';
import { describeLlm } from './llm.mjs';

const WEB_DIR = fileURLToPath(new URL('../web/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.srt': 'application/x-subrip; charset=utf-8', '.json': 'application/json', '.ico': 'image/x-icon' };
const SESSION_DAYS = 14;

// ---------- auth ----------
function loadSecrets(config) {
  mkdirSync(config.dataDir, { recursive: true });
  const secretFile = join(config.dataDir, '.session-secret');
  if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'), { mode: 0o600 });
  const secret = readFileSync(secretFile, 'utf8').trim();
  let password = config.password;
  let generated = false;
  if (!password) {
    const pwFile = join(config.dataDir, '.admin-password');
    if (!existsSync(pwFile)) {
      writeFileSync(pwFile, randomBytes(12).toString('base64url'), { mode: 0o600 });
      generated = true;
    }
    password = readFileSync(pwFile, 'utf8').trim();
  }
  return { secret, password, generated };
}

const sign = (secret, value) => createHmac('sha256', secret).update(value).digest('base64url');

function makeSession(secret) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const payload = `v1.${exp}.${randomBytes(9).toString('base64url')}`;
  return `${payload}.${sign(secret, payload)}`;
}

function validSession(secret, token) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const mac = Buffer.from(token.slice(i + 1));
  const want = Buffer.from(sign(secret, payload));
  if (mac.length !== want.length || !timingSafeEqual(mac, want)) return false;
  const exp = Number(payload.split('.')[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Small in-memory brake on password guessing: 10 tries per 10 minutes per IP.
const attempts = new Map();
function tooManyAttempts(ip) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  attempts.set(ip, a);
  return a.length >= 10;
}

// ---------- http helpers ----------
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  const data = isJson ? JSON.stringify(body) : body;
  res.writeHead(status, { ...SECURITY_HEADERS, 'content-type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(data);
}

async function readJson(req, limit = 1_000_000) {
  if (!/^application\/json/.test(req.headers['content-type'] || '')) {
    const e = new Error('expected application/json');
    e.status = 415;
    throw e;
  }
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) {
      const e = new Error('request body too large');
      e.status = 413;
      throw e;
    }
    chunks.push(c);
  }
  try {
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
  } catch {
    const e = new Error('invalid JSON');
    e.status = 400;
    throw e;
  }
}

function sendFile(req, res, file, { download } = {}) {
  if (!existsSync(file)) return send(res, 404, { error: 'not found' });
  const st = statSync(file);
  const type = MIME[extname(file)] || 'application/octet-stream';
  const headers = { ...SECURITY_HEADERS, 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=0, must-revalidate', 'last-modified': st.mtime.toUTCString() };
  if (download) headers['content-disposition'] = `attachment; filename="${download.replace(/[^\w.\- ]/g, '_')}"`;
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) {
      res.writeHead(416, { 'content-range': `bytes */${st.size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'content-length': st.size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normalize(join(WEB_DIR, rel));
  if (!file.startsWith(WEB_DIR) || !existsSync(file) || statSync(file).isDirectory()) return false;
  const headers = { ...SECURITY_HEADERS, 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' };
  if (extname(file) === '.html') {
    headers['content-security-policy'] = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; form-action 'self'";
  }
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
  return true;
}

const slug = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'video';

// ---------- app ----------
export function createApp(config) {
  const store = openDb(config.dataDir);
  const worker = new Worker(config, store);
  const auth = loadSecrets(config);
  const previews = new Map(); // short-lived studio previews, id → { html, exp }

  // Previews run the composition's own inline script, so they get their own
  // locked-down CSP and are framed with sandbox="allow-scripts" (opaque origin).
  function preview(req, res, url) {
    if (!validSession(auth.secret, cookies(req).rw_session)) return send(res, 401, { error: 'login required' });
    const hit = previews.get(url.pathname.slice('/preview/'.length));
    if (!hit || hit.exp < Date.now()) return send(res, 404, { error: 'preview expired, refresh it' });
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src 'none'",
    });
    res.end(hit.html);
  }

  function briefFrom(body) {
    const language = typeof body.language === 'string' && /^[a-z]{2}$/.test(body.language) ? body.language : 'en';
    return {
      topic: String(body.topic || '').trim().slice(0, 500),
      language,
      targetSeconds: Math.max(15, Math.min(600, Number(body.seconds) || 60)),
      aspect: ASPECTS[body.aspect] ? body.aspect : '16:9',
      theme: THEMES.includes(body.theme) ? body.theme : 'midnight',
      voice: VOICES.some((v) => v.id === body.voice) ? body.voice : defaultVoiceFor(language),
      notes: String(body.notes || '').slice(0, 2000),
    };
  }

  async function api(req, res, url) {
    const path = url.pathname;
    const method = req.method;

    if (path === '/api/health') return send(res, 200, { ok: true });

    if (path === '/api/login' && method === 'POST') {
      const ip = req.socket.remoteAddress || '?';
      if (tooManyAttempts(ip)) return send(res, 429, { error: 'too many attempts, wait a few minutes' });
      const body = await readJson(req);
      if (!safeEqual(body.password || '', auth.password)) {
        attempts.get(ip).push(Date.now());
        return send(res, 401, { error: 'wrong password' });
      }
      const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);
      return send(res, 200, { ok: true }, { 'set-cookie': `rw_session=${makeSession(auth.secret)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}` });
    }
    if (path === '/api/logout' && method === 'POST') {
      return send(res, 200, { ok: true }, { 'set-cookie': 'rw_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }

    if (!validSession(auth.secret, cookies(req).rw_session)) return send(res, 401, { error: 'login required' });
    // State-changing calls must be same-origin JSON (SameSite cookie + content-type check = CSRF guard).

    if (path === '/api/config' && method === 'GET') {
      return send(res, 200, {
        llm: { provider: config.llm.provider, label: describeLlm(config.llm), ready: config.llm.provider === 'none' ? false : true },
        voices: VOICES,
        themes: THEMES.map((t) => ({ id: t, label: THEME_TOKENS[t].label, accent: THEME_TOKENS[t].accent, bg: THEME_TOKENS[t].bg })),
        aspects: Object.keys(ASPECTS),
        sceneTypes: Object.fromEntries(Object.entries(SCENE_TYPES).map(([k, v]) => [k, v])),
        disclosure: config.disclosure,
        voiceEnabled: config.voice.enabled,
      });
    }

    if (path === '/api/videos' && method === 'GET') return send(res, 200, { videos: store.list(), rendering: worker.current?.id || null });

    if (path === '/api/videos' && method === 'POST') {
      const body = await readJson(req);
      const brief = briefFrom(body);
      if (body.storyboard) {
        const v = validateStoryboard(body.storyboard, brief);
        if (!v.ok) return send(res, 422, { error: 'storyboard is not valid', errors: v.errors });
        return send(res, 201, store.create({ title: v.storyboard.title, status: 'review', brief, storyboard: v.storyboard }));
      }
      if (body.text) {
        const v = storyboardFromText(String(body.text).slice(0, 20000), brief);
        if (!v.ok) return send(res, 422, { error: 'could not build a storyboard from that text', errors: v.errors });
        return send(res, 201, store.create({ title: v.storyboard.title, status: 'review', brief, storyboard: v.storyboard }));
      }
      if (!brief.topic) return send(res, 400, { error: 'topic is required' });
      const video = store.create({ title: brief.topic.slice(0, 120), status: 'idea', brief });
      if (body.draft && config.llm.provider !== 'none') worker.draft(video.id);
      return send(res, 201, store.get(video.id));
    }

    if (path === '/api/preview' && method === 'POST') {
      const body = await readJson(req);
      const p = previewHtml(config, body.storyboard);
      if (!p.ok) return send(res, 422, { error: 'storyboard is not valid', errors: p.errors });
      const pid = randomBytes(12).toString('base64url');
      previews.set(pid, { html: p.html, exp: Date.now() + 30 * 60 * 1000 });
      for (const [k, v] of previews) if (v.exp < Date.now() || previews.size > 40) previews.delete(k);
      return send(res, 200, { url: `/preview/${pid}`, duration: p.duration });
    }

    const m = path.match(/^\/api\/videos\/([a-z0-9-]{1,40})(?:\/(draft|render|cancel))?$/);
    if (m) {
      const [, id, action] = m;
      const video = store.get(id);
      if (!video) return send(res, 404, { error: 'video not found' });

      if (!action && method === 'GET') return send(res, 200, video);

      if (!action && method === 'PATCH') {
        const body = await readJson(req);
        const fields = {};
        if (typeof body.notes === 'string') fields.notes = body.notes.slice(0, 5000);
        if (typeof body.published_url === 'string') fields.published_url = body.published_url.slice(0, 500);
        if (body.storyboard) {
          const v = validateStoryboard(body.storyboard, video.brief);
          if (!v.ok) return send(res, 422, { error: 'storyboard is not valid', errors: v.errors });
          fields.storyboard = v.storyboard;
          fields.title = v.storyboard.title;
        }
        if (body.status) {
          // Only editorial moves; machine states (drafting, queued, rendering) are set by the worker.
          const allowed = { idea: ['idea'], review: ['review', 'idea'], ready: ['published', 'review'], published: ['ready'], failed: ['idea', 'review'] };
          if (!(allowed[video.status] || []).includes(body.status)) return send(res, 409, { error: `cannot move from ${video.status} to ${body.status}` });
          fields.status = body.status;
        }
        return send(res, 200, store.update(id, fields));
      }

      if (!action && method === 'DELETE') {
        if (video.status === 'rendering') worker.cancel(id);
        store.remove(id);
        await worker.removeFiles(id);
        return send(res, 200, { ok: true });
      }

      if (action === 'draft' && method === 'POST') {
        if (config.llm.provider === 'none') return send(res, 400, { error: 'no LLM configured (set LLM_PROVIDER); write the script by hand instead' });
        if (['drafting', 'queued', 'rendering'].includes(video.status)) return send(res, 409, { error: `video is ${video.status}` });
        const body = await readJson(req).catch(() => ({}));
        if (body.notes) store.update(id, { brief: { ...video.brief, notes: String(body.notes).slice(0, 2000) } });
        worker.draft(id);
        return send(res, 202, store.get(id));
      }

      if (action === 'render' && method === 'POST') {
        if (!video.storyboard) return send(res, 409, { error: 'write or draft the script first' });
        if (['queued', 'rendering', 'drafting'].includes(video.status)) return send(res, 409, { error: `video is already ${video.status}` });
        return send(res, 202, store.update(id, { status: 'queued', error: null, progress: null, stage: null }));
      }

      if (action === 'cancel' && method === 'POST') {
        if (video.status === 'queued') return send(res, 200, store.update(id, { status: 'review' }));
        if (video.status === 'rendering') {
          worker.cancel(id);
          return send(res, 202, { ok: true });
        }
        return send(res, 409, { error: `nothing to cancel (${video.status})` });
      }
    }
    return send(res, 404, { error: 'no such endpoint' });
  }

  async function files(req, res, url) {
    if (!validSession(auth.secret, cookies(req).rw_session)) return send(res, 401, { error: 'login required' });
    const m = url.pathname.match(/^\/files\/([a-z0-9-]{1,40})\/(video\.mp4|poster\.jpg|video\.srt)$/);
    if (!m) return send(res, 404, { error: 'not found' });
    const video = store.get(m[1]);
    if (!video) return send(res, 404, { error: 'not found' });
    const file = join(worker.jobDir(m[1]), m[2]);
    if (!file.startsWith(join(config.dataDir, 'videos') + sep)) return send(res, 400, { error: 'bad path' });
    const download = url.searchParams.has('download') ? `${slug(video.title)}${extname(m[2])}` : undefined;
    return sendFile(req, res, file, { download });
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (url.pathname.startsWith('/files/')) return await files(req, res, url);
      if (url.pathname.startsWith('/preview/')) return preview(req, res, url);
      if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res, url.pathname)) return;
      send(res, 404, { error: 'not found' });
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) send(res, status, { error: status === 500 ? 'internal error' : err.message });
    }
  });

  return { server, store, worker, auth };
}

export function startServer(config) {
  const { server, worker, auth, store } = createApp(config);
  worker.start();
  server.listen(config.port, config.host, () => {
    const where = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`;
    console.log(`🎬 Reelwright studio on ${where}`);
    console.log(`   LLM: ${describeLlm(config.llm)} · data: ${config.dataDir}`);
    if (auth.generated) console.log(`   First run: generated admin password → ${auth.password}\n   (stored in ${join(config.dataDir, '.admin-password')}; set REELWRIGHT_PASSWORD to choose your own)`);
    else if (!config.password) console.log(`   Admin password is in ${join(config.dataDir, '.admin-password')}`);
  });
  const shutdown = () => {
    console.log('shutting down…');
    worker.stop();
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  return server;
}
