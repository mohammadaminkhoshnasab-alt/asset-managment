import React, { useState, useEffect } from 'react';
import type { NavigationRoute } from '../../types/navigation.ts';
import { APPROVED_NAVIGATION_ITEMS } from '../../types/navigation.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { Menu, Clock, LogOut } from 'lucide-react';

interface HeaderProps {
  currentRoute: NavigationRoute;
  onOpenMobile: () => void;
  customTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ currentRoute, onOpenMobile, customTitle }) => {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const currentItem = APPROVED_NAVIGATION_ITEMS.find((item) => item.id === currentRoute);

  return (
    <header className="h-16 bg-[#0a0c10]/95 backdrop-blur-md border-b border-[#1b202a] px-4 lg:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Mobile Toggle & System Workspace Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#151922] cursor-pointer"
          aria-label="Open navigation sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-[#ea8c34] tracking-wider hidden sm:inline">
            //// IT ASSET MANAGEMENT SYSTEM //
          </span>
          <span className="font-mono text-xs text-slate-300 font-semibold px-2 py-0.5 rounded bg-[#131720] border border-[#1f2633] uppercase">
            {customTitle || currentItem?.label || 'DASHBOARD'}
          </span>
        </div>
      </div>

      {/* Right: Telemetry, Clock, Operator Role Badge & Logout */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Air-gap telemetry indicator */}
        <div className="hidden md:flex items-center gap-2 font-mono text-[11px] text-slate-400 bg-[#11141c] border border-[#1b202a] px-2.5 py-1 rounded">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="tracking-wider uppercase">LOCAL AIR-GAP ACTIVE</span>
        </div>

        {/* Live clock */}
        {currentTime && (
          <div className="hidden xl:flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <Clock className="w-3.5 h-3.5 text-[#ea8c34]" />
            <span>{currentTime}</span>
          </div>
        )}

        {/* Operator Role Tag */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded bg-[#131720] border border-[#202736] text-xs font-mono">
            <span className="text-slate-400">ROLE: </span>
            <span className="font-semibold text-slate-200">
              {user?.username || 'Administrator'} (IT Admin)
            </span>
          </div>

          <button
            onClick={() => logout()}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded border border-transparent hover:border-rose-900/40 transition-colors cursor-pointer"
            title="Log out of application"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
