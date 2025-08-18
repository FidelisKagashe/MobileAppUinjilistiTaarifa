import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Translations {
  // Navigation
  dashboard: string;
  newReport: string;
  reports: string;
  analytics: string;
  settings: string;
  
  // Common
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  loading: string;
  error: string;
  success: string;
  yes: string;
  no: string;
  ok: string;
  close: string;
  
  // Dashboard
  welcome: string;
  todayStatus: string;
  weekStatus: string;
  startTodayReport: string;
  weekLocked: string;
  noReportToday: string;
  completed: string;
  weekActive: string;
  weekend: string;
  missingReports: string;
  fillMissing: string;
  quickActions: string;
  
  // Reports
  dailyReport: string;
  weeklyReport: string;
  monthlyReport: string;
  hoursWorked: string;
  booksSold: string;
  totalSales: string;
  generateMonthlyReport: string;
  reportHistory: string;
  viewDetails: string;
  generatePDF: string;
  
  // New Report
  selectDay: string;
  workHours: string;
  bookSales: string;
  addBook: string;
  bookTitle: string;
  price: string;
  quantity: string;
  total: string;
  literatureDistribution: string;
  freeLiterature: string;
  vopActivities: string;
  ministryActivities: string;
  churchAttendees: string;
  backSlidesVisited: string;
  prayersOffered: string;
  bibleStudies: string;
  baptismCandidates: string;
  baptismsPerformed: string;
  peopleVisited: string;
  saveReport: string;
  updateReport: string;
  
  // Analytics
  analyticsBoard: string;
  performanceInsights: string;
  keyMetrics: string;
  salesTrend: string;
  hoursChart: string;
  ministryDistribution: string;
  weeklyAverage: string;
  allTimeSales: string;
  totalHours: string;
  booksDistributed: string;
  noAnalytics: string;
  submitFirstReport: string;
  
  // Settings
  userProfile: string;
  fullName: string;
  phoneNumber: string;
  appearanceLanguage: string;
  security: string;
  fingerprintAuth: string;
  changePassword: string;
  dataManagement: string;
  exportData: string;
  importData: string;
  clearAllData: string;
  appInfo: string;
  about: string;
  help: string;
  logout: string;
  theme: string;
  language: string;
  lightMode: string;
  darkMode: string;
  english: string;
  swahili: string;
  
  // Days
  sunday: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  
  // Months
  january: string;
  february: string;
  march: string;
  april: string;
  may: string;
  june: string;
  july: string;
  august: string;
  september: string;
  october: string;
  november: string;
  december: string;
  
  // Messages
  reportSaved: string;
  reportUpdated: string;
  profileUpdated: string;
  settingsUpdated: string;
  dataExported: string;
  dataCleared: string;
  passwordChanged: string;
  loginSuccess: string;
  loginFailed: string;
  validationError: string;
  networkError: string;
  
  // Validation
  fieldRequired: string;
  invalidPhone: string;
  passwordTooShort: string;
  passwordMismatch: string;
  invalidNumber: string;
  of: string; 
}

export const swahiliTranslations: Translations = {
  // Navigation
  dashboard: 'Nyumbani',
  newReport: 'Taarifa Mpya',
  reports: 'Taarifa',
  analytics: 'Takwimu',
  settings: 'Mipangilio',
  
  // Common
  save: 'Hifadhi',
  cancel: 'Ghairi',
  delete: 'Futa',
  edit: 'Badilisha',
  loading: 'Inapakia...',
  error: 'Hitilafu',
  success: 'Imekamilika',
  yes: 'Ndio',
  no: 'Hapana',
  ok: 'Sawa',
  close: 'Funga',
  
  // Dashboard
  welcome: 'Karibu Tena',
  todayStatus: 'Hali ya Leo',
  weekStatus: 'Hali ya Wiki Hii',
  startTodayReport: 'Anza Taarifa ya Leo',
  weekLocked: 'Wiki Imefungwa',
  noReportToday: 'Hakuna taarifa ya leo',
  completed: 'Imekamilika',
  weekActive: 'Wiki inaendelea',
  weekend: 'Jumamosi - Hakuna kazi',
  missingReports: 'Taarifa hazijajazwa',
  fillMissing: 'Jaza',
  quickActions: 'Vitendo vya Haraka',
  
  // Reports
  dailyReport: 'Taarifa ya Kila Siku',
  weeklyReport: 'Taarifa ya Wiki',
  monthlyReport: 'Taarifa ya Mwezi',
  hoursWorked: 'Masaa ya Kazi',
  booksSold: 'Vitabu Vilivyouzwa',
  totalSales: 'Jumla ya Mauzo',
  generateMonthlyReport: 'Tengeneza Taarifa ya Mwezi',
  reportHistory: 'Historia ya Taarifa',
  viewDetails: 'Ona Maelezo',
  generatePDF: 'Tengeneza PDF',
  
  // New Report
  selectDay: 'Chagua Siku',
  workHours: 'Masaa ya Kazi',
  bookSales: 'Uuzaji wa Vitabu',
  addBook: 'Ongeza Kitabu',
  bookTitle: 'Jina la Kitabu',
  price: 'Bei (TSH)',
  quantity: 'Idadi',
  total: 'Jumla',
  literatureDistribution: 'Usambazaji wa Vitabu',
  freeLiterature: 'Vitabu vya Bure',
  vopActivities: 'Shughuli za VOP',
  ministryActivities: 'Shughuli za Uongozaji',
  churchAttendees: 'Waliofika Kanisani',
  backSlidesVisited: 'Waliorudi Nyuma Waliotembelewa',
  prayersOffered: 'Maombi Yaliyotolewa',
  bibleStudies: 'Masomo ya Biblia',
  baptismCandidates: 'Waliojitoa kwa Ubatizo',
  baptismsPerformed: 'Batizo Zilizofanyika',
  peopleVisited: 'Watu Waliotembelewa',
  saveReport: 'Hifadhi Taarifa',
  updateReport: 'Sasisha Taarifa',
  
  // Analytics
  analyticsBoard: 'Bodi ya Takwimu',
  performanceInsights: 'Maarifa ya Utendaji',
  keyMetrics: 'Viashiria Muhimu',
  salesTrend: 'Mwelekeo wa Mauzo',
  hoursChart: 'Chati ya Masaa',
  ministryDistribution: 'Mgawanyo wa Uongozaji',
  weeklyAverage: 'Wastani wa Wiki',
  allTimeSales: 'Mauzo ya Wakati Wote',
  totalHours: 'Jumla ya Masaa',
  booksDistributed: 'Vitabu Vilivyosambazwa',
  noAnalytics: 'Hakuna Takwimu',
  submitFirstReport: 'Wasilisha taarifa ya kwanza',
  
  // Settings
  userProfile: 'Wasifu wa Mtumiaji',
  fullName: 'Jina Kamili',
  phoneNumber: 'Namba ya Simu',
  appearanceLanguage: 'Muonekano na Lugha',
  security: 'Usalama',
  fingerprintAuth: 'Uthibitishaji wa Fingerprint',
  changePassword: 'Badilisha Password',
  dataManagement: 'Usimamizi wa Taarifa',
  exportData: 'Hamisha Taarifa',
  importData: 'Ingiza Taarifa',
  clearAllData: 'Futa Taarifa Zote',
  appInfo: 'Taarifa za Programu',
  about: 'Kuhusu',
  help: 'Msaada',
  logout: 'Toka',
  theme: 'Mandhari',
  language: 'Lugha',
  lightMode: 'Mandhari ya Mchana',
  darkMode: 'Mandhari ya Usiku',
  english: 'Kiingereza',
  swahili: 'Kiswahili',
  
  // Days
  sunday: 'Jumapili',
  monday: 'Jumatatu',
  tuesday: 'Jumanne',
  wednesday: 'Jumatano',
  thursday: 'Alhamisi',
  friday: 'Ijumaa',
  saturday: 'Jumamosi',
  
  // Months
  january: 'Januari',
  february: 'Februari',
  march: 'Machi',
  april: 'Aprili',
  may: 'Mei',
  june: 'Juni',
  july: 'Julai',
  august: 'Agosti',
  september: 'Septemba',
  october: 'Oktoba',
  november: 'Novemba',
  december: 'Desemba',
  
  // Messages
  reportSaved: 'Taarifa imehifadhiwa kikamilifu!',
  reportUpdated: 'Taarifa imesasishwa kikamilifu!',
  profileUpdated: 'Wasifu umesasishwa kikamilifu!',
  settingsUpdated: 'Mipangilio imesasishwa!',
  dataExported: 'Taarifa zimehamishwa kikamilifu!',
  dataCleared: 'Taarifa zote zimefutwa!',
  passwordChanged: 'Password imebadilishwa!',
  loginSuccess: 'Umeingia kikamilifu!',
  loginFailed: 'Imeshindwa kuingia',
  validationError: 'Tafadhali sahihisha taarifa',
  networkError: 'Tatizo la mtandao',
  
  // Validation
  fieldRequired: 'Sehemu hii inahitajika',
  invalidPhone: 'Namba ya simu si sahihi',
  passwordTooShort: 'Password ni fupi sana',
  passwordMismatch: 'Password hazifanani',
  invalidNumber: 'Namba si sahihi',
  of: 'ya',
};

export const englishTranslations: Translations = {
  // Navigation
  dashboard: 'Dashboard',
  newReport: 'New Report',
  reports: 'Reports',
  analytics: 'Analytics',
  settings: 'Settings',
  
  // Common
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  edit: 'Edit',
  loading: 'Loading...',
  error: 'Error',
  success: 'Success',
  yes: 'Yes',
  no: 'No',
  ok: 'OK',
  close: 'Close',
  
  // Dashboard
  welcome: 'Welcome Back',
  todayStatus: 'Today\'s Status',
  weekStatus: 'This Week\'s Status',
  startTodayReport: 'Start Today\'s Report',
  weekLocked: 'Week Locked',
  noReportToday: 'No report for today',
  completed: 'Completed',
  weekActive: 'Week in progress',
  weekend: 'Saturday - No work',
  missingReports: 'Missing reports',
  fillMissing: 'Fill',
  quickActions: 'Quick Actions',
  
  // Reports
  dailyReport: 'Daily Report',
  weeklyReport: 'Weekly Report',
  monthlyReport: 'Monthly Report',
  hoursWorked: 'Hours Worked',
  booksSold: 'Books Sold',
  totalSales: 'Total Sales',
  generateMonthlyReport: 'Generate Monthly Report',
  reportHistory: 'Report History',
  viewDetails: 'View Details',
  generatePDF: 'Generate PDF',
  
  // New Report
  selectDay: 'Select Day',
  workHours: 'Work Hours',
  bookSales: 'Book Sales',
  addBook: 'Add Book',
  bookTitle: 'Book Title',
  price: 'Price (TSH)',
  quantity: 'Quantity',
  total: 'Total',
  literatureDistribution: 'Literature Distribution',
  freeLiterature: 'Free Literature',
  vopActivities: 'VOP Activities',
  ministryActivities: 'Ministry Activities',
  churchAttendees: 'Church Attendees',
  backSlidesVisited: 'Backsliders Visited',
  prayersOffered: 'Prayers Offered',
  bibleStudies: 'Bible Studies',
  baptismCandidates: 'Baptism Candidates',
  baptismsPerformed: 'Baptisms Performed',
  peopleVisited: 'People Visited',
  saveReport: 'Save Report',
  updateReport: 'Update Report',
  
  // Analytics
  analyticsBoard: 'Analytics Dashboard',
  performanceInsights: 'Performance Insights',
  keyMetrics: 'Key Performance Metrics',
  salesTrend: 'Sales Trend',
  hoursChart: 'Hours Chart',
  ministryDistribution: 'Ministry Distribution',
  weeklyAverage: 'Weekly Average',
  allTimeSales: 'All Time Sales',
  totalHours: 'Total Hours',
  booksDistributed: 'Books Distributed',
  noAnalytics: 'No Analytics Available',
  submitFirstReport: 'Submit your first report to see analytics',
  
  // Settings
  userProfile: 'User Profile',
  fullName: 'Full Name',
  phoneNumber: 'Phone Number',
  appearanceLanguage: 'Appearance & Language',
  security: 'Security',
  fingerprintAuth: 'Fingerprint Authentication',
  changePassword: 'Change Password',
  dataManagement: 'Data Management',
  exportData: 'Export Data',
  importData: 'Import Data',
  clearAllData: 'Clear All Data',
  appInfo: 'App Information',
  about: 'About',
  help: 'Help & Support',
  logout: 'Logout',
  theme: 'Theme',
  language: 'Language',
  lightMode: 'Light Mode',
  darkMode: 'Dark Mode',
  english: 'English',
  swahili: 'Swahili',
  
  // Days
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  
  // Months
  january: 'January',
  february: 'February',
  march: 'March',
  april: 'April',
  may: 'May',
  june: 'June',
  july: 'July',
  august: 'August',
  september: 'September',
  october: 'October',
  november: 'November',
  december: 'December',
  
  // Messages
  reportSaved: 'Report saved successfully!',
  reportUpdated: 'Report updated successfully!',
  profileUpdated: 'Profile updated successfully!',
  settingsUpdated: 'Settings updated successfully!',
  dataExported: 'Data exported successfully!',
  dataCleared: 'All data cleared successfully!',
  passwordChanged: 'Password changed successfully!',
  loginSuccess: 'Login successful!',
  loginFailed: 'Login failed',
  validationError: 'Please correct the information',
  networkError: 'Network error',
  
  // Validation
  fieldRequired: 'This field is required',
  invalidPhone: 'Invalid phone number',
  passwordTooShort: 'Password is too short',
  passwordMismatch: 'Passwords do not match',
  invalidNumber: 'Invalid number',
  of: 'of',
};

const LANGUAGE_STORAGE_KEY = '@app_language';

export class LanguageService {
  private static currentLanguage: 'sw' | 'en' = 'sw';
  private static currentTranslations: Translations = swahiliTranslations;

  // Simple subscriber model so React components can re-render when language changes
  private static listeners: Array<() => void> = [];

  /**
   * Initialize language from storage. Call at app startup.
   */
  static async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === 'en' || stored === 'sw') {
        this.currentLanguage = stored;
        this.currentTranslations = stored === 'en' ? englishTranslations : swahiliTranslations;
      } else {
        // ensure translations reflect default language
        this.currentTranslations = this.currentLanguage === 'en' ? englishTranslations : swahiliTranslations;
      }
    } catch (error) {
      console.warn('LanguageService initialization error:', error);
    }
  }

  static getCurrentLanguage(): 'sw' | 'en' {
    return this.currentLanguage;
  }

  static getCurrentTranslations(): Translations {
    return this.currentTranslations;
  }

  /**
   * Set language, persist to storage and DataService, and notify subscribers.
   */
  static async setLanguage(language: 'sw' | 'en'): Promise<void> {
    try {
      if (language !== 'sw' && language !== 'en') throw new Error('Unsupported language');

      this.currentLanguage = language;
      this.currentTranslations = language === 'en' ? englishTranslations : swahiliTranslations;

      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);

      // Also update in DataService for persistence (non-blocking)
      try {
        const { DataService } = await import('./DataService');
        await DataService.updateSettings({ language });
      } catch (e) {
        // do not fail overall if DataService import/update fails
        console.warn('LanguageService: failed to update DataService settings', e);
      }

      // notify listeners
      this.listeners.forEach((cb) => {
        try {
          cb();
        } catch (e) {
          console.warn('LanguageService listener error', e);
        }
      });
    } catch (error) {
      console.error('Error setting language:', error);
      throw error;
    }
  }

  /**
   * Subscribe to language changes. Returns an unsubscribe function.
   */
  static subscribe(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((c) => c !== cb);
    };
  }

  /**
   * Get a single translation by key with a safe fallback.
   */
  static t(key: keyof Translations): string {
    const value = this.currentTranslations[key];
    if (!value) {
      // fallback to english key or the key name itself
      return (englishTranslations as any)[key] || String(key);
    }
    return value;
  }

  /**
   * Returns localized day name (0 = Sunday).
   */
  static getDayName(date: Date, language?: 'sw' | 'en'): string {
    const lang = language || this.currentLanguage;
    const translations = lang === 'en' ? englishTranslations : swahiliTranslations;
    const days = [
      translations.sunday,
      translations.monday,
      translations.tuesday,
      translations.wednesday,
      translations.thursday,
      translations.friday,
      translations.saturday,
    ];
    return days[date.getDay()];
  }

  /**
   * Get localized month name.
   * Accepts either 0-based month (0..11) or 1-based (1..12).
   */
  static getMonthName(month: number, language?: 'sw' | 'en'): string {
    const lang = language || this.currentLanguage;
    const translations = lang === 'en' ? englishTranslations : swahiliTranslations;
    const months = [
      translations.january,
      translations.february,
      translations.march,
      translations.april,
      translations.may,
      translations.june,
      translations.july,
      translations.august,
      translations.september,
      translations.october,
      translations.november,
      translations.december,
    ];

    // allow both 0-based (0..11) and 1-based (1..12)
    let idx = month;
    if (month >= 1 && month <= 12) idx = month - 1;
    if (idx < 0 || idx > 11) return '';
    return months[idx];
  }
}
