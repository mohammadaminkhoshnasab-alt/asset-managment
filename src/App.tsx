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
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* Left Vertical Sidebar */}
      <SidebarNav />

      {/* Main Viewport Container */}
      <div className="flex flex-1 flex-col min-w-0">
        <TopHeader />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'assets' && <AssetsView />}
          {activeView === 'employees' && <EmployeesView />}
          {activeView === 'reports' && <ReportsView />}
          {activeView === 'import' && <ImportView />}
          {activeView === 'settings' && <SettingsView />}
          {activeView === 'users' && <UserManagementView />}
        </main>

        {/* Quiet Minimalist Footer */}
        <footer className="border-t border-slate-200/80 bg-white/60 py-4 px-6 text-center text-xs text-slate-400 dark:border-slate-800/80 dark:bg-slate-900/60 dark:text-slate-500">
          <span>IT Asset Management Foundation · Standardized Frontend Workspace</span>
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
