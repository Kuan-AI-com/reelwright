import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateStoryboard } from '../src/storyboard.mjs';
import { buildTimeline } from '../src/timing.mjs';
import { composeHtml, badgeText, esc } from '../src/compose/index.mjs';

const sb = validateStoryboard(JSON.parse(readFileSync(new URL('../examples/how-tides-work.json', import.meta.url)))).storyboard;

test('escapes markup in user text', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>&"'), '&lt;img src=x onerror=alert(1)&gt;&amp;&quot;');
  const evil = structuredClone(sb);
  evil.scenes[0].heading = '<script>alert(1)</script>';
  const html = composeHtml(evil, buildTimeline(evil.scenes), { disclosure: true });
  assert.ok(!html.includes('<script>alert(1)</script>'));
});

test('composition follows the HyperFrames contract', () => {
  const tl = buildTimeline(sb.scenes);
  const html = composeHtml(sb, tl, { disclosure: true });
  assert.match(html, /data-composition-id="main"/);
  assert.match(html, new RegExp(`data-duration="${tl.total}"`));
  const scenes = html.match(/<section [^>]*data-scene /g) || [];
  assert.equal(scenes.length, sb.scenes.length);
  assert.ok(!/gsap/i.test(html), 'no GSAP');
  assert.ok(!/Math\.random|Date\.now/.test(html), 'deterministic');
});

test('AI disclosure badge is on by default and can be turned off', () => {
  const tl = buildTimeline(sb.scenes);
  assert.ok(composeHtml(sb, tl, { disclosure: true }).includes(badgeText('en')));
  assert.ok(!composeHtml(sb, tl, { disclosure: false }).includes(badgeText('en')));
});

test('badge is localized', () => {
  assert.notEqual(badgeText('es'), badgeText('en'));
  assert.equal(typeof badgeText('zz'), 'string');
});
