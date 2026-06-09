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
      SELECT s.*, 
             d.name as driver_name, 
             d.employee_id as driver_employee_id,
             v.vehicle_number, 
             od.name as original_driver_name
      FROM schedules s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN drivers od ON s.original_driver_id = od.id
      WHERE s.route = ? AND s.date LIKE ?
      ORDER BY s.date ASC, s.sequence ASC, s.shift_type DESC
    `;
    const params = [route, `${month}-%`];

    const schedules = await db.all(query, params);
    return NextResponse.json(schedules);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
