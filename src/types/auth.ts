export interface AdminUser {
  id: string;
  username: string;
  createdAt?: string;
  passwordUpdatedAt?: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable';

export interface AuthContextType {
  status: AuthStatus;
  user: AdminUser | null;
  csrfToken: string | null;
  errorMessage: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  previewMode: boolean;
  togglePreviewMode: () => void;
}
