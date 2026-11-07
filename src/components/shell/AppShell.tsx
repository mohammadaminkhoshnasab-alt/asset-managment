import React, { useState, useEffect, useCallback } from 'react';
import type { NavigationRoute } from '../../types/navigation.ts';
import { APPROVED_NAVIGATION_ITEMS } from '../../types/navigation.ts';
import { Sidebar } from './Sidebar.tsx';
import { Header } from './Header.tsx';
import { RoutePlaceholder } from '../ui/RoutePlaceholder.tsx';
import { NewAssetView } from '../assets/NewAssetView.tsx';
import { AssetDetailsView } from '../assets/AssetDetailsView.tsx';

function parseRouteFromLocation(): { route: NavigationRoute; assetId: string | null } {
  if (typeof window === 'undefined') {
    return { route: 'dashboard', assetId: null };
  }
  const path = window.location.pathname;
  // Match /assets/<uuid>
  const assetDetailMatch = path.match(/^\/assets\/([0-9a-fA-F-]{36})$/);
  if (assetDetailMatch) {
    return { route: 'assets', assetId: assetDetailMatch[1] };
  }
  if (path === '/assets/new') {
    return { route: 'new-asset', assetId: null };
  }
  if (path === '/assets') {
    return { route: 'assets', assetId: null };
  }
  if (path === '/import') {
    return { route: 'import', assetId: null };
  }
  if (path === '/attention') {
    return { route: 'attention', assetId: null };
  }
  if (path === '/settings') {
    return { route: 'settings', assetId: null };
  }
  return { route: 'dashboard', assetId: null };
}

export const AppShell: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<NavigationRoute>(
    () => parseRouteFromLocation().route
  );
  const [activeAssetId, setActiveAssetId] = useState<string | null>(
    () => parseRouteFromLocation().assetId
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Sync state with browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRouteFromLocation();
      setCurrentRoute(parsed.route);
      setActiveAssetId(parsed.assetId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = useCallback((target: NavigationRoute | string) => {
    if (typeof target === 'string' && target.startsWith('/assets/')) {
      const sub = target.replace('/assets/', '');
      if (sub === 'new') {
        window.history.pushState({}, '', '/assets/new');
        setCurrentRoute('new-asset');
        setActiveAssetId(null);
        return;
      }
      // Target is an individual asset UUID
      window.history.pushState({}, '', `/assets/${sub}`);
      setCurrentRoute('assets');
      setActiveAssetId(sub);
      return;
    }

    // Standard NavigationRoute
    const route = target as NavigationRoute;
    const navItem = APPROVED_NAVIGATION_ITEMS.find((item) => item.id === route);
    const targetPath = navItem ? navItem.path : '/';
    window.history.pushState({}, '', targetPath);
    setCurrentRoute(route);
    setActiveAssetId(null);
  }, []);

  const activeNavItem =
    APPROVED_NAVIGATION_ITEMS.find((item) => item.id === currentRoute) ||
    APPROVED_NAVIGATION_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-100 flex">
      {/* Sidebar (Desktop fixed + Mobile drawer) */}
      <Sidebar
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen min-w-0">
        <Header
          currentRoute={currentRoute}
          customTitle={activeAssetId ? 'Asset Details' : undefined}
          onOpenMobile={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Active Route Content: P07 Asset Details, P06 New Asset Workspace, or Deferred Route Placeholder */}
          {activeAssetId ? (
            <AssetDetailsView
              assetId={activeAssetId}
              onNavigate={handleNavigate}
            />
          ) : currentRoute === 'new-asset' ? (
            <NewAssetView onNavigate={handleNavigate} />
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
