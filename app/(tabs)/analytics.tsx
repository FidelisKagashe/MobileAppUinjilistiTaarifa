// app/(tabs)/analytics.tsx  (patched)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
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

  // small tick to force re-render on language change
  const [, setLangTick] = useState(0);

  useEffect(() => {
    (async () => {
      await DataService.initialize();
      await LanguageService.initialize();
      await loadAnalyticsData();

      const unsubscribe = (LanguageService as any).subscribe ? (LanguageService as any).subscribe(() => setLangTick(t => t + 1)) : undefined;
      return () => unsubscribe && unsubscribe();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAnalyticsData = async () => {
    try {
      const weekly = await DataService.getAllWeeklyReports();
      const daily = await DataService.getAllDailyReports();

      setWeeklyReports(weekly.sort((a, b) => a.weekNumber - b.weekNumber));
      setDailyReports(daily.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // convert hex to rgba
  const hexToRgba = (hex: string, alpha = 1) => {
    const h = hex.replace('#', '');
    const normalized = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const chartConfig = {
    backgroundColor: theme.card,
    backgroundGradientFrom: theme.card,
    backgroundGradientTo: theme.card,
    decimalPlaces: 0,
    color: (opacity = 1) => hexToRgba(theme.primary, opacity),
    labelColor: (opacity = 1) => hexToRgba(theme.text, opacity),
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: theme.primary,
    },
  };

  // --- SAFEGUARDED DATA PREPARATION ---

  // Weekly slice (last up-to-6 weeks)
  const weeklySlice = weeklyReports.slice(-6);
  const weeklyLabels = weeklySlice.length
    ? weeklySlice.map((r, i) => `W${i + 1}`)
    : ['-'];
  const weeklyAmounts = weeklySlice.length
    ? weeklySlice.map((report) => Number(report.totalAmount || 0))
    : [0];
  const weeklyHours = weeklySlice.length
    ? weeklySlice.map((report) => Number(report.totalHours || 0))
    : [0];

  const weeklySalesData = {
    labels: weeklyLabels,
    datasets: [
      {
        data: weeklyAmounts,
        color: (opacity = 1) => hexToRgba(theme.success, opacity),
        strokeWidth: 2,
      },
    ],
  };

  const weeklyHoursData = {
    labels: weeklySlice.length
      ? weeklySlice.map((r, i) => `${LanguageService.t('weekActive')} ${i + 1}`)
      : ['-'],
    datasets: [{ data: weeklyHours }],
  };

  // Daily slice (last 7 days)
  const dailySlice = dailyReports.slice(-7);
  const dailyLabels = dailySlice.length
    ? dailySlice.map((r) => LanguageService.getDayName(new Date(r.date)).substring(0, 3))
    : ['-'];
  const dailyAmounts = dailySlice.length
    ? dailySlice.map((r) => Number(r.dailyAmount || 0))
    : [0];
  const dailyHours = dailySlice.length
    ? dailySlice.map((r) => Number(r.hoursWorked || 0))
    : [0];

  const dailySalesData = {
    labels: dailyLabels,
    datasets: [
      {
        data: dailyAmounts,
        color: (opacity = 1) => hexToRgba(theme.success, opacity),
        strokeWidth: 2,
      },
    ],
  };

  const dailyHoursData = {
    labels: dailyLabels,
    datasets: [{ data: dailyHours }],
  };

  const activityData = [
    {
      name: LanguageService.t('bibleStudies'),
      population: weeklyReports.reduce((sum, r) => sum + Number(r.totalBibleStudies || 0), 0),
      color: theme.primary,
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
    {
      name: LanguageService.t('prayersOffered'),
      population: weeklyReports.reduce((sum, r) => sum + Number(r.totalPrayersOffered || 0), 0),
      color: theme.success,
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
    {
      name: LanguageService.t('peopleVisited'),
      population: weeklyReports.reduce((sum, r) => sum + Number(r.totalPeopleVisited || 0), 0),
      color: theme.error,
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
    {
      name: LanguageService.t('baptismsPerformed'),
      population: weeklyReports.reduce((sum, r) => sum + Number(r.totalBaptismsPerformed || 0), 0),
      color: theme.warning,
      legendFontColor: theme.text,
      legendFontSize: 12,
    },
  ];

  // helper: detect "empty" dataset (all zeros)
  const allZeros = (arr: number[]) => arr.every((n) => !n);

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
      >
        <Text style={[styles.viewModeText, viewMode === 'daily' ? { color: theme.surface } : { color: theme.textSecondary }]}>
          {LanguageService.t('dailyReport')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.viewModeButton, viewMode === 'weekly' ? { backgroundColor: theme.primary } : undefined]}
        onPress={() => setViewMode('weekly')}
      >
        <Text style={[styles.viewModeText, viewMode === 'weekly' ? { color: theme.surface } : { color: theme.textSecondary }]}>
          {LanguageService.t('weeklyReport')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const totalSales = weeklyReports.reduce((sum, report) => sum + (Number(report.totalAmount) || 0), 0);
  const totalHours = weeklyReports.reduce((sum, report) => sum + (Number(report.totalHours) || 0), 0);
  const totalBooks = weeklyReports.reduce((sum, report) => sum + (Number(report.totalBooksSold) || 0), 0);
  const averageWeeklySales = weeklyReports.length > 0 ? Math.round(totalSales / weeklyReports.length) : 0;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{LanguageService.t('loading')}</Text>
      </SafeAreaView>
    );
  }

  if (weeklyReports.length === 0 && dailyReports.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.emptyState}>
          <BarChart3 size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyStateTitle, { color: theme.text }]}>{LanguageService.t('noAnalytics')}</Text>
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>{LanguageService.t('submitFirstReport')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentData = viewMode === 'weekly' ? weeklyReports : dailyReports;
  const salesData = viewMode === 'weekly' ? weeklySalesData : dailySalesData;
  const hoursData = viewMode === 'weekly' ? weeklyHoursData : dailyHoursData;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <Text style={[styles.headerTitle, { color: theme.surface }]}>{LanguageService.t('analyticsBoard')}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.surface + 'cc' }]}>{LanguageService.t('performanceInsights')}</Text>
        </View>

        {/* View Mode Selector */}
        <ViewModeSelector />

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{LanguageService.t('keyMetrics')}</Text>
          <View style={styles.metricsGrid}>
            <MetricCard
              title={LanguageService.t('totalSales')}
              value={`TSH ${totalSales.toLocaleString()}`}
              subtitle={LanguageService.t('allTimeSales')}
              icon={DollarSign}
              color={theme.success}
            />
            <MetricCard
              title={LanguageService.t('weeklyAverage')}
              value={`TSH ${averageWeeklySales.toLocaleString()}`}
              subtitle={LanguageService.t('weeklyAverage')}
              icon={TrendingUp}
              color={theme.primary}
            />
            <MetricCard
              title={LanguageService.t('totalHours')}
              value={`${totalHours}`}
              subtitle={LanguageService.t('totalHours')}
              icon={Calendar}
              color={theme.error}
            />
            <MetricCard
              title={LanguageService.t('booksDistributed')}
              value={`${totalBooks}`}
              subtitle={LanguageService.t('booksDistributed')}
              icon={Award}
              color={theme.warning}
            />
          </View>
        </View>

        {/* Sales Trend Chart */}
        {currentData.length > 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{LanguageService.t('salesTrend')}</Text>
            <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
              {/* key forces rerender when theme/data change */}
              <LineChart
                key={`line-${viewMode}-${salesData.datasets[0].data.length}-${theme.primary}`}
                data={{
                  labels: salesData.labels,
                  datasets: [{ ...salesData.datasets[0], data: salesData.datasets[0].data.map(n => Number(n || 0)) }],
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
                <Text style={[styles.chartEmptyText, { color: theme.textSecondary }]}>
                  {LanguageService.t('noAnalytics')}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Hours Worked Chart */}
        {currentData.length > 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{LanguageService.t('hoursChart')}</Text>
            <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
              <BarChart
                key={`bar-${viewMode}-${hoursData.datasets[0].data.length}-${theme.primary}`}
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
                <Text style={[styles.chartEmptyText, { color: theme.textSecondary }]}>
                  {LanguageService.t('noAnalytics')}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Ministry Activities Distribution */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{LanguageService.t('ministryDistribution')}</Text>
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
              <Text style={[styles.chartEmptyText, { color: theme.textSecondary }]}>
                {LanguageService.t('noAnalytics')}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
    marginBottom: 8,
  },
  viewModeSelector: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 8,
    padding: 4,
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
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  metricCard: {
    padding: 16,
    borderRadius: 12,
    margin: 6,
    flex: 0.48,
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 12,
  },
  chartContainer: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 120,
    justifyContent: 'center',
  },
  chart: {
    borderRadius: 16,
  },
  chartEmptyText: {
    textAlign: 'center',
    marginTop: 12,
  },
});
