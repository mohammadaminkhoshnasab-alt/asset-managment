import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AppShell } from './components/shell/AppShell.tsx';
import { LoginView } from './components/auth/LoginView.tsx';
import { LoadingState } from './components/ui/LoadingState.tsx';

const AppContent: React.FC = () => {
  const { status, previewMode } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
        <LoadingState message="CONNECTING TO IT ASSET MANAGEMENT SERVER..." />
      </div>
    );
  }

  // Shell is presented if user is authentically logged in or in preview inspection mode
  if (status === 'authenticated' || previewMode) {
    return <AppShell />;
  }

  // Otherwise, strictly show the Login UI (unauthenticated / session expired / unavailable)
  return <LoginView />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
