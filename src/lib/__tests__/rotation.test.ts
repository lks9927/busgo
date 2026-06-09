import { describe, it, expect } from 'vitest';
import { 
  parseKoreanDay, 
  formatKoreanDay, 
  getDayOfWeekIndex, 
  getWeeksBetween, 
  getShiftDayOff, 
  getShiftTypeForDriver 
} from '../rotation';

describe('Rotation and AM/PM Swap Calculations Tests', () => {
  it('should parse and format Korean day names correctly', () => {
    expect(parseKoreanDay('월')).toBe(0);
    expect(parseKoreanDay('토')).toBe(5);
    expect(parseKoreanDay('일')).toBe(6);
    expect(formatKoreanDay(0)).toBe('월');
    expect(formatKoreanDay(6)).toBe('일');
    expect(formatKoreanDay(7)).toBe('월'); // modulo check
  });

  it('should compute day of week index correctly (0=Mon, 6=Sun)', () => {
    expect(getDayOfWeekIndex('2026-06-08')).toBe(0); // Monday
    expect(getDayOfWeekIndex('2026-06-13')).toBe(5); // Saturday
    expect(getDayOfWeekIndex('2026-06-14')).toBe(6); // Sunday
  });

  it('should compute weeks between dates correctly', () => {
    expect(getWeeksBetween('2026-06-08', '2026-06-08')).toBe(0);
    expect(getWeeksBetween('2026-06-08', '2026-06-14')).toBe(0); // same week (Mon to Sun)
    expect(getWeeksBetween('2026-06-08', '2026-06-15')).toBe(1); // next Monday
    expect(getWeeksBetween('2026-06-08', '2026-07-27')).toBe(7); // 7 weeks later
  });

  it('should compute shift day off under different rotation modes', () => {
    const baseDay = 0; // Monday
    const startDate = '2026-06-08';

    // fixed mode: no change
    expect(getShiftDayOff(baseDay, startDate, '2026-06-15', { mode: 'fixed' })).toBe(baseDay);
    expect(getShiftDayOff(baseDay, startDate, '2026-07-27', { mode: 'fixed' })).toBe(baseDay);

    // weekly mode: +1 day per week
    expect(getShiftDayOff(baseDay, startDate, '2026-06-08', { mode: 'weekly' })).toBe(0); // Week 0 -> Mon
    expect(getShiftDayOff(baseDay, startDate, '2026-06-15', { mode: 'weekly' })).toBe(1); // Week 1 -> Tue
    expect(getShiftDayOff(baseDay, startDate, '2026-07-27', { mode: 'weekly' })).toBe(0); // Week 7 -> Mon (7 % 7 = 0)

    // biweekly mode: +1 day every 2 weeks
    expect(getShiftDayOff(baseDay, startDate, '2026-06-08', { mode: 'biweekly' })).toBe(0); // Week 0 -> Mon
    expect(getShiftDayOff(baseDay, startDate, '2026-06-15', { mode: 'biweekly' })).toBe(0); // Week 1 -> Mon
    expect(getShiftDayOff(baseDay, startDate, '2026-06-22', { mode: 'biweekly' })).toBe(1); // Week 2 -> Tue
    expect(getShiftDayOff(baseDay, startDate, '2026-07-06', { mode: 'biweekly' })).toBe(2); // Week 4 -> Wed

    // monthly mode: +1 day every calendar month
    expect(getShiftDayOff(baseDay, startDate, '2026-06-30', { mode: 'monthly' })).toBe(0); // same month (June) -> Mon
    expect(getShiftDayOff(baseDay, startDate, '2026-07-01', { mode: 'monthly' })).toBe(1); // next month (July) -> Tue
    expect(getShiftDayOff(baseDay, startDate, '2026-08-15', { mode: 'monthly' })).toBe(2); // August -> Wed
  });

  it('should swap AM/PM shift type weekly', () => {
    const startDate = '2026-06-08';

    // A is AM first
    expect(getShiftTypeForDriver(true, startDate, '2026-06-08')).toBe('morning'); // Week 0
    expect(getShiftTypeForDriver(true, startDate, '2026-06-14')).toBe('morning'); // Week 0 Sunday
    expect(getShiftTypeForDriver(true, startDate, '2026-06-15')).toBe('afternoon'); // Week 1 Monday (swapped)
    expect(getShiftTypeForDriver(true, startDate, '2026-06-22')).toBe('morning'); // Week 2 Monday (swapped back)

    // B is PM first (not AM first)
    expect(getShiftTypeForDriver(false, startDate, '2026-06-08')).toBe('afternoon'); // Week 0
    expect(getShiftTypeForDriver(false, startDate, '2026-06-15')).toBe('morning'); // Week 1
  });
});
