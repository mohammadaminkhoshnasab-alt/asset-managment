import React, { useState } from 'react';
import type { NavigationRoute } from '../../types/navigation.ts';
import { APPROVED_NAVIGATION_ITEMS } from '../../types/navigation.ts';
import { Sidebar } from './Sidebar.tsx';
import { Header } from './Header.tsx';
import { RoutePlaceholder } from '../ui/RoutePlaceholder.tsx';
import { NewAssetView } from '../assets/NewAssetView.tsx';

export const AppShell: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<NavigationRoute>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const activeNavItem =
    APPROVED_NAVIGATION_ITEMS.find((item) => item.id === currentRoute) ||
    APPROVED_NAVIGATION_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-100 flex">
      {/* Sidebar (Desktop fixed + Mobile drawer) */}
      <Sidebar
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen min-w-0">
        <Header
          currentRoute={currentRoute}
          onOpenMobile={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Active Route Content: P06 New Asset Workspace or Deferred Route Placeholder */}
          {currentRoute === 'new-asset' ? (
            <NewAssetView onNavigate={setCurrentRoute} />
          ) : (
            <RoutePlaceholder item={activeNavItem} />
          )}
        </main>

        {/* Industrial Footer matching reference screenshots */}
        <footer className="border-t border-[#1b202a] bg-[#0a0c10] px-4 lg:px-8 py-3 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span>
            //// IT ASSET MANAGEMENT SYSTEM // AIR-GAPPED ON-PREMISES EDITION
          </span>
          <span className="hidden sm:inline">
            FIRMWARE V4.2.0-STABLE · ZERO EXTERNAL TELEMETRY
          </span>
        </footer>
      </div>
    </div>
  );
};
