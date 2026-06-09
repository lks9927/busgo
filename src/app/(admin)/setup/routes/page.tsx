'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Route {
  id: number;
  route_number: string;
  route_name: string | null;
  route_group: 'city' | 'express';
  regular_count?: number;
  spare_count?: number;
}

interface AssignedVehicle {
  id: number;
  vehicle_id: number;
  vehicle_number: string;
  bus_type_name: string | null;
  assignment_type: 'regular' | 'spare';
  sequence: number;
}

interface UnassignedVehicle {
  id: number;
  vehicle_number: string;
  bus_type_name: string | null;
  status: string;
}

export default function RoutesSetupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Route list
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);

  // Add route form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoute, setNewRoute] = useState({ route_number: '', route_name: '', route_group: 'city' as 'city' | 'express' });

  // Route detail editing
  const [editingRoute, setEditingRoute] = useState(false);
  const [editRouteData, setEditRouteData] = useState({ route_number: '', route_name: '', route_group: 'city' as 'city' | 'express' });

  // Assigned vehicles for selected route
  const [assignedVehicles, setAssignedVehicles] = useState<AssignedVehicle[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Unassigned vehicles
  const [unassignedVehicles, setUnassignedVehicles] = useState<UnassignedVehicle[]>([]);
  const [checkedVehicleIds, setCheckedVehicleIds] = useState<Set<number>>(new Set());
  const [unassignedLoading, setUnassignedLoading] = useState(false);

  // ─── Fetch routes list ───
  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch('/api/routes');
      if (!res.ok) throw new Error('노선 목록을 불러오는데 실패했습니다.');
      const data = await res.json();
      setRoutes(data);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  }, []);

  // ─── Fetch route detail (assigned vehicles) ───
  const fetchRouteDetail = useCallback(async (routeId: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/routes/${routeId}`);
      if (!res.ok) throw new Error('노선 상세 정보를 불러오지 못했습니다.');
      const data = await res.json();
      setAssignedVehicles(data.vehicles || []);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
      setAssignedVehicles([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ─── Fetch unassigned vehicles ───
  const fetchUnassignedVehicles = useCallback(async () => {
    setUnassignedLoading(true);
    try {
      const res = await fetch('/api/route-vehicles?unassigned=true');
      if (!res.ok) throw new Error('미배정 차량을 불러오지 못했습니다.');
      const data = await res.json();
      setUnassignedVehicles(data);
    } catch (e: any) {
      setUnassignedVehicles([]);
    } finally {
      setUnassignedLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchRoutes();
      setLoading(false);
    };
    init();
  }, [fetchRoutes]);

  // When selected route changes
  useEffect(() => {
    if (selectedRouteId) {
      fetchRouteDetail(selectedRouteId);
      fetchUnassignedVehicles();
      setEditingRoute(false);
      setCheckedVehicleIds(new Set());
    }
  }, [selectedRouteId, fetchRouteDetail, fetchUnassignedVehicles]);

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) || null;

  // ─── Add Route ───
  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoute.route_number.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoute),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '노선 등록 실패');
      }
      setNewRoute({ route_number: '', route_name: '', route_group: 'city' });
      setShowAddForm(false);
      setMessage({ type: 'success', text: '노선이 성공적으로 등록되었습니다.' });
      await fetchRoutes();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ─── Update Route ───
  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRouteId || !editRouteData.route_number.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/routes/${selectedRouteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRouteData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '노선 수정 실패');
      }
      setEditingRoute(false);
      setMessage({ type: 'success', text: '노선 정보가 수정되었습니다.' });
      await fetchRoutes();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete Route ───
  const handleDeleteRoute = async () => {
    if (!selectedRouteId) return;
    if (!window.confirm('정말로 이 노선을 삭제하시겠습니까? 배정된 차량도 해제됩니다.')) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/routes/${selectedRouteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '노선 삭제 실패');
      }
      setSelectedRouteId(null);
      setAssignedVehicles([]);
      setMessage({ type: 'success', text: '노선이 삭제되었습니다.' });
      await fetchRoutes();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle vehicle assignment type (regular/spare) ───
  const handleToggleAssignmentType = (vehicleId: number) => {
    setAssignedVehicles((prev) =>
      prev.map((v) =>
        v.vehicle_id === vehicleId
          ? { ...v, assignment_type: v.assignment_type === 'regular' ? 'spare' : 'regular' }
          : v
      )
    );
  };

  // ─── Remove vehicle from assigned list ───
  const handleRemoveVehicle = (vehicleId: number) => {
    setAssignedVehicles((prev) => prev.filter((v) => v.vehicle_id !== vehicleId));
    // Add it back to unassigned list locally
    const removedVehicle = assignedVehicles.find((v) => v.vehicle_id === vehicleId);
    if (removedVehicle) {
      setUnassignedVehicles((prev) => [
        ...prev,
        {
          id: removedVehicle.vehicle_id,
          vehicle_number: removedVehicle.vehicle_number,
          bus_type_name: removedVehicle.bus_type_name,
          status: 'active',
        },
      ]);
    }
  };

  // ─── Add checked vehicles to assigned list ───
  const handleAssignCheckedVehicles = () => {
    if (checkedVehicleIds.size === 0) return;

    const vehiclesToAdd = unassignedVehicles.filter((v) => checkedVehicleIds.has(v.id));
    const currentMaxSequence = assignedVehicles.length > 0
      ? Math.max(...assignedVehicles.map((v) => v.sequence))
      : 0;

    const newAssignments: AssignedVehicle[] = vehiclesToAdd.map((v, idx) => ({
      id: 0,
      vehicle_id: v.id,
      vehicle_number: v.vehicle_number,
      bus_type_name: v.bus_type_name,
      assignment_type: 'regular' as const,
      sequence: currentMaxSequence + idx + 1,
    }));

    setAssignedVehicles((prev) => [...prev, ...newAssignments]);
    setUnassignedVehicles((prev) => prev.filter((v) => !checkedVehicleIds.has(v.id)));
    setCheckedVehicleIds(new Set());
  };

  // ─── Save all vehicle assignments ───
  const handleSaveAssignments = async () => {
    if (!selectedRouteId) return;
    setSaving(true);
    setMessage(null);
    try {
      const assignments = assignedVehicles.map((v, idx) => ({
        vehicle_id: v.vehicle_id,
        assignment_type: v.assignment_type,
        sequence: idx + 1,
      }));
      const res = await fetch('/api/route-vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_id: selectedRouteId, assignments }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '차량 배정 저장 실패');
      }
      setMessage({ type: 'success', text: '차량 배정이 성공적으로 저장되었습니다.' });
      await fetchRoutes();
      await fetchRouteDetail(selectedRouteId);
      await fetchUnassignedVehicles();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ─── Checkbox toggle ───
  const handleToggleCheck = (vehicleId: number) => {
    setCheckedVehicleIds((prev) => {
      const next = new Set(prev);
      if (next.has(vehicleId)) {
        next.delete(vehicleId);
      } else {
        next.add(vehicleId);
      }
      return next;
    });
  };

  const handleToggleCheckAll = () => {
    if (checkedVehicleIds.size === unassignedVehicles.length) {
      setCheckedVehicleIds(new Set());
    } else {
      setCheckedVehicleIds(new Set(unassignedVehicles.map((v) => v.id)));
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 mb-1">
          <span className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[11px] font-bold">STEP 2</span>
          <span className="text-xs text-gray-400 font-medium">초기 설정</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          ② 노선·차량 관리
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          2단계: 운행 노선을 등록하고, 각 노선에 차량을 배정하세요.
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
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-gray-200 border-t-blue-500"></div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* ────────────────── LEFT PANEL: Route List (1/3) ────────────────── */}
          <div className="lg:col-span-1 space-y-3">
            {/* Add Route Button */}
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setMessage(null);
              }}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition shadow-sm cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>신규 노선 추가</span>
            </button>

            {/* Inline Add Form */}
            {showAddForm && (
              <form onSubmit={handleAddRoute} className="bg-white border border-blue-200 rounded-2xl p-4 space-y-3 shadow-sm animate-in fade-in duration-150">
                <h4 className="text-sm font-bold text-blue-600">새 노선 등록</h4>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-400">노선번호 *</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 138번"
                    value={newRoute.route_number}
                    onChange={(e) => setNewRoute({ ...newRoute, route_number: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-400">노선명</label>
                  <input
                    type="text"
                    placeholder="예: 포천 ↔ 서울역"
                    value={newRoute.route_name}
                    onChange={(e) => setNewRoute({ ...newRoute, route_name: e.target.value })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-bold text-gray-400">노선 구분</label>
                  <select
                    value={newRoute.route_group}
                    onChange={(e) => setNewRoute({ ...newRoute, route_group: e.target.value as 'city' | 'express' })}
                    className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                  >
                    <option value="city">시내</option>
                    <option value="express">직행</option>
                  </select>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? '등록 중...' : '등록'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-2 bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 font-semibold rounded-xl text-sm transition cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              </form>
            )}

            {/* Route Cards */}
            <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {routes.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
                  <p className="text-gray-400 text-sm">등록된 노선이 없습니다.</p>
                  <p className="text-gray-400 text-xs mt-1">위의 버튼으로 노선을 추가하세요.</p>
                </div>
              ) : (
                routes.map((route) => {
                  const isSelected = selectedRouteId === route.id;
                  return (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRouteId(route.id)}
                      className={`w-full text-left bg-white border rounded-2xl p-4 shadow-sm transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/30'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-base font-bold text-gray-900">{route.route_number}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            route.route_group === 'city'
                              ? 'bg-green-50 text-green-600 border border-green-100'
                              : 'bg-purple-50 text-purple-600 border border-purple-100'
                          }`}
                        >
                          {route.route_group === 'city' ? '시내' : '직행'}
                        </span>
                      </div>
                      {route.route_name && (
                        <p className="text-xs text-gray-500 mb-1.5 truncate">{route.route_name}</p>
                      )}
                      <div className="text-[11px] text-gray-400 font-medium">
                        정규 {route.regular_count ?? 0}대 · 예비 {route.spare_count ?? 0}대
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ────────────────── RIGHT PANEL: Route Detail (2/3) ────────────────── */}
          <div className="lg:col-span-2 space-y-5">
            {!selectedRoute ? (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex items-center justify-center min-h-[500px]">
                <div className="text-center">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  <p className="text-gray-400 text-sm font-medium">← 좌측에서 노선을 선택하세요</p>
                </div>
              </div>
            ) : (
              <>
                {/* Section 1: Route Info */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  {editingRoute ? (
                    <form onSubmit={handleUpdateRoute} className="space-y-4">
                      <h3 className="text-base font-bold text-blue-600 border-b border-gray-100 pb-3">노선 정보 수정</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex flex-col space-y-1">
                          <label className="text-xs font-bold text-gray-400">노선번호 *</label>
                          <input
                            type="text"
                            required
                            value={editRouteData.route_number}
                            onChange={(e) => setEditRouteData({ ...editRouteData, route_number: e.target.value })}
                            className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                          />
                        </div>
                        <div className="flex flex-col space-y-1">
                          <label className="text-xs font-bold text-gray-400">노선명</label>
                          <input
                            type="text"
                            value={editRouteData.route_name}
                            onChange={(e) => setEditRouteData({ ...editRouteData, route_name: e.target.value })}
                            className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                          />
                        </div>
                        <div className="flex flex-col space-y-1">
                          <label className="text-xs font-bold text-gray-400">노선 구분</label>
                          <select
                            value={editRouteData.route_group}
                            onChange={(e) => setEditRouteData({ ...editRouteData, route_group: e.target.value as 'city' | 'express' })}
                            className="rounded-xl bg-white border border-gray-200 text-gray-900 p-2.5 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none transition"
                          >
                            <option value="city">시내</option>
                            <option value="express">직행</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex space-x-2 justify-end">
                        <button
                          type="submit"
                          disabled={saving}
                          className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          {saving ? '저장 중...' : '수정완료'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRoute(false)}
                          className="px-5 py-2 bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 font-semibold rounded-xl text-sm transition cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-xl font-bold text-gray-900">{selectedRoute.route_number}</h3>
                        {selectedRoute.route_name && (
                          <span className="text-sm text-gray-500">({selectedRoute.route_name})</span>
                        )}
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            selectedRoute.route_group === 'city'
                              ? 'bg-green-50 text-green-600 border border-green-100'
                              : 'bg-purple-50 text-purple-600 border border-purple-100'
                          }`}
                        >
                          {selectedRoute.route_group === 'city' ? '시내' : '직행'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingRoute(true);
                            setEditRouteData({
                              route_number: selectedRoute.route_number,
                              route_name: selectedRoute.route_name || '',
                              route_group: selectedRoute.route_group,
                            });
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold border border-gray-200 shadow-sm transition cursor-pointer"
                        >
                          수정
                        </button>
                        <button
                          onClick={handleDeleteRoute}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold border border-red-100 transition cursor-pointer"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Assigned Vehicles */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-gray-100 bg-white flex justify-between items-center">
                    <h3 className="text-base font-bold text-gray-900">배정된 차량 목록</h3>
                    <span className="text-xs text-gray-400 font-medium">
                      정규 {assignedVehicles.filter((v) => v.assignment_type === 'regular').length}대 · 예비{' '}
                      {assignedVehicles.filter((v) => v.assignment_type === 'spare').length}대
                    </span>
                  </div>

                  {detailLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-gray-200 border-t-blue-500"></div>
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-[300px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-100">
                            <th className="px-5 py-3">차량번호</th>
                            <th className="px-5 py-3">차종</th>
                            <th className="px-5 py-3">구분</th>
                            <th className="px-5 py-3">순번</th>
                            <th className="px-5 py-3 text-right">제거</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {assignedVehicles.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                                배정된 차량이 없습니다. 아래에서 차량을 추가하세요.
                              </td>
                            </tr>
                          ) : (
                            assignedVehicles.map((v, idx) => (
                              <tr key={v.vehicle_id} className="hover:bg-blue-50/20 transition-colors bg-white">
                                <td className="px-5 py-3 font-bold text-gray-800">{v.vehicle_number}</td>
                                <td className="px-5 py-3">
                                  {v.bus_type_name ? (
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-bold">
                                      {v.bus_type_name}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-5 py-3">
                                  <button
                                    onClick={() => handleToggleAssignmentType(v.vehicle_id)}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                                      v.assignment_type === 'regular'
                                        ? 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100'
                                        : 'bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100'
                                    }`}
                                  >
                                    {v.assignment_type === 'regular' ? '정규' : '예비'}
                                  </button>
                                </td>
                                <td className="px-5 py-3">
                                  <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-600 font-mono font-semibold">
                                    {idx + 1}번
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <button
                                    onClick={() => handleRemoveVehicle(v.vehicle_id)}
                                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                                  >
                                    제거
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section 3: Add Vehicles (Unassigned) */}
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-gray-100 bg-white flex justify-between items-center">
                    <h3 className="text-base font-bold text-gray-900">차량 추가 (미배정 차량)</h3>
                    <span className="text-xs text-gray-400 font-medium">{unassignedVehicles.length}대 사용 가능</span>
                  </div>

                  {unassignedLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-blue-500"></div>
                    </div>
                  ) : unassignedVehicles.length === 0 ? (
                    <div className="px-5 py-8 text-center text-gray-400 text-sm">
                      미배정 상태의 차량이 없습니다.
                    </div>
                  ) : (
                    <>
                      <div className="overflow-auto max-h-[250px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-100">
                              <th className="px-5 py-3 w-10">
                                <input
                                  type="checkbox"
                                  checked={checkedVehicleIds.size === unassignedVehicles.length && unassignedVehicles.length > 0}
                                  onChange={handleToggleCheckAll}
                                  className="rounded border-gray-300 text-blue-500 focus:ring-blue-400 cursor-pointer"
                                />
                              </th>
                              <th className="px-5 py-3">차량번호</th>
                              <th className="px-5 py-3">차종</th>
                              <th className="px-5 py-3">상태</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {unassignedVehicles.map((v) => (
                              <tr
                                key={v.id}
                                onClick={() => handleToggleCheck(v.id)}
                                className={`transition-colors cursor-pointer ${
                                  checkedVehicleIds.has(v.id) ? 'bg-blue-50/40' : 'hover:bg-blue-50/20 bg-white'
                                }`}
                              >
                                <td className="px-5 py-3">
                                  <input
                                    type="checkbox"
                                    checked={checkedVehicleIds.has(v.id)}
                                    onChange={() => handleToggleCheck(v.id)}
                                    className="rounded border-gray-300 text-blue-500 focus:ring-blue-400 cursor-pointer"
                                  />
                                </td>
                                <td className="px-5 py-3 font-bold text-gray-800">{v.vehicle_number}</td>
                                <td className="px-5 py-3">
                                  {v.bus_type_name ? (
                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-bold">
                                      {v.bus_type_name}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-5 py-3">
                                  <span className="text-xs text-gray-500 font-medium">{v.status === 'active' ? '운행 중' : v.status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-medium">
                          {checkedVehicleIds.size > 0 ? `${checkedVehicleIds.size}대 선택됨` : '차량을 선택하세요'}
                        </span>
                        <button
                          onClick={handleAssignCheckedVehicles}
                          disabled={checkedVehicleIds.size === 0}
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          선택 차량 배정
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveAssignments}
                    disabled={saving}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold rounded-xl transition shadow-md text-sm disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? '저장 중...' : '차량 배정 저장하기'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="border-t border-gray-200 pt-6 flex justify-between items-center">
        <Link
          href="/setup/bus-types"
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-semibold rounded-xl transition shadow-sm text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          <span>이전: 차종 관리</span>
        </Link>
        <Link
          href="/drivers"
          className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold rounded-xl transition shadow-md text-sm"
        >
          <span>다음 단계: 기사 관리</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
