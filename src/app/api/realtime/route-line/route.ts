import { NextResponse } from 'next/server';
import { fetchGbisApi, generateStationCoordinates, ROUTE_DETAILS } from '@/lib/realtime';

// Helper to split array into chunks (to prevent too long URLs for OSRM)
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    // Overlap by 1 element to ensure continuous polyline drawing
    const chunk = array.slice(i, i + size);
    chunks.push(chunk);
  }
  return chunks;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('routeId');

    if (!routeId) {
      return NextResponse.json({ error: 'routeId는 필수 매개변수입니다.' }, { status: 400 });
    }

    // 1. Get stations first (from live GBIS API or generate mock stations)
    let stations = [];
    try {
      const stationsRes = await fetchGbisApi('getBusRouteStationListv2', { routeId });
      if (stationsRes?.response?.msgBody?.busRouteStationList) {
        stations = stationsRes.response.msgBody.busRouteStationList.map((st: any) => ({
          stationId: st.stationId,
          stationName: st.stationName,
          stationSeq: parseInt(st.stationSeq),
          x: parseFloat(st.x),
          y: parseFloat(st.y)
        }));
      } else {
        const stationsResV1 = await fetchGbisApi('getBusRouteStationList', { routeId });
        if (stationsResV1?.response?.msgBody?.busRouteStationList) {
          stations = stationsResV1.response.msgBody.busRouteStationList.map((st: any) => ({
            stationId: st.stationId,
            stationName: st.stationName,
            stationSeq: parseInt(st.stationSeq),
            x: parseFloat(st.x),
            y: parseFloat(st.y)
          }));
        }
      }
    } catch (e) {
      // Fallback to mock stations
      if (ROUTE_DETAILS[routeId]) {
        stations = generateStationCoordinates(routeId);
      }
    }

    if (stations.length === 0) {
      return NextResponse.json([]);
    }

    // Sort stations by sequence
    stations.sort((a: any, b: any) => a.stationSeq - b.stationSeq);

    // 2. Fetch road-fitting paths from OSRM (Open Source Routing Machine) API
    // OSRM expects coordinates in "lng,lat" format separated by semicolons
    try {
      // Chunk coordinates to prevent massive request URI lengths (max 25 stops per request)
      const maxStopsPerRequest = 20;
      let finalPath: Array<{ x: number; y: number }> = [];

      for (let i = 0; i < stations.length - 1; i += (maxStopsPerRequest - 1)) {
        const chunk = stations.slice(i, i + maxStopsPerRequest);
        if (chunk.length < 2) break;

        const coordsParam = chunk.map((st: any) => `${st.x},${st.y}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&continue_straight=false`;

        const osrmRes = await fetch(osrmUrl, {
          headers: { 'User-Agent': 'BusGo-Agent' },
          next: { revalidate: 3600 } // Cache routing for 1 hour since road layouts don't change often
        });

        if (osrmRes.ok) {
          const osrmData = await osrmRes.json();
          if (osrmData.routes && osrmData.routes.length > 0) {
            const coords = osrmData.routes[0].geometry.coordinates; // Array of [lng, lat]
            const formattedCoords = coords.map((coord: [number, number]) => ({
              x: coord[0],
              y: coord[1]
            }));
            
            // To prevent duplicates at chunk boundaries
            if (finalPath.length > 0 && formattedCoords.length > 0) {
              finalPath = finalPath.concat(formattedCoords.slice(1));
            } else {
              finalPath = finalPath.concat(formattedCoords);
            }
          }
        }
      }

      if (finalPath.length > 0) {
        return NextResponse.json(finalPath);
      }
    } catch (osrmError) {
      console.error('OSRM Routing failed:', osrmError);
    }

    // 3. Last fallback: if OSRM fails, return direct straight lines between stations
    const fallbackPath = stations.map((st: any) => ({
      x: st.x,
      y: st.y
    }));
    return NextResponse.json(fallbackPath);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
