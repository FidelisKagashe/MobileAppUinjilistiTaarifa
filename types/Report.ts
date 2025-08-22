// types/Report.ts

export type AuthMethod = 'password' | 'biometric' | 'pattern' | 'pin';

export interface BookSale {
  id: string;
  title: string;
  price: number;
  quantity: number;
}

export interface DailyReport {
  id: string;
  date: string; // YYYY-MM-DD format
  studentName: string;
  phoneNumber: string;
  hoursWorked: number;
  booksSold: number;
  dailyAmount: number;
  freeLiterature: number;
  vopActivities: number;
  churchAttendees: number;
  backSlidesVisited: number;
  prayersOffered: number;
  bibleStudies: number;
  baptismCandidates: number;
  baptismsPerformed: number;
  peopleVisited: number;
  bookSales: BookSale[];
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReport {
  id: string;
  weekNumber: number;
  weekStartDate: string; // Sunday date
  weekEndDate: string; // Friday date
  studentName: string;
  phoneNumber: string;
  totalHours: number;
  totalBooksSold: number;
  totalAmount: number;
  totalFreeLiterature: number;
  totalVopActivities: number;
  totalChurchAttendees: number;
  totalBackSlidesVisited: number;
  totalPrayersOffered: number;
  totalBibleStudies: number;
  totalBaptismCandidates: number;
  totalBaptismsPerformed: number;
  totalPeopleVisited: number;
  dailyReports: DailyReport[];
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyReport {
  id: string;
  month: number;
  year: number;
  studentName: string;
  phoneNumber: string;
  weeklyReports: WeeklyReport[];
  totalHours: number;
  totalAmount: number;
  totalBooks: number;
  totalMinistryActivities: number;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * AppSettings
 * - authMethod is the canonical stored method ('password' by default).
 * - primaryAuthMethod and authMethodSelection are optional helper fields used
 *   by some components (made optional to avoid TS errors). Prefer reading/writing
 *   settings via DataService.getSettings()/updateSettings().
 */
export interface AppSettings {
  biometricEnabled: boolean;
  autoLockWeeks: boolean;
  reminderNotifications: boolean;
  lastBackup: string | null;

  // canonical auth method stored for the app
  authMethod: AuthMethod;

  // optional legacy/helper fields (some components referenced these names)
  primaryAuthMethod?: AuthMethod;
  authMethodSelection?: AuthMethod;

  theme: 'light' | 'dark';
  language: 'sw' | 'en';
  firstUseDate: string | null;
}

export interface WorkDay {
  date: string;
  dayName: string;
  isToday: boolean;
  isCompleted: boolean;
}

export interface WorkWeekInfo {
  weekStartDate: string;
  weekEndDate: string;
  workDays: WorkDay[];
  isActive: boolean;
  weekNumber: number;
}

export interface WeekSummaryReport {
  studentName: string;
  weekInfo: WorkWeekInfo;
  dailyReports: DailyReport[];
  summary: {
    totalHours: number;
    totalSales: number;
    totalBooks: number;
    daysWorked: number;
    averageHoursPerDay: number;
  };
  generatedAt: string;
}
