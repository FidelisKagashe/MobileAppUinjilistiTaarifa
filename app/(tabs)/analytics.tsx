// app/(tabs)/analytics.tsx  (patched)
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { TrendingUp, Calendar, DollarSign, ChartBar as BarChart3, Award } from 'lucide-react-native';
import { DataService } from '@/services/DataService';
import { LanguageService } from '@/services/LanguageService';
import { WeeklyReport, DailyReport } from '@/types/Report';
import { useTheme } from '../providers/ThemeProvider';

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const { theme } = useTheme();

  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'weekly' | 'daily'>('weekly');

  // mounted ref to prevent state updates after unmount
  const mountedRef = useRef(true);

  // small tick to force re-render on language change
  const [, setLangTick] = useState(0);

  // Helper t: accepts either keyof Translations or plain string fallback
  const t = useCallback((key: string, fallback?: string) => {
    // LanguageService.t has strict typing in your project; cast to any to avoid TS error when passing dynamic strings
    try {
      const result = (LanguageService.t as any)(key);
      return result ?? fallback ?? key;
    } catch {
      return fallback ?? key;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let unsubLang: (() => void) | undefined;
    let unsubReports: (() => void) | undefined;
    let unsubProfile: (() => void) | undefined;
    let unsubSettings: (() => void) | undefined;

    (async () => {
      try {
        await DataService.initialize();
        await LanguageService.initialize();
        await loadAnalyticsData();

        // Subscribe to language changes to re-render translated strings
        unsubLang = LanguageService.subscribe(() => {
          if (mountedRef.current) setLangTick((t) => t + 1);
        });
        
        // Subscribe to DataService events for live updates
        unsubReports = DataService.subscribe('reportsUpdated', () => {
          if (mountedRef.current) loadAnalyticsData();
        });
        
        unsubProfile = DataService.subscribe('profileUpdated', () => {
          if (mountedRef.current) loadAnalyticsData();
        });
        
        unsubSettings = DataService.subscribe('settingsUpdated', () => {
          if (mountedRef.current) loadAnalyticsData();
        });
      } catch (err) {
        console.error('init analytics error', err);
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

  const loadAnalyticsData = useCallback(async () => {
    try {
      const weekly = await DataService.getAllWeeklyReports();
      const daily = await DataService.getAllDailyReports();

      if (!mountedRef.current) return;

      // defensive sorting
      const w = (weekly || []).slice().sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
      const d = (daily || []).slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setWeeklyReports(w);
      setDailyReports(d);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    }
  }, []);

  // convert hex to rgba
  const hexToRgba = (hex: string, alpha = 1) => {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    const h = hex.replace('#', '');
    const normalized = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // chartConfig memoized so charts don't re-create unnecessarily
  const chartConfig = useMemo(() => ({
    backgroundColor: theme.card,
    backgroundGradientFrom: theme.card,
    backgroundGradientTo: theme.card,
    decimalPlaces: 0,
    color: (opacity = 1) => hexToRgba(theme.primary, opacity),
    labelColor: (opacity = 1) => hexToRgba(theme.text, opacity),
    style: { borderRadius: 16 },
    propsForDots: { r: '6', strokeWidth: '2', stroke: theme.primary },
  }), [theme]);

  // --- prepare data slices safely (memoized) ---
  const weeklySlice = useMemo(() => weeklyReports.slice(-6), [weeklyReports]);
  const weeklyLabels = useMemo(() => (weeklySlice.length ? weeklySlice.map((_, i) => `W${i + 1}`) : ['-']), [weeklySlice]);
  const weeklyAmounts = useMemo(() => (weeklySlice.length ? weeklySlice.map(r => Number(r.totalAmount || 0)) : [0]), [weeklySlice]);
  const weeklyHours = useMemo(() => (weeklySlice.length ? weeklySlice.map(r => Number(r.totalHours || 0)) : [0]), [weeklySlice]);

  const weeklySalesData = useMemo(() => ({
    labels: weeklyLabels,
    datasets: [
      {
        data: weeklyAmounts,
        color: (opacity = 1) => hexToRgba(theme.success, opacity),
        strokeWidth: 2,
      },
    ],
  }), [weeklyLabels, weeklyAmounts, theme]);

  const weeklyHoursData = useMemo(() => ({
    labels: weeklySlice.length ? weeklySlice.map((_, i) => `${t('weekActive', 'Week')} ${i + 1}`) : ['-'],
    datasets: [{ data: weeklyHours }],
  }), [weeklySlice, weeklyHours, t]);

  // daily
  const dailySlice = useMemo(() => dailyReports.slice(-7), [dailyReports]);
  const dailyLabels = useMemo(() => (dailySlice.length ? dailySlice.map(r => LanguageService.getDayName(new Date(r.date)).substring(0, 3)) : ['-']), [dailySlice]);
  const dailyAmounts = useMemo(() => (dailySlice.length ? dailySlice.map(r => Number(r.dailyAmount || 0)) : [0]), [dailySlice]);
  const dailyHours = useMemo(() => (dailySlice.length ? dailySlice.map(r => Number(r.hoursWorked || 0)) : [0]), [dailySlice]);

  const dailySalesData = useMemo(() => ({
    labels: dailyLabels,
    datasets: [
      {
        data: dailyAmounts,
        color: (opacity = 1) => hexToRgba(theme.success, opacity),
        strokeWidth: 2,
      },
    ],
  }), [dailyLabels, dailyAmounts, theme]);

  const dailyHoursData = useMemo(() => ({
    labels: dailyLabels,
    datasets: [{ data: dailyHours }],
  }), [dailyLabels, dailyHours]);

  // activityData (pie)
  const activityData = useMemo(() => {
    const bibleStudies = weeklyReports.reduce((sum, r) => sum + Number(r.totalBibleStudies || 0), 0);
    const prayers = weeklyReports.reduce((sum, r) => sum + Number(r.totalPrayersOffered || 0), 0);
    const visited = weeklyReports.reduce((sum, r) => sum + Number(r.totalPeopleVisited || 0), 0);
    const baptisms = weeklyReports.reduce((sum, r) => sum + Number(r.totalBaptismsPerformed || 0), 0);

    return [
      { name: t('bibleStudies', 'Bible studies'), population: bibleStudies, color: theme.primary, legendFontColor: theme.text, legendFontSize: 12 },
      { name: t('prayersOffered', 'Prayers'), population: prayers, color: theme.success, legendFontColor: theme.text, legendFontSize: 12 },
      { name: t('peopleVisited', 'Visited'), population: visited, color: theme.error, legendFontColor: theme.text, legendFontSize: 12 },
      { name: t('baptismsPerformed', 'Baptisms'), population: baptisms, color: theme.warning, legendFontColor: theme.text, legendFontSize: 12 },
    ];
  }, [weeklyReports, theme, t]);

  const allZeros = useCallback((arr: number[]) => arr.every(n => !n), []);

  // Key metrics
  const totalSales = useMemo(() => weeklyReports.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0), [weeklyReports]);
  const totalHours = useMemo(() => weeklyReports.reduce((sum, r) => sum + Number(r.totalHours || 0), 0), [weeklyReports]);
  const totalBooks = useMemo(() => weeklyReports.reduce((sum, r) => sum + Number(r.totalBooksSold || 0), 0), [weeklyReports]);
  const averageWeeklySales = useMemo(() => (weeklyReports.length > 0 ? Math.round(totalSales / weeklyReports.length) : 0), [weeklyReports, totalSales]);

  // UI components
  const MetricCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <View style={[styles.metricCard, { borderTopColor: color, backgroundColor: theme.card }]}>
      <View style={styles.metricHeader}>
        <Icon size={20} color={color} />
        <Text style={[styles.metricTitle, { color: theme.textSecondary }]}>{title}</Text>
      </View>
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.metricSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
    </View>
  );

  const ViewModeSelector = () => (
    <View style={[styles.viewModeSelector, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TouchableOpacity
        style={[styles.viewModeButton, viewMode === 'daily' ? { backgroundColor: theme.primary } : undefined]}
        onPress={() => setViewMode('daily')}
        accessibilityLabel="view-daily"
      >
        <Text style={[styles.viewModeText, viewMode === 'daily' ? { color: theme.surface } : { color: theme.textSecondary }]}>{t('dailyReport', 'Daily')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.viewModeButton, viewMode === 'weekly' ? { backgroundColor: theme.primary } : undefined]}
        onPress={() => setViewMode('weekly')}
        accessibilityLabel="view-weekly"
      >
        <Text style={[styles.viewModeText, viewMode === 'weekly' ? { color: theme.surface } : { color: theme.textSecondary }]}>{t('weeklyReport', 'Weekly')}</Text>
      </TouchableOpacity>
    </View>
  );

  // pick current data
  const currentData = viewMode === 'weekly' ? weeklyReports : dailyReports;
  const salesData = viewMode === 'weekly' ? weeklySalesData : dailySalesData;
  const hoursData = viewMode === 'weekly' ? weeklyHoursData : dailyHoursData;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary, marginTop: 12 }]}>{t('loading', 'Loading...')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (weeklyReports.length === 0 && dailyReports.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.emptyState}>
          <BarChart3 size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyStateTitle, { color: theme.text }]}>{t('noAnalytics', 'No analytics')}</Text>
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{t('submitFirstReport', 'Submit your first report')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <Text style={[styles.headerTitle, { color: theme.surface }]}>{t('analyticsBoard', 'Analytics')}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.surface + 'cc' }]}>{t('performanceInsights', 'Performance')}</Text>
        </View>

        <ViewModeSelector />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('keyMetrics', 'Key metrics')}</Text>
          <View style={styles.metricsGrid}>
            <MetricCard title={t('totalSales', 'Total sales')} value={`TSH ${totalSales.toLocaleString()}`} subtitle={t('allTimeSales', 'All time')} icon={DollarSign} color={theme.success} />
            <MetricCard title={t('weeklyAverage', 'Weekly average')} value={`TSH ${averageWeeklySales.toLocaleString()}`} subtitle={t('weeklyAverage', 'Weekly average')} icon={TrendingUp} color={theme.primary} />
            <MetricCard title={t('totalHours', 'Total hours')} value={`${totalHours}`} subtitle={t('totalHours', 'Total hours')} icon={Calendar} color={theme.error} />
            <MetricCard title={t('booksDistributed', 'Books')} value={`${totalBooks}`} subtitle={t('booksDistributed', 'Books distributed')} icon={Award} color={theme.warning} />
          </View>
        </View>

        {currentData.length > 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('salesTrend', 'Sales trend')}</Text>
            <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
              <LineChart
                key={`line-${viewMode}-${salesData.labels.length}-${theme.primary}`}
                data={{
                  labels: salesData.labels,
                  datasets: [{ ...salesData.datasets[0], data: salesData.datasets[0].data.map((n: any) => Number(n || 0)) }],
                }}
                width={screenWidth - 48}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                fromZero
                withInnerLines={false}
                yLabelsOffset={6}
              />
              {allZeros(salesData.datasets[0].data.map((n: any) => Number(n || 0))) && (
                <Text style={[styles.chartEmptyText, { color: theme.textSecondary }]}>{t('noAnalytics', 'No analytics')}</Text>
              )}
            </View>
          </View>
        )}

        {currentData.length > 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('hoursChart', 'Hours worked')}</Text>
            <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
              <BarChart
                key={`bar-${viewMode}-${hoursData.labels.length}-${theme.primary}`}
                data={{
                  labels: hoursData.labels,
                  datasets: [{ data: hoursData.datasets[0].data.map((n: any) => Number(n || 0)) }],
                }}
                width={screenWidth - 48}
                height={220}
                chartConfig={chartConfig}
                yAxisLabel=""
                yAxisSuffix="h"
                style={styles.chart}
                fromZero
              />
              {allZeros(hoursData.datasets[0].data.map((n: any) => Number(n || 0))) && (
                <Text style={[styles.chartEmptyText, { color: theme.textSecondary }]}>{t('noAnalytics', 'No analytics')}</Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('ministryDistribution', 'Ministry distribution')}</Text>
          <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
            {activityData.filter(item => item.population > 0).length > 0 ? (
              <PieChart
                key={`pie-${activityData.length}-${theme.primary}`}
                data={activityData.filter(item => item.population > 0)}
                width={screenWidth - 48}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                style={styles.chart}
              />
            ) : (
              <Text style={[styles.chartEmptyText, { color: theme.textSecondary }]}>{t('noAnalytics', 'No analytics')}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, marginBottom: 8 },
  viewModeSelector: { flexDirection: 'row', margin: 16, borderRadius: 8, padding: 4 },
  viewModeButton: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center' },
  viewModeText: { fontSize: 14, fontWeight: '500' },
  section: { margin: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  loadingText: { textAlign: 'center', fontSize: 16, marginTop: 32 },
  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: 32 },
  emptyStateTitle: { fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptyStateText: { fontSize: 14, textAlign: 'center' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  metricCard: { padding: 16, borderRadius: 12, margin: 6, flex: 0.48, borderTopWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  metricHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  metricTitle: { fontSize: 14, fontWeight: '500', marginLeft: 8 },
  metricValue: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  metricSubtitle: { fontSize: 12 },
  chartContainer: { borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, minHeight: 120, justifyContent: 'center' },
  chart: { borderRadius: 16 },
  chartEmptyText: { textAlign: 'center', marginTop: 12 },
});
