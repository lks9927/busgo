import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDB();
    const rows = await db.all('SELECT key, value FROM settings WHERE key IN (?, ?)', [
      'gbis_api_key',
      'gbis_route_mappings'
    ]);

    const config: { gbis_api_key: string; gbis_route_mappings: Record<string, string> } = {
      gbis_api_key: '',
      gbis_route_mappings: {}
    };

    rows.forEach((row: { key: string; value: string }) => {
      if (row.key === 'gbis_api_key') {
        // Mask the API key in GET responses for security, unless empty
        config.gbis_api_key = row.value ? `${row.value.substring(0, 8)}...` : '';
      } else if (row.key === 'gbis_route_mappings') {
        try {
          config.gbis_route_mappings = JSON.parse(row.value);
        } catch {
          config.gbis_route_mappings = {};
        }
      }
    });

    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = await request.json();
    const { gbis_api_key, gbis_route_mappings } = body;

    await db.run('BEGIN TRANSACTION');
    try {
      if (gbis_api_key !== undefined) {
        // If the key is masked (ends with '...'), don't overwrite the existing full key in the DB
        const isMasked = gbis_api_key.endsWith('...');
        if (!isMasked) {
          await db.run(
            `INSERT INTO settings (key, value, updated_at) 
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
            ['gbis_api_key', gbis_api_key]
          );
        }
      }

      if (gbis_route_mappings !== undefined) {
        await db.run(
          `INSERT INTO settings (key, value, updated_at) 
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
          ['gbis_route_mappings', JSON.stringify(gbis_route_mappings)]
        );
      }

      await db.run('COMMIT');
    } catch (e: any) {
      await db.run('ROLLBACK');
      throw e;
    }

    return NextResponse.json({ message: 'Configuration saved successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
