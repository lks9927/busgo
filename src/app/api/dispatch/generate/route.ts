import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { generateDispatch, syncSchedulesToWeeklyDispatches } from '@/lib/generate';

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = await request.json();
    const { route, year, month } = body;

    if (!route || !year || !month) {
      return NextResponse.json({ error: 'route, year, and month are required' }, { status: 400 });
    }

    const result = await generateDispatch(db, route, Number(year), Number(month));
    
    // Sync to weekly_dispatches
    await syncSchedulesToWeeklyDispatches(db, route, Number(year), Number(month));
    
    return NextResponse.json({ message: 'Dispatch generated successfully', count: result.count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

