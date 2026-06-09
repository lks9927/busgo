import { describe, it, expect } from 'vitest';
import { getDB } from '../db';
import { seed } from '../seed';
import { migrate } from '../migrate';

describe('Seed Data Integrity Tests', () => {
  it('should seed data successfully and satisfy all integrity constraints', async () => {
    const db = await getDB();
    
    // Ensure migrated first
    await migrate();
    
    // Seed
    await seed();

    // 1. Verify driver count >= 300
    const driverCountRow = await db.get('SELECT COUNT(*) as count FROM drivers');
    expect(driverCountRow?.count).toBeGreaterThanOrEqual(300);

    // 2. Check no dummy names
    const dummyNames = ['성명', '기사명', '합계', '오전', '오후', '오후1', '오후2', '#'];
    for (const name of dummyNames) {
      const driver = await db.get('SELECT id FROM drivers WHERE name = ?', [name]);
      expect(driver).toBeUndefined();
    }
    const hashStartNames = await db.all("SELECT name FROM drivers WHERE name LIKE '#%'");
    expect(hashStartNames.length).toBe(0);

    // 3. Verify Route Group Mapping
    const cityDriver = await db.get("SELECT route_group FROM drivers WHERE primary_route = '138번' AND status = 'active' LIMIT 1");
    expect(cityDriver?.route_group).toBe('city');

    const expressDriver = await db.get("SELECT route_group FROM drivers WHERE primary_route = '1403번' AND status = 'active' LIMIT 1");
    expect(expressDriver?.route_group).toBe('express');

    // 4. Verify Driver Type Classification
    // Let's find specific drivers
    const driverKim = await db.get("SELECT driver_type FROM drivers WHERE name = '김정훈' AND primary_route = '138번'");
    expect(driverKim?.driver_type).toBe('fixed');

    const driverHong = await db.get("SELECT driver_type FROM drivers WHERE name = '홍록기' AND primary_route = '138번'");
    expect(driverHong?.driver_type).toBe('fixed');

    // Rotating driver should have rotating type
    // SP drivers from original list
    const spDrivers = await db.all("SELECT driver_type FROM drivers WHERE name IN ('남동우', '안동진', '윤철규')");
    for (const d of spDrivers) {
      expect(d.driver_type).toBe('rotating');
    }

    // 5. Verify Vehicles Table
    const v138Count = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE route = '138번'");
    expect(v138Count?.count).toBe(14); // 14 vehicles for 138번

    const v72Count = await db.get("SELECT COUNT(*) as count FROM vehicles WHERE route = '72번'");
    expect(v72Count?.count).toBe(12); // 12 vehicles for 72번

    // Check specific vehicle rotation orders
    // 138번: 6500 (order 1), 1035 (order 2), 6158 (order 14)
    const car6500 = await db.get("SELECT rotation_order FROM vehicles WHERE vehicle_number = '6500' AND route = '138번'");
    expect(car6500?.rotation_order).toBe(1);

    const car1035 = await db.get("SELECT rotation_order FROM vehicles WHERE vehicle_number = '1035' AND route = '138번'");
    expect(car1035?.rotation_order).toBe(2);

    const car6158 = await db.get("SELECT rotation_order FROM vehicles WHERE vehicle_number = '6158' AND route = '138번'");
    expect(car6158?.rotation_order).toBe(14);

    // 6. Verify Pair Driver Mapping
    // 138번 Vehicle 1156: 김정훈 ↔ 김도원
    const driverKimDetail = await db.get("SELECT id, pair_driver_id FROM drivers WHERE name = '김정훈' AND primary_route = '138번'");
    const driverDowonDetail = await db.get("SELECT id, pair_driver_id FROM drivers WHERE name = '김도원' AND primary_route = '138번'");

    expect(driverKimDetail?.pair_driver_id).toBe(driverDowonDetail?.id);
    expect(driverDowonDetail?.pair_driver_id).toBe(driverKimDetail?.id);
  });
});
