import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDB();
    const settingsList = await db.all('SELECT * FROM settings');
    
    // Convert array of key-value pairs to an object
    const settingsObj = settingsList.reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
    
    return NextResponse.json(settingsObj);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = await request.json(); // Expected: { [key: string]: string }
    
    await db.run('BEGIN TRANSACTION');
    try {
      for (const [key, value] of Object.entries(body)) {
        await db.run(
          `INSERT INTO settings (key, value, updated_at) 
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
          [key, String(value)]
        );
      }
      await db.run('COMMIT');
    } catch (e: any) {
      await db.run('ROLLBACK');
      throw e;
    }
    
    return NextResponse.json({ message: 'Settings updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
