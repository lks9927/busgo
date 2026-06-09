import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { findSubstituteDriver } from '@/lib/fairness';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;

    await db.run('BEGIN TRANSACTION');

    try {
      const leave = await db.get('SELECT * FROM leave_requests WHERE id = ?', [id]);
      if (!leave) {
        await db.run('ROLLBACK');
        return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
      }

      if (leave.status !== 'pending') {
        await db.run('ROLLBACK');
        return NextResponse.json({ error: 'Leave request is already processed' }, { status: 400 });
      }

      // 1. 승인 상태로 업데이트
      await db.run(
        `UPDATE leave_requests 
         SET status = 'approved', reviewed_at = datetime('now'), reviewed_by = 'admin'
         WHERE id = ?`,
        [id]
      );

      // 2. 해당 날짜 범위에 배정된 기존 스케줄 찾기
      const schedules = await db.all(
        `SELECT * FROM schedules 
         WHERE driver_id = ? 
           AND date BETWEEN ? AND ?`,
        [leave.driver_id, leave.start_date, leave.end_date]
      );

      // 3. 각 스케줄에 대해 대타 지정
      for (const s of schedules) {
        const sub = await findSubstituteDriver(db, s.route, s.date);
        
        await db.run(
          `UPDATE schedules 
           SET is_substitute = 1, original_driver_id = ?, driver_id = ?
           WHERE id = ?`,
          [s.driver_id, sub ? sub.id : null, s.id]
        );
      }

      await db.run('COMMIT');

      const updated = await db.get('SELECT * FROM leave_requests WHERE id = ?', [id]);
      return NextResponse.json(updated);
    } catch (e) {
      await db.run('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
