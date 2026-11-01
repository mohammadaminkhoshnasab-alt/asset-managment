/**
 * IT Asset Management - Employee Directory View (Industrial Neo-Brutalist Redesign)
 * Showcases all 9 approved employee fields and an assigned hardware inspection drawer.
 */

import React, { useEffect, useState } from 'react';
import {
  Search,
  Users2,
  Laptop,
  Building,
  Phone,
  UserCheck,
  ChevronRight,
  X,
  Shield,
  Layers,
  MapPin,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { Asset, Employee } from '../../types/asset.ts';
import { assetService } from '../../services/assetService.ts';
import { useApp } from '../../context/AppContext.tsx';

export const EmployeesView: React.FC = () => {
  const { setSelectedAssetNumber, setActiveView, refreshTrigger } = useApp();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    async function load() {
      const [e, a] = await Promise.all([
        assetService.getEmployees(),
        assetService.getAssets(),
      ]);
      setEmployees(e);
      setAssets(a);
    }
    load();
  }, [refreshTrigger]);

  const uniqueDepartments = Array.from(new Set(employees.map((e) => e.department)));

  const filteredEmployees = employees.filter((emp) => {
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const match =
        emp.firstName.toLowerCase().includes(q) ||
        emp.lastName.toLowerCase().includes(q) ||
        emp.personalCode.toLowerCase().includes(q) ||
        emp.jobTitle.toLowerCase().includes(q) ||
        emp.directManager.toLowerCase().includes(q) ||
        emp.site.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (deptFilter !== 'All' && emp.department !== deptFilter) {
      return false;
    }

    return true;
  });

  const getAssignedAssets = (personalCode: string) => {
    return assets.filter((a) => a.personalCode === personalCode && a.status === 'In Use');
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-3.5 dark:border-[#2B323D] dark:bg-[#12151B]">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#6E6960] dark:text-[#7C8797]" />
          <input
            type="text"
            placeholder="Search by Employee Name, Personal Code, Job Title, Direct Manager, Site..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-[#D2C8B8] bg-[#E5DFD2]/60 py-2 pl-9 pr-4 text-xs font-mono-tabular text-[#141312] placeholder-[#6E6960] focus:border-[#E49C52] focus:bg-[#F8F4EC] focus:outline-none dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9] dark:placeholder-[#7C8797]"
          />
        </div>

        <div className="flex items-center gap-2 font-mono-tabular text-xs">
          <label className="text-[#6E6960] dark:text-[#7C8797] uppercase">Department:</label>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded border border-[#D2C8B8] bg-[#E5DFD2] py-1 px-2.5 text-xs text-[#141312] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9] focus:outline-none"
          >
            <option value="All">ALL DEPARTMENTS ({uniqueDepartments.length})</option>
            {uniqueDepartments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 9-Field Employee Table */}
      <div className="overflow-hidden rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] dark:border-[#2B323D] dark:bg-[#12151B]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="border-b border-[#D2C8B8] bg-[#E5DFD2] text-[11px] font-industrial-display font-black uppercase tracking-wider text-[#6E6960] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#7C8797]">
              <tr>
                <th scope="col" className="py-3 px-3.5">1. EMPLOYEE NAME</th>
                <th scope="col" className="py-3 px-3">2. PERSONAL CODE</th>
                <th scope="col" className="py-3 px-3">3. JOB TITLE</th>
                <th scope="col" className="py-3 px-3">4. DEPARTMENT</th>
                <th scope="col" className="py-3 px-3">5. WORK GROUP</th>
                <th scope="col" className="py-3 px-3">6. SITE / FACILITY</th>
                <th scope="col" className="py-3 px-3">7. DIRECT MANAGER</th>
                <th scope="col" className="py-3 px-3">8. MOBILE NUMBER</th>
                <th scope="col" className="py-3 px-3 text-center">9. ASSIGNED DEVICES</th>
                <th scope="col" className="py-3 px-3.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D2C8B8] dark:divide-[#2B323D] text-[#141312] dark:text-[#F2EFE9]">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#6E6960] dark:text-[#7C8797] font-mono-tabular">
                    No employee records match the active query.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const assignedCount = getAssignedAssets(emp.personalCode).length;
                  return (
                    <tr
                      key={emp.personalCode}
                      onClick={() => setSelectedEmployee(emp)}
                      className="cursor-pointer hover:bg-[#E5DFD2]/60 dark:hover:bg-[#181C24]/80 transition-colors"
                    >
                      {/* Name */}
                      <td className="py-2.5 px-3.5 font-bold text-[#141312] dark:text-[#F2EFE9] flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-[#141312] text-[#F8F4EC] dark:bg-[#F2EFE9] dark:text-[#12151B] text-[10px] font-black font-mono-tabular">
                          {emp.firstName[0]}
                          {emp.lastName[0]}
                        </div>
                        <span>
                          {emp.firstName} {emp.lastName}
                        </span>
                      </td>

                      {/* Personal Code */}
                      <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#141312] dark:text-[#F2EFE9]">
                        {emp.personalCode}
                      </td>

                      {/* Job Title */}
                      <td className="py-2.5 px-3 font-medium text-[#141312] dark:text-[#F2EFE9]">
                        {emp.jobTitle}
                      </td>

                      {/* Department */}
                      <td className="py-2.5 px-3 text-[#6E6960] dark:text-[#7C8797]">
                        {emp.department}
                      </td>

                      {/* Work Group */}
                      <td className="py-2.5 px-3 text-[#6E6960] dark:text-[#7C8797]">
                        {emp.workGroup}
                      </td>

                      {/* Site */}
                      <td className="py-2.5 px-3 text-[#6E6960] dark:text-[#7C8797]">
                        {emp.site}
                      </td>

                      {/* Direct Manager */}
                      <td className="py-2.5 px-3 font-semibold text-[#141312] dark:text-[#F2EFE9]">
                        {emp.directManager}
                      </td>

                      {/* Mobile */}
                      <td className="py-2.5 px-3 font-mono-tabular text-[#6E6960] dark:text-[#7C8797]">
                        {emp.mobileNumber}
                      </td>

                      {/* Assigned Device Count */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-bold font-mono-tabular ${
                            assignedCount > 0
                              ? 'bg-[#5D7F5F] text-black dark:bg-[#668768] dark:text-black'
                              : 'bg-[#E5DFD2] text-[#6E6960] dark:bg-[#181C24] dark:text-[#7C8797]'
                          }`}
                        >
                          {assignedCount}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployee(emp);
                          }}
                          className="rounded p-1 text-[#6E6960] hover:text-[#141312] hover:bg-[#E5DFD2] dark:text-[#7C8797] dark:hover:text-[#F2EFE9] dark:hover:bg-[#181C24]"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Detail & Assigned Hardware Drawer */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setSelectedEmployee(null)}
          />
          <div className="relative flex w-full max-w-lg flex-col bg-[#F8F4EC] dark:bg-[#12151B] border-l border-[#D2C8B8] dark:border-[#2B323D] shadow-2xl animate-in slide-in-from-right duration-150 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#D2C8B8] bg-[#F8F4EC]/95 px-6 py-4 dark:border-[#2B323D] dark:bg-[#12151B]/95 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="font-industrial-display font-black text-base text-[#141312] dark:text-[#F2EFE9]">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </span>
                <span className="rounded bg-[#E5DFD2] dark:bg-[#181C24] px-1.5 py-0.5 text-xs font-mono-tabular font-bold border border-[#D2C8B8] dark:border-[#2B323D]">
                  {selectedEmployee.personalCode}
                </span>
              </div>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="rounded p-1 text-[#6E6960] hover:text-[#141312] hover:bg-[#E5DFD2] dark:text-[#7C8797] dark:hover:text-[#F2EFE9] dark:hover:bg-[#181C24]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* 9 Approved Personnel Specs */}
              <div className="rounded-lg border border-[#D2C8B8] bg-[#E5DFD2]/60 p-4 dark:border-[#2B323D] dark:bg-[#181C24] font-mono-tabular text-xs space-y-3">
                <h4 className="font-industrial-display font-black text-xs uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9] pb-2 border-b border-[#D2C8B8] dark:border-[#2B323D]">
                  PERSONNEL PROFILE (9 APPROVED FIELDS)
                </h4>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">Full Name</span>
                    <p className="font-bold text-[#141312] dark:text-[#F2EFE9]">
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">Personal Code</span>
                    <p className="font-bold text-[#141312] dark:text-[#F2EFE9]">{selectedEmployee.personalCode}</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">Job Title</span>
                    <p className="font-semibold text-[#141312] dark:text-[#F2EFE9]">{selectedEmployee.jobTitle}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">Department</span>
                    <p className="text-[#141312] dark:text-[#F2EFE9]">{selectedEmployee.department}</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">Work Group</span>
                    <p className="text-[#141312] dark:text-[#F2EFE9]">{selectedEmployee.workGroup}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">Facility / Site</span>
                    <p className="text-[#141312] dark:text-[#F2EFE9]">{selectedEmployee.site}</p>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">Direct Manager</span>
                    <p className="font-semibold text-[#141312] dark:text-[#F2EFE9]">{selectedEmployee.directManager}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6E6960] dark:text-[#7C8797] uppercase">Mobile Number</span>
                    <p className="text-[#141312] dark:text-[#F2EFE9]">{selectedEmployee.mobileNumber}</p>
                  </div>
                </div>
              </div>

              {/* Active Assigned Equipment (Strictly excludes returned units) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-industrial-display font-black text-xs uppercase tracking-wider text-[#141312] dark:text-[#F2EFE9]">
                    ACTIVE HARDWARE ASSIGNMENTS ({getAssignedAssets(selectedEmployee.personalCode).length})
                  </h4>
                  <span className="font-mono-tabular text-[10px] text-[#6E6960] dark:text-[#7C8797]">
                    EXCLUDES RETURNED UNITS
                  </span>
                </div>

                {getAssignedAssets(selectedEmployee.personalCode).length === 0 ? (
                  <div className="rounded border border-[#D2C8B8] p-4 text-center text-xs font-mono-tabular text-[#6E6960] dark:border-[#2B323D] dark:text-[#7C8797]">
                    No hardware assets are currently allocated to this employee.
                  </div>
                ) : (
                  <div className="space-y-2.5 font-mono-tabular">
                    {getAssignedAssets(selectedEmployee.personalCode).map((asset) => (
                      <div
                        key={asset.assetNumber}
                        onClick={() => {
                          setSelectedEmployee(null);
                          setSelectedAssetNumber(asset.assetNumber);
                          setActiveView('assets');
                        }}
                        className="rounded border border-[#D2C8B8] bg-[#E5DFD2]/40 p-3 hover:bg-[#E5DFD2] dark:border-[#2B323D] dark:bg-[#181C24] dark:hover:bg-[#1F242E] cursor-pointer transition-colors flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#141312] dark:text-[#F2EFE9]">
                              {asset.assetNumber}
                            </span>
                            <span className="text-xs text-[#6E6960] dark:text-[#7C8797]">
                              {asset.model} ({asset.type})
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6E6960] dark:text-[#7C8797]">
                            S/N: {asset.serialNumber} · Location: {asset.location}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-[#E49C52] dark:text-[#E7A45F]">
                          Inspect →
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
