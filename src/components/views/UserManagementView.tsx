/**
 * IT Asset Management - User Management View
 * Displays registered system users under the 3 approved roles: IT Admin, Manager / Supervisor, and Employee.
 */

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  User as UserIcon,
  Shield,
  Briefcase,
  Users2,
  CheckCircle2,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { Employee, User, UserRole } from '../../types/asset.ts';
import { assetService } from '../../services/assetService.ts';
import { useApp } from '../../context/AppContext.tsx';

export const UserManagementView: React.FC = () => {
  const { currentUser, setCurrentUser, users } = useApp();
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    async function load() {
      const e = await assetService.getEmployees();
      setEmployees(e);
    }
    load();
  }, []);

  // Calculate subordinate count for Manager / Supervisor
  const getSubordinateCount = (userName: string) => {
    const search = userName.toLowerCase().trim();
    return employees.filter((e) => e.directManager.toLowerCase().trim() === search).length;
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'IT Admin':
        return 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
      case 'Manager / Supervisor':
        return 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
      case 'Employee':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          User Management &amp; Role-Based Access Control
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Access permissions strictly adhere to the 3 approved roles. You can click <strong>Switch Active User</strong> to test how the interface and data scoping adapt dynamically.
        </p>
      </div>

      {/* Role Permission Matrix Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* IT Admin */}
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/20 p-4.5 shadow-xs dark:border-blue-900/40 dark:bg-blue-950/10 space-y-2">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-xs uppercase tracking-wider">
            <Shield className="h-4 w-4" />
            IT Admin
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            Full enterprise administrative authority. Manages entire asset catalog, performs batch Excel imports, adjusts compliance revision thresholds, and processes equipment handovers and returns.
          </p>
        </div>

        {/* Manager / Supervisor */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/20 p-4.5 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/10 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
            <Briefcase className="h-4 w-4" />
            Manager / Supervisor
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            Subordinate scope. View assets allocated strictly to their direct subordinates (based on <code>directManager</code> relationships, not automatic department membership).
          </p>
        </div>

        {/* Employee */}
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/20 p-4.5 shadow-xs dark:border-emerald-900/40 dark:bg-emerald-950/10 space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider">
            <UserIcon className="h-4 w-4" />
            Employee
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            Self-service portal. View devices assigned to personal employee code and review &amp; confirm pending handover receipts.
          </p>
        </div>
      </div>

      {/* User Directory Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/60">
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Registered Users Directory
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th scope="col" className="py-3 px-4">User</th>
                <th scope="col" className="py-3 px-3">Email</th>
                <th scope="col" className="py-3 px-3">Assigned Role</th>
                <th scope="col" className="py-3 px-3">Department</th>
                <th scope="col" className="py-3 px-3">Linked Personal Code</th>
                <th scope="col" className="py-3 px-3 text-center">Subordinate Scope</th>
                <th scope="col" className="py-3 px-4 text-right">Session Switch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {users.map((user) => {
                const isCurrent = currentUser.id === user.id;
                const subordinates = user.role === 'Manager / Supervisor' ? getSubordinateCount(user.name) : null;

                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                      isCurrent ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold text-xs">
                        {user.name[0]}
                      </div>
                      <div>
                        <span>{user.name}</span>
                        {isCurrent && (
                          <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            Current
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                      {user.email}
                    </td>

                    <td className="py-3 px-3">
                      <span className={`rounded-sm border px-2 py-0.5 font-semibold text-xs ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {user.department}
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">
                      {user.personalCode || <span className="text-slate-400">—</span>}
                    </td>

                    <td className="py-3 px-3 text-center">
                      {subordinates !== null ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          {subordinates} Direct Reports
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {isCurrent ? (
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-end gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Active
                        </span>
                      ) : (
                        <button
                          onClick={() => setCurrentUser(user)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-colors"
                        >
                          Simulate as {user.name.split(' ')[0]}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
