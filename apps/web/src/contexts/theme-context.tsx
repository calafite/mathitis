import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: ResolvedTheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  setTheme: (theme: ResolvedTheme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'mathitis_theme';
const PREFERENCE_STORAGE_KEY = 'mathitis_theme_preference';

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  const pref = localStorage.getItem(PREFERENCE_STORAGE_KEY);
  if (pref === 'dark' || pref === 'light' || pref === 'system') return pref;
  return 'dark';
}

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemPref, setSystemPref] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystemPref(media.matches ? 'light' : 'dark');
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const theme: ResolvedTheme = preference === 'system' ? systemPref : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    localStorage.setItem(PREFERENCE_STORAGE_KEY, preference);
  }, [theme, preference]);

  const setPreference = (next: ThemePreference) => setPreferenceState(next);

  const setTheme = (next: ResolvedTheme) => {
    setPreferenceState(next);
  };

  const toggleTheme = () => {
    setPreferenceState((prev) => {
      if (prev === 'system') return systemPref === 'dark' ? 'light' : 'dark';
      return prev === 'dark' ? 'light' : 'dark';
    });
  };

  const value = useMemo<ThemeContextType>(
    () => ({ theme, preference, setPreference, setTheme, toggleTheme }),
    [theme, preference, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
