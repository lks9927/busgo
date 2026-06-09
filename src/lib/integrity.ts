import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';

export interface IntegrityError {
  type: string;
  message: string;
  details: any;
}

export async function validateSchedules(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  startDate: string,
  endDate: string
): Promise<IntegrityError[]> {
  const errors: IntegrityError[] = [];

  // 1. 같은 날짜 + 같은 차량 + 같은 shift_type 중복 배정 검증
  const duplicateVehicleShifts = await db.all(`
    SELECT date, vehicle_id, shift_type, COUNT(*) as cnt
    FROM schedules
    WHERE date BETWEEN ? AND ?
    GROUP BY date, vehicle_id, shift_type
    HAVING cnt > 1
  `, [startDate, endDate]);

  for (const dup of duplicateVehicleShifts) {
    const vehicle = await db.get('SELECT vehicle_number FROM vehicles WHERE id = ?', [dup.vehicle_id]);
    errors.push({
      type: 'DUPLICATE_VEHICLE_SHIFT',
      message: `차량 ${vehicle?.vehicle_number || dup.vehicle_id}가 ${dup.date} ${dup.shift_type} 근무에 중복 배정되었습니다.`,
      details: dup
    });
  }

  // 2. 같은 날짜 + 같은 기사에 중복 배차 검증 (오전+오후+3탕(triple) 최대 3개 초과, 일반적으론 하루 1개 근무만 가능)
  const driverWorkCount = await db.all(`
    SELECT date, driver_id, COUNT(*) as cnt
    FROM schedules
    WHERE date BETWEEN ? AND ? AND driver_id IS NOT NULL
    GROUP BY date, driver_id
  `, [startDate, endDate]);

  for (const dw of driverWorkCount) {
    const driver = await db.get('SELECT name FROM drivers WHERE id = ?', [dw.driver_id]);
    
    if (dw.cnt > 1) {
      const shifts = await db.all(
        'SELECT shift_type FROM schedules WHERE date = ? AND driver_id = ?',
        [dw.date, dw.driver_id]
      );
      const hasTriple = shifts.some(s => s.shift_type === 'triple');
      
      if (hasTriple && dw.cnt > 3) {
        errors.push({
          type: 'EXCESSIVE_TRIPLE_SHIFT',
          message: `기사 ${driver?.name || dw.driver_id}가 ${dw.date}에 3탕 기준(최대 3개)을 초과한 ${dw.cnt}개 근무에 배정되었습니다.`,
          details: dw
        });
      } else if (!hasTriple && dw.cnt > 1) {
        errors.push({
          type: 'DUPLICATE_DRIVER_WORK',
          message: `기사 ${driver?.name || dw.driver_id}가 ${dw.date}에 중복 근무(${dw.cnt}회) 배정되었습니다.`,
          details: dw
        });
      }
    }
  }

  // 3. 휴무 신청이 승인된 기사가 해당 날짜에 배정되었는지 검증
  const leaveViolations = await db.all(`
    SELECT s.id as schedule_id, s.date, s.driver_id, s.shift_type, l.id as leave_id
    FROM schedules s
    JOIN leave_requests l ON s.driver_id = l.driver_id
    WHERE s.date BETWEEN ? AND ?
      AND l.status = 'approved'
      AND s.date BETWEEN l.start_date AND l.end_date
  `, [startDate, endDate]);

  for (const lv of leaveViolations) {
    const driver = await db.get('SELECT name FROM drivers WHERE id = ?', [lv.driver_id]);
    errors.push({
      type: 'LEAVE_VIOLATION',
      message: `휴무 승인된 기사 ${driver?.name || lv.driver_id}가 ${lv.date} ${lv.shift_type} 근무에 배정되어 있습니다.`,
      details: lv
    });
  }

  // 4. 퇴직(retired) 기사 배정 여부 검증
  const retiredViolations = await db.all(`
    SELECT s.id as schedule_id, s.date, s.driver_id, s.shift_type
    FROM schedules s
    JOIN drivers d ON s.driver_id = d.id
    WHERE s.date BETWEEN ? AND ?
      AND d.status = 'retired'
  `, [startDate, endDate]);

  for (const rv of retiredViolations) {
    const driver = await db.get('SELECT name FROM drivers WHERE id = ?', [rv.driver_id]);
    errors.push({
      type: 'RETIRED_DRIVER_VIOLATION',
      message: `퇴직한 기사 ${driver?.name || rv.driver_id}가 ${rv.date} ${rv.shift_type} 근무에 배정되어 있습니다.`,
      details: rv
    });
  }

  // 5. 정비(maintenance) 중인 차량 배정 여부 검증
  const maintenanceViolations = await db.all(`
    SELECT s.id as schedule_id, s.date, s.vehicle_id, s.shift_type
    FROM schedules s
    JOIN vehicles v ON s.vehicle_id = v.id
    WHERE s.date BETWEEN ? AND ?
      AND v.status = 'maintenance'
  `, [startDate, endDate]);

  for (const mv of maintenanceViolations) {
    const vehicle = await db.get('SELECT vehicle_number FROM vehicles WHERE id = ?', [mv.vehicle_id]);
    errors.push({
      type: 'MAINTENANCE_VEHICLE_VIOLATION',
      message: `정비(maintenance) 중인 차량 ${vehicle?.vehicle_number || mv.vehicle_id}가 ${mv.date} ${mv.shift_type} 근무에 배정되어 있습니다.`,
      details: mv
    });
  }

  return errors;
}
