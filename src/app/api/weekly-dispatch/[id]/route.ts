import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;

    const dispatch = await db.get(
      `SELECT * FROM weekly_dispatches WHERE id = ?`,
      [id]
    );

    if (!dispatch) {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 });
    }

    return NextResponse.json(dispatch);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;
    const body = await request.json();
    const { driver_name } = body;

    const dispatch = await db.get('SELECT * FROM weekly_dispatches WHERE id = ?', [id]);
    if (!dispatch) {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 });
    }

    await db.run(
      `UPDATE weekly_dispatches 
       SET driver_name = ?
       WHERE id = ?`,
      [
        driver_name !== undefined ? driver_name : dispatch.driver_name,
        id
      ]
    );

    const updated = await db.get('SELECT * FROM weekly_dispatches WHERE id = ?', [id]);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
