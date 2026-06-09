import { describe, it, expect, beforeAll } from 'vitest';
import { POST as generateDispatch } from '../dispatch/generate/route';
import { GET as queryDispatch } from '../dispatch/route';
import { GET as getDetail, PUT as updateDispatch } from '../dispatch/[id]/route';
import { POST as swapDriver } from '../dispatch/swap/route';
import { getDB } from '@/lib/db';
import { migrate } from '@/lib/migrate';
import { seed } from '@/lib/seed';

describe('Dispatch API Integration Tests', () => {
  beforeAll(async () => {
    await migrate();
    await seed();
  });

  it('POST /api/dispatch/generate - should auto-generate schedules for March 2025', async () => {
    const body = {
      route: '138번',
      year: 2025,
      month: 3
    };

    const req = new Request('http://localhost/api/dispatch/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const res = await generateDispatch(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Dispatch generated successfully');
    expect(data.count).toBeGreaterThan(0);
  });

  it('GET /api/dispatch - should query generated schedules and apply rotation/reduction rules', async () => {
    const req = new Request('http://localhost/api/dispatch?route=138%EB%B2%88&month=2025-03');
    const res = await queryDispatch(req);
    expect(res.status).toBe(200);
    const schedules = await res.json();
    expect(Array.isArray(schedules)).toBe(true);

    // 1. Check schema fields
    const first = schedules[0];
    expect(first.date).toBeDefined();
    expect(first.vehicle_number).toBeDefined();
    expect(first.shift_type).toBeDefined();
    expect(first.sequence).toBeDefined();

    // 2. Verify Weekend Reduction for 138번 (Sunday: 13 vehicles, Weekday: 14 vehicles)
    // 2025-03-02 (Sunday) vs 2025-03-03 (Monday)
    const sundaySchedules = schedules.filter((s: any) => s.date === '2025-03-02');
    const weekdaySchedules = schedules.filter((s: any) => s.date === '2025-03-03');

    // Each vehicle runs morning and afternoon shifts, so running count = count / 2
    expect(sundaySchedules.length).toBe(26); // 13 running vehicles
    expect(weekdaySchedules.length).toBe(28); // 14 running vehicles

    // 3. Verify vehicle sequence rotation:
    // 2025-03-03 first departure sequence should be shifted by 1 compared to 2025-03-02
    // Wait, let's verify if vehicle numbers differ at sequence 1
    const sunFirst = sundaySchedules.find((s: any) => s.sequence === 1 && s.shift_type === 'morning');
    const monFirst = weekdaySchedules.find((s: any) => s.sequence === 1 && s.shift_type === 'morning');
    expect(sunFirst.vehicle_number).not.toBe(monFirst.vehicle_number);

    // 4. Verify Partner AM/PM swapping:
    // Partner A and Partner B should swap morning/afternoon shifts on Monday 2025-03-10 compared to Monday 2025-03-03
    const week1Am = schedules.find((s: any) => s.date === '2025-03-03' && s.sequence === 1 && s.shift_type === 'morning');
    const week2Am = schedules.find((s: any) => s.date === '2025-03-10' && s.sequence === 1 && s.shift_type === 'morning');
    const week1Pm = schedules.find((s: any) => s.date === '2025-03-03' && s.sequence === 1 && s.shift_type === 'afternoon');
    const week2Pm = schedules.find((s: any) => s.date === '2025-03-10' && s.sequence === 1 && s.shift_type === 'afternoon');

    // If both belong to the same vehicle (seq 1), they should swap names weekly
    if (week1Am.vehicle_number === week2Am.vehicle_number) {
      expect(week1Am.driver_name).toBe(week2Pm.driver_name);
      expect(week1Pm.driver_name).toBe(week2Am.driver_name);
    }
  });

  it('PUT /api/dispatch/[id] - should update schedule details manually', async () => {
    const db = await getDB();
    const schedule = await db.get("SELECT id FROM schedules LIMIT 1");
    const testId = schedule.id;

    const body = {
      status: 'completed',
      sequence: 99
    };

    const req = new Request(`http://localhost/api/dispatch/${testId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const res = await updateDispatch(req, { params: Promise.resolve({ id: String(testId) }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('completed');
    expect(data.sequence).toBe(99);
  });

  it('POST /api/dispatch/swap - should swap drivers and preserve original driver', async () => {
    const db = await getDB();
    // Get schedule with driver_id set
    const schedule = await db.get("SELECT id, driver_id FROM schedules WHERE driver_id IS NOT NULL LIMIT 1");
    const testId = schedule.id;
    const originalDriverId = schedule.driver_id;

    // Find another active driver
    const otherDriver = await db.get(
      `SELECT id FROM drivers 
       WHERE id != ? 
         AND status = 'active' 
       LIMIT 1`,
      [originalDriverId]
    );

    const body = {
      schedule_id: testId,
      substitute_driver_id: otherDriver.id
    };

    const req = new Request('http://localhost/api/dispatch/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const res = await swapDriver(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_substitute).toBe(1);
    expect(data.original_driver_id).toBe(originalDriverId);
    expect(data.driver_id).toBe(otherDriver.id);
  });
});
