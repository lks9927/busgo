import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const route = searchParams.get('route');
    const status = searchParams.get('status');

    let query = `
      SELECT v.*, bt.name as bus_type_name 
      FROM vehicles v 
      LEFT JOIN bus_types bt ON v.bus_type_id = bt.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (route) {
      query += ' AND v.route = ?';
      params.push(route);
    }
    if (status) {
      query += ' AND v.status = ?';
      params.push(status);
    }

    const vehicles = await db.all(query, params);
    return NextResponse.json(vehicles);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = await request.json();
    const { vehicle_number, route, rotation_order, bus_type_id } = body;

    if (!vehicle_number) {
      return NextResponse.json({ error: 'Vehicle number is required' }, { status: 400 });
    }

    // Check if vehicle_number already exists
    const existing = await db.get('SELECT id FROM vehicles WHERE vehicle_number = ?', [vehicle_number]);
    if (existing) {
      return NextResponse.json({ error: 'Vehicle number already exists' }, { status: 409 });
    }

    const result = await db.run(
      `INSERT INTO vehicles (vehicle_number, route, rotation_order, bus_type_id, status) VALUES (?, ?, ?, ?, 'active')`,
      [vehicle_number.trim(), route || null, rotation_order || null, bus_type_id || null]
    );

    const newVehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [result.lastID]);
    return NextResponse.json(newVehicle, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
