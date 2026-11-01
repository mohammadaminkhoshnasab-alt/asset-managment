/**
 * IT Asset Management - Top Header Component (Industrial Design)
 * Precise mechanical header lockup with technical slashes, live timestamp, role switcher, and theme toggle.
 */

import React, { useState, useEffect } from 'react';
import {
  Menu,
  Moon,
  Sun,
  Database,
  Bell,
  Clock,
  Layers,
} from 'lucide-react';
import { useApp, ViewType } from '../../context/AppContext.tsx';

const VIEW_TITLES: Record<ViewType, string> = {
  dashboard: 'DASHBOARD',
  assets: 'ASSET REGISTRY',
  employees: 'PERSONNEL DIRECTORY',
  reports: 'METRICS & AUDITS',
  import: 'BATCH DATA INGEST',
  settings: 'SYSTEM PARAMETERS',
  users: 'SECURITY & RBAC',
};

export const TopHeader: React.FC = () => {
  const {
    theme,
    toggleTheme,
    activeView,
    currentUser,
    setCurrentUser,
    users,
    setIsMobileNavOpen,
  } = useApp();

  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }) + ' ' + now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    };
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-[#D2C8B8] bg-[#F8F4EC]/95 px-3 sm:px-6 backdrop-blur-md dark:border-[#2B323D] dark:bg-[#12151B]/95 transition-colors">
      {/* Left zone: Mobile toggle & Industrial System Stencil Badge */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileNavOpen(true)}
          className="rounded p-1.5 text-[#6E6960] hover:bg-[#E5DFD2] dark:text-[#7C8797] dark:hover:bg-[#181C24] lg:hidden focus:outline-none"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Industrial Technical Slashes & Title Lockup */}
        <div className="flex items-center gap-2 font-mono-tabular text-xs">
          <div className="flex items-center gap-1 font-bold text-[#E49C52] dark:text-[#E7A45F]">
            <span className="tracking-tighter">////</span>
          </div>
          <span className="font-bold tracking-wider text-[#141312] dark:text-[#F2EFE9] uppercase text-[11px] sm:text-xs">
            IT ASSET MANAGEMENT SYSTEM
          </span>
          <span className="font-bold text-[#E49C52] dark:text-[#E7A45F] hidden sm:inline">//</span>

          <span className="hidden md:inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded bg-[#E5DFD2] dark:bg-[#181C24] text-[10px] font-semibold tracking-wider text-[#6E6960] dark:text-[#7C8797] border border-[#D2C8B8] dark:border-[#2B323D]">
            <Layers className="h-3 w-3 text-[#E49C52] dark:text-[#E7A45F]" />
            {VIEW_TITLES[activeView]}
          </span>
        </div>
      </div>

      {/* Right zone: System Status, Live Monospace Clock, Role Switcher, Dark/Light Mode */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* On-Premises Air-Gapped Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 font-mono-tabular text-[11px] text-[#6E6960] dark:text-[#7C8797]">
          <span className="h-2 w-2 rounded-full bg-[#5D7F5F] dark:bg-[#668768] animate-pulse" />
          <span className="font-medium">LOCAL AIR-GAP ACTIVE</span>
        </div>

        {/* Live Monospace Clock */}
        <div className="hidden sm:flex items-center gap-1.5 font-mono-tabular text-xs text-[#6E6960] dark:text-[#7C8797] border-l border-[#D2C8B8] dark:border-[#2B323D] pl-3">
          <Clock className="h-3.5 w-3.5 opacity-70" />
          <span className="font-semibold">{currentTime || 'SYS TIME ACTIVE'}</span>
        </div>

        {/* Role Switcher */}
        <div className="flex items-center gap-1.5 border-l border-[#D2C8B8] dark:border-[#2B323D] pl-2 sm:pl-3">
          <label htmlFor="role-select" className="hidden xl:inline text-[11px] uppercase tracking-wider font-semibold text-[#6E6960] dark:text-[#7C8797]">
            ROLE:
          </label>
          <div className="relative">
            <select
              id="role-select"
              value={currentUser.id}
              onChange={(e) => {
                const selected = users.find((u) => u.id === e.target.value);
                if (selected) setCurrentUser(selected);
              }}
              className="appearance-none rounded border border-[#D2C8B8] bg-[#E5DFD2] py-1 pl-2 pr-7 text-[11px] font-mono-tabular font-semibold text-[#141312] hover:bg-[#DCD4C4] focus:border-[#E49C52] focus:outline-none dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9] dark:hover:bg-[#202530] transition-colors cursor-pointer"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-[#6E6960] dark:text-[#7C8797]">
              <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Dark/Light mode toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-8 w-8 items-center justify-center rounded border border-[#D2C8B8] bg-[#F8F4EC] text-[#141312] shadow-xs hover:bg-[#E5DFD2] dark:border-[#2B323D] dark:bg-[#181C24] dark:text-[#F2EFE9] dark:hover:bg-[#222834] transition-colors"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Industrial Mode`}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon className="h-3.5 w-3.5" />
          ) : (
            <Sun className="h-3.5 w-3.5 text-[#E7A45F]" />
          )}
        </button>
      </div>
    </header>
  );
};
