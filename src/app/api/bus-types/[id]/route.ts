import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;

    // Check if any vehicle is using this bus type
    const vehicleUsing = await db.get('SELECT id FROM vehicles WHERE bus_type_id = ?', [id]);
    if (vehicleUsing) {
      return NextResponse.json(
        { error: '이 차종이 지정된 차량이 존재하여 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    await db.run('DELETE FROM bus_types WHERE id = ?', [id]);
    return NextResponse.json({ message: 'Bus type deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check duplicate name excluding current record
    const dup = await db.get('SELECT id FROM bus_types WHERE name = ? AND id != ?', [name.trim(), id]);
    if (dup) {
      return NextResponse.json({ error: '이미 존재하는 차종 이름입니다.' }, { status: 409 });
    }

    // Protect system default bus types (ID <= 5) from name modification
    const numericId = parseInt(id, 10);
    if (numericId <= 5) {
      const existing = await db.get('SELECT name FROM bus_types WHERE id = ?', [id]);
      if (existing && existing.name !== name.trim()) {
        return NextResponse.json(
          { error: '시스템 기본 차종의 이름은 수정할 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    await db.run(
      'UPDATE bus_types SET name = ?, description = ? WHERE id = ?',
      [name.trim(), description || null, id]
    );

    const updated = await db.get('SELECT * FROM bus_types WHERE id = ?', [id]);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
