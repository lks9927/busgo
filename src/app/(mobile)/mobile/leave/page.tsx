'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMobileAuth } from '../layout';

interface LeaveRequest {
  id: number;
  request_type: 'annual' | 'monthly' | 'sick' | 'substitute';
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
}

export default function DriverLeavePage() {
  const { driver } = useMobileAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Month selector for the calendar
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  // Form states
  const [requestType, setRequestType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Fetch approved/pending leaves
  const fetchMyLeaves = async () => {
    if (!driver) return;
    const driverId = driver.id;
    try {
      const res = await fetch(`/api/leaves?driver_id=${driverId}`);
      if (!res.ok) throw new Error('휴무 신청 내역을 가져오는데 실패했습니다.');
      const data = await res.json();
      setRequests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch driver schedule for the selected month
  const fetchMySchedule = async () => {
    if (!driver || !selectedMonth) return;
    const driverId = driver.id;
    try {
      const res = await fetch(`/api/dispatch/driver/${driverId}?month=${selectedMonth}`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (e) {
      console.error('Failed to fetch schedules for leave page:', e);
    }
  };

  useEffect(() => {
    fetchMyLeaves();
  }, [driver]);

  useEffect(() => {
    fetchMySchedule();
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

  // Schedule Map
  const scheduleMap = useMemo(() => {
    const map = new Map<string, any>();
    schedules.forEach((s) => {
      map.set(s.date, s);
    });
    return map;
  }, [schedules]);

  // Leave Requests Map (mapped to daily status)
  const leaveStateMap = useMemo(() => {
    const map = new Map<string, { status: string; type: string }>();
    requests.forEach((r) => {
      let curr = new Date(r.start_date);
      const end = new Date(r.end_date);
      while (curr <= end) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        map.set(dateStr, { status: r.status, type: r.request_type });
        curr.setDate(curr.getDate() + 1);
      }
    });
    return map;
  }, [requests]);

  // Handle date cell click (range selector)
  const handleDateClick = (dateStr: string) => {
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().substring(0, 10);
    if (dateStr < todayStr) {
      alert('오늘 이전의 날짜로는 신청할 수 없습니다.');
      return;
    }

    if (!startDate || (startDate && endDate && startDate !== endDate)) {
      // Nothing selected, or full range is already set: start a new selection
      setStartDate(dateStr);
      setEndDate(dateStr);
    } else {
      // One date (startDate) is selected: complete range
      if (dateStr < startDate) {
        // If clicked date is before startDate, reset start date
        setStartDate(dateStr);
        setEndDate(dateStr);
      } else {
        setEndDate(dateStr);
      }
    }
  };

  // Check if a date is within currently selected range
  const isSelectedDate = (dateStr: string) => {
    if (!startDate || !endDate) return false;
    return dateStr >= startDate && dateStr <= endDate;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver || !startDate || !endDate) return;

    setSubmitting(true);
    setMessage(null);

    // Basic date validation
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().substring(0, 10);
    if (startDate < todayStr) {
      setMessage({ type: 'error', text: '오늘 이전의 날짜로는 신청할 수 없습니다.' });
      setSubmitting(false);
      return;
    }
    if (endDate < startDate) {
      setMessage({ type: 'error', text: '종료일은 시작일보다 빠를 수 없습니다.' });
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driver.id,
          request_type: requestType,
          start_date: startDate,
          end_date: endDate,
          reason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '휴무 신청 실패');
      }

      setMessage({ type: 'success', text: '휴무 신청이 성공적으로 등록되었습니다. 관리자 승인을 기다려주세요.' });
      
      // Reset form
      setStartDate('');
      setEndDate('');
      setReason('');
      
      // Reload history & schedules
      fetchMyLeaves();
      fetchMySchedule();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl font-bold text-gray-900">휴무 / 연차 신청</h2>
        <p className="text-gray-500 text-[11px] mt-0.5">달력에서 운행 정보와 휴무 신청일을 확인하며 신청할 수 있습니다.</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span>{message.text}</span>
        </div>
      )}

      {/* Dynamic Interactive Calendar Card */}
      <div className="bg-white border border-gray-200 rounded-3xl p-4.5 space-y-4.5 shadow-sm">
        <div className="flex justify-between items-center">
          <span className="text-xs font-extrabold text-gray-800">📅 나의 일정 달력</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl bg-white border border-gray-200 text-gray-900 px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500/30 outline-none transition"
          />
        </div>

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
            const leave = leaveStateMap.get(cell.dateStr);
            const isSelected = isSelectedDate(cell.dateStr);

            // Determine background style and badge text
            let cellBg = 'bg-gray-50/50 border border-gray-100/30';
            let badge = null;

            if (isSelected) {
              cellBg = 'bg-blue-600 text-white border-2 border-blue-700 shadow-sm scale-[1.02]';
              badge = <span className="text-[7.5px] font-black text-white">선택됨</span>;
            } else if (leave) {
              if (leave.status === 'approved') {
                cellBg = 'bg-emerald-50 border border-emerald-200';
                badge = <span className="text-[7.5px] font-bold text-emerald-600">휴가 승인</span>;
              } else if (leave.status === 'rejected') {
                cellBg = 'bg-red-50 border border-red-200';
                badge = <span className="text-[7.5px] font-bold text-red-600">반려됨</span>;
              } else {
                cellBg = 'bg-amber-50 border border-amber-200';
                badge = <span className="text-[7.5px] font-bold text-amber-600">대기 중</span>;
              }
            } else if (sched) {
              if (sched.shift_type === 'morning') {
                cellBg = 'bg-blue-50/70 border border-blue-100/60';
                badge = <span className="text-[8px] font-medium text-blue-500">오전</span>;
              } else if (sched.shift_type === 'afternoon') {
                cellBg = 'bg-orange-50/70 border border-orange-100/60';
                badge = <span className="text-[8px] font-medium text-orange-500">오후</span>;
              } else if (sched.shift_type === 'triple') {
                cellBg = 'bg-red-50/70 border border-red-100/60';
                badge = <span className="text-[8px] font-medium text-red-500">3탕</span>;
              }
            } else {
              cellBg = 'bg-green-50/40 border border-green-100/40';
              badge = <span className="text-[8px] font-semibold text-green-600">휴무</span>;
            }

            return (
              <div
                key={cell.dateStr}
                onClick={() => handleDateClick(cell.dateStr)}
                className={`aspect-square rounded-xl p-1 flex flex-col justify-between cursor-pointer transition-all ${cellBg}`}
              >
                <span
                  className={`text-[10px] font-bold block leading-none ${
                    isSelected
                      ? 'text-white'
                      : cell.isWeekend
                      ? cell.dayName === '일'
                        ? 'text-red-500'
                        : 'text-blue-500'
                      : 'text-gray-700'
                  }`}
                >
                  {cell.dayNum}
                </span>

                <div className="flex justify-center pb-0.5">{badge}</div>
              </div>
            );
          })}
        </div>

        <div className="text-[10px] text-gray-400 leading-normal flex flex-wrap gap-x-3 gap-y-1 justify-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
          <div className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span><span>오전/오후 근무</span></div>
          <div className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span><span>지정 휴무일</span></div>
          <div className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span>승인 완료 휴가</span></div>
          <div className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span><span>대기 중인 휴가</span></div>
          <div className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span><span>신청 지정일</span></div>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
        {/* Request Type */}
        <div className="flex flex-col space-y-1.5">
          <label className="text-xs font-semibold text-gray-500">휴무 구분</label>
          <select
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
            className="w-full rounded-xl bg-white border border-gray-200 text-gray-950 p-3.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
          >
            <option value="annual">연차 휴무 (Annual)</option>
            <option value="monthly">월차 휴무 (Monthly)</option>
            <option value="sick">병가 휴직 (Sick)</option>
            <option value="substitute">대체 휴무 (Substitute)</option>
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">시작일</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl bg-white border border-gray-200 text-gray-950 p-3 text-xs focus:ring-2 focus:ring-blue-500/30 outline-none transition"
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">종료일</label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl bg-white border border-gray-200 text-gray-950 p-3 text-xs focus:ring-2 focus:ring-blue-500/30 outline-none transition"
            />
          </div>
        </div>

        {/* Reason */}
        <div className="flex flex-col space-y-1.5">
          <label className="text-xs font-semibold text-gray-500">신청 사유</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="사유를 입력해 주세요 (예: 병원 진료)"
            className="w-full rounded-xl bg-white border border-gray-200 text-gray-950 p-3 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none h-20 resize-none transition"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-sm disabled:opacity-50"
        >
          {submitting ? '신청 등록 중...' : '휴무 신청 제출'}
        </button>
      </form>

      {/* History Card */}
      <div className="space-y-3">
        <h3 className="text-sm font-extrabold text-gray-900 px-1">📝 신청 내역 및 결과</h3>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : requests.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6 bg-white border border-gray-200 rounded-2xl shadow-xs font-medium">
            신청한 휴무 내역이 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 p-4 rounded-2xl space-y-2.5 shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="px-2.5 py-0.5 bg-gray-100 border border-gray-200 text-[10px] text-gray-600 rounded-full font-bold uppercase">
                    {r.request_type === 'annual'
                      ? '연차'
                      : r.request_type === 'monthly'
                      ? '월차'
                      : r.request_type === 'sick'
                      ? '병가'
                      : '대체'}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      r.status === 'approved'
                        ? 'bg-green-50 text-green-600 border-green-100'
                        : r.status === 'rejected'
                        ? 'bg-red-50 text-red-600 border-red-100'
                        : 'bg-orange-50 text-orange-600 border-orange-100'
                    }`}
                  >
                    {r.status === 'approved' ? '승인 완료' : r.status === 'rejected' ? '반려됨' : '심사 중'}
                  </span>
                </div>
                <div className="text-xs text-gray-800 font-bold">
                  기간: {r.start_date} ~ {r.end_date}
                </div>
                {r.reason && <p className="text-[11px] text-gray-500 font-medium">사유: {r.reason}</p>}
                <div className="text-[9px] text-gray-400 text-right font-medium">
                  신청일: {new Date(r.requested_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
