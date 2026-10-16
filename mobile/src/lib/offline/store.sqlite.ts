import type { OutboxStore } from './store-types';
import type { OutboxItem } from './types';

interface SqliteRow {
  id: string;
  type: string;
  payload: string;
  created_at: string;
  attempts: number;
  status: string;
  last_error: string | null;
}

interface SqliteConnectionLike {
  open(): Promise<void>;
  execute(statement: string): Promise<unknown>;
  run(statement: string, values?: unknown[]): Promise<unknown>;
  query(statement: string, values?: unknown[]): Promise<{ values?: SqliteRow[] }>;
}

/**
 * SQLite-backed outbox for the Android app. Writes survive app restarts and
 * process death, so a queued change is never lost before it reaches the server.
 */
export class SqliteOutboxStore implements OutboxStore {
  private db: SqliteConnectionLike | null = null;

  async init(): Promise<void> {
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const db = (await sqlite.createConnection(
      'warung',
      false,
      'no-encryption',
      1,
      false,
    )) as unknown as SqliteConnectionLike;

    await db.open();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        last_error TEXT
      );
    `);

    this.db = db;
  }

  async all(): Promise<OutboxItem[]> {
    const result = await this.require().query('SELECT * FROM outbox ORDER BY created_at ASC');
    return (result.values ?? []).map((row) => ({
      id: row.id,
      type: row.type as OutboxItem['type'],
      payload: JSON.parse(row.payload) as OutboxItem['payload'],
      createdAt: row.created_at,
      attempts: row.attempts,
      status: row.status as OutboxItem['status'],
      lastError: row.last_error,
    }));
  }

  async put(item: OutboxItem): Promise<void> {
    await this.require().run(
      `INSERT OR REPLACE INTO outbox
         (id, type, payload, created_at, attempts, status, last_error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.type,
        JSON.stringify(item.payload),
        item.createdAt,
        item.attempts,
        item.status,
        item.lastError,
      ],
    );
  }

  async remove(id: string): Promise<void> {
    await this.require().run('DELETE FROM outbox WHERE id = ?', [id]);
  }

  private require(): SqliteConnectionLike {
    if (!this.db) throw new Error('SQLite store is not initialised.');
    return this.db;
  }
}
