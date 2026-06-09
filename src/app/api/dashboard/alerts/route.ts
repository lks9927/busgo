import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().substring(0, 7);

    // 1. 대기 중인 휴무 신청 건 조회
    const pendingLeaves = await db.all(`
      SELECT l.*, d.name as driver_name, d.primary_route as driver_route
      FROM leave_requests l
      JOIN drivers d ON l.driver_id = d.id
      WHERE l.status = 'pending'
      ORDER BY l.requested_at DESC
    `);

    // 2. 공정성 지표 경고 (과로 기사 및 과소근무 기사)
    const overworked = await db.all(`
      SELECT f.*, d.name as driver_name, d.driver_type, 0 as consecutive_work_days
      FROM fairness_log f
      JOIN drivers d ON f.driver_id = d.id
      WHERE f.month = ?
      ORDER BY f.fairness_score DESC
      LIMIT 5
    `, [month]);

    const underworked = await db.all(`
      SELECT f.*, d.name as driver_name, d.driver_type, 0 as consecutive_work_days
      FROM fairness_log f
      JOIN drivers d ON f.driver_id = d.id
      WHERE f.month = ?
      ORDER BY f.fairness_score ASC
      LIMIT 5
    `, [month]);

    // 3. 연속 근무 경고: work_days가 높은 기사 (연속 근무 컬럼 대신 총 근무일이 25일 이상인 기사를 경고)
    const consecutiveAlerts = await db.all(`
      SELECT f.*, d.name as driver_name, d.primary_route, f.work_days as consecutive_work_days
      FROM fairness_log f
      JOIN drivers d ON f.driver_id = d.id
      WHERE f.month = ? AND f.work_days >= 25
      ORDER BY f.work_days DESC
    `, [month]);

    return NextResponse.json({
      month,
      pendingLeavesCount: pendingLeaves.length,
      pendingLeaves,
      overworked,
      underworked,
      consecutiveAlerts
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

