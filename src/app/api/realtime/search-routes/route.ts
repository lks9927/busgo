import { NextResponse } from 'next/server';
import { fetchGbisApi, ROUTE_DETAILS } from '@/lib/realtime';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword');

    if (!keyword) {
      return NextResponse.json({ error: 'keyword parameter is required' }, { status: 400 });
    }

    try {
      // Try to fetch from real GBIS API
      const data = await fetchGbisApi('busrouteservice/v2/getBusRouteListv2', { keyword });
      
      let routes = [];
      if (data?.response?.msgBody?.busRouteList) {
        const list = data.response.msgBody.busRouteList;
        routes = Array.isArray(list) ? list : [list];
      }
      
      return NextResponse.json(routes);
    } catch (e: any) {
      // Fallback to mock search results if API key is missing or there's an error
      console.warn(`Using mock route search results for keyword "${keyword}" due to: ${e.message}`);
      
      // Filter routes in ROUTE_DETAILS that match the keyword
      const mockResults = Object.entries(ROUTE_DETAILS)
        .filter(([_, value]) => value.name.includes(keyword) || keyword.includes(value.name.replace('번', '')))
        .map(([key, value]) => ({
          routeId: key,
          routeName: value.name,
          routeTypeCd: value.type === '직행좌석' ? '11' : (value.type === '일반좌석' ? '12' : '13'),
          routeTypeName: value.type,
          startStationName: value.start,
          endStationName: value.end,
          adminName: '포천시',
          districtCd: '2', // Gyeonggi
          isMock: true
        }));

      return NextResponse.json(mockResults);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
