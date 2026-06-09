import { describe, it, expect, beforeAll } from 'vitest';
import { getDB } from '../db';
import { migrate } from '../migrate';
import { seed } from '../seed';
import { generateDispatch } from '../generate';
import { validateSchedules } from '../integrity';

describe('Data Integrity and Safety Checks Tests', () => {
  beforeAll(async () => {
    await migrate();
    await seed();
    // fresh generated schedules
    const db = await getDB();
    await generateDispatch(db, '138번', 2025, 3);
  });

  it('should validate that clean generated schedules contain 0 errors', async () => {
    const db = await getDB();
    const errors = await validateSchedules(db, '2025-03-01', '2025-03-31');
    expect(errors.length).toBe(0);
  });

  it('should detect duplicate vehicle shift assignments', async () => {
    const db = await getDB();
    
    // Query valid IDs
    const vehicle = await db.get("SELECT id FROM vehicles WHERE route = '138번' LIMIT 1");
    const d1 = await db.get("SELECT id FROM drivers WHERE status = 'active' AND primary_route = '138번' LIMIT 1");
    const d2 = await db.get("SELECT id FROM drivers WHERE id != ? AND status = 'active' AND primary_route = '138번' LIMIT 1", [d1.id]);

    expect(vehicle).toBeDefined();
    expect(d1).toBeDefined();
    expect(d2).toBeDefined();

    // Insert duplicate shift schedules
    await db.run(
      `INSERT INTO schedules (date, route, vehicle_id, shift_type, driver_id, sequence, status)
       VALUES ('2025-03-15', '138번', ?, 'morning', ?, 1, 'planned')`,
      [vehicle.id, d1.id]
    );
    await db.run(
      `INSERT INTO schedules (date, route, vehicle_id, shift_type, driver_id, sequence, status)
       VALUES ('2025-03-15', '138번', ?, 'morning', ?, 2, 'planned')`,
      [vehicle.id, d2.id]
    );

    const errors = await validateSchedules(db, '2025-03-15', '2025-03-15');
    expect(errors.some(e => e.type === 'DUPLICATE_VEHICLE_SHIFT')).toBe(true);

    // Clean up
    await db.run("DELETE FROM schedules WHERE date = '2025-03-15' AND vehicle_id = ? AND shift_type = 'morning'", [vehicle.id]);
  });

  it('should detect duplicate driver work day assignments', async () => {
    const db = await getDB();
    
    // Query valid IDs
    const v1 = await db.get("SELECT id FROM vehicles WHERE route = '138번' LIMIT 1");
    const v2 = await db.get("SELECT id FROM vehicles WHERE id != ? AND route = '138번' LIMIT 1", [v1.id]);
    const driver = await db.get("SELECT id FROM drivers WHERE status = 'active' AND primary_route = '138번' LIMIT 1");

    expect(v1).toBeDefined();
    expect(v2).toBeDefined();
    expect(driver).toBeDefined();

    // Assign driver to two vehicles on the same day
    await db.run(
      `INSERT INTO schedules (date, route, vehicle_id, shift_type, driver_id, sequence, status)
       VALUES ('2025-03-16', '138번', ?, 'morning', ?, 1, 'planned')`,
      [v1.id, driver.id]
    );
    await db.run(
      `INSERT INTO schedules (date, route, vehicle_id, shift_type, driver_id, sequence, status)
       VALUES ('2025-03-16', '138번', ?, 'afternoon', ?, 2, 'planned')`,
      [v2.id, driver.id]
    );

    const errors = await validateSchedules(db, '2025-03-16', '2025-03-16');
    expect(errors.some(e => e.type === 'DUPLICATE_DRIVER_WORK')).toBe(true);

    // Clean up
    await db.run("DELETE FROM schedules WHERE date = '2025-03-16' AND driver_id = ?", [driver.id]);
  });

  it('should detect leave request violations', async () => {
    const db = await getDB();

    const driver = await db.get("SELECT id FROM drivers WHERE status = 'active' AND primary_route = '138번' LIMIT 1");
    const vehicle = await db.get("SELECT id FROM vehicles WHERE route = '138번' LIMIT 1");

    expect(driver).toBeDefined();
    expect(vehicle).toBeDefined();

    // 1. Submit and approve a leave for driver
    await db.run(
      `INSERT INTO leave_requests (driver_id, request_type, start_date, end_date, status)
       VALUES (?, 'annual', '2025-03-20', '2025-03-20', 'approved')`,
      [driver.id]
    );

    // 2. Assign driver to a schedule on their leave day
    await db.run(
      `INSERT INTO schedules (date, route, vehicle_id, shift_type, driver_id, sequence, status)
       VALUES ('2025-03-20', '138번', ?, 'morning', ?, 1, 'planned')`,
      [vehicle.id, driver.id]
    );

    const errors = await validateSchedules(db, '2025-03-20', '2025-03-20');
    expect(errors.some(e => e.type === 'LEAVE_VIOLATION')).toBe(true);

    // Clean up
    await db.run("DELETE FROM schedules WHERE date = '2025-03-20' AND driver_id = ?", [driver.id]);
    await db.run("DELETE FROM leave_requests WHERE driver_id = ? AND start_date = '2025-03-20'", [driver.id]);
  });

  it('should detect retired driver assignments', async () => {
    const db = await getDB();

    const driver = await db.get("SELECT id FROM drivers WHERE status = 'active' AND primary_route = '138번' LIMIT 1");
    const vehicle = await db.get("SELECT id FROM vehicles WHERE route = '138번' LIMIT 1");

    expect(driver).toBeDefined();
    expect(vehicle).toBeDefined();

    // 1. Set driver status to retired
    await db.run("UPDATE drivers SET status = 'retired' WHERE id = ?", [driver.id]);

    // 2. Assign retired driver to a schedule
    await db.run(
      `INSERT INTO schedules (date, route, vehicle_id, shift_type, driver_id, sequence, status)
       VALUES ('2025-03-22', '138번', ?, 'morning', ?, 1, 'planned')`,
      [vehicle.id, driver.id]
    );

    const errors = await validateSchedules(db, '2025-03-22', '2025-03-22');
    expect(errors.some(e => e.type === 'RETIRED_DRIVER_VIOLATION')).toBe(true);

    // Clean up
    await db.run("DELETE FROM schedules WHERE date = '2025-03-22' AND driver_id = ?", [driver.id]);
    await db.run("UPDATE drivers SET status = 'active' WHERE id = ?", [driver.id]);
  });

  it('should detect maintenance vehicle assignments', async () => {
    const db = await getDB();

    const driver = await db.get("SELECT id FROM drivers WHERE status = 'active' AND primary_route = '138번' LIMIT 1");
    const vehicle = await db.get("SELECT id FROM vehicles WHERE route = '138번' LIMIT 1");

    expect(driver).toBeDefined();
    expect(vehicle).toBeDefined();

    // 1. Set vehicle status to maintenance
    await db.run("UPDATE vehicles SET status = 'maintenance' WHERE id = ?", [vehicle.id]);

    // 2. Assign maintenance vehicle to a schedule
    await db.run(
      `INSERT INTO schedules (date, route, vehicle_id, shift_type, driver_id, sequence, status)
       VALUES ('2025-03-25', '138번', ?, 'morning', ?, 1, 'planned')`,
      [vehicle.id, driver.id]
    );

    const errors = await validateSchedules(db, '2025-03-25', '2025-03-25');
    expect(errors.some(e => e.type === 'MAINTENANCE_VEHICLE_VIOLATION')).toBe(true);

    // Clean up
    await db.run("DELETE FROM schedules WHERE date = '2025-03-25' AND vehicle_id = ?", [vehicle.id]);
    await db.run("UPDATE vehicles SET status = 'active' WHERE id = ?", [vehicle.id]);
  });
});
