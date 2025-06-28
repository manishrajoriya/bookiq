import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeType = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: ThemeType;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme() as 'light' | 'dark' | null;
  const [theme, setTheme] = useState<ThemeType>('system');

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (systemScheme || 'light') : theme;

  const toggleTheme = () => {
    setTheme(prev =>
      prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'
    );
  };

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  }), [theme, resolvedTheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used within ThemeProvider');
  return ctx;
} 