'use client';

import { useState, useEffect } from 'react';

interface Driver {
  id: number;
  name: string;
  phone: string | null;
  primary_route: string | null;
  password?: string;
}

export default function MobilePreviewPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    async function loadTestDrivers() {
      try {
        const res = await fetch('/api/drivers?status=active');
        if (res.ok) {
          const data = await res.json();
          // Filter drivers who have phone numbers and pick first few for demo
          const testDrivers = data.filter((d: Driver) => d.phone).slice(0, 6);
          setDrivers(testDrivers);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadTestDrivers();
  }, []);

  const handleDriverClick = (phone: string, password: string) => {
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      // Send a message to the iframe to auto login the driver
      iframe.contentWindow.postMessage({ type: 'AUTO_LOGIN', phone, password }, '*');
    }
  };

  const handleResetSimulator = () => {
    setIframeKey(prev => prev + 1);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          기사앱 모바일 시뮬레이터
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          기사 리스트를 클릭하면 오른쪽 스마트폰 화면에 즉시 로그인 정보가 입력되어 바로 로그인 화면을 테스트할 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-[600px] items-start">
        {/* Left Side: Test Drivers Info Table (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">테스트용 기사 계정 목록</h2>
              <p className="text-xs text-gray-500 mt-1">
                아래 기사 행을 **클릭**하시면 오른쪽 스마트폰 화면에 **로그인 정보가 자동으로 입력**됩니다.
              </p>
            </div>

            {loading ? (
              <div className="py-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-gray-100 border-t-blue-500"></div>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="px-4 py-3">이름</th>
                      <th className="px-4 py-3">소속 노선</th>
                      <th className="px-4 py-3">로그인 아이디 (전화번호)</th>
                      <th className="px-4 py-3">기본 비밀번호 (뒤 4자리)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                    {drivers.map((d) => {
                      const cleanPhone = d.phone || '';
                      const digits = cleanPhone.replace(/\D/g, '');
                      const suffix = digits.length >= 4 ? digits.slice(-4) : '0000';

                      return (
                        <tr 
                          key={d.id}
                          onClick={() => handleDriverClick(cleanPhone, suffix)}
                          className="hover:bg-blue-50/40 cursor-pointer transition-colors active:bg-blue-50"
                          title="클릭 시 시뮬레이터 자동 로그인"
                        >
                          <td className="px-4 py-3 font-bold text-gray-800">{d.name}</td>
                          <td className="px-4 py-3 text-blue-600 font-semibold">{d.primary_route || '무소속'}</td>
                          <td className="px-4 py-3 font-mono font-medium">{d.phone}</td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-1 bg-gray-100 rounded-full font-mono text-[10px] font-bold text-gray-600">
                              {suffix}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4.5 text-xs text-blue-800 space-y-2.5">
              <h4 className="font-bold">💡 시뮬레이터 테스트 방법</h4>
              <ul className="list-disc pl-4 space-y-1.5 font-medium text-blue-700">
                <li>위 표에서 테스트하고 싶은 기사님의 행(줄)을 **클릭**합니다.</li>
                <li>오른쪽 아이폰 화면이 즉시 로그인 화면으로 전환되며 해당 기사님의 정보가 **자동으로 입력**됩니다.</li>
                <li>오른쪽 화면에서 **[로그인]** 버튼을 누르시면 로그인이 완료됩니다.</li>
                <li>로그인 후 **홈 스케줄, 휴무 신청, 내 통계, 비밀번호 변경** 등을 자유롭게 조작하실 수 있습니다.</li>
                <li>시뮬레이터를 강제 로그아웃하거나 화면을 원상태로 돌리고 싶다면 아래 버튼을 눌러주세요.</li>
              </ul>
              
              <button
                onClick={handleResetSimulator}
                className="mt-2.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs transition"
              >
                시뮬레이터 화면 초기화
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Beautiful Apple iPhone Mockup Frame (5 cols) */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative mx-auto border-[12px] border-gray-900 rounded-[50px] h-[780px] w-[370px] shadow-2xl bg-gray-950 flex flex-col overflow-hidden">
            {/* iPhone Dynamic Island */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-full z-20 flex items-center justify-between px-3">
              <div className="w-2.5 h-2.5 bg-gray-950 rounded-full border border-gray-800"></div>
              <div className="w-1.5 h-1.5 bg-blue-900 rounded-full"></div>
            </div>

            {/* iPhone Speaker Bar */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-14 h-1 bg-gray-900 rounded-full z-20"></div>

            {/* Simulated Mobile Iframe */}
            <div className="flex-1 w-full h-full bg-slate-50 pt-3 relative rounded-[38px] overflow-hidden">
              <iframe
                key={iframeKey}
                src="/mobile"
                className="w-full h-full border-none rounded-[38px]"
                title="Mobile Application Simulator"
              />
            </div>

            {/* iPhone Home Indicator */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-gray-900 rounded-full z-20"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
