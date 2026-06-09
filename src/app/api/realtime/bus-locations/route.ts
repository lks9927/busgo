import { NextResponse } from 'next/server';
import { fetchGbisApi, getSimulatedBuses, ROUTE_DETAILS, getRouteMappings } from '@/lib/realtime';
import { getDB } from '@/lib/db';

function normalizePlateNumber(plate: string): string {
  // Strip region prefix (경기, 서울, etc.) and all spaces/non-alphanumeric chars
  return plate
    .replace(/[^0-9가-힣]/g, '')
    .replace(/^(경기|서울|인천|강원|충북|충남|전북|전남|경북|경남|제주|부산|대구|광주|대전|울산|세종)/, '');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('routeId');

    if (!routeId) {
      return NextResponse.json({ error: 'routeId parameter is required' }, { status: 400 });
    }

    // Identify which route name corresponds to this routeId
    const mappings = await getRouteMappings();
    const routeName = Object.keys(mappings).find(key => mappings[key] === routeId) || '';

    // Fetch active schedules for matching drivers
    let schedules: any[] = [];
    try {
      const db = await getDB();
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Try fetching today's schedules first
      let dbSchedules = await db.all(
        `SELECT s.shift_type, d.name as driver_name, v.vehicle_number 
         FROM schedules s
         JOIN drivers d ON s.driver_id = d.id
         JOIN vehicles v ON s.vehicle_id = v.id
         WHERE s.route = ? AND s.date = ?`,
        [routeName, todayStr]
      );

      // If no schedules found for today, fall back to baseline date '2025-03-03' so we have active demo data
      if (dbSchedules.length === 0) {
        dbSchedules = await db.all(
          `SELECT s.shift_type, d.name as driver_name, v.vehicle_number 
           FROM schedules s
           JOIN drivers d ON s.driver_id = d.id
           JOIN vehicles v ON s.vehicle_id = v.id
           WHERE s.route = ? AND s.date = ?`,
          [routeName, '2025-03-03']
        );
      }
      schedules = dbSchedules;
    } catch (dbError) {
      console.error('Failed to query schedules from DB:', dbError);
    }

    // Create a normalized vehicle-to-driver map
    const vehicleDriverMap: Record<string, { driverName: string; shiftType: string }> = {};
    schedules.forEach((sch) => {
      if (sch.vehicle_number && sch.driver_name) {
        const norm = normalizePlateNumber(sch.vehicle_number);
        vehicleDriverMap[norm] = {
          driverName: sch.driver_name,
          shiftType: sch.shift_type === 'morning' ? '오전' : (sch.shift_type === 'afternoon' ? '오후' : '종일')
        };
      }
    });

    try {
      // Try to fetch from real GBIS API
      const data = await fetchGbisApi('buslocationservice/v2/getBusLocationListv2', { routeId });
      
      let busList = [];
      if (data?.response?.msgBody?.busLocationList) {
        const list = data.response.msgBody.busLocationList;
        busList = Array.isArray(list) ? list : [list];
      }

      const formattedBuses = busList.map((bus: any) => {
        const normPlate = normalizePlateNumber(bus.plateNo);
        const match = vehicleDriverMap[normPlate];
        
        return {
          plateNo: bus.plateNo,
          stationId: String(bus.stationId),
          stationSeq: Number(bus.stationSeq),
          crowded: Number(bus.crowded || 0), // 0: 정보없음, 1: 여유, 2: 보통, 3: 혼잡, 4: 매우혼잡
          lowPlate: Number(bus.lowPlate || 0), // 0: 일반, 1: 저상
          speed: Number(bus.speed || 0),
          remainSeatCnt: bus.remainSeatCnt !== undefined && bus.remainSeatCnt !== '-1' ? Number(bus.remainSeatCnt) : undefined,
          driverName: match?.driverName || null,
          shiftType: match?.shiftType || null,
          isMock: false
        };
      });

      return NextResponse.json(formattedBuses);
    } catch (e: any) {
      // Fallback to mock data if API key is missing or there's an error
      console.warn(`Using mock bus locations for routeId "${routeId}" due to: ${e.message}`);
      
      if (ROUTE_DETAILS[routeId]) {
        const mockBuses = getSimulatedBuses(routeId, ROUTE_DETAILS[routeId].stops.length);
        
        // Map mock buses to drivers from DB if available
        const enrichedMockBuses = mockBuses.map((bus) => {
          const normPlate = normalizePlateNumber(bus.plateNo);
          const match = vehicleDriverMap[normPlate];
          
          // If no match, we can optionally assign a random driver from today's list if database has any
          let driverName = match?.driverName || null;
          let shiftType = match?.shiftType || null;
          
          if (!driverName && schedules.length > 0) {
            // Pick a random schedule that hasn't been assigned yet, or just any random schedule
            const randomSch = schedules[Math.floor(Math.random() * schedules.length)];
            driverName = randomSch.driver_name;
            shiftType = randomSch.shift_type === 'morning' ? '오전' : (randomSch.shift_type === 'afternoon' ? '오후' : '종일');
          }

          return {
            ...bus,
            driverName,
            shiftType,
            isMock: true
          };
        });

        return NextResponse.json(enrichedMockBuses);
      } else {
        return NextResponse.json({ error: 'Route ID not found in database or mocks' }, { status: 404 });
      }
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
