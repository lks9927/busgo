import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const route = searchParams.get('route');

    let query = 'SELECT * FROM route_shifts';
    const params: any[] = [];

    if (route) {
      query += ' WHERE route = ?';
      params.push(route);
    }
    query += ' ORDER BY route ASC, id ASC';

    const list = await db.all(query, params);
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = await request.json();
    const { route, shifts } = body; // shifts: Array<{ shift_name, start_time, end_time }>

    if (!route) {
      return NextResponse.json({ error: 'Route name is required' }, { status: 400 });
    }

    await db.run('BEGIN TRANSACTION');
    try {
      await db.run('DELETE FROM route_shifts WHERE route = ?', [route]);
      if (Array.isArray(shifts)) {
        for (const s of shifts) {
          await db.run(
            'INSERT INTO route_shifts (route, shift_name, start_time, end_time) VALUES (?, ?, ?, ?)',
            [route, s.shift_name, s.start_time, s.end_time]
          );
        }
      }
      await db.run('COMMIT');
    } catch (e: any) {
      await db.run('ROLLBACK');
      throw e;
    }

    return NextResponse.json({ message: 'Route shifts updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
