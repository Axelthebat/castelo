import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CurrentUser } from '@castelo/shared';
import { api, setCsrfToken, ApiError } from './api.ts';

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  login: (identifier: string, password: string, remember?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api.me();
      setUser(response.user);
      setCsrfToken(response.csrfToken);
    } catch (error) {
      if (error instanceof ApiError && error.isAuth) {
        setUser(null);
        setCsrfToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string, remember = true) => {
    const response = await api.login({ identifier, password, remember });
    setUser(response.user);
    setCsrfToken(response.csrfToken);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const response = await api.register({ username, email, password });
    setUser(response.user);
    setCsrfToken(response.csrfToken);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setCsrfToken(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return context;
}
