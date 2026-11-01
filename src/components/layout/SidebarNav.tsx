/**
 * IT Asset Management - Sidebar Navigation Component (Industrial Neo-Brutalist)
 * High-contrast solid amber active blocks, geometric brand icon, and technical session card.
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
  LogOut,
  SlidersHorizontal,
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
  { id: 'import', label: 'Import', icon: FileSpreadsheet, badge: 'XLSX' },
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

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-[#F8F4EC] dark:bg-[#12151B] border-r border-[#D2C8B8] dark:border-[#2B323D] transition-colors select-none">
      {/* Brand & Navigation Area */}
      <div className="flex flex-col">
        {/* Brand Lockup matching Reference Image */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-[#D2C8B8] dark:border-[#2B323D]">
          <div className="flex items-center gap-3">
            {/* Geometric Angled Industrial Logo Mark */}
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#E49C52] dark:bg-[#E7A45F] text-black shadow-xs">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M4 19h4L16 7h-4L4 19zm12-14l4 4-2 2-4-4 2-2zM4 5h6v4H4V5z" />
              </svg>
            </div>
            <div>
              <span className="font-industrial-display text-sm font-black tracking-tight text-[#141312] dark:text-[#F2EFE9] uppercase leading-none block">
                ASSET
              </span>
              <span className="font-industrial-display text-xs font-bold tracking-wider text-[#6E6960] dark:text-[#7C8797] uppercase leading-none block mt-0.5">
                MANAGEMENT
              </span>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileNavOpen(false)}
            className="rounded p-1 text-[#6E6960] hover:bg-[#E5DFD2] dark:text-[#7C8797] dark:hover:bg-[#181C24] lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Technical Sub-Header */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <span className="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-[#6E6960] dark:text-[#7C8797]">
            // SYSTEM WORKSPACES
          </span>
          <span className="font-mono-tabular text-[10px] text-[#6E6960] dark:text-[#7C8797] opacity-60">
            [07]
          </span>
        </div>

        {/* Nav Link List */}
        <nav className="flex flex-col gap-1.5 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`group relative flex items-center justify-between rounded-lg px-3.5 py-2.5 text-xs font-bold transition-all text-left ${
                  isActive
                    ? 'bg-[#E49C52] text-black dark:bg-[#E7A45F] dark:text-black shadow-sm'
                    : 'text-[#2A2723] hover:bg-[#E5DFD2] dark:text-[#C5CCD6] dark:hover:bg-[#181C24] dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-black'
                        : 'text-[#6E6960] group-hover:text-black dark:text-[#7C8797] dark:group-hover:text-white'
                    }`}
                  />
                  <span className="font-industrial-display tracking-wide">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-mono-tabular font-bold ${
                      isActive
                        ? 'bg-black/20 text-black'
                        : 'bg-[#D2C8B8]/60 text-[#141312] dark:bg-[#2B323D] dark:text-[#C5CCD6]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Session Profile Card matching Reference Image */}
      <div className="p-3 border-t border-[#D2C8B8] dark:border-[#2B323D]">
        <div className="rounded-lg bg-[#E5DFD2]/70 dark:bg-[#181C24] p-3 border border-[#D2C8B8] dark:border-[#2B323D] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#141312] text-[#F8F4EC] dark:bg-[#F2EFE9] dark:text-[#12151B] text-xs font-black font-mono-tabular">
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[#5D7F5F] dark:bg-[#668768] ring-1 ring-[#F8F4EC] dark:ring-[#12151B]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-[#141312] dark:text-[#F2EFE9] font-industrial-display">
                {currentUser.name}
              </p>
              <p className="truncate text-[10px] font-mono-tabular text-[#6E6960] dark:text-[#7C8797]">
                {currentUser.role}
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveView('users')}
            className="rounded p-1 text-[#6E6960] hover:text-black hover:bg-[#D2C8B8] dark:text-[#7C8797] dark:hover:text-white dark:hover:bg-[#2B323D] transition-colors"
            title="User Profile & Roles"
            aria-label="User settings"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile Drawer Backdrop and Sidebar */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside className="relative flex w-72 max-w-xs flex-1 flex-col shadow-2xl animate-in slide-in-from-left duration-150">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};
