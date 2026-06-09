import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import re from 'react'; // React is not needed here, but keeping standard import patterns if any. We can just use raw JS/TS.

function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function POST(request: Request) {
  try {
    const db = await getDB();
    const body = await request.json();
    const { phone, password } = body;

    if (!phone || !password) {
      return NextResponse.json({ error: '전화번호와 비밀번호를 모두 입력해주세요.' }, { status: 400 });
    }

    const cleanInputPhone = cleanPhoneNumber(phone);

    // Fetch active drivers
    const drivers = await db.all("SELECT * FROM drivers WHERE status = 'active'");
    
    // Find driver with matching phone number (ignoring hyphens/spaces) and password
    const matched = drivers.find((d: any) => {
      if (!d.phone) return false;
      const cleanDbPhone = cleanPhoneNumber(d.phone);
      return cleanDbPhone === cleanInputPhone && d.password === password;
    });

    if (!matched) {
      return NextResponse.json({ error: '일치하는 기사 정보가 없거나 비밀번호가 틀립니다.' }, { status: 401 });
    }

    // Return matched driver details (omit password for safety)
    const { password: _, ...driverInfo } = matched;
    return NextResponse.json(driverInfo);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
