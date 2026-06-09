import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// GET: 모든 노선 목록 (차량 수 포함)
export async function GET() {
  try {
    const db = await getDB();

    const routes = await db.all(`
      SELECT r.*, 
        (SELECT COUNT(*) FROM route_vehicles rv WHERE rv.route_id = r.id AND rv.is_spare = 0) as vehicle_count,
        (SELECT COUNT(*) FROM route_vehicles rv WHERE rv.route_id = r.id AND rv.is_spare = 1) as spare_count
      FROM routes r 
      ORDER BY r.route_number ASC
    `);

    return NextResponse.json(routes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 새 노선 생성
export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = await request.json();
    const { route_number, route_name, route_group } = body;

    // 노선번호 필수 검증
    if (!route_number || !route_number.trim()) {
      return NextResponse.json(
        { error: '노선번호는 필수 항목입니다.' },
        { status: 400 }
      );
    }

    // 노선번호 중복 검증
    const existing = await db.get(
      'SELECT id FROM routes WHERE route_number = ?',
      [route_number.trim()]
    );
    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 노선번호입니다.' },
        { status: 409 }
      );
    }

    const result = await db.run(
      `INSERT INTO routes (route_number, route_name, route_group) VALUES (?, ?, ?)`,
      [route_number.trim(), route_name || null, route_group || 'city']
    );

    const newRoute = await db.get('SELECT * FROM routes WHERE id = ?', [result.lastID]);
    return NextResponse.json(newRoute, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
