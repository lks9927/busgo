'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface BusType {
  id: number;
  name: string;
  description: string;
}

export default function BusTypesSetupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [busTypes, setBusTypes] = useState<BusType[]>([]);
  const [newBusType, setNewBusType] = useState({ name: '', description: '' });
  const [editingBusTypeId, setEditingBusTypeId] = useState<number | null>(null);
  const [editBusType, setEditBusType] = useState({ name: '', description: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bus-types');
      if (!res.ok) throw new Error('차종 목록을 불러오는데 실패했습니다.');
      const data = await res.json();
      setBusTypes(data);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddBusType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusType.name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/bus-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBusType),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '차종 등록 실패');
      }
      setNewBusType({ name: '', description: '' });
      setMessage({ type: 'success', text: '차종이 성공적으로 등록되었습니다.' });
      fetchData();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditBusType = (type: BusType) => {
    setEditingBusTypeId(type.id);
    setEditBusType({ name: type.name, description: type.description || '' });
    setMessage(null);
  };

  const handleCancelEditBusType = () => {
    setEditingBusTypeId(null);
    setEditBusType({ name: '', description: '' });
    setMessage(null);
  };

  const handleSaveEditBusType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBusType.name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/bus-types/${editingBusTypeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editBusType),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '차종 수정 실패');
      }
      setEditingBusTypeId(null);
      setEditBusType({ name: '', description: '' });
      setMessage({ type: 'success', text: '차종 정보가 성공적으로 수정되었습니다.' });
      fetchData();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBusType = async (id: number) => {
    if (!window.confirm('정말로 이 차종을 삭제하시겠습니까?')) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/bus-types/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '차종 삭제 실패');
      }
      setMessage({ type: 'success', text: '차종이 삭제되었습니다.' });
      fetchData();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 mb-1">
          <span className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[11px] font-bold">STEP 1</span>
          <span className="text-xs text-gray-400 font-medium">초기 설정</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          ① 차종 관리
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          1단계: 운행하는 버스 종류를 먼저 등록하세요. (전기버스, 저상버스, 2층버스 등)
        </p>
      </div>

      {/* Success/Error Message */}
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
        <div className="flex-1 space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Add / Edit Form — Left 1/3 */}
            {editingBusTypeId === null ? (
              <form onSubmit={handleAddBusType} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm h-fit">
                <h3 className="text-base font-bold text-gray-950 border-b border-gray-100 pb-3">신규 차종 추가</h3>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-400">차종명 *</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 전기버스, 2층버스"
                    value={newBusType.name}
                    onChange={(e) => setNewBusType({ ...newBusType, name: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-400">설명</label>
                  <textarea
                    placeholder="차종에 대한 설명"
                    value={newBusType.description}
                    onChange={(e) => setNewBusType({ ...newBusType, description: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 h-20 outline-none transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {saving ? '등록 중...' : '등록하기'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSaveEditBusType} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm h-fit">
                <h3 className="text-base font-bold text-blue-600 border-b border-gray-100 pb-3">차종 정보 수정</h3>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-400">차종명 *</label>
                  <input
                    type="text"
                    required
                    disabled={editingBusTypeId !== null && editingBusTypeId <= 5}
                    placeholder="예: 전기버스, 2층버스"
                    value={editBusType.name}
                    onChange={(e) => setEditBusType({ ...editBusType, name: e.target.value })}
                    className={`rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition ${
                      editingBusTypeId !== null && editingBusTypeId <= 5 ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''
                    }`}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-400">설명</label>
                  <textarea
                    placeholder="차종에 대한 설명"
                    value={editBusType.description}
                    onChange={(e) => setEditBusType({ ...editBusType, description: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 h-20 outline-none transition resize-none"
                  />
                </div>

                <div className="flex space-x-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {saving ? '저장 중...' : '수정완료'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditBusType}
                    className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-650 hover:bg-gray-50 font-semibold rounded-xl text-sm transition shadow-sm cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              </form>
            )}

            {/* Bus Types Table — Right 2/3 */}
            <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="p-5 border-b border-gray-100 bg-white flex justify-between items-center">
                <h3 className="text-base font-bold text-gray-900">등록된 차종 목록</h3>
                <span className="text-xs text-gray-400 font-medium">총 {busTypes.length}개</span>
              </div>
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-100">
                      <th className="px-5 py-3">차종명</th>
                      <th className="px-5 py-3">설명</th>
                      <th className="px-5 py-3 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {busTypes.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                          등록된 차종이 없습니다. 좌측 폼에서 새 차종을 추가하세요.
                        </td>
                      </tr>
                    ) : (
                      busTypes.map((t) => (
                        <tr key={t.id} className="hover:bg-blue-50/20 transition-colors bg-white">
                          <td className="px-5 py-3 font-bold text-gray-800">{t.name}</td>
                          <td className="px-5 py-3 text-gray-500">{t.description || '-'}</td>
                          <td className="px-5 py-3 text-right space-x-1.5">
                            <button
                              onClick={() => handleStartEditBusType(t)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                            >
                              수정
                            </button>
                            {t.id > 5 && (
                              <button
                                onClick={() => handleDeleteBusType(t.id)}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                              >
                                삭제
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="border-t border-gray-200 pt-6 flex justify-end">
        <Link
          href="/setup/routes"
          className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold rounded-xl transition shadow-md text-sm"
        >
          <span>다음 단계: 노선·차량 관리</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
