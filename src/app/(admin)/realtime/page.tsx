'use client';

import { useState, useEffect, useRef } from 'react';

interface RouteConfig {
  gbis_api_key: string;
  gbis_route_mappings: Record<string, string>;
}

interface Station {
  stationId: string;
  stationName: string;
  stationSeq: number;
  x: number; // lng
  y: number; // lat
}

interface Coordinate {
  x: number; // lng
  y: number; // lat
}

interface Bus {
  plateNo: string;
  stationId: string;
  stationSeq: number;
  crowded: number;
  lowPlate: number;
  speed: number;
  remainSeatCnt?: number;
  driverName: string | null;
  shiftType: string | null;
  isMock: boolean;
}

interface SearchRouteResult {
  routeId: string;
  routeName: string;
  routeTypeName: string;
  startStationName: string;
  endStationName: string;
  adminName: string;
  isMock?: boolean;
}

interface RouteItem {
  id: number;
  route_number: string;
}

export default function RealtimeMonitoring() {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState('138번');
  const [config, setConfig] = useState<RouteConfig>({ gbis_api_key: '', gbis_route_mappings: {} });
  const [stations, setStations] = useState<Station[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routesList, setRoutesList] = useState<RouteItem[]>([]);

  // Settings Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<SearchRouteResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Map references (Leaflet)
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const stationOverlaysRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const busOverlaysRef = useRef<Record<string, any>>({});
  const infoOverlayRef = useRef<any>(null);

  // 1. Load Leaflet SDK (NO API KEY required)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).L) {
      setLeafletLoaded(true);
      return;
    }

    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).L) {
        setLeafletLoaded(true);
      } else {
        setError('지도를 로드하였으나 L 객체를 생성하지 못했습니다.');
        setLoading(false);
      }
    };
    script.onerror = () => {
      setError('지도를 불러오는 데 실패했습니다.');
      setLoading(false);
    };
    document.head.appendChild(script);
  }, []);

  // 2. Fetch Initial Config
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/realtime/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setApiKeyInput(data.gbis_api_key);
      }
    } catch (err) {
      console.error('Failed to load realtime config:', err);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetch('/api/routes').then(r => r.ok ? r.json() : []).then((data: RouteItem[]) => {
      setRoutesList(data);
      if (data.length > 0 && !data.find(r => r.route_number === selectedRoute)) {
        setSelectedRoute(data[0].route_number);
      }
    }).catch(() => {});
  }, []);

  // 3. Initialize Leaflet Map
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapRef.current) return;

    const L = (window as any).L;

    // Center to Pocheon/Korea area by default
    const map = L.map(mapContainerRef.current, {
      center: [37.8949, 127.2003],
      zoom: 11
    });

    // Add OpenStreetMap Tile Layer (no key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    mapRef.current = map;
  }, [leafletLoaded]);

  // 4. Fetch Stations, Road Lines & Buses on Route Change
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;

    const routeId = config.gbis_route_mappings[selectedRoute] || '';
    if (!routeId) {
      setStations([]);
      setBuses([]);
      setLoading(false);
      return;
    }

    let isSubscribed = true;
    let refreshInterval: NodeJS.Timeout;

    const loadRouteData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch stations list
        const stationsRes = await fetch(`/api/realtime/route-stations?routeId=${routeId}`);
        if (!stationsRes.ok) throw new Error('정류소 목록을 가져오는데 실패했습니다.');
        const stationsData = await stationsRes.json();
        
        if (!isSubscribed) return;
        setStations(stationsData);

        // Fetch actual curved route line trajectory (OSRM snapped road coordinates)
        const lineRes = await fetch(`/api/realtime/route-line?routeId=${routeId}`);
        let lineData: Coordinate[] = [];
        if (lineRes.ok) {
          lineData = await lineRes.json();
        }

        // Draw snapped route shape and station dots on Map
        drawRoute(stationsData, lineData);

        // Fetch active buses
        await fetchBuses(routeId, stationsData);
      } catch (err: any) {
        if (isSubscribed) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    loadRouteData();

    // Poll bus locations every 10 seconds
    refreshInterval = setInterval(() => {
      fetchBuses(routeId, stations);
    }, 10000);

    return () => {
      isSubscribed = false;
      clearInterval(refreshInterval);
    };
  }, [selectedRoute, config.gbis_route_mappings, leafletLoaded]);

  // Draw Route Polyline & Station Overlays
  const drawRoute = (stationsList: Station[], lineCoords: Coordinate[]) => {
    if (!mapRef.current) return;
    const L = (window as any).L;
    const map = mapRef.current;

    // Clear previous station overlays
    stationOverlaysRef.current.forEach(o => o.remove());
    stationOverlaysRef.current = [];
    
    // Clear previous polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
    }
    
    // Clear previous bus overlays & info window
    Object.values(busOverlaysRef.current).forEach((o: any) => o.remove());
    busOverlaysRef.current = {};
    if (infoOverlayRef.current) {
      infoOverlayRef.current.remove();
      infoOverlayRef.current = null;
    }

    if (stationsList.length === 0) return;

    // 1. Draw Polyline snapped to real road layout
    const rawPath = lineCoords.length > 0 ? lineCoords : stationsList;
    const path = rawPath.map(pt => [pt.y, pt.x] as [number, number]);

    const polyline = L.polyline(path, {
      color: '#0ea5e9', // Sky Blue
      weight: 5,
      opacity: 0.85,
      dashArray: lineCoords.length > 0 ? undefined : '5, 10'
    }).addTo(map);
    polylineRef.current = polyline;

    // 2. Draw Station Markers using Custom Leaflet DivIcons
    stationsList.forEach((st, index) => {
      const isFirst = index === 0;
      const isLast = index === stationsList.length - 1;
      const isTerminal = isFirst || isLast;

      const content = document.createElement('div');
      content.className = 'leaflet-station-marker';
      content.style.cssText = 'position:relative;cursor:pointer;';

      const dot = document.createElement('div');
      dot.style.cssText = `
        width: ${isTerminal ? '16px' : '12px'};
        height: ${isTerminal ? '16px' : '12px'};
        border-radius: 50%;
        background: ${isTerminal ? '#0ea5e9' : '#1e293b'};
        border: 2.5px solid ${isTerminal ? '#ffffff' : '#0ea5e9'};
        box-shadow: 0 0 ${isTerminal ? '10px' : '6px'} rgba(14,165,233,${isTerminal ? '0.7' : '0.4'});
        transition: all 0.2s;
        margin-left: -${isTerminal ? '8px' : '6px'};
        margin-top: -${isTerminal ? '8px' : '6px'};
      `;
      content.appendChild(dot);

      if (isTerminal) {
        const label = document.createElement('div');
        label.style.cssText = `
          position:absolute; top:-28px; left:50%; transform:translateX(-50%);
          background:#0f172a; border:1px solid #334155; color:#f1f5f9;
          font-size:11px; font-weight:700; padding:2px 8px; border-radius:8px;
          white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.4);
        `;
        label.textContent = `${st.stationName} (${isFirst ? '기점' : '종점'})`;
        content.appendChild(label);
      }

      content.addEventListener('mouseenter', () => {
        if (!isTerminal) {
          dot.style.background = '#0ea5e9';
          dot.style.transform = 'scale(1.4)';
        }
        showStationTooltip(st);
      });
      content.addEventListener('mouseleave', () => {
        if (!isTerminal) {
          dot.style.background = '#1e293b';
          dot.style.transform = 'scale(1)';
        }
        hideStationTooltip();
      });

      const icon = L.divIcon({
        html: content,
        className: '', 
        iconSize: [0, 0]
      });

      const marker = L.marker([st.y, st.x], { icon }).addTo(map);
      stationOverlaysRef.current.push(marker);
    });

    // 3. Fit bounds to show entire route neatly
    if (path.length > 0) {
      map.fitBounds(path, { padding: [80, 80] });
    }
  };

  const showStationTooltip = (st: Station) => {
    if (!mapRef.current) return;
    const L = (window as any).L;

    if (infoOverlayRef.current) {
      infoOverlayRef.current.remove();
    }

    const content = document.createElement('div');
    content.style.cssText = `
      background:#0f172a; border:1px solid #334155; color:#f1f5f9;
      font-size:12px; padding:6px 12px; border-radius:10px;
      box-shadow:0 4px 12px rgba(0,0,0,0.5); white-space:nowrap;
    `;
    content.innerHTML = `<span style="color:#0ea5e9;font-size:10px;font-family:monospace;">순번 ${st.stationSeq}</span><br/><b>${st.stationName}</b>`;

    const icon = L.divIcon({
      html: content,
      className: '',
      iconAnchor: [50, 45]
    });

    const tooltip = L.marker([st.y, st.x], { icon }).addTo(mapRef.current);
    infoOverlayRef.current = tooltip;
  };

  const hideStationTooltip = () => {
    if (infoOverlayRef.current) {
      infoOverlayRef.current.remove();
      infoOverlayRef.current = null;
    }
  };

  // Fetch and Update Bus Markers
  const fetchBuses = async (routeId: string, currentStations: Station[]) => {
    if (!mapRef.current || currentStations.length === 0) return;
    const L = (window as any).L;
    const map = mapRef.current;

    try {
      const res = await fetch(`/api/realtime/bus-locations?routeId=${routeId}`);
      if (!res.ok) throw new Error('실시간 위치 갱신 실패');
      const busesData: Bus[] = await res.json();
      
      setBuses(busesData);
      setLoading(false);

      const stationCoordsMap = new Map<number, Station>();
      currentStations.forEach(st => stationCoordsMap.set(st.stationSeq, st));

      // Remove bus markers that are no longer active
      const activePlates = new Set(busesData.map(b => b.plateNo));
      Object.keys(busOverlaysRef.current).forEach((plateNo) => {
        if (!activePlates.has(plateNo)) {
          busOverlaysRef.current[plateNo].remove();
          delete busOverlaysRef.current[plateNo];
        }
      });

      // Update or Add bus markers
      busesData.forEach((bus) => {
        const station = stationCoordsMap.get(bus.stationSeq);
        if (!station) return;

        const position: [number, number] = [station.y, station.x];

        let bgColor = '#10b981'; // emerald (여유)
        let glowColor = 'rgba(16,185,129,0.6)';
        let crowdedText = '여유';
        if (bus.crowded === 2) {
          bgColor = '#3b82f6'; glowColor = 'rgba(59,130,246,0.6)'; crowdedText = '보통';
        } else if (bus.crowded === 3) {
          bgColor = '#f59e0b'; glowColor = 'rgba(245,158,11,0.6)'; crowdedText = '혼잡';
        } else if (bus.crowded === 4) {
          bgColor = '#ef4444'; glowColor = 'rgba(239,68,68,0.6)'; crowdedText = '매우혼잡';
        }

        const isLowPlate = bus.lowPlate === 1;

        // Build bus marker element
        const content = document.createElement('div');
        content.style.cssText = 'position:relative;cursor:pointer;';
        content.innerHTML = `
          <div style="
            width:42px; height:42px; border-radius:50%;
            background:${bgColor}; border:2.5px solid white;
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 0 14px ${glowColor}, 0 2px 8px rgba(0,0,0,0.4);
            transition:transform 0.2s;
            margin-left: -21px; margin-top: -21px;
          ">
            <svg width="22" height="22" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4zM6 8h12l2 5H4l2-5zm-2 5v4a1 1 0 001 1h1m12 0h1a1 1 0 001-1v-4"/>
            </svg>
          </div>
          ${isLowPlate ? `<div style="position:absolute;top:-24px;right:-24px;width:16px;height:16px;background:#0ea5e9;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;z-index:20;">♿</div>` : ''}
          <div style="
            position:absolute; bottom:-36px; left:50%; transform:translateX(-50%);
            background:#0f172a; border:1px solid #475569; color:white;
            font-family:monospace; font-size:10px; font-weight:700;
            padding:1px 5px; border-radius:4px; white-space:nowrap;
            box-shadow:0 1px 4px rgba(0,0,0,0.5);
          ">${bus.plateNo.slice(-4)}</div>
        `;

        // Click handler for bus popup
        content.addEventListener('click', () => {
          showBusInfo(bus, station, crowdedText, isLowPlate);
        });

        content.addEventListener('mouseenter', () => {
          const inner = content.querySelector('div') as HTMLElement;
          if (inner) inner.style.transform = 'scale(1.15)';
        });
        content.addEventListener('mouseleave', () => {
          const inner = content.querySelector('div') as HTMLElement;
          if (inner) inner.style.transform = 'scale(1)';
        });

        if (busOverlaysRef.current[bus.plateNo]) {
          busOverlaysRef.current[bus.plateNo].remove();
        }

        const icon = L.divIcon({
          html: content,
          className: '',
          iconSize: [0, 0]
        });

        const marker = L.marker(position, { icon }).addTo(map);
        busOverlaysRef.current[bus.plateNo] = marker;
      });
    } catch (err) {
      console.error('Failed to update bus positions:', err);
    }
  };

  // Show detailed Bus Info overlay on Map
  const showBusInfo = (bus: Bus, station: Station, crowdedText: string, isLowPlate: boolean) => {
    if (!mapRef.current) return;
    const L = (window as any).L;

    if (infoOverlayRef.current) {
      infoOverlayRef.current.remove();
    }

    const content = document.createElement('div');
    content.style.cssText = `
      background:#0f172a; border:1px solid #334155; color:#f1f5f9;
      padding:14px 16px; border-radius:14px; min-width:220px;
      box-shadow:0 8px 24px rgba(0,0,0,0.6); font-family:-apple-system,sans-serif;
    `;
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1e293b;padding-bottom:8px;margin-bottom:8px;">
        <b style="font-size:14px;color:white;">${bus.plateNo}</b>
        <span style="font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700;
          ${bus.isMock 
            ? 'background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);' 
            : 'background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);'
          }">${bus.isMock ? '시뮬레이터' : '실시간'}</span>
      </div>
      <div style="font-size:12px;line-height:2;color:#94a3b8;">
        <div style="display:flex;justify-content:space-between;"><span>배정 기사</span><span style="color:#f1f5f9;font-weight:600;">${bus.driverName || '미배정'} ${bus.shiftType ? `(${bus.shiftType})` : ''}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>현재 속도</span><span style="color:#0ea5e9;font-weight:700;font-family:monospace;">${bus.speed} km/h</span></div>
        <div style="display:flex;justify-content:space-between;"><span>차내 혼잡</span><span style="color:#f1f5f9;font-weight:600;">${crowdedText}</span></div>
        <div style="display:flex;justify-content:space-between;"><span>차량 종류</span><span style="color:#f1f5f9;">${isLowPlate ? '저상 버스 ♿' : '일반 고상'}</span></div>
        ${bus.remainSeatCnt !== undefined ? `<div style="display:flex;justify-content:space-between;"><span>잔여 좌석</span><span style="color:#34d399;font-weight:700;font-family:monospace;">${bus.remainSeatCnt}석</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;"><span>최근 정류소</span><span style="color:#f1f5f9;">${station.stationName}</span></div>
      </div>
      <div style="text-align:right;margin-top:6px;">
        <span id="close-bus-info" style="font-size:11px;color:#64748b;cursor:pointer;font-weight:600;">닫기 ✕</span>
      </div>
    `;

    const icon = L.divIcon({
      html: content,
      className: '',
      iconAnchor: [110, 200]
    });

    const overlay = L.marker([station.y, station.x], { icon, zIndexOffset: 1000 }).addTo(mapRef.current);
    infoOverlayRef.current = overlay;

    // Handle close button
    setTimeout(() => {
      const closeBtn = content.querySelector('#close-bus-info');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          overlay.remove();
          infoOverlayRef.current = null;
        });
      }
    }, 50);

    // Center map to the selected bus
    mapRef.current.panTo([station.y, station.x]);
  };

  // Focus on specific bus via sidebar list item click
  const focusOnBus = (bus: Bus) => {
    if (!mapRef.current) return;
    const station = stations.find(s => s.stationSeq === bus.stationSeq);
    if (!station) return;

    mapRef.current.setView([station.y, station.x], 15);

    let crowdedText = '여유';
    if (bus.crowded === 2) crowdedText = '보통';
    else if (bus.crowded === 3) crowdedText = '혼잡';
    else if (bus.crowded === 4) crowdedText = '매우혼잡';

    showBusInfo(bus, station, crowdedText, bus.lowPlate === 1);
  };

  // GBIS API Search Route
  const handleSearchRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchKeyword.trim()) return;
    try {
      setSearching(true);
      const res = await fetch(`/api/realtime/search-routes?keyword=${encodeURIComponent(searchKeyword)}`);
      if (!res.ok) throw new Error('노선 검색에 실패했습니다.');
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      alert(err || '검색 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  };

  const handleMapRouteId = async (routeName: string, routeId: string) => {
    try {
      setSaving(true);
      const updatedMappings = { ...config.gbis_route_mappings, [routeName]: routeId };
      const res = await fetch('/api/realtime/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gbis_api_key: apiKeyInput, gbis_route_mappings: updatedMappings })
      });
      if (res.ok) {
        setConfig((prev) => ({ ...prev, gbis_route_mappings: updatedMappings }));
        alert(`노선 매핑이 저장되었습니다: ${routeName} → ${routeId}`);
      } else { throw new Error('저장에 실패했습니다.'); }
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleSaveApiKey = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/realtime/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gbis_api_key: apiKeyInput })
      });
      if (res.ok) { alert('API 인증키가 안전하게 저장되었습니다.'); fetchConfig(); }
      else { throw new Error('인증키 저장 실패'); }
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const currentRouteId = config.gbis_route_mappings[selectedRoute];
  const isDemoMode = buses.length > 0 && buses[0].isMock;

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden">
      {/* 1. Left Sidebar: Control Panel & Active Bus List */}
      <aside className="w-full lg:w-96 bg-bg-card border-r border-slate-800 flex flex-col h-1/2 lg:h-full z-20">
        
        {/* Header Block */}
        <div className="p-5 border-b border-slate-800 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">실시간 관제 시스템</h1>
              <p className="text-xs text-slate-400 mt-0.5">버스 실시간 위치 및 운행 현황 모니터링</p>
            </div>
            <button
              onClick={() => setShowConfigModal(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 shadow-sm"
              title="설정"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          {/* Mode Indicator Badge */}
          <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold ${
            isDemoMode
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            <span className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isDemoMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`}></span>
              <span>{isDemoMode ? '데모 시뮬레이션 모드 활성화' : '실시간 GBIS 관제 작동 중'}</span>
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">10초 주기</span>
          </div>

          {/* Route selector buttons */}
          <div className="flex flex-wrap gap-2">
            {routesList.map((r) => {
              const hasMapping = !!config.gbis_route_mappings[r.route_number];
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoute(r.route_number)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                    selectedRoute === r.route_number
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  } ${!hasMapping ? 'opacity-50 hover:opacity-100' : ''}`}
                >
                  {r.route_number}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bus list block */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-300">운행 차량 목록 ({buses.length}대)</h2>
            {currentRouteId && <span className="text-[10px] text-slate-500 font-mono">ID: {currentRouteId}</span>}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              <span className="text-xs text-slate-500">차량 위치 데이터를 불러오는 중...</span>
            </div>
          ) : error ? (
            <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-4 text-center">
              <p className="text-xs text-rose-400 font-semibold">{error}</p>
              <button onClick={() => setSelectedRoute(selectedRoute)} className="mt-2.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded font-medium transition-colors">다시 시도</button>
            </div>
          ) : buses.length === 0 ? (
            <div className="bg-slate-800/20 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
              <svg className="w-8 h-8 mx-auto text-slate-600 mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C20.1 10.7 19 8 19 8H5s-1.1 2.7-1.5 3.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2m14 0v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-1m14 0a2 2 0 0 1-2-2H7a2 2 0 0 1-2 2M9 11h6" />
              </svg>
              <p className="text-xs">현재 운행 중인 차량이 없습니다.</p>
              <p className="text-[10px] text-slate-600 mt-1">심야 시간대이거나 미매핑 상태일 수 있습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {buses.map((bus) => {
                const matchStation = stations.find(s => s.stationSeq === bus.stationSeq);
                return (
                  <div
                    key={bus.plateNo}
                    onClick={() => focusOnBus(bus)}
                    className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 hover:border-slate-600 transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg relative overflow-hidden group"
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      bus.crowded === 3 ? 'bg-amber-500' : bus.crowded === 4 ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}></div>

                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                           <span className="font-bold text-white font-mono">{bus.plateNo}</span>
                          {bus.lowPlate === 1 && (
                            <span className="text-[9px] bg-sky-500/20 text-sky-400 px-1 py-0.5 rounded font-extrabold border border-sky-500/30 flex items-center">♿ 저상</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          기사: <span className="text-slate-200 font-semibold">{bus.driverName || '미배정'}</span>
                          {bus.shiftType && <span className="text-slate-500 text-[10px] ml-1">({bus.shiftType} 근무)</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-sky-400 font-mono">{bus.speed} km/h</span>
                        <div className={`text-[10px] mt-1.5 font-bold ${
                          bus.crowded === 3 ? 'text-amber-400' : bus.crowded === 4 ? 'text-rose-400' : 'text-emerald-400'
                        }`}>
                          {bus.crowded === 1 ? '여유' : (bus.crowded === 2 ? '보통' : (bus.crowded === 3 ? '혼잡' : '매우혼잡'))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">현재 위치:</span>
                      <span className="text-slate-300 font-medium max-w-[200px] truncate">{matchStation ? matchStation.stationName : '계산 중'}</span>
                    </div>
                    {bus.remainSeatCnt !== undefined && (
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">잔여 좌석:</span>
                        <span className="text-emerald-400 font-bold font-mono">{bus.remainSeatCnt}석</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* 2. Map Container */}
      <section className="flex-1 relative h-1/2 lg:h-full bg-slate-950">
        {!leafletLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-30 space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            <span className="text-sm text-slate-400">지도를 로딩하고 있습니다...</span>
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Legend Overlay */}
        <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3.5 rounded-xl shadow-2xl z-20 space-y-2.5 text-xs text-slate-300 hidden md:block">
          <h4 className="font-bold text-white border-b border-slate-800 pb-1 mb-1.5">범례 및 요약</h4>
          <div className="flex items-center space-x-2.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> <span>혼잡도: 여유</span></div>
          <div className="flex items-center space-x-2.5"><span className="w-3 h-3 rounded-full bg-blue-500"></span> <span>혼잡도: 보통</span></div>
          <div className="flex items-center space-x-2.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span> <span>혼잡도: 혼잡</span></div>
          <div className="flex items-center space-x-2.5"><span className="w-3 h-3 rounded-full bg-rose-500"></span> <span>혼잡도: 매우혼잡</span></div>
          <div className="flex items-center space-x-2.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-850 border-2 border-sky-400"></span> <span>경유 정류소</span></div>
        </div>
      </section>

      {/* 3. Settings Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-card border border-slate-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">실시간 API 연동 설정</h3>
                <p className="text-xs text-slate-400 mt-1">공공데이터포털 API 연동 정보 및 노선별 routeId 매핑을 관리합니다.</p>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-white p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[500px]">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 block">공공데이터포털 서비스키 (Service Key)</label>
                <div className="flex gap-2">
                  <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="공공데이터포털(data.go.kr)에서 발급받은 인증키 입력" className="flex-1 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 font-mono outline-none" />
                  <button onClick={handleSaveApiKey} disabled={saving} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50">인증키 저장</button>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">* 등록된 키가 없는 경우 데모 시뮬레이션 모드로 활성화됩니다.</p>
              </div>

              <hr className="border-slate-800" />

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white">노선별 GBIS Route ID 조회 및 매핑</h4>
                <form onSubmit={handleSearchRoute} className="flex gap-2">
                  <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder="검색할 버스 노선번호 입력 (예: 138, 3006)" className="flex-1 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-slate-200 outline-none" />
                  <button type="submit" disabled={searching} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-sm border border-slate-700 transition-colors disabled:opacity-50">{searching ? '검색 중...' : '노선 검색'}</button>
                </form>

                {searchResults.length > 0 && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2.5 max-h-48 overflow-y-auto">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">검색 결과 목록</div>
                    <div className="divide-y divide-slate-800/60">
                      {searchResults.map((route) => (
                        <div key={route.routeId} className="flex justify-between items-center py-2 text-xs">
                          <div>
                            <div className="font-bold text-white">{route.routeName} <span className="text-[10px] text-slate-500 font-normal">({route.routeTypeName})</span></div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{route.startStationName} &harr; {route.endStationName} | 관할: {route.adminName}</div>
                          </div>
                          <div className="flex gap-1.5">
                            {routesList.map((r) => (
                              <button key={r.id} onClick={() => handleMapRouteId(r.route_number, route.routeId)} className="px-2 py-1 bg-slate-800 hover:bg-blue-600 text-[10px] font-bold text-slate-300 hover:text-white rounded border border-slate-700 hover:border-blue-500 transition-colors">{r.route_number}에 지정</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400">현재 노선 매핑 현황</div>
                  <div className="grid grid-cols-2 gap-3">
                    {routesList.map((r) => {
                      const id = config.gbis_route_mappings[r.route_number];
                      return (
                        <div key={r.id} className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-white block">{r.route_number}</span>
                            <span className="text-[10px] font-mono text-slate-500 block mt-0.5">{id || '매핑 정보 없음'}</span>
                          </div>
                          {id && (
                            <button key={r.id} onClick={() => handleMapRouteId(r.route_number, '')} className="text-rose-500 hover:text-rose-400 text-[10px] font-semibold">삭제</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end">
              <button onClick={() => setShowConfigModal(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm border border-slate-700 transition-colors">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
