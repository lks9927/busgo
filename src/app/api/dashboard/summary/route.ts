import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    
    // 한국 시간 기준 오늘 날짜 문자열
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const date = searchParams.get('date') || todayStr;

    // 1. 총 운행 스케줄 수
    const totalRow = await db.get('SELECT COUNT(*) as count FROM schedules WHERE date = ?', [date]);
    const totalSchedules = totalRow?.count || 0;

    // 2. 대타 운행 수
    const subRow = await db.get('SELECT COUNT(*) as count FROM schedules WHERE date = ? AND is_substitute = 1', [date]);
    const substituteSchedules = subRow?.count || 0;

    // 3. 운행 중인 총 노선 수
    const routesRow = await db.get('SELECT COUNT(DISTINCT route) as count FROM schedules WHERE date = ?', [date]);
    const activeRoutes = routesRow?.count || 0;

    // 4. 스케줄 상세 목록
    const listQuery = `
      SELECT s.*, 
             d.name as driver_name, 
             v.vehicle_number, 
             od.name as original_driver_name
      FROM schedules s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN vehicles v ON s.vehicle_id = v.id
      LEFT JOIN drivers od ON s.original_driver_id = od.id
      WHERE s.date = ?
      ORDER BY s.route ASC, s.sequence ASC, s.shift_type DESC
    `;
    const schedulesList = await db.all(listQuery, [date]);

    return NextResponse.json({
      date,
      totalSchedules,
      substituteSchedules,
      activeRoutes,
      schedules: schedulesList
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
