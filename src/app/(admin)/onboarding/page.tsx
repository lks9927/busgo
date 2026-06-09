'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';

interface ParsedVehicle {
  vehicle_number: string;
  route: string;
  bus_type: string;
  status: string;
}

interface ParsedDriver {
  name: string;
  qualified_bus_types: string;
  vehicle_number: string;
  pair_driver_name: string;
  route: string;
  driver_type: string;
}

interface ParsedTimetable {
  route: string;
  shift_type: string;
  sequence: number;
  departure_time: string;
}

export default function OnboardingPage() {
  const [vehicles, setVehicles] = useState<ParsedVehicle[]>([]);
  const [drivers, setDrivers] = useState<ParsedDriver[]>([]);
  const [timetables, setTimetables] = useState<ParsedTimetable[]>([]);

  // Option checkboxes
  const [resetDrivers, setResetDrivers] = useState(true); // Default to true based on user request
  const [resetVehicles, setResetVehicles] = useState(false);
  const [resetTimetables, setResetTimetables] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // File names for display
  const [fileNames, setFileNames] = useState({
    vehicles: '',
    drivers: '',
    timetables: '',
  });

  // Helper to read Excel file
  const handleFileUpload = (type: 'vehicles' | 'drivers' | 'timetables', file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        setFileNames((prev) => ({ ...prev, [type]: file.name }));

        if (type === 'vehicles') {
          const mapped: ParsedVehicle[] = jsonData.map((row: any) => ({
            vehicle_number: String(row['차량번호'] || row['차량 번호'] || '').trim(),
            route: String(row['노선번호'] || row['노선 번호'] || row['노선'] || '').trim(),
            bus_type: String(row['차종'] || row['버스종류'] || '일반').trim(),
            status: String(row['상태'] || 'active').trim(),
          })).filter(v => v.vehicle_number);
          setVehicles(mapped);
        } else if (type === 'drivers') {
          const mapped: ParsedDriver[] = jsonData.map((row: any) => ({
            name: String(row['기사명'] || row['기사 이름'] || row['이름'] || '').trim(),
            qualified_bus_types: String(row['운전 가능 차종'] || row['운전가능차종'] || row['차종자격'] || '일반').trim(),
            vehicle_number: String(row['고정 차량번호'] || row['고정차량'] || row['차량번호'] || '').trim(),
            pair_driver_name: String(row['파트너 기사명'] || row['파트너 기사'] || row['파트너'] || '').trim(),
            route: String(row['소속 노선'] || row['소속노선'] || row['노선'] || '').trim(),
            driver_type: String(row['기사 유형'] || row['근무유형'] || 'fixed').trim(),
          })).filter(d => d.name);
          setDrivers(mapped);
        } else if (type === 'timetables') {
          const mapped: ParsedTimetable[] = jsonData.map((row: any) => ({
            route: String(row['노선번호'] || row['노선 번호'] || row['노선'] || '').trim(),
            shift_type: String(row['쉬프트'] || row['근무조'] || 'morning').trim(),
            sequence: Number(row['순번'] || row['순서'] || 1),
            departure_time: String(row['출발시간'] || row['출발 시간'] || '').trim(),
          })).filter(t => t.route && t.departure_time);
          setTimetables(mapped);
        }
        setMessage(null);
      } catch (err: any) {
        setMessage({ type: 'error', text: `${file.name} 파일을 파싱하는 데 실패했습니다: ${err.message}` });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Submit parsed data to backend
  const handleSubmit = async () => {
    if (vehicles.length === 0 && drivers.length === 0 && timetables.length === 0) {
      alert('등록할 데이터가 없습니다. 먼저 엑셀 파일을 하나 이상 업로드해 주세요.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/onboarding/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicles,
          drivers,
          timetables,
          options: {
            resetDrivers,
            resetVehicles,
            resetTimetables,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '온보딩 등록 처리 실패');
      }

      setMessage({ type: 'success', text: '엑셀 데이터가 정상적으로 일괄 등록되었습니다!' });
      // Reset states
      setVehicles([]);
      setDrivers([]);
      setTimetables([]);
      setFileNames({ vehicles: '', drivers: '', timetables: '' });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Dynamic template generator
  const downloadTemplate = (type: 'vehicles' | 'drivers' | 'timetables') => {
    let headers: string[] = [];
    let sampleData: any[] = [];
    let filename = '';

    if (type === 'vehicles') {
      headers = ['차량번호', '노선번호', '차종', '상태'];
      sampleData = [
        { '차량번호': '6500', '노선번호': '138번', '차종': '일반', '상태': 'active' },
        { '차량번호': '1137', '노선번호': '138번', '차종': '저상', '상태': 'active' },
        { '차량번호': '2001', '노선번호': '72번', '차종': '전기', '상태': 'standby' },
      ];
      filename = 'busgo_vehicles_template.xlsx';
    } else if (type === 'drivers') {
      headers = ['기사명', '운전 가능 차종', '고정 차량번호', '파트너 기사명', '소속 노선', '기사 유형'];
      sampleData = [
        { '기사명': '김철수', '운전 가능 차종': '일반, 저상', '고정 차량번호': '6500', '파트너 기사명': '이영희', '소속 노선': '138번', '기사 유형': '고정' },
        { '기사명': '이영희', '운전 가능 차종': '일반', '고정 차량번호': '6500', '파트너 기사명': '김철수', '소속 노선': '138번', '기사 유형': '고정' },
        { '기사명': '박예비', '운전 가능 차종': '일반, 저상, 전기', '고정 차량번호': '', '파트너 기사명': '', '소속 노선': '138번', '기사 유형': '예비' },
      ];
      filename = 'busgo_drivers_template.xlsx';
    } else if (type === 'timetables') {
      headers = ['노선번호', '쉬프트', '순번', '출발시간'];
      sampleData = [
        { '노선번호': '138번', '쉬프트': '오전', '순번': 1, '출발시간': '04:50' },
        { '노선번호': '138번', '쉬프트': '오전', '순번': 2, '출발시간': '05:05' },
        { '노선번호': '138번', '쉬프트': '오후', '순번': 1, '출발시간': '14:20' },
      ];
      filename = 'busgo_timetables_template.xlsx';
    }

    const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto min-h-screen flex flex-col">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          신규 업체 온보딩 (엑셀 일괄 등록)
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          차량 등록, 기사 인적사항/자격 매핑, 노선별 시간표 데이터를 엑셀 3장으로 한 번에 데이터베이스에 적재합니다.
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

      {/* Grid for Upload Card & Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload Cards (2 cols) */}
        <div className="md:col-span-2 space-y-4">
          {/* Card 1: Vehicles */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-800">1. 차량 등록 엑셀</h3>
              <button
                onClick={() => downloadTemplate('vehicles')}
                className="text-[11px] font-bold text-blue-500 hover:text-blue-600 transition"
              >
                📥 템플릿 다운로드
              </button>
            </div>
            <div className="border border-dashed border-gray-300 hover:border-blue-400 bg-gray-50 p-4 rounded-xl text-center cursor-pointer transition relative">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && handleFileUpload('vehicles', e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <span className="text-xs text-gray-500 font-medium">
                {fileNames.vehicles ? `✅ ${fileNames.vehicles} (${vehicles.length}대 파싱됨)` : '엑셀 파일을 여기에 드래그하거나 클릭하여 업로드'}
              </span>
            </div>
          </div>

          {/* Card 2: Drivers */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-800">2. 기사 등록 엑셀</h3>
              <button
                onClick={() => downloadTemplate('drivers')}
                className="text-[11px] font-bold text-blue-500 hover:text-blue-600 transition"
              >
                📥 템플릿 다운로드
              </button>
            </div>
            <div className="border border-dashed border-gray-300 hover:border-blue-400 bg-gray-50 p-4 rounded-xl text-center cursor-pointer transition relative">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && handleFileUpload('drivers', e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <span className="text-xs text-gray-500 font-medium">
                {fileNames.drivers ? `✅ ${fileNames.drivers} (${drivers.length}명 파싱됨)` : '엑셀 파일을 여기에 드래그하거나 클릭하여 업로드'}
              </span>
            </div>
          </div>

          {/* Card 3: Timetables */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-800">3. 노선 시간표 엑셀</h3>
              <button
                onClick={() => downloadTemplate('timetables')}
                className="text-[11px] font-bold text-blue-500 hover:text-blue-600 transition"
              >
                📥 템플릿 다운로드
              </button>
            </div>
            <div className="border border-dashed border-gray-300 hover:border-blue-400 bg-gray-50 p-4 rounded-xl text-center cursor-pointer transition relative">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => e.target.files?.[0] && handleFileUpload('timetables', e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <span className="text-xs text-gray-500 font-medium">
                {fileNames.timetables ? `✅ ${fileNames.timetables} (${timetables.length}개 시간표 파싱됨)` : '엑셀 파일을 여기에 드래그하거나 클릭하여 업로드'}
              </span>
            </div>
          </div>
        </div>

        {/* Options Panel (1 col) */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6 h-fit">
          <h3 className="text-base font-bold text-gray-950 border-b border-gray-100 pb-3">적재 옵션</h3>
          
          <div className="space-y-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={resetDrivers}
                onChange={(e) => setResetDrivers(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-blue-500 focus:ring-blue-400 w-4 h-4"
              />
              <div>
                <span className="text-xs font-bold text-gray-800 block">기존 기사 데이터 초기화</span>
                <span className="text-[10px] text-gray-400 font-medium">기사 목록, 기사 운전자격, 배차 schedules 및 휴가 신청 내역을 지우고 새로 적재합니다.</span>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={resetVehicles}
                onChange={(e) => setResetVehicles(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-blue-500 focus:ring-blue-400 w-4 h-4"
              />
              <div>
                <span className="text-xs font-bold text-gray-800 block">기존 차량 데이터 초기화</span>
                <span className="text-[10px] text-gray-400 font-medium">차량 목록을 모두 삭제하고 업로드된 차량들만 새롭게 데이터베이스에 등록합니다.</span>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={resetTimetables}
                onChange={(e) => setResetTimetables(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-blue-500 focus:ring-blue-400 w-4 h-4"
              />
              <div>
                <span className="text-xs font-bold text-gray-800 block">기존 시간표 데이터 초기화</span>
                <span className="text-[10px] text-gray-400 font-medium">등록된 노선별 출발 순번 시간표 설정을 전체 리셋하고 업로드합니다.</span>
              </div>
            </label>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || (vehicles.length === 0 && drivers.length === 0 && timetables.length === 0)}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
          >
            {loading ? '일괄 등록 중...' : '데이터베이스 일괄 적재'}
          </button>
        </div>
      </div>

      {/* Preview Section */}
      {(vehicles.length > 0 || drivers.length > 0 || timetables.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-5 border-b border-gray-150 bg-gray-50 flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900">업로드 데이터 미리보기</h3>
            <div className="flex space-x-2 text-[10px] font-bold text-gray-500">
              <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded">차량 {vehicles.length}건</span>
              <span className="px-2 py-1 bg-green-50 text-green-600 rounded">기사 {drivers.length}건</span>
              <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded">시간표 {timetables.length}건</span>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto p-4 max-h-[300px] space-y-4">
            {/* Vehicles Preview */}
            {vehicles.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-800 mb-1.5">🚍 차량 데이터 미리보기</h4>
                <div className="overflow-x-auto max-h-[150px] border border-gray-100 rounded-lg">
                  <table className="w-full text-left text-[11px] border-collapse bg-white">
                    <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2">차량번호</th>
                        <th className="px-4 py-2">노선</th>
                        <th className="px-4 py-2">차종</th>
                        <th className="px-4 py-2">상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {vehicles.slice(0, 5).map((v, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 font-bold font-mono">{v.vehicle_number}</td>
                          <td className="px-4 py-2">{v.route}</td>
                          <td className="px-4 py-2">{v.bus_type}</td>
                          <td className="px-4 py-2">{v.status}</td>
                        </tr>
                      ))}
                      {vehicles.length > 5 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-2 text-center text-gray-400 text-[10px]">외 {vehicles.length - 5}건의 차량 데이터가 더 있습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Drivers Preview */}
            {drivers.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-800 mb-1.5">👤 기사 데이터 미리보기</h4>
                <div className="overflow-x-auto max-h-[150px] border border-gray-100 rounded-lg">
                  <table className="w-full text-left text-[11px] border-collapse bg-white">
                    <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2">기사명</th>
                        <th className="px-4 py-2">운전자격 (차종)</th>
                        <th className="px-4 py-2">고정 차량</th>
                        <th className="px-4 py-2">교대 파트너</th>
                        <th className="px-4 py-2">소속 노선</th>
                        <th className="px-4 py-2">유형</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {drivers.slice(0, 5).map((d, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 font-bold">{d.name}</td>
                          <td className="px-4 py-2">{d.qualified_bus_types}</td>
                          <td className="px-4 py-2 font-mono">{d.vehicle_number || '-'}</td>
                          <td className="px-4 py-2">{d.pair_driver_name || '-'}</td>
                          <td className="px-4 py-2">{d.route}</td>
                          <td className="px-4 py-2">{d.driver_type}</td>
                        </tr>
                      ))}
                      {drivers.length > 5 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-2 text-center text-gray-400 text-[10px]">외 {drivers.length - 5}명명의 기사 데이터가 더 있습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Timetables Preview */}
            {timetables.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-800 mb-1.5">📅 노선 시간표 미리보기</h4>
                <div className="overflow-x-auto max-h-[150px] border border-gray-100 rounded-lg">
                  <table className="w-full text-left text-[11px] border-collapse bg-white">
                    <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2">노선번호</th>
                        <th className="px-4 py-2">쉬프트</th>
                        <th className="px-4 py-2">순번</th>
                        <th className="px-4 py-2">출발시간</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {timetables.slice(0, 5).map((t, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 font-bold">{t.route}</td>
                          <td className="px-4 py-2">{t.shift_type}</td>
                          <td className="px-4 py-2 font-mono">{t.sequence}번</td>
                          <td className="px-4 py-2 font-mono">{t.departure_time}</td>
                        </tr>
                      ))}
                      {timetables.length > 5 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-2 text-center text-gray-400 text-[10px]">외 {timetables.length - 5}건의 시간표 데이터가 더 있습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
