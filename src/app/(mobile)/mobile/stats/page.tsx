'use client';

import { useState, useEffect, useMemo } from 'react';
import { useMobileAuth } from '../layout';

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
}

export default function DriverStatsPage() {
  const { driver } = useMobileAuth();
  const [data, setData] = useState<FairnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!driver || !driver.primary_route) {
      setLoading(false);
      return;
    }
    const routeName = driver.primary_route;

    async function fetchFairness() {
      try {
        setLoading(true);
        const res = await fetch(`/api/fairness?route=${encodeURIComponent(routeName)}`);
        if (!res.ok) throw new Error('공정성 데이터를 불러오는데 실패했습니다.');
        const result = await res.json();
        setData(result);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchFairness();
  }, [driver]);

  const driverStats = useMemo(() => {
    if (!data || !driver) return null;
    return data.drivers.find((d) => d.driverId === driver.id) || null;
  }, [data, driver]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !data || !driverStats) {
    return (
      <div className="p-6 text-center bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
        <p className="text-gray-400 text-sm font-medium">노선에 배차 스케줄 정보가 없거나, 소속 노선 설정이 필요합니다.</p>
      </div>
    );
  }

  // Helper to determine status description based on Z-score
  const getStatusText = (zScore: number) => {
    if (zScore > 1.5) return { label: '⚠️ 과대 업무', color: 'text-red-600 bg-red-50 border-red-100' };
    if (zScore < -1.5) return { label: '🔵 배차 부족', color: 'text-blue-600 bg-blue-50 border-blue-100' };
    return { label: '✅ 공정함', color: 'text-green-600 bg-green-50 border-green-100' };
  };

  const status = getStatusText(driverStats.fairnessScore);

  const metrics = [
    {
      label: '주말 근무일수',
      myValue: driverStats.weekendWorkDays,
      avgValue: data.averages.weekendWorkDays,
      unit: '일',
    },
    {
      label: '첫차 배정 횟수',
      myValue: driverStats.firstCarCount,
      avgValue: data.averages.firstCarCount,
      unit: '회',
    },
    {
      label: '3탕(더블) 근무',
      myValue: driverStats.tripleShiftCount,
      avgValue: data.averages.tripleShiftCount,
      unit: '회',
    },
    {
      label: '공휴일 근무일수',
      myValue: driverStats.holidayWorkDays,
      avgValue: data.averages.holidayWorkDays,
      unit: '일',
    },
    {
      label: '최대 연속 근무일',
      myValue: driverStats.consecutiveWorkDays,
      avgValue: data.averages.consecutiveWorkDays,
      unit: '일',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">내 공정성 지표</h2>
        <p className="text-gray-500 text-[11px] mt-0.5">전체 동료 기사 평균 대비 나의 스케줄 편차를 비교합니다.</p>
      </div>

      {/* Fairness Score Card */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 flex items-center justify-between shadow-sm">
        <div className="space-y-1">
          <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">배차 종합 평가</span>
          <h3 className="text-lg font-extrabold text-gray-900">{driver?.name} 기사님</h3>
          <p className="text-xs text-gray-500 pt-0.5">
            Z-score 종합 편차 점수:{' '}
            <span className="font-bold text-gray-800">
              {driverStats.fairnessScore > 0 ? `+${driverStats.fairnessScore.toFixed(2)}` : driverStats.fairnessScore.toFixed(2)}
            </span>
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-xl text-xs font-black border uppercase ${status.color}`}>
          {status.label}
        </span>
      </div>

      {/* Metrics Comparer List */}
      <div className="space-y-4">
        <h3 className="text-sm font-extrabold text-gray-900 px-1">📊 항목별 평균 비교</h3>

        <div className="space-y-3.5">
          {metrics.map((m) => {
            const maxVal = Math.max(m.myValue, m.avgValue, 5) || 5;
            const myPercent = Math.min((m.myValue / maxVal) * 100, 100);
            const avgPercent = Math.min((m.avgValue / maxVal) * 100, 100);

            return (
              <div key={m.label} className="bg-white border border-gray-200 rounded-2xl p-4.5 space-y-3 shadow-xs">
                <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                  <span>{m.label}</span>
                  <div className="space-x-3 text-right text-[11px]">
                    <span>
                      나: <strong className="text-gray-900">{m.myValue}</strong>
                      {m.unit}
                    </span>
                    <span className="text-gray-400">
                      평균: <strong className="text-gray-600">{m.avgValue.toFixed(1)}</strong>
                      {m.unit}
                    </span>
                  </div>
                </div>

                {/* Gauge bars */}
                <div className="space-y-1.5 pt-1">
                  {/* My bar */}
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-blue-500 block font-semibold">내 근무량</span>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${myPercent}%` }}
                        className="h-full bg-blue-500 rounded-full"
                      ></div>
                    </div>
                  </div>

                  {/* Avg bar */}
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-gray-400 block font-semibold">동료 평균</span>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${avgPercent}%` }}
                        className="h-full bg-gray-400 rounded-full"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
