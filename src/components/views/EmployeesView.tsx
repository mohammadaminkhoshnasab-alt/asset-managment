/**
 * IT Asset Management - Employee Directory View
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

  // Get currently assigned assets for an employee (excludes returned devices, as personalCode is cleared)
  const getAssignedAssets = (personalCode: string) => {
    return assets.filter((a) => a.personalCode === personalCode && a.status === 'In Use');
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Employee Name, Personal Code, Job Title, Direct Manager, Site..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Department:</label>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="All">All Departments</option>
            {uniqueDepartments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 9-Field Employee Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th scope="col" className="py-3 px-4">Employee Name</th>
                <th scope="col" className="py-3 px-3">Personal Code</th>
                <th scope="col" className="py-3 px-3">Job Title</th>
                <th scope="col" className="py-3 px-3">Department</th>
                <th scope="col" className="py-3 px-3">Work Group</th>
                <th scope="col" className="py-3 px-3">Site / Facility</th>
                <th scope="col" className="py-3 px-3">Direct Manager</th>
                <th scope="col" className="py-3 px-3">Mobile Number</th>
                <th scope="col" className="py-3 px-3 text-center">Assigned Devices</th>
                <th scope="col" className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400 dark:text-slate-500">
                    No employee records match the search query.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const assignedCount = getAssignedAssets(emp.personalCode).length;
                  return (
                    <tr
                      key={emp.personalCode}
                      onClick={() => setSelectedEmployee(emp)}
                      className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name */}
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-bold">
                          {emp.firstName[0]}
                          {emp.lastName[0]}
                        </div>
                        <span>
                          {emp.firstName} {emp.lastName}
                        </span>
                      </td>

                      {/* Personal Code */}
                      <td className="py-3 px-3 font-mono font-medium text-slate-600 dark:text-slate-300">
                        {emp.personalCode}
                      </td>

                      {/* Job Title */}
                      <td className="py-3 px-3 text-slate-800 dark:text-slate-200">
                        {emp.jobTitle}
                      </td>

                      {/* Department */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {emp.department}
                      </td>

                      {/* Work Group */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {emp.workGroup}
                      </td>

                      {/* Site */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {emp.site}
                      </td>

                      {/* Direct Manager */}
                      <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {emp.directManager}
                      </td>

                      {/* Mobile */}
                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                        {emp.mobileNumber}
                      </td>

                      {/* Assigned Device Count */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold font-mono ${
                            assignedCount > 0
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                          }`}
                        >
                          {assignedCount}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployee(emp);
                          }}
                          className="rounded p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <ChevronRight className="h-4 w-4" />
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

      {/* Employee Device Inspection Drawer */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setSelectedEmployee(null)}
          />
          <div className="relative flex w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/95 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold text-sm">
                  {selectedEmployee.firstName[0]}
                  {selectedEmployee.lastName[0]}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {selectedEmployee.personalCode} · {selectedEmployee.jobTitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile Summary Card */}
            <div className="p-6 space-y-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 text-xs space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Approved Personnel Attributes
                </h4>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-slate-400">Department:</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {selectedEmployee.department}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Work Group:</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {selectedEmployee.workGroup}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Site Facility:</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {selectedEmployee.site}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Direct Manager:</span>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {selectedEmployee.directManager}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Mobile Number:</span>
                    <p className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {selectedEmployee.mobileNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* Currently Assigned Devices Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Currently Assigned Hardware</span>
                  <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {getAssignedAssets(selectedEmployee.personalCode).length} Devices
                  </span>
                </h4>

                <div className="space-y-3">
                  {getAssignedAssets(selectedEmployee.personalCode).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 dark:border-slate-800">
                      No active devices currently assigned.
                    </div>
                  ) : (
                    getAssignedAssets(selectedEmployee.personalCode).map((asset) => (
                      <div
                        key={asset.assetNumber}
                        onClick={() => {
                          setSelectedAssetNumber(asset.assetNumber);
                          setActiveView('assets');
                          setSelectedEmployee(null);
                        }}
                        className="group rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600 cursor-pointer transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Laptop className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                              {asset.assetNumber}
                            </span>
                          </div>
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            {asset.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200">
                          {asset.model} ({asset.type})
                        </p>
                        <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                          <span>SN: {asset.serialNumber}</span>
                          <span className="text-blue-600 dark:text-blue-400 group-hover:underline flex items-center gap-1 font-medium">
                            Inspect Asset
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
