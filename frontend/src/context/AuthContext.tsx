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
  signInModalOpen: boolean;
  signInMode: 'login' | 'register';
  openSignInModal: () => void;
  openRegisterModal: () => void;
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
  const [signInMode, setSignInMode] = useState<'login' | 'register'>('login');
  const sessionRef = useRef<StoredSession | null>(session);
  sessionRef.current = session;

  const clearSession = useCallback(() => {
    saveStoredSession(null);
    sessionRef.current = null;
    setSession(null);
    setUser(null);
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

  // Public-site links open the existing account dialog after session restoration.
  useEffect(() => {
    if (isRestoring) return;
    const location = new URL(window.location.href);
    const requested = location.searchParams.get('auth');
    if (requested !== 'login' && requested !== 'register') return;
    location.searchParams.delete('auth');
    window.history.replaceState(window.history.state, '', location);
    if (!user) {
      setSignInMode(requested);
      setSignInModalOpen(true);
    }
  }, [isRestoring, user]);

  // Expire the session without re-rendering every auth consumer each second.
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(clearSession, Math.max(0, session.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
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

  const openSignInModal = useCallback(() => {
    setSignInMode('login');
    setSignInModalOpen(true);
  }, []);
  const openRegisterModal = useCallback(() => {
    setSignInMode('register');
    setSignInModalOpen(true);
  }, []);
  const closeSignInModal = useCallback(() => setSignInModalOpen(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isRestoring,
      isStaff: checkStaff(user?.roles),
      isAdmin: checkAdmin(user?.roles),
      isMember: hasRole(user?.roles, 'MEMBER'),
      signInModalOpen,
      signInMode,
      openSignInModal,
      openRegisterModal,
      closeSignInModal,
      login,
      register,
      logout,
    }),
    [
      user,
      isRestoring,
      signInModalOpen,
      signInMode,
      openSignInModal,
      openRegisterModal,
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
