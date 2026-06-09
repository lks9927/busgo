import { describe, it, expect, beforeAll } from 'vitest';
import { GET, POST } from '../drivers/route';
import { GET as getDetail, PUT, DELETE } from '../drivers/[id]/route';
import { getDB } from '@/lib/db';
import { migrate } from '@/lib/migrate';
import { seed } from '@/lib/seed';

describe('Drivers API Integration Tests', () => {
  let testDriverId: number;
  const testEmployeeId = 'T99999';

  beforeAll(async () => {
    await migrate();
    await seed();
    
    // Find an active driver to use for GET/PUT/DELETE detail tests
    const db = await getDB();
    const driver = await db.get("SELECT id FROM drivers WHERE status = 'active' LIMIT 1");
    testDriverId = driver.id;
  });

  it('GET /api/drivers - should return array of drivers', async () => {
    const req = new Request('http://localhost/api/drivers');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('GET /api/drivers?route=138번 - should filter drivers by route', async () => {
    const req = new Request('http://localhost/api/drivers?route=138%EB%B2%88');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const d of data) {
      expect(d.primary_route).toBe('138번');
    }
  });

  it('GET /api/drivers?status=active - should filter drivers by status', async () => {
    const req = new Request('http://localhost/api/drivers?status=active');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const d of data) {
      expect(d.status).toBe('active');
    }
  });

  it('GET /api/drivers?type=fixed - should filter drivers by driver_type', async () => {
    const req = new Request('http://localhost/api/drivers?type=fixed');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    for (const d of data) {
      expect(d.driver_type).toBe('fixed');
    }
  });

  it('GET /api/drivers/[id] - should return driver details and fairness logs', async () => {
    const req = new Request(`http://localhost/api/drivers/${testDriverId}`);
    const res = await getDetail(req, { params: Promise.resolve({ id: String(testDriverId) }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(testDriverId);
    expect(data.fairnessLogs).toBeDefined();
    expect(Array.isArray(data.fairnessLogs)).toBe(true);
  });

  it('GET /api/drivers/999999 - should return 404 for non-existent driver', async () => {
    const req = new Request('http://localhost/api/drivers/999999');
    const res = await getDetail(req, { params: Promise.resolve({ id: '999999' }) });
    expect(res.status).toBe(404);
  });

  it('POST /api/drivers - should create a new driver', async () => {
    const body = {
      name: '테스트기사',
      employee_id: testEmployeeId,
      phone: '010-1234-5678',
      driver_type: 'fixed',
      route_group: 'city',
      primary_route: '138번',
      career_level: 'regular',
      qualified_routes: ['138번']
    };

    const req = new Request('http://localhost/api/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.name).toBe('테스트기사');
    expect(data.employee_id).toBe(testEmployeeId);
  });

  it('POST /api/drivers (duplicate employee_id) - should return 409', async () => {
    const body = {
      name: '중복기사',
      employee_id: testEmployeeId,
      primary_route: '72번'
    };

    const req = new Request('http://localhost/api/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('PUT /api/drivers/[id] - should update driver details', async () => {
    const body = {
      phone: '010-0000-0000',
      career_level: 'senior'
    };

    const req = new Request(`http://localhost/api/drivers/${testDriverId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const res = await PUT(req, { params: Promise.resolve({ id: String(testDriverId) }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.phone).toBe('010-0000-0000');
    expect(data.career_level).toBe('senior');
  });

  it('DELETE /api/drivers/[id] - should soft-delete driver status to retired', async () => {
    const req = new Request(`http://localhost/api/drivers/${testDriverId}`, {
      method: 'DELETE'
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: String(testDriverId) }) });
    expect(res.status).toBe(200);

    const db = await getDB();
    const driver = await db.get('SELECT status FROM drivers WHERE id = ?', [testDriverId]);
    expect(driver?.status).toBe('retired');
  });
});
