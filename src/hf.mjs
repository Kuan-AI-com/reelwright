// Thin wrapper around the HyperFrames CLI (Apache-2.0), run as a child process.
// Telemetry is always switched off for child processes: a self-hosted tool
// should not report anything anywhere unless its operator decides so.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

export function hyperframesBin() {
  return join(dirname(require.resolve('hyperframes/package.json')), 'bin', 'hyperframes.mjs');
}

export function childEnv(extra = {}) {
  return { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1', NO_UPDATE_NOTIFIER: '1', ...extra };
}

/**
 * Run `hyperframes <args>`. Resolves with {stdout, stderr}; rejects with the
 * tail of stderr so errors are readable in the UI.
 */
export function runHyperframes(args, { cwd, timeoutMs = 30 * 60 * 1000, onLine, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hyperframesBin(), ...args], { cwd, env: childEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let buf = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    const abort = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', abort, { once: true });
    const feed = (chunk) => {
      if (!onLine) return;
      buf += chunk;
      let i;
      while ((i = buf.search(/[\r\n]/)) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line) onLine(line);
      }
    };
    child.stdout.on('data', (d) => { stdout += d; feed(String(d)); });
    child.stderr.on('data', (d) => { stderr += d; feed(String(d)); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (code === 0) resolve({ stdout, stderr });
      else {
        const tail = (stderr || stdout).trim().split('\n').slice(-8).join('\n');
        reject(new Error(`hyperframes ${args[0]} failed (exit ${code ?? 'killed'}): ${tail}`));
      }
    });
  });
}

/** Run any executable (ffmpeg, ffprobe). */
export function run(cmd, args, { cwd, timeoutMs = 10 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: childEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} failed (exit ${code}): ${stderr.trim().split('\n').slice(-4).join('\n')}`));
    });
  });
}
