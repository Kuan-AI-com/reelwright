import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.mjs';
import { createApp } from '../src/server.mjs';

const example = JSON.parse(readFileSync(new URL('../examples/how-tides-work.json', import.meta.url)));
let dir, app, base, cookie = '';

async function call(path, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(auth && cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'reelwright-test-'));
  app = createApp(loadConfig({ dataDir: dir, password: '', llm: { provider: 'none' } }));
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => {
  app.server.close();
  app.store.close();
  rmSync(dir, { recursive: true, force: true });
});

test('generates a private admin password on first run', () => {
  assert.equal(app.auth.generated, true);
  const st = statSync(join(dir, '.admin-password'));
  assert.equal(st.mode & 0o077, 0, 'not readable by group/others');
});

test('API requires login', async () => {
  assert.equal((await call('/api/videos', { auth: false })).status, 401);
  assert.equal((await call('/api/login', { method: 'POST', body: { password: 'nope' } })).status, 401);
});

test('login sets a hardened cookie', async () => {
  const r = await call('/api/login', { method: 'POST', body: { password: app.auth.password } });
  assert.equal(r.status, 200);
  const sc = r.headers.get('set-cookie');
  assert.match(sc, /HttpOnly/);
  assert.match(sc, /SameSite=Strict/);
  cookie = sc.split(';')[0];
});

test('tampered session is rejected', async () => {
  const bad = cookie.slice(0, -3) + 'AAA';
  const res = await fetch(base + '/api/videos', { headers: { cookie: bad } });
  assert.equal(res.status, 401);
});

test('create, edit and queue a video', async () => {
  const c = await call('/api/videos', { method: 'POST', body: { storyboard: example } });
  assert.equal(c.status, 201);
  assert.equal(c.json.status, 'review');
  const id = c.json.id;

  const bad = await call(`/api/videos/${id}`, { method: 'PATCH', body: { storyboard: { title: 'x', scenes: [] } } });
  assert.equal(bad.status, 422);

  const illegal = await call(`/api/videos/${id}`, { method: 'PATCH', body: { status: 'published' } });
  assert.equal(illegal.status, 409);

  const q = await call(`/api/videos/${id}/render`, { method: 'POST' });
  assert.equal(q.status, 202);
  assert.equal(q.json.status, 'queued');
  const cancel = await call(`/api/videos/${id}/cancel`, { method: 'POST' });
  assert.equal(cancel.json.status, 'review');

  const list = await call('/api/videos');
  assert.equal(list.json.videos.length, 1);
  assert.equal((await call(`/api/videos/${id}`, { method: 'DELETE' })).status, 200);
});

test('drafting without an LLM fails clearly', async () => {
  const c = await call('/api/videos', { method: 'POST', body: { topic: 'Why cats purr' } });
  assert.equal(c.json.status, 'idea');
  const d = await call(`/api/videos/${c.json.id}/draft`, { method: 'POST', body: {} });
  assert.equal(d.status, 400);
});

test('preview is served from a short-lived URL with a strict CSP', async () => {
  const p = await call('/api/preview', { method: 'POST', body: { storyboard: example } });
  assert.equal(p.status, 200);
  const res = await fetch(base + p.json.url, { headers: { cookie } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(await res.text(), /data-composition-id="main"/);
});

test('rejects non-JSON bodies and path traversal', async () => {
  const res = await fetch(base + '/api/videos', { method: 'POST', headers: { cookie, 'content-type': 'text/plain' }, body: 'x' });
  assert.equal(res.status, 415);
  assert.equal((await fetch(base + '/..%2f..%2fpackage.json')).status, 404);
  assert.equal((await fetch(base + '/files/../../package.json', { headers: { cookie } })).status, 404);
});
