'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CONDITIONS = ['일요일', '토요일', '공휴일', '주말', '토요일/일요일/공휴일', '평일'];

interface Route {
  id: number;
  route_number: string;
  route_name: string | null;
  route_group: string;
}

interface Timetable {
  id?: number;
  route: string;
  shift_type: 'morning' | 'afternoon' | 'triple';
  sequence: number;
  departure_time: string;
}

interface Shift {
  id?: number;
  route: string;
  shift_name: string;
  start_time: string;
  end_time: string;
}

interface ReductionRule {
  id?: number;
  route: string;
  condition: string;
  reduction_count: number;
}

export default function SetupOperationsPage() {
  const [activeTab, setActiveTab] = useState<'timetables' | 'shifts' | 'reductions' | 'rotation'>('timetables');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dynamic routes from API
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);

  // States for each section
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [selectedRoute, setSelectedRoute] = useState('');

  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [newTimetable, setNewTimetable] = useState<Partial<Timetable>>({
    shift_type: 'morning',
    sequence: 1,
    departure_time: '05:00',
  });

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [newShift, setNewShift] = useState<Partial<Shift>>({
    shift_name: '오전',
    start_time: '05:00',
    end_time: '14:00',
  });

  const [reductions, setReductions] = useState<ReductionRule[]>([]);
  const [newReduction, setNewReduction] = useState<Partial<ReductionRule>>({
    condition: '일요일',
    reduction_count: 1,
  });

  // Fetch routes from API on mount
  useEffect(() => {
    const fetchRoutes = async () => {
      setRoutesLoading(true);
      try {
        const res = await fetch('/api/routes');
        if (!res.ok) throw new Error('노선 목록을 불러오는데 실패했습니다.');
        const data: Route[] = await res.json();
        setRoutes(data);
        if (data.length > 0 && !selectedRoute) {
          setSelectedRoute(data[0].route_number);
        }
      } catch (e: any) {
        setMessage({ type: 'error', text: e.message });
      } finally {
        setRoutesLoading(false);
      }
    };
    fetchRoutes();
  }, []);

  // Fetch tab-specific data when selectedRoute changes
  const fetchData = async () => {
    if (!selectedRoute) return;
    setLoading(true);
    setMessage(null);
    try {
      if (activeTab === 'rotation') {
        // Rotation settings
        const settingsRes = await fetch('/api/settings');
        if (!settingsRes.ok) throw new Error('설정을 불러오는데 실패했습니다.');
        const settingsData = await settingsRes.json();
        const fullSettings: Record<string, string> = {
          rotation_mode_default: 'fixed',
          ...settingsData,
        };
        routes.forEach((route) => {
          const key = `rotation_mode_${route.route_number}`;
          if (!fullSettings[key]) {
            fullSettings[key] = fullSettings.rotation_mode_default;
          }
        });
        setSettings(fullSettings);
      } else if (activeTab === 'timetables') {
        const timetablesRes = await fetch(`/api/route-timetables?route=${selectedRoute}`);
        if (timetablesRes.ok) {
          const timetablesData = await timetablesRes.json();
          setTimetables(timetablesData);
        }
      } else if (activeTab === 'shifts') {
        const shiftsRes = await fetch(`/api/route-shifts?route=${selectedRoute}`);
        if (shiftsRes.ok) {
          const shiftsData = await shiftsRes.json();
          setShifts(shiftsData);
        }
      } else if (activeTab === 'reductions') {
        const reductionsRes = await fetch(`/api/route-reduction-rules?route=${selectedRoute}`);
        if (reductionsRes.ok) {
          const reductionsData = await reductionsRes.json();
          setReductions(reductionsData);
        }
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRoute) {
      fetchData();
    }
  }, [selectedRoute, activeTab]);

  // Actions: Save Rotation Settings
  const handleSaveRotation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('설정 저장에 실패했습니다.');
      setMessage({ type: 'success', text: '배차 순환 방식 설정이 저장되었습니다.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Actions: Timetables
  const handleAddTimetableRow = () => {
    if (!newTimetable.departure_time) return;

    const row: Timetable = {
      route: selectedRoute,
      shift_type: newTimetable.shift_type as any,
      sequence: Number(newTimetable.sequence || 1),
      departure_time: newTimetable.departure_time,
    };

    const dup = timetables.find(t => t.shift_type === row.shift_type && t.sequence === row.sequence);
    if (dup) {
      alert(`해당 쉬프트의 ${row.sequence}순번은 이미 존재합니다.`);
      return;
    }

    setTimetables(prev => [...prev, row].sort((a, b) => {
      if (a.shift_type !== b.shift_type) return a.shift_type.localeCompare(b.shift_type);
      return a.sequence - b.sequence;
    }));

    setNewTimetable(prev => ({
      ...prev,
      sequence: Number(prev.sequence || 1) + 1,
    }));
  };

  const handleDeleteTimetableRow = (index: number) => {
    setTimetables(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveTimetables = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/route-timetables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: selectedRoute, timetables }),
      });
      if (!res.ok) throw new Error('시간표 저장 실패');
      setMessage({ type: 'success', text: `${selectedRoute} 기본 시간표가 저장되었습니다.` });
      fetchData();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Actions: Shifts
  const handleAddShiftRow = () => {
    if (!newShift.shift_name || !newShift.start_time || !newShift.end_time) return;

    const row: Shift = {
      route: selectedRoute,
      shift_name: newShift.shift_name,
      start_time: newShift.start_time,
      end_time: newShift.end_time,
    };

    const dup = shifts.find(s => s.shift_name === row.shift_name);
    if (dup) {
      alert(`이미 '${row.shift_name}' 쉬프트가 설정되어 있습니다.`);
      return;
    }

    setShifts(prev => [...prev, row]);
  };

  const handleDeleteShiftRow = (index: number) => {
    setShifts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveShifts = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/route-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: selectedRoute, shifts }),
      });
      if (!res.ok) throw new Error('쉬프트 저장 실패');
      setMessage({ type: 'success', text: `${selectedRoute} 쉬프트 설정이 저장되었습니다.` });
      fetchData();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Actions: Reduction Rules
  const handleAddReductionRow = () => {
    if (!newReduction.condition || newReduction.reduction_count === undefined) return;

    const row: ReductionRule = {
      route: selectedRoute,
      condition: newReduction.condition,
      reduction_count: Number(newReduction.reduction_count),
    };

    const dup = reductions.find(r => r.condition === row.condition);
    if (dup) {
      alert(`이미 '${row.condition}' 조건의 감차 규칙이 설정되어 있습니다.`);
      return;
    }

    setReductions(prev => [...prev, row]);
  };

  const handleDeleteReductionRow = (index: number) => {
    setReductions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveReductions = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/route-reduction-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: selectedRoute, rules: reductions }),
      });
      if (!res.ok) throw new Error('감차 규칙 저장 실패');
      setMessage({ type: 'success', text: `${selectedRoute} 감차 규칙이 저장되었습니다.` });
      fetchData();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRotationChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Route names for display
  const routeNumbers = routes.map(r => r.route_number);

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto min-h-screen flex flex-col">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          ④ 시간표·운행 설정
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          4단계: 시간표와 운행 규칙을 설정하면 모든 초기 설정이 완성됩니다!
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <nav className="flex space-x-1 bg-gray-150/60 p-1.5 rounded-2xl border border-gray-200/50 shadow-xs">
          {[
            { id: 'timetables', label: '출발 시간표' },
            { id: 'shifts', label: '근무 교대 시간' },
            { id: 'reductions', label: '주말·공휴일 감차' },
            { id: 'rotation', label: '배차 순환 방식' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setMessage(null);
              }}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-md border border-gray-100'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-white/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-sm font-semibold flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span>{message.text}</span>
        </div>
      )}

      {routesLoading || loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-200 border-t-blue-500"></div>
        </div>
      ) : routes.length === 0 && activeTab !== 'rotation' ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-center space-y-3">
          <div className="text-4xl">🚌</div>
          <p className="text-gray-500 text-sm font-semibold">등록된 노선이 없습니다.</p>
          <p className="text-gray-400 text-xs">먼저 노선/차량 관리에서 노선을 추가해 주세요.</p>
        </div>
      ) : (
        <div className="flex-1">
          {/* Common Route Selector (Tabs 1, 2, 3) */}
          {(activeTab === 'timetables' || activeTab === 'shifts' || activeTab === 'reductions') && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-wrap gap-4 items-center shadow-sm">
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs text-gray-400 font-bold uppercase">설정 대상 노선 선택</label>
                  <select
                    value={selectedRoute}
                    onChange={(e) => setSelectedRoute(e.target.value)}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                  >
                    {routeNumbers.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TIMETABLE CONTENT */}
              {activeTab === 'timetables' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Form to Add Row */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm h-fit">
                    <h3 className="text-base font-bold text-gray-950 border-b border-gray-100 pb-3">순번 시간표 추가</h3>

                    <div className="flex flex-col space-y-1">
                      <label className="text-xs font-bold text-gray-400">쉬프트</label>
                      <select
                        value={newTimetable.shift_type}
                        onChange={(e) => setNewTimetable({ ...newTimetable, shift_type: e.target.value as any })}
                        className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                      >
                        <option value="morning">오전 (Morning)</option>
                        <option value="afternoon">오후 (Afternoon)</option>
                        <option value="triple">3교대 (Triple)</option>
                      </select>
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="text-xs font-bold text-gray-400">운행 순번</label>
                      <input
                        type="number"
                        min="1"
                        value={newTimetable.sequence || 1}
                        onChange={(e) => setNewTimetable({ ...newTimetable, sequence: Number(e.target.value) })}
                        className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                      />
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="text-xs font-bold text-gray-400">출발 시간</label>
                      <input
                        type="time"
                        value={newTimetable.departure_time || '05:00'}
                        onChange={(e) => setNewTimetable({ ...newTimetable, departure_time: e.target.value })}
                        className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                      />
                    </div>

                    <button
                      onClick={handleAddTimetableRow}
                      className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition shadow-sm"
                    >
                      목록에 추가
                    </button>
                  </div>

                  {/* Timetable List Grid */}
                  <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="p-5 border-b border-gray-100 bg-white flex justify-between items-center">
                        <h3 className="text-base font-bold text-gray-900">{selectedRoute} 출발 시간표 임시 목록</h3>
                        <span className="text-xs text-gray-400 font-medium">총 {timetables.length}개 편성</span>
                      </div>
                      <div className="overflow-auto max-h-[380px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-100">
                              <th className="px-5 py-3">쉬프트</th>
                              <th className="px-5 py-3">운행 순번</th>
                              <th className="px-5 py-3">출발시간</th>
                              <th className="px-5 py-3 text-right">삭제</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {timetables.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-5 py-8 text-center text-gray-400">설정된 시간표가 없습니다. 추가 버튼을 눌러 목록을 구성하세요.</td>
                              </tr>
                            ) : (
                              timetables.map((t, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                                  <td className="px-5 py-3 font-semibold text-gray-700">
                                    {t.shift_type === 'morning' ? '오전' : (t.shift_type === 'afternoon' ? '오후' : '3교대')}
                                  </td>
                                  <td className="px-5 py-3 font-mono font-bold text-blue-600">{t.sequence}번</td>
                                  <td className="px-5 py-3 font-mono text-gray-800 text-sm font-semibold">{t.departure_time}</td>
                                  <td className="px-5 py-3 text-right">
                                    <button
                                      onClick={() => handleDeleteTimetableRow(idx)}
                                      className="px-2 py-1 text-red-500 hover:bg-red-50 rounded-lg text-[11px] font-bold transition"
                                    >
                                      제거
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                      <button
                        onClick={handleSaveTimetables}
                        disabled={saving || timetables.length === 0}
                        className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
                      >
                        {saving ? '저장 중...' : '기본 시간표 저장하기'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SHIFT CONTENT */}
              {activeTab === 'shifts' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Form to Add Shift */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm h-fit">
                    <h3 className="text-base font-bold text-gray-950 border-b border-gray-100 pb-3">쉬프트 시간대 설정</h3>

                    <div className="flex flex-col space-y-1">
                      <label className="text-xs font-bold text-gray-400">쉬프트명</label>
                      <input
                        type="text"
                        placeholder="예: 오전, 오후, 3탕"
                        value={newShift.shift_name}
                        onChange={(e) => setNewShift({ ...newShift, shift_name: e.target.value })}
                        className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                      />
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="text-xs font-bold text-gray-400">근무 시작 시간</label>
                      <input
                        type="time"
                        value={newShift.start_time || '05:00'}
                        onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                        className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                      />
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="text-xs font-bold text-gray-400">근무 종료 시간</label>
                      <input
                        type="time"
                        value={newShift.end_time || '14:00'}
                        onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                        className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                      />
                    </div>

                    <button
                      onClick={handleAddShiftRow}
                      className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition shadow-sm"
                    >
                      목록에 추가
                    </button>
                  </div>

                  {/* Shift List Table */}
                  <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="p-5 border-b border-gray-100 bg-white">
                        <h3 className="text-base font-bold text-gray-900">{selectedRoute} 쉬프트 시간 배정</h3>
                      </div>
                      <div className="overflow-auto max-h-[380px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-100">
                              <th className="px-5 py-3">쉬프트명</th>
                              <th className="px-5 py-3">운행 시간</th>
                              <th className="px-5 py-3 text-right">삭제</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {shifts.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-5 py-8 text-center text-gray-400">설정된 쉬프트가 없습니다. 예: 오전(04:50 ~ 14:00)</td>
                              </tr>
                            ) : (
                              shifts.map((s, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                                  <td className="px-5 py-3 font-bold text-gray-800">{s.shift_name}</td>
                                  <td className="px-5 py-3 font-mono text-gray-700 text-sm font-semibold">{s.start_time} ~ {s.end_time}</td>
                                  <td className="px-5 py-3 text-right">
                                    <button
                                      onClick={() => handleDeleteShiftRow(idx)}
                                      className="px-2 py-1 text-red-500 hover:bg-red-50 rounded-lg text-[11px] font-bold transition"
                                    >
                                      제거
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                      <button
                        onClick={handleSaveShifts}
                        disabled={saving || shifts.length === 0}
                        className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
                      >
                        {saving ? '저장 중...' : '쉬프트 설정 저장하기'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* REDUCTION RULES CONTENT */}
              {activeTab === 'reductions' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Form to Add Reduction */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm h-fit">
                    <h3 className="text-base font-bold text-gray-950 border-b border-gray-100 pb-3">감차 규칙 추가</h3>

                    <div className="flex flex-col space-y-1">
                      <label className="text-xs font-bold text-gray-400">적용 날짜 조건</label>
                      <select
                        value={newReduction.condition}
                        onChange={(e) => setNewReduction({ ...newReduction, condition: e.target.value })}
                        className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                      >
                        {CONDITIONS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col space-y-1">
                      <label className="text-xs font-bold text-gray-400">감차 차량 수 (대)</label>
                      <input
                        type="number"
                        min="1"
                        value={newReduction.reduction_count || 1}
                        onChange={(e) => setNewReduction({ ...newReduction, reduction_count: Number(e.target.value) })}
                        className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                      />
                    </div>

                    <button
                      onClick={handleAddReductionRow}
                      className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition shadow-sm"
                    >
                      목록에 추가
                    </button>
                  </div>

                  {/* Reduction Rule List Table */}
                  <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="p-5 border-b border-gray-100 bg-white">
                        <h3 className="text-base font-bold text-gray-900">{selectedRoute} 감차 규칙 임시 목록</h3>
                      </div>
                      <div className="overflow-auto max-h-[380px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-100">
                              <th className="px-5 py-3">적용 조건</th>
                              <th className="px-5 py-3">감차 대수</th>
                              <th className="px-5 py-3 text-right">삭제</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {reductions.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-5 py-8 text-center text-gray-400">설정된 감차 규칙이 없습니다. (자동 배차 시 폴백 하드코딩 적용됨)</td>
                              </tr>
                            ) : (
                              reductions.map((r, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                                  <td className="px-5 py-3 font-semibold text-gray-700">{r.condition}</td>
                                  <td className="px-5 py-3 font-mono text-red-650 font-bold text-sm">-{r.reduction_count}대 감차</td>
                                  <td className="px-5 py-3 text-right">
                                    <button
                                      onClick={() => handleDeleteReductionRow(idx)}
                                      className="px-2 py-1 text-red-500 hover:bg-red-50 rounded-lg text-[11px] font-bold transition"
                                    >
                                      제거
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                      <button
                        onClick={handleSaveReductions}
                        disabled={saving || reductions.length === 0}
                        className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
                      >
                        {saving ? '저장 중...' : '감차 규칙 저장하기'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ROTATION SETTINGS */}
          {activeTab === 'rotation' && (
            <form onSubmit={handleSaveRotation} className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-950 border-b border-gray-100 pb-4">
                  노선별 배차 방식 설정
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col space-y-2 col-span-1 md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200/60">
                    <label className="text-sm font-bold text-gray-850">기본 배차 방식 (Default)</label>
                    <span className="text-xs text-gray-400 font-medium">지정되지 않은 노선에 적용될 기본 로테이션 방식입니다.</span>
                    <select
                      value={settings.rotation_mode_default || 'fixed'}
                      onChange={(e) => handleRotationChange('rotation_mode_default', e.target.value)}
                      className="mt-1 block w-full rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                    >
                      <option value="fixed">현행 유지 (쉬프트 요일 고정)</option>
                      <option value="weekly">주간 순환 (매주 쉬프트 요일 +1일 이동)</option>
                      <option value="biweekly">격주 순환 (2주마다 쉬프트 요일 이동)</option>
                      <option value="monthly">월간 순환 (매월 쉬프트 요일 이동)</option>
                    </select>
                  </div>

                  {routes.length === 0 ? (
                    <div className="col-span-1 md:col-span-2 text-center py-8 text-gray-400 text-sm">
                      등록된 노선이 없습니다. 노선을 먼저 추가해 주세요.
                    </div>
                  ) : (
                    routeNumbers.map((route) => {
                      const key = `rotation_mode_${route}`;
                      return (
                        <div key={route} className="flex flex-col space-y-2 bg-gray-50/50 p-4 rounded-xl border border-gray-100 shadow-2xs">
                          <label className="text-sm font-bold text-gray-800">{route} 배차 설정</label>
                          <select
                            value={settings[key] || 'fixed'}
                            onChange={(e) => handleRotationChange(key, e.target.value)}
                            className="mt-1 block w-full rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                          >
                            <option value="fixed">현행 유지 (고정)</option>
                            <option value="weekly">주간 순환 (매주 +1일 이동)</option>
                            <option value="biweekly">격주 순환 (2주마다 이동)</option>
                            <option value="monthly">월간 순환 (매월 이동)</option>
                          </select>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold rounded-xl transition shadow-md disabled:opacity-50 text-sm"
                >
                  {saving ? '저장 중...' : '순환 설정 저장하기'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Footer Navigation */}
      <div className="border-t border-gray-200 pt-6 mt-auto">
        <div className="flex items-center justify-between">
          <Link
            href="/drivers"
            className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition flex items-center space-x-1"
          >
            <span>← 이전: 기사 관리</span>
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold rounded-xl transition shadow-md text-sm"
          >
            ✅ 초기 설정 완료! 대시보드로 이동 →
          </Link>
        </div>
      </div>
    </div>
  );
}
