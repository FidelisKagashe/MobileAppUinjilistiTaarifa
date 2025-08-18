// services/ThemeService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataService } from './DataService';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  card: string;
}

export const lightTheme: ThemeColors = {
  primary: '#1e3a8a',
  secondary: '#059669',
  background: '#f8fafc',
  surface: '#ffffff',
  text: '#1f2937',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  success: '#059669',
  warning: '#f59e0b',
  error: '#dc2626',
  card: '#ffffff',
};

export const darkTheme: ThemeColors = {
  primary: '#3b82f6',
  secondary: '#10b981',
  background: '#111827',
  surface: '#1f2937',
  text: '#f9fafb',
  textSecondary: '#9ca3af',
  border: '#374151',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  card: '#1f2937',
};

const STORAGE_KEY = '@app_theme_mode';

export class ThemeService {
  /**
   * Returns 'light' or 'dark'. Tries AsyncStorage first, then falls back to DataService,
   * and defaults to 'light' on error.
   */
  static async getCurrentThemeMode(): Promise<ThemeMode> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached === 'dark' || cached === 'light') return cached;

      // Fallback to DataService (authoritative settings store)
      const settings = await DataService.getSettings();
      if (settings && (settings.theme === 'dark' || settings.theme === 'light')) {
        // cache locally for faster startup next time
        try {
          await AsyncStorage.setItem(STORAGE_KEY, settings.theme);
        } catch (_) {
          // ignore cache set failure
        }
        return settings.theme;
      }

      return 'light';
    } catch (error) {
      console.warn('ThemeService.getCurrentThemeMode error:', error);
      return 'light';
    }
  }

  /** Returns the ThemeColors object for the current mode. */
  static async getCurrentTheme(): Promise<ThemeColors> {
    const mode = await this.getCurrentThemeMode();
    return mode === 'dark' ? darkTheme : lightTheme;
  }

  /**
   * Set theme mode both locally (AsyncStorage) and in DataService (authoritative).
   * If DataService.updateSettings fails, the local cache is still attempted.
   */
  static async setTheme(mode: ThemeMode): Promise<void> {
    try {
      // try update authoritative store first
      await DataService.updateSettings({ theme: mode }).catch((err) => {
        // log but continue to set local cache so app reflects change immediately
        console.warn('ThemeService: DataService.updateSettings failed:', err);
      });

      // cache locally
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch (error) {
      console.error('ThemeService.setTheme error:', error);
    }
  }

  /** Convenience to toggle between modes. */
  static async toggleTheme(): Promise<void> {
    try {
      const current = await this.getCurrentThemeMode();
      const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
      await this.setTheme(next);
    } catch (error) {
      console.error('ThemeService.toggleTheme error:', error);
    }
  }
}
