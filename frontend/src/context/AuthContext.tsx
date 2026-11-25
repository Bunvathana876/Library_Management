import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/api/authApi';
import { configureHttpClient } from '@/api/httpClient';
import type { AuthUser } from '@/types/api';
import { hasRole, isAdmin as checkAdmin, isStaff as checkStaff } from '@/utils/roles';

interface StoredSession {
  accessToken: string;
  expiresAt: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isMember: boolean;
  remainingSeconds: number;
  signInModalOpen: boolean;
  openSignInModal: () => void;
  closeSignInModal: () => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (fullName: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const SESSION_KEY = 'library_auth_session';
const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.accessToken === 'string' &&
      parsed.accessToken.length > 0 &&
      typeof parsed.expiresAt === 'number' &&
      parsed.expiresAt > Date.now()
    ) {
      return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
    }
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage parse/access errors
  }
  return null;
}

function saveStoredSession(session: StoredSession | null): void {
  try {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Ignore storage restrictions
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => loadStoredSession());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(() => loadStoredSession() !== null);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const initial = loadStoredSession();
    return initial ? Math.max(0, Math.floor((initial.expiresAt - Date.now()) / 1000)) : 0;
  });

  const sessionRef = useRef<StoredSession | null>(session);
  sessionRef.current = session;

  const clearSession = useCallback(() => {
    saveStoredSession(null);
    sessionRef.current = null;
    setSession(null);
    setUser(null);
    setRemainingSeconds(0);
  }, []);

  configureHttpClient({
    getToken: () => {
      const current = sessionRef.current;
      if (!current || current.expiresAt <= Date.now()) {
        return null;
      }
      return current.accessToken;
    },
    onUnauthorized: () => {
      clearSession();
    },
  });

  useEffect(() => {
    if (!session) {
      setIsRestoring(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    authApi
      .getMe(controller.signal)
      .then((me) => {
        if (!cancelled) {
          setUser(me);
        }
      })
      .catch(() => {
        if (!cancelled && !controller.signal.aborted) {
          clearSession();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRestoring(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [session, clearSession]);

  useEffect(() => {
    if (!session) {
      setRemainingSeconds(0);
      return;
    }
    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff <= 0) {
        clearSession();
      }
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [session, clearSession]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const tokenRes = await authApi.login({ email: email.trim(), password });
    const nextSession: StoredSession = {
      accessToken: tokenRes.accessToken,
      expiresAt: Date.now() + tokenRes.expiresInSeconds * 1000,
    };
    sessionRef.current = nextSession;
    saveStoredSession(nextSession);
    setSession(nextSession);

    const me = await authApi.getMe();
    setUser(me);
    setSignInModalOpen(false);
    return me;
  }, []);

  const register = useCallback(
    async (fullName: string, email: string, password: string): Promise<AuthUser> => {
      const tokenRes = await authApi.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });
      const nextSession: StoredSession = {
        accessToken: tokenRes.accessToken,
        expiresAt: Date.now() + tokenRes.expiresInSeconds * 1000,
      };
      sessionRef.current = nextSession;
      saveStoredSession(nextSession);
      setSession(nextSession);

      const me = await authApi.getMe();
      setUser(me);
      setSignInModalOpen(false);
      return me;
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const openSignInModal = useCallback(() => setSignInModalOpen(true), []);
  const closeSignInModal = useCallback(() => setSignInModalOpen(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isRestoring,
      isStaff: checkStaff(user?.roles),
      isAdmin: checkAdmin(user?.roles),
      isMember: hasRole(user?.roles, 'MEMBER'),
      remainingSeconds,
      signInModalOpen,
      openSignInModal,
      closeSignInModal,
      login,
      register,
      logout,
    }),
    [
      user,
      isRestoring,
      remainingSeconds,
      signInModalOpen,
      openSignInModal,
      closeSignInModal,
      login,
      register,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
