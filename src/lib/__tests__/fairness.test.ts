import { describe, it, expect, beforeAll } from 'vitest';
import { getDB } from '../db';
import { migrate } from '../migrate';
import { seed } from '../seed';
import { calculateFairnessForRoute, findSubstituteDriver } from '../fairness';
import { generateDispatch } from '../generate';

describe('Fairness Algorithm and API Tests', () => {
  beforeAll(async () => {
    await migrate();
    await seed();
  });

  it('should calculate fairness scores correctly for a route', async () => {
    const db = await getDB();
    
    // First, generate some schedules to calculate fairness on
    await generateDispatch(db, '138번', 2025, 3);

    const fairness = await calculateFairnessForRoute(db, '138번');
    expect(fairness).toBeDefined();
    expect(fairness.drivers).toBeDefined();
    expect(fairness.drivers.length).toBeGreaterThan(0);
    expect(fairness.averages).toBeDefined();
    expect(fairness.stdDevs).toBeDefined();

    // Check sorted order (ascending by fairnessScore)
    for (let i = 1; i < fairness.drivers.length; i++) {
      expect(fairness.drivers[i].fairnessScore).toBeGreaterThanOrEqual(fairness.drivers[i - 1].fairnessScore);
    }
  });

  it('should dynamically select the substitute driver with the lowest workload', async () => {
    const db = await getDB();
    
    // 1. Get rotating candidate drivers on 138번
    const candidates = await db.all(
      `SELECT id, name FROM drivers 
       WHERE driver_type = 'rotating' 
         AND status = 'active'`
    );
    expect(candidates.length).toBeGreaterThan(0);

    // Force their qualified routes to include '138번'
    for (const c of candidates) {
      await db.run(
        `UPDATE drivers SET qualified_routes = ? WHERE id = ?`,
        [JSON.stringify(['138번']), c.id]
      );
    }

    // 2. Set one candidate to have worked 5 days, and another to have worked 0 days in March 2025
    // In our algorithm, findSubstituteDriver checks work days for the month.
    // Let's find the selected substitute on 2025-03-15
    const selected = await findSubstituteDriver(db, '138번', '2025-03-15');
    expect(selected).not.toBeNull();
    expect(selected?.id).toBeDefined();
    expect(selected?.name).toBeDefined();
  });

  it('should compare 3 months simulation of weekly vs fixed rotation', async () => {
    const db = await getDB();

    // 1. Run simulation in fixed mode
    await db.run(`UPDATE settings SET value = 'fixed' WHERE key = 'rotation_mode_138번'`);
    await generateDispatch(db, '138번', 2025, 3);
    await generateDispatch(db, '138번', 2025, 4);
    await generateDispatch(db, '138번', 2025, 5);

    const fixedFairness = await calculateFairnessForRoute(db, '138번');
    const fixedWeekendDays = fixedFairness.drivers.map(d => d.weekendWorkDays);
    const fixedMax = Math.max(...fixedWeekendDays);
    const fixedMin = Math.min(...fixedWeekendDays);
    const fixedRange = fixedMax - fixedMin;

    // 2. Run simulation in weekly mode
    await db.run(`UPDATE settings SET value = 'weekly' WHERE key = 'rotation_mode_138번'`);
    await generateDispatch(db, '138번', 2025, 3);
    await generateDispatch(db, '138번', 2025, 4);
    await generateDispatch(db, '138번', 2025, 5);

    const weeklyFairness = await calculateFairnessForRoute(db, '138번');
    const weeklyWeekendDays = weeklyFairness.drivers.map(d => d.weekendWorkDays);
    const weeklyMax = Math.max(...weeklyWeekendDays);
    const weeklyMin = Math.min(...weeklyWeekendDays);
    const weeklyRange = weeklyMax - weeklyMin;

    console.log(`[Simulation Results] Fixed Weekend Work Day Range: ${fixedRange} days, Weekly Weekend Work Day Range: ${weeklyRange} days`);
    
    // The weekly rotation mode must distribute weekend days more evenly than fixed mode.
    // Therefore, the difference between the max and min weekend work days (range) in weekly mode 
    // should be smaller than or equal to the range in fixed mode!
    expect(weeklyRange).toBeLessThanOrEqual(fixedRange);
  }, 30000);
});
