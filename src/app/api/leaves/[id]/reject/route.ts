import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;

    const leave = await db.get('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!leave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    if (leave.status !== 'pending') {
      return NextResponse.json({ error: 'Leave request is already processed' }, { status: 400 });
    }

    await db.run(
      `UPDATE leave_requests 
       SET status = 'rejected', reviewed_at = datetime('now'), reviewed_by = 'admin'
       WHERE id = ?`,
      [id]
    );

    const updated = await db.get('SELECT * FROM leave_requests WHERE id = ?', [id]);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
