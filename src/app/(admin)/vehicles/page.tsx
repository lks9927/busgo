'use client';

import { useState, useEffect } from 'react';

interface Vehicle {
  id: number;
  vehicle_number: string;
  route: string | null;
  rotation_order: number | null;
  bus_type_id: number | null;
  bus_type_name: string | null;
  status: 'active' | 'standby' | 'broken' | 'maintenance' | 'accident' | 'retired';
}

interface BusType {
  id: number;
  name: string;
  description: string;
}

interface RouteItem {
  id: number;
  route_number: string;
  route_name: string | null;
  route_group: string;
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [busTypes, setBusTypes] = useState<BusType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteItem[]>([]);

  // Filters
  const [routeFilter, setRouteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (routeFilter) params.append('route', routeFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/vehicles?${params.toString()}`);
      if (!res.ok) throw new Error('차량 목록을 불러오지 못했습니다.');
      const data = await res.json();
      setVehicles(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusTypes = async () => {
    try {
      const res = await fetch('/api/bus-types');
      if (res.ok) setBusTypes(await res.json());
    } catch (e) {
      console.error('Failed to fetch bus types:', e);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [routeFilter, statusFilter]);

  useEffect(() => {
    fetchBusTypes();
    // Fetch routes dynamically
    fetch('/api/routes').then(r => r.ok ? r.json() : []).then(setRoutes).catch(() => {});
  }, []);

  const handleOpenAddModal = () => {
    setEditingVehicle({
      vehicle_number: '',
      route: '138번',
      rotation_order: null,
      bus_type_id: 1, // '일반' (ID=1) 기본 선택
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (vehicle: Vehicle) => {
    setEditingVehicle({ ...vehicle });
    setIsModalOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle?.vehicle_number) return;
    setSubmitting(true);
    try {
      const isEdit = !!editingVehicle.id;
      const url = isEdit ? `/api/vehicles/${editingVehicle.id}` : '/api/vehicles';
      const method = isEdit ? 'PUT' : 'POST';

      const bodyData = {
        ...editingVehicle,
        rotation_order: editingVehicle.rotation_order ? Number(editingVehicle.rotation_order) : null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        let errMsg = '차량 정보 저장 실패';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `서버 응답 오류 (상태 코드: ${res.status}). 서버나 로컬 터널(localtunnel) 연결을 확인해 주세요.`;
        }
        throw new Error(errMsg);
      }

      setIsModalOpen(false);
      setEditingVehicle(null);
      fetchVehicles();
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
            차량 관리 마스터
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            각 노선에 소속된 버스 차량 정보와 로테이션 순서, 차량 정비 및 운행 상태를 실시간으로 관리합니다.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          차량 신규 등록
        </button>
      </div>

      {/* Route Tabs */}
      <div className="flex border-b border-gray-150 pb-1">
        <div className="flex flex-wrap gap-1.5 bg-gray-100/80 p-1 rounded-2xl border border-gray-200 shadow-sm">
          {['', ...routes.map(r => r.route_number)].map((route) => (
            <button
              key={route}
              onClick={() => setRouteFilter(route)}
              className={`px-4.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                routeFilter === route
                  ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                  : 'text-gray-500 hover:text-gray-950 hover:bg-white/50'
              }`}
            >
              {route || '전체 노선'}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-wrap gap-4 items-center shadow-sm">

        <div className="flex flex-col space-y-1.5">
          <label className="text-xs text-gray-400 font-semibold uppercase">차량 상태</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl bg-white border border-gray-200 text-gray-900 px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all min-w-[140px]"
          >
            <option value="">전체 상태</option>
            <option value="active">운행 중</option>
            <option value="standby">대기 중</option>
            <option value="broken">고장</option>
            <option value="maintenance">수리 중</option>
            <option value="accident">사고</option>
            <option value="retired">운행 종료 / 폐차</option>
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
        ) : vehicles.length === 0 ? (
          <p className="p-8 text-center text-gray-500">등록된 차량 정보가 없습니다.</p>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-xs border-collapse relative">
              <thead className="sticky top-0 z-20 border-b border-gray-200">
                <tr className="bg-gray-50 text-gray-500 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="px-6 py-4 bg-gray-50">차량 번호</th>
                  <th className="px-6 py-4 bg-gray-50">소속 노선</th>
                  <th className="px-6 py-4 bg-gray-50">차종</th>
                  <th className="px-6 py-4 bg-gray-50">로테이션 순서</th>
                  <th className="px-6 py-4 bg-gray-50">상태</th>
                  <th className="px-6 py-4 text-right bg-gray-50">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-gray-800 text-sm">{v.vehicle_number}</td>
                    <td className="px-6 py-3.5 text-blue-600 font-semibold">{v.route || '미지정'}</td>
                    <td className="px-6 py-3.5 font-semibold text-gray-700">
                      {v.bus_type_name ? (
                        <span className="px-2 py-1 bg-blue-50 text-blue-650 border border-blue-100 rounded-lg text-[10px] font-bold">
                          {v.bus_type_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {v.rotation_order !== null ? (
                        <span className="px-2.5 py-1 bg-gray-100 rounded-full text-[10px] text-gray-600 font-mono font-semibold">
                          {v.rotation_order}번 순서
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">순서 없음 (고정)</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`w-2 h-2 rounded-full inline-block mr-2 ${
                          v.status === 'active'
                            ? 'bg-green-500'
                            : v.status === 'standby'
                            ? 'bg-blue-500'
                            : v.status === 'broken'
                            ? 'bg-red-500'
                            : v.status === 'maintenance'
                            ? 'bg-amber-500'
                            : v.status === 'accident'
                            ? 'bg-rose-500'
                            : 'bg-gray-400'
                        }`}
                      ></span>
                      <span
                        className={`text-xs font-semibold ${
                          v.status === 'active'
                            ? 'text-green-600'
                            : v.status === 'standby'
                            ? 'text-blue-600'
                            : v.status === 'broken'
                            ? 'text-red-600'
                            : v.status === 'maintenance'
                            ? 'text-amber-600'
                            : v.status === 'accident'
                            ? 'text-rose-600'
                            : 'text-gray-400'
                        }`}
                      >
                        {v.status === 'active'
                          ? '운행 중'
                          : v.status === 'standby'
                          ? '대기 중'
                          : v.status === 'broken'
                          ? '고장'
                          : v.status === 'maintenance'
                          ? '수리 중'
                          : v.status === 'accident'
                          ? '사고'
                          : '운행 종료 / 폐차'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenEditModal(v)}
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold border border-gray-200 shadow-sm transition"
                      >
                        수정
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && editingVehicle && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSaveVehicle}
            className="bg-white border border-gray-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">
                {editingVehicle.id ? '차량 정보 수정' : '차량 신규 등록'}
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

            <div className="p-6 space-y-4">
              {/* Vehicle Number */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-gray-500">차량 번호 *</label>
                <input
                  type="text"
                  required
                  value={editingVehicle.vehicle_number || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, vehicle_number: e.target.value })}
                  placeholder="예: 1156"
                  className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                />
              </div>

              {/* Route */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-gray-500">배정 노선</label>
                <select
                  value={editingVehicle.route || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, route: e.target.value || null })}
                  className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                >
                  <option value="">소속 노선 없음</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.route_number}>
                      {r.route_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bus Type */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-gray-500">차종 *</label>
                <select
                  value={editingVehicle.bus_type_id || ''}
                  onChange={(e) => setEditingVehicle({ ...editingVehicle, bus_type_id: e.target.value ? Number(e.target.value) : null })}
                  className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                >
                  <option value="">차종 선택 안 함</option>
                  {busTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rotation Order */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-gray-500">로테이션 순번 (선택 사항)</label>
                <input
                  type="number"
                  value={editingVehicle.rotation_order || ''}
                  onChange={(e) =>
                    setEditingVehicle({
                      ...editingVehicle,
                      rotation_order: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="순번을 입력해주세요 (예: 1)"
                  className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition"
                />
              </div>

              {/* Status */}
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-bold text-gray-500">차량 상태</label>
                <select
                  value={editingVehicle.status || 'active'}
                  onChange={(e: any) => setEditingVehicle({ ...editingVehicle, status: e.target.value })}
                  className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                >
                  <option value="active">운행 중 (Active)</option>
                  <option value="standby">대기 중 (Standby)</option>
                  <option value="broken">고장 (Broken)</option>
                  <option value="maintenance">수리 중 (Maintenance)</option>
                  <option value="accident">사고 (Accident)</option>
                  <option value="retired">운행 종료 / 폐차 (Retired)</option>
                </select>
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
