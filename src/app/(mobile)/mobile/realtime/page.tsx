'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useMobileAuth } from '../layout';

interface Station {
  stationId: string;
  stationName: string;
  stationSeq: number;
  x: number;
  y: number;
}

interface Bus {
  plateNo: string;
  stationId: string;
  stationSeq: number;
  crowded: number;
  lowPlate: number;
  speed: number;
  driverName: string | null;
  shiftType: string | null;
  isMock: boolean;
}

interface DriverSchedule {
  id: number;
  date: string;
  route: string;
  vehicle_number: string;
  shift_type: string;
}

interface RouteItem {
  id: number;
  route_number: string;
}

function normalizePlateNumber(plate: string): string {
  return plate
    .replace(/[^0-9가-힣]/g, '')
    .replace(/^(경기|서울|인천|강원|충북|충남|전북|전남|경북|경남|제주|부산|대구|광주|대전|울산|세종)/, '');
}

export default function MobileRealtime() {
  const { driver } = useMobileAuth();
  const [selectedRoute, setSelectedRoute] = useState('138번');
  const [stations, setStations] = useState<Station[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routesList, setRoutesList] = useState<RouteItem[]>([]);
  
  // Driver schedule state
  const [driverSchedule, setDriverSchedule] = useState<DriverSchedule | null>(null);
  const [myVehicleNo, setMyVehicleNo] = useState<string>('');
  
  // Refresh counter
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  // Scroll Ref to automatically scroll to the driver's own bus
  const myBusRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Driver's Schedule for today dynamically
  useEffect(() => {
    if (!driver) return;
    const driverId = driver.id;

    async function loadDriverSchedule() {
      try {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const currentMonth = `${yyyy}-${mm}`;
        const todayStr = `${yyyy}-${mm}-${dd}`;

        // Fetch schedules for the current month
        const res = await fetch(`/api/dispatch/driver/${driverId}?month=${currentMonth}`);
        if (res.ok) {
          const schedules = await res.json();
          // Find schedule for today dynamically
          const activeSched = schedules.find((s: any) => s.date === todayStr);
          if (activeSched) {
            setDriverSchedule(activeSched);
            setSelectedRoute(activeSched.route);
            if (activeSched.vehicle_number) {
              setMyVehicleNo(activeSched.vehicle_number);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load driver schedule:', err);
      }
    }

    loadDriverSchedule();
  }, [driver]);

  // 2. Fetch Route Mappings & Config to identify RouteID
  const [mappings, setMappings] = useState<Record<string, string>>({});
  useEffect(() => {
    async function loadMappings() {
      try {
        const res = await fetch('/api/realtime/config');
        if (res.ok) {
          const data = await res.json();
          setMappings(data.gbis_route_mappings);
        }
      } catch (err) {
        console.error('Failed to load config:', err);
      }
    }
    loadMappings();
    // Fetch routes dynamically
    fetch('/api/routes').then(r => r.ok ? r.json() : []).then(setRoutesList).catch(() => {});
  }, []);

  // 3. Load Stations & Buses
  const routeId = mappings[selectedRoute] || '';
  
  const loadRealtimeData = async (showLoader = false) => {
    if (!routeId) return;
    try {
      if (showLoader) setLoading(true);
      setError(null);

      // Fetch stations
      const stationsRes = await fetch(`/api/realtime/route-stations?routeId=${routeId}`);
      if (!stationsRes.ok) throw new Error('정류소 정보를 가져올 수 없습니다.');
      const stationsData = await stationsRes.json();
      setStations(stationsData);

      // Fetch buses
      const busesRes = await fetch(`/api/realtime/bus-locations?routeId=${routeId}`);
      if (!busesRes.ok) throw new Error('버스 위치 정보를 가져올 수 없습니다.');
      const busesData = await busesRes.json();
      
      // If in demo mode and driver has no real assigned vehicle number,
      // simulate/assign them to one of the mock buses for visual demonstration!
      let enrichedBuses = [...busesData];
      if (busesData.length > 0 && driver && !myVehicleNo) {
        // Pick the first bus as "mine" for demo purposes
        const mockMine = busesData[0].plateNo;
        setMyVehicleNo(mockMine);
      }

      setBuses(enrichedBuses);
      setLastUpdated(0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!routeId) return;
    loadRealtimeData(true);

    // Auto refresh every 10 seconds
    const interval = setInterval(() => {
      loadRealtimeData(false);
    }, 10000);

    // Increment secondary counter for last updated time
    const timer = setInterval(() => {
      setLastUpdated(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [selectedRoute, routeId, myVehicleNo]);

  // Scroll to my bus when loaded
  useEffect(() => {
    if (myBusRef.current) {
      setTimeout(() => {
        myBusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }
  }, [loading, selectedRoute]);

  // Calculate my bus, ahead bus, and behind bus
  const myNormVehicle = myVehicleNo ? normalizePlateNumber(myVehicleNo) : '';
  const myBus = buses.find(b => normalizePlateNumber(b.plateNo) === myNormVehicle);

  let aheadBus: Bus | null = null;
  let behindBus: Bus | null = null;
  let stopsAhead: number | null = null;
  let stopsBehind: number | null = null;

  if (myBus && buses.length > 1) {
    // Sort all buses by stationSeq in descending order (assuming direction is same)
    // For simplicity, we compare station sequence numbers
    const sortedBuses = [...buses].sort((a, b) => b.stationSeq - a.stationSeq);
    const myIndex = sortedBuses.findIndex(b => b.plateNo === myBus.plateNo);

    if (myIndex !== -1) {
      // Ahead bus: next index in sorted list (has higher stationSeq, so it's ahead)
      if (myIndex > 0) {
        aheadBus = sortedBuses[myIndex - 1];
        stopsAhead = aheadBus.stationSeq - myBus.stationSeq;
      }
      
      // Behind bus: previous index in sorted list (lower stationSeq, so behind me)
      if (myIndex < sortedBuses.length - 1) {
        behindBus = sortedBuses[myIndex + 1];
        stopsBehind = myBus.stationSeq - behindBus.stationSeq;
      }
    }
  }

  const isDemoMode = buses.length > 0 && buses[0].isMock;

  return (
    <div className="pb-8 space-y-5">
      {/* Back button and title */}
      <div className="flex items-center justify-between">
        <Link
          href="/mobile"
          className="flex items-center space-x-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="font-bold">대시보드</span>
        </Link>
        <span className="text-[10px] text-gray-400 font-semibold">
          {lastUpdated === 0 ? '방금 전 갱신됨' : `${lastUpdated}초 전 갱신됨`}
        </span>
      </div>

      {/* Header card with route details */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-0.5 rounded-full font-bold">
              {selectedRoute} 관제
            </span>
            <h2 className="text-2xl font-extrabold text-gray-900 mt-2">
              배차 간격 모니터
            </h2>
          </div>
          
          <div className="flex flex-col items-end">
            <span className={`w-2.5 h-2.5 rounded-full ${isDemoMode ? 'bg-orange-400' : 'bg-green-500'} animate-pulse`}></span>
            <span className="text-[9px] text-gray-400 mt-1 font-bold">{isDemoMode ? '시뮬레이터' : '실시간'}</span>
          </div>
        </div>

        {/* Route Selector Dropdown */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase">노선 변경</label>
          <select
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/30 transition"
          >
            {routesList.map((r) => (
              <option key={r.id} value={r.route_number}>
                {r.route_number} {mappings[r.route_number] ? '' : '(미매핑)'}
              </option>
            ))}
          </select>
        </div>

        {/* Driver Vehicle info */}
        {driverSchedule && (
          <div className="bg-gray-50 border border-gray-150 rounded-2xl p-3 flex justify-between items-center text-xs">
            <div>
              <span className="text-gray-400 font-medium">오늘의 배정 차량</span>
              <span className="text-gray-800 font-bold block mt-0.5 font-mono">{myVehicleNo || '차량 미등록'}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 font-medium">근무 교대</span>
              <span className="text-blue-600 font-bold block mt-0.5">
                {driverSchedule.shift_type === 'morning' ? '오전 교대' : (driverSchedule.shift_type === 'afternoon' ? '오후 교대' : '종일')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Ahead / Behind Bus Distance Indicator */}
      {myBus ? (
        <div className="grid grid-cols-2 gap-3.5">
          {/* Ahead Bus Widget */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center space-x-3 shadow-xs">
            <div className="p-2.5 bg-blue-50 text-blue-500 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11.25l-3-3m0 0l-3 3m3-3v7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold block">앞차 간격</span>
              <span className="text-sm font-extrabold text-gray-800 mt-0.5 block">
                {aheadBus ? `${stopsAhead}정거장 앞` : '앞차 없음'}
              </span>
              {aheadBus && (
                <span className="text-[9px] text-gray-400 block font-mono">{aheadBus.plateNo.slice(-4)} ({aheadBus.speed}km/h)</span>
              )}
            </div>
          </div>

          {/* Behind Bus Widget */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center space-x-3 shadow-xs">
            <div className="p-2.5 bg-orange-50 text-orange-500 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold block">뒷차 간격</span>
              <span className="text-sm font-extrabold text-gray-800 mt-0.5 block">
                {behindBus ? `${stopsBehind}정거장 뒤` : '뒷차 없음'}
              </span>
              {behindBus && (
                <span className="text-[9px] text-gray-400 block font-mono">{behindBus.plateNo.slice(-4)} ({behindBus.speed}km/h)</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center text-xs text-gray-400 font-medium shadow-xs">
          * 매핑된 차량 번호와 운행 중인 차량 번호가 일치하면 앞/뒷차 간격 정보가 활성화됩니다.
        </div>
      )}

      {/* 4. Vertical Route Map representation */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 space-y-4 shadow-sm">
        <h3 className="text-sm font-extrabold text-gray-800">🗺️ 실시간 노선 버스 분포</h3>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-2">
            <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-blue-500"></div>
            <span className="text-xs text-gray-400">실시간 데이터 수신 중...</span>
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-xs text-red-500 font-bold">{error}</p>
          </div>
        ) : stations.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-400">
            노선 ID 정보가 등록되지 않아 조회할 수 없습니다.
          </div>
        ) : (
          <div className="relative pl-8 pr-2 py-4 space-y-8">
            
            {/* Vertical Blue Line */}
            <div className="absolute left-[47px] top-8 bottom-8 w-1 bg-gradient-to-b from-blue-500 via-sky-400 to-indigo-500 rounded"></div>

            {/* List of stops */}
            {stations.map((station) => {
              // Check if any buses are at this stationSeq
              const busesAtStop = buses.filter(b => b.stationSeq === station.stationSeq);
              const hasBuses = busesAtStop.length > 0;
              
              // Check if "my bus" is here
              const hasMyBus = busesAtStop.some(b => normalizePlateNumber(b.plateNo) === myNormVehicle);

              return (
                <div
                  key={station.stationId}
                  ref={hasMyBus ? myBusRef : null}
                  className={`relative flex items-center justify-between text-xs transition-all duration-300 ${
                    hasMyBus ? 'scale-[1.02] bg-blue-50/50 border border-blue-100 p-3 rounded-2xl -ml-3' : ''
                  }`}
                >
                  
                  {/* Station Sequence Badge (Left) */}
                  <div className="absolute left-0 flex items-center justify-center w-[30px]">
                    <span className="text-[10px] text-gray-400 font-bold font-mono">
                      {station.stationSeq}
                    </span>
                  </div>

                  {/* Node Dot on the vertical line */}
                  <div className="absolute left-[12px] flex items-center justify-center w-[10px] h-[10px]">
                    <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                      hasMyBus
                        ? 'bg-orange-400 border-white scale-125 shadow-[0_0_8px_rgba(249,115,22,0.8)] animate-pulse'
                        : hasBuses
                        ? 'bg-blue-400 border-white scale-110 shadow-[0_0_6px_rgba(59,130,246,0.6)]'
                        : 'bg-white border-gray-300'
                    }`}></div>
                  </div>

                  {/* Station Name & Bus Widget */}
                  <div className="flex-1 pl-6 flex items-center justify-between">
                    <div>
                      <span className={`font-bold transition-colors ${
                        hasMyBus
                          ? 'text-orange-600 text-sm'
                          : hasBuses
                          ? 'text-gray-800'
                          : 'text-gray-400'
                      }`}>
                        {station.stationName}
                      </span>
                    </div>

                    {/* Bus Indicators floating on the right */}
                    <div className="flex flex-col gap-1.5 items-end">
                      {busesAtStop.map((bus) => {
                        const isMine = normalizePlateNumber(bus.plateNo) === myNormVehicle;
                        
                        return (
                          <div
                            key={bus.plateNo}
                            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-xl shadow-xs border ${
                              isMine
                                ? 'bg-orange-500 text-white border-orange-600 font-extrabold scale-105'
                                : 'bg-white text-gray-700 border-gray-200'
                            }`}
                          >
                            {/* Bus icon */}
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C20.1 10.7 19 8 19 8H5s-1.1 2.7-1.5 3.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2m14 0v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-1m14 0a2 2 0 0 1-2-2H7a2 2 0 0 1-2 2M9 11h6" />
                            </svg>
                            <span className="font-mono font-bold text-[10px]">{bus.plateNo.slice(-4)}</span>
                            {isMine ? (
                              <span className="text-[8px] bg-white text-orange-600 px-1 py-0.5 rounded-md font-black border border-orange-100">나의 차</span>
                            ) : (
                              <span className="text-[9px] text-gray-400 font-medium">({bus.driverName || '대기기사'})</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
