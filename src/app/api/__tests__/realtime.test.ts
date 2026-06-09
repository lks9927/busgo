import { describe, it, expect, beforeAll } from 'vitest';
import { GET as getConfig, POST as postConfig } from '../realtime/config/route';
import { GET as searchRoutes } from '../realtime/search-routes/route';
import { GET as getRouteStations } from '../realtime/route-stations/route';
import { GET as getBusLocations } from '../realtime/bus-locations/route';
import { getDB } from '@/lib/db';
import { FALLBACK_ROUTE_IDS } from '@/lib/realtime';

describe('Realtime Bus API Tests', () => {
  beforeAll(async () => {
    // Clear out settings table entries for realtime to make tests deterministic
    const db = await getDB();
    await db.run("DELETE FROM settings WHERE key IN ('gbis_api_key', 'gbis_route_mappings')");
  });

  it('GET /api/realtime/config - should return empty config by default', async () => {
    const res = await getConfig();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.gbis_api_key).toBe('');
    expect(data.gbis_route_mappings).toEqual({});
  });

  it('POST /api/realtime/config - should update and save settings', async () => {
    const payload = {
      gbis_api_key: 'MY_SECRET_API_KEY_12345',
      gbis_route_mappings: {
        '138번': '224000014',
        '3006번': '234000035'
      }
    };

    const req = new Request('http://localhost/api/realtime/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const res = await postConfig(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Configuration saved successfully');

    // Fetch config again to verify it is stored
    const checkRes = await getConfig();
    const checkData = await checkRes.json();
    // Verify it is masked in GET
    expect(checkData.gbis_api_key).toBe('MY_SECRE...');
    expect(checkData.gbis_route_mappings).toEqual({
      '138번': '224000014',
      '3006번': '234000035'
    });
  });

  it('GET /api/realtime/search-routes - should return mock search results', async () => {
    // Search keyword that matches '138번'
    const req = new Request('http://localhost/api/realtime/search-routes?keyword=138');
    const res = await searchRoutes(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].routeName).toBe('138번');
    expect(data[0].isMock).toBe(true);
  });

  it('GET /api/realtime/route-stations - should return mock station list for routeId', async () => {
    const routeId = '224000014'; // 138번 Mock ID
    const req = new Request(`http://localhost/api/realtime/route-stations?routeId=${routeId}`);
    const res = await getRouteStations(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].stationId).toBeDefined();
    expect(data[0].stationSeq).toBe(1);
    expect(data[0].y).toBeGreaterThan(30); // Valid latitude
  });

  it('GET /api/realtime/bus-locations - should return simulated buses with matched drivers', async () => {
    const routeId = '224000014'; // 138번 Mock ID
    const req = new Request(`http://localhost/api/realtime/bus-locations?routeId=${routeId}`);
    const res = await getBusLocations(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].plateNo).toBeDefined();
    expect(data[0].stationSeq).toBeDefined();
    expect(data[0].isMock).toBe(true);
  });
});
