import React, { useState, useEffect } from 'react';
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
import { TrendingUp, Target, Award, Calendar, DollarSign, ChartBar as BarChart3 } from 'lucide-react-native';
import { DataService } from '@/services/DataService';
import { WeeklyReport, DailyReport } from '@/types/Report';

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'weekly' | 'daily'>('weekly');

  useEffect(() => {
    loadAnalyticsData();
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

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(30, 58, 138, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(31, 41, 55, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#1e3a8a',
    },
  };

  // Weekly data
  const weeklySalesData = {
    labels: weeklyReports.slice(-6).map((_, index) => `W${index + 1}`),
    datasets: [
      {
        data: weeklyReports.slice(-6).map(report => report.totalAmount),
        color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const weeklyHoursData = {
    labels: weeklyReports.slice(-6).map((_, index) => `Wiki ${index + 1}`),
    datasets: [
      {
        data: weeklyReports.slice(-6).map(report => report.totalHours),
      },
    ],
  };

  // Daily data (last 7 days)
  const dailySalesData = {
    labels: dailyReports.slice(-7).map(report => DataService.getDayName(new Date(report.date)).substring(0, 3)),
    datasets: [
      {
        data: dailyReports.slice(-7).map(report => report.dailyAmount),
        color: (opacity = 1) => `rgba(5, 150, 105, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const dailyHoursData = {
    labels: dailyReports.slice(-7).map(report => DataService.getDayName(new Date(report.date)).substring(0, 3)),
    datasets: [
      {
        data: dailyReports.slice(-7).map(report => report.hoursWorked),
      },
    ],
  };

  const activityData = [
    {
      name: 'Masomo ya Biblia',
      population: weeklyReports.reduce((sum, r) => sum + r.totalBibleStudies, 0),
      color: '#1e3a8a',
      legendFontColor: '#1f2937',
      legendFontSize: 12,
    },
    {
      name: 'Maombi',
      population: weeklyReports.reduce((sum, r) => sum + r.totalPrayersOffered, 0),
      color: '#059669',
      legendFontColor: '#1f2937',
      legendFontSize: 12,
    },
    {
      name: 'Ziara',
      population: weeklyReports.reduce((sum, r) => sum + r.totalPeopleVisited, 0),
      color: '#dc2626',
      legendFontColor: '#1f2937',
      legendFontSize: 12,
    },
    {
      name: 'Mabatizo',
      population: weeklyReports.reduce((sum, r) => sum + r.totalBaptismsPerformed, 0),
      color: '#f59e0b',
      legendFontColor: '#1f2937',
      legendFontSize: 12,
    },
  ];

  const MetricCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <View style={[styles.metricCard, { borderTopColor: color }]}>
      <View style={styles.metricHeader}>
        <Icon size={20} color={color} />
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </View>
  );

  const ViewModeSelector = () => (
    <View style={styles.viewModeSelector}>
      <TouchableOpacity
        style={[styles.viewModeButton, viewMode === 'daily' && styles.viewModeButtonActive]}
        onPress={() => setViewMode('daily')}
      >
        <Text style={[styles.viewModeText, viewMode === 'daily' && styles.viewModeTextActive]}>
          Kila Siku
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.viewModeButton, viewMode === 'weekly' && styles.viewModeButtonActive]}
        onPress={() => setViewMode('weekly')}
      >
        <Text style={[styles.viewModeText, viewMode === 'weekly' && styles.viewModeTextActive]}>
          Kila Wiki
        </Text>
      </TouchableOpacity>
    </View>
  );

  const totalSales = weeklyReports.reduce((sum, report) => sum + report.totalAmount, 0);
  const totalHours = weeklyReports.reduce((sum, report) => sum + report.totalHours, 0);
  const totalBooks = weeklyReports.reduce((sum, report) => sum + report.totalBooksSold, 0);
  const averageWeeklySales = weeklyReports.length > 0 ? Math.round(totalSales / weeklyReports.length) : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Inapakia takwimu...</Text>
      </SafeAreaView>
    );
  }

  if (weeklyReports.length === 0 && dailyReports.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <BarChart3 size={64} color="#9ca3af" />
          <Text style={styles.emptyStateTitle}>Hakuna Takwimu</Text>
          <Text style={styles.emptyStateText}>Wasilisha taarifa ya kwanza kuona takwimu</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentData = viewMode === 'weekly' ? weeklyReports : dailyReports;
  const salesData = viewMode === 'weekly' ? weeklySalesData : dailySalesData;
  const hoursData = viewMode === 'weekly' ? weeklyHoursData : dailyHoursData;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Bodi ya Takwimu</Text>
          <Text style={styles.headerSubtitle}>Maarifa ya utendaji na mielekeo</Text>
        </View>

        {/* View Mode Selector */}
        <ViewModeSelector />

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Viashiria Muhimu vya Utendaji</Text>
          <View style={styles.metricsGrid}>
            <MetricCard
              title="Jumla ya Mauzo"
              value={`TSH ${totalSales.toLocaleString()}`}
              subtitle="Mapato ya wakati wote"
              icon={DollarSign}
              color="#059669"
            />
            <MetricCard
              title="Wastani wa Wiki"
              value={`TSH ${averageWeeklySales.toLocaleString()}`}
              subtitle="Wastani kwa wiki"
              icon={TrendingUp}
              color="#1e3a8a"
            />
            <MetricCard
              title="Jumla ya Masaa"
              value={totalHours}
              subtitle="Muda uliowekwa"
              icon={Calendar}
              color="#dc2626"
            />
            <MetricCard
              title="Vitabu Vilivyouzwa"
              value={totalBooks}
              subtitle="Vitabu vilivyosambazwa"
              icon={Award}
              color="#f59e0b"
            />
          </View>
        </View>

        {/* Sales Trend Chart */}
        {currentData.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Mwelekeo wa Mauzo ({viewMode === 'weekly' ? 'Wiki 6 za Mwisho' : 'Siku 7 za Mwisho'})
            </Text>
            <View style={styles.chartContainer}>
              <LineChart
                data={salesData}
                width={screenWidth - 48}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
            </View>
          </View>
        )}

        {/* Hours Worked Chart */}
        {currentData.length > 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Masaa ya Kazi ({viewMode === 'weekly' ? 'Kila Wiki' : 'Kila Siku'})
            </Text>
            <View style={styles.chartContainer}>
              <BarChart
                data={hoursData}
                width={screenWidth - 48}
                height={220}
                chartConfig={chartConfig}
                yAxisLabel=""
                yAxisSuffix="h"
                style={styles.chart}
              />
            </View>
          </View>
        )}

        {/* Ministry Activities Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mgawanyo wa Shughuli za Uongozaji</Text>
          <View style={styles.chartContainer}>
            <PieChart
              data={activityData.filter(item => item.population > 0)}
              width={screenWidth - 48}
              height={220}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              style={styles.chart}
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
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 24,
    backgroundColor: '#1e3a8a',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#bfdbfe',
  },
  viewModeSelector: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#ffffff',
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
  viewModeButtonActive: {
    backgroundColor: '#1e3a8a',
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  viewModeTextActive: {
    color: '#ffffff',
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6b7280',
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
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  metricCard: {
    backgroundColor: '#ffffff',
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
    color: '#6b7280',
    marginLeft: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  chartContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chart: {
    borderRadius: 16,
  },
});