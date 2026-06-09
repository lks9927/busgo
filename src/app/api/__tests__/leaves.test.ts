import { describe, it, expect, beforeAll } from 'vitest';
import { GET, POST } from '../leaves/route';
import { PUT as approveLeave } from '../leaves/[id]/approve/route';
import { PUT as rejectLeave } from '../leaves/[id]/reject/route';
import { getDB } from '@/lib/db';
import { migrate } from '@/lib/migrate';
import { seed } from '@/lib/seed';

describe('Leaves API Integration Tests', () => {
  let fixedDriverId: number;
  let rotatingDriverId: number;
  let pendingLeaveId: number;
  
  // Future dates (ensure they are not in the past relative to 2026-06-09)
  const leaveStartDate = '2026-07-01';
  const leaveEndDate = '2026-07-02';

  beforeAll(async () => {
    await migrate();
    await seed();

    const db = await getDB();
    
    // Find active fixed driver
    const fixed = await db.get("SELECT id FROM drivers WHERE driver_type = 'fixed' AND status = 'active' LIMIT 1");
    fixedDriverId = fixed.id;

    // Find active rotating driver (for substitute allocation)
    const rotating = await db.get(
      `SELECT id FROM drivers 
       WHERE driver_type = 'rotating' 
         AND status = 'active' 
         AND primary_route = '138번' 
       LIMIT 1`
    );
    rotatingDriverId = rotating.id;

    // Force rotating driver to be qualified for 138번
    await db.run(
      `UPDATE drivers 
       SET qualified_routes = ? 
       WHERE id = ?`,
      [JSON.stringify(['138번']), rotatingDriverId]
    );

    // Create a test vehicle
    const vehicle = await db.get("SELECT id FROM vehicles WHERE route = '138번' LIMIT 1");

    // Insert a test schedule for the fixed driver
    await db.run(
      `INSERT INTO schedules (date, route, vehicle_id, shift_type, driver_id, sequence, status)
       VALUES (?, '138번', ?, 'morning', ?, 1, 'planned')`,
      [leaveStartDate, vehicle.id, fixedDriverId]
    );
  });

  it('POST /api/leaves - should register leave request successfully', async () => {
    const body = {
      driver_id: fixedDriverId,
      request_type: 'annual',
      start_date: leaveStartDate,
      end_date: leaveEndDate,
      reason: '휴가신청'
    };

    const req = new Request('http://localhost/api/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.status).toBe('pending');
    pendingLeaveId = data.id;
  });

  it('POST /api/leaves (past date) - should return 400 error', async () => {
    const body = {
      driver_id: fixedDriverId,
      request_type: 'annual',
      start_date: '2025-01-01', // Past date
      end_date: '2025-01-02',
      reason: '과거휴가'
    };

    const req = new Request('http://localhost/api/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('POST /api/leaves (overlapping date) - should return 409 error', async () => {
    const body = {
      driver_id: fixedDriverId,
      request_type: 'annual',
      start_date: leaveStartDate,
      end_date: leaveEndDate,
      reason: '중복휴가'
    };

    const req = new Request('http://localhost/api/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('GET /api/leaves?status=pending - should return pending leave requests', async () => {
    const req = new Request('http://localhost/api/leaves?status=pending');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data.some((l: any) => l.id === pendingLeaveId)).toBe(true);
  });

  it('PUT /api/leaves/[id]/approve - should approve and allocate substitute driver', async () => {
    const req = new Request(`http://localhost/api/leaves/${pendingLeaveId}/approve`, {
      method: 'PUT'
    });

    const res = await approveLeave(req, { params: Promise.resolve({ id: String(pendingLeaveId) }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('approved');
    expect(data.reviewed_at).toBeDefined();

    // Verify that the schedule was updated with substitute
    const db = await getDB();
    const schedule = await db.get(
      `SELECT * FROM schedules 
       WHERE original_driver_id = ? 
         AND date = ?`,
      [fixedDriverId, leaveStartDate]
    );

    expect(schedule).toBeDefined();
    expect(schedule?.is_substitute).toBe(1);
    expect(schedule?.driver_id).not.toBe(fixedDriverId);
    expect(schedule?.driver_id).not.toBeNull();
    const assignedDriver = await db.get('SELECT driver_type FROM drivers WHERE id = ?', [schedule?.driver_id]);
    expect(assignedDriver?.driver_type).toBe('rotating');
  });

  it('PUT /api/leaves/[id]/approve (already processed) - should return 400 error', async () => {
    const req = new Request(`http://localhost/api/leaves/${pendingLeaveId}/approve`, {
      method: 'PUT'
    });

    const res = await approveLeave(req, { params: Promise.resolve({ id: String(pendingLeaveId) }) });
    expect(res.status).toBe(400);
  });

  it('PUT /api/leaves/[id]/reject - should reject pending leave requests', async () => {
    // Create another pending leave request
    const db = await getDB();
    const result = await db.run(
      `INSERT INTO leave_requests (driver_id, request_type, start_date, end_date, status)
       VALUES (?, 'annual', '2026-08-01', '2026-08-02', 'pending')`,
      [fixedDriverId]
    );
    const newLeaveId = result.lastID;

    const req = new Request(`http://localhost/api/leaves/${newLeaveId}/reject`, {
      method: 'PUT'
    });

    const res = await rejectLeave(req, { params: Promise.resolve({ id: String(newLeaveId) }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('rejected');
  });
});
