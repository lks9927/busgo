import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;

    const vehicle = await db.get(
      `SELECT v.*, bt.name as bus_type_name 
       FROM vehicles v 
       LEFT JOIN bus_types bt ON v.bus_type_id = bt.id 
       WHERE v.id = ?`,
      [id]
    );
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    return NextResponse.json(vehicle);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;
    const body = await request.json();
    const { vehicle_number, route, rotation_order, bus_type_id, status } = body;

    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    if (vehicle_number && vehicle_number !== vehicle.vehicle_number) {
      const existing = await db.get('SELECT id FROM vehicles WHERE vehicle_number = ?', [vehicle_number]);
      if (existing) {
        return NextResponse.json({ error: 'Vehicle number already exists' }, { status: 409 });
      }
    }

    await db.run(
      `UPDATE vehicles 
       SET vehicle_number = ?, route = ?, rotation_order = ?, bus_type_id = ?, status = ?
       WHERE id = ?`,
      [
        vehicle_number !== undefined ? vehicle_number.trim() : vehicle.vehicle_number,
        route !== undefined ? route : vehicle.route,
        rotation_order !== undefined ? rotation_order : vehicle.rotation_order,
        bus_type_id !== undefined ? bus_type_id : vehicle.bus_type_id,
        status !== undefined ? status : vehicle.status,
        id
      ]
    );

    const updatedVehicle = await db.get(
      `SELECT v.*, bt.name as bus_type_name 
       FROM vehicles v 
       LEFT JOIN bus_types bt ON v.bus_type_id = bt.id 
       WHERE v.id = ?`,
      [id]
    );
    return NextResponse.json(updatedVehicle);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
