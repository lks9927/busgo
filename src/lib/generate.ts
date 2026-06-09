import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import { 
  getShiftDayOff, 
  getShiftTypeForDriver, 
  getDayOfWeekIndex, 
  getSundayIndex, 
  getWeekendDayIndex,
  parseKoreanDay
} from './rotation';
import { findSubstituteDriver } from './fairness';

// 공휴일 목록 (2025년/2026년 한국 주요 공휴일)
const PUBLIC_HOLIDAYS = [
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-01', '2025-05-05',
  '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-09', '2025-12-25',
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-05-05',
  '2026-06-06', '2026-08-15', '2026-10-03', '2026-10-09', '2026-12-25'
];

function matchesCondition(dayOfWeek: number, isHoliday: boolean, condition: string): boolean {
  const conds = condition.split(/[\/,]/).map(s => s.trim());
  for (const c of conds) {
    if (c === '일요일' && dayOfWeek === 6) return true;
    if (c === '토요일' && dayOfWeek === 5) return true;
    if (c === '공휴일' && isHoliday) return true;
    if (c === '주말' && (dayOfWeek === 5 || dayOfWeek === 6)) return true;
    if (c === '평일' && dayOfWeek >= 0 && dayOfWeek <= 4 && !isHoliday) return true;
  }
  return false;
}

function getReductionDayIndex(dateStr: string, condition: string): number {
  let count = 0;
  const base = new Date('2025-01-01');
  const target = new Date(dateStr);
  const PUBLIC_HOLIDAYS = [
    '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-01', '2025-05-05',
    '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-09', '2025-12-25',
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-05-05',
    '2026-06-06', '2026-08-15', '2026-10-03', '2026-10-09', '2026-12-25'
  ];
  
  for (let d = new Date(base); d < target; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    const dayOfWeekIdx = day === 0 ? 6 : day - 1;
    const dStr = d.toISOString().substring(0, 10);
    const dayIsHoliday = PUBLIC_HOLIDAYS.includes(dStr);
    
    if (matchesCondition(dayOfWeekIdx, dayIsHoliday, condition)) {
      count++;
    }
  }
  return count;
}

export async function generateDispatch(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  route: string,
  year: number,
  month: number
): Promise<{ count: number }> {
  // 1. 해당 년월의 모든 날짜 생성
  const numDays = new Date(year, month, 0).getDate();
  const dateStrings: string[] = [];
  for (let day = 1; day <= numDays; day++) {
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    dateStrings.push(`${year}-${monthStr}-${dayStr}`);
  }

  // 2. 해당 노선의 로테이션 모드 설정 조회
  const settingKey = `rotation_mode_${route}`;
  const setting = await db.get('SELECT value FROM settings WHERE key = ?', [settingKey]);
  const rotationMode = setting ? setting.value : (route === '138번' || route === '72번' ? 'weekly' : 'fixed');

  // 3. 해당 노선에 운행 중인 차량 전체 조회
  const vehicles = await db.all(
    `SELECT * FROM vehicles WHERE route = ? AND status = 'active' ORDER BY COALESCE(rotation_order, id)`,
    [route]
  );
  const N = vehicles.length;

  // 3-1. 감차 규칙 조회
  const reductionRules = await db.all(
    'SELECT condition, reduction_count FROM route_reduction_rules WHERE route = ?',
    [route]
  );

  if (N === 0) {
    return { count: 0 };
  }

  // Start transaction for fast SQLite inserts
  await db.run('BEGIN TRANSACTION');

  try {
    // 4. 기존 해당 월의 스케줄이 존재한다면 삭제 (덮어쓰기)
    const startMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(numDays).padStart(2, '0')}`;
    await db.run(
      `DELETE FROM schedules WHERE route = ? AND date BETWEEN ? AND ?`,
      [route, startMonthStr, endMonthStr]
    );

    let insertedCount = 0;
    const baseDateStr = '2025-01-01'; // 모든 계산의 기준 시작일

    // 4-1. 캐시 구성 준비 (실시간 대타 배정 속도 최적화)
    const rotatingDrivers = await db.all(
      `SELECT id FROM drivers 
       WHERE driver_type = 'rotating' 
         AND status = 'active'`
    );

    const workDaysMap = new Map<number, number>();
    const weekendDaysMap = new Map<number, number>();
    const lastWorkDateMap = new Map<number, string | null>();

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    for (const d of rotatingDrivers) {
      const workDaysRow = await db.get(
        `SELECT COUNT(*) as count FROM schedules WHERE driver_id = ? AND date LIKE ? AND status = 'planned'`,
        [d.id, `${monthStr}-%`]
      );
      const weekendDaysRow = await db.get(
        `SELECT COUNT(*) as count FROM schedules 
         WHERE driver_id = ? AND date LIKE ? AND status = 'planned'
           AND (strftime('%w', date) = '0' OR strftime('%w', date) = '6')`,
        [d.id, `${monthStr}-%`]
      );
      const lastWorkRow = await db.get(
        `SELECT MAX(date) as last_date FROM schedules WHERE driver_id = ? AND status = 'planned'`,
        [d.id]
      );

      workDaysMap.set(d.id, workDaysRow?.count || 0);
      weekendDaysMap.set(d.id, weekendDaysRow?.count || 0);
      lastWorkDateMap.set(d.id, lastWorkRow?.last_date || null);
    }

    // 5. 날짜별 루프
    for (const dateStr of dateStrings) {
      const dayOfWeek = getDayOfWeekIndex(dateStr); // 0=월 ~ 6=일
      const isHoliday = PUBLIC_HOLIDAYS.includes(dateStr);

      // 해당 날짜의 배정 기사 및 휴무 신청자 캐싱
      const scheduledList = await db.all("SELECT driver_id FROM schedules WHERE date = ?", [dateStr]);
      const scheduledToday = new Set<number>(scheduledList.map(s => s.driver_id).filter(Boolean));

      const leaveList = await db.all(
        `SELECT driver_id FROM leave_requests 
         WHERE status = 'approved' AND ? BETWEEN start_date AND end_date`,
        [dateStr]
      );
      const leavesToday = new Set<number>(leaveList.map(l => l.driver_id));

      const cache = {
        scheduledToday,
        leavesToday,
        workDaysMap,
        weekendDaysMap,
        lastWorkDateMap
      };

      // 기준일로부터 경과 일수 계산
      const baseDate = new Date(baseDateStr);
      const targetDate = new Date(dateStr);
      const daysDiff = Math.floor((targetDate.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000));

      // 로테이션 순서에 맞춰 차량 배열 정렬 (순환 적용)
      const dailyOrder = [];
      for (let i = 0; i < N; i++) {
        dailyOrder.push(vehicles[(daysDiff + i) % N]);
      }

      // 감차 패턴 적용
      let runningVehicles = [...dailyOrder];
      let maxReductionCount = 0;
      let matchingCondition = '';

      for (const rule of reductionRules) {
        if (matchesCondition(dayOfWeek, isHoliday, rule.condition)) {
          if (rule.reduction_count > maxReductionCount) {
            maxReductionCount = rule.reduction_count;
            matchingCondition = rule.condition;
          }
        }
      }

      // 폴백: 설정된 감차 규칙이 없다면 기존 하드코딩된 규칙 적용
      if (maxReductionCount === 0 && reductionRules.length === 0) {
        if (route === '138번' && (dayOfWeek === 6 || isHoliday)) {
          maxReductionCount = 1;
          matchingCondition = '일요일/공휴일';
        } else if (route === '72번' && (dayOfWeek === 5 || dayOfWeek === 6 || isHoliday)) {
          maxReductionCount = 3;
          matchingCondition = '토요일/일요일/공휴일';
        }
      }

      if (maxReductionCount > 0 && N > maxReductionCount) {
        const reductionIndex = getReductionDayIndex(dateStr, matchingCondition);
        const startRestIdx = (reductionIndex * maxReductionCount) % N;
        const restVehicleIds = new Set<number>();
        for (let i = 0; i < maxReductionCount; i++) {
          const restIdx = (startRestIdx + i) % N;
          restVehicleIds.add(vehicles[restIdx].id);
        }
        runningVehicles = runningVehicles.filter(v => !restVehicleIds.has(v.id));
      }

      // 각 운행 차량별로 배차 생성
      for (let seqIdx = 0; seqIdx < runningVehicles.length; seqIdx++) {
        const v = runningVehicles[seqIdx];
        const sequence = seqIdx + 1; // 1=첫차

        // 해당 차량에 배정된 고정 기사들 조회
        const drivers = await db.all(
          `SELECT * FROM drivers 
           WHERE vehicle_id = ? 
             AND driver_type = 'fixed' 
             AND status = 'active' 
           ORDER BY id`,
          [v.id]
        );

        let partnerA = drivers[0] || null;
        let partnerB = drivers[1] || null;

        // 주간 오전↔오후 교대
        const isMorningForA = getShiftTypeForDriver(true, baseDateStr, dateStr) === 'morning';
        
        const amDriver = isMorningForA ? partnerA : partnerB;
        const pmDriver = isMorningForA ? partnerB : partnerA;

        // 교대 근무 배정
        const shifts: Array<{ type: 'morning' | 'afternoon'; driver: any }> = [
          { type: 'morning', driver: amDriver },
          { type: 'afternoon', driver: pmDriver }
        ];

        for (const shift of shifts) {
          let assignedDriverId: number | null = null;
          let isSubstitute = 0;
          let originalDriverId: number | null = null;

          if (shift.driver) {
            const drv = shift.driver;
            
            // 쉬프트 요일 및 고정 휴일 계산
            const baseOff = drv.shift_day_off ? parseKoreanDay(drv.shift_day_off) : -1;
            const config = { mode: rotationMode as any };
            
            const currentOff = baseOff !== -1 ? getShiftDayOff(baseOff, baseDateStr, dateStr, config) : -1;
            const currentHoliday = drv.fixed_holiday ? parseKoreanDay(drv.fixed_holiday) : -1;

            if (dayOfWeek === currentOff || dayOfWeek === currentHoliday) {
              // 휴무일인 경우 -> 대타 배정 대상
              isSubstitute = 1;
              originalDriverId = drv.id;
              
              // 대타 기사 실시간 조회 (캐시 전달 및 차종 자격 확인)
              const sub = await findSubstituteDriver(db, route, dateStr, cache, v.bus_type_id);
              if (sub) {
                assignedDriverId = sub.id;

                // 캐시 업데이트
                workDaysMap.set(sub.id, (workDaysMap.get(sub.id) || 0) + 1);
                lastWorkDateMap.set(sub.id, dateStr);
                if (dayOfWeek === 5 || dayOfWeek === 6) {
                  weekendDaysMap.set(sub.id, (weekendDaysMap.get(sub.id) || 0) + 1);
                }
                scheduledToday.add(sub.id);
              }
            } else {
              // 근무일인 경우 -> 본인 배정
              assignedDriverId = drv.id;
            }
          } else {
            // 고정 기사가 매핑되지 않은 공석인 경우 -> 순환/대타 기사 배정
            isSubstitute = 1;
            originalDriverId = null;

            const sub = await findSubstituteDriver(db, route, dateStr, cache, v.bus_type_id);
            if (sub) {
              assignedDriverId = sub.id;

              // 캐시 업데이트
              workDaysMap.set(sub.id, (workDaysMap.get(sub.id) || 0) + 1);
              lastWorkDateMap.set(sub.id, dateStr);
              if (dayOfWeek === 5 || dayOfWeek === 6) {
                weekendDaysMap.set(sub.id, (weekendDaysMap.get(sub.id) || 0) + 1);
              }
              scheduledToday.add(sub.id);
            }
          }

          // 스케줄 INSERT
          await db.run(
            `INSERT INTO schedules (
              date, route, vehicle_id, shift_type, driver_id, sequence, is_substitute, original_driver_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'planned')`,
            [
              dateStr,
              route,
              v.id,
              shift.type,
              assignedDriverId,
              sequence,
              isSubstitute,
              originalDriverId
            ]
          );
          insertedCount++;
        }
      }
    }

    await db.run('COMMIT');
    return { count: insertedCount };
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncSchedulesToWeeklyDispatches(
  db: any,
  route: string,
  year: number,
  month: number
): Promise<{ count: number }> {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  
  // 1. Delete existing weekly_dispatches for this route and month
  await db.run(
    `DELETE FROM weekly_dispatches WHERE route = ? AND date LIKE ?`,
    [route, `${monthStr}-%`]
  );

  // 2. Fetch all schedules for this route and month, joining with vehicles and drivers
  const schedules = await db.all(
    `SELECT s.*, v.vehicle_number, d.name as driver_name
     FROM schedules s
     LEFT JOIN vehicles v ON s.vehicle_id = v.id
     LEFT JOIN drivers d ON s.driver_id = d.id
     WHERE s.route = ? AND s.date LIKE ?
     ORDER BY s.date ASC, s.sequence ASC`,
    [route, `${monthStr}-%`]
  );

  // 3. Build a map of departure times from route_timetables first, then weekly_dispatches
  const timetables = await db.all(
    `SELECT shift_type, sequence, departure_time 
     FROM route_timetables 
     WHERE route = ?`,
    [route]
  );
  
  const departureTimesMap = new Map<string, string>();
  timetables.forEach((row: any) => {
    const shiftKorean = row.shift_type === 'morning' ? '오전' : (row.shift_type === 'afternoon' ? '오후' : row.shift_type);
    const key = `${shiftKorean}_${row.sequence}`;
    departureTimesMap.set(key, row.departure_time);
  });

  const departureTimesRows = await db.all(
    `SELECT shift_type, sequence, departure_time, COUNT(*) as cnt
     FROM weekly_dispatches
     WHERE route = ? AND sequence IS NOT NULL AND departure_time IS NOT NULL AND departure_time != ''
     GROUP BY shift_type, sequence, departure_time
     ORDER BY shift_type, sequence, cnt DESC`,
    [route]
  );

  departureTimesRows.forEach((row: any) => {
    const key = `${row.shift_type}_${row.sequence}`;
    if (!departureTimesMap.has(key)) {
      departureTimesMap.set(key, row.departure_time);
    }
  });

  // 4. Find all active vehicles for this route
  const activeVehicles = await db.all(
    `SELECT * FROM vehicles WHERE route = ? AND status = 'active'`,
    [route]
  );

  let insertedCount = 0;
  
  // Group schedules by date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schedulesByDate = new Map<string, any[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schedules.forEach((s: any) => {
    if (!schedulesByDate.has(s.date)) {
      schedulesByDate.set(s.date, []);
    }
    schedulesByDate.get(s.date)!.push(s);
  });

  // Get list of dates in this month
  const numDays = new Date(year, month, 0).getDate();
  const dateStrings: string[] = [];
  for (let day = 1; day <= numDays; day++) {
    dateStrings.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }

  // Loop through each date
  for (const dateStr of dateStrings) {
    const dailySchedules = schedulesByDate.get(dateStr) || [];
    
    // Insert running schedules
    for (const s of dailySchedules) {
      const shiftTypeKorean = s.shift_type === 'morning' ? '오전' : '오후';
      const key = `${shiftTypeKorean}_${s.sequence}`;
      let departureTime = departureTimesMap.get(key) || null;
      
      // Heuristic default if no history exists for this sequence/shift
      if (!departureTime) {
        if (s.shift_type === 'morning') {
          const min = 30 + (s.sequence - 1) * 15;
          const hour = 4 + Math.floor(min / 60);
          const minutes = min % 60;
          departureTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
        } else {
          const min = 30 + (s.sequence - 1) * 15;
          const hour = 14 + Math.floor(min / 60);
          const minutes = min % 60;
          departureTime = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
        }
      }

      await db.run(
        `INSERT INTO weekly_dispatches (route, date, shift_type, sequence, vehicle_number, driver_name, departure_time)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          route,
          dateStr,
          shiftTypeKorean,
          s.sequence,
          s.vehicle_number || '',
          s.driver_name || '',
          departureTime
        ]
      );
      insertedCount++;
    }

    // Insert resting schedules
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runningVehicleIds = new Set(dailySchedules.map((s: any) => s.vehicle_id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const restingVehicles = activeVehicles.filter((v: any) => !runningVehicleIds.has(v.id));

    for (const v of restingVehicles) {
      for (const shiftTypeKorean of ['오전', '오후']) {
        await db.run(
          `INSERT INTO weekly_dispatches (route, date, shift_type, sequence, vehicle_number, driver_name, departure_time)
           VALUES (?, ?, ?, NULL, ?, '', NULL)`,
          [
            route,
            dateStr,
            shiftTypeKorean,
            v.vehicle_number
          ]
        );
        insertedCount++;
      }
    }
  }

  return { count: insertedCount };
}

