import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyReport, WeeklyReport, MonthlyReport, UserProfile, AppSettings } from '@/types/Report';

const STORAGE_KEYS = {
  DAILY_REPORTS: '@dodoma_ctf_daily_reports',
  WEEKLY_REPORTS: '@dodoma_ctf_weekly_reports',
  MONTHLY_REPORTS: '@dodoma_ctf_monthly_reports',
  USER_PROFILE: '@dodoma_ctf_user_profile',
  SETTINGS: '@dodoma_ctf_settings',
  PASSWORD: '@dodoma_ctf_password',
  WEEK_COUNTER: '@dodoma_ctf_week_counter',
};

export class DataService {
  // User Profile Management
  static async saveUserProfile(profile: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch (error) {
      throw new Error('Failed to save user profile');
    }
  }

  static async getUserProfile(): Promise<UserProfile | null> {
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

  // Daily Report Management
  static async saveDailyReport(report: DailyReport): Promise<void> {
    try {
      const existingReports = await this.getAllDailyReports();
      const updatedReports = [...existingReports.filter(r => r.id !== report.id), report];
      await AsyncStorage.setItem(STORAGE_KEYS.DAILY_REPORTS, JSON.stringify(updatedReports));
      
      // Auto-generate weekly report
      await this.generateWeeklyReport(report.date);
    } catch (error) {
      throw new Error('Failed to save daily report');
    }
  }

  static async getAllDailyReports(): Promise<DailyReport[]> {
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
      weekEnd.setDate(weekEnd.getDate() + 4); // Sunday to Friday (5 days)

      return reports.filter(report => {
        const reportDate = new Date(report.date);
        return reportDate >= weekStart && reportDate <= weekEnd;
      });
    } catch (error) {
      console.error('Error loading weekly daily reports:', error);
      return [];
    }
  }

  // Weekly Report Management
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

      const weekNumber = await this.getNextWeekNumber();
      const isCurrentWeekLocked = this.isWeekLocked(weekStart);

      const weeklyReport: WeeklyReport = {
        id: `week_${weekStart.toISOString().split('T')[0]}`,
        weekNumber,
        weekStartDate: weekStart.toISOString().split('T')[0],
        weekEndDate: weekEnd.toISOString().split('T')[0],
        studentName: profile.fullName,
        phoneNumber: profile.phoneNumber,
        totalHours: dailyReports.reduce((sum, r) => sum + r.hoursWorked, 0),
        totalBooksSold: dailyReports.reduce((sum, r) => sum + r.booksSold, 0),
        totalAmount: dailyReports.reduce((sum, r) => sum + r.dailyAmount, 0),
        totalFreeLiterature: dailyReports.reduce((sum, r) => sum + r.freeLiterature, 0),
        totalVopActivities: dailyReports.reduce((sum, r) => sum + r.vopActivities, 0),
        totalChurchAttendees: dailyReports.reduce((sum, r) => sum + r.churchAttendees, 0),
        totalBackSlidesVisited: dailyReports.reduce((sum, r) => sum + r.backSlidesVisited, 0),
        totalPrayersOffered: dailyReports.reduce((sum, r) => sum + r.prayersOffered, 0),
        totalBibleStudies: dailyReports.reduce((sum, r) => sum + r.bibleStudies, 0),
        totalBaptismCandidates: dailyReports.reduce((sum, r) => sum + r.baptismCandidates, 0),
        totalBaptismsPerformed: dailyReports.reduce((sum, r) => sum + r.baptismsPerformed, 0),
        totalPeopleVisited: dailyReports.reduce((sum, r) => sum + r.peopleVisited, 0),
        dailyReports,
        isLocked: isCurrentWeekLocked,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.saveWeeklyReport(weeklyReport);
      return weeklyReport;
    } catch (error) {
      throw new Error('Failed to generate weekly report');
    }
  }

  static async saveWeeklyReport(report: WeeklyReport): Promise<void> {
    try {
      const existingReports = await this.getAllWeeklyReports();
      const updatedReports = [...existingReports.filter(r => r.id !== report.id), report];
      await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_REPORTS, JSON.stringify(updatedReports));
    } catch (error) {
      throw new Error('Failed to save weekly report');
    }
  }

  static async getAllWeeklyReports(): Promise<WeeklyReport[]> {
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

  // Monthly Report Management
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
        totalHours: monthlyWeeklyReports.reduce((sum, r) => sum + r.totalHours, 0),
        totalAmount: monthlyWeeklyReports.reduce((sum, r) => sum + r.totalAmount, 0),
        totalBooks: monthlyWeeklyReports.reduce((sum, r) => sum + r.totalBooksSold, 0),
        totalMinistryActivities: monthlyWeeklyReports.reduce((sum, r) => 
          sum + r.totalBibleStudies + r.totalPrayersOffered + r.totalBaptismsPerformed, 0),
        createdAt: new Date().toISOString(),
      };

      await this.saveMonthlyReport(monthlyReport);
      return monthlyReport;
    } catch (error) {
      throw new Error('Failed to generate monthly report');
    }
  }

  static async saveMonthlyReport(report: MonthlyReport): Promise<void> {
    try {
      const existingReports = await this.getAllMonthlyReports();
      const updatedReports = [...existingReports.filter(r => r.id !== report.id), report];
      await AsyncStorage.setItem(STORAGE_KEYS.MONTHLY_REPORTS, JSON.stringify(updatedReports));
    } catch (error) {
      throw new Error('Failed to save monthly report');
    }
  }

  static async getAllMonthlyReports(): Promise<MonthlyReport[]> {
    try {
      const reportsJson = await AsyncStorage.getItem(STORAGE_KEYS.MONTHLY_REPORTS);
      return reportsJson ? JSON.parse(reportsJson) : [];
    } catch (error) {
      console.error('Error loading monthly reports:', error);
      return [];
    }
  }

  // Authentication
  static async setPassword(password: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PASSWORD, password);
    } catch (error) {
      throw new Error('Failed to set password');
    }
  }

  static async verifyPassword(password: string): Promise<boolean> {
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

  // Settings Management
  static async getSettings(): Promise<AppSettings> {
    try {
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return settingsJson ? JSON.parse(settingsJson) : {
        biometricEnabled: false,
        autoLockWeeks: true,
        reminderNotifications: false,
        lastBackup: null,
        authMethod: 'password',
      };
    } catch (error) {
      console.error('Error loading settings:', error);
      return {
        biometricEnabled: false,
        autoLockWeeks: true,
        reminderNotifications: false,
        lastBackup: null,
        authMethod: 'password',
      };
    }
  }

  static async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
    } catch (error) {
      throw new Error('Failed to update settings');
    }
  }

  // Utility Functions
  static getWeekStartDate(date: Date): Date {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = date.getDate() - day; // Get Sunday of current week
    const weekStart = new Date(date);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  static getWeekEndDate(weekStart: Date): Date {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 4); // Friday
    weekEnd.setHours(18, 0, 0, 0); // 6:00 PM
    return weekEnd;
  }

  static isWeekLocked(weekStart: Date): boolean {
    const now = new Date();
    const weekEnd = this.getWeekEndDate(weekStart);
    return now > weekEnd;
  }

  static async getNextWeekNumber(): Promise<number> {
    try {
      const counterStr = await AsyncStorage.getItem(STORAGE_KEYS.WEEK_COUNTER);
      const counter = counterStr ? parseInt(counterStr) : 0;
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
    const days = ['Jumapili', 'Jumatatu', 'Jumanne', 'Jumatano', 'Alhamisi', 'Ijumaa', 'Jumamosi'];
    return days[date.getDay()];
  }

  static getMonthName(month: number): string {
    const months = [
      'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni',
      'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'
    ];
    return months[month - 1];
  }

  // Data Management
  static async exportAllData(): Promise<string> {
    try {
      const dailyReports = await this.getAllDailyReports();
      const weeklyReports = await this.getAllWeeklyReports();
      const monthlyReports = await this.getAllMonthlyReports();
      const userProfile = await this.getUserProfile();
      const settings = await this.getSettings();
      
      const exportData = {
        userProfile,
        dailyReports,
        weeklyReports,
        monthlyReports,
        settings,
        exportDate: new Date().toISOString(),
        version: '2.0.0',
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      throw new Error('Failed to export data');
    }
  }

  static async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.DAILY_REPORTS,
        STORAGE_KEYS.WEEKLY_REPORTS,
        STORAGE_KEYS.MONTHLY_REPORTS,
        STORAGE_KEYS.WEEK_COUNTER,
      ]);
    } catch (error) {
      throw new Error('Failed to clear data');
    }
  }

  // Get missing dates for backfill
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
        
        // Only check weekdays (Monday to Friday)
        const dayOfWeek = checkDate.getDay();
        if (dayOfWeek >= 0 && dayOfWeek <= 5) { // Sunday to Friday
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

  // Analytics Helper Methods
  static async getWeeklyPerformance(): Promise<any> {
    try {
      const weeklyReports = await this.getAllWeeklyReports();
      const last4Weeks = weeklyReports.slice(-4);
      
      return {
        averageHours: last4Weeks.reduce((sum, r) => sum + r.totalHours, 0) / last4Weeks.length,
        averageSales: last4Weeks.reduce((sum, r) => sum + r.totalAmount, 0) / last4Weeks.length,
        totalBaptisms: weeklyReports.reduce((sum, r) => sum + r.totalBaptismsPerformed, 0),
        totalBibleStudies: weeklyReports.reduce((sum, r) => sum + r.totalBibleStudies, 0),
      };
    } catch (error) {
      console.error('Error calculating performance:', error);
      return null;
    }
  }
}