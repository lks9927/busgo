import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const route = searchParams.get('route');

    let query = 'SELECT * FROM route_reduction_rules';
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
    const { route, rules } = body; // rules: Array<{ condition, reduction_count }>

    if (!route) {
      return NextResponse.json({ error: 'Route name is required' }, { status: 400 });
    }

    await db.run('BEGIN TRANSACTION');
    try {
      await db.run('DELETE FROM route_reduction_rules WHERE route = ?', [route]);
      if (Array.isArray(rules)) {
        for (const r of rules) {
          await db.run(
            'INSERT INTO route_reduction_rules (route, condition, reduction_count) VALUES (?, ?, ?)',
            [route, r.condition, Number(r.reduction_count)]
          );
        }
      }
      await db.run('COMMIT');
    } catch (e: any) {
      await db.run('ROLLBACK');
      throw e;
    }

    return NextResponse.json({ message: 'Route reduction rules updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
