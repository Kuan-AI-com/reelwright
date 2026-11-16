// SQLite storage (node:sqlite, no native dependency). One table: videos.
// A video moves through the editorial board:
//   idea → drafting → review → queued → rendering → ready → published
//                         ↘ failed (from drafting or rendering; retry puts it back)
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const STATUSES = ['idea', 'drafting', 'review', 'queued', 'rendering', 'ready', 'published', 'failed'];

const COLUMNS = ['title', 'status', 'brief', 'storyboard', 'stage', 'progress', 'error', 'duration', 'notes', 'published_url', 'rendered_at'];
const JSON_COLUMNS = new Set(['brief', 'storyboard']);

export function openDb(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'reelwright.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idea',
      brief TEXT NOT NULL DEFAULT '{}',
      storyboard TEXT,
      stage TEXT,
      progress REAL,
      error TEXT,
      duration REAL,
      notes TEXT NOT NULL DEFAULT '',
      published_url TEXT,
      rendered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS videos_status ON videos(status, updated_at);
  `);
  // Anything left mid-flight by a crash or restart goes back to a safe state.
  db.exec(`UPDATE videos SET status = 'queued', stage = NULL, progress = NULL WHERE status = 'rendering';
           UPDATE videos SET status = 'failed', error = 'interrupted by a restart; try again' WHERE status = 'drafting';`);
  return new Store(db);
}

function decode(row) {
  if (!row) return null;
  const out = { ...row };
  for (const c of JSON_COLUMNS) out[c] = row[c] == null ? null : JSON.parse(row[c]);
  return out;
}

class Store {
  constructor(db) {
    this.db = db;
  }

  create({ title, status = 'idea', brief = {}, storyboard = null, notes = '' }) {
    const id = randomUUID().slice(0, 8);
    this.db
      .prepare('INSERT INTO videos (id, title, status, brief, storyboard, notes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, title, status, JSON.stringify(brief), storyboard ? JSON.stringify(storyboard) : null, notes);
    return this.get(id);
  }

  get(id) {
    return decode(this.db.prepare('SELECT * FROM videos WHERE id = ?').get(id));
  }

  list() {
    return this.db
      .prepare('SELECT id, title, status, stage, progress, error, duration, published_url, rendered_at, created_at, updated_at FROM videos ORDER BY updated_at DESC LIMIT 500')
      .all()
      .map((r) => ({ ...r }));
  }

  update(id, fields) {
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(fields)) {
      if (!COLUMNS.includes(k)) continue;
      if (k === 'status' && !STATUSES.includes(v)) throw new Error(`unknown status ${v}`);
      sets.push(`${k} = ?`);
      vals.push(JSON_COLUMNS.has(k) && v != null ? JSON.stringify(v) : v ?? null);
    }
    if (sets.length === 0) return this.get(id);
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
    this.db.prepare(`UPDATE videos SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    return this.get(id);
  }

  remove(id) {
    return this.db.prepare('DELETE FROM videos WHERE id = ?').run(id).changes > 0;
  }

  /** Atomically claim the oldest queued video for rendering. */
  claimNext() {
    const row = this.db.prepare("SELECT id FROM videos WHERE status = 'queued' ORDER BY updated_at ASC LIMIT 1").get();
    if (!row) return null;
    const changed = this.db
      .prepare("UPDATE videos SET status = 'rendering', stage = 'starting', progress = 0, error = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND status = 'queued'")
      .run(row.id).changes;
    return changed ? this.get(row.id) : null;
  }

  close() {
    this.db.close();
  }
}
