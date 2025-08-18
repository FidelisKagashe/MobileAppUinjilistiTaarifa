// services/DataService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageService } from './LanguageService';
import {
  DailyReport,
  WeeklyReport,
  MonthlyReport,
  UserProfile,
  AppSettings,
} from '@/types/Report';

const STORAGE_KEYS = {
  DAILY_REPORTS: '@dodoma_ctf_daily_reports',
  WEEKLY_REPORTS: '@dodoma_ctf_weekly_reports',
  MONTHLY_REPORTS: '@dodoma_ctf_monthly_reports',
  USER_PROFILE: '@dodoma_ctf_user_profile',
  SETTINGS: '@dodoma_ctf_settings',
  PASSWORD: '@dodoma_ctf_password',
  WEEK_COUNTER: '@dodoma_ctf_week_counter',
  DATA_VERSION: '@dodoma_ctf_data_version',
  LAST_SYNC: '@dodoma_ctf_last_sync',
};

const CURRENT_DATA_VERSION = '2.1.0';

export class DataService {
  private static isInitialized = false;
  private static initPromise: Promise<void> | null = null;

  // Initialize the service
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._performInitialization();
    await this.initPromise;
    this.isInitialized = true;
  }

  private static async _performInitialization(): Promise<void> {
    try {
      // Check data version and migrate if needed
      await this.checkAndMigrateData();
      
      // Initialize language service
      await LanguageService.initialize();
      
      // Set last sync time
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('DataService initialization error:', error);
    }
  }

  private static async checkAndMigrateData(): Promise<void> {
    try {
      const currentVersion = await AsyncStorage.getItem(STORAGE_KEYS.DATA_VERSION);
      
      if (!currentVersion || currentVersion !== CURRENT_DATA_VERSION) {
        // Perform any necessary data migrations here
        await this.migrateData(currentVersion, CURRENT_DATA_VERSION);
        await AsyncStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
      }
    } catch (error) {
      console.error('Data migration error:', error);
    }
  }

  private static async migrateData(fromVersion: string | null, toVersion: string): Promise<void> {
    // Add migration logic here if needed in the future
    console.log(`Migrating data from ${fromVersion || 'unknown'} to ${toVersion}`);
  }

  // -----------------------
  // User Profile Management
  // -----------------------
  static async saveUserProfile(profile: UserProfile): Promise<void> {
    await this.initialize();
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
      await this.updateLastSync();
    } catch (error) {
      console.error('Error saving user profile:', error);
      throw new Error('Failed to save user profile');
    }
  }

  static async getUserProfile(): Promise<UserProfile | null> {
    await this.initialize();
    try {
      const profileJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return profileJson ? JSON.parse(profileJson) : null;
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  }

  static async hasUserProfile(): Promise<boolean> {
    try {
      const profile = await this.getUserProfile();
      return profile !== null;
    } catch (error) {
      return false;
    }
  }

  // -----------------------
  // Daily Report Management
  // -----------------------
  static async saveDailyReport(report: DailyReport): Promise<void> {
    await this.initialize();
    try {
      const existingReports = await this.getAllDailyReports();
      const updatedReports = [...existingReports.filter(r => r.id !== report.id), report];
      await AsyncStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(updatedReports));
      await this.updateLastSync();

      // Auto-generate weekly report for the week that includes report.date
      await this.generateWeeklyReport(report.date).catch(err => {
        console.warn('generateWeeklyReport failed (non-fatal):', err);
      });
    } catch (error) {
      throw new Error('Failed to save daily report');
    }
  }

  static async getAllDailyReports(): Promise<DailyReport[]> {
    await this.initialize();
    try {
      const reportsJson = await AsyncStorage.getItem(STORAGE_KEYS.DAILY_REPORTS);
      return reportsJson ? JSON.parse(reportsJson) : [];
    } catch (error) {
      console.error('Error loading daily reports:', error);
      return [];
    }
  }

  static async getDailyReportByDate(date: string): Promise<DailyReport | null> {
    try {
      const reports = await this.getAllDailyReports();
      return reports.find(report => report.date === date) || null;
    } catch (error) {
      console.error('Error loading daily report:', error);
      return null;
    }
  }

  static async getDailyReportsForWeek(weekStartDate: string): Promise<DailyReport[]> {
    try {
      const reports = await this.getAllDailyReports();
      const weekStart = new Date(weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 4); // Sunday..Friday (5 days)

      return reports.filter(report => {
        const reportDate = new Date(report.date);
        return reportDate >= weekStart && reportDate <= weekEnd;
      });
    } catch (error) {
      console.error('Error loading weekly daily reports:', error);
      return [];
    }
  }

  // -----------------------
  // Weekly Report Management
  // -----------------------
  static async generateWeeklyReport(dateInWeek: string): Promise<WeeklyReport> {
    try {
      const weekStart = this.getWeekStartDate(new Date(dateInWeek));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 4); // Friday

      const dailyReports = await this.getDailyReportsForWeek(weekStart.toISOString().split('T')[0]);
      const profile = await this.getUserProfile();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Use stored week counter to assign week number (increments)
      const weekNumber = await this.getNextWeekNumber();
      const isCurrentWeekLocked = this.isWeekLocked(weekStart);

      const weeklyReport: WeeklyReport = {
        id: `week_${weekStart.toISOString().split('T')[0]}`,
        weekNumber,
        weekStartDate: weekStart.toISOString().split('T')[0],
        weekEndDate: weekEnd.toISOString().split('T')[0],
        studentName: profile.fullName,
        phoneNumber: profile.phoneNumber,
        totalHours: dailyReports.reduce((sum, r) => sum + (r.hoursWorked || 0), 0),
        totalBooksSold: dailyReports.reduce((sum, r) => sum + (r.booksSold || 0), 0),
        totalAmount: dailyReports.reduce((sum, r) => sum + (r.dailyAmount || 0), 0),
        totalFreeLiterature: dailyReports.reduce((sum, r) => sum + (r.freeLiterature || 0), 0),
        totalVopActivities: dailyReports.reduce((sum, r) => sum + (r.vopActivities || 0), 0),
        totalChurchAttendees: dailyReports.reduce((sum, r) => sum + (r.churchAttendees || 0), 0),
        totalBackSlidesVisited: dailyReports.reduce((sum, r) => sum + (r.backSlidesVisited || 0), 0),
        totalPrayersOffered: dailyReports.reduce((sum, r) => sum + (r.prayersOffered || 0), 0),
        totalBibleStudies: dailyReports.reduce((sum, r) => sum + (r.bibleStudies || 0), 0),
        totalBaptismCandidates: dailyReports.reduce((sum, r) => sum + (r.baptismCandidates || 0), 0),
        totalBaptismsPerformed: dailyReports.reduce((sum, r) => sum + (r.baptismsPerformed || 0), 0),
        totalPeopleVisited: dailyReports.reduce((sum, r) => sum + (r.peopleVisited || 0), 0),
        dailyReports,
        isLocked: isCurrentWeekLocked,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.saveWeeklyReport(weeklyReport);
      return weeklyReport;
    } catch (error) {
      console.error('generateWeeklyReport error:', error);
      throw new Error('Failed to generate weekly report');
    }
  }

  static async saveWeeklyReport(report: WeeklyReport): Promise<void> {
    await this.initialize();
    try {
      const existingReports = await this.getAllWeeklyReports();
      const updatedReports = [...existingReports.filter(r => r.id !== report.id), report];
      await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_REPORTS, JSON.stringify(updatedReports));
      await this.updateLastSync();
    } catch (error) {
      console.error('Error saving weekly report:', error);
      throw new Error('Failed to save weekly report');
    }
  }

  static async getAllWeeklyReports(): Promise<WeeklyReport[]> {
    await this.initialize();
    try {
      const reportsJson = await AsyncStorage.getItem(STORAGE_KEYS.WEEKLY_REPORTS);
      return reportsJson ? JSON.parse(reportsJson) : [];
    } catch (error) {
      console.error('Error loading weekly reports:', error);
      return [];
    }
  }

  static async getCurrentWeekReport(): Promise<WeeklyReport | null> {
    try {
      const today = new Date();
      const weekStart = this.getWeekStartDate(today);
      const weekId = `week_${weekStart.toISOString().split('T')[0]}`;

      const reports = await this.getAllWeeklyReports();
      return reports.find(report => report.id === weekId) || null;
    } catch (error) {
      console.error('Error loading current week report:', error);
      return null;
    }
  }

  // -----------------------
  // Monthly Report Management
  // -----------------------
  static async generateMonthlyReport(month: number, year: number): Promise<MonthlyReport> {
    try {
      const weeklyReports = await this.getAllWeeklyReports();
      const monthlyWeeklyReports = weeklyReports.filter(report => {
        const reportDate = new Date(report.weekStartDate);
        return reportDate.getMonth() === month - 1 && reportDate.getFullYear() === year;
      });

      const profile = await this.getUserProfile();
      if (!profile) {
        throw new Error('User profile not found');
      }

      const monthlyReport: MonthlyReport = {
        id: `month_${year}_${month}`,
        month,
        year,
        studentName: profile.fullName,
        phoneNumber: profile.phoneNumber,
        weeklyReports: monthlyWeeklyReports,
        totalHours: monthlyWeeklyReports.reduce((sum, r) => sum + (r.totalHours || 0), 0),
        totalAmount: monthlyWeeklyReports.reduce((sum, r) => sum + (r.totalAmount || 0), 0),
        totalBooks: monthlyWeeklyReports.reduce((sum, r) => sum + (r.totalBooksSold || 0), 0),
        totalMinistryActivities: monthlyWeeklyReports.reduce(
          (sum, r) => sum + (r.totalBibleStudies || 0) + (r.totalPrayersOffered || 0) + (r.totalBaptismsPerformed || 0),
          0
        ),
        createdAt: new Date().toISOString(),
      };

      await this.saveMonthlyReport(monthlyReport);
      return monthlyReport;
    } catch (error) {
      throw new Error('Failed to generate monthly report');
    }
  }

  static async saveMonthlyReport(report: MonthlyReport): Promise<void> {
    await this.initialize();
    try {
      const existingReports = await this.getAllMonthlyReports();
      const updatedReports = [...existingReports.filter(r => r.id !== report.id), report];
      await AsyncStorage.setItem(STORAGE_KEYS.MONTHLY_REPORTS, JSON.stringify(updatedReports));
      await this.updateLastSync();
    } catch (error) {
      console.error('Error saving monthly report:', error);
      throw new Error('Failed to save monthly report');
    }
  }

  static async getAllMonthlyReports(): Promise<MonthlyReport[]> {
    await this.initialize();
    try {
      const reportsJson = await AsyncStorage.getItem(STORAGE_KEYS.MONTHLY_REPORTS);
      return reportsJson ? JSON.parse(reportsJson) : [];
    } catch (error) {
      console.error('Error loading monthly reports:', error);
      return [];
    }
  }

  // -----------------------
  // Authentication
  // -----------------------
  static async setPassword(password: string): Promise<void> {
    await this.initialize();
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PASSWORD, password);
      await this.updateLastSync();
    } catch (error) {
      console.error('Error setting password:', error);
      throw new Error('Failed to set password');
    }
  }

  static async verifyPassword(password: string): Promise<boolean> {
    await this.initialize();
    try {
      const storedPassword = await AsyncStorage.getItem(STORAGE_KEYS.PASSWORD);
      return storedPassword === password;
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  static async hasPassword(): Promise<boolean> {
    try {
      const password = await AsyncStorage.getItem(STORAGE_KEYS.PASSWORD);
      return password !== null;
    } catch (error) {
      console.error('Error checking password:', error);
      return false;
    }
  }

  // -----------------------
  // Settings Management
  // -----------------------
  static async getSettings(): Promise<AppSettings> {
    await this.initialize();
    try {
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return settingsJson
        ? JSON.parse(settingsJson)
        : {
            biometricEnabled: false,
            autoLockWeeks: true,
            reminderNotifications: false,
            lastBackup: null,
            authMethod: 'password',
            theme: 'light',
            language: 'sw',
            firstUseDate: null,
          };
    } catch (error) {
      console.error('Error loading settings:', error);
      return {
        biometricEnabled: false,
        autoLockWeeks: true,
        reminderNotifications: false,
        lastBackup: null,
        authMethod: 'password',
        theme: 'light',
        language: 'sw',
        firstUseDate: null,
      };
    }
  }

  static async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    await this.initialize();
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
      await this.updateLastSync();
    } catch (error) {
      console.error('Error updating settings:', error);
      throw new Error('Failed to update settings');
    }
  }

  // -----------------------
  // Sync and Performance
  // -----------------------
  private static async updateLastSync(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.warn('Failed to update last sync time:', error);
    }
  }

  static async getLastSyncTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    } catch (error) {
      console.warn('Failed to get last sync time:', error);
      return null;
    }
  }

  // Batch operations for better performance
  static async batchSaveReports(dailyReports: DailyReport[]): Promise<void> {
    await this.initialize();
    try {
      const operations = dailyReports.map(report =>
        [`@dodoma_ctf_daily_report_${report.id}`, JSON.stringify(report)] as const
      );
      await AsyncStorage.multiSet(operations);
      await this.updateLastSync();
    } catch (error) {
      console.error('Batch save error:', error);
      throw new Error('Failed to batch save reports');
    }
  }

  // -----------------------
  // First use date helpers
  // -----------------------
  static async setFirstUseDate(): Promise<void> {
    try {
      const settings = await this.getSettings();
      if (!settings.firstUseDate) {
        await this.updateSettings({
          firstUseDate: new Date().toISOString().split('T')[0],
        });
      }
    } catch (error) {
      console.error('Error setting first use date:', error);
    }
  }

  static async getMissingDatesFromFirstUse(): Promise<string[]> {
    try {
      const settings = await this.getSettings();
      const dailyReports = await this.getAllDailyReports();
      const reportDates = new Set(dailyReports.map(r => r.date));
      const missingDates: string[] = [];

      const firstUseDate = settings.firstUseDate ? new Date(settings.firstUseDate) : new Date();
      const today = new Date();

      let checkDate = new Date(firstUseDate);
      while (checkDate <= today) {
        const dayOfWeek = checkDate.getDay();
        // Only check Sunday to Friday (0-5)
        if (dayOfWeek >= 0 && dayOfWeek <= 5) {
          const dateString = this.getDateString(checkDate);
          if (!reportDates.has(dateString)) {
            missingDates.push(dateString);
          }
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }

      return missingDates.sort();
    } catch (error) {
      console.error('Error getting missing dates:', error);
      return [];
    }
  }

  // -----------------------
  // Current week helper
  // -----------------------
  static getCurrentWeekDates(): string[] {
    const today = new Date();
    const weekStart = this.getWeekStartDate(today);
    const dates: string[] = [];

    // Sunday (0) to Friday (5) - 6 days total (indexes 0..5)
    for (let i = 0; i < 6; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();
      // Only include Sunday (0) to Friday (5)
      if (dayOfWeek >= 0 && dayOfWeek <= 5) {
        dates.push(this.getDateString(date));
      }
    }

    return dates;
  }

  // -----------------------
  // Logout
  // -----------------------
  static async logout(): Promise<void> {
    try {
      // Clear sensitive data but keep user profile and settings
      await AsyncStorage.multiRemove([STORAGE_KEYS.PASSWORD]);
    } catch (error) {
      throw new Error('Failed to logout');
    }
  }

  // -----------------------
  // Utility Functions
  // -----------------------
  static getWeekStartDate(date: Date): Date {
    const day = date.getDay(); // 0 = Sunday
    const diff = date.getDate() - day; // move back to Sunday
    const weekStart = new Date(date);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  static getWeekEndDate(weekStart: Date): Date {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 5); // Friday (Sunday + 5 days = Friday)
    weekEnd.setHours(18, 0, 0, 0); // 6:00 PM
    return weekEnd;
  }

  static isWeekLocked(weekStart: Date): boolean {
    const now = new Date();
    const weekEnd = this.getWeekEndDate(weekStart);
    // Week is locked after Friday 6:00 PM
    return now >= weekEnd;
  }

  static async getNextWeekNumber(): Promise<number> {
    try {
      const counterStr = await AsyncStorage.getItem(STORAGE_KEYS.WEEK_COUNTER);
      const counter = counterStr ? parseInt(counterStr, 10) : 0;
      const nextNumber = counter + 1;
      await AsyncStorage.setItem(STORAGE_KEYS.WEEK_COUNTER, nextNumber.toString());
      return nextNumber;
    } catch (error) {
      console.error('Error getting next week number:', error);
      return 1;
    }
  }

  static getDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static getDayName(date: Date): string {
    return LanguageService.getDayName(date);
  }

  static getMonthName(month: number): string {
    return LanguageService.getMonthName(month);
  }

  // -----------------------
  // Data Management
  // -----------------------
  static async exportAllData(): Promise<string> {
    await this.initialize();
    try {
      const dailyReports = await this.getAllDailyReports();
      const weeklyReports = await this.getAllWeeklyReports();
      const monthlyReports = await this.getAllMonthlyReports();
      const userProfile = await this.getUserProfile();
      const settings = await this.getSettings();
      const lastSync = await this.getLastSyncTime();

      const exportData = {
        userProfile,
        dailyReports,
        weeklyReports,
        monthlyReports,
        settings,
        lastSync,
        exportDate: new Date().toISOString(),
        version: CURRENT_DATA_VERSION,
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      throw new Error('Failed to export data');
    }
  }

  static async clearAllData(): Promise<void> {
    await this.initialize();
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.DAILY_REPORTS,
        STORAGE_KEYS.WEEKLY_REPORTS,
        STORAGE_KEYS.MONTHLY_REPORTS,
        STORAGE_KEYS.WEEK_COUNTER,
      ]);
      await this.updateLastSync();
    } catch (error) {
      console.error('Error clearing data:', error);
      throw new Error('Failed to clear data');
    }
  }

  // Import data with validation
  static async importData(jsonData: string): Promise<void> {
    await this.initialize();
    try {
      const data = JSON.parse(jsonData);
      
      // Validate data structure
      if (!data.version || !data.userProfile) {
        throw new Error('Invalid data format');
      }
      
      // Import user profile
      if (data.userProfile) {
        await this.saveUserProfile(data.userProfile);
      }
      
      // Import reports
      if (data.dailyReports && Array.isArray(data.dailyReports)) {
        await AsyncStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(data.dailyReports));
      }
      
      if (data.weeklyReports && Array.isArray(data.weeklyReports)) {
        await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_REPORTS, JSON.stringify(data.weeklyReports));
      }
      
      if (data.monthlyReports && Array.isArray(data.monthlyReports)) {
        await AsyncStorage.setItem(STORAGE_KEYS.MONTHLY_REPORTS, JSON.stringify(data.monthlyReports));
      }
      
      // Import settings
      if (data.settings) {
        await this.updateSettings(data.settings);
      }
      
      await this.updateLastSync();
    } catch (error) {
      console.error('Import data error:', error);
      throw new Error('Failed to import data');
    }
  }

  // -----------------------
  // Backfill / missing checks
  // -----------------------
  static async getMissingDates(): Promise<string[]> {
    try {
      const dailyReports = await this.getAllDailyReports();
      const reportDates = new Set(dailyReports.map(r => r.date));
      const missingDates: string[] = [];

      // Check last 30 days for missing reports
      const today = new Date();
      for (let i = 1; i <= 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);

        // Only check Sunday to Friday
        const dayOfWeek = checkDate.getDay();
        if (dayOfWeek >= 0 && dayOfWeek <= 5) {
          const dateString = this.getDateString(checkDate);
          if (!reportDates.has(dateString)) {
            missingDates.push(dateString);
          }
        }
      }

      return missingDates.sort();
    } catch (error) {
      console.error('Error getting missing dates:', error);
      return [];
    }
  }

  // -----------------------
  // Analytics Helper Methods
  // -----------------------
  static async getWeeklyPerformance(): Promise<any> {
    try {
      const weeklyReports = await this.getAllWeeklyReports();
      const last4Weeks = weeklyReports.slice(-4);
      const weeksCount = last4Weeks.length || 1; // avoid divide-by-zero

      return {
        averageHours: last4Weeks.reduce((sum, r) => sum + (r.totalHours || 0), 0) / weeksCount,
        averageSales: last4Weeks.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / weeksCount,
        totalBaptisms: weeklyReports.reduce((sum, r) => sum + (r.totalBaptismsPerformed || 0), 0),
        totalBibleStudies: weeklyReports.reduce((sum, r) => sum + (r.totalBibleStudies || 0), 0),
      };
    } catch (error) {
      console.error('Error calculating performance:', error);
      return null;
    }
  }
}
