/**
 * IT Asset Management - Sidebar Navigation Component
 * Modern vertical navigation supporting desktop and mobile drawer modes.
 */

import React from 'react';
import {
  LayoutDashboard,
  Laptop,
  Users2,
  BarChart3,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  X,
  Server,
  Shield,
  Briefcase,
  User,
} from 'lucide-react';
import { useApp, ViewType } from '../../context/AppContext.tsx';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'assets', label: 'Assets', icon: Laptop },
  { id: 'employees', label: 'Employees', icon: Users2 },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'import', label: 'Import', icon: FileSpreadsheet, badge: 'Excel' },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'users', label: 'User Management', icon: ShieldCheck },
];

export const SidebarNav: React.FC = () => {
  const {
    activeView,
    setActiveView,
    currentUser,
    isMobileNavOpen,
    setIsMobileNavOpen,
  } = useApp();

  const handleNavClick = (viewId: ViewType) => {
    setActiveView(viewId);
    setIsMobileNavOpen(false);
  };

  const roleBadgeStyle = () => {
    switch (currentUser.role) {
      case 'IT Admin':
        return 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
      case 'Manager / Supervisor':
        return 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
      case 'Employee':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    }
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors">
      {/* Brand & Navigation Area */}
      <div className="flex flex-col">
        {/* Brand Lockup */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                IT Asset Management
              </span>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5">
                Enterprise Fleet Portal
              </p>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileNavOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section Heading */}
        <div className="px-6 pt-5 pb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Navigation
          </span>
        </div>

        {/* Nav Link List */}
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Session Profile Footnote */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 text-xs font-bold">
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                {currentUser.name}
              </p>
              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                {currentUser.email}
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px]">
            <span className="text-slate-500 dark:text-slate-400">Active Role:</span>
            <span className={`rounded-sm border px-1.5 py-0.5 font-medium ${roleBadgeStyle()}`}>
              {currentUser.role}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile Drawer Backdrop and Sidebar */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside className="relative flex w-72 max-w-xs flex-1 flex-col shadow-xl animate-in slide-in-from-left duration-200">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};
