import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = await request.json();
    const { vehicles, drivers, timetables, options } = body;

    // options default fallbacks
    const resetDrivers = !!options?.resetDrivers;
    const resetVehicles = !!options?.resetVehicles;
    const resetTimetables = !!options?.resetTimetables;

    await db.run('BEGIN TRANSACTION');

    try {
      // 1. Reset tables if selected
      if (resetDrivers) {
        await db.run('DELETE FROM leave_requests');
        await db.run('DELETE FROM fairness_log');
        await db.run('DELETE FROM driver_qualifications');
        await db.run('DELETE FROM schedules');
        await db.run('DELETE FROM drivers');
      }
      
      if (resetVehicles) {
        await db.run('DELETE FROM schedules');
        await db.run('DELETE FROM vehicles');
      }

      if (resetTimetables) {
        await db.run('DELETE FROM route_timetables');
      }

      // Helper to find or create bus type
      const getOrCreateBusType = async (typeName: string): Promise<number> => {
        const trimmed = typeName.trim();
        let type = await db.get('SELECT id FROM bus_types WHERE name = ?', [trimmed]);
        if (!type) {
          const result = await db.run('INSERT INTO bus_types (name, description) VALUES (?, ?)', [trimmed, `${trimmed} 버스`]);
          return result.lastID;
        }
        return type.id;
      };

      // 2. Insert Vehicles
      if (Array.isArray(vehicles)) {
        for (const v of vehicles) {
          if (!v.vehicle_number) continue;
          
          const busTypeId = v.bus_type ? await getOrCreateBusType(v.bus_type) : null;
          const status = v.status || 'active';

          // Insert or update
          const existing = await db.get('SELECT id FROM vehicles WHERE vehicle_number = ?', [v.vehicle_number]);
          if (existing) {
            await db.run(
              'UPDATE vehicles SET route = ?, bus_type_id = ?, status = ? WHERE id = ?',
              [v.route || null, busTypeId, status, existing.id]
            );
          } else {
            await db.run(
              'INSERT INTO vehicles (vehicle_number, route, bus_type_id, status) VALUES (?, ?, ?, ?)',
              [String(v.vehicle_number).trim(), v.route || null, busTypeId, status]
            );
          }
        }
      }

      // 3. Insert Drivers (Pass 1 - basic info)
      const driverNameToIdMap = new Map<string, number>();

      if (Array.isArray(drivers)) {
        let employeeIdCounter = 20001;
        
        for (const d of drivers) {
          if (!d.name) continue;

          // Generate employee ID if not present
          const employeeId = d.employee_id || `E${employeeIdCounter++}`;
          const phone = d.phone || `010-${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}`;
          
          let defaultPassword = '0000';
          const digits = phone.replace(/\D/g, '');
          if (digits.length >= 4) {
            defaultPassword = digits.slice(-4);
          }

          const driverType = d.driver_type === 'rotating' || d.driver_type === '예비' || d.driver_type === '순환' ? 'rotating' : 'fixed';
          const routeGroup = d.route === '1386번' || d.route === '1403번' || d.route === '3003번' || d.route === '3006번' ? 'express' : 'city';
          const careerLevel = routeGroup === 'express' ? 'senior' : (driverType === 'rotating' ? 'junior' : 'regular');

          const qualifiedRoutes = JSON.stringify([d.route || '']);

          const existing = await db.get('SELECT id FROM drivers WHERE name = ? AND primary_route = ? AND status = "active"', [d.name.trim(), d.route || '']);
          let driverId;

          if (existing) {
            await db.run(
              `UPDATE drivers 
               SET employee_id = ?, phone = ?, driver_type = ?, route_group = ?, career_level = ?, qualified_routes = ?
               WHERE id = ?`,
              [employeeId, phone, driverType, routeGroup, careerLevel, qualifiedRoutes, existing.id]
            );
            driverId = existing.id;
          } else {
            const result = await db.run(
              `INSERT INTO drivers (
                name, employee_id, phone, driver_type, route_group, primary_route, 
                career_level, qualified_routes, status, password
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
              [
                d.name.trim(),
                employeeId,
                phone,
                driverType,
                routeGroup,
                d.route || null,
                careerLevel,
                qualifiedRoutes,
                defaultPassword
              ]
            );
            driverId = result.lastID;
          }

          driverNameToIdMap.set(d.name.trim(), driverId);
        }

        // 4. Update Drivers (Pass 2 - vehicle and partner pairing)
        for (const d of drivers) {
          if (!d.name) continue;
          const driverId = driverNameToIdMap.get(d.name.trim());
          if (!driverId) continue;

          // Find vehicle ID if vehicle_number provided
          let vehicleId = null;
          if (d.vehicle_number) {
            const vehicle = await db.get('SELECT id FROM vehicles WHERE vehicle_number = ?', [String(d.vehicle_number).trim()]);
            if (vehicle) vehicleId = vehicle.id;
          }

          // Find partner ID if pair_driver_name provided
          let pairDriverId = null;
          if (d.pair_driver_name) {
            const partnerId = driverNameToIdMap.get(d.pair_driver_name.trim());
            if (partnerId) pairDriverId = partnerId;
          }

          // Update driver vehicle & partner
          await db.run(
            'UPDATE drivers SET vehicle_id = ?, pair_driver_id = ? WHERE id = ?',
            [vehicleId, pairDriverId, driverId]
          );

          // Save qualifications
          if (d.qualified_bus_types) {
            // Clear existing qualifications
            await db.run('DELETE FROM driver_qualifications WHERE driver_id = ?', [driverId]);

            // Parse qualifications: comma-separated list of types
            const types = String(d.qualified_bus_types).split(/[,/]/).map(s => s.trim()).filter(Boolean);
            for (const t of types) {
              const busTypeId = await getOrCreateBusType(t);
              await db.run(
                'INSERT OR IGNORE INTO driver_qualifications (driver_id, bus_type_id) VALUES (?, ?)',
                [driverId, busTypeId]
              );
            }
          } else {
            // Default to '일반' qualification if none specified
            const generalTypeId = await getOrCreateBusType('일반');
            await db.run(
              'INSERT OR IGNORE INTO driver_qualifications (driver_id, bus_type_id) VALUES (?, ?)',
              [driverId, generalTypeId]
            );
          }
        }
      }

      // 5. Insert Timetables
      if (Array.isArray(timetables)) {
        for (const t of timetables) {
          if (!t.route || !t.departure_time) continue;

          // Map Korean shift names to english db types
          let shiftType = 'morning';
          if (t.shift_type === '오후' || t.shift_type === 'afternoon') shiftType = 'afternoon';
          else if (t.shift_type === '3교대' || t.shift_type === 'triple') shiftType = 'triple';

          await db.run(
            'INSERT INTO route_timetables (route, shift_type, sequence, departure_time) VALUES (?, ?, ?, ?)',
            [t.route, shiftType, Number(t.sequence || 1), t.departure_time]
          );
        }
      }

      await db.run('COMMIT');
      return NextResponse.json({ message: 'Onboarding data uploaded and saved successfully' });
    } catch (e: any) {
      await db.run('ROLLBACK');
      throw e;
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
