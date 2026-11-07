import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { NavigationRoute } from '../../types/navigation.ts';
import { APPROVED_NAVIGATION_ITEMS } from '../../types/navigation.ts';
import { Sidebar } from './Sidebar.tsx';
import { Header } from './Header.tsx';
import { RoutePlaceholder } from '../ui/RoutePlaceholder.tsx';
import { NewAssetView } from '../assets/NewAssetView.tsx';
import { AssetDetailsView } from '../assets/AssetDetailsView.tsx';
import { AllAssetsView } from '../assets/AllAssetsView.tsx';

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

  // Central Navigation Guard registered by active child views (e.g. AllAssetsView inline editor)
  const navigationGuardRef = useRef<(() => boolean) | null>(null);

  const registerNavigationGuard = useCallback((guard: (() => boolean) | null) => {
    navigationGuardRef.current = guard;
  }, []);

  // Sync state with browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (navigationGuardRef.current) {
        const canProceed = navigationGuardRef.current();
        if (!canProceed) {
          // User declined discard; re-push active URL to prevent browser history desync
          const currentPath = activeAssetId
            ? `/assets/${activeAssetId}`
            : currentRoute === 'new-asset'
            ? '/assets/new'
            : currentRoute === 'assets'
            ? window.location.pathname.startsWith('/assets')
              ? window.location.pathname + window.location.search
              : '/assets'
            : `/${currentRoute}`;
          window.history.pushState({}, '', currentPath);
          return;
        }
      }

      const parsed = parseRouteFromLocation();
      setCurrentRoute(parsed.route);
      setActiveAssetId(parsed.assetId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentRoute, activeAssetId]);

  const handleNavigate = useCallback((target: NavigationRoute | string): boolean => {
    if (navigationGuardRef.current) {
      const canProceed = navigationGuardRef.current();
      if (!canProceed) {
        return false; // Navigation blocked by active view guard
      }
    }

    if (typeof target === 'string' && target.startsWith('/assets/')) {
      const sub = target.replace('/assets/', '');
      if (sub === 'new') {
        window.history.pushState({}, '', '/assets/new');
        setCurrentRoute('new-asset');
        setActiveAssetId(null);
        return true;
      }
      // Target is an individual asset UUID
      window.history.pushState({}, '', `/assets/${sub}`);
      setCurrentRoute('assets');
      setActiveAssetId(sub);
      return true;
    }

    // Standard NavigationRoute
    const route = target as NavigationRoute;
    const navItem = APPROVED_NAVIGATION_ITEMS.find((item) => item.id === route);
    const targetPath = navItem ? navItem.path : '/';
    window.history.pushState({}, '', targetPath);
    setCurrentRoute(route);
    setActiveAssetId(null);
    return true;
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
          {/* Active Route Content: P07 Asset Details, P06 New Asset Workspace, P08 All Assets Grid, or Deferred Route Placeholder */}
          {activeAssetId ? (
            <AssetDetailsView
              assetId={activeAssetId}
              onNavigate={handleNavigate}
            />
          ) : currentRoute === 'new-asset' ? (
            <NewAssetView onNavigate={handleNavigate} />
          ) : currentRoute === 'assets' ? (
            <AllAssetsView
              onNavigate={handleNavigate}
              onRegisterNavigationGuard={registerNavigationGuard}
            />
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
