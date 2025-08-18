// app/providers/ThemeProvider.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  ThemeService,
  ThemeColors,
  lightTheme,
  darkTheme,
  ThemeMode,
} from '../../services/ThemeService';

type ThemeContextValue = {
  theme: ThemeColors;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggle: () => Promise<void>;
  isLoading: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeColors>(lightTheme);
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    (async () => {
      try {
        setIsLoading(true);
        const currentMode = await ThemeService.getCurrentThemeMode();
        if (!mounted) return;
        
        setModeState(currentMode);
        setTheme(currentMode === 'dark' ? darkTheme : lightTheme);
      } catch (err) {
        console.warn('ThemeProvider init error:', err);
        // Fallback to light theme on error
        if (mounted) {
          setModeState('light');
          setTheme(lightTheme);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();
    
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback(async (m: ThemeMode) => {
    try {
      setIsLoading(true);
      await ThemeService.setTheme(m);
      setModeState(m);
      setTheme(m === 'dark' ? darkTheme : lightTheme);
    } catch (err) {
      console.warn('ThemeProvider: ThemeService.setTheme failed:', err);
      // Don't update state if save failed
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggle = useCallback(async () => {
    await setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggle, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
