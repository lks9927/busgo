import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;

    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const logs = await db.all('SELECT * FROM fairness_log WHERE driver_id = ? ORDER BY month DESC', [id]);

    return NextResponse.json({
      driver,
      logs
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
