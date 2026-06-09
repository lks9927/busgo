import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' }, { status: 400 });
    }

    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return NextResponse.json({ error: '기사 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (driver.password !== currentPassword) {
      return NextResponse.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    await db.run(
      `UPDATE drivers 
       SET password = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [newPassword, id]
    );

    return NextResponse.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
