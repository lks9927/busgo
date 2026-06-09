'use client';

import React, { useState, useEffect, useMemo, Fragment } from 'react';

interface Vehicle {
  id: number;
  vehicle_number: string;
  route: string;
  rotation_order: number | null;
  status: string;
}

interface Driver {
  id: number;
  name: string;
  employee_id: string;
  primary_route: string;
  driver_type: 'fixed' | 'rotating';
  status: string;
}

interface Dispatch {
  id: number;
  route: string;
  date: string;
  shift_type: string; // '오전' | '오후'
  sequence: number | null;
  vehicle_number: string;
  driver_name: string;
  departure_time: string | null;
  sub_route: string | null;
  isResting?: boolean; // Client-side flag for resting vehicles
}

interface RouteItem {
  id: number;
  route_number: string;
}

const PUBLIC_HOLIDAYS = [
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-01', '2025-05-05',
  '2025-06-06', '2025-08-15', '2025-10-03', '2025-10-09', '2025-12-25',
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-01', '2026-05-05',
  '2026-06-06', '2026-08-15', '2026-10-03', '2026-10-09', '2026-12-25'
];

export default function DispatchPage() {
  const [selectedRoute, setSelectedRoute] = useState('138번');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // Default to a month that has data (e.g. 2025-05) if today has no data,
    // but here we default to the current year/month.
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return today.toISOString().substring(0, 7);
  });
  const [selectedShift, setSelectedShift] = useState<'오전' | '오후'>('오전');
  
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals / Edits
  const [editingCell, setEditingCell] = useState<Dispatch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [routesList, setRoutesList] = useState<RouteItem[]>([]);

  // Driver search states for manual edit
  const [driverSearch, setDriverSearch] = useState('');
  const [isOpenDriverDropdown, setIsOpenDriverDropdown] = useState(false);

  // Fetch all active drivers & vehicles & dispatches
  const fetchData = async () => {
    try {
      setLoading(true);
      setMessage(null);

      // Fetch vehicles on route
      const vRes = await fetch(`/api/vehicles?route=${encodeURIComponent(selectedRoute)}`);
      if (!vRes.ok) throw new Error('차량 목록을 불러오지 못했습니다.');
      const vData = await vRes.json();
      setVehicles(vData);

      // Fetch dispatches
      const sRes = await fetch(`/api/weekly-dispatch?route=${encodeURIComponent(selectedRoute)}&month=${selectedMonth}`);
      if (!sRes.ok) throw new Error('배차 일정을 불러오지 못했습니다.');
      const sData = await sRes.json();
      setDispatches(sData);

      // Fetch all active drivers to populate substitution dropdown
      const dRes = await fetch('/api/drivers?status=active');
      if (!dRes.ok) throw new Error('기사 목록을 불러오지 못했습니다.');
      const dData = await dRes.json();
      setDrivers(dData);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedRoute, selectedMonth]);

  useEffect(() => {
    fetch('/api/routes').then(r => r.ok ? r.json() : []).then((data: RouteItem[]) => {
      setRoutesList(data);
      if (data.length > 0 && !data.find(r => r.route_number === selectedRoute)) {
        setSelectedRoute(data[0].route_number);
      }
    }).catch(() => {});
  }, []);

  // Compute rotation groups of 3 vehicles and assign background colors
  const vehicleColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const colors = [
      '#e0f2fe', // 연파랑 (sky-100)
      '#dcfce7', // 연초록 (green-100)
      '#fef9c3', // 연노랑 (yellow-100)
      '#f3e8ff', // 연보라 (purple-100)
      '#ffedd5', // 연주황 (orange-100)
      '#fce7f3', // 연분홍 (pink-100)
      '#ccfbf1', // 연청록 (teal-100)
      '#e2e8f0', // 연회색 (slate-100)
    ];

    // Sort active vehicles on route by rotation_order first, then vehicle_number
    const sortedVehicles = [...vehicles].sort((a, b) => {
      if (a.rotation_order !== null && b.rotation_order !== null) {
        return a.rotation_order - b.rotation_order;
      }
      if (a.rotation_order !== null) return -1;
      if (b.rotation_order !== null) return 1;
      return a.vehicle_number.localeCompare(b.vehicle_number);
    });

    sortedVehicles.forEach((v, idx) => {
      const groupIdx = Math.floor(idx / 3) % colors.length;
      map.set(v.vehicle_number, colors[groupIdx]);
    });

    return map;
  }, [vehicles]);

  // Compute calendar dates for the month
  const daysInMonth = useMemo(() => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    const days = [];
    while (date.getMonth() === month - 1) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dayStr = `${yyyy}-${mm}-${dd}`;
      
      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
      const isHoliday = PUBLIC_HOLIDAYS.includes(dayStr);
      days.push({ 
        dayStr, 
        dayOfWeek, 
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isHoliday
      });
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [selectedMonth]);

  // Filter dispatches for the selected shift ('오전' or '오후')
  const shiftDispatches = useMemo(() => {
    return dispatches.filter((d) => d.shift_type === selectedShift);
  }, [dispatches, selectedShift]);

  // Compute maximum sequence from loaded dispatches
  const maxSeq = useMemo(() => {
    const seqs = shiftDispatches.map(d => d.sequence).filter((seq): seq is number => seq !== null);
    return seqs.length > 0 ? Math.max(...seqs) : 14; // Default to 14 if no records
  }, [shiftDispatches]);

  // Map of date -> cells array (index 1 to maxSeq)
  const dateCellsMap = useMemo(() => {
    const map = new Map<string, (Dispatch | null)[]>();
    
    daysInMonth.forEach((day) => {
      const dailyDispatches = shiftDispatches.filter(d => d.date === day.dayStr);
      const running = dailyDispatches.filter(d => d.sequence !== null);
      const resting = dailyDispatches.filter(d => d.sequence === null);

      const cells: (Dispatch | null)[] = Array(maxSeq + 1).fill(null);
      
      // Fill running dispatches in their respective sequence slots
      running.forEach(d => {
        if (d.sequence !== null && d.sequence <= maxSeq) {
          cells[d.sequence] = d;
        }
      });

      // Fill empty slots from the bottom up with resting vehicles
      let restingIdx = 0;
      for (let seq = maxSeq; seq >= 1; seq--) {
        if (cells[seq] === null && restingIdx < resting.length) {
          cells[seq] = { ...resting[restingIdx], isResting: true };
          restingIdx++;
        }
      }

      map.set(day.dayStr, cells);
    });

    return map;
  }, [daysInMonth, shiftDispatches, maxSeq]);

  // Computed driver options in editing modal
  const selectedDriver = useMemo(() => {
    if (!editingCell) return null;
    return drivers.find((d) => d.name === editingCell.driver_name) || null;
  }, [drivers, editingCell]);

  const filteredDrivers = useMemo(() => {
    const term = driverSearch.toLowerCase().trim();
    if (!term) return drivers;
    return drivers.filter((d) =>
      d.name.toLowerCase().includes(term) ||
      (d.primary_route && d.primary_route.toLowerCase().includes(term)) ||
      d.employee_id.toLowerCase().includes(term)
    );
  }, [drivers, driverSearch]);

  const routeDrivers = useMemo(() => {
    return filteredDrivers.filter((d) => d.primary_route === selectedRoute);
  }, [filteredDrivers, selectedRoute]);

  const otherDrivers = useMemo(() => {
    return filteredDrivers.filter((d) => d.primary_route !== selectedRoute);
  }, [filteredDrivers, selectedRoute]);

  // Handle auto-generation
  const handleGenerate = async () => {
    const [year, month] = selectedMonth.split('-');
    if (!confirm(`${selectedRoute} 노선의 ${year}년 ${month}월 배차를 자동으로 생성하시겠습니까? 기존에 생성된 배차 및 주말 운휴 설정이 초기화됩니다.`)) {
      return;
    }
    try {
      setGenerating(true);
      setMessage(null);
      const res = await fetch('/api/dispatch/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route: selectedRoute,
          year,
          month,
        }),
      });
      if (!res.ok) {
        let errMsg = '자동 배차 생성 실패';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `서버 응답 오류 (상태 코드: ${res.status}).`;
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      setMessage({ type: 'success', text: `자동 배차가 완료되었습니다. (생성된 주간 배차: ${data.count}건)` });
      fetchData();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setGenerating(false);
    }
  };

  // Handle cell edit save
  const handleSaveCell = async (driverName: string) => {
    if (!editingCell) return;
    try {
      setSubmitting(true);
      const targetDriverName = driverName === 'null' ? '' : driverName;

      const res = await fetch(`/api/weekly-dispatch/${editingCell.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_name: targetDriverName,
        }),
      });
      if (!res.ok) throw new Error('배차 수정에 실패했습니다.');
      
      setEditingCell(null);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in" style={{ padding: '12px 16px', fontFamily: 'system-ui, sans-serif' }}>
      {/* Premium Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
        <div className="flex items-center gap-4">
          <h1 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>월간 배차 관리 (스프레드시트)</h1>
          <span style={{ fontSize: '11px', color: '#64748b' }}>노선별 주간 순환 배차 현황을 한눈에 파악하고 조정합니다.</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              padding: '5px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              outline: 'none',
              color: '#334155',
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          />
          <button
            onClick={handleGenerate}
            disabled={generating || loading}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '6px 14px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              opacity: generating || loading ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
            }}
          >
            {generating && <div className="animate-spin rounded-full" style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }}></div>}
            자동 배차 생성
          </button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="flex items-center justify-between" style={{ marginBottom: '8px', background: '#f8fafc', padding: '6px 8px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
        {/* Route Tabs */}
        <div className="flex items-center gap-1">
          {routesList.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoute(r.route_number)}
              style={{
                fontSize: '11px',
                fontWeight: selectedRoute === r.route_number ? 700 : 500,
                padding: '5px 12px',
                borderRadius: '6px',
                border: selectedRoute === r.route_number ? '1px solid #cbd5e1' : '1px solid transparent',
                background: selectedRoute === r.route_number ? '#fff' : 'transparent',
                color: selectedRoute === r.route_number ? '#1d4ed8' : '#475569',
                cursor: 'pointer',
                boxShadow: selectedRoute === r.route_number ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {r.route_number}
            </button>
          ))}
        </div>

        {/* Shift selector tabs */}
        <div style={{ display: 'flex', background: '#e2e8f0', padding: '2px', borderRadius: '8px' }}>
          <button
            onClick={() => setSelectedShift('오전')}
            style={{
              fontSize: '11px',
              fontWeight: selectedShift === '오전' ? 700 : 500,
              padding: '4px 14px',
              borderRadius: '6px',
              border: 'none',
              background: selectedShift === '오전' ? '#fff' : 'transparent',
              color: selectedShift === '오전' ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              boxShadow: selectedShift === '오전' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            오전 근무
          </button>
          <button
            onClick={() => setSelectedShift('오후')}
            style={{
              fontSize: '11px',
              fontWeight: selectedShift === '오후' ? 700 : 500,
              padding: '4px 14px',
              borderRadius: '6px',
              border: 'none',
              background: selectedShift === '오후' ? '#fff' : 'transparent',
              color: selectedShift === '오후' ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              boxShadow: selectedShift === '오후' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            오후 근무
          </button>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#991b1b',
            fontSize: '11px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: message.type === 'success' ? '#22c55e' : '#ef4444',
            display: 'inline-block',
          }}></span>
          {message.text}
        </div>
      )}

      {/* Dense Spreadsheet Grid Container */}
      <div style={{
        flex: 1,
        minHeight: 0,
        border: '1px solid #cbd5e1',
        borderRadius: '10px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="animate-spin rounded-full" style={{ width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6' }}></div>
          </div>
        ) : dispatches.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', background: '#f8fafc' }}>
            <svg style={{ width: 44, height: 44, color: '#94a3b8' }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
            </svg>
            <div style={{ marginTop: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>생성된 배차가 없습니다</h3>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>우측 상단의 &quot;자동 배차 생성&quot; 버튼을 클릭하여 새로운 배차표를 작성할 수 있습니다.</p>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{
              width: 'max-content',
              borderCollapse: 'separate',
              borderSpacing: 0,
              fontSize: '11px',
              tableLayout: 'fixed',
            }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                {/* Date Columns Header Row */}
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{
                    width: '60px',
                    minWidth: '60px',
                    padding: '8px 4px',
                    textAlign: 'center',
                    borderRight: '2px solid #cbd5e1',
                    borderBottom: '2px solid #cbd5e1',
                    background: '#e2e8f0',
                    position: 'sticky',
                    left: 0,
                    zIndex: 30,
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#475569',
                  }}>
                    순번
                  </th>
                  {daysInMonth.map((day) => {
                    const isSunOrHoliday = day.dayOfWeek === '일' || day.isHoliday;
                    const isSat = day.dayOfWeek === '토';
                    
                    let headerBg = '#f8fafc';
                    let headerFg = '#1e293b';
                    if (isSunOrHoliday) {
                      headerBg = '#fee2e2'; // Light red
                      headerFg = '#ef4444'; // Red
                    } else if (isSat) {
                      headerBg = '#eff6ff'; // Light blue
                      headerFg = '#3b82f6'; // Blue
                    }

                    return (
                      <th
                        key={day.dayStr}
                        style={{
                          width: '74px',
                          minWidth: '74px',
                          padding: '4px 2px',
                          textAlign: 'center',
                          borderRight: '1px solid #cbd5e1',
                          borderBottom: '2px solid #cbd5e1',
                          background: headerBg,
                          color: headerFg,
                          fontSize: '10px',
                          fontWeight: 800,
                          lineHeight: 1.25,
                        }}
                      >
                        <div>{day.dayStr.substring(8)}일</div>
                        <div style={{ fontSize: '9px', fontWeight: 600, opacity: 0.8 }}>({day.dayOfWeek})</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxSeq }, (_, i) => i + 1).map((seq) => {
                  return (
                    <tr
                      key={seq}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        background: '#fff',
                      }}
                    >
                      {/* Sequence Row Header */}
                      <td
                        style={{
                          width: '60px',
                          minWidth: '60px',
                          padding: '6px 4px',
                          borderRight: '2px solid #cbd5e1',
                          borderBottom: '1px solid #cbd5e1',
                          fontWeight: 800,
                          textAlign: 'center',
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          background: '#f1f5f9',
                          color: '#475569',
                          fontSize: '11px',
                        }}
                      >
                        {seq}
                      </td>

                      {/* Daily Cells for this Sequence */}
                      {daysInMonth.map((day) => {
                        const cells = dateCellsMap.get(day.dayStr);
                        const cell = cells ? cells[seq] : null;

                        const isSunOrHoliday = day.dayOfWeek === '일' || day.isHoliday;
                        const isSat = day.dayOfWeek === '토';

                        if (!cell) {
                          // Completely empty cell
                          let emptyBg = '#fff';
                          if (isSunOrHoliday) emptyBg = '#fff5f5';
                          else if (isSat) emptyBg = '#fafcff';

                          return (
                            <td
                              key={day.dayStr}
                              style={{
                                padding: '3px 4px',
                                borderRight: '1px solid #cbd5e1',
                                borderBottom: '1px solid #cbd5e1',
                                background: emptyBg,
                                textAlign: 'center',
                              }}
                            >
                              <span style={{ color: '#e2e8f0' }}>-</span>
                            </td>
                          );
                        }

                        if (cell.isResting) {
                          // Resting vehicle (운휴) cell
                          return (
                            <td
                              key={day.dayStr}
                              onClick={() => setEditingCell(cell)}
                              style={{
                                padding: '4px 3px',
                                borderRight: '1px solid #cbd5e1',
                                borderBottom: '1px solid #cbd5e1',
                                background: '#f1f5f9', // slate-100
                                color: '#64748b',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'background-color 0.1s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                              title={`${cell.vehicle_number} 차량 운휴`}
                            >
                              <div style={{ fontWeight: 800, color: '#64748b', fontSize: '11px' }}>{cell.vehicle_number}</div>
                              <div style={{ fontSize: '9px', fontWeight: 600, color: '#ef4444', marginTop: '1px' }}>운휴</div>
                            </td>
                          );
                        }

                        // Regular running dispatch cell
                        const cellColor = vehicleColorMap.get(cell.vehicle_number) || '#ffffff';

                        return (
                          <td
                            key={day.dayStr}
                            onClick={() => setEditingCell(cell)}
                            style={{
                              padding: '3px 2px',
                              borderRight: '1px solid #cbd5e1',
                              borderBottom: '1px solid #cbd5e1',
                              background: cellColor,
                              cursor: 'pointer',
                              textAlign: 'center',
                              transition: 'filter 0.1s, background-color 0.1s',
                              verticalAlign: 'middle',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.96)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                            title={`차량: ${cell.vehicle_number} | 기사: ${cell.driver_name || '미배정'} | 출발시간: ${cell.departure_time || '-'}`}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', justifyContent: 'center', height: '100%' }}>
                              {/* Vehicle Number (Bold & Clear) */}
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '11px', letterSpacing: '-0.02em' }}>
                                {cell.vehicle_number}
                              </div>
                              {/* Driver Name */}
                              <div style={{ fontWeight: 700, color: cell.driver_name ? '#1e293b' : '#94a3b8', fontSize: '10px' }}>
                                {cell.driver_name || '미배정'}
                              </div>
                              {/* Departure Time (Formatted to HH:mm) */}
                              {cell.departure_time && (
                                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 500 }}>
                                  {cell.departure_time.substring(0, 5)}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Driver Edit Modal */}
      {editingCell && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-800">배차 정보 수동 변경</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">선택된 배차 레코드의 운행 담당 기사를 변경합니다.</p>
              </div>
              <button
                onClick={() => {
                  setEditingCell(null);
                  setDriverSearch('');
                  setIsOpenDriverDropdown(false);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-100 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium">일자</span>
                  <span className="text-slate-700 font-bold">{editingCell.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium">노선</span>
                  <span className="text-slate-700 font-bold">{editingCell.route}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium">차량 번호</span>
                  <span className="text-blue-600 font-bold">{editingCell.vehicle_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium">근무 / 출발</span>
                  <span className="text-slate-700 font-bold">
                    {editingCell.shift_type} {editingCell.departure_time ? `(${editingCell.departure_time.substring(0, 5)})` : ''}
                  </span>
                </div>
              </div>

              {/* Driver Select */}
              <div className="relative">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">담당 기사 지정</label>
                
                {/* Trigger Select Button */}
                <div 
                  onClick={() => setIsOpenDriverDropdown(!isOpenDriverDropdown)}
                  className="w-full rounded-xl bg-white border border-slate-200 text-slate-800 p-2.5 text-xs focus-within:ring-2 focus-within:ring-blue-500/30 cursor-pointer flex justify-between items-center transition-all hover:border-slate-300"
                >
                  <span className={editingCell.driver_name ? 'text-slate-800 font-bold' : 'text-slate-400'}>
                    {editingCell.driver_name 
                      ? `${editingCell.driver_name} (${selectedDriver?.primary_route || '무소속'} - ${selectedDriver?.employee_id || '정보없음'})` 
                      : '미배정'}
                  </span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>

                {/* Dropdown Panel */}
                {isOpenDriverDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setIsOpenDriverDropdown(false)} 
                    />
                    <div className="absolute top-[100%] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-2 space-y-1.5 flex flex-col max-h-60">
                      <input
                        type="text"
                        autoFocus
                        placeholder="기사 이름, 소속 노선, 사번 검색..."
                        value={driverSearch}
                        onChange={(e) => setDriverSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none transition-all"
                      />
                      
                      <div className="overflow-y-auto flex-1 divide-y divide-slate-100 max-h-40">
                        {/* Unassign Option */}
                        <button
                          type="button"
                          onClick={() => {
                            handleSaveCell('null');
                            setIsOpenDriverDropdown(false);
                            setDriverSearch('');
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-slate-50 text-slate-400 italic transition-colors font-medium"
                        >
                          미배정
                        </button>
                        
                        {/* Route Drivers */}
                        {routeDrivers.length > 0 && (
                          <div className="bg-slate-50/30">
                            <div className="px-2.5 py-0.5 text-[8px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                              {selectedRoute} 소속 기사
                            </div>
                            {routeDrivers.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  handleSaveCell(d.name);
                                  setIsOpenDriverDropdown(false);
                                  setDriverSearch('');
                                }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 rounded-lg transition-colors flex justify-between items-center ${
                                  editingCell.driver_name === d.name ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600'
                                }`}
                              >
                                <span>{d.name} ({d.driver_type === 'rotating' ? '순환' : '고정'})</span>
                                <span className="text-[9px] text-slate-400 font-mono">{d.employee_id}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Other Drivers */}
                        {otherDrivers.length > 0 && (
                          <div>
                            <div className="px-2.5 py-0.5 text-[8px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                              타노선 / 예비 기사
                            </div>
                            {otherDrivers.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  handleSaveCell(d.name);
                                  setIsOpenDriverDropdown(false);
                                  setDriverSearch('');
                                }}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 rounded-lg transition-colors flex justify-between items-center ${
                                  editingCell.driver_name === d.name ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600'
                                }`}
                              >
                                <span>{d.name} ({d.primary_route || '무소속'})</span>
                                <span className="text-[9px] text-slate-400 font-mono">{d.employee_id}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {routeDrivers.length === 0 && otherDrivers.length === 0 && (
                          <div className="text-xs text-slate-400 text-center py-4">검색 결과가 없습니다.</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end bg-slate-50">
              <button
                onClick={() => {
                  setEditingCell(null);
                  setDriverSearch('');
                  setIsOpenDriverDropdown(false);
                }}
                disabled={submitting}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all text-xs font-bold"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
