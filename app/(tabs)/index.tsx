import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, TrendingUp, Book, DollarSign, Calendar, Clock, CircleAlert as AlertCircle, FileText, ChartBar as BarChart3, Settings } from 'lucide-react-native';
import { router } from 'expo-router';
import { DataService } from '@/services/DataService';
import { WeeklyReport, DailyReport, UserProfile } from '@/types/Report';
import { useIsFocused } from '@react-navigation/native';

export default function DashboardScreen() {
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [currentWeekReport, setCurrentWeekReport] = useState<WeeklyReport | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [missingDates, setMissingDates] = useState<string[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalBooks, setTotalBooks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [weekLocked, setWeekLocked] = useState(false);

  const isFocused = useIsFocused();

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      console.debug('[Dashboard] loading data...');
      const profile = await DataService.getUserProfile();
      const today = new Date().toISOString().split('T')[0];

      // load daily and weekly data
      const todayReportData = await DataService.getDailyReportByDate(today);
      const currentWeek = await DataService.getCurrentWeekReport();
      const weeklyReports = await DataService.getAllWeeklyReports();
      const missing = await DataService.getMissingDates();

      // check locked week from DataService
      const weekStart = DataService.getWeekStartDate(new Date());
      const locked = await DataService.isWeekLocked(weekStart);

      setUserProfile(profile);
      setTodayReport(todayReportData);
      setCurrentWeekReport(currentWeek);
      setMissingDates(missing || []);
      setTotalReports(Array.isArray(weeklyReports) ? weeklyReports.length : 0);

      const sales = (weeklyReports || []).reduce((sum, report) => sum + (Number(report.totalAmount) || 0), 0);
      const books = (weeklyReports || []).reduce((sum, report) => sum + (Number(report.totalBooksSold) || 0), 0);

      setTotalSales(sales);
      setTotalBooks(books);
      setWeekLocked(Boolean(locked));

      console.debug('[Dashboard] loaded:', { todayReportData, currentWeek, weeklyCount: weeklyReports?.length, missingCount: missing?.length, weekLocked: locked });
    } catch (error) {
      console.error('[Dashboard] Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // reload when screen is focused (solves "data saved but dashboard not updated" issue)
  useEffect(() => {
    if (isFocused) loadDashboardData();
  }, [isFocused, loadDashboardData]);

  const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Icon size={24} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const QuickAction = ({ title, icon: Icon, onPress, color }: any) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} disabled={weekLocked && title === 'Taarifa Mpya'}>
      <Icon size={32} color={color} />
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  const getCurrentWeekStatusLocal = () => {
    // local fallback message if DataService lock check isn't ready yet
    if (weekLocked) return { status: 'locked', message: 'Wiki imefungwa' };
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const currentHour = today.getHours();

    if (dayOfWeek === 5 && currentHour >= 18) {
      return { status: 'locked', message: 'Wiki imefungwa (Ijumaa 6:00 PM)' };
    } else if (dayOfWeek === 6) {
      return { status: 'weekend', message: 'Jumamosi - Hakuna kazi' };
    } else {
      return { status: 'active', message: 'Wiki inaendelea' };
    }
  };

  const weekStatus = getCurrentWeekStatusLocal();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Karibu Tena</Text>
          <Text style={styles.titleText}>{userProfile?.fullName || 'DODOMA CTF 2025'}</Text>
          <Text style={styles.subtitleText}>Mfumo wa Taarifa za Uuzaji</Text>
        </View>

        {/* Today's Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hali ya Leo</Text>
          {todayReport ? (
            <View style={styles.todayCard}>
              <View style={styles.todayHeader}>
                <Text style={styles.todayTitle}>
                  {DataService.getDayName(new Date())} - Leo
                </Text>
                <View style={styles.completedBadge}>
                  <Text style={styles.completedBadgeText}>Imekamilika</Text>
                </View>
              </View>
              <Text style={styles.todayHours}>{todayReport.hoursWorked} masaa ya kazi</Text>
              <Text style={styles.todayAmount}>TSH {Number(todayReport.dailyAmount || 0).toLocaleString()}</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.noReportCard}
              onPress={() => {
                if (weekLocked) {
                  Alert.alert('Wiki Imefungwa', 'Huwezi kutengeneza taarifa mpya kwa wiki iliyofungwa.');
                  return;
                }
                router.push('/new-report');
              }}
            >
              <Plus size={32} color={weekStatus.status === 'locked' ? '#9ca3af' : '#1e3a8a'} />
              <Text style={[
                styles.noReportText,
                weekStatus.status === 'locked' && styles.noReportTextDisabled
              ]}>
                {weekStatus.status === 'locked' ? 'Wiki Imefungwa' : 'Anza Taarifa ya Leo'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Week Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hali ya Wiki Hii</Text>
          <View style={[
            styles.weekStatusCard,
            { backgroundColor: weekStatus.status === 'locked' ? '#fef2f2' : '#f0fdf4' }
          ]}>
            <Clock size={20} color={weekStatus.status === 'locked' ? '#dc2626' : '#059669'} />
            <Text style={[
              styles.weekStatusText,
              { color: weekStatus.status === 'locked' ? '#dc2626' : '#059669' }
            ]}>
              {weekStatus.message}
            </Text>
          </View>

          {currentWeekReport && (
            <View style={styles.currentWeekCard}>
              <Text style={styles.currentWeekTitle}>Wiki #{currentWeekReport.weekNumber}</Text>
              <Text style={styles.currentWeekInfo}>
                {currentWeekReport.dailyReports.length} siku zimejazwa kati ya 6
              </Text>
              <Text style={styles.currentWeekAmount}>
                TSH {Number(currentWeekReport.totalAmount || 0).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Missing Reports Alert */}
        {missingDates.length > 0 && (
          <View style={styles.section}>
            <View style={styles.missingReportsCard}>
              <AlertCircle size={20} color="#f59e0b" />
              <View style={styles.missingReportsText}>
                <Text style={styles.missingReportsTitle}>
                  Taarifa {missingDates.length} hazijajazwa
                </Text>
                <Text style={styles.missingReportsSubtitle}>
                  Bonyeza hapa kujaza taarifa za nyuma
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.fillMissingButton}
                onPress={() => router.push('/new-report')}
              >
                <Text style={styles.fillMissingButtonText}>Jaza</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Statistics Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Muhtasari wa Takwimu</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Jumla ya Wiki"
              value={totalReports}
              subtitle="Wiki zilizokamilika"
              icon={FileText}
              color="#1e3a8a"
            />
            <StatCard
              title="Jumla ya Mauzo"
              value={`TSH ${Number(totalSales || 0).toLocaleString()}`}
              subtitle="Mapato yaliyopatikana"
              icon={DollarSign}
              color="#059669"
            />
            <StatCard
              title="Vitabu Vilivyouzwa"
              value={totalBooks}
              subtitle="Vitabu vilivyosambazwa"
              icon={Book}
              color="#dc2626"
            />
            <StatCard
              title="Kiwango cha Utendaji"
              value="87%"
              subtitle="Kulingana na shughuli"
              icon={TrendingUp}
              color="#f59e0b"
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vitendo vya Haraka</Text>
          <View style={styles.quickActionsGrid}>
            <QuickAction
              title="Taarifa Mpya"
              icon={Plus}
              color="#1e3a8a"
              onPress={() => {
                if (weekLocked) {
                  Alert.alert('Wiki Imefungwa', 'Huwezi kutengeneza taarifa mpya kwa wiki iliyofungwa.');
                  return;
                }
                router.push('/new-report');
              }}
            />
            <QuickAction
              title="Ona Taarifa"
              icon={FileText}
              color="#059669"
              onPress={() => router.push('/reports')}
            />
            <QuickAction
              title="Takwimu"
              icon={BarChart3}
              color="#dc2626"
              onPress={() => router.push('/analytics')}
            />
            <QuickAction
              title="Mipangilio"
              icon={Settings}
              color="#f59e0b"
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
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 24,
    backgroundColor: '#1e3a8a',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  welcomeText: {
    fontSize: 16,
    color: '#93c5fd',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 14,
    color: '#bfdbfe',
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  todayCard: {
    backgroundColor: '#ffffff',
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
    color: '#1f2937',
  },
  completedBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  completedBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  todayHours: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  todayAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  noReportCard: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  noReportText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
    marginTop: 12,
  },
  noReportTextDisabled: {
    color: '#9ca3af',
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
    backgroundColor: '#ffffff',
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
    color: '#1f2937',
    marginBottom: 4,
  },
  currentWeekInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  currentWeekAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  missingReportsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  missingReportsText: {
    flex: 1,
    marginLeft: 12,
  },
  missingReportsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 2,
  },
  missingReportsSubtitle: {
    fontSize: 14,
    color: '#a16207',
  },
  fillMissingButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fillMissingButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    backgroundColor: '#ffffff',
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
    color: '#6b7280',
    marginLeft: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  quickAction: {
    backgroundColor: '#ffffff',
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
    color: '#1f2937',
    marginTop: 8,
    textAlign: 'center',
  },
});