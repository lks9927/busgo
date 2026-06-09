'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const getLinkClass = (href: string) => {
    const isActive = href === '/' ? pathname === '/' : pathname === href || pathname?.startsWith(href + '/');
    return `flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${
      isActive
        ? 'bg-gray-100 text-gray-900 font-semibold'
        : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
    }`;
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="px-4 pt-5 pb-1.5">
      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">{children}</span>
    </div>
  );

  const StepBadge = ({ step }: { step: number }) => (
    <span className="flex-shrink-0 w-5 h-5 rounded-md bg-blue-500/10 text-blue-600 text-[10px] font-extrabold flex items-center justify-center border border-blue-500/20">
      {step}
    </span>
  );

  return (
    <div className="flex h-screen bg-bg-dark text-text-primary overflow-hidden">
      {/* Sidebar Navigation - Apple Style */}
      <aside className="w-64 bg-white/80 backdrop-blur-xl border-r border-gray-200/80 flex flex-col justify-between z-10">
        <div className="flex-1 overflow-y-auto">
          {/* Logo / Title */}
          <div className="p-6 border-b border-gray-200/80 flex items-center space-x-3">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent notranslate" translate="no">
              BusGo
            </span>
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full font-medium">
              포천교통
            </span>
          </div>

          {/* Section 1: 운영 관리 */}
          <SectionLabel>운영 관리</SectionLabel>
          <nav className="px-3 space-y-0.5">
            <Link href="/" className={getLinkClass('/')}>
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>대시보드</span>
            </Link>

            <Link href="/realtime" className={getLinkClass('/realtime')}>
              <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <span>실시간 관제</span>
            </Link>

            <Link href="/dispatch" className={getLinkClass('/dispatch')}>
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>배차 관리</span>
            </Link>

            <Link href="/leaves" className={getLinkClass('/leaves')}>
              <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>휴무 관리</span>
            </Link>

            <Link href="/fairness" className={getLinkClass('/fairness')}>
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
              <span>공정성 지표</span>
            </Link>
          </nav>

          {/* Section 2: 기초 설정 */}
          <SectionLabel>기초 설정</SectionLabel>
          <nav className="px-3 space-y-0.5">
            <Link href="/setup/bus-types" className={getLinkClass('/setup/bus-types')}>
              <StepBadge step={1} />
              <span>차종 관리</span>
            </Link>

            <Link href="/setup/routes" className={getLinkClass('/setup/routes')}>
              <StepBadge step={2} />
              <span>노선·차량 관리</span>
            </Link>

            <Link href="/drivers" className={getLinkClass('/drivers')}>
              <StepBadge step={3} />
              <span>기사 관리</span>
            </Link>

            <Link href="/setup/operations" className={getLinkClass('/setup/operations')}>
              <StepBadge step={4} />
              <span>시간표·운행 설정</span>
            </Link>
          </nav>

          {/* Section 3: 도구 */}
          <SectionLabel>도구</SectionLabel>
          <nav className="px-3 space-y-0.5">
            <Link href="/onboarding" className={getLinkClass('/onboarding')}>
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              <span>일괄 등록 (엑셀)</span>
            </Link>

            <Link href="/preview" className={getLinkClass('/preview')}>
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>기사앱 미리보기</span>
            </Link>

            <Link href="/settings" className={getLinkClass('/settings')}>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>시스템 환경설정</span>
            </Link>
          </nav>
        </div>

        {/* Footer Area */}
        <div className="p-4 border-t border-gray-200/80 space-y-2">
          <Link
            href="/mobile"
            target="_blank"
            className="flex items-center justify-center space-x-2 w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm"
          >
            <span>기사용 모바일 웹</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </Link>
          <div className="text-xs text-gray-400 text-center">
            관리자 모드 v1.1.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-bg-dark relative">
        {children}
      </main>
    </div>
  );
}
