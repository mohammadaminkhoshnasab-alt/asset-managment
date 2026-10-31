/**
 * IT Asset Management - Global Application Context
 * Handles Theme (Light/Dark), Active View navigation, and Current Role/User simulation.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '../types/asset.ts';
import { MOCK_USERS } from '../services/mockData.ts';

export type ViewType =
  | 'dashboard'
  | 'assets'
  | 'employees'
  | 'reports'
  | 'import'
  | 'settings'
  | 'users';

interface AppContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  users: User[];
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: (open: boolean) => void;
  selectedAssetNumber: string | null;
  setSelectedAssetNumber: (assetNumber: string | null) => void;
  selectedEmployeeCode: string | null;
  setSelectedEmployeeCode: (code: string | null) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state: light by default
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('itam_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS[0]); // Default to IT Admin
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [selectedAssetNumber, setSelectedAssetNumber] = useState<string | null>(null);
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // Sync theme with HTML class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('itam_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        activeView,
        setActiveView,
        currentUser,
        setCurrentUser,
        users: MOCK_USERS,
        isMobileNavOpen,
        setIsMobileNavOpen,
        selectedAssetNumber,
        setSelectedAssetNumber,
        selectedEmployeeCode,
        setSelectedEmployeeCode,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
