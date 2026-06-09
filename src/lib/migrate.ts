import { getDB } from './db';

export async function migrate() {
  const db = await getDB();

  // Create tables in sequence
  await db.exec(`
    -- 기사 마스터
    CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        employee_id TEXT UNIQUE,       -- 사번
        phone TEXT,
        driver_type TEXT DEFAULT 'fixed',  -- 'fixed'(고정배차) / 'rotating'(순환배차)
        route_group TEXT,              -- 'city'(시내) / 'express'(직행)
        primary_route TEXT,            -- 소속 노선
        career_level TEXT DEFAULT 'junior',  -- 'junior'/'regular'/'senior'
        qualified_routes TEXT,         -- JSON 배열: ["138번","137번"]
        pair_driver_id INTEGER,
        vehicle_id INTEGER,            -- 배정된 차량 ID
        shift_day_off TEXT,            -- 쉬프트 요일 (월~일)
        fixed_holiday TEXT,            -- 고정 휴일 요일 (월~일)
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    -- 차량 마스터
    CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_number TEXT UNIQUE NOT NULL,
        route TEXT,
        rotation_order INTEGER,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- 배차 스케줄
    CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        route TEXT NOT NULL,
        vehicle_id INTEGER,
        shift_type TEXT,               -- 'morning'/'afternoon'/'triple'
        driver_id INTEGER,
        sequence INTEGER,
        is_substitute INTEGER DEFAULT 0,
        original_driver_id INTEGER,
        status TEXT DEFAULT 'planned',
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
    );

    -- 휴무 신청
    CREATE TABLE IF NOT EXISTS leave_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_id INTEGER NOT NULL,
        request_type TEXT,             -- 'annual'/'monthly'/'sick'/'substitute'
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending', -- 'pending'/'approved'/'rejected'
        requested_at TEXT DEFAULT (datetime('now')),
        reviewed_by TEXT,
        reviewed_at TEXT,
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
    );

    -- 공정성 로그 (월별 집계)
    CREATE TABLE IF NOT EXISTS fairness_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_id INTEGER,
        route TEXT,
        month TEXT,                    -- '2025-03'
        work_days INTEGER DEFAULT 0,
        weekend_work_days INTEGER DEFAULT 0,
        first_car_count INTEGER DEFAULT 0,
        triple_shift_count INTEGER DEFAULT 0,
        holiday_work_days INTEGER DEFAULT 0,
        fairness_score REAL DEFAULT 0,
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
    );

    -- 관리자 계정
    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'admin',
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- 시스템 설정
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  try {
    await db.exec('ALTER TABLE drivers ADD COLUMN shift_day_off TEXT');
  } catch (e) {
    // 이미 존재하는 경우 무시
  }
  try {
    await db.exec('ALTER TABLE drivers ADD COLUMN fixed_holiday TEXT');
  } catch (e) {
    // 이미 존재하는 경우 무시
  }
  try {
    await db.exec('ALTER TABLE drivers ADD COLUMN vehicle_id INTEGER');
  } catch (e) {
    // 이미 존재하는 경우 무시
  }
  try {
    await db.exec('ALTER TABLE drivers ADD COLUMN password TEXT');
  } catch (e) {
    // 이미 존재하는 경우 무시
  }

  // 1차 수정작업 (Phase 1) 신규 테이블
  await db.exec(`
    -- 차종 마스터
    CREATE TABLE IF NOT EXISTS bus_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- 기사 운전 자격 다대다 매핑
    CREATE TABLE IF NOT EXISTS driver_qualifications (
        driver_id INTEGER NOT NULL,
        bus_type_id INTEGER NOT NULL,
        PRIMARY KEY (driver_id, bus_type_id),
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
        FOREIGN KEY (bus_type_id) REFERENCES bus_types(id) ON DELETE CASCADE
    );

    -- 노선별 기본 시간표 관리
    CREATE TABLE IF NOT EXISTS route_timetables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route TEXT NOT NULL,
        shift_type TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        departure_time TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- 노선별 쉬프트 정보 관리
    CREATE TABLE IF NOT EXISTS route_shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route TEXT NOT NULL,
        shift_name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- 노선별 감차 규칙 설정
    CREATE TABLE IF NOT EXISTS route_reduction_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route TEXT NOT NULL,
        condition TEXT NOT NULL,
        reduction_count INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 노선 마스터 및 노선별 차량 배정 매핑 테이블
  await db.exec(`
    -- 노선 마스터
    CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_number TEXT UNIQUE NOT NULL,
        route_name TEXT,
        route_group TEXT DEFAULT 'city',
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now'))
    );

    -- 노선별 차량 배정 매핑
    CREATE TABLE IF NOT EXISTS route_vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id INTEGER NOT NULL,
        vehicle_id INTEGER NOT NULL,
        is_spare INTEGER DEFAULT 0,
        rotation_order INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
        UNIQUE (route_id, vehicle_id)
    );
  `);

  try {
    await db.exec('ALTER TABLE vehicles ADD COLUMN bus_type_id INTEGER');
  } catch (e) {
    // 이미 존재하는 경우 무시
  }

  // 기본 차종 시드 데이터 삽입 및 기존 차량/기사 기본값 매핑
  try {
    const countBusTypes = await db.get('SELECT COUNT(*) as count FROM bus_types');
    if (countBusTypes && countBusTypes.count === 0) {
      const defaultTypes = [
        { name: '일반', description: '일반 시내/직행 버스' },
        { name: '마을', description: '마을 버스' },
        { name: '저상', description: '저상 버스' },
        { name: '전기', description: '전기 버스' },
        { name: '2층', description: '2층 버스' }
      ];
      for (const t of defaultTypes) {
        await db.run('INSERT INTO bus_types (name, description) VALUES (?, ?)', [t.name, t.description]);
      }

      // 기존 모든 차량의 차종을 '일반'(id=1)으로 설정
      const defaultType = await db.get("SELECT id FROM bus_types WHERE name = '일반'");
      if (defaultType) {
        await db.run('UPDATE vehicles SET bus_type_id = ? WHERE bus_type_id IS NULL', [defaultType.id]);

        // 기존 모든 기사에게 '일반'(id=1) 운전 자격 부여
        const drivers = await db.all('SELECT id FROM drivers');
        for (const d of drivers) {
          await db.run(
            'INSERT OR IGNORE INTO driver_qualifications (driver_id, bus_type_id) VALUES (?, ?)',
            [d.id, defaultType.id]
          );
        }
      }
    }
  } catch (err) {
    console.error('Failed to seed default bus types:', err);
  }

  // 노선 마스터 시드 데이터: 기존 vehicles.route에서 자동 생성
  try {
    const countRoutes = await db.get('SELECT COUNT(*) as count FROM routes');
    if (countRoutes && countRoutes.count === 0) {
      // 기존 차량 테이블에서 고유 노선 목록 추출
      const distinctRoutes = await db.all(
        'SELECT DISTINCT route FROM vehicles WHERE route IS NOT NULL AND route != ""'
      );

      const expressPatterns = ['1386', '1403', '3003', '3006'];

      for (const r of distinctRoutes) {
        const routeNumber = r.route;
        const isExpress = expressPatterns.some(p => routeNumber.includes(p));
        const routeGroup = isExpress ? 'express' : 'city';

        await db.run(
          'INSERT INTO routes (route_number, route_group) VALUES (?, ?)',
          [routeNumber, routeGroup]
        );
      }

      // 기존 차량의 노선 정보를 route_vehicles 매핑으로 이관
      const vehiclesWithRoute = await db.all(
        'SELECT id, route, rotation_order FROM vehicles WHERE route IS NOT NULL AND route != ""'
      );

      for (const v of vehiclesWithRoute) {
        const routeRow = await db.get(
          'SELECT id FROM routes WHERE route_number = ?',
          [v.route]
        );
        if (routeRow) {
          await db.run(
            'INSERT OR IGNORE INTO route_vehicles (route_id, vehicle_id, is_spare, rotation_order) VALUES (?, ?, 0, ?)',
            [routeRow.id, v.id, v.rotation_order || null]
          );
        }
      }

      console.log(`Routes seed completed: ${distinctRoutes.length} routes migrated.`);
    }
  } catch (err) {
    console.error('Failed to seed routes:', err);
  }

  console.log('Migration completed successfully.');
}
