'use client';

import { useState, useEffect } from 'react';

interface Driver {
  id: number;
  name: string;
  employee_id: string | null;
  phone: string | null;
  driver_type: 'fixed' | 'rotating';
  route_group: 'city' | 'express';
  primary_route: string | null;
  career_level: 'junior' | 'regular' | 'senior';
  qualified_routes: string; // JSON array string
  pair_driver_id: number | null;
  vehicle_id: number | null;
  qualified_bus_types: number[];
  status: 'active' | 'retired';
}

interface BusType {
  id: number;
  name: string;
  description: string;
}

interface Vehicle {
  id: number;
  vehicle_number: string;
  route: string | null;
  status: string;
}

interface RouteItem {
  id: number;
  route_number: string;
  route_name: string | null;
  route_group: string;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [busTypes, setBusTypes] = useState<BusType[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [routeFilter, setRouteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [typeFilter, setTypeFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Partial<Driver> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (routeFilter) params.append('route', routeFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);

      const res = await fetch(`/api/drivers?${params.toString()}`);
      if (!res.ok) throw new Error('기사 목록을 불러오지 못했습니다.');
      const data = await res.json();
      setDrivers(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatsData = async () => {
    try {
      const [driversRes, leavesRes, busTypesRes, vehiclesRes] = await Promise.all([
        fetch('/api/drivers'),
        fetch('/api/leaves?status=approved'),
        fetch('/api/bus-types'),
        fetch('/api/vehicles')
      ]);
      if (driversRes.ok) {
        const driversData = await driversRes.json();
        setAllDrivers(driversData);
      }
      if (leavesRes.ok) {
        const leavesData = await leavesRes.json();
        setLeaves(leavesData);
      }
      if (busTypesRes.ok) {
        setBusTypes(await busTypesRes.json());
      }
      if (vehiclesRes.ok) {
        setVehicles(await vehiclesRes.json());
      }
      // Fetch routes dynamically
      try {
        const routesRes = await fetch('/api/routes');
        if (routesRes.ok) setRoutes(await routesRes.json());
      } catch (e) {
        console.error('Failed to fetch routes:', e);
      }
    } catch (e) {
      console.error('Failed to fetch driver stats:', e);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [routeFilter, statusFilter, typeFilter]);

  useEffect(() => {
    fetchStatsData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingDriver({
      name: '',
      employee_id: '',
      phone: '',
      driver_type: 'fixed',
      route_group: 'city',
      primary_route: '138번',
      career_level: 'regular',
      qualified_routes: '[]',
      pair_driver_id: null,
      vehicle_id: null,
      qualified_bus_types: [1], // '일반' (ID=1) 기본 선택
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (driver: Driver) => {
    setEditingDriver({ ...driver });
    setIsModalOpen(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver?.name) return;
    setSubmitting(true);
    try {
      const isEdit = !!editingDriver.id;
      const url = isEdit ? `/api/drivers/${editingDriver.id}` : '/api/drivers';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingDriver),
      });

      if (!res.ok) {
        let errMsg = '기사 정보 저장 실패';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `서버 응답 오류 (상태 코드: ${res.status}). 서버나 로컬 터널(localtunnel) 연결을 확인해 주세요.`;
        }
        throw new Error(errMsg);
      }

      setIsModalOpen(false);
      setEditingDriver(null);
      fetchDrivers();
      fetchStatsData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDriver = async (id: number) => {
    if (!confirm('정말로 이 기사를 퇴사 처리(비활성화) 하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/drivers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('기사 삭제 실패');
      fetchDrivers();
      fetchStatsData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto h-full flex flex-col">
      {/* Title & Action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            ③ 기사 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            3단계: 각 차량에 운행 기사를 배정하고, 교대 파트너를 지정하세요.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          기사 신규 등록
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        {/* Total Drivers */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200">
          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">누적 등록 기사</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-gray-950">{allDrivers.length}</span>
            <span className="text-xs text-gray-500 font-medium">명</span>
          </div>
          <div className="mt-1.5 text-[10px] text-gray-400">전체 누적 기록</div>
        </div>

        {/* Active Drivers */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200 border-l-[3px] border-l-green-500">
          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">재직 기사</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-green-600">
              {allDrivers.filter(d => d.status === 'active').length}
            </span>
            <span className="text-xs text-gray-500 font-medium">명</span>
          </div>
          <div className="mt-1.5 text-[10px] text-gray-400">현재 정상 근무 가능</div>
        </div>

        {/* Retired Drivers */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200 border-l-[3px] border-l-gray-400">
          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">퇴사 기사</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-gray-500">
              {allDrivers.filter(d => d.status === 'retired').length}
            </span>
            <span className="text-xs text-gray-500 font-medium">명</span>
          </div>
          <div className="mt-1.5 text-[10px] text-gray-400">퇴직 및 비활성 상태</div>
        </div>

        {/* Fixed Shift Drivers */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200 border-l-[3px] border-l-blue-500">
          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">고정 배차</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-blue-600">
              {allDrivers.filter(d => d.driver_type === 'fixed' && d.status === 'active').length}
            </span>
            <span className="text-xs text-gray-500 font-medium">명</span>
          </div>
          <div className="mt-1.5 text-[10px] text-gray-400">2인 1차 전담제</div>
        </div>

        {/* Rotating Shift Drivers */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200 border-l-[3px] border-l-orange-500">
          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">순환 배차</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-orange-600">
              {allDrivers.filter(d => d.driver_type === 'rotating' && d.status === 'active').length}
            </span>
            <span className="text-xs text-gray-500 font-medium">명</span>
          </div>
          <div className="mt-1.5 text-[10px] text-gray-400">예비 및 SP 기사</div>
        </div>

        {/* Today's Leaves (Annual/Monthly) */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200 border-l-[3px] border-l-indigo-500">
          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">오늘 휴가</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-indigo-600">
              {(() => {
                const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().substring(0, 10);
                return leaves.filter(l => l.status === 'approved' && l.request_type !== 'sick' && todayStr >= l.start_date && todayStr <= l.end_date).length;
              })()}
            </span>
            <span className="text-xs text-gray-500 font-medium">명</span>
          </div>
          <div className="mt-1.5 text-[10px] text-gray-400">연차/월차/대체휴무</div>
        </div>

        {/* Today's Sick Leaves */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200 border-l-[3px] border-l-rose-500">
          <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">오늘 병가</div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-600">
              {(() => {
                const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().substring(0, 10);
                return leaves.filter(l => l.status === 'approved' && l.request_type === 'sick' && todayStr >= l.start_date && todayStr <= l.end_date).length;
              })()}
            </span>
            <span className="text-xs text-gray-500 font-medium">명</span>
          </div>
          <div className="mt-1.5 text-[10px] text-gray-400">병가 및 기타 휴직</div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-wrap gap-4 items-center shadow-sm">
        <div className="flex flex-col space-y-1.5">
          <label className="text-xs text-gray-400 font-semibold uppercase">소속 노선</label>
          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="rounded-xl bg-white border border-gray-200 text-gray-900 px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all min-w-[140px]"
          >
            <option value="">전체 노선</option>
            {routes.map((r) => (
              <option key={r.id} value={r.route_number}>
                {r.route_number}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col space-y-1.5">
          <label className="text-xs text-gray-400 font-semibold uppercase">근무 유형</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl bg-white border border-gray-200 text-gray-900 px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all min-w-[140px]"
          >
            <option value="">전체 유형</option>
            <option value="fixed">고정 배차 기사</option>
            <option value="rotating">순환 배차 기사</option>
          </select>
        </div>

        <div className="flex flex-col space-y-1.5">
          <label className="text-xs text-gray-400 font-semibold uppercase">활동 상태</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-white border border-gray-200 text-gray-900 px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all min-w-[140px]"
          >
            <option value="active">재직 중</option>
            <option value="retired">퇴사자</option>
            <option value="">전체보기</option>
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
        ) : drivers.length === 0 ? (
          <p className="p-8 text-center text-gray-500">등록된 기사 정보가 없습니다.</p>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 z-20 border-b border-gray-200">
                <tr className="bg-gray-50 text-gray-500 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="px-6 py-4 bg-gray-50">사번</th>
                  <th className="px-6 py-4 bg-gray-50">이름</th>
                  <th className="px-6 py-4 bg-gray-50">소속 노선</th>
                  <th className="px-6 py-4 bg-gray-50">근무 유형</th>
                  <th className="px-6 py-4 bg-gray-50">고정 차량</th>
                  <th className="px-6 py-4 bg-gray-50">운전 자격 (차종)</th>
                  <th className="px-6 py-4 bg-gray-50">등급</th>
                  <th className="px-6 py-4 bg-gray-50">연락처</th>
                  <th className="px-6 py-4 bg-gray-50">파트너 기사</th>
                  <th className="px-6 py-4 bg-gray-50">상태</th>
                  <th className="px-6 py-4 text-right bg-gray-50">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drivers.map((d) => (
                  <tr key={d.id} className="hover:bg-blue-50/40 transition-colors bg-white">
                    <td className="px-6 py-3.5 font-mono text-gray-400">{d.employee_id || '-'}</td>
                    <td className="px-6 py-3.5 font-bold text-gray-800">{d.name}</td>
                    <td className="px-6 py-3.5 text-blue-600 font-semibold">{d.primary_route || '무소속'}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          d.driver_type === 'fixed'
                            ? 'bg-blue-50 text-blue-600 border border-blue-100'
                            : 'bg-orange-50 text-orange-600 border border-orange-100'
                        }`}
                      >
                        {d.driver_type === 'fixed' ? '고정 배차' : '순환 배차'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-gray-700">
                      {d.vehicle_id ? (
                        vehicles.find(v => v.id === d.vehicle_id)?.vehicle_number || `ID: ${d.vehicle_id}`
                      ) : (
                        <span className="text-gray-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {d.qualified_bus_types && d.qualified_bus_types.length > 0 ? (
                          d.qualified_bus_types.map((typeId) => {
                            const bt = busTypes.find(t => t.id === typeId);
                            return bt ? (
                              <span key={typeId} className="px-1.5 py-0.5 bg-gray-100 text-gray-650 rounded text-[9px] border border-gray-200 font-medium">
                                {bt.name}
                              </span>
                            ) : null;
                          })
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 capitalize text-gray-500">{d.career_level}</td>
                    <td className="px-6 py-3.5 text-gray-500">{d.phone || '-'}</td>
                    <td className="px-6 py-3.5 text-gray-500">
                      {d.pair_driver_id ? (
                        <span className="font-semibold text-gray-700">
                          {allDrivers.find((partner) => partner.id === d.pair_driver_id)?.name || `ID: ${d.pair_driver_id}`}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`w-2 h-2 rounded-full inline-block mr-1.5 ${
                          d.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                        }`}
                      ></span>
                      <span className={d.status === 'active' ? 'text-gray-700 font-medium' : 'text-gray-400'}>
                        {d.status === 'active' ? '재직' : '퇴사'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(d)}
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold border border-gray-200 shadow-sm transition"
                      >
                        수정
                      </button>
                      {d.status === 'active' && (
                        <button
                          onClick={() => handleDeleteDriver(d.id)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold border border-red-100 transition"
                        >
                          퇴사
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && editingDriver && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSaveDriver}
            className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">
                {editingDriver.id ? '기사 정보 수정' : '기사 신규 등록'}
              </h3>
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

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500">기사 이름 *</label>
                  <input
                    type="text"
                    required
                    value={editingDriver.name || ''}
                    onChange={(e) => setEditingDriver({ ...editingDriver, name: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                  />
                </div>

                {/* Employee ID */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500">사번</label>
                  <input
                    type="text"
                    value={editingDriver.employee_id || ''}
                    onChange={(e) => setEditingDriver({ ...editingDriver, employee_id: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Phone */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500">전화번호</label>
                  <input
                    type="text"
                    placeholder="010-0000-0000"
                    value={editingDriver.phone || ''}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, '');
                      let formatted = digits;
                      if (digits.length >= 4 && digits.length < 8) {
                        formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                      } else if (digits.length >= 8) {
                        formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
                      }
                      setEditingDriver({ ...editingDriver, phone: formatted });
                    }}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                  />
                </div>

                {/* Status */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500">활동 상태</label>
                  <select
                    value={editingDriver.status || 'active'}
                    onChange={(e: any) => setEditingDriver({ ...editingDriver, status: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  >
                    <option value="active">재직 중</option>
                    <option value="retired">퇴사 / 휴직</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Route Group */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500">노선 그룹</label>
                  <select
                    value={editingDriver.route_group || 'city'}
                    onChange={(e: any) => setEditingDriver({ ...editingDriver, route_group: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  >
                    <option value="city">시내 (시내버스)</option>
                    <option value="express">직행 (직행좌석)</option>
                  </select>
                </div>

                {/* Primary Route */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500">소속 노선</label>
                  <select
                    value={editingDriver.primary_route || ''}
                    onChange={(e) => setEditingDriver({ ...editingDriver, primary_route: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  >
                    <option value="">노선 지정 안 함</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.route_number}>
                        {r.route_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Driver Type */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500">근무 유형</label>
                  <select
                    value={editingDriver.driver_type || 'fixed'}
                    onChange={(e: any) => setEditingDriver({ ...editingDriver, driver_type: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  >
                    <option value="fixed">고정 배차 (2인 1차)</option>
                    <option value="rotating">순환 배차 (예비/SP)</option>
                  </select>
                </div>

                {/* Career Level */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500">경력 등급</label>
                  <select
                    value={editingDriver.career_level || 'junior'}
                    onChange={(e: any) => setEditingDriver({ ...editingDriver, career_level: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  >
                    <option value="junior">Junior (신입급)</option>
                    <option value="regular">Regular (일반급)</option>
                    <option value="senior">Senior (숙련급)</option>
                  </select>
                </div>
              </div>

              {/* Pair Driver ID */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-gray-500">파트너 기사 (2인1차 교대 파트너)</label>
                <select
                  value={editingDriver.pair_driver_id || 'null'}
                  onChange={(e) =>
                    setEditingDriver({
                      ...editingDriver,
                      pair_driver_id: e.target.value === 'null' ? null : Number(e.target.value),
                    })
                  }
                  className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                >
                  <option value="null">지정 없음</option>
                  {allDrivers
                    .filter((d) => d.id !== editingDriver.id && d.status === 'active' && d.primary_route === editingDriver.primary_route)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.primary_route || '무소속'} - {d.employee_id})
                      </option>
                    ))}
                </select>
              </div>

              {/* Fixed Vehicle Selector */}
              {editingDriver.driver_type === 'fixed' && (
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-500">고정 차량 (배정 노선 기준)</label>
                  <select
                    value={editingDriver.vehicle_id || 'null'}
                    onChange={(e) =>
                      setEditingDriver({
                        ...editingDriver,
                        vehicle_id: e.target.value === 'null' ? null : Number(e.target.value),
                      })
                    }
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  >
                    <option value="null">차량 없음</option>
                    {vehicles
                      .filter((v) => v.route === editingDriver.primary_route && v.status === 'active')
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vehicle_number}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Driver qualifications checkbox group */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-gray-500">운전 자격 (차종 다중선택)</label>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200/60 max-h-36 overflow-y-auto">
                  {busTypes.map((type) => {
                    const isChecked = editingDriver.qualified_bus_types?.includes(type.id) || false;
                    return (
                      <label key={type.id} className="flex items-center space-x-2 text-xs font-medium text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let list = [...(editingDriver.qualified_bus_types || [])];
                            if (e.target.checked) {
                              list.push(type.id);
                            } else {
                              list = list.filter((id) => id !== type.id);
                            }
                            setEditingDriver({ ...editingDriver, qualified_bus_types: list });
                          }}
                          className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                        />
                        <span>{type.name}</span>
                      </label>
                    );
                  })}
                </div>
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
                {submitting ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
