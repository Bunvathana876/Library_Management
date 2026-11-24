import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ExplicitScheme = 'light' | 'dark';

interface ThemeContextValue {
  renderedScheme: ExplicitScheme;
  isOverrideActive: boolean;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'color-scheme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredOverride(): ExplicitScheme | null {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === 'light' || val === 'dark' ? val : null;
  } catch {
    return null;
  }
}

function applyMetaColorScheme(scheme: ExplicitScheme): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = scheme;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [storedOverride, setStoredOverride] = useState<ExplicitScheme | null>(() =>
    readStoredOverride(),
  );

  // Default to Light Mode while preserving explicit user overrides
  const renderedScheme: ExplicitScheme = storedOverride ?? 'light';

  useEffect(() => {
    applyMetaColorScheme(renderedScheme);
  }, [renderedScheme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) {
        setStoredOverride(readStoredOverride());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    const targetScheme: ExplicitScheme = renderedScheme === 'dark' ? 'light' : 'dark';

    try {
      if (targetScheme === 'light') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, targetScheme);
      }
    } catch {
      // Ignore storage restrictions while still updating the live page
    }

    setStoredOverride(targetScheme === 'light' ? null : targetScheme);
    applyMetaColorScheme(targetScheme);
  }, [renderedScheme]);

  const value = useMemo(
    () => ({
      renderedScheme,
      isOverrideActive: storedOverride !== null,
      toggleTheme,
    }),
    [renderedScheme, storedOverride, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
