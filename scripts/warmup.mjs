#!/usr/bin/env node
// Pre-download everything a first render needs (Chrome, the Kokoro voice model,
// the theme fonts) so the first video does not stall. Used by the Dockerfile;
// safe to run by hand. Every step is best-effort and reports what it did.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runHyperframes } from '../src/hf.mjs';

const step = async (name, fn) => {
  const t = Date.now();
  try {
    await fn();
    console.log(`✓ ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  } catch (e) {
    console.log(`✗ ${name}: ${String(e.message).split('\n').slice(-3).join(' ')}`);
    process.exitCode = 1;
  }
};

const dir = mkdtempSync(join(tmpdir(), 'reelwright-warmup-'));
if (!process.env.HYPERFRAMES_BROWSER_PATH) await step('chrome', () => runHyperframes(['browser', 'ensure']));
await step('voice model (Kokoro-82M)', () => runHyperframes(['tts', 'Ready.', '--voice', 'af_heart', '--output', join(dir, 'v.wav')]));
await step('theme fonts', () => {
  writeFileSync(
    join(dir, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;width:320px;height:180px;background:#000;color:#fff}
.a{font-family:Inter;font-weight:400}.b{font-family:Inter;font-weight:800}.c{font-family:'Playfair Display';font-weight:700}.d{font-family:'Archivo Black'}
</style></head><body><div data-composition-id="main" data-no-timeline data-start="0" data-duration="0.2" data-width="320" data-height="180">
<p class="a">a</p><p class="b">b</p><p class="c">c</p><p class="d">d</p></div></body></html>`,
  );
  return runHyperframes(['render', '--quiet', '--quality', 'draft', '--output', join(dir, 'w.mp4')], { cwd: dir });
});
rmSync(dir, { recursive: true, force: true });
