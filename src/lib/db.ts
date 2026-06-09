import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';

let dbPromise: Promise<any> | null = null;

const isPostgres = !!process.env.DATABASE_URL;

class PostgresAdapter {
  private pool: Pool;

  constructor(connectionString: string) {
    // Supabase requires SSL connection. rejectUnauthorized: false is standard for serverless
    this.pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }

  private convertQuery(query: string): string {
    let index = 1;
    // Converts SQLite '?' placeholders to PostgreSQL '$1', '$2' placeholders
    return query.replace(/\?/g, () => `$${index++}`);
  }

  async all(query: string, params: any[] = []): Promise<any[]> {
    const pgQuery = this.convertQuery(query);
    const res = await this.pool.query(pgQuery, params);
    return res.rows;
  }

  async get(query: string, params: any[] = []): Promise<any> {
    const pgQuery = this.convertQuery(query);
    const res = await this.pool.query(pgQuery, params);
    return res.rows[0] || null;
  }

  async run(query: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    const pgQuery = this.convertQuery(query);
    const res = await this.pool.query(pgQuery, params);
    return {
      changes: res.rowCount || 0,
      lastID: res.rows[0]?.id || undefined
    };
  }

  async exec(query: string): Promise<void> {
    await this.pool.query(query);
  }
}

export function getDB(): Promise<any> {
  if (!dbPromise) {
    if (isPostgres) {
      console.log('Database Connection: PostgreSQL (Supabase)');
      dbPromise = Promise.resolve(new PostgresAdapter(process.env.DATABASE_URL!));
    } else {
      console.log('Database Connection: SQLite (Local)');
      const LOCAL_INTERNAL_DB = path.resolve(process.cwd(), 'busgo.db');
      const LOCAL_EXTERNAL_DB = path.resolve(process.cwd(), '..', 'busgo.db');
      const DB_PATH = fs.existsSync(LOCAL_INTERNAL_DB) ? LOCAL_INTERNAL_DB : LOCAL_EXTERNAL_DB;

      dbPromise = open({
        filename: DB_PATH,
        driver: sqlite3.Database
      }).then(async (db) => {
        await db.run('PRAGMA journal_mode = WAL');
        await db.run('PRAGMA foreign_keys = ON');
        return db;
      });
    }
  }
  return dbPromise;
}
