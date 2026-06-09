import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDB();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // optional, e.g. '2025-03'

    let query = `
      SELECT s.*, 
             v.vehicle_number, 
             d.name as driver_name,
             od.name as original_driver_name
      FROM schedules s
      LEFT JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN drivers od ON s.original_driver_id = od.id
      WHERE s.driver_id = ?
    `;
    const queryParams: any[] = [id];

    if (month) {
      query += ' AND s.date LIKE ?';
      queryParams.push(`${month}-%`);
    }

    query += ' ORDER BY s.date ASC, s.sequence ASC';

    const schedules = await db.all(query, queryParams);
    return NextResponse.json(schedules);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
