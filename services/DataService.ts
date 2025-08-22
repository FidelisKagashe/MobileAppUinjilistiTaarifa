// services/DataService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageService } from './LanguageService';
import {
  DailyReport,
  WeeklyReport,
  MonthlyReport,
  UserProfile,
  AppSettings,
  WorkWeekInfo,
  WorkDay,
  WeekSummaryReport,
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
  FIRST_LOGIN_DATE: '@dodoma_ctf_first_login_date',
  CURRENT_WORK_WEEK: '@dodoma_ctf_current_work_week',
  RECOVERY_CODE: '@dodoma_ctf_recovery_code',
};

const CURRENT_DATA_VERSION = '2.1.0';

type EventName = 'reportsUpdated' | 'settingsUpdated' | 'profileUpdated' | 'authUpdated' | 'dataCleared';

export class DataService {
  private static isInitialized = false;
  private static initPromise: Promise<void> | null = null;

  // simple in-memory event emitter
  private static listeners: Partial<Record<EventName, Set<() => void>>> = {};

  static subscribe(event: EventName, cb: () => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = new Set();
    this.listeners[event]!.add(cb);
    return () => {
      this.listeners[event]!.delete(cb);
    };
  }

  // --- BACKWARDS COMPATIBILITY helper many screens expect this name ---
  static subscribeDataChanges(cb: () => void): () => void {
    // subscribe to the 'reportsUpdated' event which indicates any report change
    return this.subscribe('reportsUpdated', cb);
  }

  // Convenience to emit the reportsUpdated event
  static emitDataChanges() {
    this.emit('reportsUpdated');
  }

  private static emit(event: EventName) {
    const set = this.listeners[event];
    if (!set) return;
    for (const cb of Array.from(set)) {
      try {
        cb();
      } catch (err) {
        console.warn('DataService listener error', err);
      }
    }
  }

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
      await this.checkAndMigrateData();
      await LanguageService.initialize();
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('DataService initialization error:', error);
    }
  }

  private static async checkAndMigrateData(): Promise<void> {
    try {
      const currentVersion = await AsyncStorage.getItem(STORAGE_KEYS.DATA_VERSION);
      if (!currentVersion || currentVersion !== CURRENT_DATA_VERSION) {
        await this.migrateData(currentVersion, CURRENT_DATA_VERSION);
        await AsyncStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
      }
    } catch (error) {
      console.error('Data migration error:', error);
    }
  }

  private static async migrateData(fromVersion: string | null, toVersion: string): Promise<void> {
    console.log(`Migrating data from ${fromVersion || 'unknown'} to ${toVersion}`);
    // migration logic (if any) goes here
  }

  // -----------------------
  // User Profile Management
  // -----------------------
  static async saveUserProfile(profile: UserProfile): Promise<void> {
    await this.initialize();
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
      await this.updateLastSync();
      // Emit multiple events to ensure all components update
      this.emit('profileUpdated');
      this.emit('reportsUpdated');
      this.emit('settingsUpdated');
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
      // normalize numbers from bookSales if present
      if (Array.isArray(report.bookSales)) {
        const booksSoldFromDetails = report.bookSales.reduce((s, b) => s + (Number(b.quantity) || 0), 0);
        const amountFromDetails = report.bookSales.reduce((s, b) => s + ((Number(b.price) || 0) * (Number(b.quantity) || 0)), 0);
        // prefer explicit fields on report, otherwise fill from bookSales
        report.booksSold = Number(report.booksSold ?? booksSoldFromDetails);
        report.dailyAmount = Number(report.dailyAmount ?? amountFromDetails);
      } else {
        report.booksSold = Number(report.booksSold ?? 0);
        report.dailyAmount = Number(report.dailyAmount ?? 0);
      }

      const existingReports = await this.getAllDailyReports();
      const updatedReports = [...existingReports.filter(r => r.id !== report.id), report];
      await AsyncStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(updatedReports));
      await this.updateLastSync();

      console.log('[DataService] saveDailyReport saved, rebuilding weekly reports for consistency');

      // Rebuild all weekly reports from daily data (keeps aggregates consistent)
      try {
        await this.rebuildWeeklyReportsFromDaily();
      } catch (err) {
        console.warn('rebuildWeeklyReportsFromDaily failed (non-fatal):', err);
      }

      // Emit multiple events to ensure all components update
      this.emit('reportsUpdated');
      this.emit('profileUpdated');
      this.emit('settingsUpdated');
    } catch (error) {
      console.error('saveDailyReport error', error);
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

  /**
   * Returns daily reports that fall inside the week that starts at weekStartDate (YYYY-MM-DD).
   * NOTE: comparison is done by date strings (YYYY-MM-DD) to avoid timezone issues.
   */
  static async getDailyReportsForWeek(weekStartDate: string): Promise<DailyReport[]> {
    try {
      const reports = await this.getAllDailyReports();
      // Build allowed date strings (Sunday..Friday) using local dates to avoid timezone pitfalls
      const weekStart = new Date(weekStartDate + 'T00:00:00');
      const allowedDates: string[] = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dayOfWeek = d.getDay();
        if (dayOfWeek >= 0 && dayOfWeek <= 5) {
          allowedDates.push(this.getDateString(d));
        }
      }

      return reports.filter(report => {
        // report.date expected in 'YYYY-MM-DD' format. safeguard by splitting if time present.
        const rd = (report.date || '').split('T')[0];
        return allowedDates.includes(rd);
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
      const weekEnd = this.getWeekEndDate(weekStart); // Friday 18:00

      const weekStartStr = weekStart.toISOString().split('T')[0];
      // Use date-string based daily retrieval (avoids timezone off-by-one)
      const dailyReports = await this.getDailyReportsForWeek(weekStartStr);
      const profile = await this.getUserProfile();
      if (!profile) throw new Error('User profile not found');

      // Check if a weekly report for this week already exists
      const existingWeekly = (await this.getAllWeeklyReports()).find(w => w.weekStartDate === weekStartStr);
      let weekNumber = existingWeekly ? existingWeekly.weekNumber : this.getWeekNumber(weekStart);

      const isCurrentWeekLocked = this.isWeekLocked(weekStart);

      const weeklyReport: WeeklyReport = {
        id: `week_${weekStartStr}`,
        weekNumber,
        weekStartDate: weekStartStr,
        weekEndDate: weekEnd.toISOString().split('T')[0],
        studentName: profile.fullName,
        phoneNumber: profile.phoneNumber,
        totalHours: dailyReports.reduce((sum, r) => sum + (r.hoursWorked || 0), 0),
        totalBooksSold: dailyReports.reduce((sum, r) => sum + ((typeof r.booksSold === 'number' ? r.booksSold : (Array.isArray(r.bookSales) ? r.bookSales.reduce((s, b) => s + (Number(b.quantity)||0), 0) : 0)) ), 0),
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
        createdAt: existingWeekly?.createdAt || new Date().toISOString(),
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
      const updatedReports = [...existingReports.filter(r => r.id !== report.id), report].sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
      await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_REPORTS, JSON.stringify(updatedReports));
      await this.updateLastSync();
      console.log('[DataService] saved weekly report', report.id);
      // notify that reports changed
      this.emit('reportsUpdated');
    } catch (error) {
      console.error('Error saving weekly report:', error);
      throw new Error('Failed to save weekly report');
    }
  }

  static async getAllWeeklyReports(): Promise<WeeklyReport[]> {
    await this.initialize();
    try {
      const reportsJson = await AsyncStorage.getItem(STORAGE_KEYS.WEEKLY_REPORTS);
      const arr: WeeklyReport[] = reportsJson ? JSON.parse(reportsJson) : [];
      // always return sorted by weekNumber ascending (safe)
      return arr.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
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

  // rebuild all weekly reports from daily reports (bulk, authoritative)
  private static async rebuildWeeklyReportsFromDaily(): Promise<WeeklyReport[]> {
    await this.initialize();
    try {
      const dailyReports = await this.getAllDailyReports();
      const profile = await this.getUserProfile();
      const map: Record<string, { dailyReports: DailyReport[] }> = {};

      for (const d of dailyReports) {
        // canonicalize date string
        const dateStr = (d.date || '').split('T')[0];
        const weekStartDate = this.getWeekStartDate(new Date(dateStr)).toISOString().split('T')[0];
        if (!map[weekStartDate]) map[weekStartDate] = { dailyReports: [] };
        map[weekStartDate].dailyReports.push(d);
      }

      const weeklyArr: WeeklyReport[] = [];

      for (const weekStartStr of Object.keys(map)) {
        const weekStart = new Date(weekStartStr + 'T00:00:00');
        const weekEnd = this.getWeekEndDate(weekStart);
        const dailyForWeek = map[weekStartStr].dailyReports;
        const weekNumber = this.getWeekNumber(weekStart);
        const isLocked = this.isWeekLocked(weekStart);

        const wr: WeeklyReport = {
          id: `week_${weekStartStr}`,
          weekNumber,
          weekStartDate: weekStartStr,
          weekEndDate: weekEnd.toISOString().split('T')[0],
          studentName: profile?.fullName || '',
          phoneNumber: profile?.phoneNumber || '',
          totalHours: dailyForWeek.reduce((sum, r) => sum + (r.hoursWorked || 0), 0),
          totalBooksSold: dailyForWeek.reduce((sum, r) => sum + ((typeof r.booksSold === 'number' ? r.booksSold : (Array.isArray(r.bookSales) ? r.bookSales.reduce((s, b) => s + (Number(b.quantity)||0), 0) : 0)) ), 0),
          totalAmount: dailyForWeek.reduce((sum, r) => sum + (r.dailyAmount || 0), 0),
          totalFreeLiterature: dailyForWeek.reduce((sum, r) => sum + (r.freeLiterature || 0), 0),
          totalVopActivities: dailyForWeek.reduce((sum, r) => sum + (r.vopActivities || 0), 0),
          totalChurchAttendees: dailyForWeek.reduce((sum, r) => sum + (r.churchAttendees || 0), 0),
          totalBackSlidesVisited: dailyForWeek.reduce((sum, r) => sum + (r.backSlidesVisited || 0), 0),
          totalPrayersOffered: dailyForWeek.reduce((sum, r) => sum + (r.prayersOffered || 0), 0),
          totalBibleStudies: dailyForWeek.reduce((sum, r) => sum + (r.bibleStudies || 0), 0),
          totalBaptismCandidates: dailyForWeek.reduce((sum, r) => sum + (r.baptismCandidates || 0), 0),
          totalBaptismsPerformed: dailyForWeek.reduce((sum, r) => sum + (r.baptismsPerformed || 0), 0),
          totalPeopleVisited: dailyForWeek.reduce((sum, r) => sum + (r.peopleVisited || 0), 0),
          dailyReports: dailyForWeek,
          isLocked,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        weeklyArr.push(wr);
      }

      // sort ascending by weekNumber for stable ordering
      weeklyArr.sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
      await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_REPORTS, JSON.stringify(weeklyArr));
      await this.updateLastSync();
      console.log('[DataService] rebuildWeeklyReportsFromDaily wrote', weeklyArr.length, 'weeks');
      this.emit('reportsUpdated');
      return weeklyArr;
    } catch (error) {
      console.error('rebuildWeeklyReportsFromDaily error:', error);
      return [];
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
      if (!profile) throw new Error('User profile not found');

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
      console.log('[DataService] saved monthly report', report.id);
      // Emit multiple events to ensure all components update
      this.emit('reportsUpdated');
      this.emit('profileUpdated');
      this.emit('settingsUpdated');
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
  static async getAuthMethod(): Promise<'password' | 'pin' | 'pattern' | 'biometric'> {
    try {
      const settings = await this.getSettings();
      const method = settings?.authMethod;
      if (method === 'pin' || method === 'pattern' || method === 'biometric') return method;
      return 'password';
    } catch (error) {
      console.warn('getAuthMethod error, defaulting to password', error);
      return 'password';
    }
  }

  static async getAuthValue(): Promise<string | null> {
    await this.initialize();
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PASSWORD);
    } catch (error) {
      console.error('Error reading auth value:', error);
      return null;
    }
  }

  static async setAuthValue(value: string, method?: 'password' | 'pin' | 'pattern' | 'biometric'): Promise<void> {
    await this.initialize();
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PASSWORD, value);
      if (method) {
        await this.updateSettings({ authMethod: method });
      }
      await this.updateLastSync();
      this.emit('authUpdated');
    } catch (error) {
      console.error('Error setting auth value:', error);
      throw new Error('Failed to set authentication value');
    }
  }

  static async verifyAuthValue(candidate: string): Promise<boolean> {
    await this.initialize();
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PASSWORD);
      if (!stored) return false;
      return stored === candidate;
    } catch (error) {
      console.error('Error verifying auth value:', error);
      return false;
    }
  }

  static async setPassword(password: string): Promise<void> {
    await this.setAuthValue(password, 'password');
  }

  static async verifyPassword(password: string): Promise<boolean> {
    return this.verifyAuthValue(password);
  }

  static async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.initialize();
    try {
      const isCurrentValid = await this.verifyAuthValue(currentPassword);
      if (!isCurrentValid) {
        throw new Error('Current password is incorrect');
      }
      await AsyncStorage.setItem(STORAGE_KEYS.PASSWORD, newPassword);
      await this.updateLastSync();
      this.emit('authUpdated');
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
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
  // Recovery code (offline)
  // -----------------------
  static async generateAndStoreRecoveryCode(): Promise<string> {
    await this.initialize();
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let out = '';
      for (let i = 0; i < 12; i++) {
        out += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      await AsyncStorage.setItem(STORAGE_KEYS.RECOVERY_CODE, out);
      await this.updateLastSync();
      return out;
    } catch (error) {
      console.error('Error generating recovery code:', error);
      throw new Error('Failed to generate recovery code');
    }
  }

  static async getRecoveryCode(): Promise<string | null> {
    await this.initialize();
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.RECOVERY_CODE);
    } catch (error) {
      console.error('Error reading recovery code:', error);
      return null;
    }
  }

  static async verifyRecoveryCode(code: string): Promise<boolean> {
    await this.initialize();
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.RECOVERY_CODE);
      if (!stored) return false;
      return stored === code;
    } catch (error) {
      console.error('Error verifying recovery code:', error);
      return false;
    }
  }

  static async recoverPasswordWithCode(recoveryCode: string, newPassword: string): Promise<void> {
    await this.initialize();
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.RECOVERY_CODE);
      if (!stored || stored !== recoveryCode) {
        throw new Error('Invalid recovery code');
      }
      await this.setAuthValue(newPassword, 'password');
      await this.updateLastSync();
    } catch (error) {
      console.error('Error recovering password with code:', error);
      throw error;
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
      // Emit multiple events to ensure all components update
      this.emit('settingsUpdated');
      this.emit('reportsUpdated');
      this.emit('profileUpdated');
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

  // Updated: store array into DAILY_REPORTS (consistent)
  static async batchSaveReports(dailyReports: DailyReport[]): Promise<void> {
    await this.initialize();
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(dailyReports));
      await this.updateLastSync();
      // after bulk save, rebuild weekly reports to keep aggregates consistent
      try {
        await this.rebuildWeeklyReportsFromDaily();
      } catch (err) {
        console.warn('rebuildWeeklyReportsFromDaily failed after batchSave (non-fatal):', err);
      }
      this.emit('reportsUpdated');
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
        // include Sunday (0) through Friday (5)
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
    for (let i = 0; i < 6; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dayOfWeek = date.getDay();
      // include Sunday (0) through Friday (5)
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
      // NOTE: Do NOT remove stored PASSWORD here — we want the login screen to still require it.
      // Remove only transient auth counters and disable biometric so reopening forces password entry.
      await AsyncStorage.multiRemove([
        '@auth_failed_attempts',
        '@auth_lock_until'
      ]);

      // ensure biometric is disabled and auth method set to password
      try {
        await this.updateSettings({
          biometricEnabled: false,
          authMethod: 'password'
        });
      } catch (e) {
        console.warn('Could not update settings during logout', e);
      }

      this.emit('authUpdated');
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Failed to logout');
    }
  }

  // -----------------------
  // First-Time Login & Work Week Tracking
  // -----------------------
  static async recordFirstLogin(): Promise<void> {
    try {
      const firstLoginDate = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_LOGIN_DATE);
      if (!firstLoginDate) {
        const now = new Date();
        await AsyncStorage.setItem(STORAGE_KEYS.FIRST_LOGIN_DATE, now.toISOString());
        const workWeek = this.calculateCurrentWorkWeek(now);
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_WORK_WEEK, JSON.stringify(workWeek));
        return;
      }
    } catch (error) {
      console.error('Error recording first login:', error);
    }
  }

  static async isFirstTimeLogin(): Promise<boolean> {
    try {
      const firstLoginDate = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_LOGIN_DATE);
      return !firstLoginDate;
    } catch (error) {
      return false;
    }
  }

  static async getCurrentWorkWeek(): Promise<WorkWeekInfo | null> {
    try {
      const workWeekJson = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_WORK_WEEK);
      return workWeekJson ? JSON.parse(workWeekJson) : null;
    } catch (error) {
      console.error('Error getting current work week:', error);
      return null;
    }
  }

  private static calculateCurrentWorkWeek(date: Date): WorkWeekInfo {
    // Week starts Sunday (0) and ends Friday (5 at 18:00)
    const currentDay = date.getDay(); // 0 = Sunday
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - currentDay);
    sunday.setHours(0, 0, 0, 0);

    const friday = new Date(sunday);
    friday.setDate(sunday.getDate() + 5);
    friday.setHours(18, 0, 0, 0);

    const workDays: WorkDay[] = [];
    for (let i = 0; i < 6; i++) {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      workDays.push({
        date: day.toISOString().split('T')[0],
        dayName: this.getDayName(day),
        isToday: day.toDateString() === date.toDateString(),
        isCompleted: false
      });
    }

    return {
      weekStartDate: sunday.toISOString().split('T')[0],
      weekEndDate: friday.toISOString().split('T')[0],
      workDays,
      isActive: date < friday,
      weekNumber: this.getWeekNumber(sunday)
    };
  }

  private static getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
  }

  static async generateWeekSummaryReport(): Promise<WeekSummaryReport | null> {
    try {
      const workWeek = await this.getCurrentWorkWeek();
      if (!workWeek) return null;
      const dailyReports = await this.getDailyReportsForWeek(workWeek.weekStartDate);
      const profile = await this.getUserProfile();
      if (!profile) return null;
      const totalHours = dailyReports.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
      const totalSales = dailyReports.reduce((sum, r) => sum + (r.dailyAmount || 0), 0);
      const totalBooks = dailyReports.reduce((sum, r) => sum + (r.booksSold || 0), 0);
      return {
        studentName: profile.fullName,
        weekInfo: workWeek,
        dailyReports,
        summary: {
          totalHours,
          totalSales,
          totalBooks,
          daysWorked: dailyReports.length,
          averageHoursPerDay: dailyReports.length > 0 ? totalHours / dailyReports.length : 0
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating week summary:', error);
      return null;
    }
  }

  // -----------------------
  // Utility Functions
  // -----------------------
  static getWeekStartDate(date: Date): Date {
    const day = date.getDay(); // 0 = Sunday
    const diff = date.getDate() - day;
    const weekStart = new Date(date);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  static getWeekEndDate(weekStart: Date): Date {
    const weekEnd = new Date(weekStart);
    // Sunday start -> Friday is +5 days; set to 18:00 as requested
    weekEnd.setDate(weekEnd.getDate() + 5);
    weekEnd.setHours(18, 0, 0, 0);
    return weekEnd;
  }

  static isWeekLocked(weekStart: Date): boolean {
    const now = new Date();
    const weekEnd = this.getWeekEndDate(weekStart);
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

      const json = JSON.stringify(exportData, null, 2);
      console.log('[DataService] exportAllData length', json.length);
      return json;
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
      // Emit multiple events to ensure all components update
      this.emit('dataCleared');
      this.emit('reportsUpdated');
      this.emit('profileUpdated');
      this.emit('settingsUpdated');
    } catch (error) {
      console.error('Error clearing data:', error);
      throw new Error('Failed to clear data');
    }
  }

  static async importData(jsonData: string): Promise<void> {
    await this.initialize();
    try {
      const data = JSON.parse(jsonData);
      if (!data.version || !data.userProfile) throw new Error('Invalid data format');

      if (data.userProfile) await this.saveUserProfile(data.userProfile);

      if (data.dailyReports && Array.isArray(data.dailyReports)) {
        await AsyncStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(data.dailyReports));
      }

      if (data.weeklyReports && Array.isArray(data.weeklyReports)) {
        await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_REPORTS, JSON.stringify(data.weeklyReports));
      }

      if (data.monthlyReports && Array.isArray(data.monthlyReports)) {
        await AsyncStorage.setItem(STORAGE_KEYS.MONTHLY_REPORTS, JSON.stringify(data.monthlyReports));
      }

      if (data.settings) {
        await this.updateSettings(data.settings);
      }

      // After import, rebuild weekly reports from daily to ensure consistency
      try {
        await this.rebuildWeeklyReportsFromDaily();
      } catch (e) {
        console.warn('rebuildWeeklyReportsFromDaily failed after import:', e);
      }

      await this.updateLastSync();
      // Emit multiple events to ensure all components update
      this.emit('reportsUpdated');
      this.emit('profileUpdated');
      this.emit('settingsUpdated');
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
      const today = new Date();
      for (let i = 1; i <= 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dayOfWeek = checkDate.getDay();
        // include Sunday (0) through Friday (5)
        if (dayOfWeek >= 0 && dayOfWeek <= 5) {
          const dateString = this.getDateString(checkDate);
          if (!reportDates.has(dateString)) missingDates.push(dateString);
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
      const weeksCount = last4Weeks.length || 1;
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
