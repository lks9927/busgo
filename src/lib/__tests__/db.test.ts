import { describe, it, expect } from 'vitest';
import { getDB } from '../db';
import { migrate } from '../migrate';

describe('SQLite DB Connection and Migration Tests', () => {
  it('should successfully connect to the DB and execute queries', async () => {
    const db = await getDB();
    const result = await db.get('SELECT 1 + 1 AS sum');
    expect(result).toBeDefined();
    expect(result?.sum).toBe(2);
  });

  it('should verify the existing tables monthly_schedules and weekly_dispatches exist with correct row counts', async () => {
    const db = await getDB();
    
    // Check tables in sqlite_master
    const monthlyTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='monthly_schedules'");
    const weeklyTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='weekly_dispatches'");
    
    expect(monthlyTable).toBeDefined();
    expect(monthlyTable?.name).toBe('monthly_schedules');
    expect(weeklyTable).toBeDefined();
    expect(weeklyTable?.name).toBe('weekly_dispatches');

    // Verify row counts
    const monthlyCount = await db.get('SELECT COUNT(*) as count FROM monthly_schedules');
    const weeklyCount = await db.get('SELECT COUNT(*) as count FROM weekly_dispatches');

    expect(monthlyCount?.count).toBeGreaterThanOrEqual(100000);
    expect(weeklyCount?.count).toBeGreaterThanOrEqual(58000);
  });

  it('should perform migration and create the 7 new tables without errors', async () => {
    const db = await getDB();

    // Run migrate
    await migrate();

    // Check 7 new tables
    const newTables = [
      'drivers',
      'vehicles',
      'schedules',
      'leave_requests',
      'fairness_log',
      'admins',
      'settings'
    ];

    for (const tableName of newTables) {
      const tableInfo = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName]);
      expect(tableInfo).toBeDefined();
      expect(tableInfo?.name).toBe(tableName);
    }
  });

  it('should run migration multiple times without throwing errors', async () => {
    // Calling migrate again shouldn't fail because of "IF NOT EXISTS"
    await expect(migrate()).resolves.not.toThrow();
  });

  it('should have WAL mode and Foreign Keys enabled', async () => {
    const db = await getDB();
    const journalMode = await db.get('PRAGMA journal_mode');
    const foreignKeys = await db.get('PRAGMA foreign_keys');

    expect(journalMode?.journal_mode?.toLowerCase()).toBe('wal');
    expect(Number(foreignKeys?.foreign_keys)).toBe(1);
  });
});
