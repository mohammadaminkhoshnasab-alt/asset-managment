import React from 'react';
import type { NavigationRoute } from '../../types/navigation.ts';
import { APPROVED_NAVIGATION_ITEMS } from '../../types/navigation.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  LayoutDashboard,
  Laptop,
  PlusCircle,
  FileSpreadsheet,
  AlertTriangle,
  Settings,
  LogOut,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentRoute: NavigationRoute;
  onNavigate: (route: NavigationRoute) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, logout, previewMode } = useAuth();

  const getRouteIcon = (id: NavigationRoute) => {
    switch (id) {
      case 'dashboard':
        return <LayoutDashboard className="w-4 h-4 shrink-0" />;
      case 'assets':
        return <Laptop className="w-4 h-4 shrink-0" />;
      case 'new-asset':
        return <PlusCircle className="w-4 h-4 shrink-0" />;
      case 'import':
        return <FileSpreadsheet className="w-4 h-4 shrink-0" />;
      case 'attention':
        return <AlertTriangle className="w-4 h-4 shrink-0" />;
      case 'settings':
        return <Settings className="w-4 h-4 shrink-0" />;
      default:
        return <LayoutDashboard className="w-4 h-4 shrink-0" />;
    }
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#0a0c10] border-r border-[#1b202a] text-slate-200">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-[#1b202a] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#ea8c34] flex items-center justify-center shadow-md shadow-amber-500/10">
            {/* Custom stylized industrial logo glyph */}
            <span className="font-mono font-black text-slate-950 text-base leading-none">
              IT
            </span>
          </div>
          <div>
            <span className="block font-bold text-sm tracking-wider text-slate-100 uppercase">
              ASSET
            </span>
            <span className="block text-[10px] font-mono tracking-widest text-slate-400 uppercase -mt-0.5">
              MANAGEMENT
            </span>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-[#151922] cursor-pointer"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Label */}
      <div className="px-5 pt-5 pb-2 flex items-center justify-between font-mono text-[11px] text-slate-500 tracking-wider">
        <span>// SYSTEM WORKSPACES</span>
        <span className="text-[#ea8c34] font-semibold">[06]</span>
      </div>

      {/* Navigation Items (Exactly 6 approved routes) */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {APPROVED_NAVIGATION_ITEMS.map((item) => {
          const isActive = currentRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer select-none group ${
                isActive
                  ? 'bg-[#ea8c34] text-slate-950 font-semibold shadow-md shadow-amber-500/10'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#131720]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-slate-200'}>
                  {getRouteIcon(item.id)}
                </span>
                <span className="tracking-wide">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                    isActive
                      ? 'bg-slate-950/20 text-slate-950 border border-slate-950/20'
                      : 'bg-[#181d28] text-slate-400 border border-[#232b3b]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Context Footer Badge */}
      <div className="p-3 border-t border-[#1b202a] bg-[#0d1016]/60">
        {previewMode && (
          <div className="mb-2 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-center">
            <span className="font-mono text-[10px] tracking-wider text-[#ea8c34] font-semibold uppercase">
              PREVIEW INSPECTION MODE
            </span>
          </div>
        )}
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#11141c] border border-[#1b202a]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-8 h-8 rounded-full bg-[#1b2230] border border-[#2b3547] flex items-center justify-center shrink-0 text-slate-200 font-mono text-xs font-bold">
              {user?.username ? user.username.slice(0, 2).toUpperCase() : 'IT'}
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#0a0c10]" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-slate-100 truncate">
                {user?.username || 'System Administrator'}
              </span>
              <span className="block text-[10px] font-mono text-slate-400 truncate">
                IT Administrator
              </span>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Terminate session (Logout)"
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 ml-1"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 h-screen fixed inset-y-0 left-0 z-30">
        {navContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 h-full transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </aside>
    </>
  );
};
