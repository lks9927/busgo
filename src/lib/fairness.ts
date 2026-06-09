import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';

export interface DriverStats {
  driverId: number;
  name: string;
  workDays: number;
  weekendDays: number;
  lastWorkDate: string | null;
}

// 특정 기사의 월간 근무 통계 계산
export async function getDriverStatsForMonth(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  driverId: number,
  month: string // 형식: '2025-03'
): Promise<DriverStats> {
  const driver = await db.get('SELECT name FROM drivers WHERE id = ?', [driverId]);
  const name = driver?.name || '';

  // 해당 월의 전체 근무 일수 (schedules 기준)
  const workDaysRow = await db.get(
    `SELECT COUNT(*) as count 
     FROM schedules 
     WHERE driver_id = ? 
       AND date LIKE ? 
       AND status = 'planned'`,
    [driverId, `${month}-%`]
  );
  const workDays = workDaysRow?.count || 0;

  // 해당 월의 주말 근무 일수
  // strftime('%w', date) -> 0=일요일, 6=토요일
  const weekendDaysRow = await db.get(
    `SELECT COUNT(*) as count 
     FROM schedules 
     WHERE driver_id = ? 
       AND date LIKE ? 
       AND status = 'planned'
       AND (strftime('%w', date) = '0' OR strftime('%w', date) = '6')`,
    [driverId, `${month}-%`]
  );
  const weekendDays = weekendDaysRow?.count || 0;

  // 가장 최근 근무일 조회
  const lastWorkRow = await db.get(
    `SELECT MAX(date) as last_date 
     FROM schedules 
     WHERE driver_id = ? 
       AND status = 'planned'`,
    [driverId]
  );
  const lastWorkDate = lastWorkRow?.last_date || null;

  return {
    driverId,
    name,
    workDays,
    weekendDays,
    lastWorkDate
  };
}

// 대타 기사 조회 알고리즘 (캐시 지원 추가)
export async function findSubstituteDriver(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  route: string,
  date: string, // 형식: '2025-03-15'
  cache?: {
    scheduledToday: Set<number>;
    leavesToday: Set<number>;
    workDaysMap: Map<number, number>;
    weekendDaysMap: Map<number, number>;
    lastWorkDateMap: Map<number, string | null>;
  },
  busTypeId?: number
): Promise<{ id: number; name: string } | null> {
  const month = date.substring(0, 7);

  // 1. 해당 노선에 운전 가능한 순환(rotating) 기사 전체 목록 조회 (차종 자격 필터링 포함)
  let candidates;
  if (busTypeId) {
    candidates = await db.all(
      `SELECT d.id, d.name, d.qualified_routes 
       FROM drivers d
       JOIN driver_qualifications dq ON d.id = dq.driver_id
       WHERE d.status = 'active' 
         AND d.driver_type = 'rotating'
         AND dq.bus_type_id = ?`,
      [busTypeId]
    );
  } else {
    candidates = await db.all(
      `SELECT id, name, qualified_routes 
       FROM drivers 
       WHERE status = 'active' 
         AND driver_type = 'rotating'`,
      []
    );
  }

  const availableCandidates: any[] = [];

  for (const c of candidates) {
    // 운전 가능 노선 검증 (JSON 배열 파싱)
    let isQualified = false;
    try {
      const routes = JSON.parse(c.qualified_routes || '[]');
      if (routes.includes(route)) isQualified = true;
    } catch {
      // 파싱 실패시 기본 매핑
    }

    if (!isQualified) continue;

    if (cache) {
      // 캐시 기반 검증
      if (cache.leavesToday.has(c.id)) continue;
      if (cache.scheduledToday.has(c.id)) continue;
    } else {
      // 2. 해당 날짜에 승인된 휴무가 있는지 검증
      const leave = await db.get(
        `SELECT id 
         FROM leave_requests 
         WHERE driver_id = ? 
           AND status = 'approved' 
           AND ? BETWEEN start_date AND end_date`,
        [c.id, date]
      );
      if (leave) continue;

      // 3. 해당 날짜에 이미 배정된 스케줄이 있는지 검증
      const schedule = await db.get(
        `SELECT id 
         FROM schedules 
         WHERE driver_id = ? 
           AND date = ?`,
        [c.id, date]
      );
      if (schedule) continue;
    }

    availableCandidates.push(c);
  }

  if (availableCandidates.length === 0) {
    return null;
  }

  // 4. 각 후보의 공정성 통계 수집
  const statsList: DriverStats[] = [];
  for (const c of availableCandidates) {
    if (cache) {
      statsList.push({
        driverId: c.id,
        name: c.name,
        workDays: cache.workDaysMap.get(c.id) || 0,
        weekendDays: cache.weekendDaysMap.get(c.id) || 0,
        lastWorkDate: cache.lastWorkDateMap.get(c.id) || null
      });
    } else {
      const stats = await getDriverStatsForMonth(db, c.id, month);
      statsList.push(stats);
    }
  }

  // 5. 공정성 기준 정렬:
  //   1) 월간 근무일수 적은 순
  //   2) 월간 주말 근무일수 적은 순
  //   3) 가장 최근 근무일이 먼 순 (오래 쉰 기사 우선)
  statsList.sort((a, b) => {
    if (a.workDays !== b.workDays) {
      return a.workDays - b.workDays;
    }
    if (a.weekendDays !== b.weekendDays) {
      return a.weekendDays - b.weekendDays;
    }
    if (!a.lastWorkDate) return -1; // 근무한 적 없으면 우선 배정
    if (!b.lastWorkDate) return 1;
    return a.lastWorkDate.localeCompare(b.lastWorkDate);
  });

  const selected = statsList[0];
  return {
    id: selected.driverId,
    name: selected.name
  };
}

export interface DriverFairness {
  driverId: number;
  name: string;
  driverType: string;
  weekendWorkDays: number;
  firstCarCount: number;
  tripleShiftCount: number;
  holidayWorkDays: number;
  consecutiveWorkDays: number;
  fairnessScore: number;
}

export async function calculateFairnessForRoute(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  route: string
): Promise<{ drivers: DriverFairness[]; averages: any; stdDevs: any }> {
  // Query all active drivers on route
  const drivers = await db.all(
    `SELECT id, name, driver_type 
     FROM drivers 
     WHERE primary_route = ? AND status = 'active'`,
    [route]
  );

  const driverFairnessList: DriverFairness[] = [];

  // 공휴일 목록
  const PUBLIC_HOLIDAYS = [
    '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-01', '2025-05-05',
    '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-09', '2025-12-25',
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-05-05',
    '2026-06-06', '2026-08-15', '2026-10-03', '2026-10-09', '2026-12-25'
  ];

  for (const d of drivers) {
    // 해당 기사의 모든 배차 스케줄 조회
    const schedules = await db.all(
      `SELECT date, sequence, shift_type 
       FROM schedules 
       WHERE driver_id = ? 
         AND status = 'planned'
       ORDER BY date ASC`,
      [d.id]
    );

    let weekendWorkDays = 0;
    let firstCarCount = 0;
    let tripleShiftCount = 0;
    let holidayWorkDays = 0;

    const dates: string[] = [];

    for (const s of schedules) {
      if (!dates.includes(s.date)) {
        dates.push(s.date);
      }

      // 1. 첫차 배정 횟수 (sequence = 1)
      if (s.sequence === 1) {
        firstCarCount++;
      }

      // 2. 3탕 근무 횟수
      if (s.shift_type === 'triple') {
        tripleShiftCount++;
      }
    }

    // 일별 고유 근무 기준 지표 계산
    for (const dateStr of dates) {
      const dObj = new Date(dateStr);
      const jsDay = dObj.getDay();
      
      // 3. 주말 근무일수 (토요일=6, 일요일=0)
      if (jsDay === 0 || jsDay === 6) {
        weekendWorkDays++;
      }

      // 4. 공휴일 근무일수
      if (PUBLIC_HOLIDAYS.includes(dateStr)) {
        holidayWorkDays++;
      }
    }

    // 5. 최대 연속 근무일 계산
    let consecutiveWorkDays = 0;
    if (dates.length > 0) {
      let currentConsec = 1;
      let maxConsec = 1;
      
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000));
        
        if (diffDays === 1) {
          currentConsec++;
        } else if (diffDays > 1) {
          if (currentConsec > maxConsec) {
            maxConsec = currentConsec;
          }
          currentConsec = 1;
        }
      }
      if (currentConsec > maxConsec) {
        maxConsec = currentConsec;
      }
      consecutiveWorkDays = maxConsec;
    }

    driverFairnessList.push({
      driverId: d.id,
      name: d.name,
      driverType: d.driver_type,
      weekendWorkDays,
      firstCarCount,
      tripleShiftCount,
      holidayWorkDays,
      consecutiveWorkDays,
      fairnessScore: 0 // 아래에서 계산
    });
  }

  // 6. 평균(Average) 계산
  const count = drivers.length || 1;
  const averages = {
    weekendWorkDays: driverFairnessList.reduce((sum, item) => sum + item.weekendWorkDays, 0) / count,
    firstCarCount: driverFairnessList.reduce((sum, item) => sum + item.firstCarCount, 0) / count,
    tripleShiftCount: driverFairnessList.reduce((sum, item) => sum + item.tripleShiftCount, 0) / count,
    holidayWorkDays: driverFairnessList.reduce((sum, item) => sum + item.holidayWorkDays, 0) / count,
    consecutiveWorkDays: driverFairnessList.reduce((sum, item) => sum + item.consecutiveWorkDays, 0) / count,
  };

  // 7. 표준편차(Standard Deviation) 계산
  const variance = {
    weekendWorkDays: driverFairnessList.reduce((sum, item) => sum + Math.pow(item.weekendWorkDays - averages.weekendWorkDays, 2), 0) / count,
    firstCarCount: driverFairnessList.reduce((sum, item) => sum + Math.pow(item.firstCarCount - averages.firstCarCount, 2), 0) / count,
    tripleShiftCount: driverFairnessList.reduce((sum, item) => sum + Math.pow(item.tripleShiftCount - averages.tripleShiftCount, 2), 0) / count,
    holidayWorkDays: driverFairnessList.reduce((sum, item) => sum + Math.pow(item.holidayWorkDays - averages.holidayWorkDays, 2), 0) / count,
    consecutiveWorkDays: driverFairnessList.reduce((sum, item) => sum + Math.pow(item.consecutiveWorkDays - averages.consecutiveWorkDays, 2), 0) / count,
  };

  const stdDevs = {
    weekendWorkDays: Math.sqrt(variance.weekendWorkDays) || 1,
    firstCarCount: Math.sqrt(variance.firstCarCount) || 1,
    tripleShiftCount: Math.sqrt(variance.tripleShiftCount) || 1,
    holidayWorkDays: Math.sqrt(variance.holidayWorkDays) || 1,
    consecutiveWorkDays: Math.sqrt(variance.consecutiveWorkDays) || 1,
  };

  // 8. Z-score 및 가중 합계 공정성 점수 계산
  const weights = { weekend: 0.30, firstCar: 0.20, triple: 0.20, holiday: 0.20, consecutive: 0.10 };

  for (const item of driverFairnessList) {
    const zWeekend = (item.weekendWorkDays - averages.weekendWorkDays) / stdDevs.weekendWorkDays;
    const zFirstCar = (item.firstCarCount - averages.firstCarCount) / stdDevs.firstCarCount;
    const zTriple = (item.tripleShiftCount - averages.tripleShiftCount) / stdDevs.tripleShiftCount;
    const zHoliday = (item.holidayWorkDays - averages.holidayWorkDays) / stdDevs.holidayWorkDays;
    const zConsec = (item.consecutiveWorkDays - averages.consecutiveWorkDays) / stdDevs.consecutiveWorkDays;

    item.fairnessScore = zWeekend * weights.weekend
                       + zFirstCar * weights.firstCar
                       + zTriple * weights.triple
                       + zHoliday * weights.holiday
                       + zConsec * weights.consecutive;
                       
    // DB에 공정성 로그 저장 (DELETE 후 INSERT로 교체하여 UNIQUE 제약 조건이 없는 호환성 문제 해결)
    const currentMonthStr = new Date().toISOString().substring(0, 7);
    await db.run('DELETE FROM fairness_log WHERE driver_id = ? AND month = ?', [item.driverId, currentMonthStr]);
    await db.run(
      `INSERT INTO fairness_log (
        driver_id, route, month, work_days, weekend_work_days, first_car_count, triple_shift_count, holiday_work_days, fairness_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.driverId,
        route,
        currentMonthStr,
        0,
        item.weekendWorkDays,
        item.firstCarCount,
        item.tripleShiftCount,
        item.holidayWorkDays,
        item.fairnessScore
      ]
    ).catch(() => {});
  }

  // 점수가 낮은 순(가장 적게 일하고 혜택을 덜 받은 순)으로 정렬
  driverFairnessList.sort((a, b) => a.fairnessScore - b.fairnessScore);

  return {
    drivers: driverFairnessList,
    averages,
    stdDevs
  };
}
