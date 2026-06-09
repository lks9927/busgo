import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// GET: 미배정 차량 목록 조회
export async function GET(request: Request) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const unassigned = searchParams.get('unassigned');

    if (unassigned === 'true') {
      // 어떤 노선에도 배정되지 않은 활성 차량 조회
      const vehicles = await db.all(`
        SELECT v.*, bt.name as bus_type_name FROM vehicles v
        LEFT JOIN bus_types bt ON v.bus_type_id = bt.id
        WHERE v.id NOT IN (SELECT vehicle_id FROM route_vehicles)
        AND v.status = 'active'
        ORDER BY v.vehicle_number ASC
      `);

      return NextResponse.json(vehicles);
    }

    // 기본: 전체 route_vehicles 매핑 조회
    const mappings = await db.all(`
      SELECT rv.*, r.route_number, v.vehicle_number, bt.name as bus_type_name
      FROM route_vehicles rv
      JOIN routes r ON rv.route_id = r.id
      JOIN vehicles v ON rv.vehicle_id = v.id
      LEFT JOIN bus_types bt ON v.bus_type_id = bt.id
      ORDER BY r.route_number ASC, rv.rotation_order ASC
    `);

    return NextResponse.json(mappings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: 노선에 차량 일괄 배정
export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = await request.json();
    const { route_id, vehicles } = body;

    // 필수 파라미터 검증
    if (!route_id) {
      return NextResponse.json(
        { error: 'route_id는 필수 항목입니다.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(vehicles)) {
      return NextResponse.json(
        { error: 'vehicles는 배열이어야 합니다.' },
        { status: 400 }
      );
    }

    // 노선 존재 확인
    const route = await db.get('SELECT * FROM routes WHERE id = ?', [route_id]);
    if (!route) {
      return NextResponse.json(
        { error: '노선을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 기존 매핑 전체 삭제
    await db.run('DELETE FROM route_vehicles WHERE route_id = ?', [route_id]);

    // 새 매핑 일괄 삽입 및 vehicles.route 동기화
    for (const v of vehicles) {
      const { vehicle_id, is_spare, rotation_order } = v;

      if (!vehicle_id) continue;

      await db.run(
        `INSERT INTO route_vehicles (route_id, vehicle_id, is_spare, rotation_order) 
         VALUES (?, ?, ?, ?)`,
        [route_id, vehicle_id, is_spare ? 1 : 0, rotation_order || null]
      );

      // vehicles 테이블의 route 컬럼도 동기화
      await db.run(
        'UPDATE vehicles SET route = ?, rotation_order = ? WHERE id = ?',
        [route.route_number, rotation_order || null, vehicle_id]
      );
    }

    // 업데이트된 매핑 목록 반환
    const updatedMappings = await db.all(
      `SELECT v.*, rv.is_spare, rv.rotation_order, bt.name as bus_type_name
       FROM route_vehicles rv
       JOIN vehicles v ON rv.vehicle_id = v.id
       LEFT JOIN bus_types bt ON v.bus_type_id = bt.id
       WHERE rv.route_id = ?
       ORDER BY rv.rotation_order ASC`,
      [route_id]
    );

    return NextResponse.json({
      message: `${updatedMappings.length}대의 차량이 배정되었습니다.`,
      route_id,
      vehicles: updatedMappings
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
