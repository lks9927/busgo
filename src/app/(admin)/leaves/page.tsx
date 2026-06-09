'use client';

import { useState, useEffect, useMemo } from 'react';

interface LeaveRequest {
  id: number;
  driver_id: number;
  driver_name: string;
  driver_route: string;
  request_type: 'annual' | 'monthly' | 'sick' | 'substitute';
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
}

interface Driver {
  id: number;
  name: string;
  employee_id: string;
  primary_route: string;
}

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newLeave, setNewLeave] = useState({
    driver_id: '',
    request_type: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Driver search states
  const [driverSearch, setDriverSearch] = useState('');
  const [isOpenDriverDropdown, setIsOpenDriverDropdown] = useState(false);

  // Computed selection values
  const selectedDriver = useMemo(() => {
    return drivers.find((d) => String(d.id) === newLeave.driver_id) || null;
  }, [drivers, newLeave.driver_id]);

  const filteredDrivers = useMemo(() => {
    const term = driverSearch.toLowerCase().trim();
    if (!term) return drivers;
    return drivers.filter((d) =>
      d.name.toLowerCase().includes(term) ||
      (d.primary_route && d.primary_route.toLowerCase().includes(term)) ||
      d.employee_id.toLowerCase().includes(term)
    );
  }, [drivers, driverSearch]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/leaves?${params.toString()}`);
      if (!res.ok) throw new Error('휴무 신청 목록을 불러오지 못했습니다.');
      const data = await res.json();
      setLeaves(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await fetch('/api/drivers?status=active');
      if (!res.ok) throw new Error('기사 목록을 불러오지 못했습니다.');
      const data = await res.json();
      setDrivers(data);
    } catch (e: any) {
      console.error(e.message);
    }
  };

  useEffect(() => {
    fetchLeaves();
    fetchDrivers();
  }, [statusFilter]);

  const handleApprove = async (id: number) => {
    if (!confirm('이 휴무 신청을 승인하시겠습니까? 승인 시 예비 기사가 자동으로 대체 배정됩니다.')) return;
    try {
      const res = await fetch(`/api/leaves/${id}/approve`, { method: 'PUT' });
      if (!res.ok) {
        let errMsg = '승인에 실패했습니다.';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `서버 응답 오류 (상태 코드: ${res.status}). 서버나 로컬 터널(localtunnel) 연결을 확인해 주세요.`;
        }
        throw new Error(errMsg);
      }
      fetchLeaves();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('이 휴무 신청을 반려하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/leaves/${id}/reject`, { method: 'PUT' });
      if (!res.ok) throw new Error('반려에 실패했습니다.');
      fetchLeaves();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeave.driver_id || !newLeave.start_date || !newLeave.end_date) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: Number(newLeave.driver_id),
          request_type: newLeave.request_type,
          start_date: newLeave.start_date,
          end_date: newLeave.end_date,
          reason: newLeave.reason,
        }),
      });

      if (!res.ok) {
        let errMsg = '휴무 등록 실패';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `서버 응답 오류 (상태 코드: ${res.status}). 서버나 로컬 터널(localtunnel) 연결을 확인해 주세요.`;
        }
        throw new Error(errMsg);
      }

      setIsModalOpen(false);
      setNewLeave({
        driver_id: '',
        request_type: 'annual',
        start_date: '',
        end_date: '',
        reason: '',
      });
      fetchLeaves();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      {/* Title & Action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            기사 휴무 / 연차 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            기사님들이 신청한 연차, 월차, 병가 등을 승인하고, 승인 시 공정성 점수가 가장 합리적인 예비 기사를 스케줄 대타로 자동 배치합니다.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          휴무 대리 등록
        </button>
      </div>

      {/* Filter Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-wrap gap-4 items-center shadow-sm">
        <div className="flex flex-col space-y-1.5">
          <label className="text-xs text-gray-400 font-semibold uppercase">승인 상태</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-white border border-gray-200 text-gray-900 px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all min-w-[140px]"
          >
            <option value="">전체 상태</option>
            <option value="pending">대기 중 (Pending)</option>
            <option value="approved">승인 완료 (Approved)</option>
            <option value="rejected">반려됨 (Rejected)</option>
          </select>
        </div>
      </div>

      {/* Grid Table with Sticky Header */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex-1 flex flex-col shadow-sm min-h-[400px]">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-200 border-t-blue-500"></div>
          </div>
        ) : error ? (
          <p className="p-8 text-center text-red-500">{error}</p>
        ) : leaves.length === 0 ? (
          <p className="p-8 text-center text-gray-500">조회된 휴무 신청 내역이 없습니다.</p>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 z-20 border-b border-gray-200 bg-gray-50">
                <tr className="bg-gray-50 text-gray-500 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="px-6 py-4 bg-gray-50">신청자</th>
                  <th className="px-6 py-4 bg-gray-50">소속 노선</th>
                  <th className="px-6 py-4 bg-gray-50">휴무 구분</th>
                  <th className="px-6 py-4 bg-gray-50">시작 일자</th>
                  <th className="px-6 py-4 bg-gray-50">종료 일자</th>
                  <th className="px-6 py-4 bg-gray-50">신청 사유</th>
                  <th className="px-6 py-4 bg-gray-50">신청일</th>
                  <th className="px-6 py-4 bg-gray-50">상태</th>
                  <th className="px-6 py-4 text-right bg-gray-50">승인 검토</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-gray-800">{l.driver_name}</td>
                    <td className="px-6 py-3.5 text-gray-500 font-medium">{l.driver_route || '지정 없음'}</td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-1 bg-gray-100 border border-gray-200 text-gray-600 rounded-full text-[10px] font-semibold">
                        {l.request_type === 'annual'
                          ? '연차'
                          : l.request_type === 'monthly'
                          ? '월차'
                          : l.request_type === 'sick'
                          ? '병가'
                          : '대체 휴무'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-gray-800">{l.start_date}</td>
                    <td className="px-6 py-3.5 font-semibold text-gray-800">{l.end_date}</td>
                    <td className="px-6 py-3.5 text-gray-500 max-w-[200px] truncate">{l.reason || '-'}</td>
                    <td className="px-6 py-3.5 text-gray-400 text-xs">
                      {new Date(l.requested_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          l.status === 'approved'
                            ? 'bg-green-50 text-green-600 border-green-100'
                            : l.status === 'rejected'
                            ? 'bg-red-50 text-red-600 border-red-100'
                            : 'bg-orange-50 text-orange-600 border-orange-100'
                        }`}
                      >
                        {l.status === 'approved' ? '승인' : l.status === 'rejected' ? '반려' : '대기 중'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
                      {l.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleApprove(l.id)}
                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleReject(l.id)}
                            className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold border border-gray-200 shadow-sm transition"
                          >
                            반려
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium mr-2">검토 완료</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Leave Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCreateLeave}
            className="bg-white border border-gray-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">기사 휴무 대리 등록</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Driver Selector */}
              <div className="flex flex-col space-y-1 relative">
                <label className="text-xs font-bold text-gray-500">기사 선택 *</label>
                
                {/* Trigger Select Button */}
                <div 
                  onClick={() => setIsOpenDriverDropdown(!isOpenDriverDropdown)}
                  className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus-within:ring-2 focus-within:ring-blue-500/30 cursor-pointer flex justify-between items-center transition"
                >
                  <span className={selectedDriver ? 'text-gray-900 font-semibold' : 'text-gray-400'}>
                    {selectedDriver 
                      ? `${selectedDriver.name} (${selectedDriver.primary_route || '무소속'} - ${selectedDriver.employee_id})` 
                      : '휴무를 신청할 기사 검색 및 선택'}
                  </span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>

                {/* Dropdown Panel */}
                {isOpenDriverDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setIsOpenDriverDropdown(false)} 
                    />
                    <div className="absolute top-[100%] left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2.5 space-y-2 flex flex-col max-h-60">
                      <input
                        type="text"
                        autoFocus
                        placeholder="기사 이름, 노선, 사번으로 검색..."
                        value={driverSearch}
                        onChange={(e) => setDriverSearch(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-gray-900 outline-none"
                      />
                      
                      <div className="overflow-y-auto flex-1 divide-y divide-gray-50 max-h-40">
                        {filteredDrivers.length === 0 ? (
                          <div className="text-xs text-gray-400 text-center py-4">검색 결과가 없습니다.</div>
                        ) : (
                          filteredDrivers.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                setNewLeave({ ...newLeave, driver_id: String(d.id) });
                                setIsOpenDriverDropdown(false);
                                setDriverSearch('');
                              }}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 rounded-lg transition-colors flex justify-between items-center ${
                                newLeave.driver_id === String(d.id) ? 'bg-blue-50/50 text-blue-600 font-bold' : 'text-gray-700'
                              }`}
                            >
                              <span>{d.name} ({d.primary_route || '무소속'})</span>
                              <span className="text-[10px] text-gray-400 font-mono">{d.employee_id}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Leave Type */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-gray-500">휴무 유형 *</label>
                <select
                  value={newLeave.request_type}
                  onChange={(e) => setNewLeave({ ...newLeave, request_type: e.target.value })}
                  className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                >
                  <option value="annual">연차 휴무</option>
                  <option value="monthly">월차 휴무</option>
                  <option value="sick">병가 휴직</option>
                  <option value="substitute">대체 휴무</option>
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500">시작일 *</label>
                  <input
                    type="date"
                    required
                    value={newLeave.start_date}
                    onChange={(e) => setNewLeave({ ...newLeave, start_date: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500">종료일 *</label>
                  <input
                    type="date"
                    required
                    value={newLeave.end_date}
                    onChange={(e) => setNewLeave({ ...newLeave, end_date: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-gray-500">사유</label>
                <textarea
                  value={newLeave.reason}
                  onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                  placeholder="예: 개인 사정으로 인한 연차 신청"
                  className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition h-20 resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                className="px-5 py-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition text-sm font-semibold"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-sm"
              >
                {submitting ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
