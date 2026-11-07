import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AdminUser, AuthStatus, AuthContextType } from '../types/auth.ts';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  // Fetch CSRF token for state-changing requests
  const fetchCsrfToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/csrf', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
          return data.csrfToken;
        }
      }
    } catch {
      // Non-fatal, handled gracefully
    }
    return null;
  }, []);

  // Check active session on initialization
  const refreshSession = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);

    try {
      // 1. Fetch CSRF token
      await fetchCsrfToken();

      // 2. Fetch active session context
      const res = await fetch('/api/auth/me', { credentials: 'include' });

      if (res.ok) {
        const data = await res.json();
        setUser(data.admin || null);
        setStatus('authenticated');
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
      } else if (res.status === 401) {
        setUser(null);
        setStatus('unauthenticated');
      } else {
        // Backend service error or database offline
        const errorData = await res.json().catch(() => ({}));
        setErrorMessage(errorData.error || `Server responded with status ${res.status}`);
        setStatus('unauthenticated');
      }
    } catch (err: any) {
      console.warn('[AuthContext] Backend unreachable:', err.message);
      setErrorMessage('Backend service or database is currently unavailable.');
      setStatus('unavailable');
    }
  }, [fetchCsrfToken]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      let token = csrfToken;
      if (!token) {
        token = await fetchCsrfToken();
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['x-csrf-token'] = token;
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === 'ok') {
        setUser(data.admin || { id: 'admin', username });
        setStatus('authenticated');
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
        return { success: true };
      }

      return {
        success: false,
        error: data.error || `Login failed (Status: ${res.status})`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'Unable to connect to authentication server. Check network connection.',
      };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch (err: any) {
      console.warn('[AuthContext] Logout request failed:', err.message);
    } finally {
      setUser(null);
      setStatus('unauthenticated');
      setPreviewMode(false);
      // Fetch fresh CSRF token for subsequent login
      fetchCsrfToken();
    }
  };

  const togglePreviewMode = () => {
    setPreviewMode((prev) => !prev);
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        csrfToken,
        errorMessage,
        login,
        logout,
        refreshSession,
        previewMode,
        togglePreviewMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
