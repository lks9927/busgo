import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const db = await getDB();
    const { searchParams } = new URL(request.url);
    const route = searchParams.get('route');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    let query = 'SELECT * FROM drivers WHERE 1=1';
    const params: any[] = [];

    if (route) {
      query += ' AND primary_route = ?';
      params.push(route);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (type) {
      query += ' AND driver_type = ?';
      params.push(type);
    }

    const drivers = await db.all(query, params);
    const quals = await db.all('SELECT * FROM driver_qualifications');
    const qualsMap = quals.reduce((acc: any, item: any) => {
      if (!acc[item.driver_id]) acc[item.driver_id] = [];
      acc[item.driver_id].push(item.bus_type_id);
      return acc;
    }, {});

    const driversWithQuals = drivers.map((d: any) => ({
      ...d,
      qualified_bus_types: qualsMap[d.id] || []
    }));

    return NextResponse.json(driversWithQuals);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
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
      vehicle_id,
      pair_driver_id,
      qualified_bus_types
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (employee_id) {
      const existing = await db.get('SELECT id FROM drivers WHERE employee_id = ?', [employee_id]);
      if (existing) {
        return NextResponse.json({ error: 'Employee ID already exists' }, { status: 409 });
      }
    }

    const qualified = qualified_routes ? JSON.stringify(qualified_routes) : JSON.stringify([primary_route || '']);

    let defaultPassword = '0000';
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length >= 4) {
        defaultPassword = digits.slice(-4);
      } else if (phone.length >= 4) {
        defaultPassword = phone.slice(-4);
      }
    }

    const result = await db.run(
      `INSERT INTO drivers (
        name, employee_id, phone, driver_type, route_group, primary_route, 
        career_level, qualified_routes, status, password, vehicle_id, pair_driver_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [
        name,
        employee_id || null,
        phone || null,
        driver_type || 'fixed',
        route_group || 'city',
        primary_route || null,
        career_level || 'junior',
        qualified,
        defaultPassword,
        vehicle_id !== undefined ? vehicle_id : null,
        pair_driver_id !== undefined ? pair_driver_id : null
      ]
    );

    // Save qualifications
    if (Array.isArray(qualified_bus_types)) {
      for (const typeId of qualified_bus_types) {
        await db.run(
          'INSERT INTO driver_qualifications (driver_id, bus_type_id) VALUES (?, ?)',
          [result.lastID, typeId]
        );
      }
    }

    const newDriver = await db.get('SELECT * FROM drivers WHERE id = ?', [result.lastID]);
    return NextResponse.json({
      ...newDriver,
      qualified_bus_types: qualified_bus_types || []
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
