'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('설정을 불러오는데 실패했습니다.');
      const data = await res.json();
      setSettings(data);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('설정 저장에 실패했습니다.');
      setMessage({ type: 'success', text: '시스템 설정이 저장되었습니다.' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-8 space-y-6 max-w-3xl mx-auto min-h-screen flex flex-col">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          시스템 환경설정
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          회사 정보 및 시스템 기본 환경을 설정합니다.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-sm font-semibold flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-200 border-t-blue-500"></div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6 flex-1">
          {/* 회사 정보 */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950 border-b border-gray-100 pb-4">
              회사 정보
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col space-y-2">
                <label className="text-xs font-bold text-gray-400">회사명</label>
                <input
                  type="text"
                  value={settings.company_name || '포천교통'}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                />
              </div>
              <div className="flex flex-col space-y-2">
                <label className="text-xs font-bold text-gray-400">관리자 연락처</label>
                <input
                  type="text"
                  placeholder="010-1234-5678"
                  value={settings.admin_phone || ''}
                  onChange={(e) => handleChange('admin_phone', e.target.value)}
                  className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* 기초 설정 바로가기 */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950 border-b border-gray-100 pb-4">
              기초 설정 바로가기
            </h2>
            <p className="text-sm text-gray-500">
              신규 회사 설정은 아래 순서대로 진행하세요.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { step: 1, label: '차종 관리', desc: '버스 종류 등록', href: '/setup/bus-types', color: 'blue' },
                { step: 2, label: '노선·차량 관리', desc: '노선 등록 및 차량 배정', href: '/setup/routes', color: 'green' },
                { step: 3, label: '기사 관리', desc: '기사 배정 및 파트너 지정', href: '/drivers', color: 'indigo' },
                { step: 4, label: '시간표·운행 설정', desc: '시간표, 교대, 감차 규칙', href: '/setup/operations', color: 'purple' },
              ].map((item) => (
                <a
                  key={item.step}
                  href={item.href}
                  className="flex items-center space-x-3 p-4 bg-gray-50/50 hover:bg-blue-50/30 border border-gray-100 hover:border-blue-200 rounded-xl transition group"
                >
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg bg-${item.color}-500/10 text-${item.color}-600 text-xs font-extrabold flex items-center justify-center border border-${item.color}-500/20`}>
                    {item.step}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-gray-800 group-hover:text-blue-700 transition">{item.label}</div>
                    <div className="text-[11px] text-gray-400">{item.desc}</div>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition ml-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold rounded-xl transition shadow-md disabled:opacity-50 text-sm"
            >
              {saving ? '저장 중...' : '환경설정 저장하기'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
