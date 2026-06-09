import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const db = await getDB();
        const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const driverId = searchParams.get('driver_id');

    let query = `
      SELECT l.*, d.name as driver_name, d.primary_route as driver_route
      FROM leave_requests l
      JOIN drivers d ON l.driver_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += ' AND l.status = ?';
      params.push(status);
    }
    if (driverId) {
      query += ' AND l.driver_id = ?';
      params.push(Number(driverId));
    }

    query += ' ORDER BY l.requested_at DESC';

    const leaves = await db.all(query, params);
    return NextResponse.json(leaves);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = await request.json();
    const { driver_id, request_type, start_date, end_date, reason } = body;

    if (!driver_id || !start_date || !end_date) {
      return NextResponse.json({ error: 'driver_id, start_date, end_date are required' }, { status: 400 });
    }

    // 1. 과거 날짜 검증
    // 한국 시간 기준 오늘 날짜 문자열 ('YYYY-MM-DD')
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().substring(0, 10);
    if (start_date < todayStr) {
      return NextResponse.json({ error: 'Start date cannot be in the past' }, { status: 400 });
    }

    // 2. 이미 신청한 날짜 중복 검증
    const overlap = await db.get(
      `SELECT id FROM leave_requests 
       WHERE driver_id = ? 
         AND status != 'rejected'
         AND NOT (end_date < ? OR start_date > ?)`,
      [driver_id, start_date, end_date]
    );

    if (overlap) {
      return NextResponse.json({ error: 'Leave request overlaps with an existing request' }, { status: 409 });
    }

    const result = await db.run(
      `INSERT INTO leave_requests (driver_id, request_type, start_date, end_date, reason, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [driver_id, request_type || 'annual', start_date, end_date, reason || null]
    );

    const newRequest = await db.get('SELECT * FROM leave_requests WHERE id = ?', [result.lastID]);
    return NextResponse.json(newRequest, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
