/**
 * IT Asset Management - Main Application Entry
 * Modern Minimalist SaaS Dashboard with responsive layout, 7 views, and dark mode.
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { SidebarNav } from './components/layout/SidebarNav.tsx';
import { TopHeader } from './components/layout/TopHeader.tsx';
import { DashboardView } from './components/views/DashboardView.tsx';
import { AssetsView } from './components/views/AssetsView.tsx';
import { EmployeesView } from './components/views/EmployeesView.tsx';
import { ReportsView } from './components/views/ReportsView.tsx';
import { ImportView } from './components/views/ImportView.tsx';
import { SettingsView } from './components/views/SettingsView.tsx';
import { UserManagementView } from './components/views/UserManagementView.tsx';

const AppContent: React.FC = () => {
  const { activeView } = useApp();

  return (
    <div className="flex min-h-screen bg-[#EFE9DF] text-[#141312] dark:bg-[#090A0D] dark:text-[#F2EFE9] transition-colors selection:bg-[#E7A45F] selection:text-black">
      {/* Left Vertical Sidebar */}
      <SidebarNav />

      {/* Main Viewport Container */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopHeader />

        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1400px] w-full mx-auto animate-in fade-in duration-150">
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'assets' && <AssetsView />}
          {activeView === 'employees' && <EmployeesView />}
          {activeView === 'reports' && <ReportsView />}
          {activeView === 'import' && <ImportView />}
          {activeView === 'settings' && <SettingsView />}
          {activeView === 'users' && <UserManagementView />}
        </main>

        {/* Industrial Status Footer */}
        <footer className="border-t border-[#D2C8B8] bg-[#E5DFD2]/60 py-3 px-6 text-center text-xs text-[#6E6960] dark:border-[#2B323D] dark:bg-[#12151B]/60 dark:text-[#7C8797] font-mono-tabular">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-[1400px] mx-auto text-[11px]">
            <span className="font-semibold tracking-wider uppercase">
              /// IT ASSET MANAGEMENT SYSTEM // AIR-GAPPED ON-PREMISES EDITION
            </span>
            <span className="opacity-75">
              FIRMWARE V4.2.0-STABLE · ZERO EXTERNAL TELEMETRY
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
