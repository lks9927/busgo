'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Schedule {
  id: number;
  date: string;
  route: string;
  vehicle_number: string;
  shift_type: 'morning' | 'afternoon' | 'triple';
  driver_name: string | null;
  sequence: number;
  is_substitute: number;
  original_driver_name: string | null;
}

interface LeaveRequest {
  id: number;
  driver_name: string;
  driver_route: string;
  request_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  requested_at: string;
}

interface FairnessAlert {
  driver_id: number;
  driver_name: string;
  driver_type: string;
  fairness_score: number;
  weekend_work_days: number;
  consecutive_work_days: number;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<{
    date: string;
    totalSchedules: number;
    substituteSchedules: number;
    activeRoutes: number;
    schedules: Schedule[];
  } | null>(null);

  const [alerts, setAlerts] = useState<{
    pendingLeaves: LeaveRequest[];
    overworked: FairnessAlert[];
    underworked: FairnessAlert[];
    consecutiveAlerts: FairnessAlert[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 한국 시간 기준 오늘 날짜 구하기
      const today = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const dateParam = today.toISOString().substring(0, 10);
      const monthParam = dateParam.substring(0, 7);
      
      const summaryRes = await fetch(`/api/dashboard/summary?date=${dateParam}`);
      if (!summaryRes.ok) throw new Error('Failed to fetch summary');
      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      const alertsRes = await fetch(`/api/dashboard/alerts?month=${monthParam}`);
      if (!alertsRes.ok) throw new Error('Failed to fetch alerts');
      const alertsData = await alertsRes.json();
      setAlerts(alertsData);
      
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApproveLeave = async (id: number) => {
    try {
      const res = await fetch(`/api/leaves/${id}/approve`, { method: 'PUT' });
      if (!res.ok) throw new Error('Approve failed');
      fetchData(); // reload
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRejectLeave = async (id: number) => {
    try {
      const res = await fetch(`/api/leaves/${id}/reject`, { method: 'PUT' });
      if (!res.ok) throw new Error('Reject failed');
      fetchData(); // reload
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-200 border-t-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-red-500 bg-bg-dark min-h-screen">
        <h2 className="text-xl font-bold">오류가 발생했습니다</h2>
        <p className="mt-2 text-gray-500">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold shadow-sm transition hover:bg-blue-600">재시도</button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            통합 운행 대시보드
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            실시간 배차 현황, 공정성 지표 및 운행 모니터링
          </p>
        </div>
        <div className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 font-semibold flex items-center space-x-2 shadow-sm">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span>기준일: {summary?.date}</span>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/50 transition-all duration-300 shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-500 group-hover:scale-110 transition-transform duration-300">
            <svg className="w-24 h-24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm11 0a2 2 0 11-4 0 2 2 0 014 0zM21 12H3m18-3H3" /></svg>
          </div>
          <h3 className="text-gray-400 text-sm font-semibold uppercase">오늘 총 운행 차량</h3>
          <p className="text-3xl font-extrabold text-gray-900 mt-2">{summary?.totalSchedules ? summary.totalSchedules / 2 : 0}대</p>
          <div className="text-xs text-gray-400 mt-2 font-medium">운행 스케줄 {summary?.totalSchedules}건</div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 relative overflow-hidden group hover:border-red-500/50 transition-all duration-300 shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-red-500 group-hover:scale-110 transition-transform duration-300">
            <svg className="w-24 h-24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 className="text-gray-400 text-sm font-semibold uppercase">실시간 대타 배정</h3>
          <p className="text-3xl font-extrabold text-gray-900 mt-2">{summary?.substituteSchedules}건</p>
          <div className="text-xs text-gray-400 mt-2 font-medium">휴무로 인한 예비기사 대체율 {Math.round((summary?.substituteSchedules || 0) / (summary?.totalSchedules || 1) * 100)}%</div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 relative overflow-hidden group hover:border-green-500/50 transition-all duration-300 shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-green-500 group-hover:scale-110 transition-transform duration-300">
            <svg className="w-24 h-24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
          </div>
          <h3 className="text-gray-400 text-sm font-semibold uppercase">활성화 노선 수</h3>
          <p className="text-3xl font-extrabold text-gray-900 mt-2">{summary?.activeRoutes}개 노선</p>
          <div className="text-xs text-gray-400 mt-2 font-medium">시내 3개 / 직행 4개 계통 운행</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Today Schedules (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white">
              <div>
                <h2 className="text-lg font-bold text-gray-900">오늘의 노선별 배차 현황</h2>
                <p className="text-xs text-gray-500 mt-1">노선 및 차량 로테이션 순서에 따른 운행 기사 목록</p>
              </div>
              <Link href="/dispatch" className="text-sm text-blue-500 hover:text-blue-600 font-semibold transition-colors duration-200">
                전체보기 &rarr;
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="px-6 py-3.5 bg-gray-50">노선</th>
                    <th className="px-6 py-3.5 bg-gray-50">순번</th>
                    <th className="px-6 py-3.5 bg-gray-50">차량</th>
                    <th className="px-6 py-3.5 bg-gray-50">오전 기사</th>
                    <th className="px-6 py-3.5 bg-gray-50">오후 기사</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                  {summary?.schedules.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-semibold">
                        오늘({summary.date}) 등록된 배차 일정이 없습니다.<br/>
                        <Link href="/dispatch" className="text-blue-500 hover:text-blue-600 underline font-bold mt-2 inline-block">
                          배차 관리 페이지
                        </Link>에서 배차를 생성해 주세요.
                      </td>
                    </tr>
                  ) : (
                    Array.from(
                      summary?.schedules.reduce((acc, s) => {
                        const key = `${s.route}_${s.vehicle_number}`;
                        if (!acc.has(key)) {
                          acc.set(key, { route: s.route, vehicle: s.vehicle_number, sequence: s.sequence, morning: null as any, afternoon: null as any });
                        }
                        const entry = acc.get(key);
                        if (s.shift_type === 'morning') entry.morning = s;
                        if (s.shift_type === 'afternoon') entry.afternoon = s;
                        return acc;
                      }, new Map<string, any>()).values() || []
                    ).slice(0, 10).map((row: any, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900">{row.route}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-mono font-semibold text-[10px]">{row.sequence}번</span>
                        </td>
                        <td className="px-6 py-4 text-blue-600 font-semibold">{row.vehicle}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className={row.morning?.is_substitute ? 'text-red-600 font-bold' : 'text-gray-800 font-medium'}>
                              {row.morning?.driver_name || '미지정'}
                            </span>
                            {row.morning?.is_substitute === 1 && (
                              <span className="text-[10px] text-gray-400 line-through">원래: {row.morning?.original_driver_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className={row.afternoon?.is_substitute ? 'text-red-600 font-bold' : 'text-gray-800 font-medium'}>
                              {row.afternoon?.driver_name || '미지정'}
                            </span>
                            {row.afternoon?.is_substitute === 1 && (
                              <span className="text-[10px] text-gray-400 line-through">원래: {row.afternoon?.original_driver_name}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col: Alerts & Leaves (1/3 width) */}
        <div className="space-y-6">
          {/* Leaves Request */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4">대기 중인 휴무 승인</h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto">
              {alerts?.pendingLeaves.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">대기 중인 신청이 없습니다.</p>
              ) : (
                alerts?.pendingLeaves.map((l) => (
                  <div key={l.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3 shadow-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-bold text-gray-900">{l.driver_name} 기사</span>
                        <span className="text-xs text-gray-400 ml-2">({l.driver_route})</span>
                      </div>
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-full text-[10px] font-bold">
                        {l.request_type === 'annual' ? '연차' : l.request_type === 'monthly' ? '월차' : l.request_type === 'sick' ? '병가' : '대체'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 font-medium">
                      기간: {l.start_date} ~ {l.end_date}
                    </div>
                    <div className="text-xs text-gray-500 bg-white border border-gray-100 p-2.5 rounded-lg">
                      사유: {l.reason || '없음'}
                    </div>
                    <div className="flex space-x-2 pt-1">
                      <button
                        onClick={() => handleApproveLeave(l.id)}
                        className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-xs"
                      >
                        승인 (대타 배정)
                      </button>
                      <button
                        onClick={() => handleRejectLeave(l.id)}
                        className="flex-1 py-2 bg-white hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded-xl transition border border-gray-200 shadow-xs"
                      >
                        반려
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">공정성 경고 기사</h3>
              <div className="relative group">
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  title="공정성 판정기준 도움말"
                >
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                </button>
                <div className="absolute right-0 top-7 w-72 p-4 bg-gray-900 text-white text-[11px] rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 leading-relaxed space-y-2">
                  <p className="font-extrabold border-b border-gray-800 pb-1 text-blue-400">📊 공정성 경고 판정 기준 (Z-Score)</p>
                  <p>전체 기사의 평균 근무 데이터를 기준으로 기사별 업무 강도의 편차를 통계적으로 계산한 점수입니다.</p>
                  <p className="font-bold text-gray-300">💡 주요 가중치 반영 항목:</p>
                  <ul className="list-disc pl-3.5 space-y-0.5 text-gray-400">
                    <li>주말 근무일수 (30%)</li>
                    <li>첫차(Sequence 1) 배차 횟수 (20%)</li>
                    <li>3탕 근무 횟수 (20%)</li>
                    <li>공휴일 근무일수 (20%)</li>
                    <li>최대 연속 근무일수 (10%)</li>
                  </ul>
                  <p className="border-t border-gray-800 pt-1 text-gray-400">
                    <span className="text-red-400 font-bold">Z-Score 양수 (+):</span> 다른 기사 대비 과로 상태 (피로 누적)<br/>
                    <span className="text-blue-400 font-bold">Z-Score 음수 (-):</span> 다른 기사 대비 배차 과소 (불균형)
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-red-600 block uppercase tracking-wider">과대 근무 (피로 누적)</span>
                {alerts?.overworked.slice(0, 2).map((a, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-3 bg-red-50 border border-red-100 rounded-xl shadow-xs">
                    <div>
                      <span className="font-bold text-gray-800">{a.driver_name}</span>
                      <span className="text-gray-400 text-[10px] ml-2 font-medium">{a.driver_type === 'fixed' ? '고정' : '순환'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-red-600 font-bold">Z-Score: +{a.fairness_score.toFixed(2)}</span>
                      <span className="text-[10px] text-gray-400 block font-medium">주말 근무: {a.weekend_work_days}일</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <span className="text-[10px] font-bold text-blue-600 block uppercase tracking-wider">과소 근무 (배차 불균형)</span>
                {alerts?.underworked.slice(0, 2).map((a, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-3 bg-blue-50 border border-blue-100 rounded-xl shadow-xs">
                    <div>
                      <span className="font-bold text-gray-800">{a.driver_name}</span>
                      <span className="text-gray-400 text-[10px] ml-2 font-medium">{a.driver_type === 'fixed' ? '고정' : '순환'}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-blue-600 font-bold">Z-Score: {a.fairness_score.toFixed(2)}</span>
                      <span className="text-[10px] text-gray-400 block font-medium">주말 근무: {a.weekend_work_days}일</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
