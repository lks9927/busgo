'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useMobileAuth } from './layout';

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

interface FairnessLog {
  id: number;
  driver_id: number;
  route: string;
  month: string;
  work_days: number;
  weekend_work_days: number;
  first_car_count: number;
  triple_shift_count: number;
  holiday_work_days: number;
  fairness_score: number;
}

export default function MobileHome() {
  const { driver } = useMobileAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [fairnessLog, setFairnessLog] = useState<FairnessLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekDates, setWeekDates] = useState<Array<{ date: string; day: string }>>([]);

  useEffect(() => {
    if (!driver) return;
    const driverId = driver.id;

    async function loadDriverData() {
      try {
        // Calculate dynamic week dates based on local time
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
        const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + distanceToMonday);

        const dates = [];
        const dayNames = ['월', '화', '수', '목', '금', '토', '일'];
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          dates.push({
            date: `${yyyy}-${mm}-${dd}`,
            day: dayNames[i],
          });
        }
        setWeekDates(dates);

        // Current month for fetch
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        // Fetch schedules for the current month
        const sRes = await fetch(`/api/dispatch/driver/${driverId}?month=${currentMonth}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          setSchedules(sData);
        }

        // Fetch fairness details for the driver
        const fRes = await fetch(`/api/fairness/driver/${driverId}`);
        if (fRes.ok) {
          const fData = await fRes.json();
          if (fData.logs && fData.logs.length > 0) {
            setFairnessLog(fData.logs[0]); // latest month log
          }
        }
      } catch (e) {
        console.error('Error loading mobile driver data', e);
      } finally {
        setLoading(false);
      }
    }

    loadDriverData();
  }, [driver]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Map schedules to date strings
  const scheduleByDate = new Map<string, Schedule>();
  schedules.forEach((s) => {
    scheduleByDate.set(s.date, s);
  });

  return (
    <div className="space-y-6">
      {/* Welcome banner - Bright blue Apple gradient */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-5 rounded-3xl space-y-2.5 shadow-md text-white">
        <span className="text-[10px] text-white/80 font-bold tracking-wider uppercase">포천교통 소속 기사</span>
        <h2 className="text-2xl font-extrabold text-white">
          {driver?.name} 기사님
        </h2>
        <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
          <span className="px-2.5 py-1 bg-white/15 rounded-lg text-white font-semibold border border-white/10">
            {driver?.primary_route || '무소속'}
          </span>
          <span className="px-2.5 py-1 bg-white/15 rounded-lg text-white font-semibold border border-white/10">
            {driver?.driver_type === 'fixed' ? '고정 배차' : '순환 배차'}
          </span>
          <span className="px-2.5 py-1 bg-white/15 rounded-lg text-white font-semibold border border-white/10">
            사번: {driver?.employee_id}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/mobile/leave"
          className="flex flex-col items-center justify-center p-3.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl text-center space-y-1.5 transition-all shadow-xs"
        >
          <div className="p-2.5 bg-red-50 text-red-500 rounded-xl">
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-gray-800">휴무 신청</span>
        </Link>

        <Link
          href="/mobile/stats"
          className="flex flex-col items-center justify-center p-3.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl text-center space-y-1.5 transition-all shadow-xs"
        >
          <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-gray-800">공정성 통계</span>
        </Link>

        <Link
          href="/mobile/realtime"
          className="flex flex-col items-center justify-center p-3.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl text-center space-y-1.5 transition-all shadow-xs"
        >
          <div className="p-2.5 bg-blue-50 text-blue-500 rounded-xl">
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-gray-800">운행 간격</span>
        </Link>
      </div>

      {/* Week Schedule Card List */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-extrabold text-gray-900">📅 이번 주 운행 스케줄</h3>
          <span className="text-[10px] text-gray-400 font-semibold">
            기준: {weekDates[0]?.date || '...'} ~ {weekDates[6]?.date ? weekDates[6].date.substring(5) : '...'}
          </span>
        </div>

        <div className="space-y-3">
          {weekDates.map((day) => {
            const sched = scheduleByDate.get(day.date);

            return (
              <div
                key={day.date}
                className={`border rounded-2xl p-4 flex items-center justify-between shadow-xs ${
                  sched
                    ? sched.is_substitute
                      ? 'bg-red-50 border-red-100'
                      : 'bg-white border-gray-200'
                    : 'bg-green-50/50 border-green-100/80'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  {/* Date and Day badge */}
                  <div
                    className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl font-bold text-xs ${
                      day.day === '일'
                        ? 'bg-red-50 text-red-500'
                        : day.day === '토'
                        ? 'bg-blue-50 text-blue-500'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <span>{day.date.substring(8)}</span>
                    <span className="text-[9px] font-normal">{day.day}</span>
                  </div>

                  {/* Schedule Details */}
                  {sched ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-gray-900">
                          {sched.route} / {sched.vehicle_number}호차
                        </span>
                        {sched.is_substitute === 1 && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-600 border border-red-200 text-[8px] rounded-full uppercase font-bold">
                            대타
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-medium">
                        쉬프트: {sched.shift_type === 'morning' ? '오전 근무' : sched.shift_type === 'afternoon' ? '오후 근무' : '3탕 근무'}
                        <span className="text-[10px] text-gray-400 ml-2 font-normal">({sched.sequence}번 출발)</span>
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className="text-sm font-bold text-green-600 block">🟢 지정 휴무</span>
                      <p className="text-[10px] text-gray-400">오늘은 운행 일정이 없습니다.</p>
                    </div>
                  )}
                </div>

                {/* Arrow or actions */}
                {sched && (
                  <div className="text-right text-xs flex-shrink-0 ml-2">
                    <span className={`px-2.5 py-1.5 rounded-lg font-bold border whitespace-nowrap ${
                      sched.shift_type === 'morning'
                        ? 'bg-blue-50 border-blue-100 text-blue-600'
                        : sched.shift_type === 'afternoon'
                        ? 'bg-orange-50 border-orange-100 text-orange-600'
                        : 'bg-red-50 border-red-100 text-red-600'
                    }`}>
                      {sched.shift_type === 'morning' ? 'AM 05:00' : 'PM 14:00'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fairness summary block */}
      {fairnessLog && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3.5 shadow-sm">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">나의 이달의 공정성 요약 ({fairnessLog.month})</h4>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 shadow-xs">
              <span className="text-[9px] text-gray-400 block font-medium">주말 근무</span>
              <span className="text-sm font-extrabold text-gray-800 mt-0.5 block">{fairnessLog.weekend_work_days}일</span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 shadow-xs">
              <span className="text-[9px] text-gray-400 block font-medium">첫차 배정</span>
              <span className="text-sm font-extrabold text-gray-800 mt-0.5 block">{fairnessLog.first_car_count}회</span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 shadow-xs">
              <span className="text-[9px] text-gray-400 block font-medium">3탕 근무</span>
              <span className="text-sm font-extrabold text-gray-800 mt-0.5 block">{fairnessLog.triple_shift_count}회</span>
            </div>
            <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 shadow-xs">
              <span className="text-[9px] text-gray-400 block font-medium">공정성 점수</span>
              <span className="text-sm font-extrabold text-green-600 mt-0.5 block">{fairnessLog.fairness_score.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
