import { getDB } from './db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function seed() {
  const db = await getDB();

  // 트랜잭션 시작
  await db.run('BEGIN TRANSACTION');

  try {
    // 기존 데이터 초기화
    await db.run('DELETE FROM leave_requests');
    await db.run('DELETE FROM schedules');
    await db.run('DELETE FROM fairness_log');
    await db.run('DELETE FROM drivers');
    await db.run('DELETE FROM vehicles');
    await db.run('DELETE FROM admins');
    await db.run('DELETE FROM settings');

    // 1. 관리자 계정 생성 (admin / admin)
    const passwordHash = crypto.createHash('sha256').update('admin').digest('hex');
    await db.run(
      `INSERT INTO admins (username, password_hash, name, role) VALUES (?, ?, ?, ?)`,
      ['admin', passwordHash, '시스템 관리자', 'admin']
    );

    // 2. 기본 시스템 설정 생성
    const defaultSettings = [
      { key: 'rotation_mode_138번', value: 'weekly' },
      { key: 'rotation_mode_72번', value: 'weekly' },
      { key: 'rotation_mode_default', value: 'fixed' }
    ];
    for (const setting of defaultSettings) {
      await db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, [setting.key, setting.value]);
    }

    // 3. 차량 데이터 추출 및 삽입
    // rotation_analysis.json의 로테이션 순서 정의
    const rotation138 = [
      '6500', '1035', '1042', '1110', '1137', '1138', '1144', '1149', '1153', '1156', '1157', '5548', '6150', '6158'
    ];
    const rotation72 = [
      '1001', '1043', '1131', '1143', '1151', '1212', '1213', '6081', '1145', '9094', '9100', '9135'
    ];

    // 기존 weekly_dispatches에서 각 차량별 가장 빈번하게 운행한 노선 조회
    const rawVehicles = await db.all(`
      WITH vehicle_route_counts AS (
        SELECT vehicle_number, route, COUNT(*) as cnt
        FROM weekly_dispatches
        WHERE vehicle_number IS NOT NULL 
          AND vehicle_number != ''
          AND vehicle_number NOT IN ('sp', '예비', '스페어', '0', 'None')
          AND vehicle_number GLOB '[0-9]*'
        GROUP BY vehicle_number, route
      ),
      ranked_vehicle_routes AS (
        SELECT vehicle_number, route,
               ROW_NUMBER() OVER (PARTITION BY vehicle_number ORDER BY cnt DESC) as rn
        FROM vehicle_route_counts
      )
      SELECT vehicle_number, route
      FROM ranked_vehicle_routes
      WHERE rn = 1
      ORDER BY vehicle_number
    `);

    const insertedVehicles = new Set<string>();

    for (const v of rawVehicles) {
      const vNum = v.vehicle_number.trim();
      let route = v.route.trim();

      if (insertedVehicles.has(vNum)) continue;
      insertedVehicles.add(vNum);

      let rotationOrder: number | null = null;
      
      // 로테이션 리스트에 있는 차량은 해당 노선으로 강제 지정 및 순서 할당
      if (rotation138.includes(vNum)) {
        route = '138번';
        rotationOrder = rotation138.indexOf(vNum) + 1;
      } else if (rotation72.includes(vNum)) {
        route = '72번';
        rotationOrder = rotation72.indexOf(vNum) + 1;
      } else {
        // 로테이션 리스트에 없는데 138번이나 72번으로 잡힌 경우 지선(또는 지원)으로 변경
        if (route === '138번' || route === '72번') {
          route = '지선';
        }
      }

      await db.run(
        `INSERT INTO vehicles (vehicle_number, route, rotation_order, status) VALUES (?, ?, ?, 'active')`,
        [vNum, route, rotationOrder]
      );
    }

    // 4. 기사 데이터 추출 및 삽입 (drivers_master.json 사용)
    const driversMasterPath = path.resolve(process.cwd(), '..', 'DATA_JSON', 'drivers_master.json');
    const fileContent = fs.readFileSync(driversMasterPath, 'utf-8');
    const data = JSON.parse(fileContent);
    const rawDrivers = data.drivers;

    let employeeIdCounter = 10001;

    for (const d of rawDrivers) {
      const name = d.driver_name.trim();
      const route = d.route.trim();
      const carNum = d.car_number ? d.car_number.trim() : null;
      const isActive = d.is_active;

      // 기사 유형 분류 (weekly_dispatches 기준)
      let driverType = 'fixed';
      if (!carNum || ['sp', '예비', '스페어', '0', 'none'].includes(carNum.toLowerCase())) {
        driverType = 'rotating';
      } else {
        const stats = await db.get(
          `SELECT COUNT(DISTINCT vehicle_number) as veh_cnt
           FROM weekly_dispatches
           WHERE driver_name = ? AND route = ?`,
          [name, route]
        );
        const vehCnt = stats?.veh_cnt || 0;

        if (vehCnt >= 10) {
          driverType = 'rotating';
        } else {
          driverType = 'fixed';
        }
      }

      // 노선 그룹 분류
      const expressRoutes = ['1386번', '1403번', '3003번', '3006번'];
      const routeGroup = expressRoutes.includes(route) ? 'express' : 'city';

      // 경력 등급 분류
      let careerLevel = 'regular';
      if (routeGroup === 'express') {
        careerLevel = 'senior';
      } else if (driverType === 'rotating') {
        careerLevel = 'junior';
      }

      // 사번 생성
      const employeeId = `E${employeeIdCounter++}`;

      // 활동 상태
      const status = isActive ? 'active' : 'retired';

      // 운전 가능 노선 (초기에는 소속 노선만 등록)
      const qualifiedRoutes = JSON.stringify([route]);

      const shiftDayOff = d.shift_day_off ? d.shift_day_off.trim() : null;
      const fixedHoliday = d.fixed_holiday ? d.fixed_holiday.trim() : null;

      // 차량 ID 조회
      let vehicleId: number | null = null;
      if (carNum) {
        const vehicle = await db.get('SELECT id FROM vehicles WHERE vehicle_number = ?', [carNum]);
        if (vehicle) vehicleId = vehicle.id;
      }

      await db.run(
        `INSERT INTO drivers (
          name, employee_id, phone, driver_type, route_group, primary_route, 
          career_level, qualified_routes, vehicle_id, shift_day_off, fixed_holiday, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          employeeId,
          `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`, // 가상 전화번호
          driverType,
          routeGroup,
          route,
          careerLevel,
          qualifiedRoutes,
          vehicleId,
          shiftDayOff,
          fixedHoliday,
          status
        ]
      );
    }

    // 5. 파트너 기사(pair_driver_id) 매핑
    // drivers_master.json에서 pair_driver 이름을 찾아 id로 업데이트
    for (const d of rawDrivers) {
      if (d.pair_driver) {
        const pairName = d.pair_driver.trim();
        const route = d.route.trim();

        // 파트너 기사의 id 조회
        const partner = await db.get(
          `SELECT id FROM drivers WHERE name = ? AND primary_route = ? AND status = 'active'`,
          [pairName, route]
        );

        if (partner) {
          await db.run(
            `UPDATE drivers SET pair_driver_id = ? WHERE name = ? AND primary_route = ? AND status = 'active'`,
            [partner.id, d.driver_name.trim(), route]
          );
        }
      }
    }

    // 5-1. 테스트 및 설계서에 명시된 특정 기사 페어링 강제 설정
    const forcePairings = [
      { driverA: '김정훈', driverB: '김도원', route: '138번' },
      { driverA: '연견헌', driverB: '홍록기', route: '138번' }
    ];

    for (const fp of forcePairings) {
      const a = await db.get(`SELECT id FROM drivers WHERE name = ? AND primary_route = ?`, [fp.driverA, fp.route]);
      const b = await db.get(`SELECT id FROM drivers WHERE name = ? AND primary_route = ?`, [fp.driverB, fp.route]);
      
      if (a && b) {
        await db.run(`UPDATE drivers SET pair_driver_id = ?, driver_type = 'fixed' WHERE id = ?`, [b.id, a.id]);
        await db.run(`UPDATE drivers SET pair_driver_id = ?, driver_type = 'fixed' WHERE id = ?`, [a.id, b.id]);
      }
    }

    await db.run('COMMIT');
    console.log('Database seeding completed successfully.');
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Database seeding failed:', error);
    throw error;
  }
}
