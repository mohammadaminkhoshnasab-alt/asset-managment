/**
 * IT Asset Management - User Management View (Industrial Redesign)
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
  Layers,
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

  const getSubordinateCount = (userName: string) => {
    const search = userName.toLowerCase().trim();
    return employees.filter((e) => e.directManager.toLowerCase().trim() === search).length;
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] p-3.5 dark:border-[#2B323D] dark:bg-[#12151B]">
        <h1 className="font-industrial-display text-base font-black uppercase tracking-tight text-[#141312] dark:text-[#F2EFE9] flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#E49C52] dark:text-[#E7A45F]" />
          SECURITY &amp; ROLE-BASED ACCESS CONTROL (RBAC)
        </h1>
        <p className="text-xs text-[#6E6960] dark:text-[#7C8797] font-medium mt-0.5">
          Access permissions strictly adhere to the 3 approved roles. Click <strong>SWITCH SESSION</strong> to simulate role scoping.
        </p>
      </div>

      {/* Role Permission Matrix Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* IT Admin */}
        <div className="rounded-lg border border-[#E49C52] bg-[#E49C52]/10 p-4 dark:border-[#E7A45F] dark:bg-[#E7A45F]/10 space-y-2">
          <div className="flex items-center gap-2 text-[#E49C52] dark:text-[#E7A45F] font-industrial-display font-black text-xs uppercase tracking-wider">
            <Shield className="h-4 w-4" />
            1. IT ADMIN
          </div>
          <p className="text-xs text-[#141312] dark:text-[#F2EFE9] leading-relaxed">
            Full enterprise administrative authority. Manages entire asset catalog, performs batch Excel imports, adjusts compliance revision thresholds, and processes equipment handovers and returns.
          </p>
        </div>

        {/* Manager / Supervisor */}
        <div className="rounded-lg border border-[#486888] bg-[#486888]/10 p-4 dark:border-[#4A607A] dark:bg-[#4A607A]/10 space-y-2">
          <div className="flex items-center gap-2 text-[#486888] dark:text-[#88B0D8] font-industrial-display font-black text-xs uppercase tracking-wider">
            <Briefcase className="h-4 w-4" />
            2. MANAGER / SUPERVISOR
          </div>
          <p className="text-xs text-[#141312] dark:text-[#F2EFE9] leading-relaxed">
            Subordinate scope. View assets allocated strictly to their direct subordinates (based on <code>directManager</code> relationships, not automatic department membership).
          </p>
        </div>

        {/* Employee */}
        <div className="rounded-lg border border-[#5D7F5F] bg-[#5D7F5F]/10 p-4 dark:border-[#668768] dark:bg-[#668768]/10 space-y-2">
          <div className="flex items-center gap-2 text-[#5D7F5F] dark:text-[#88B08A] font-industrial-display font-black text-xs uppercase tracking-wider">
            <UserIcon className="h-4 w-4" />
            3. EMPLOYEE
          </div>
          <p className="text-xs text-[#141312] dark:text-[#F2EFE9] leading-relaxed">
            Self-service portal. View devices assigned to personal employee code and review &amp; confirm pending handover receipts.
          </p>
        </div>
      </div>

      {/* User Directory Table */}
      <div className="overflow-hidden rounded-lg border border-[#D2C8B8] bg-[#F8F4EC] dark:border-[#2B323D] dark:bg-[#12151B]">
        <div className="overflow-x-auto font-mono-tabular">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="border-b border-[#D2C8B8] bg-[#E5DFD2] text-[10px] font-bold uppercase text-[#6E6960] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#7C8797]">
              <tr>
                <th scope="col" className="py-2.5 px-3.5">USER / OPERATOR</th>
                <th scope="col" className="py-2.5 px-3">EMAIL / IDENTIFIER</th>
                <th scope="col" className="py-2.5 px-3">ROLE CLASSIFICATION</th>
                <th scope="col" className="py-2.5 px-3">LINKED PERSONAL CODE</th>
                <th scope="col" className="py-2.5 px-3">SUBORDINATES</th>
                <th scope="col" className="py-2.5 px-3.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D2C8B8] dark:divide-[#2B323D] text-[#141312] dark:text-[#F2EFE9]">
              {users.map((user) => {
                const isCurrent = currentUser.id === user.id;
                const subCount = user.role === 'Manager / Supervisor' ? getSubordinateCount(user.name) : null;

                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-[#E5DFD2]/60 dark:hover:bg-[#181C24]/80 transition-colors ${
                      isCurrent ? 'bg-[#E49C52]/10 dark:bg-[#E7A45F]/10' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3.5 font-bold flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-[#141312] text-[#F8F4EC] dark:bg-[#F2EFE9] dark:text-[#12151B] text-[10px] font-bold">
                        {user.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <span>{user.name}</span>
                      {isCurrent && (
                        <span className="rounded bg-[#E49C52] text-black dark:bg-[#E7A45F] dark:text-black px-1.5 py-0.2 text-[9px] font-black">
                          ACTIVE
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-[#6E6960] dark:text-[#7C8797]">
                      {user.email}
                    </td>

                    <td className="py-2.5 px-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-black font-industrial-display uppercase ${
                          user.role === 'IT Admin'
                            ? 'bg-[#E49C52] text-black dark:bg-[#E7A45F] dark:text-black'
                            : user.role === 'Manager / Supervisor'
                            ? 'bg-[#486888] text-white dark:bg-[#4A607A] dark:text-white'
                            : 'bg-[#5D7F5F] text-black dark:bg-[#668768] dark:text-black'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-[#6E6960] dark:text-[#7C8797]">
                      {user.personalCode || '— (Global Admin)'}
                    </td>

                    <td className="py-2.5 px-3">
                      {subCount !== null ? (
                        <span className="font-bold text-[#486888] dark:text-[#88B0D8]">
                          {subCount} Direct Reports
                        </span>
                      ) : (
                        <span className="text-[#6E6960] dark:text-[#7C8797]">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={() => setCurrentUser(user)}
                        disabled={isCurrent}
                        className={`rounded px-2.5 py-1 text-xs font-bold font-industrial-display transition-all ${
                          isCurrent
                            ? 'text-[#6E6960] dark:text-[#7C8797] cursor-default'
                            : 'bg-[#141312] text-[#F8F4EC] hover:opacity-90 dark:bg-[#F2EFE9] dark:text-[#12151B]'
                        }`}
                      >
                        {isCurrent ? 'SELECTED' : 'SWITCH SESSION'}
                      </button>
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
