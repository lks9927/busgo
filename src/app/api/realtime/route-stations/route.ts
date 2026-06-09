import { NextResponse } from 'next/server';
import { fetchGbisApi, generateStationCoordinates, ROUTE_DETAILS } from '@/lib/realtime';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('routeId');

    if (!routeId) {
      return NextResponse.json({ error: 'routeId parameter is required' }, { status: 400 });
    }

    try {
      // Try to fetch from real GBIS API
      const data = await fetchGbisApi('busrouteservice/v2/getBusRouteStationListv2', { routeId });
      
      let stations = [];
      if (data?.response?.msgBody?.busRouteStationList) {
        const list = data.response.msgBody.busRouteStationList;
        stations = Array.isArray(list) ? list : [list];
      }
      
      // Map GBIS data fields to our expected format
      const formattedStations = stations.map((st: any) => ({
        stationId: String(st.stationId),
        stationName: st.stationName,
        stationSeq: Number(st.stationSeq),
        x: Number(st.x), // Lng
        y: Number(st.y)  // Lat
      })).sort((a, b) => a.stationSeq - b.stationSeq);

      if (formattedStations.length === 0) {
        throw new Error('No stations found from GBIS');
      }

      return NextResponse.json(formattedStations);
    } catch (e: any) {
      // Fallback to mock data if API key is missing or there's an error
      console.warn(`Using mock route stations for routeId "${routeId}" due to: ${e.message}`);
      
      if (ROUTE_DETAILS[routeId]) {
        const mockStations = generateStationCoordinates(routeId);
        return NextResponse.json(mockStations);
      } else {
        return NextResponse.json({ error: 'Route ID not found in database or mocks' }, { status: 404 });
      }
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
