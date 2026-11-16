// Background work: one render at a time (rendering saturates the CPU of a
// small VPS; two in parallel are slower than two in a row), drafts run
// concurrently since they only wait on the LLM.
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { draft, produce } from './pipeline.mjs';

export class Worker {
  constructor(config, store) {
    this.config = config;
    this.store = store;
    this.current = null; // { id, controller }
    this.timer = null;
  }

  jobDir(id) {
    return join(this.config.dataDir, 'videos', id);
  }

  start(intervalMs = 1500) {
    this.timer = setInterval(() => this.tick(), intervalMs);
    this.timer.unref?.();
    this.tick();
  }

  stop() {
    clearInterval(this.timer);
    this.current?.controller.abort();
  }

  async tick() {
    if (this.current) return;
    const video = this.store.claimNext();
    if (!video) return;
    const controller = new AbortController();
    this.current = { id: video.id, controller };
    let lastWrite = 0;
    try {
      const res = await produce(this.config, video.storyboard, this.jobDir(video.id), {
        signal: controller.signal,
        onStage: (stage, detail) => this.store.update(video.id, { stage: detail ? `${stage}: ${detail}` : stage }),
        onProgress: (p) => {
          const now = Date.now();
          if (now - lastWrite > 1000) {
            lastWrite = now;
            this.store.update(video.id, { progress: p });
          }
        },
      });
      this.store.update(video.id, { status: 'ready', stage: null, progress: 100, duration: res.duration, rendered_at: new Date().toISOString(), error: null });
    } catch (err) {
      const cancelled = controller.signal.aborted;
      this.store.update(video.id, { status: cancelled ? 'review' : 'failed', stage: null, progress: null, error: cancelled ? 'render cancelled' : String(err.message || err).slice(0, 2000) });
    } finally {
      this.current = null;
      setImmediate(() => this.tick());
    }
  }

  cancel(id) {
    if (this.current?.id === id) {
      this.current.controller.abort();
      return true;
    }
    return false;
  }

  /** Draft a storyboard with the LLM in the background. */
  async draft(id) {
    const video = this.store.get(id);
    if (!video) return;
    this.store.update(id, { status: 'drafting', error: null, stage: 'writing the script' });
    try {
      const sb = await draft(this.config, { ...video.brief, topic: video.brief.topic || video.title });
      this.store.update(id, { status: 'review', storyboard: sb, title: sb.title, stage: null });
    } catch (err) {
      this.store.update(id, { status: 'failed', stage: null, error: String(err.message || err).slice(0, 2000) });
    }
  }

  async removeFiles(id) {
    await rm(this.jobDir(id), { recursive: true, force: true });
  }
}
