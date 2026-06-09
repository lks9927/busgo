import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { calculateFairnessForRoute } from '@/lib/fairness';

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const route = searchParams.get('route');

    if (!route) {
      return NextResponse.json({ error: 'route is required' }, { status: 400 });
    }

    const fairnessData = await calculateFairnessForRoute(db, route);
    return NextResponse.json(fairnessData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
