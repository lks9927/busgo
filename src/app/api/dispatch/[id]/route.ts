import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;

    const schedule = await db.get(
      `SELECT s.*, d.name as driver_name, v.vehicle_number, od.name as original_driver_name
       FROM schedules s
       LEFT JOIN drivers d ON s.driver_id = d.id
       LEFT JOIN vehicles v ON s.vehicle_id = v.id
       LEFT JOIN drivers od ON s.original_driver_id = od.id
       WHERE s.id = ?`,
      [id]
    );

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json(schedule);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;
    const body = await request.json();
    const { driver_id, vehicle_id, shift_type, sequence, status, is_substitute, original_driver_id } = body;

    const schedule = await db.get('SELECT * FROM schedules WHERE id = ?', [id]);
    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    await db.run(
      `UPDATE schedules 
       SET driver_id = ?, vehicle_id = ?, shift_type = ?, sequence = ?, 
           status = ?, is_substitute = ?, original_driver_id = ?
       WHERE id = ?`,
      [
        driver_id !== undefined ? driver_id : schedule.driver_id,
        vehicle_id !== undefined ? vehicle_id : schedule.vehicle_id,
        shift_type !== undefined ? shift_type : schedule.shift_type,
        sequence !== undefined ? sequence : schedule.sequence,
        status !== undefined ? status : schedule.status,
        is_substitute !== undefined ? is_substitute : schedule.is_substitute,
        original_driver_id !== undefined ? original_driver_id : schedule.original_driver_id,
        id
      ]
    );

    const updated = await db.get('SELECT * FROM schedules WHERE id = ?', [id]);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
