import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const route = searchParams.get('route');

    let query = 'SELECT * FROM route_timetables';
    const params: any[] = [];

    if (route) {
      query += ' WHERE route = ?';
      params.push(route);
    }
    query += ' ORDER BY route ASC, shift_type ASC, sequence ASC';

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
    const { route, timetables } = body; // timetables: Array<{ shift_type, sequence, departure_time }>

    if (!route) {
      return NextResponse.json({ error: 'Route name is required' }, { status: 400 });
    }

    await db.run('BEGIN TRANSACTION');
    try {
      await db.run('DELETE FROM route_timetables WHERE route = ?', [route]);
      if (Array.isArray(timetables)) {
        for (const t of timetables) {
          await db.run(
            'INSERT INTO route_timetables (route, shift_type, sequence, departure_time) VALUES (?, ?, ?, ?)',
            [route, t.shift_type, Number(t.sequence), t.departure_time]
          );
        }
      }
      await db.run('COMMIT');
    } catch (e: any) {
      await db.run('ROLLBACK');
      throw e;
    }

    return NextResponse.json({ message: 'Route timetables updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
