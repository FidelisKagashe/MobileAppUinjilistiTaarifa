// app/(tabs)/dashboard.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, FileText, Book, DollarSign, Clock, CircleAlert as AlertCircle, ChartBar as BarChart3, Settings } from 'lucide-react-native';
import { router } from 'expo-router';
import { DataService } from '@/services/DataService';
import { LanguageService } from '@/services/LanguageService';
import { WeeklyReport, DailyReport, UserProfile } from '@/types/Report';
import { useTheme } from '../providers/ThemeProvider';

export default function DashboardScreen() {
  const { theme } = useTheme();

  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [currentWeekReport, setCurrentWeekReport] = useState<WeeklyReport | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [missingDates, setMissingDates] = useState<string[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalBooks, setTotalBooks] = useState(0);
  const [loading, setLoading] = useState(true);

  // small tick to force rerender on language change
  const [langTick, setLangTick] = useState(0);

  useEffect(() => {
    (async () => {
      await DataService.initialize();
      await LanguageService.initialize();
      await loadDashboardData();

      // subscribe to language changes so UI updates automatically
      const unsubscribe = LanguageService.subscribe(() => setLangTick((t) => t + 1));
      return unsubscribe;
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async () => {
    try {
      const profile = await DataService.getUserProfile();
      const today = new Date().toISOString().split('T')[0];
      const todayReportData = await DataService.getDailyReportByDate(today);
      const currentWeek = await DataService.getCurrentWeekReport();
      const weeklyReports = await DataService.getAllWeeklyReports();
      const missing = await DataService.getMissingDatesFromFirstUse();

      setUserProfile(profile);
      setTodayReport(todayReportData);
      setCurrentWeekReport(currentWeek);
      setMissingDates(missing);
      setTotalReports(weeklyReports.length);

      const sales = weeklyReports.reduce((sum, report) => sum + (report.totalAmount || 0), 0);
      const books = weeklyReports.reduce((sum, report) => sum + (report.totalBooksSold || 0), 0);

      setTotalSales(sales);
      setTotalBooks(books);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert(LanguageService.t('error'), LanguageService.t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color, backgroundColor: theme.card }]}>
      <View style={styles.statHeader}>
        <Icon size={24} color={color} />
        <Text style={[styles.statTitle, { color: theme.textSecondary }]}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      {subtitle && <Text style={[styles.statSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
    </View>
  );

  const QuickAction = ({ title, icon: Icon, onPress, color }: any) => (
    <TouchableOpacity style={[styles.quickAction, { backgroundColor: theme.card }]} onPress={onPress}>
      <Icon size={32} color={color} />
      <Text style={[styles.quickActionText, { color: theme.text }]}>{title}</Text>
    </TouchableOpacity>
  );

  const getCurrentWeekStatus = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const currentHour = today.getHours();

    if (dayOfWeek === 5 && currentHour >= 18) {
      return { status: 'locked', message: LanguageService.t('weekLocked') };
    } else if (dayOfWeek === 6) {
      return { status: 'weekend', message: LanguageService.t('weekend') };
    } else {
      return { status: 'active', message: LanguageService.t('weekActive') };
    }
  };

  const weekStatus = getCurrentWeekStatus();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <Text style={[styles.welcomeText, { color: theme.surface }]}>{LanguageService.t('welcome')}</Text>
          <Text style={[styles.titleText, { color: theme.surface }]}>{userProfile?.fullName || 'DODOMA CTF 2025'}</Text>
          <Text style={[styles.subtitleText, { color: theme.surface + 'cc' }]}>{LanguageService.t('dashboard')}</Text>
        </View>

        {/* Today's Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{LanguageService.t('todayStatus')}</Text>
          {todayReport ? (
            <View style={[styles.todayCard, { backgroundColor: theme.card }]}>
              <View style={styles.todayHeader}>
                <Text style={[styles.todayTitle, { color: theme.text }]}>
                  {LanguageService.getDayName(new Date())} - {LanguageService.t('todayStatus')}
                </Text>
                <View style={[styles.completedBadge, { backgroundColor: theme.success }]}>
                  <Text style={[styles.completedBadgeText, { color: theme.surface }]}>{LanguageService.t('completed')}</Text>
                </View>
              </View>
              <Text style={[styles.todayHours, { color: theme.textSecondary }]}>{todayReport.hoursWorked} {LanguageService.t('hoursWorked')}</Text>
              <Text style={[styles.todayAmount, { color: theme.success }]}>TSH {todayReport.dailyAmount.toLocaleString()}</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={[
                styles.noReportCard,
                { backgroundColor: theme.card, borderColor: theme.border }
              ]}
              onPress={() => router.push('/new-report')}
              disabled={weekStatus.status === 'locked'}
            >
              <Plus size={32} color={weekStatus.status === 'locked' ? theme.textSecondary : theme.primary} />
              <Text style={[
                styles.noReportText,
                weekStatus.status === 'locked' && styles.noReportTextDisabled,
                { color: weekStatus.status === 'locked' ? theme.textSecondary : theme.primary }
              ]}>
                {weekStatus.status === 'locked' ? LanguageService.t('weekLocked') : LanguageService.t('startTodayReport')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Week Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{LanguageService.t('weekStatus')}</Text>
          <View style={[
            styles.weekStatusCard,
            { backgroundColor: weekStatus.status === 'locked' ? (theme.error + '10') : (theme.success + '10') }
          ]}>
            <Clock size={20} color={weekStatus.status === 'locked' ? theme.error : theme.success} />
            <Text style={[
              styles.weekStatusText,
              { color: weekStatus.status === 'locked' ? theme.error : theme.success }
            ]}>
              {weekStatus.message}
            </Text>
          </View>

          {currentWeekReport && (
            <View style={[styles.currentWeekCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.currentWeekTitle, { color: theme.text }]}>{LanguageService.t('weeklyReport')} #{currentWeekReport.weekNumber}</Text>
              <Text style={[styles.currentWeekInfo, { color: theme.textSecondary }]}>
                {currentWeekReport.dailyReports.length} {LanguageService.t('completed')} {LanguageService.t('of') || ''} 6
              </Text>
              <Text style={[styles.currentWeekAmount, { color: theme.success }]}>
                TSH {currentWeekReport.totalAmount.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Missing Reports Alert */}
        {missingDates.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.missingReportsCard, { backgroundColor: theme.warning + '10', borderColor: theme.warning }]}>
              <AlertCircle size={20} color={theme.warning} />
              <View style={styles.missingReportsText}>
                <Text style={[styles.missingReportsTitle, { color: theme.warning }]}>{LanguageService.t('missingReports')}: {missingDates.length}</Text>
                <Text style={[styles.missingReportsSubtitle, { color: theme.warning }]}>{LanguageService.t('fillMissing')}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.fillMissingButton, { backgroundColor: theme.warning }]}
                onPress={() => router.push('/new-report')}
              >
                <Text style={styles.fillMissingButtonText}>{LanguageService.t('fillMissing')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Statistics Overview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{LanguageService.t('analyticsBoard')}</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title={LanguageService.t('reportHistory')}
              value={totalReports}
              subtitle={LanguageService.t('weeklyReport')}
              icon={FileText}
              color={theme.primary}
            />
            <StatCard
              title={LanguageService.t('totalSales')}
              value={`TSH ${totalSales.toLocaleString()}`}
              subtitle={LanguageService.t('allTimeSales')}
              icon={DollarSign}
              color={theme.success}
            />
            <StatCard
              title={LanguageService.t('booksSold')}
              value={totalBooks}
              subtitle={LanguageService.t('booksDistributed')}
              icon={Book}
              color={theme.error}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{LanguageService.t('quickActions')}</Text>
          <View style={styles.quickActionsGrid}>
            <QuickAction
              title={LanguageService.t('newReport')}
              icon={Plus}
              color={theme.primary}
              onPress={() => router.push('/new-report')}
            />
            <QuickAction
              title={LanguageService.t('reports')}
              icon={FileText}
              color={theme.success}
              onPress={() => router.push('/reports')}
            />
            <QuickAction
              title={LanguageService.t('analytics')}
              icon={BarChart3}
              color={theme.error}
              onPress={() => router.push('/analytics')}
            />
            <QuickAction
              title={LanguageService.t('settings')}
              icon={Settings}
              color={theme.warning}
              onPress={() => router.push('/settings')}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor is set dynamically from theme
  },
  header: {
    padding: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  welcomeText: {
    fontSize: 16,
    marginBottom: 4,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 14,
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  todayCard: {
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  completedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  todayHours: {
    fontSize: 14,
    marginBottom: 4,
  },
  todayAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  noReportCard: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  noReportText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  noReportTextDisabled: {
    opacity: 0.7,
  },
  weekStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  weekStatusText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  currentWeekCard: {
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  currentWeekTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  currentWeekInfo: {
    fontSize: 14,
    marginBottom: 4,
  },
  currentWeekAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  missingReportsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  missingReportsText: {
    flex: 1,
    marginLeft: 12,
  },
  missingReportsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  missingReportsSubtitle: {
    fontSize: 14,
  },
  fillMissingButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fillMissingButtonText: {
    fontWeight: '600',
    color: '#fff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    padding: 16,
    borderRadius: 12,
    margin: 6,
    flex: 0.48,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  quickAction: {
    padding: 20,
    borderRadius: 12,
    margin: 8,
    flex: 0.46,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});
