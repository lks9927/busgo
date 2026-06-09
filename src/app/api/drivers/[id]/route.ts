import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;

    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const qualifications = await db.all('SELECT bus_type_id FROM driver_qualifications WHERE driver_id = ?', [id]);
    const qualified_bus_types = qualifications.map((q: any) => q.bus_type_id);

    const fairnessLogs = await db.all('SELECT * FROM fairness_log WHERE driver_id = ?', [id]);
    return NextResponse.json({ ...driver, qualified_bus_types, fairnessLogs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      employee_id,
      phone,
      driver_type,
      route_group,
      primary_route,
      career_level,
      qualified_routes,
      pair_driver_id,
      vehicle_id,
      qualified_bus_types,
      status
    } = body;

    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    if (employee_id && employee_id !== driver.employee_id) {
      const existing = await db.get('SELECT id FROM drivers WHERE employee_id = ?', [employee_id]);
      if (existing) {
        return NextResponse.json({ error: 'Employee ID already exists' }, { status: 409 });
      }
    }

    const qualified = qualified_routes ? JSON.stringify(qualified_routes) : driver.qualified_routes;

    await db.run(
      `UPDATE drivers 
       SET name = ?, employee_id = ?, phone = ?, driver_type = ?, route_group = ?, 
           primary_route = ?, career_level = ?, qualified_routes = ?, pair_driver_id = ?, 
           vehicle_id = ?, status = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        name !== undefined ? name : driver.name,
        employee_id !== undefined ? employee_id : driver.employee_id,
        phone !== undefined ? phone : driver.phone,
        driver_type !== undefined ? driver_type : driver.driver_type,
        route_group !== undefined ? route_group : driver.route_group,
        primary_route !== undefined ? primary_route : driver.primary_route,
        career_level !== undefined ? career_level : driver.career_level,
        qualified,
        pair_driver_id !== undefined ? pair_driver_id : driver.pair_driver_id,
        vehicle_id !== undefined ? vehicle_id : driver.vehicle_id,
        status !== undefined ? status : driver.status,
        id
      ]
    );

    // Sync qualifications if provided
    if (Array.isArray(qualified_bus_types)) {
      await db.run('DELETE FROM driver_qualifications WHERE driver_id = ?', [id]);
      for (const typeId of qualified_bus_types) {
        await db.run(
          'INSERT INTO driver_qualifications (driver_id, bus_type_id) VALUES (?, ?)',
          [id, typeId]
        );
      }
    }

    const updatedDriver = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    const quals = await db.all('SELECT bus_type_id FROM driver_qualifications WHERE driver_id = ?', [id]);
    return NextResponse.json({
      ...updatedDriver,
      qualified_bus_types: quals.map((q: any) => q.bus_type_id)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDB();
    const { id } = await params;

    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    await db.run("UPDATE drivers SET status = 'retired', updated_at = datetime('now') WHERE id = ?", [id]);
    return NextResponse.json({ message: 'Driver soft-deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
