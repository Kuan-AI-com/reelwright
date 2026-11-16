import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lintStoryboard, formatFindings } from '../src/slop.mjs';

const rules = (sb) => lintStoryboard(sb).findings.map((f) => f.rule);
const one = (narration, extra = {}) => ({ scenes: [{ type: 'title', heading: 'A title', narration, ...extra }] });

test('bundled examples are slop-free', () => {
  for (const f of ['how-tides-work', 'agua-del-planeta']) {
    const sb = JSON.parse(readFileSync(new URL(`../examples/${f}.json`, import.meta.url)));
    const r = lintStoryboard(sb);
    assert.equal(r.score, 100, `${f}: ${formatFindings(r.findings).join('\n')}`);
  }
});

test('flags stock openers, hype and empty endings in English', () => {
  const r = rules(one("In today's fast-paced world, let's dive in. This game-changer will unlock everything. The possibilities are endless."));
  for (const k of ['slop.opener', 'slop.hype', 'slop.ending']) assert.ok(r.includes(k), k);
});

test('flags Spanish slop, including words ending in accents', () => {
  const r = lintStoryboard(one('En el mundo actual todo cambia. Solo el tiempo lo dirá. En conclusión, es revolucionario.'));
  const msgs = r.findings.map((f) => f.message).join(' ');
  assert.match(msgs, /en el mundo actual/);
  assert.match(msgs, /dirá/);
  assert.match(msgs, /revolucionario/);
});

test('flags "it\'s not X, it\'s Y"', () => {
  assert.ok(rules(one("It's not just a habit, it's a lifestyle.")).includes('slop.not-x-but-y'));
  assert.ok(rules(one('No es solo un hábito, es una forma de vida.')).includes('slop.not-x-but-y'));
});

test('unsourced numbers and unattributed quotes are errors', () => {
  const r = lintStoryboard({ scenes: [
    { type: 'stat', value: 40, label: 'of people', narration: 'Forty percent of people.' },
    { type: 'quote', quote: 'Be yourself.', narration: 'Someone once said: be yourself.' },
  ] });
  const errs = r.findings.filter((f) => f.severity === 'error').map((f) => f.rule);
  assert.deepEqual(errs.sort(), ['facts.unattributed', 'facts.unsourced']);
});

test('on-screen text that repeats the voice, long scenes, too many questions', () => {
  const long = Array(60).fill('word').join(' ') + '.';
  const r = rules({ scenes: [
    { type: 'title', heading: 'The sea breathes twice a day', narration: 'The sea breathes twice a day. Why?' },
    { type: 'outro', heading: 'End', narration: `${long} Why? Why? Why?` },
  ] });
  assert.ok(r.includes('screen.repeats-voice'));
  assert.ok(r.includes('pace.long-scene'));
  assert.ok(r.includes('voice.questions'));
});

test('clean, specific writing scores 100', () => {
  const r = lintStoryboard(one('The Moon pulls the ocean toward it. Earth spins through that bulge twice a day.', { heading: 'Why tides happen' }));
  assert.equal(r.score, 100);
});
