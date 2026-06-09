import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

// GET: 단일 노선 상세 정보 + 배정된 차량 목록
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDB();
    const { id } = await params;

    // 노선 정보 조회
    const route = await db.get('SELECT * FROM routes WHERE id = ?', [id]);
    if (!route) {
      return NextResponse.json({ error: '노선을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 배정된 차량 목록 조회
    const vehicles = await db.all(
      `SELECT v.*, rv.is_spare, rv.rotation_order, bt.name as bus_type_name
       FROM route_vehicles rv
       JOIN vehicles v ON rv.vehicle_id = v.id
       LEFT JOIN bus_types bt ON v.bus_type_id = bt.id
       WHERE rv.route_id = ?
       ORDER BY rv.rotation_order ASC`,
      [id]
    );

    return NextResponse.json({ ...route, vehicles });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: 노선 정보 수정
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDB();
    const { id } = await params;
    const body = await request.json();
    const { route_number, route_name, route_group } = body;

    // 기존 노선 확인
    const route = await db.get('SELECT * FROM routes WHERE id = ?', [id]);
    if (!route) {
      return NextResponse.json({ error: '노선을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 노선번호 변경 시 중복 검증 (자기 자신 제외)
    if (route_number && route_number.trim() !== route.route_number) {
      const existing = await db.get(
        'SELECT id FROM routes WHERE route_number = ? AND id != ?',
        [route_number.trim(), id]
      );
      if (existing) {
        return NextResponse.json(
          { error: '이미 존재하는 노선번호입니다.' },
          { status: 409 }
        );
      }
    }

    await db.run(
      `UPDATE routes 
       SET route_number = ?, route_name = ?, route_group = ?
       WHERE id = ?`,
      [
        route_number !== undefined ? route_number.trim() : route.route_number,
        route_name !== undefined ? route_name : route.route_name,
        route_group !== undefined ? route_group : route.route_group,
        id
      ]
    );

    const updatedRoute = await db.get('SELECT * FROM routes WHERE id = ?', [id]);
    return NextResponse.json(updatedRoute);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: 노선 삭제 (관련 route_vehicles 매핑도 함께 삭제)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = await getDB();
    const { id } = await params;

    // 노선 존재 확인
    const route = await db.get('SELECT * FROM routes WHERE id = ?', [id]);
    if (!route) {
      return NextResponse.json({ error: '노선을 찾을 수 없습니다.' }, { status: 404 });
    }

    // route_vehicles 매핑 먼저 삭제
    await db.run('DELETE FROM route_vehicles WHERE route_id = ?', [id]);

    // 노선 삭제
    await db.run('DELETE FROM routes WHERE id = ?', [id]);

    return NextResponse.json({ message: '노선이 삭제되었습니다.', id: Number(id) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
