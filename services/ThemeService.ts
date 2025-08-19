// services/ThemeService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Core colors
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  
  // Background colors
  background: string;
  surface: string;
  card: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  
  // Border colors
  border: string;
}

export const lightTheme: ThemeColors = {
  primary: '#2563eb',
  secondary: '#7c3aed',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  
  background: '#f8fafc',
  surface: '#ffffff',
  card: '#ffffff',
  
  text: '#0f172a',
  textSecondary: '#64748b',
  
  border: '#e2e8f0',
};

export const darkTheme: ThemeColors = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  
  background: '#0f172a',
  surface: '#1e293b',
  card: '#334155',
  
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  
  border: '#475569',
};

const THEME_STORAGE_KEY = '@app_theme_mode';

export class ThemeService {
  private static currentMode: ThemeMode = 'light';

  static async getCurrentThemeMode(): Promise<ThemeMode> {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        this.currentMode = stored;
        return stored;
      }
      return 'light';
    } catch (error) {
      console.warn('ThemeService: Failed to get theme mode:', error);
      return 'light';
    }
  }

  static async setTheme(mode: ThemeMode): Promise<void> {
    try {
      this.currentMode = mode;
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('ThemeService: Failed to set theme mode:', error);
      throw error;
    }
  }

  static getCurrentMode(): ThemeMode {
    return this.currentMode;
  }
}