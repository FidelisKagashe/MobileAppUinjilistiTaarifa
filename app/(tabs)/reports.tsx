// app/(tabs)/reports.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
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
import { LanguageService } from '@/services/LanguageService';
import { WeeklyReport, MonthlyReport, DailyReport } from '@/types/Report';
import { useTheme } from '../providers/ThemeProvider';

export default function ReportsScreen() {
  const { theme } = useTheme();

  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly' | 'daily'>('weekly');

  // rerender on language change
  const [, setLangTick] = useState(0);

  useEffect(() => {
    let unsubscribeFn: (() => void) | null = null;

    (async () => {
      try {
        await DataService.initialize();
        await LanguageService.initialize();
        await loadReports();
        // subscribe and capture unsubscribe function
        unsubscribeFn = LanguageService.subscribe(() => setLangTick((t) => t + 1));
      } catch (err) {
        console.error('init error', err);
      }
    })();

    // cleanup returned to React
    return () => {
      if (typeof unsubscribeFn === 'function') unsubscribeFn();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReports = async () => {
    try {
      const weekly = await DataService.getAllWeeklyReports();
      const monthly = await DataService.getAllMonthlyReports();
      const daily = await DataService.getAllDailyReports();

      setWeeklyReports((weekly || []).sort((a, b) => b.weekNumber - a.weekNumber));
      setMonthlyReports((monthly || []).sort((a, b) => (b.year - a.year) || (b.month - a.month)));
      setDailyReports((daily || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert(LanguageService.t('error'), LanguageService.t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  const generateWeeklyPDF = async (report: WeeklyReport) => {
    try {
      await PDFService.generateWeeklyPDF(report);
    } catch (error) {
      console.error(error);
      Alert.alert(LanguageService.t('error'), LanguageService.t('networkError'));
    }
  };

  const generateMonthlyPDF = async (report: MonthlyReport) => {
    try {
      await PDFService.generateMonthlyPDF(report);
    } catch (error) {
      console.error(error);
      Alert.alert(LanguageService.t('error'), LanguageService.t('networkError'));
    }
  };

  const generateCurrentMonthReport = async () => {
    try {
      const now = new Date();
      await DataService.generateMonthlyReport(now.getMonth() + 1, now.getFullYear());
      await loadReports();
      Alert.alert(LanguageService.t('success'), LanguageService.t('dataExported'));
    } catch (error) {
      console.error(error);
      Alert.alert(LanguageService.t('error'), LanguageService.t('networkError'));
    }
  };

  const ViewModeSelector: React.FC = () => (
    <View style={[styles.viewModeSelector, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {[
        { key: 'daily', label: LanguageService.t('dailyReport') },
        { key: 'weekly', label: LanguageService.t('weeklyReport') },
        { key: 'monthly', label: LanguageService.t('monthlyReport') },
      ].map((mode) => (
        <TouchableOpacity
          key={mode.key}
          style={[
            styles.viewModeButton,
            viewMode === (mode.key as 'daily' | 'weekly' | 'monthly') && { backgroundColor: theme.primary },
          ]}
          onPress={() => setViewMode(mode.key as any)}
        >
          <Text style={[
            styles.viewModeText,
            viewMode === mode.key ? { color: theme.surface } : { color: theme.textSecondary }
          ]}>
            {mode.label}
          </Text>
        </TouchableOpacity>
      ))}
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
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.hoursWorked}h</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{LanguageService.t('hoursWorked')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.booksSold}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{LanguageService.t('booksSold')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text } ]}>TSH {Number(item.dailyAmount || 0).toLocaleString()}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{LanguageService.t('totalSales')}</Text>
        </View>
      </View>
    </View>
  );

  const WeeklyReportCard = ({ item }: { item: WeeklyReport }) => (
    <TouchableOpacity
      style={[styles.reportCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => setSelectedReport(item)}
    >
      <View style={styles.reportHeader}>
        <View style={[styles.reportNumberBadge, { backgroundColor: theme.primary }]}>
          <Text style={[styles.reportNumber, { color: theme.surface }]}>{LanguageService.t('weeklyReport')} #{item.weekNumber}</Text>
        </View>
        <View style={styles.lockStatus}>
          {item.isLocked ? (
            <Lock size={16} color={theme.error} />
          ) : (
            <Unlock size={16} color={theme.success} />
          )}
        </View>
      </View>

      <Text style={[styles.reportStudentName, { color: theme.text }]}>{item.studentName}</Text>
      <Text style={[styles.reportDate, { color: theme.textSecondary }]}>
        {new Date(item.weekStartDate).toLocaleDateString()} - {new Date(item.weekEndDate).toLocaleDateString()}
      </Text>

      <View style={styles.reportStats}>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.totalHours}h</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{LanguageService.t('hoursWorked')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.totalBooksSold}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{LanguageService.t('booksSold')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text } ]}>TSH {Number(item.totalAmount || 0).toLocaleString()}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{LanguageService.t('totalSales')}</Text>
        </View>
      </View>

      <View style={styles.reportActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.surface + '10' }]}
          onPress={() => setSelectedReport(item)} // view details
        >
          <Eye size={16} color={theme.primary} />
          <Text style={[styles.actionButtonText, { color: theme.primary }]}>{LanguageService.t('viewDetails')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pdfButton, { backgroundColor: theme.success + '10' }]}
          onPress={() => generateWeeklyPDF(item)}
        >
          <FileDown size={16} color={theme.success} />
          <Text style={[styles.pdfButtonText, { color: theme.success }]}>{LanguageService.t('generatePDF')}</Text>
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
        >
          <FileDown size={16} color={theme.success} />
          <Text style={[styles.pdfButtonText, { color: theme.success }]}>{LanguageService.t('generatePDF')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.reportStudentName, { color: theme.text }]}>{item.studentName}</Text>
      <Text style={[styles.reportDate, { color: theme.textSecondary }]}>{(item.weeklyReports || []).length} {LanguageService.t('weeklyReport')}</Text>

      <View style={styles.reportStats}>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.totalHours}h</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{LanguageService.t('hoursWorked')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text }]}>{item.totalBooks}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{LanguageService.t('booksSold')}</Text>
        </View>
        <View style={styles.reportStat}>
          <Text style={[styles.reportStatValue, { color: theme.text } ]}>TSH {Number(item.totalAmount || 0).toLocaleString()}</Text>
          <Text style={[styles.reportStatLabel, { color: theme.textSecondary }]}>{LanguageService.t('totalSales')}</Text>
        </View>
      </View>
    </View>
  );

  const ReportDetail = ({ report }: { report: WeeklyReport }) => (
    <View style={[styles.detailContainer, { backgroundColor: theme.card }]}>
      <View style={[styles.detailHeader, { backgroundColor: theme.primary }]}>
        <Text style={[styles.detailTitle, { color: theme.surface }]}>{LanguageService.t('weeklyReport')} #{report.weekNumber}</Text>
        <TouchableOpacity onPress={() => setSelectedReport(null)}>
          <Text style={[styles.closeButton, { color: theme.surface + 'cc' }]}>{LanguageService.t('close')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={[styles.detailContent, { backgroundColor: theme.background }]}>
        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionTitle, { color: theme.text }]}>{LanguageService.t('dailyReport')}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('newReport')}: {report.studentName}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('phoneNumber')}: {report.phoneNumber}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>
            {LanguageService.t('weekStatus')}: {new Date(report.weekStartDate).toLocaleDateString()} - {new Date(report.weekEndDate).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionTitle, { color: theme.text }]}>{LanguageService.t('weeklyReport')}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('hoursWorked')}: {report.totalHours}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('booksSold')}: {report.totalBooksSold}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('totalSales')}: TSH {Number(report.totalAmount || 0).toLocaleString()}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('freeLiterature')}: {report.totalFreeLiterature}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionTitle, { color: theme.text }]}>{LanguageService.t('ministryActivities')}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('vopActivities')}: {report.totalVopActivities}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('churchAttendees')}: {report.totalChurchAttendees}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('backSlidesVisited')}: {report.totalBackSlidesVisited}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('prayersOffered')}: {report.totalPrayersOffered}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('bibleStudies')}: {report.totalBibleStudies}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('baptismCandidates')}: {report.totalBaptismCandidates}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('baptismsPerformed')}: {report.totalBaptismsPerformed}</Text>
          <Text style={[styles.detailItem, { color: theme.text }]}>{LanguageService.t('peopleVisited')}: {report.totalPeopleVisited}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={[styles.detailSectionTitle, { color: theme.text }]}>{LanguageService.t('dailyReport')}</Text>
          {(report.dailyReports || []).map((daily, index) => (
            <View key={index} style={[styles.dailyReportDetail, { backgroundColor: theme.card }]}>
              <Text style={[styles.dailyReportTitle, { color: theme.text }]}>
                {LanguageService.getDayName(new Date(daily.date))} - {new Date(daily.date).toLocaleDateString()}
              </Text>
              <Text style={[styles.dailyReportInfo, { color: theme.textSecondary }]}>
                {LanguageService.t('hoursWorked')}: {daily.hoursWorked} | {LanguageService.t('booksSold')}: {daily.booksSold} | {LanguageService.t('totalSales')}: TSH {Number(daily.dailyAmount || 0).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.pdfGenerateButton, { backgroundColor: theme.success }]}
          onPress={() => generateWeeklyPDF(report)}
        >
          <FileDown size={20} color={theme.surface} />
          <Text style={[styles.pdfGenerateButtonText, { color: theme.surface }]}>{LanguageService.t('generatePDF')}</Text>
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
        <Text style={[styles.headerTitle, { color: theme.surface }]}>{LanguageService.t('reportHistory')}</Text>
        <Text style={[styles.headerSubtitle, { color: theme.surface + 'cc' }]}>{LanguageService.t('reportHistory')}</Text>

        <TouchableOpacity style={[styles.monthlyButton, { backgroundColor: theme.success }]} onPress={generateCurrentMonthReport}>
          <TrendingUp size={16} color={theme.surface} />
          <Text style={[styles.monthlyButtonText, { color: theme.surface }]}>{LanguageService.t('generateMonthlyReport')}</Text>
        </TouchableOpacity>
      </View>

      {/* View Mode Selector */}
      <ViewModeSelector />

      {/* Reports List */}
      <View style={[styles.listContainer]}>
        {loading ? (
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{LanguageService.t('loading')}</Text>
        ) : (
          <>
            {viewMode === 'daily' && (
              <>
                {dailyReports.length === 0 ? (
                  <View style={styles.emptyState}>
                    <FileText size={64} color={theme.textSecondary} />
                    <Text style={[styles.emptyStateTitle, { color: theme.text }]}>{LanguageService.t('noReportToday')}</Text>
                    <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{LanguageService.t('submitFirstReport')}</Text>
                  </View>
                ) : (
                  <FlatList
                    data={dailyReports}
                    renderItem={({ item }) => <DailyReportCard item={item} />}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                  />
                )}
              </>
            )}

            {viewMode === 'weekly' && (
              <>
                {weeklyReports.length === 0 ? (
                  <View style={styles.emptyState}>
                    <FileText size={64} color={theme.textSecondary} />
                    <Text style={[styles.emptyStateTitle, { color: theme.text }]}>{LanguageService.t('noAnalytics')}</Text>
                    <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{LanguageService.t('submitFirstReport')}</Text>
                  </View>
                ) : (
                  <FlatList
                    data={weeklyReports}
                    renderItem={({ item }) => <WeeklyReportCard item={item} />}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                  />
                )}
              </>
            )}

            {viewMode === 'monthly' && (
              <>
                {monthlyReports.length === 0 ? (
                  <View style={styles.emptyState}>
                    <FileText size={64} color={theme.textSecondary} />
                    <Text style={[styles.emptyStateTitle, { color: theme.text }]}>{LanguageService.t('noAnalytics')}</Text>
                    <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{LanguageService.t('generateMonthlyReport')}</Text>
                  </View>
                ) : (
                  <FlatList
                    data={monthlyReports}
                    renderItem={({ item }) => <MonthlyReportCard item={item} />}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
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

// --- styles (unchanged from your file) ---
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
