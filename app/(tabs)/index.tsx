import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  DeviceEventEmitter,
  EmitterSubscription,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  FileText,
  Book,
  DollarSign,
  Clock,
  CircleAlert as AlertCircle,
  ChartBar as BarChart3,
  Settings,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { DataService } from '@/services/DataService';
import { LanguageService } from '@/services/LanguageService';
import { WeeklyReport, DailyReport, UserProfile, WeekSummaryReport } from '@/types/Report';
import { useTheme } from '../providers/ThemeProvider';
import WeekSummaryModal from '@/components/WeekSummaryModal';
import { useFocusEffect } from '@react-navigation/native';

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
  const [refreshing, setRefreshing] = useState(false);

  // Week summary modal state
  const [showWeekSummary, setShowWeekSummary] = useState(false);
  const [weekSummaryData, setWeekSummaryData] = useState<WeekSummaryReport | null>(null);

  // small tick to force rerender on language change
  const [langTick, setLangTick] = useState(0);

  // prevent concurrent loads
  const loadingRef = useRef(false);

  // listener refs
  const deviceEventSubRef = useRef<EmitterSubscription | null>(null);
  const dataServiceUnsubRef = useRef<(() => void) | null>(null);
  const weekCheckIntervalRef = useRef<number | null>(null);

  const safeNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const checkAndShowWeekSummary = useCallback(async () => {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      const currentHour = today.getHours();

      // Show summary on Friday after 6 PM or on Saturday
      if ((dayOfWeek === 5 && currentHour >= 18) || dayOfWeek === 6) {
        const summary = await DataService.generateWeekSummaryReport();
        if (summary) {
          setWeekSummaryData(summary);
          setShowWeekSummary(true);
          return;
        }
      }

      setShowWeekSummary(false);
      setWeekSummaryData(null);
    } catch (error) {
      console.error('Error checking week summary:', error);
    }
  }, []);

  const loadDashboardData = useCallback(async (options?: { skipWeekCheck?: boolean }) => {
    // avoid overlapping loads
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!options?.skipWeekCheck) setLoading(true);

    try {
      const profile = await DataService.getUserProfile();
      const todayISO = new Date().toISOString().split('T')[0];
      const todayReportData = await DataService.getDailyReportByDate(todayISO);
      const currentWeek = await DataService.getCurrentWeekReport();
      const weeklyReports = await DataService.getAllWeeklyReports();
      const missing = await DataService.getMissingDatesFromFirstUse();

      setUserProfile(profile ?? null);
      setTodayReport(todayReportData ?? null);
      setCurrentWeekReport(currentWeek ?? null);
      setMissingDates(Array.isArray(missing) ? missing : []);
      setTotalReports(Array.isArray(weeklyReports) ? weeklyReports.length : 0);

      const sales = (Array.isArray(weeklyReports) ? weeklyReports : []).reduce(
        (sum, report) => sum + safeNumber(report.totalAmount),
        0
      );
      const books = (Array.isArray(weeklyReports) ? weeklyReports : []).reduce(
        (sum, report) => sum + safeNumber(report.totalBooksSold),
        0
      );

      setTotalSales(sales);
      setTotalBooks(books);

      // Check week summary (if not explicitly skipped by caller)
      if (!options?.skipWeekCheck) await checkAndShowWeekSummary();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert(LanguageService.t('error') || 'Error', LanguageService.t('networkError') || 'Failed to load data');
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [checkAndShowWeekSummary]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await DataService.initialize();
        await LanguageService.initialize();
        await loadDashboardData();

        // subscribe to language changes so UI updates automatically
        const unsubscribeLang = LanguageService.subscribe(() => {
          // small tick to force re-render where string constants are read
          if (mounted) setLangTick((t) => t + 1);
        });

        // Subscribe to multiple DataService events for comprehensive updates
        const unsubscribeReports = DataService.subscribe('reportsUpdated', () => {
          if (!loadingRef.current && mounted) loadDashboardData({ skipWeekCheck: true });
        });
        
        const unsubscribeProfile = DataService.subscribe('profileUpdated', () => {
          if (!loadingRef.current && mounted) loadDashboardData({ skipWeekCheck: true });
        });
        
        const unsubscribeSettings = DataService.subscribe('settingsUpdated', () => {
          if (!loadingRef.current && mounted) loadDashboardData({ skipWeekCheck: true });
        });

        // DeviceEventEmitter fallback - listen for 'dataUpdated' events
        deviceEventSubRef.current = DeviceEventEmitter.addListener('dataUpdated', () => {
          if (!loadingRef.current) loadDashboardData({ skipWeekCheck: true });
        });

        // periodic week-check (in case app stays open over Friday->Saturday)
        // run every 30 minutes
        weekCheckIntervalRef.current = setInterval(() => {
          checkAndShowWeekSummary();
        }, 30 * 60 * 1000) as unknown as number;

        return () => {
          mounted = false;
          try { unsubscribeLang(); } catch (e) {}
          try { unsubscribeReports(); } catch (e) {}
          try { unsubscribeProfile(); } catch (e) {}
          try { unsubscribeSettings(); } catch (e) {}
          if (deviceEventSubRef.current) {
            deviceEventSubRef.current.remove();
            deviceEventSubRef.current = null;
          }
          if (weekCheckIntervalRef.current) {
            clearInterval(weekCheckIntervalRef.current as unknown as number);
            weekCheckIntervalRef.current = null;
          }
        };
      } catch (e) {
        console.error('init dashboard error', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDashboardData, checkAndShowWeekSummary]);

  // reload when screen comes into focus (works if user navigated away and returned)
  useFocusEffect(
    React.useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  // ---- UI helper ----
  const getCurrentWeekStatus = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const currentHour = today.getHours();

    if (dayOfWeek === 5 && currentHour >= 18) {
      return { status: 'locked', message: LanguageService.t('weekLocked') || 'Week locked' };
    } else if (dayOfWeek === 6) {
      return { status: 'weekend', message: LanguageService.t('weekend') || 'Weekend' };
    } else {
      return { status: 'active', message: LanguageService.t('weekActive') || 'Week active' };
    }
  };

  const weekStatus = getCurrentWeekStatus();

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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
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
              <Text style={[styles.todayAmount, { color: theme.success }]}>TSH {safeNumber(todayReport.dailyAmount).toLocaleString()}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.noReportCard,
                { backgroundColor: theme.card, borderColor: theme.border },
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

          {currentWeekReport ? (
            <View style={[styles.currentWeekCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.currentWeekTitle, { color: theme.text }]}>{LanguageService.t('weeklyReport')}</Text>
              <Text style={[styles.currentWeekInfo, { color: theme.textSecondary }]}>
                {currentWeekReport.dailyReports.length} {LanguageService.t('completed')} {LanguageService.t('of') || ''} 6
              </Text>
              <Text style={[styles.currentWeekAmount, { color: theme.success }]}>TSH {safeNumber(currentWeekReport.totalAmount).toLocaleString()}</Text>
            </View>
          ) : null}
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

      <WeekSummaryModal
        visible={showWeekSummary}
        onClose={() => setShowWeekSummary(false)}
        weekSummary={weekSummaryData}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  welcomeText: { fontSize: 16, marginBottom: 4 },
  titleText: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  subtitleText: { fontSize: 14 },
  section: { margin: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  todayCard: {
    padding: 20, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  todayTitle: { fontSize: 18, fontWeight: '600' },
  completedBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  completedBadgeText: { fontSize: 12, fontWeight: '600' },
  todayHours: { fontSize: 14, marginBottom: 4 },
  todayAmount: { fontSize: 20, fontWeight: 'bold' },
  noReportCard: {
    padding: 32, borderRadius: 12, alignItems: 'center', shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
    borderWidth: 2, borderStyle: 'dashed',
  },
  noReportText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  noReportTextDisabled: { opacity: 0.7 },
  weekStatusCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 12 },
  weekStatusText: { fontSize: 14, fontWeight: '500', marginLeft: 8 },
  currentWeekCard: { padding: 16, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  currentWeekTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  currentWeekInfo: { fontSize: 14, marginBottom: 4 },
  currentWeekAmount: { fontSize: 18, fontWeight: 'bold' },
  missingReportsCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 8, borderWidth: 1 },
  missingReportsText: { flex: 1, marginLeft: 12 },
  missingReportsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  missingReportsSubtitle: { fontSize: 14 },
  fillMissingButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  fillMissingButtonText: { fontWeight: '600', color: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  statCard: { padding: 16, borderRadius: 12, margin: 6, flex: 0.48, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  statHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statTitle: { fontSize: 14, fontWeight: '500', marginLeft: 8 },
  statValue: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  statSubtitle: { fontSize: 12 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
  quickAction: { padding: 20, borderRadius: 12, margin: 8, flex: 0.46, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  quickActionText: { fontSize: 14, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  loadingOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
});
