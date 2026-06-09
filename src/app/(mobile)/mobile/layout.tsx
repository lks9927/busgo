'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface Driver {
  id: number;
  name: string;
  employee_id: string;
  phone: string | null;
  driver_type: 'fixed' | 'rotating';
  route_group: 'city' | 'express';
  primary_route: string | null;
  career_level: string;
  status: 'active' | 'retired';
}

interface MobileAuthContextType {
  driver: Driver | null;
  logout: () => void;
}

const MobileAuthContext = createContext<MobileAuthContextType>({
  driver: null,
  logout: () => {},
});

export const useMobileAuth = () => useContext(MobileAuthContext);

// Utility to format phone number to 010-XXXX-XXXX
const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 8) {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  }
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Password Change Modal States
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passSubmitting, setPassSubmitting] = useState(false);

  // Load driver from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('busgo_driver');
    if (saved) {
      try {
        setDriver(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('busgo_driver');
      }
    }
    setLoading(false);
  }, []);

  // Listen for AUTO_LOGIN message from simulator parent window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'AUTO_LOGIN') {
        const { phone, password } = event.data;
        
        // Log out current driver if any, and redirect to mobile login home
        localStorage.removeItem('busgo_driver');
        setDriver(null);
        router.push('/mobile');
        
        // Populate fields
        setPhoneInput(formatPhoneNumber(phone));
        setPasswordInput(password);
        setLoginError(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [router]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneInput(formatted);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim() || !passwordInput.trim()) return;
    setVerifying(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/drivers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneInput.trim(),
          password: passwordInput.trim(),
        }),
      });

      if (!res.ok) {
        let errMsg = '로그인에 실패했습니다.';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `서버 응답 오류 (상태 코드: ${res.status}). 서버나 로컬 터널(localtunnel) 연결을 확인해 주세요.`;
        }
        throw new Error(errMsg);
      }

      const matchedDriver = await res.json();
      localStorage.setItem('busgo_driver', JSON.stringify(matchedDriver));
      setDriver(matchedDriver);
    } catch (err: any) {
      setLoginError(err.message || '인증 과정 중 오류가 발생했습니다.');
    } finally {
      setVerifying(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driver) return;
    setPassError(null);
    setPassSuccess(null);

    if (newPassword !== confirmPassword) {
      setPassError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 4) {
      setPassError('비밀번호는 최소 4자리 이상이어야 합니다.');
      return;
    }

    setPassSubmitting(true);
    try {
      const res = await fetch(`/api/drivers/${driver.id}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        let errMsg = '비밀번호 변경 실패';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `서버 응답 오류 (상태 코드: ${res.status}). 서버나 로컬 터널(localtunnel) 연결을 확인해 주세요.`;
        }
        throw new Error(errMsg);
      }

      setPassSuccess('비밀번호가 안전하게 변경되었습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Auto close after 1.5s
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPassSuccess(null);
      }, 1500);
    } catch (err: any) {
      setPassError(err.message);
    } finally {
      setPassSubmitting(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('busgo_driver');
    setDriver(null);
    router.push('/mobile');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-gray-200 border-t-blue-500"></div>
      </div>
    );
  }

  // Not Logged In -> Render Login Screen (Phone Number & Suffix Password)
  if (!driver) {
    return (
      <div className="min-h-screen bg-bg-dark text-gray-900 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <span className="text-4xl font-extrabold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              BusGo
            </span>
            <h1 className="text-xl font-bold text-gray-900">기사님 모바일 포털</h1>
            <p className="text-xs text-gray-500">전화번호와 지정된 비밀번호로 로그인해 주세요.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">전화번호</label>
              <input
                type="tel"
                required
                placeholder="예: 010-1234-5678"
                value={phoneInput}
                onChange={handlePhoneChange}
                className="w-full rounded-xl bg-white border border-gray-200 text-gray-950 p-3.5 text-sm font-semibold tracking-wider text-center focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">비밀번호</label>
              <input
                type="password"
                required
                placeholder="기본값: 전화번호 뒤 4자리"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full rounded-xl bg-white border border-gray-200 text-gray-950 p-3.5 text-sm font-semibold tracking-wider text-center focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>

            {loginError && (
              <p className="text-xs text-red-500 font-semibold text-center">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={verifying}
              className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-sm disabled:opacity-50"
            >
              {verifying ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="text-[10px] text-gray-400 text-center">
            포천교통 배차관리시스템 &copy; 2026
          </div>
        </div>
      </div>
    );
  }

  // Logged In -> Render Mobile PWA Container
  return (
    <MobileAuthContext.Provider value={{ driver, logout }}>
      <div className="min-h-screen bg-bg-dark text-gray-800 flex flex-col max-w-md mx-auto shadow-xl border-x border-gray-200/50 pb-20 relative font-sans">
        {/* Mobile Header */}
        <header className="px-5 py-4 bg-white/80 border-b border-gray-200/60 sticky top-0 z-30 backdrop-blur-md flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              BusGo
            </span>
            <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md font-bold">PWA</span>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-bold text-gray-800">{driver.name}님</span>
            <button 
              onClick={() => {
                setPassError(null);
                setPassSuccess(null);
                setIsPasswordModalOpen(true);
              }} 
              className="text-blue-500 hover:text-blue-700 font-semibold px-1"
            >
              비번변경
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={logout} className="text-gray-400 hover:text-gray-600 transition-colors font-semibold">
              로그아웃
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-5 overflow-y-auto">
          {children}
        </main>

        {/* Bottom Navigation Tabs */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 border-t border-gray-200/80 backdrop-blur-lg flex justify-around py-2 z-40 shadow-lg">
          <Link
            href="/mobile"
            className={`flex flex-col items-center space-y-1 py-1 px-3 rounded-xl transition ${
              pathname === '/mobile' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[10px] font-bold">홈 스케줄</span>
          </Link>

          <Link
            href="/mobile/schedule"
            className={`flex flex-col items-center space-y-1 py-1 px-3 rounded-xl transition ${
              pathname === '/mobile/schedule' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] font-bold">월간 일정</span>
          </Link>

          <Link
            href="/mobile/leave"
            className={`flex flex-col items-center space-y-1 py-1 px-3 rounded-xl transition ${
              pathname === '/mobile/leave' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[10px] font-bold">휴무 신청</span>
          </Link>

          <Link
            href="/mobile/stats"
            className={`flex flex-col items-center space-y-1 py-1 px-3 rounded-xl transition ${
              pathname === '/mobile/stats' ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
            <span className="text-[10px] font-bold">내 통계</span>
          </Link>
        </nav>

        {/* Change Password Modal */}
        {isPasswordModalOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <form
              onSubmit={handlePasswordChange}
              className="bg-white border border-gray-200 rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <h3 className="text-sm font-bold text-gray-900">비밀번호 변경</h3>
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400">현재 비밀번호</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="rounded-lg border border-gray-200 text-gray-950 p-2 text-xs focus:ring-2 focus:ring-blue-500/30 outline-none"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400">새 비밀번호</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-lg border border-gray-200 text-gray-950 p-2 text-xs focus:ring-2 focus:ring-blue-500/30 outline-none"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400">새 비밀번호 확인</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rounded-lg border border-gray-200 text-gray-950 p-2 text-xs focus:ring-2 focus:ring-blue-500/30 outline-none"
                  />
                </div>
              </div>

              {passError && <p className="text-[10px] text-red-500 font-semibold text-center">{passError}</p>}
              {passSuccess && <p className="text-[10px] text-green-600 font-semibold text-center">{passSuccess}</p>}

              <button
                type="submit"
                disabled={passSubmitting}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl text-xs transition shadow-sm disabled:opacity-50"
              >
                {passSubmitting ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </div>
        )}
      </div>
    </MobileAuthContext.Provider>
  );
}
