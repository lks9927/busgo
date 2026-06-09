export type RotationMode = 'weekly' | 'biweekly' | 'monthly' | 'custom' | 'fixed';

export interface RotationConfig {
  mode: RotationMode;
  customWeeks?: number;
}

export const KOREAN_DAYS = ['월', '화', '수', '목', '금', '토', '일'];

export function parseKoreanDay(dayStr: string): number {
  const idx = KOREAN_DAYS.indexOf(dayStr.trim());
  if (idx === -1) throw new Error(`Invalid Korean day: ${dayStr}`);
  return idx;
}

export function formatKoreanDay(dayIndex: number): string {
  return KOREAN_DAYS[dayIndex % 7];
}

// 특정 날짜의 요일 구하기 (0=월 ~ 6=일)
export function getDayOfWeekIndex(dateStr: string): number {
  const d = new Date(dateStr);
  const jsDay = d.getDay(); // 0=일요일, 1=월요일, ..., 6=토요일
  return jsDay === 0 ? 6 : jsDay - 1;
}

// 특정 날짜가 속한 주의 월요일 구하기 (날짜 문자열 기준)
export function getMonday(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getDay();
  // 일요일(0)이면 -6일, 그 외에는 1-day일 만큼 조정하여 월요일로 만듦
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// 두 날짜 사이의 주차 차이 계산
export function getWeeksBetween(dateStrStart: string, dateStrTarget: string): number {
  const mondayStart = getMonday(dateStrStart);
  const mondayTarget = getMonday(dateStrTarget);
  const diffTime = mondayTarget.getTime() - mondayStart.getTime();
  return Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));
}

// 쉬프트 요일 순환 계산
export function getShiftDayOff(
  baseDay: number,          // 기준 시작 요일 (0=월 ~ 6=일)
  startDate: string,        // 기준 시작 날짜 (형식: 'YYYY-MM-DD')
  targetDate: string,       // 대상 날짜 (형식: 'YYYY-MM-DD')
  config: RotationConfig
): number {
  if (config.mode === 'fixed') {
    return baseDay;
  }

  const weekIndex = getWeeksBetween(startDate, targetDate);

  if (config.mode === 'weekly') {
    return (baseDay + weekIndex) % 7;
  }

  if (config.mode === 'biweekly') {
    return (baseDay + Math.floor(weekIndex / 2)) % 7;
  }

  if (config.mode === 'custom') {
    const customWeeks = config.customWeeks || 1;
    return (baseDay + Math.floor(weekIndex / customWeeks)) % 7;
  }

  if (config.mode === 'monthly') {
    const start = new Date(startDate);
    const target = new Date(targetDate);
    const monthIndex = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
    return (baseDay + monthIndex) % 7;
  }

  return baseDay;
}

// 해당 날짜에 오전/오후 교대 여부 결정 (2인 1차 교대제, 주간 단위)
// 주가 홀수 주이면 교대 상태 반전
export function getShiftTypeForDriver(
  isPartnerAMFirst: boolean, // 기준일에 해당 기사(또는 파트너)가 오전 시작이었는지 여부
  startDate: string,
  targetDate: string
): 'morning' | 'afternoon' {
  const weekIndex = getWeeksBetween(startDate, targetDate);
  const isSwapped = weekIndex % 2 !== 0;

  if (isPartnerAMFirst) {
    return isSwapped ? 'afternoon' : 'morning';
  } else {
    return isSwapped ? 'morning' : 'afternoon';
  }
}

// 2025-01-01 이후 일요일 개수 계산 (로테이션 감차용)
export function getSundayIndex(dateStr: string): number {
  let count = 0;
  const base = new Date('2025-01-01');
  const target = new Date(dateStr);
  for (let d = new Date(base); d < target; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) count++;
  }
  return count;
}

// 2025-01-01 이후 주말(토/일) 개수 계산 (72번 로테이션 감차용)
export function getWeekendDayIndex(dateStr: string): number {
  let count = 0;
  const base = new Date('2025-01-01');
  const target = new Date(dateStr);
  for (let d = new Date(base); d < target; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 0 || day === 6) count++;
  }
  return count;
}
