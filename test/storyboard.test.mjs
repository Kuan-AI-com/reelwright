import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateStoryboard, storyboardFromText, defaultVoiceFor, SCENE_TYPES } from '../src/storyboard.mjs';

const example = JSON.parse(readFileSync(new URL('../examples/how-tides-work.json', import.meta.url)));

test('bundled example is valid', () => {
  const v = validateStoryboard(example);
  assert.equal(v.ok, true, v.errors.join('\n'));
  assert.equal(v.storyboard.scenes.length, example.scenes.length);
  assert.ok(v.storyboard.scenes.every((s) => s.id), 'every scene gets an id');
});

test('every example in examples/ validates', async () => {
  const { readdirSync } = await import('node:fs');
  for (const f of readdirSync(new URL('../examples/', import.meta.url)).filter((f) => f.endsWith('.json'))) {
    const sb = JSON.parse(readFileSync(new URL(`../examples/${f}`, import.meta.url)));
    const v = validateStoryboard(sb);
    assert.equal(v.ok, true, `${f}: ${v.errors.join('; ')}`);
  }
});

test('never throws on garbage', () => {
  for (const junk of [null, undefined, 42, 'x', [], { scenes: 'no' }, { scenes: [null, 7] }]) {
    const v = validateStoryboard(junk);
    assert.equal(v.ok, false);
    assert.ok(v.errors.length > 0);
  }
});

test('reports missing required fields per scene type', () => {
  const v = validateStoryboard({ title: 'T', scenes: [{ type: 'stat', narration: 'hi' }, { type: 'bars', heading: 'h', bars: [{ label: 'a', value: 1 }], narration: 'x' }] });
  assert.equal(v.ok, false);
  const all = v.errors.join(' ');
  assert.match(all, /value/);
  assert.match(all, /bars/);
});

test('unknown scene types are rejected', () => {
  const v = validateStoryboard({ title: 'T', scenes: [{ type: 'explosion', narration: 'boom' }] });
  assert.equal(v.ok, false);
});

test('every scene type declares required fields and a description', () => {
  for (const [k, spec] of Object.entries(SCENE_TYPES)) {
    assert.ok(Array.isArray(spec.req) && Array.isArray(spec.opt), k);
    assert.ok(spec.about.length > 10, k);
  }
});

test('plain text becomes a storyboard', () => {
  const v = storyboardFromText('My title\n\nFirst paragraph is narrated.\n\nSecond one too.', { language: 'en' });
  assert.equal(v.ok, true, v.errors?.join('; '));
  assert.equal(v.storyboard.title, 'My title');
  assert.ok(v.storyboard.scenes.length >= 2);
});

test('default voice follows language', () => {
  assert.match(defaultVoiceFor('es'), /^e/);
  assert.match(defaultVoiceFor('en'), /^a/);
  assert.equal(defaultVoiceFor('xx', 'af_heart'), 'af_heart');
});
