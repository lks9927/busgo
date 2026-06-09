import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const route = searchParams.get('route');
    const month = searchParams.get('month'); // 형식: '2025-03'

    if (!route || !month) {
      return NextResponse.json({ error: 'route and month are required' }, { status: 400 });
    }

    const query = `
      SELECT *
      FROM weekly_dispatches
      WHERE route = ? AND date LIKE ?
      ORDER BY date ASC, shift_type DESC, sequence ASC
    `;
    const params = [route, `${month}-%`];

    const dispatches = await db.all(query, params);
    return NextResponse.json(dispatches);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
