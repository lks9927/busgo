'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMobileAuth } from '../layout';

interface Schedule {
  id: number;
  date: string;
  route: string;
  vehicle_id: number;
  shift_type: 'morning' | 'afternoon' | 'triple';
  driver_id: number;
  sequence: number;
  is_substitute: number;
  original_driver_id: number | null;
  status: string;
  vehicle_number: string;
  driver_name: string | null;
  original_driver_name: string | null;
}

export default function DriverMonthlySchedule() {
  const { driver } = useMobileAuth();
  const [selectedMonth, setSelectedMonth] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date();
    setSelectedMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  useEffect(() => {
    if (!driver || !selectedMonth) return;
    const driverId = driver.id;

    async function fetchSchedules() {
      try {
        setLoading(true);
        const res = await fetch(`/api/dispatch/driver/${driverId}?month=${selectedMonth}`);
        if (!res.ok) throw new Error('스케줄을 불러오지 못했습니다.');
        const data = await res.json();
        setSchedules(data);
        
        // Auto select the first day of the month or today if in month
        const [year, month] = selectedMonth.split('-').map(Number);
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;

        const defaultDayStr = isCurrentMonth ? todayStr : `${year}-${String(month).padStart(2, '0')}-01`;
        setSelectedDayStr(defaultDayStr);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    fetchSchedules();
  }, [driver, selectedMonth]);

  // Compute calendar grid cells (including padding)
  const calendarCells = useMemo(() => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    
    const firstDay = new Date(year, month - 1, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon, ...
    
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();
    
    const cells = [];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    
    // Pad previous month's empty cells
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(null);
    }
    
    // Add current month's days
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month - 1, d);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dayStr = `${yyyy}-${mm}-${dd}`;
      
      cells.push({
        dateStr: dayStr,
        dayNum: d,
        dayName: dayNames[date.getDay()],
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      });
    }
    
    return cells;
  }, [selectedMonth]);

  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule>();
    schedules.forEach((s) => {
      map.set(s.date, s);
    });
    return map;
  }, [schedules]);

  // Selected Date Details
  const selectedDetails = useMemo(() => {
    if (!selectedDayStr) return null;
    return scheduleMap.get(selectedDayStr) || null;
  }, [selectedDayStr, scheduleMap]);

  // Stats summaries
  const summary = useMemo(() => {
    const totalWork = schedules.length;
    const weekendWork = schedules.filter((s) => {
      const d = new Date(s.date);
      return d.getDay() === 0 || d.getDay() === 6;
    }).length;
    return { totalWork, weekendWork };
  }, [schedules]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Month Control */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">월간 운행 캘린더</h2>
          <p className="text-gray-500 text-[11px] mt-0.5">달력을 눌러 일자별 상세 운행 정보를 확인합니다.</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-xl bg-white border border-gray-200 text-gray-900 px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500/30 outline-none transition"
        />
      </div>

      {/* Summary stats */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 grid grid-cols-2 gap-4 text-center shadow-sm">
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
          <span className="text-[10px] text-gray-400 block font-medium">이달의 총 근무일수</span>
          <span className="text-lg font-black text-gray-800 mt-1 block">{summary.totalWork}일</span>
        </div>
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
          <span className="text-[10px] text-gray-400 block font-medium">주말 근무일수</span>
          <span className="text-lg font-black text-orange-500 mt-1 block">{summary.weekendWork}일</span>
        </div>
      </div>

      {/* 7x5 or 7x6 Wall Calendar Grid */}
      <div className="bg-white border border-gray-200 rounded-3xl p-4 space-y-3 shadow-sm">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          <div className="text-red-500">일</div>
          <div>월</div>
          <div>화</div>
          <div>수</div>
          <div>목</div>
          <div>금</div>
          <div className="text-blue-500">토</div>
        </div>

        {/* Date cells grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="aspect-square bg-transparent"></div>;
            }

            const sched = scheduleMap.get(cell.dateStr);
            const isSelected = selectedDayStr === cell.dateStr;

            // Shift cell theme/colors
            let cellBg = 'bg-gray-50/50 border border-gray-100/30';
            let shiftBadge = null;

            if (sched) {
              if (sched.shift_type === 'morning') {
                cellBg = isSelected ? 'bg-blue-100 border border-blue-500' : 'bg-blue-50/80 border border-blue-100';
                shiftBadge = <span className="text-[8px] font-bold text-blue-500">오전</span>;
              } else if (sched.shift_type === 'afternoon') {
                cellBg = isSelected ? 'bg-orange-100 border border-orange-500' : 'bg-orange-50/80 border border-orange-100';
                shiftBadge = <span className="text-[8px] font-bold text-orange-500">오후</span>;
              } else if (sched.shift_type === 'triple') {
                cellBg = isSelected ? 'bg-red-100 border border-red-500' : 'bg-red-50/80 border border-red-100';
                shiftBadge = <span className="text-[8px] font-bold text-red-500">3탕</span>;
              }
            } else {
              cellBg = isSelected ? 'bg-green-100 border border-green-500' : 'bg-green-50/60 border border-green-100/50';
              shiftBadge = <span className="text-[8px] font-semibold text-green-600">휴무</span>;
            }

            return (
              <div
                key={cell.dateStr}
                onClick={() => setSelectedDayStr(cell.dateStr)}
                className={`aspect-square rounded-xl p-1 flex flex-col justify-between cursor-pointer transition-all ${cellBg}`}
              >
                {/* Day Number */}
                <span
                  className={`text-[11px] font-bold block leading-none ${
                    cell.isWeekend
                      ? cell.dayName === '일'
                        ? 'text-red-500'
                        : 'text-blue-500'
                      : 'text-gray-700'
                  }`}
                >
                  {cell.dayNum}
                </span>

                {/* Shift Badge */}
                <div className="flex justify-center pb-0.5">{shiftBadge}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details Panel */}
      {selectedDayStr && (
        <div className="bg-white border border-gray-200 rounded-3xl p-5 space-y-4 animate-in slide-in-from-bottom-5 duration-200 shadow-lg">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">선택한 날짜 상세 일정</span>
            <span className="text-sm font-bold text-gray-900">
              {(() => {
                const [y, m, d] = selectedDayStr.split('-');
                const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][new Date(Number(y), Number(m) - 1, Number(d)).getDay()];
                return `${Number(m)}월 ${Number(d)}일 (${dayOfWeek}요일)`;
              })()}
            </span>
          </div>

          {selectedDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold block">배정 노선 / 차량</span>
                  <span className="text-sm font-bold text-gray-900">
                    {selectedDetails.route} / {selectedDetails.vehicle_number}호차
                  </span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold block">출발 번호 / 구분</span>
                  <span className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                    <span>{selectedDetails.sequence}번 출발</span>
                    {selectedDetails.is_substitute === 1 && (
                      <span className="px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 text-[8px] rounded-full font-bold uppercase">
                        대타
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-gray-400 font-bold block">쉬프트 유형 및 시간</span>
                  <span className="text-sm font-bold text-gray-900">
                    {selectedDetails.shift_type === 'morning'
                      ? '오전 근무 (AM Shift)'
                      : selectedDetails.shift_type === 'afternoon'
                      ? '오후 근무 (PM Shift)'
                      : '3탕 운행 (Triple Shift)'}
                  </span>
                </div>
                <span
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold border flex-shrink-0 whitespace-nowrap ${
                    selectedDetails.shift_type === 'morning'
                      ? 'bg-blue-50 border-blue-100 text-blue-600'
                      : selectedDetails.shift_type === 'afternoon'
                      ? 'bg-orange-50 border-orange-100 text-orange-600'
                      : 'bg-red-50 border-red-100 text-red-600'
                  }`}
                >
                  {selectedDetails.shift_type === 'morning' ? 'AM 05:00' : 'PM 14:00'}
                </span>
              </div>

              {selectedDetails.is_substitute === 1 && selectedDetails.original_driver_name && (
                <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl text-[10px] text-red-700 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  <span>
                    본 스케줄은 휴무 기사를 대체하여 투입된 <strong>대타 운행</strong>입니다. (원래 담당: {selectedDetails.original_driver_name} 기사)
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center space-y-2">
              <span className="text-2xl font-bold text-green-600 block">🟢 휴무일</span>
              <p className="text-xs text-gray-400">지정된 운행 배차가 없는 편안한 휴일입니다.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
