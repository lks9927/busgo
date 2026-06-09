import { getDB } from './db';

// Typical GBIS Route ID fallbacks for Pocheon Transport
export const FALLBACK_ROUTE_IDS: Record<string, string> = {
  '138번': '224000014',
  '72번': '224000026',
  '137번': '224000013',
  '1386번': '224000019',
  '1403번': '224000045',
  '3003번': '224000050',
  '3006번': '234000035'
};

interface StopInfo {
  name: string;
  coords: [number, number]; // [lat, lng]
}

// Route details with real intermediate stop coordinates to prevent line-to-stop misalignment
export const ROUTE_DETAILS: Record<string, {
  name: string;
  type: string; // '일반' | '일반좌석' | '직행좌석'
  start: string;
  end: string;
  startCoords: [number, number]; // [lat, lng] (y, x)
  endCoords: [number, number];
  stops: StopInfo[];
}> = {
  '224000014': {
    name: '138번',
    type: '일반좌석',
    start: '경복대',
    end: '의정부역',
    startCoords: [37.9261, 127.2064],
    endCoords: [37.7381, 127.0461],
    stops: [
      { name: '경복대', coords: [37.9261, 127.2064] },
      { name: '신북면행정복지센터', coords: [37.9171, 127.2039] },
      { name: '포천소방서', coords: [37.9042, 127.2015] },
      { name: '포천시청', coords: [37.8949, 127.2003] },
      { name: '포천고등학교', coords: [37.8860, 127.1952] },
      { name: '대진대학교', coords: [37.8687, 127.1897] },
      { name: '송우리터미널', coords: [37.8286, 127.1472] },
      { name: '소흘읍사무소', coords: [37.8249, 127.1432] },
      { name: '축석고개', coords: [37.7925, 127.1121] },
      { name: '의정부성모병원', coords: [37.7589, 127.0789] },
      { name: '의정부버스터미널', coords: [37.7471, 127.0620] },
      { name: '의정부역', coords: [37.7381, 127.0461] }
    ]
  },
  '224000026': {
    name: '72번',
    type: '일반',
    start: '하성북리',
    end: '도봉산역',
    startCoords: [37.9023, 127.2185],
    endCoords: [37.6894, 127.0427],
    stops: [
      { name: '하성북리', coords: [37.9023, 127.2185] },
      { name: '포천시청', coords: [37.8949, 127.2003] },
      { name: '대진대학교', coords: [37.8687, 127.1897] },
      { name: '송우리터미널', coords: [37.8286, 127.1472] },
      { name: '이동교5리', coords: [37.8093, 127.1268] },
      { name: '축석검문소', coords: [37.7925, 127.1121] },
      { name: '의정부성모병원', coords: [37.7589, 127.0789] },
      { name: '경기도청북부청사', coords: [37.7533, 127.0673] },
      { name: '의정부역', coords: [37.7381, 127.0461] },
      { name: '회룡역', coords: [37.7145, 127.0471] },
      { name: '망월사역', coords: [37.7001, 127.0435] },
      { name: '도봉산역', coords: [37.6894, 127.0427] }
    ]
  },
  '224000013': {
    name: '137번',
    type: '일반',
    start: '경복대',
    end: '의정부역',
    startCoords: [37.9261, 127.2064],
    endCoords: [37.7381, 127.0461],
    stops: [
      { name: '경복대', coords: [37.9261, 127.2064] },
      { name: '신북면행정복지센터', coords: [37.9171, 127.2039] },
      { name: '포천시청', coords: [37.8949, 127.2003] },
      { name: '용정산업단지', coords: [37.8864, 127.2215] },
      { name: '대진대학교', coords: [37.8687, 127.1897] },
      { name: '송우리터미널', coords: [37.8286, 127.1472] },
      { name: '축석고개', coords: [37.7925, 127.1121] },
      { name: '의정부성모병원', coords: [37.7589, 127.0789] },
      { name: '의정부버스터미널', coords: [37.7471, 127.0620] },
      { name: '의정부역', coords: [37.7381, 127.0461] }
    ]
  },
  '224000019': {
    name: '1386번',
    type: '직행좌석',
    start: '산정호수',
    end: '도봉산역',
    startCoords: [38.0784, 127.3235],
    endCoords: [37.6894, 127.0427],
    stops: [
      { name: '산정호수', coords: [38.0784, 127.3235] },
      { name: '운천터미널', coords: [38.0435, 127.2764] },
      { name: '양문리', coords: [38.0019, 127.2345] },
      { name: '신북면사무소', coords: [37.9171, 127.2039] },
      { name: '포천시청', coords: [37.8949, 127.2003] },
      { name: '대진대학교', coords: [37.8687, 127.1897] },
      { name: '송우리터미널', coords: [37.8286, 127.1472] },
      { name: '축석검문소', coords: [37.7925, 127.1121] },
      { name: '의정부민락지구', coords: [37.7505, 127.0988] },
      { name: '도봉산역', coords: [37.6894, 127.0427] }
    ]
  },
  '224000045': {
    name: '1403번',
    type: '직행좌석',
    start: '경복대',
    end: '고속터미널',
    startCoords: [37.9261, 127.2064],
    endCoords: [37.5056, 127.0049],
    stops: [
      { name: '경복대', coords: [37.9261, 127.2064] },
      { name: '포천시청', coords: [37.8949, 127.2003] },
      { name: '대진대입구', coords: [37.8687, 127.1897] },
      { name: '송우리터미널', coords: [37.8286, 127.1472] },
      { name: '축석고개', coords: [37.7925, 127.1121] },
      { name: '신사역', coords: [37.5164, 127.0204] },
      { name: '논현역', coords: [37.5111, 127.0216] },
      { name: '신논현역', coords: [37.5045, 127.0251] },
      { name: '고속터미널', coords: [37.5056, 127.0049] }
    ]
  },
  '224000050': {
    name: '3003번',
    type: '직행좌석',
    start: '경복대',
    end: '별내역',
    startCoords: [37.9261, 127.2064],
    endCoords: [37.6433, 127.1268],
    stops: [
      { name: '경복대', coords: [37.9261, 127.2064] },
      { name: '포천시청', coords: [37.8949, 127.2003] },
      { name: '대진대학교', coords: [37.8687, 127.1897] },
      { name: '송우리터미널', coords: [37.8286, 127.1472] },
      { name: '민락2지구', coords: [37.7505, 127.0988] },
      { name: '고산지구', coords: [37.7312, 127.1123] },
      { name: '별내역', coords: [37.6433, 127.1268] }
    ]
  },
  '234000035': {
    name: '3006번',
    type: '직행좌석',
    start: '경복대',
    end: '잠실광역환승센터',
    startCoords: [37.9261, 127.2064],
    endCoords: [37.5134, 127.1022],
    stops: [
      { name: '경복대', coords: [37.9261, 127.2064] },
      { name: '포천시청', coords: [37.8949, 127.2003] },
      { name: '대진대입구', coords: [37.8687, 127.1897] },
      { name: '송우리터미널', coords: [37.8286, 127.1472] },
      { name: '잠실광역환승센터', coords: [37.5134, 127.1022] }
    ]
  }
};

export async function getApiKey(): Promise<string> {
  try {
    const db = await getDB();
    const row = await db.get("SELECT value FROM settings WHERE key = 'gbis_api_key'");
    return row ? row.value : '';
  } catch {
    return '';
  }
}

export async function getRouteMappings(): Promise<Record<string, string>> {
  try {
    const db = await getDB();
    const row = await db.get("SELECT value FROM settings WHERE key = 'gbis_route_mappings'");
    if (row && row.value) {
      return JSON.parse(row.value);
    }
  } catch {
    // ignore
  }
  return FALLBACK_ROUTE_IDS;
}

export async function fetchGbisApi(endpoint: string, params: Record<string, string>): Promise<any> {
  const serviceKey = await getApiKey();
  if (!serviceKey) {
    throw new Error('API_KEY_MISSING');
  }

  const queryParams = new URLSearchParams({
    serviceKey,
    format: 'json',
    ...params
  });

  const url = `http://apis.data.go.kr/6410000/${endpoint}?${queryParams.toString()}`;
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      next: { revalidate: 15 } // Cache for 15 seconds
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const text = await res.text();
    
    // Check if the response is actually XML
    if (text.trim().startsWith('<?xml') || text.trim().startsWith('<response>')) {
      if (text.includes('<returnAuthMsg>')) {
        const match = text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/);
        throw new Error(`GBIS Auth Error: ${match ? match[1] : 'Invalid Service Key'}`);
      }
      throw new Error('GBIS returned XML instead of JSON (likely invalid serviceKey or daily quota exceeded)');
    }

    const data = JSON.parse(text);
    return data;
  } catch (error: any) {
    console.error(`GBIS API call failed (${endpoint}):`, error.message);
    throw error;
  }
}

// Map real stop coordinates in order
export function generateStationCoordinates(routeId: string): Array<{
  stationId: string;
  stationName: string;
  stationSeq: number;
  x: number; // lng
  y: number; // lat
}> {
  const route = ROUTE_DETAILS[routeId];
  if (!route) return [];

  return route.stops.map((stop, index) => {
    const [lat, lng] = stop.coords;
    return {
      stationId: `MOCK_${routeId}_${index}`,
      stationName: stop.name,
      stationSeq: index + 1,
      x: lng,
      y: lat
    };
  });
}

// Generate smooth curved line path coordinates for mock demo mode using OSRM-like road-snapping behavior
export function generateRouteLineCoordinates(routeId: string): Array<{ x: number; y: number }> {
  const stations = generateStationCoordinates(routeId);
  if (stations.length === 0) return [];
  
  const lineCoords: Array<{ x: number; y: number }> = [];
  
  for (let i = 0; i < stations.length - 1; i++) {
    const start = stations[i];
    const end = stations[i + 1];
    
    lineCoords.push({ x: start.x, y: start.y });
    
    const steps = 8;
    for (let j = 1; j < steps; j++) {
      const ratio = j / steps;
      // Provide a light wave for intermediate rendering if OSRM is not hit
      const wave = Math.sin(ratio * Math.PI) * 0.0015;
      const x = start.x + (end.x - start.x) * ratio + (i % 2 === 0 ? wave : -wave);
      const y = start.y + (end.y - start.y) * ratio + wave * 0.3;
      
      lineCoords.push({
        x: parseFloat(x.toFixed(6)),
        y: parseFloat(y.toFixed(6))
      });
    }
  }
  
  const last = stations[stations.length - 1];
  lineCoords.push({ x: last.x, y: last.y });
  return lineCoords;
}

// Global variable to keep track of simulated buses across requests
interface SimulatedBus {
  plateNo: string;
  stationSeq: number;
  crowded: number; // 1-4
  lowPlate: number; // 0-1
  speed: number;
  direction: 'up' | 'down';
}

const mockBusesCache: Record<string, SimulatedBus[]> = {};

export function getSimulatedBuses(routeId: string, totalStations: number): Array<{
  plateNo: string;
  stationId: string;
  stationSeq: number;
  crowded: number;
  lowPlate: number;
  speed: number;
  remainSeatCnt?: number;
}> {
  const route = ROUTE_DETAILS[routeId];
  if (!route || totalStations === 0) return [];

  const cacheKey = routeId;
  let buses = mockBusesCache[cacheKey];

  if (!buses) {
    const count = 3 + (routeId.charCodeAt(0) % 4);
    buses = [];
    const prefix = route.type === '직행좌석' ? '경기78아' : '경기70바';
    
    for (let i = 0; i < count; i++) {
      const vehicleNum = 1000 + Math.floor(Math.random() * 9000);
      buses.push({
        plateNo: `${prefix}${vehicleNum}`,
        stationSeq: Math.floor(Math.random() * totalStations) + 1,
        crowded: (Math.floor(Math.random() * 3) + 1),
        lowPlate: Math.random() > 0.7 ? 1 : 0,
        speed: 30 + Math.floor(Math.random() * 40),
        direction: Math.random() > 0.5 ? 'up' : 'down'
      });
    }
    mockBusesCache[cacheKey] = buses;
  } else {
    buses.forEach((bus) => {
      if (Math.random() > 0.2) {
        if (bus.direction === 'up') {
          bus.stationSeq += 1;
          if (bus.stationSeq >= totalStations) {
            bus.direction = 'down';
            bus.stationSeq = totalStations;
          }
        } else {
          bus.stationSeq -= 1;
          if (bus.stationSeq <= 1) {
            bus.direction = 'up';
            bus.stationSeq = 1;
          }
        }
        bus.speed = 20 + Math.floor(Math.random() * 50);
      }
    });
  }

  return buses.map(bus => ({
    plateNo: bus.plateNo,
    stationId: `MOCK_${routeId}_${bus.stationSeq - 1}`,
    stationSeq: bus.stationSeq,
    crowded: bus.crowded,
    lowPlate: bus.lowPlate,
    speed: bus.speed,
    remainSeatCnt: route.type === '직행좌석' ? Math.floor(Math.random() * 45) : undefined
  }));
}
