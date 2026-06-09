import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = await request.json();
    const { schedule_id, substitute_driver_id } = body;

    if (!schedule_id) {
      return NextResponse.json({ error: 'schedule_id is required' }, { status: 400 });
    }

    const schedule = await db.get('SELECT * FROM schedules WHERE id = ?', [schedule_id]);
    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // 대타 기사 ID 검증 (존재하고 active한지)
    let subDriverId = substitute_driver_id;
    if (subDriverId) {
      const driver = await db.get("SELECT id FROM drivers WHERE id = ? AND status = 'active'", [subDriverId]);
      if (!driver) {
        return NextResponse.json({ error: 'Active substitute driver not found' }, { status: 404 });
      }
    }

    // 원래 기사 보존 및 교체
    // 이미 대타 스케줄이면 original_driver_id를 기존 값으로 유지하고, 아니면 현재 driver_id를 보존
    const originalDriverId = schedule.is_substitute ? schedule.original_driver_id : schedule.driver_id;

    await db.run(
      `UPDATE schedules 
       SET is_substitute = 1, original_driver_id = ?, driver_id = ?
       WHERE id = ?`,
      [originalDriverId, subDriverId || null, schedule_id]
    );

    const updated = await db.get('SELECT * FROM schedules WHERE id = ?', [schedule_id]);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
