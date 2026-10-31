/**
 * IT Asset Management - Top Header Component
 * Strict one-row layout with breadcrumbs, role preview switcher, and theme toggle.
 */

import React from 'react';
import {
  Menu,
  Moon,
  Sun,
  ShieldAlert,
  UserCheck,
  User as UserIcon,
  Laptop,
  Database,
} from 'lucide-react';
import { useApp, ViewType } from '../../context/AppContext.tsx';

const VIEW_TITLES: Record<ViewType, string> = {
  dashboard: 'Dashboard',
  assets: 'Hardware Assets',
  employees: 'Employee Directory',
  reports: 'Inventory Reports',
  import: 'Excel Import Wizard',
  settings: 'System Settings',
  users: 'User Management',
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

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/90 px-4 sm:px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 transition-colors">
      {/* Left zone: Mobile toggle & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileNavOpen(true)}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <span className="text-slate-400 dark:text-slate-500">Workspace</span>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {VIEW_TITLES[activeView]}
          </span>
        </div>
      </div>

      {/* Right zone: Simulated Data badge, Role Switcher, Dark mode */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mock Data Indicator tag */}
        <div className="hidden md:flex items-center gap-1.5 rounded-md bg-blue-50/80 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
          <Database className="h-3.5 w-3.5" />
          <span>Mock Data Layer</span>
        </div>

        {/* Role Switcher for easy testing of permissions */}
        <div className="flex items-center gap-2">
          <label htmlFor="role-select" className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400">
            Role:
          </label>
          <div className="relative">
            <select
              id="role-select"
              value={currentUser.id}
              onChange={(e) => {
                const selected = users.find((u) => u.id === e.target.value);
                if (selected) setCurrentUser(selected);
              }}
              className="appearance-none rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-2.5 pr-8 text-xs font-medium text-slate-800 hover:bg-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-colors cursor-pointer"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400">
              <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Dark/Light mode toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 dark:hover:text-white transition-colors"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4 text-amber-400" />
          )}
        </button>
      </div>
    </header>
  );
};
