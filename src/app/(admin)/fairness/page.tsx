'use client';

import { useState, useEffect, useMemo } from 'react';

interface DriverFairness {
  driverId: number;
  name: string;
  driverType: string;
  weekendWorkDays: number;
  firstCarCount: number;
  tripleShiftCount: number;
  holidayWorkDays: number;
  consecutiveWorkDays: number;
  fairnessScore: number;
}

interface FairnessData {
  drivers: DriverFairness[];
  averages: {
    weekendWorkDays: number;
    firstCarCount: number;
    tripleShiftCount: number;
    holidayWorkDays: number;
    consecutiveWorkDays: number;
  };
  stdDevs: {
    weekendWorkDays: number;
    firstCarCount: number;
    tripleShiftCount: number;
    holidayWorkDays: number;
    consecutiveWorkDays: number;
  };
}

interface RouteItem {
  id: number;
  route_number: string;
}

// 기사별 불공정 점수 계산 (직관적인 방식)
// 각 항목마다 평균 대비 얼마나 더 일했는지를 점수로 환산
function calcOverloadScore(driver: DriverFairness, avg: FairnessData['averages']): number {
  const weekendOver = Math.max(0, driver.weekendWorkDays - avg.weekendWorkDays);
  const firstCarOver = Math.max(0, driver.firstCarCount - avg.firstCarCount);
  const tripleOver = Math.max(0, driver.tripleShiftCount - avg.tripleShiftCount);
  const holidayOver = Math.max(0, driver.holidayWorkDays - avg.holidayWorkDays);
  const consecOver = Math.max(0, driver.consecutiveWorkDays - avg.consecutiveWorkDays);
  // 가중치: 주말>공휴일>3탕>연속>첫차
  return weekendOver * 2 + holidayOver * 1.5 + tripleOver * 1.5 + firstCarOver * 1 + consecOver * 0.5;
}

function getStatusBadge(driver: DriverFairness, avg: FairnessData['averages']) {
  const wkDiff = driver.weekendWorkDays - avg.weekendWorkDays;
  const hdDiff = driver.holidayWorkDays - avg.holidayWorkDays;
  const trDiff = driver.tripleShiftCount - avg.tripleShiftCount;
  // 과대 경고: 주말 2일 초과 or 공휴일 1.5일 초과 or 3탕 2회 초과
  if (wkDiff >= 2 || hdDiff >= 1.5 || trDiff >= 2) {
    return { label: '🔴 과대 근무', color: 'bg-red-50 text-red-700 border border-red-200', text: '주말/공휴일 근무가 평균보다 많습니다' };
  }
  // 과소 경고: 주말 2일 이상 적음 or 공휴일 1.5일 이상 적음
  if (wkDiff <= -2 || hdDiff <= -1.5) {
    return { label: '🔵 과소 배치', color: 'bg-blue-50 text-blue-700 border border-blue-200', text: '배차 횟수가 평균보다 적습니다' };
  }
  return { label: '🟢 정상', color: 'bg-green-50 text-green-700 border border-green-200', text: '평균 범위 내 정상 배차' };
}

// 막대 차트 컴포넌트 (절대값 기반)
function MiniBar({ value, avg, max, colorClass }: { value: number; avg: number; max: number; colorClass: string }) {
  const safeMax = max || 1;
  const pct = Math.min(100, (value / safeMax) * 100);
  const avgPct = Math.min(100, (avg / safeMax) * 100);
  return (
    <div className="relative h-2 w-full rounded-full bg-gray-100 overflow-visible">
      <div
        className={`absolute left-0 top-0 h-2 rounded-full ${colorClass} transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
      {/* 평균선 */}
      <div
        className="absolute top-[-3px] w-0.5 h-4 bg-gray-400 rounded-full z-10"
        style={{ left: `${avgPct}%` }}
        title={`평균: ${avg.toFixed(1)}`}
      />
    </div>
  );
}

export default function FairnessPage() {
  const [selectedRoute, setSelectedRoute] = useState('138번');
  const [data, setData] = useState<FairnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverFairness | null>(null);
  const [sortBy, setSortBy] = useState<'overload' | 'weekend' | 'holiday' | 'name'>('overload');
  const [routes, setRoutes] = useState<RouteItem[]>([]);

  const fetchFairness = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/fairness?route=${encodeURIComponent(selectedRoute)}`);
      if (!res.ok) throw new Error('공정성 데이터를 불러오는데 실패했습니다.');
      const result = await res.json();
      setData(result);
      setSelectedDriver(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFairness();
  }, [selectedRoute]);

  useEffect(() => {
    fetch('/api/routes').then(r => r.ok ? r.json() : []).then((data: RouteItem[]) => {
      setRoutes(data);
      if (data.length > 0 && !data.find(r => r.route_number === selectedRoute)) {
        setSelectedRoute(data[0].route_number);
      }
    }).catch(() => {});
  }, []);

  // 정렬된 기사 목록
  const sortedDrivers = useMemo(() => {
    if (!data) return [];
    const list = [...data.drivers];
    if (sortBy === 'overload') {
      return list.sort((a, b) => calcOverloadScore(b, data.averages) - calcOverloadScore(a, data.averages));
    } else if (sortBy === 'weekend') {
      return list.sort((a, b) => b.weekendWorkDays - a.weekendWorkDays);
    } else if (sortBy === 'holiday') {
      return list.sort((a, b) => b.holidayWorkDays - a.holidayWorkDays);
    } else {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [data, sortBy]);

  // 각 지표의 최대값 (막대 차트 기준)
  const maxValues = useMemo(() => {
    if (!data) return { weekendWorkDays: 1, firstCarCount: 1, tripleShiftCount: 1, holidayWorkDays: 1, consecutiveWorkDays: 1 };
    return {
      weekendWorkDays: Math.max(1, ...data.drivers.map(d => d.weekendWorkDays)),
      firstCarCount: Math.max(1, ...data.drivers.map(d => d.firstCarCount)),
      tripleShiftCount: Math.max(1, ...data.drivers.map(d => d.tripleShiftCount)),
      holidayWorkDays: Math.max(1, ...data.drivers.map(d => d.holidayWorkDays)),
      consecutiveWorkDays: Math.max(1, ...data.drivers.map(d => d.consecutiveWorkDays)),
    };
  }, [data]);

  // 경고 기사 수 집계
  const warnCounts = useMemo(() => {
    if (!data) return { overload: 0, underload: 0, normal: 0 };
    let overload = 0, underload = 0, normal = 0;
    data.drivers.forEach(d => {
      const s = getStatusBadge(d, data.averages);
      if (s.label.includes('과대')) overload++;
      else if (s.label.includes('과소')) underload++;
      else normal++;
    });
    return { overload, underload, normal };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-bg-dark h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-200 border-t-blue-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-red-500 bg-bg-dark min-h-screen">
        <h2 className="text-xl font-bold">오류가 발생했습니다</h2>
        <p className="mt-2 text-gray-500">{error || '데이터가 없습니다.'}</p>
        <button onClick={fetchFairness} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold shadow-sm transition hover:bg-blue-600">
          재시도
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">스케줄 공정성 분석</h1>
        <p className="text-gray-500 text-sm mt-1">
          기사별 주말·공휴일 근무, 첫차 배정, 3탕 운행, 연속 근무 횟수를 분석하여 배차가 공평하게 이루어지고 있는지 확인합니다.
        </p>
      </div>

      {/* Route Tabs */}
      <div className="flex border-b border-gray-150 pb-1">
        <div className="flex flex-wrap gap-1.5 bg-gray-100/80 p-1 rounded-2xl border border-gray-200 shadow-sm">
          {routes.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoute(r.route_number)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                selectedRoute === r.route_number
                  ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                  : 'text-gray-500 hover:text-gray-950 hover:bg-white/50'
              }`}
            >
              {r.route_number}
            </button>
          ))}
        </div>
      </div>

      {/* 판정 기준 안내 카드 */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <p className="font-bold text-amber-800 text-sm mb-1.5">경고 기사 판정 기준 (이렇게 판단합니다)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-amber-700">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <span className="font-bold text-red-700 block mb-1">🔴 과대 근무 경고</span>
                <ul className="space-y-0.5 text-red-600">
                  <li>• 주말 근무가 평균보다 <strong>2일 이상</strong> 많은 경우</li>
                  <li>• 공휴일 근무가 평균보다 <strong>1.5일 이상</strong> 많은 경우</li>
                  <li>• 3탕(왕복) 운행이 평균보다 <strong>2회 이상</strong> 많은 경우</li>
                </ul>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <span className="font-bold text-blue-700 block mb-1">🔵 과소 배치 경고</span>
                <ul className="space-y-0.5 text-blue-600">
                  <li>• 주말 근무가 평균보다 <strong>2일 이상</strong> 적은 경우</li>
                  <li>• 공휴일 근무가 평균보다 <strong>1.5일 이상</strong> 적은 경우</li>
                </ul>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <span className="font-bold text-green-700 block mb-1">🟢 정상 배차 범위</span>
                <ul className="space-y-0.5 text-green-600">
                  <li>• 위 조건에 해당하지 않는 경우</li>
                  <li>• 모든 지표가 평균 ±2일/회 이내</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-amber-600 mt-2 font-medium">
              💡 막대 그래프의 회색 세로선(│)이 <strong>노선 평균</strong>입니다. 막대가 그 선보다 길면 평균보다 더 일한 것입니다.
            </p>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: '주말 근무 평균', value: data.averages.weekendWorkDays.toFixed(1), unit: '일', icon: '🏖️', sub: `최대 ${maxValues.weekendWorkDays}일` },
          { label: '첫차 배정 평균', value: data.averages.firstCarCount.toFixed(1), unit: '회', icon: '🚌', sub: `최대 ${maxValues.firstCarCount}회` },
          { label: '3탕 운행 평균', value: data.averages.tripleShiftCount.toFixed(1), unit: '회', icon: '🔄', sub: `최대 ${maxValues.tripleShiftCount}회` },
          { label: '공휴일 근무 평균', value: data.averages.holidayWorkDays.toFixed(1), unit: '일', icon: '📅', sub: `최대 ${maxValues.holidayWorkDays}일` },
          { label: '최대 연속 근무 평균', value: data.averages.consecutiveWorkDays.toFixed(1), unit: '일', icon: '⚠️', sub: `최대 ${maxValues.consecutiveWorkDays}일` },
        ].map((item) => (
          <div key={item.label} className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm">
            <span className="text-xl">{item.icon}</span>
            <span className="text-gray-400 text-[11px] font-semibold block mt-1">{item.label}</span>
            <span className="text-2xl font-extrabold text-gray-900 mt-0.5 block">{item.value}{item.unit}</span>
            <span className="text-[10px] text-gray-400 mt-0.5 block">{item.sub}</span>
          </div>
        ))}
      </div>

      {/* 경고 현황 + 기사 목록 2단 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 왼쪽: 경고 현황 + 선택된 기사 상세 */}
        <div className="space-y-4">
          {/* 경고 현황 요약 */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-3">📊 배차 공정성 현황</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center bg-red-50 border border-red-100 rounded-xl p-3">
                <div>
                  <span className="text-sm font-bold text-red-600 block">🔴 과대 근무 경고</span>
                  <span className="text-[11px] text-gray-400">주말/공휴일/3탕이 평균보다 훨씬 많음</span>
                </div>
                <span className="text-2xl font-black text-red-600">{warnCounts.overload}명</span>
              </div>
              <div className="flex justify-between items-center bg-blue-50 border border-blue-100 rounded-xl p-3">
                <div>
                  <span className="text-sm font-bold text-blue-600 block">🔵 과소 배치 경고</span>
                  <span className="text-[11px] text-gray-400">주말/공휴일 근무가 평균보다 훨씬 적음</span>
                </div>
                <span className="text-2xl font-black text-blue-600">{warnCounts.underload}명</span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 border border-gray-100 rounded-xl p-3">
                <div>
                  <span className="text-sm font-bold text-green-600 block">🟢 정상 배차 범위</span>
                  <span className="text-[11px] text-gray-400">모든 지표 평균 범위 내</span>
                </div>
                <span className="text-2xl font-black text-green-600">{warnCounts.normal}명</span>
              </div>
            </div>
          </div>

          {/* 선택된 기사 상세 */}
          {selectedDriver && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">{selectedDriver.name}</h3>
                  <span className="text-[11px] text-gray-400">{selectedDriver.driverType === 'fixed' ? '고정 기사' : '순환(대타) 기사'}</span>
                </div>
                <button onClick={() => setSelectedDriver(null)} className="text-gray-300 hover:text-gray-500 text-xl leading-none">&times;</button>
              </div>
              
              {(() => {
                const badge = getStatusBadge(selectedDriver, data.averages);
                return (
                  <div className={`text-xs font-bold px-3 py-2 rounded-xl mb-4 ${badge.color}`}>
                    {badge.label} &nbsp;·&nbsp; {badge.text}
                  </div>
                );
              })()}

              <div className="space-y-3 text-xs">
                {[
                  { label: '🏖️ 주말 근무', value: selectedDriver.weekendWorkDays, avg: data.averages.weekendWorkDays, max: maxValues.weekendWorkDays, unit: '일', bar: 'bg-orange-400' },
                  { label: '📅 공휴일 근무', value: selectedDriver.holidayWorkDays, avg: data.averages.holidayWorkDays, max: maxValues.holidayWorkDays, unit: '일', bar: 'bg-purple-400' },
                  { label: '🔄 3탕 운행', value: selectedDriver.tripleShiftCount, avg: data.averages.tripleShiftCount, max: maxValues.tripleShiftCount, unit: '회', bar: 'bg-pink-400' },
                  { label: '🚌 첫차 배정', value: selectedDriver.firstCarCount, avg: data.averages.firstCarCount, max: maxValues.firstCarCount, unit: '회', bar: 'bg-blue-400' },
                  { label: '⚠️ 최대 연속 근무', value: selectedDriver.consecutiveWorkDays, avg: data.averages.consecutiveWorkDays, max: maxValues.consecutiveWorkDays, unit: '일', bar: 'bg-red-400' },
                ].map(item => {
                  const diff = item.value - item.avg;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-600 font-semibold">{item.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900">{item.value}{item.unit}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            diff > 0.5 ? 'text-red-600 bg-red-50' : diff < -0.5 ? 'text-blue-600 bg-blue-50' : 'text-gray-400 bg-gray-50'
                          }`}>
                            {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <MiniBar value={item.value} avg={item.avg} max={item.max} colorClass={item.bar} />
                    </div>
                  );
                })}
                <p className="text-[10px] text-gray-400 mt-2">│ 회색 세로선 = 노선 평균값</p>
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 기사별 목록 테이블 */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">기사별 근무 현황</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">막대의 회색 세로선(│)이 노선 평균입니다. 기사를 클릭하면 상세 내역을 볼 수 있습니다.</p>
            </div>
            {/* 정렬 */}
            <div className="flex gap-1 flex-shrink-0">
              {[
                { key: 'overload', label: '부담순' },
                { key: 'weekend', label: '주말순' },
                { key: 'holiday', label: '공휴일순' },
                { key: 'name', label: '이름순' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    sortBy === s.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                <tr className="text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">유형</th>
                  <th className="px-4 py-3 min-w-[100px]">주말 근무</th>
                  <th className="px-4 py-3 min-w-[100px]">공휴일</th>
                  <th className="px-4 py-3 min-w-[100px]">3탕</th>
                  <th className="px-4 py-3 min-w-[80px]">연속</th>
                  <th className="px-4 py-3">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedDrivers.map((d) => {
                  const badge = getStatusBadge(d, data.averages);
                  const isSelected = selectedDriver?.driverId === d.driverId;
                  return (
                    <tr
                      key={d.driverId}
                      onClick={() => setSelectedDriver(isSelected ? null : d)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 font-bold text-gray-800">{d.name}</td>
                      <td className="px-4 py-3 text-gray-400">{d.driverType === 'fixed' ? '고정' : '순환'}</td>

                      {/* 주말 근무 바 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700 w-5 text-right">{d.weekendWorkDays}</span>
                          <div className="flex-1 min-w-[60px]">
                            <MiniBar value={d.weekendWorkDays} avg={data.averages.weekendWorkDays} max={maxValues.weekendWorkDays} colorClass="bg-orange-400" />
                          </div>
                        </div>
                      </td>

                      {/* 공휴일 바 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700 w-5 text-right">{d.holidayWorkDays}</span>
                          <div className="flex-1 min-w-[60px]">
                            <MiniBar value={d.holidayWorkDays} avg={data.averages.holidayWorkDays} max={maxValues.holidayWorkDays} colorClass="bg-purple-400" />
                          </div>
                        </div>
                      </td>

                      {/* 3탕 바 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-700 w-5 text-right">{d.tripleShiftCount}</span>
                          <div className="flex-1 min-w-[50px]">
                            <MiniBar value={d.tripleShiftCount} avg={data.averages.tripleShiftCount} max={maxValues.tripleShiftCount} colorClass="bg-pink-400" />
                          </div>
                        </div>
                      </td>

                      {/* 연속 근무 */}
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${d.consecutiveWorkDays >= 6 ? 'text-red-600' : 'text-gray-600'}`}>
                          {d.consecutiveWorkDays}일
                        </span>
                      </td>

                      {/* 상태 배지 */}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
