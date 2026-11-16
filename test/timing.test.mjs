import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, captionGroups, estimateSpeechSeconds } from '../src/timing.mjs';
import { estimateWords, wavDuration } from '../src/voice.mjs';
import { toSrt } from '../src/render.mjs';

const scenes = [
  { id: 's1', type: 'title', narration: 'Hello there, this is a short opening line.' },
  { id: 's2', type: 'bullets', items: ['a', 'b', 'c', 'd', 'e'], narration: 'Five points to make, one after another, slowly.' },
];

test('timeline is contiguous and covers every scene', () => {
  const tl = buildTimeline(scenes);
  assert.equal(tl.scenes[0].start, 0);
  assert.equal(tl.scenes[1].start, tl.scenes[0].duration);
  assert.ok(Math.abs(tl.total - (tl.scenes[0].duration + tl.scenes[1].duration)) < 0.01);
});

test('voice timing offsets words into absolute time', () => {
  const voices = [{ file: 'a.wav', duration: 2, words: [{ text: 'Hello', start: 0, end: 0.4 }] }, null];
  const tl = buildTimeline(scenes, voices);
  assert.equal(tl.scenes[0].voice.file, 'a.wav');
  assert.ok(tl.scenes[0].words[0].start > 0, 'lead-in applied');
  assert.ok(tl.scenes[0].duration >= 2, 'scene is at least as long as its voice');
});

test('speech estimate grows with text', () => {
  assert.ok(estimateSpeechSeconds('one two three') < estimateSpeechSeconds('one two three four five six seven eight nine ten'));
});

test('estimated words are ordered and inside the clip', () => {
  const w = estimateWords('The quick brown fox jumps over the lazy dog.', 3);
  assert.equal(w.length, 9);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].start >= w[i - 1].start);
  assert.ok(w.at(-1).end <= 3);
});

test('caption groups respect word and character limits', () => {
  const words = estimateWords('Captions should be split into short readable groups that never get too long on screen at all.', 6);
  const groups = captionGroups(words, { maxWords: 4, maxChars: 22 });
  assert.ok(groups.length > 2);
  for (const g of groups) {
    assert.ok(g.words.length <= 4);
    assert.ok(g.start < g.end);
  }
});

test('SRT output is well formed', () => {
  const srt = toSrt([{ start: 0, end: 1.5, words: [{ text: 'Hi' }, { text: 'there' }] }, { start: 61.25, end: 62, words: [{ text: 'Bye' }] }]);
  assert.match(srt, /^1\n00:00:00,000 --> 00:00:01,500\nHi there\n/);
  assert.match(srt, /2\n00:01:01,250 --> 00:01:02,000\nBye/);
});

test('wavDuration reads a PCM header', () => {
  const sampleRate = 24000, seconds = 2, bytes = sampleRate * 2 * seconds;
  const b = Buffer.alloc(44 + bytes);
  b.write('RIFF', 0); b.writeUInt32LE(36 + bytes, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(bytes, 40);
  assert.ok(Math.abs(wavDuration(b) - 2) < 0.001);
});
