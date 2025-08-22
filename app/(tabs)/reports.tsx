// app/(tabs)/reports.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FileText,
  Lock,
  Clock as Unlock,
  Eye,
  FileDown,
  TrendingUp,
} from 'lucide-react-native';
import { DataService } from '@/services/DataService';
import { PDFService } from '@/services/PDFService';
import { LanguageService, Translations } from '@/services/LanguageService';
import { WeeklyReport, MonthlyReport, DailyReport } from '@/types/Report';
import { useTheme } from '../providers/ThemeProvider';

export default function ReportsScreen() {
  const { theme } = useTheme();

  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly' | 'daily'>('weekly');

  // keep a stable reference to avoid setting state after unmount
  const mountedRef = useRef(true);

  // helper t: accepts keyof Translations and fallback
  const t = useCallback((k: keyof Translations, fallback?: string) => LanguageService.t(k) ?? fallback ?? String(k), []);

  useEffect(() => {
    mountedRef.current = true;
    let unsubLang: (() => void) | null = null;
    let unsubReports: (() => void) | null = null;
    let unsubProfile: (() => void) | null = null;
    let unsubSettings: (() => void) | null = null;

    (async () => {
      try {
        await DataService.initialize();
        await LanguageService.initialize();
        await loadReports();
        
        unsubLang = LanguageService.subscribe(() => {
          // small re-render to update translated UI
          // no need for heavy work here
          if (mountedRef.current) {
            setWeeklyReports(prev => [...prev]);
          }
        });
        
        // Subscribe to DataService events for live updates
        unsubReports = DataService.subscribe('reportsUpdated', () => {
          if (mountedRef.current) loadReports();
        });
        
        unsubProfile = DataService.subscribe('profileUpdated', () => {
          if (mountedRef.current) loadReports();
        });
        
        unsubSettings = DataService.subscribe('settingsUpdated', () => {
          if (mountedRef.current) loadReports();
        });
      } catch (err) {
        console.error('init error', err);
        Alert.alert(t('error', 'Error'), t('networkError', 'Failed to load data'));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      if (typeof unsubLang === 'function') unsubLang();
      if (typeof unsubReports === 'function') unsubReports();
      if (typeof unsubProfile === 'function') unsubProfile();
      if (typeof unsubSettings === 'function') unsubSettings();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const [weekly, monthly, daily] = await Promise.all([
        DataService.getAllWeeklyReports(),
        DataService.getAllMonthlyReports(),
        DataService.getAllDailyReports(),
      ]);

      if (!mountedRef.current) return;

      // sort defensively and then set state once
      const w = (weekly || []).slice().sort((a, b) => (b.weekNumber || 0) - (a.weekNumber || 0));
      const m = (monthly || []).slice().sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return (b.month || 0) - (a.month || 0);
      });
      const d = (daily || []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setWeeklyReports(w);
      setMonthlyReports(m);
      setDailyReports(d);
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert(t('error', 'Error'), t('networkError', 'Failed to load reports'));
    }
  }, [t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadReports();
    } catch (err) {
      console.error('refresh error', err);
      Alert.alert(t('error', 'Error'), t('networkError', 'Failed to refresh'));
    } finally {
      setRefreshing(false);
    }
  }, [loadReports, t]);

  const generateWeeklyPDF = useCallback(async (report: WeeklyReport) => {
    setLoading(true);
    try {
      await PDFService.generateWeeklyPDF(report);
      Alert.alert(t('success', 'Done'), t('dataExported', 'PDF generated'));
    } catch (error) {
      console.error('generateWeeklyPDF error', error);
      Alert.alert(t('error', 'Error'), t('networkError', 'Failed to generate PDF'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [t]);

  const generateMonthlyPDF = useCallback(async (report: MonthlyReport) => {
    setLoading(true);
    try {
      await PDFService.generateMonthlyPDF(report);
      Alert.alert(t('success', 'Done'), t('dataExported', 'PDF generated'));
    } catch (error) {
      console.error('generateMonthlyPDF error', error);
      Alert.alert(t('error', 'Error'), t('networkError', 'Failed to generate PDF'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [t]);

  const generateCurrentMonthReport = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      await DataService.generateMonthlyReport(now.getMonth() + 1, now.getFullYear());
      await loadReports();
      Alert.alert(t('success', 'Done'), t('dataExported', 'Monthly report generated'));
    } catch (error) {
      console.error('generateCurrentMonthReport error', error);
      Alert.alert(t('error', 'Error'), t('networkError', 'Failed to generate monthly report'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [loadReports, t]);

  const ViewModeSelector: React.FC = () => (
    <View style={[styles.viewModeSelector, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {[
        { key: 'daily', label: t('dailyReport', 'Daily') },
        { key: 'weekly', label: t('weeklyReport', 'Weekly') },
        { key: 'monthly', label: t('monthlyReport', 'Monthly') },
      ].map((mode) => {
        const modeKey = mode.key as 'daily' | 'weekly' | 'monthly';
        return (
          <TouchableOpacity
            key={mode.key}
            style={[
              styles.viewModeButton,
              viewMode === modeKey && { backgroundColor: theme.primary },
            ]}
            onPress={() => setViewMode(modeKey)}
            accessibilityLabel={`view-mode-${modeKey}`}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.viewModeText,
              viewMode === modeKey ? { color: theme.surface } : { color: theme.textSecondary }
            ]}>
              {mode.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const DailyReportCard = ({ item }: { item: DailyReport }) => (
    <View style={[styles.reportCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.reportHeader}>
        <Text style={[styles.reportTitle, { color: theme.text }]}>
          {LanguageService.getDayName(new Date(item.date))}
        </Text>
        <Text style={[styles.reportDate, { color: theme.textSecondary }]}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.reportStats}>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.hoursWorked ?? 0}h</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{t('hoursWorked', 'Hours')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.booksSold ?? 0}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{t('booksSold', 'Books')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text } ]}>TSH {Number(item.dailyAmount || 0).toLocaleString()}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{t('totalSales', 'Sales')}</Text>
        </View>
      </View>
    </View>
  );

  const WeeklyReportCard = ({ item }: { item: WeeklyReport }) => (
    <TouchableOpacity
      style={[styles.reportCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => setSelectedReport(item)}
      activeOpacity={0.85}
      accessibilityLabel={`weekly-${item.weekNumber}`}
    >
      <View style={styles.reportHeader}>
        <View style={[styles.reportNumberBadge, { backgroundColor: theme.primary }]}>
          <Text style={[styles.reportNumber, { color: theme.surface }]}>{t('weeklyReport', 'Week')} #{item.weekNumber}</Text>
        </View>
        <View style={styles.lockStatus}>
          {item.isLocked ? (<Lock size={16} color={theme.error} />) : (<Unlock size={16} color={theme.success} />)}
        </View>
      </View>

      <Text style={[styles.reportStudentName, { color: theme.text }]}>{item.studentName}</Text>
      <Text style={[styles.reportDate, { color: theme.textSecondary }]}>
        {new Date(item.weekStartDate).toLocaleDateString()} - {new Date(item.weekEndDate).toLocaleDateString()}
      </Text>

      <View style={styles.reportStats}>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.totalHours ?? 0}h</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{t('hoursWorked', 'Hours')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.totalBooksSold ?? 0}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{t('booksSold', 'Books')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text } ]}>TSH {Number(item.totalAmount || 0).toLocaleString()}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{t('totalSales', 'Sales')}</Text>
        </View>
      </View>

      <View style={styles.reportActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.surface + '10' }]}
          onPress={() => setSelectedReport(item)}
          disabled={loading}
        >
          <Eye size={16} color={theme.primary} />
          <Text style={[styles.actionButtonText, { color: theme.primary }]}>{t('viewDetails', 'View')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pdfButton, { backgroundColor: theme.success + '10' }]}
          onPress={() => generateWeeklyPDF(item)}
          disabled={loading}
        >
          <FileDown size={16} color={theme.success} />
          <Text style={[styles.pdfButtonText, { color: theme.success }]}>{t('generatePDF', 'PDF')}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const MonthlyReportCard = ({ item }: { item: MonthlyReport }) => (
    <View style={[styles.reportCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.reportHeader}>
        <Text style={[styles.reportTitle, { color: theme.text }]}>
          {LanguageService.getMonthName(item.month)} {item.year}
        </Text>
        <TouchableOpacity
          style={[styles.pdfButton, { backgroundColor: theme.success + '10' }]}
          onPress={() => generateMonthlyPDF(item)}
          disabled={loading}
        >
          <FileDown size={16} color={theme.success} />
          <Text style={[styles.pdfButtonText, { color: theme.success }]}>{t('generatePDF', 'PDF')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.reportStudentName, { color: theme.text }]}>{item.studentName}</Text>
      <Text style={[styles.reportDate, { color: theme.textSecondary }]}>{(item.weeklyReports || []).length} {t('weeklyReport', 'Weeks')}</Text>

      <View style={styles.reportStats}>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.totalHours ?? 0}h</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{t('hoursWorked', 'Hours')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.totalBooks ?? 0}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{t('booksSold', 'Books')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text } ]}>TSH {Number(item.totalAmount || 0).toLocaleString()}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{t('totalSales', 'Sales')}</Text>
        </View>
      </View>
    </View>
  );

  const ReportDetail = ({ report }: { report: WeeklyReport }) => (
    <View style={[styles.detailContainer, { backgroundColor: theme.background }]}>
      <View style={[styles.detailHeader, { backgroundColor: theme.primary }]}>
        <Text style={[styles.detailTitle, { color: theme.surface }]}>{t('weeklyReport', 'Weekly Report')} #{report.weekNumber}</Text>
        <TouchableOpacity onPress={() => setSelectedReport(null)}>
          <Text style={[styles.closeButton, { color: theme.surface + 'cc' }]}>{t('close', 'Close')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={[styles.detailContent, { backgroundColor: theme.background }]}>
        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionTitle, { color: theme.text }]}>{t('dailyReport', 'Daily Report')}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('newReport', 'Reporter')}: {report.studentName}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('phoneNumber', 'Phone')}: {report.phoneNumber}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('weekStatus', 'Week')}: {new Date(report.weekStartDate).toLocaleDateString()} - {new Date(report.weekEndDate).toLocaleDateString()}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionTitle, { color: theme.text }]}>{t('weeklyReport', 'Weekly Report')}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('hoursWorked', 'Hours')}: {report.totalHours}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('booksSold', 'Books')}: {report.totalBooksSold}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('totalSales', 'Sales')}: TSH {Number(report.totalAmount || 0).toLocaleString()}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('freeLiterature', 'Free Lit')}: {report.totalFreeLiterature}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionTitle, { color: theme.text }]}>{t('ministryActivities', 'Activities')}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('vopActivities', 'VOP')}: {report.totalVopActivities}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('churchAttendees', 'Attendees')}: {report.totalChurchAttendees}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('backSlidesVisited', 'Back slides')}: {report.totalBackSlidesVisited}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('prayersOffered', 'Prayers')}: {report.totalPrayersOffered}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('bibleStudies', 'Bible studies')}: {report.totalBibleStudies}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('baptismCandidates', 'Candidates')}: {report.totalBaptismCandidates}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('baptismsPerformed', 'Baptisms')}: {report.totalBaptismsPerformed}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{t('peopleVisited', 'People visited')}: {report.totalPeopleVisited}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionTitle, { color: theme.text }]}>{t('dailyReport', 'Daily Report')}</Text>
          {(report.dailyReports || []).map((daily, index) => (
            <View key={index} style={[styles.dailyReportDetail, { backgroundColor: theme.card }]}>
              <Text style={[styles.dailyReportTitle, { color: theme.text }]}>{LanguageService.getDayName(new Date(daily.date))} - {new Date(daily.date).toLocaleDateString()}</Text>
              <Text style={[styles.dailyReportInfo, { color: theme.textSecondary }]}>
                {t('hoursWorked', 'Hours')}: {daily.hoursWorked} | {t('booksSold', 'Books')}: {daily.booksSold} | {t('totalSales', 'Sales')}: TSH {Number(daily.dailyAmount || 0).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.pdfGenerateButton, { backgroundColor: theme.success }]}
          onPress={() => generateWeeklyPDF(report)}
          disabled={loading}
        >
          <FileDown size={20} color={theme.surface} />
          <Text style={[styles.pdfGenerateButtonText, { color: theme.surface }]}>{t('generatePDF', 'Generate PDF')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  if (selectedReport) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ReportDetail report={selectedReport} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <Text style={[styles.headerTitle, { color: theme.surface }]}>{t('reportHistory', 'Reports')}</Text>
        <Text style={[styles.headerSubtitle, { color: theme.surface + 'cc' }]}>{t('reportHistory', 'Reports')}</Text>

        <TouchableOpacity style={[styles.monthlyButton, { backgroundColor: theme.success }]} onPress={generateCurrentMonthReport} disabled={loading}>
          {loading ? <ActivityIndicator color={theme.surface} /> : <TrendingUp size={16} color={theme.surface} />}
          <Text style={[styles.monthlyButtonText, { color: theme.surface }]}>{t('generateMonthlyReport', 'Generate month')}</Text>
        </TouchableOpacity>
      </View>

      {/* View Mode Selector */}
      <ViewModeSelector />

      {/* Reports List */}
      <View style={[styles.listContainer]}>
        {loading ? (
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary, marginTop: 12 }]}>{t('loading', 'Loading...')}</Text>
          </View>
        ) : (
          <>
            {viewMode === 'daily' && (
              <>
                {dailyReports.length === 0 ? (
                  <View style={styles.emptyState}>
                    <FileText size={64} color={theme.textSecondary} />
                    <Text style={[styles.emptyStateTitle, { color: theme.text }]}>{t('noReportToday', 'No reports today')}</Text>
                    <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{t('submitFirstReport', 'Submit your first report')}</Text>
                  </View>
                ) : (
                  <FlatList
                    data={dailyReports}
                    renderItem={({ item }) => <DailyReportCard item={item} />}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                  />
                )}
              </>
            )}

            {viewMode === 'weekly' && (
              <>
                {weeklyReports.length === 0 ? (
                  <View style={styles.emptyState}>
                    <FileText size={64} color={theme.textSecondary} />
                    <Text style={[styles.emptyStateTitle, { color: theme.text }]}>{t('noAnalytics', 'No analytics')}</Text>
                    <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{t('submitFirstReport', 'Submit your first report')}</Text>
                  </View>
                ) : (
                  <FlatList
                    data={weeklyReports}
                    renderItem={({ item }) => <WeeklyReportCard item={item} />}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                  />
                )}
              </>
            )}

            {viewMode === 'monthly' && (
              <>
                {monthlyReports.length === 0 ? (
                  <View style={styles.emptyState}>
                    <FileText size={64} color={theme.textSecondary} />
                    <Text style={[styles.emptyStateTitle, { color: theme.text }]}>{t('noAnalytics', 'No analytics')}</Text>
                    <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{t('generateMonthlyReport', 'Generate monthly report')}</Text>
                  </View>
                ) : (
                  <FlatList
                    data={monthlyReports}
                    renderItem={({ item }) => <MonthlyReportCard item={item} />}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                  />
                )}
              </>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// --- styles (mostly carried over from your file) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  monthlyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  monthlyButtonText: {
    fontWeight: '600',
    marginLeft: 6,
  },
  viewModeSelector: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 16,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 32,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  reportCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  reportNumberBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  reportNumber: {
    fontWeight: '600',
    fontSize: 12,
  },
  lockStatus: {
    padding: 4,
  },
  reportStudentName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 14,
    marginBottom: 12,
  },
  reportStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reportStat: {
    alignItems: 'center',
  },
  reportStatValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  reportStatLabel: {
    fontSize: 12,
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    fontWeight: '500',
    marginLeft: 4,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pdfButtonText: {
    fontWeight: '500',
    marginLeft: 4,
  },
  pdfGenerateButton: {
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  pdfGenerateButtonText: {
    fontWeight: '600',
    marginLeft: 8,
  },
  detailContainer: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  detailContent: {
    flex: 1,
    padding: 16,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  detailItem: {
    fontSize: 16,
    marginBottom: 8,
    paddingVertical: 4,
  },
  dailyReportDetail: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  dailyReportTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  dailyReportInfo: {
    fontSize: 14,
  },
});
